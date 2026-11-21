import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { emulatorConfig, firebaseConfig, isConfigured, useEmulators } from './config';

interface FirebaseBundle {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  functions: Functions | null;
  configured: boolean;
}

let bundle: FirebaseBundle | null = null;

/**
 * Lazily creates the Firebase singletons and wires up emulators once. The app
 * stays renderable even when no config is present, so a fresh clone shows a
 * helpful setup panel instead of a white screen.
 */
export function getFirebase(): FirebaseBundle {
  if (bundle) return bundle;

  if (!isConfigured) {
    bundle = { app: null, auth: null, db: null, functions: null, configured: false };
    return bundle;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, emulatorConfig.functionsRegion);

  if (useEmulators) {
    connectAuthEmulator(auth, `http://${emulatorConfig.authHost}`, { disableWarnings: true });
    const [firestoreHost, firestorePort] = emulatorConfig.firestoreHost.split(':');
    connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
    const [functionsHost, functionsPort] = emulatorConfig.functionsHost.split(':');
    connectFunctionsEmulator(functions, functionsHost, Number(functionsPort));
  }

  bundle = { app, auth, db, functions, configured: true };
  return bundle;
}

export function resetFirebaseForTests(): void {
  bundle = null;
}
