import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { resolveApiKey, resolveMockMode } from '../config';
import { createGeminiClient, createMockClient, type AiClient } from './gemini';

export interface AiProvider {
  client: AiClient;
  mocked: boolean;
  mode: 'gemini' | 'mock';
}

/**
 * Decides, per invocation, whether real Gemini or the deterministic mock runs.
 * Real key beats mock every time; an unconfigured deployment fails loudly.
 */
export function getAiProvider(): AiProvider {
  const apiKey = resolveApiKey();
  if (apiKey) {
    return { client: createGeminiClient({ apiKey }), mocked: false, mode: 'gemini' };
  }

  if (resolveMockMode()) {
    logger.warn('ai_mock_mode_active', { reason: 'no GEMINI_API_KEY, emulator only' });
    return { client: createMockClient(), mocked: true, mode: 'mock' };
  }

  throw new AppError(
    'failed-precondition',
    'AI is not configured for this project. Set the GEMINI_API_KEY secret before calling AI endpoints.',
  );
}

export function describeAiMode(): 'gemini' | 'mock' | 'unconfigured' {
  if (resolveApiKey()) return 'gemini';
  if (resolveMockMode()) return 'mock';
  return 'unconfigured';
}
