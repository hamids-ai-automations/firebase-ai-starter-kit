import type { CallableRequest } from 'firebase-functions/v2/https';
import type { ZodType } from 'zod';
import { parseOrThrow } from '../validation/parse';
import { requireAuth, type AuthContext } from './auth';
import { enforceRateLimit, type EndpointRateLimit } from './rate-limit';
import { toHttpsError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface CallableHandlerOptions<TInput> {
  name: string;
  schema?: ZodType<TInput>;
  requiresAuth?: boolean;
  rateLimit?: EndpointRateLimit | null;
}

export interface CallableHandlerContext<TInput> {
  name: string;
  input: TInput;
  auth?: AuthContext;
  userId?: string;
  request: CallableRequest;
}

export interface SuccessEnvelope<TOutput> {
  ok: true;
  data: TOutput;
}

/**
 * Single request pipeline shared by every callable:
 *   auth -> rate limit -> validation -> handler -> uniform error mapping.
 *
 * Keeping this in one place means a new endpoint cannot accidentally skip
 * authentication or validation.
 */
export function createCallableHandler<TInput, TOutput>(
  options: CallableHandlerOptions<TInput>,
  handler: (context: CallableHandlerContext<TInput>) => Promise<TOutput>,
): (request: CallableRequest) => Promise<SuccessEnvelope<TOutput>> {
  return async (request) => {
    const started = Date.now();
    try {
      const auth = options.requiresAuth === false ? undefined : requireAuth(request);

      if (auth && options.rateLimit !== null) {
        await enforceRateLimit({
          userId: auth.uid,
          endpoint: options.name,
          config: options.rateLimit,
        });
      }

      const input =
        options.schema === undefined
          ? ((request.data ?? {}) as TInput)
          : parseOrThrow(options.schema, request.data);

      const data = await handler({
        name: options.name,
        input,
        auth,
        userId: auth?.uid,
        request,
      });

      logger.info('callable_completed', {
        endpoint: options.name,
        uid: auth?.uid,
        durationMs: Date.now() - started,
      });

      return { ok: true as const, data };
    } catch (error) {
      logger.warn('callable_failed', {
        endpoint: options.name,
        uid: request.auth?.uid,
        durationMs: Date.now() - started,
      });
      throw toHttpsError(error, options.name);
    }
  };
}
