import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit, type RateLimitStore } from '../../src/rate-limit/limiter';

function memoryStore(): RateLimitStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async increment(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  };
}

describe('checkRateLimit', () => {
  const base = {
    userId: 'user-1',
    endpoint: 'aiChat',
    maxRequests: 3,
    windowSeconds: 60,
  };

  it('allows requests under the limit', async () => {
    const store = memoryStore();
    const first = await checkRateLimit(store, { ...base, now: 1_700_000_000_000 });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
  });

  it('blocks requests over the limit', async () => {
    const store = memoryStore();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect((await checkRateLimit(store, { ...base, now })).allowed).toBe(true);
    }
    const blocked = await checkRateLimit(store, { ...base, now });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets in a new window', async () => {
    const store = memoryStore();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) await checkRateLimit(store, { ...base, now });
    const nextWindow = now + 61_000;
    expect((await checkRateLimit(store, { ...base, now: nextWindow })).allowed).toBe(true);
  });

  it('isolates users and endpoints from each other', async () => {
    const store = memoryStore();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) await checkRateLimit(store, { ...base, now });
    expect((await checkRateLimit(store, { ...base, userId: 'user-2', now })).allowed).toBe(true);
    expect(
      (await checkRateLimit(store, { ...base, endpoint: 'aiGenerateText', now })).allowed,
    ).toBe(true);
  });

  it('does not call the store when the limit is disabled', async () => {
    const store = memoryStore();
    const spy = vi.spyOn(store, 'increment');
    const decision = await checkRateLimit(store, { ...base, maxRequests: 0 });
    expect(decision.allowed).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
