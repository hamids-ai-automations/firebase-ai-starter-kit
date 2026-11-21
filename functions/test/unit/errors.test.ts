import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  AppError,
  invalidInput,
  notFound,
  permissionDenied,
  rateLimited,
  toHttpsError,
  unauthorized,
} from '../../src/utils/errors';

describe('toHttpsError', () => {
  it('passes through AppError codes and public messages', () => {
    const httpsError = toHttpsError(unauthorized(), 'test');
    expect(httpsError).toBeInstanceOf(HttpsError);
    expect(httpsError.code).toBe('unauthenticated');
    expect(httpsError.message).toBe('You must sign in to use this endpoint.');
  });

  it('preserves validation details', () => {
    const httpsError = toHttpsError(invalidInput('bad', { issues: [{ path: 'prompt' }] }), 'test');
    expect(httpsError.code).toBe('invalid-argument');
    expect(httpsError.details).toEqual({ issues: [{ path: 'prompt' }] });
  });

  it('keeps existing HttpsErrors untouched', () => {
    const original = new HttpsError('not-found', 'missing');
    expect(toHttpsError(original, 'test')).toBe(original);
  });

  it('never leaks internal error text to clients', () => {
    const httpsError = toHttpsError(new Error('secret internal detail: db password'), 'test');
    expect(httpsError.code).toBe('internal');
    expect(httpsError.message).not.toContain('secret internal detail');
  });

  it('maps helper factories to the expected codes', () => {
    expect(rateLimited(30).code).toBe('resource-exhausted');
    expect(notFound().code).toBe('not-found');
    expect(permissionDenied().code).toBe('permission-denied');
    expect(invalidInput().code).toBe('invalid-argument');
    expect(new AppError('failed-precondition', 'x').code).toBe('failed-precondition');
  });
});
