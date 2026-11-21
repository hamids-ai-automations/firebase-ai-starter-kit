import { RATE_LIMITS } from '../config';
import {
  checkRateLimit,
  createFirestoreRateLimitStore,
  type RateLimitStore,
} from '../rate-limit/limiter';
import { db } from '../lib/admin';
import { rateLimited } from '../utils/errors';

export interface EndpointRateLimit {
  maxRequests: number;
  windowSeconds: number;
}

let cachedStore: RateLimitStore | undefined;

export function defaultStore(): RateLimitStore {
  if (!cachedStore) cachedStore = createFirestoreRateLimitStore(db());
  return cachedStore;
}

/** Test seam: swap in an in-memory store. */
export function setRateLimitStore(store: RateLimitStore | undefined): void {
  cachedStore = store;
}

export async function enforceRateLimit(params: {
  userId: string;
  endpoint: string;
  config?: EndpointRateLimit;
  store?: RateLimitStore;
  now?: number;
}): Promise<void> {
  const config = params.config ?? RATE_LIMITS.ai;
  const decision = await checkRateLimit(params.store ?? defaultStore(), {
    userId: params.userId,
    endpoint: params.endpoint,
    maxRequests: config.maxRequests,
    windowSeconds: config.windowSeconds,
    now: params.now,
  });

  if (!decision.allowed) {
    throw rateLimited(decision.retryAfterSeconds);
  }
}
