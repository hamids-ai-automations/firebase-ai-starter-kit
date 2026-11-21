import { useState } from 'react';
import type { User } from 'firebase/auth';
import { Badge, Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function AuthPanel({
  user,
  loading,
  error,
  signIn,
  signUp,
  signInWithGoogle,
  signOutUser,
}: {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    return (
      <Card
        title="Signed in"
        description="Every callable below uses the verified ID token attached to these requests."
        footer={
          <span>
            Email verification: <strong>{user.emailVerified ? 'verified' : 'not verified'}</strong>
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <Badge tone="green">authenticated</Badge>
          <span className="font-mono text-xs text-slate-400">{user.uid}</span>
        </div>
        <p className="text-sm text-slate-300">{user.email ?? 'No email on this account'}</p>
        <Button variant="ghost" onClick={() => void signOutUser()} disabled={loading}>
          Sign out
        </Button>
        <ErrorBanner message={error} />
      </Card>
    );
  }

  return (
    <Card
      title="Sign in to the demo"
      description="Email/password or Google. Locally, any email works against the Auth emulator."
      footer={<span>Passwords are never sent to our functions; Firebase Auth handles them.</span>}
    >
      <Field label="Email">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password" hint="Minimum 6 characters.">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void signIn(email, password)}
          disabled={loading || !email || !password}
        >
          Sign in
        </Button>
        <Button
          variant="ghost"
          onClick={() => void signUp(email, password)}
          disabled={loading || !email || !password}
        >
          Create account
        </Button>
        <Button variant="ghost" onClick={() => void signInWithGoogle()} disabled={loading}>
          Continue with Google
        </Button>
      </div>
      <ErrorBanner message={error} />
    </Card>
  );
}
