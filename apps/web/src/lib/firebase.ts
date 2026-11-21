import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { emulatorConfig, firebaseConfig, isConfigured, useEmulators } from './config';

interface FirebaseBundle {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  configured: boolean;
}

let bundle: FirebaseBundle | null = null;

/**
 * Lazily creates the Firebase singletons and wires up emulators once. The app
 * stays renderable even when no config is present, so a fresh clone shows a
 * helpful setup panel instead of a white screen.
 *
 * Spark plan: Firebase Functions is intentionally absent from this bundle — the
 * client talks to Auth, Firestore and the Gemini REST API directly.
 */
export function getFirebase(): FirebaseBundle {
  if (bundle) return bundle;

  if (!isConfigured) {
    bundle = { app: null, auth: null, db: null, configured: false };
    return bundle;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (useEmulators) {
    connectAuthEmulator(auth, `http://${emulatorConfig.authHost}`, { disableWarnings: true });
    const [firestoreHost, firestorePort] = emulatorConfig.firestoreHost.split(':');
    connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  }

  bundle = { app, auth, db, configured: true };
  return bundle;
}

export function resetFirebaseForTests(): void {
  bundle = null;
}
