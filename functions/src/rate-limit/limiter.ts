import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  windowStartSeconds: number;
}

export interface RateLimitStore {
  /** Atomically increments the counter for `key` and returns the new value. */
  increment(key: string, windowStartSeconds: number): Promise<number>;
}

export interface RateLimitOptions {
  userId: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  /** Injectable clock so the behaviour is deterministic in tests. */
  now?: number;
}

/**
 * Fixed-window counter. Simple, cheap (one transactional read/write) and good
 * enough to stop accidental abuse of expensive AI endpoints. A sliding-window
 * or token-bucket implementation can replace this behind the same interface.
 */
export async function checkRateLimit(
  store: RateLimitStore,
  options: RateLimitOptions,
): Promise<RateLimitDecision> {
  const { userId, endpoint, maxRequests, windowSeconds } = options;
  const now = options.now ?? Date.now();

  if (maxRequests <= 0) {
    return {
      allowed: true,
      limit: 0,
      remaining: 0,
      retryAfterSeconds: 0,
      windowStartSeconds: 0,
    };
  }

  const windowStartSeconds = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const retryAfterSeconds = windowStartSeconds + windowSeconds - Math.floor(now / 1000);

  const key = `${sanitize(userId)}:${sanitize(endpoint)}:${windowStartSeconds}`;
  const count = await store.increment(key, windowStartSeconds);

  const allowed = count <= maxRequests;
  if (!allowed) {
    logger.warn('rate_limit_exceeded', { endpoint, limit: maxRequests, windowSeconds });
  }

  return {
    allowed,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - count),
    retryAfterSeconds: Math.max(1, retryAfterSeconds),
    windowStartSeconds,
  };
}

/** Firestore-backed store, with an `expireAt` field suitable for a TTL policy. */
export function createFirestoreRateLimitStore(firestore: Firestore): RateLimitStore {
  return {
    async increment(key, windowStartSeconds) {
      const ref = firestore.collection('rateLimits').doc(key);
      return firestore.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const current = snapshot.exists ? Number(snapshot.get('count') ?? 0) : 0;
        const next = current + 1;
        tx.set(
          ref,
          {
            count: next,
            windowStart: Timestamp.fromMillis(windowStartSeconds * 1000),
            expireAt: Timestamp.fromMillis((windowStartSeconds + 60 * 60 * 24) * 1000),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
        return next;
      });
    },
  };
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}
