import { GoogleGenAI } from '@google/genai';
import { AI_LIMITS, DEFAULT_MODEL } from '../config';
import { logger } from '../utils/logger';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GenerateRequest {
  model?: string;
  prompt?: string;
  history?: ChatTurn[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** When present, the model is asked to answer with JSON matching this schema. */
  responseSchema?: Record<string, unknown>;
}

export interface UsageMetadata {
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  usage?: UsageMetadata;
  finishReason?: string;
  /** True when the deterministic mock client answered instead of Gemini. */
  mocked: boolean;
}

export interface AiClient {
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export interface GeminiClientOptions {
  apiKey: string;
  defaultModel?: string;
  /** Injecting this keeps the wrapper unit-testable without network access. */
  transport?: GeminiTransport;
}

export interface GeminiTransport {
  generateContent(params: {
    model: string;
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    config: Record<string, unknown>;
  }): Promise<{
    text?: string;
    candidates?: Array<{ finishReason?: string }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  }>;
}

/** Thin adapter around the Google Gen AI SDK. */
export function createGeminiTransport(apiKey: string): GeminiTransport {
  const client = new GoogleGenAI({ apiKey });
  return {
    async generateContent({ model, contents, config }) {
      const response = await client.models.generateContent({
        model,
        contents,
        config: config as never,
      });
      return response as unknown as Awaited<ReturnType<GeminiTransport['generateContent']>>;
    },
  };
}

export function createGeminiClient(options: GeminiClientOptions): AiClient {
  const transport = options.transport ?? createGeminiTransport(options.apiKey);
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL;

  return {
    async generate(request) {
      const model = request.model ?? defaultModel;
      const contents = buildContents(request);
      const config: Record<string, unknown> = {
        temperature: request.temperature ?? AI_LIMITS.temperature,
        maxOutputTokens: request.maxOutputTokens ?? AI_LIMITS.maxOutputTokens,
      };
      if (request.systemInstruction) config.systemInstruction = request.systemInstruction;
      if (request.responseSchema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = request.responseSchema;
      }

      const started = Date.now();
      const response = await transport.generateContent({ model, contents, config });

      const usage = response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            candidateTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
          }
        : undefined;

      logger.info('gemini_request_completed', {
        model,
        durationMs: Date.now() - started,
        promptChars: (request.prompt ?? '').length,
        historyTurns: request.history?.length ?? 0,
        structured: Boolean(request.responseSchema),
        totalTokens: usage?.totalTokens,
      });

      return {
        text: extractText(response),
        model,
        usage,
        finishReason: response.candidates?.[0]?.finishReason,
        mocked: false,
      };
    },
  };
}

function buildContents(request: GenerateRequest) {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const turn of request.history ?? []) {
    contents.push({ role: turn.role, parts: [{ text: turn.text }] });
  }
  if (request.prompt) {
    contents.push({ role: 'user', parts: [{ text: request.prompt }] });
  }
  return contents;
}

function extractText(response: { text?: string; candidates?: unknown[] }): string {
  if (typeof response.text === 'string' && response.text.length > 0) {
    return response.text;
  }
  // Fallback for SDK versions that only expose candidates.
  const candidates = (response.candidates ?? []) as Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  const parts = candidates[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

/** Deterministic, offline stand-in used by local demos and CI. */
export function createMockClient(overrides?: { latencyMs?: number }): AiClient {
  return {
    async generate(request) {
      if (overrides?.latencyMs) {
        await new Promise((resolve) => setTimeout(resolve, overrides.latencyMs));
      }
      const prompt = request.prompt ?? '';
      const model = request.model ?? DEFAULT_MODEL;

      if (request.responseSchema) {
        return {
          text: JSON.stringify({
            title: 'Mock structured response',
            summary:
              'This JSON was produced by the built-in mock client because no Gemini API key is configured in this environment.',
            keyPoints: [
              'Mock mode keeps the full request path testable offline.',
              'Schema validation still runs against the real Zod contract.',
              'Set GEMINI_API_KEY to get real model output.',
            ],
            tone: 'technical',
            tags: ['mock-mode', 'structured-output', 'gemini'],
          }),
          model,
          mocked: true,
          finishReason: 'STOP',
        };
      }

      return {
        text: `[mock] Gemini is not configured in this environment. Echoing your ${prompt.length}-character prompt so the request path, validation and persistence layers can still be verified end to end.`,
        model,
        mocked: true,
        finishReason: 'STOP',
      };
    },
  };
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const RETRYABLE_PATTERNS = [
  /429/,
  /rate limit/i,
  /quota/i,
  /deadline exceeded/i,
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /503/,
  /502/,
  /500/,
];

export function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message}` : String(error);
  const status = (error as { status?: number; code?: number } | undefined)?.status;
  if (typeof status === 'number' && status >= 500) return true;
  const retryableCode = (error as { code?: number } | undefined)?.code;
  if (retryableCode === 429) return true;
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Exponential backoff with jitter. Only retryable (transient) failures are
 * retried; validation and authorization errors fail fast.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 4000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error)) break;
      const jitter = Math.floor(Math.random() * 100);
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) + jitter;
      logger.warn('gemini_retry_scheduled', { attempt: attempt + 1, delayMs: delay, at: now() });
      await sleep(delay);
    }
  }
  throw lastError;
}
