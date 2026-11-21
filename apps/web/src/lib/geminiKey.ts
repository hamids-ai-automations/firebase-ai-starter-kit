/**
 * The Gemini API key is supplied by the user at runtime and kept in
 * `sessionStorage` only.
 *
 * Rules this module enforces:
 * - never bundled at build time (no `VITE_*` env var carries it);
 * - never written to `localStorage`;
 * - never written to the repo or to Firestore;
 * - gone when the browser tab is closed.
 */

const STORAGE_KEY = 'firebase-ai-starter-kit.gemini-key';

/** Used when `sessionStorage` is unavailable (tests, hardened browsers). */
let memoryFallback = '';

function sessionStore(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    // Safari private mode and some hardened profiles throw on access.
    return null;
  }
}

export function getGeminiKey(): string {
  const store = sessionStore();
  if (store) {
    try {
      return (store.getItem(STORAGE_KEY) ?? '').trim();
    } catch {
      return memoryFallback.trim();
    }
  }
  return memoryFallback.trim();
}

/** Stores the key (trimmed). Passing an empty string clears it. */
export function setGeminiKey(key: string): string {
  const trimmed = key.trim();
  const store = sessionStore();
  if (store) {
    try {
      if (trimmed) store.setItem(STORAGE_KEY, trimmed);
      else store.removeItem(STORAGE_KEY);
    } catch {
      // Fall through to the in-memory copy below.
    }
  }
  memoryFallback = trimmed;
  return trimmed;
}

export function clearGeminiKey(): void {
  setGeminiKey('');
}

export function hasGeminiKey(): boolean {
  return getGeminiKey().length > 0;
}

/** `AIzaSy…XOs` style hint for the UI; never logs the full key. */
export function maskGeminiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 10) return '****';
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
