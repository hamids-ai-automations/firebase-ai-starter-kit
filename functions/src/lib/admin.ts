import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Single, lazily-initialised Admin SDK handle.
 *
 * In Cloud Functions the ambient service account is used automatically.
 * Under the emulator the Admin SDK talks to the local emulators.
 */
export function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0] as App;
  return initializeApp();
}

export function db(): Firestore {
  return getFirestore(adminApp());
}
