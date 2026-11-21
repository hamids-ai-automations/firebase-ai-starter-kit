import type { ZodType } from 'zod';
import { invalidInput } from '../utils/errors';

/**
 * Parses untrusted input against a schema and converts failures into a single
 * `invalid-argument` error with field-level details (never a stack trace).
 */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

  throw invalidInput('The request payload is invalid.', { issues });
}
