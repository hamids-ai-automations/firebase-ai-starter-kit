import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { logger } from './logger';

/**
 * Error handling contract for every endpoint in this kit:
 *  - expected failures are raised as `AppError` with a stable public message
 *  - anything unexpected is converted to a generic `internal` HttpsError
 *  - the original error text is logged, never returned to the client
 */
export class AppError extends Error {
  readonly code: FunctionsErrorCode;
  readonly publicMessage: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: FunctionsErrorCode,
    publicMessage: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(publicMessage);
    this.name = 'AppError';
    this.code = code;
    this.publicMessage = publicMessage;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export const unauthorized = (message = 'You must sign in to use this endpoint.'): AppError =>
  new AppError('unauthenticated', message);

export const invalidInput = (
  message = 'The request payload is invalid.',
  details?: Record<string, unknown>,
): AppError => new AppError('invalid-argument', message, { details });

export const rateLimited = (retryAfterSeconds: number): AppError =>
  new AppError('resource-exhausted', 'Rate limit exceeded. Please retry shortly.', {
    details: { retryAfterSeconds },
  });

export const notFound = (message = 'The requested resource was not found.'): AppError =>
  new AppError('not-found', message);

export const permissionDenied = (
  message = 'You are not allowed to perform this action.',
): AppError => new AppError('permission-denied', message);

/** Converts any thrown value into a safe HttpsError for the caller. */
export function toHttpsError(error: unknown, context: string): HttpsError {
  if (error instanceof AppError) {
    return new HttpsError(error.code, error.publicMessage, error.details);
  }

  if (error instanceof HttpsError) {
    return error;
  }

  logger.error('unhandled_endpoint_error', {
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return new HttpsError('internal', 'Something went wrong. Please try again later.');
}
