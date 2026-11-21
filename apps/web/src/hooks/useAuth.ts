import { useCallback, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebase } from '../lib/firebase';
import { normalizeError } from '../lib/api';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): AuthState {
  const { auth } = getFirebase();
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, [auth]);

  const run = useCallback(async (operation: () => Promise<unknown>) => {
    setError(null);
    setLoading(true);
    try {
      await operation();
    } catch (cause) {
      setError(normalizeError(cause).message || String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      auth ? run(() => signInWithEmailAndPassword(auth, email, password)) : Promise.resolve(),
    [auth, run],
  );

  const signUp = useCallback(
    (email: string, password: string) =>
      auth ? run(() => createUserWithEmailAndPassword(auth, email, password)) : Promise.resolve(),
    [auth, run],
  );

  const signInWithGoogle = useCallback(
    () => (auth ? run(() => signInWithPopup(auth, new GoogleAuthProvider())) : Promise.resolve()),
    [auth, run],
  );

  const signOutUser = useCallback(
    () => (auth ? run(() => signOut(auth)) : Promise.resolve()),
    [auth, run],
  );

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOutUser,
    clearError: () => setError(null),
  };
}
