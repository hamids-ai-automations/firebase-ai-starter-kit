import { useMemo, useState } from 'react';
import { getFirebase } from './lib/firebase';
import { appVersion } from './lib/config';
import { useAuth } from './hooks/useAuth';
import { AiTextPanel } from './components/AiTextPanel';
import { AuthPanel } from './components/AuthPanel';
import { ChatPanel } from './components/ChatPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { SecurityPanel } from './components/SecurityPanel';
import { SetupPanel } from './components/SetupPanel';
import { StructuredPanel } from './components/StructuredPanel';

const tabs = ['Text', 'Structured', 'Chat', 'Profile', 'Security', 'Setup'] as const;
type Tab = (typeof tabs)[number];

export default function App() {
  const { db, configured } = getFirebase();
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('Text');

  const content = useMemo(() => {
    if (!configured || !db) return <SetupPanel configured={configured} />;
    if (!auth.user) {
      return (
        <AuthPanel
          user={auth.user}
          loading={auth.loading}
          error={auth.error}
          signIn={auth.signIn}
          signUp={auth.signUp}
          signInWithGoogle={auth.signInWithGoogle}
          signOutUser={auth.signOutUser}
        />
      );
    }

    switch (tab) {
      case 'Text':
        return <AiTextPanel />;
      case 'Structured':
        return <StructuredPanel />;
      case 'Chat':
        return <ChatPanel />;
      case 'Profile':
        return <ProfilePanel db={db} uid={auth.user.uid} />;
      case 'Security':
        return <SecurityPanel />;
      case 'Setup':
        return <SetupPanel configured={configured} />;
      default:
        return null;
    }
  }, [auth, configured, db, tab]);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Firebase AI Starter Kit</h1>
            <p className="mt-1 text-sm text-slate-400">
              Auth · Firestore · client-side Gemini REST calls · rules &amp; tests — a working
              reference you can deploy on the free Spark plan.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            v{appVersion}
          </span>
        </div>

        {configured && auth.user ? (
          <nav className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  tab === item
                    ? 'bg-indigo-500 text-white'
                    : 'border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      {content}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <span>
          No Cloud Functions on the Spark plan — Gemini is called from your browser with a key that
          stays in this tab, and Firestore rules enforce access.
        </span>
        <span>{configured ? 'Firebase connected' : 'Firebase not configured'}</span>
      </footer>
    </div>
  );
}
