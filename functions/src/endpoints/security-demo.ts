import { onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config';
import { createCallableHandler } from '../middleware/handler';
import { parseOrThrow } from '../validation/parse';
import { secureEchoInputSchema } from '../validation/schemas';
import { logger } from '../utils/logger';

const callableOptions = {
  region: REGION,
  maxInstances: 10,
  memory: '256MiB' as const,
  timeoutSeconds: 15,
};

/**
 * Deliberately small authenticated endpoint used by the "Security" demo tab.
 * It shows, in one round trip, that:
 *  - unauthenticated calls are rejected,
 *  - the payload is schema-validated,
 *  - the identity used is the verified token, not a client claim,
 *  - the response is sanitized.
 */
export const secureEcho = onCall(callableOptions, (request) =>
  createCallableHandler<
    { message: string; priority: 'low' | 'normal' | 'high' },
    {
      echo: string;
      priority: string;
      verifiedUid: string;
      receivedAt: string;
      checks: string[];
    }
  >(
    { name: 'secureEcho', schema: undefined, rateLimit: { maxRequests: 30, windowSeconds: 60 } },
    async ({ input, userId, request: callableRequest }) => {
      const parsed = parseOrThrow(secureEchoInputSchema, input ?? {});
      const claimed = (callableRequest.data as { uid?: unknown } | undefined)?.uid;

      if (claimed !== undefined && claimed !== userId) {
        logger.warn('spoofed_uid_rejected', { endpoint: 'secureEcho' });
      }

      return {
        echo: parsed.message.replace(/[<>]/g, ''),
        priority: parsed.priority,
        verifiedUid: userId as string,
        receivedAt: new Date().toISOString(),
        checks: [
          'Firebase ID token verified server-side',
          'Request body validated against a strict schema',
          'Client-supplied uid ignored in favour of token identity',
          'Rate limit applied per user and endpoint',
          'Response sanitized before serialization',
        ],
      };
    },
  )(request),
);
