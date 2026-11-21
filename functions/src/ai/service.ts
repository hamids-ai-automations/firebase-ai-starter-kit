import type { ZodType } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  withRetry,
  type AiClient,
  type ChatTurn,
  type GenerateResult,
  type UsageMetadata,
} from './gemini';

export interface TextGenerationParams {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  usage?: UsageMetadata;
  mocked: boolean;
}

export interface StructuredGenerationParams<T> {
  prompt: string;
  schema: ZodType<T>;
  jsonSchema: Record<string, unknown>;
  model?: string;
  systemInstruction?: string;
}

export interface StructuredGenerationResult<T> {
  data: T;
  model: string;
  usage?: UsageMetadata;
  mocked: boolean;
  /** Number of model calls used (1 normally, 2 when a repair pass was needed). */
  attempts: number;
}

export interface ChatParams {
  history?: ChatTurn[];
  message: string;
  systemInstruction?: string;
  model?: string;
}

/** Plain text generation with retry, timeout-friendly error mapping. */
export async function generateText(
  client: AiClient,
  params: TextGenerationParams,
): Promise<TextGenerationResult> {
  const result = await runWithRetry(client, {
    prompt: params.prompt,
    systemInstruction: params.systemInstruction,
    model: params.model,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
  });
  return toTextResult(result);
}

/**
 * Structured generation: the model is constrained by a JSON Schema, then the
 * payload is validated with the matching Zod schema. If the first answer is not
 * valid JSON, one repair turn is attempted before failing loudly.
 */
export async function generateStructuredOutput<T>(
  client: AiClient,
  params: StructuredGenerationParams<T>,
): Promise<StructuredGenerationResult<T>> {
  const first = await runWithRetry(client, {
    prompt: params.prompt,
    systemInstruction:
      params.systemInstruction ??
      'Return only JSON that matches the provided schema. Do not wrap it in prose.',
    model: params.model,
    responseSchema: params.jsonSchema,
  });

  const firstParsed = tryValidate(first.text, params.schema);
  if (firstParsed.success) {
    return {
      data: firstParsed.data,
      model: first.model,
      usage: first.usage,
      mocked: first.mocked,
      attempts: 1,
    };
  }

  logger.warn('structured_output_repair', { issues: firstParsed.issues.length });

  const repair = await runWithRetry(client, {
    prompt: `${params.prompt}\n\nYour previous answer was rejected by schema validation.\nIssues:\n${firstParsed.issues
      .map((issue) => `- ${issue}`)
      .join('\n')}\nReturn corrected JSON only.`,
    systemInstruction: 'Return only valid JSON. No markdown fences, no commentary.',
    model: params.model,
    responseSchema: params.jsonSchema,
  });

  const repaired = tryValidate(repair.text, params.schema);
  if (!repaired.success) {
    throw new AppError('internal', 'The model did not return valid structured output.', {
      details: { issues: repaired.issues },
    });
  }

  return {
    data: repaired.data,
    model: repair.model,
    usage: repair.usage,
    mocked: repair.mocked,
    attempts: 2,
  };
}

/** Multi-turn chat: history is supplied by the caller, never trusted blindly. */
export async function sendChatMessage(
  client: AiClient,
  params: ChatParams,
): Promise<TextGenerationResult> {
  const result = await runWithRetry(client, {
    history: params.history,
    prompt: params.message,
    systemInstruction:
      params.systemInstruction ?? 'You are a concise, helpful assistant embedded in a demo app.',
    model: params.model,
  });
  return toTextResult(result);
}

async function runWithRetry(client: AiClient, request: Parameters<AiClient['generate']>[0]) {
  return withRetry(() => client.generate(request), { retries: 2, baseDelayMs: 200 });
}

function toTextResult(result: GenerateResult): TextGenerationResult {
  const text = result.text.trim();
  if (text.length === 0) {
    throw new AppError('internal', 'The model returned an empty response.');
  }
  return { text, model: result.model, usage: result.usage, mocked: result.mocked };
}

type ValidationOutcome<T> = { success: true; data: T } | { success: false; issues: string[] };

function tryValidate<T>(raw: string, schema: ZodType<T>): ValidationOutcome<T> {
  let parsedJson: unknown;
  try {
    parsedJson = extractJson(raw);
  } catch {
    return { success: false, issues: ['response was not parseable JSON'] };
  }

  const result = schema.safeParse(parsedJson);
  if (result.success) return { success: true, data: result.data };

  return {
    success: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  };
}

/** Tolerates markdown fences and leading/trailing prose around a JSON object. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidate = withoutFences.startsWith('{')
    ? withoutFences
    : sliceOutermostObject(withoutFences);

  return JSON.parse(candidate);
}

function sliceOutermostObject(value: string): string {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response.');
  }
  return value.slice(start, end + 1);
}
