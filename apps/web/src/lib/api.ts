import { httpsCallable, type Functions } from 'firebase/functions';
import type {
  ChatResult,
  ChatTurn,
  SecurityResult,
  StructuredResult,
  TextResult,
  UsageSummary,
} from '../types';

export type ErrorCode =
  | 'invalid-argument'
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'internal'
  | 'unknown';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

interface Envelope<T> {
  ok: true;
  data: T;
}

/**
 * Single call path for every endpoint: unwraps the `{ ok, data }` envelope and
 * normalises Firebase error codes into `ApiError`.
 */
async function call<TPayload, TResult>(
  functions: Functions,
  name: string,
  payload: TPayload,
): Promise<TResult> {
  const callable = httpsCallable<TPayload, Envelope<TResult>>(functions, name);
  try {
    const response = await callable(payload);
    const body = response.data;
    if (!body || body.ok !== true) {
      throw new ApiError('unknown', 'Unexpected response shape from server.');
    }
    return body.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const candidate = (
    typeof error === 'object' && error !== null ? error : {}
  ) as { code?: string; message?: string; details?: unknown };
  const rawCode = typeof candidate.code === 'string' ? candidate.code : 'unknown';
  const code = (rawCode.startsWith('functions/') ? rawCode.slice('functions/'.length) : rawCode) as ErrorCode;

  const messages: Record<string, string> = {
    unauthenticated: 'Please sign in first.',
    'permission-denied': 'You do not have access to this resource.',
    'invalid-argument': 'The request was invalid. Check the form fields.',
    'resource-exhausted': 'Rate limit reached. Please wait a moment and try again.',
    'failed-precondition': 'AI is not configured on this deployment (missing API key).',
    'not-found': 'Not found.',
    internal: 'Something went wrong on the server.',
  };

  return new ApiError(
    (messages[code] ? code : 'unknown') as ErrorCode,
    messages[code] ?? (candidate.message || 'Request failed.'),
    candidate.details,
  );
}

export const api = {
  generateText: (functions: Functions, payload: { prompt: string; systemInstruction?: string }) =>
    call<typeof payload, TextResult>(functions, 'aiGenerateText', payload),

  generateStructured: (functions: Functions, payload: { prompt: string }) =>
    call<typeof payload, StructuredResult>(functions, 'aiGenerateStructured', payload),

  chat: (
    functions: Functions,
    payload: { message: string; conversationId?: string; history?: ChatTurn[] },
  ) => call<typeof payload, ChatResult>(functions, 'aiChat', payload),

  deleteConversation: (functions: Functions, conversationId: string) =>
    call<{ conversationId: string }, { deleted: number }>(functions, 'deleteConversation', {
      conversationId,
    }),

  ensureProfile: (functions: Functions) =>
    call<Record<string, never>, { uid: string; created: boolean }>(functions, 'ensureUserProfile', {}),

  updateProfile: (
    functions: Functions,
    payload: { displayName?: string; bio?: string; preferences?: Record<string, unknown> },
  ) =>
    call<typeof payload, { uid: string; updated: string[] }>(functions, 'updateUserProfile', payload),

  secureEcho: (functions: Functions, payload: { message: string; priority?: string }) =>
    call<typeof payload, SecurityResult>(functions, 'secureEcho', payload),

  usageSummary: (functions: Functions) =>
    call<Record<string, never>, UsageSummary>(functions, 'aiUsageSummary', {}),
};
