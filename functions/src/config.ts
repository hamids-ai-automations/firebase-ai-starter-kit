/**
 * Central runtime configuration for Cloud Functions.
 *
 * Everything that can vary between local development and production lives
 * here so the rest of the codebase stays declarative and testable.
 */

export const REGION = process.env.FUNCTIONS_REGION ?? 'us-central1';

/** Model catalogue exposed to the client. Keys are the only values accepted. */
export const SUPPORTED_MODELS = {
  'gemini-2.5-flash': {
    label: 'Gemini 2.5 Flash',
    description: 'Fast, low-cost default for chat and generation.',
  },
  'gemini-2.5-pro': {
    label: 'Gemini 2.5 Pro',
    description: 'Higher quality reasoning for complex prompts.',
  },
} as const;

export type SupportedModel = keyof typeof SUPPORTED_MODELS;

export const DEFAULT_MODEL: SupportedModel = 'gemini-2.5-flash';

export const AI_LIMITS = {
  /** Hard cap on prompt characters accepted by any endpoint. */
  maxPromptChars: 8000,
  /** Hard cap on system instruction characters. */
  maxSystemInstructionChars: 4000,
  maxHistoryMessages: 40,
  maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1024),
  temperature: 0.7,
} as const;

export const RATE_LIMITS = {
  ai: {
    maxRequests: Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS ?? 20),
    windowSeconds: Number(process.env.AI_RATE_LIMIT_WINDOW_SECONDS ?? 60),
  },
  write: {
    maxRequests: 60,
    windowSeconds: 60,
  },
} as const;

export function isSupportedModel(value: string): value is SupportedModel {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_MODELS, value);
}

/**
 * Mock mode exists so the demo application and CI can exercise the whole
 * request path without a paid Gemini key. It is opt-in, and it is force-disabled
 * outside the emulator so a deployed project can never serve fake model output
 * by accident.
 */
export function resolveMockMode(): boolean {
  const requested = (process.env.AI_MOCK_MODE ?? 'false').toLowerCase() === 'true';
  const inEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  return requested && inEmulator;
}

export function resolveApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim().length === 0) return undefined;
  return key.trim();
}
