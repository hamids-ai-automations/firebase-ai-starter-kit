import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { REGION } from '../config';
import { db } from '../lib/admin';
import { createCallableHandler } from '../middleware/handler';
import { profileUpdateSchema, type ProfileUpdateInput } from '../validation/schemas';

const callableOptions = {
  region: REGION,
  maxInstances: 10,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
};

/**
 * Idempotent profile bootstrap. Called by the client right after sign-in, and
 * safe to call repeatedly: existing fields are preserved.
 */
export const ensureUserProfile = onCall(callableOptions, (request) =>
  createCallableHandler<Record<string, never>, { uid: string; created: boolean }>(
    { name: 'ensureUserProfile', schema: undefined, rateLimit: null },
    async ({ userId, auth }) => {
      const ref = db().doc(`users/${userId}`);
      const snapshot = await ref.get();
      if (snapshot.exists) {
        return { uid: userId as string, created: false };
      }

      await ref.set({
        email: auth?.email ?? null,
        displayName: null,
        bio: '',
        role: 'user',
        preferences: { theme: 'system', saveHistory: true },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { uid: userId as string, created: true };
    },
  )(request),
);

/**
 * Server-side profile update. Privileged fields (`role`, `plan`) are never
 * writable here, and the payload is validated before it reaches Firestore.
 */
export const updateUserProfile = onCall(callableOptions, (request) =>
  createCallableHandler<ProfileUpdateInput, { uid: string; updated: string[] }>(
    { name: 'updateUserProfile', schema: profileUpdateSchema },
    async ({ input, userId }) => {
      const ref = db().doc(`users/${userId}`);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        await ref.set({
          email: null,
          displayName: null,
          bio: '',
          role: 'user',
          preferences: {},
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.bio !== undefined) updates.bio = input.bio;
      if (input.preferences !== undefined) updates.preferences = input.preferences;

      await ref.set(updates, { merge: true });

      return { uid: userId as string, updated: Object.keys(updates) };
    },
  )(request),
);
