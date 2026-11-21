/**
 * All client configuration comes from Vite env vars (`VITE_*`). Nothing secret
 * may live here: the Gemini API key is only ever present on the server.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

export const emulatorConfig = {
  authHost: import.meta.env.VITE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
  firestoreHost: import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
  functionsHost: import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001',
  functionsRegion: import.meta.env.VITE_FUNCTIONS_REGION ?? 'us-central1',
};

export const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const appVersion = import.meta.env.VITE_APP_VERSION ?? '0.1.0';
