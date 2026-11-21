/**
 * All client configuration comes from Vite env vars (`VITE_*`).
 *
 * Spark-plan build (no Cloud Functions): the Gemini API key is NOT part of this
 * config. The user pastes their own key at runtime and it lives in
 * `sessionStorage` only — see `lib/geminiKey.ts`.
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
};

/** Model used for every browser-side Gemini REST call. */
export const geminiModel: string =
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? 'gemini-2.5-flash';

export const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const appVersion = import.meta.env.VITE_APP_VERSION ?? '0.1.0';
