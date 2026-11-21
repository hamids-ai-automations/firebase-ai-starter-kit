import type { CallableRequest } from 'firebase-functions/v2/https';
import { unauthorized } from '../utils/errors';

export interface AuthContext {
  uid: string;
  email?: string;
  emailVerified: boolean;
  token: Record<string, unknown>;
}

/**
 * Identity always comes from the verified Firebase ID token in `request.auth`,
 * never from the request body.
 */
export function requireAuth(request: CallableRequest): AuthContext {
  const auth = request.auth;
  if (!auth?.uid) {
    throw unauthorized();
  }
  return {
    uid: auth.uid,
    email: auth.token.email,
    emailVerified: auth.token.email_verified === true,
    token: auth.token as Record<string, unknown>,
  };
}

/** Optional stricter check for endpoints that require a verified address. */
export function requireVerifiedEmail(request: CallableRequest): AuthContext {
  const context = requireAuth(request);
  if (!context.emailVerified) {
    throw unauthorized('Please verify your email address before using this endpoint.');
  }
  return context;
}
