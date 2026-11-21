import { describe, expect, it } from 'vitest';
import { ApiError, normalizeError } from './api';

describe('normalizeError', () => {
  it('passes ApiError through untouched', () => {
    const original = new ApiError('not-found', 'gone');
    expect(normalizeError(original)).toBe(original);
  });

  it('strips the functions/ prefix and maps to a friendly message', () => {
    const normalised = normalizeError({ code: 'functions/unauthenticated', message: 'raw' });
    expect(normalised.code).toBe('unauthenticated');
    expect(normalised.message).toBe('Please sign in first.');
  });

  it('maps resource-exhausted to a rate limit hint', () => {
    const normalised = normalizeError({ code: 'functions/resource-exhausted' });
    expect(normalised.code).toBe('resource-exhausted');
    expect(normalised.message).toMatch(/rate limit/i);
  });

  it('keeps unknown messages but downgrades the code', () => {
    const normalised = normalizeError({ code: 'functions/something-weird', message: 'boom' });
    expect(normalised.code).toBe('unknown');
    expect(normalised.message).toBe('boom');
  });

  it('falls back to a generic message when nothing usable is present', () => {
    const normalised = normalizeError(null);
    expect(normalised.code).toBe('unknown');
    expect(normalised.message).toBe('Request failed.');
  });
});
