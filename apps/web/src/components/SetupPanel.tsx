import { useState } from 'react';
import { clearGeminiKey, getGeminiKey, maskGeminiKey, setGeminiKey } from '../lib/geminiKey';
import { Badge, Button, Card, Field, inputClass } from './ui';

export function SetupPanel({ configured }: { configured: boolean }) {
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(() => getGeminiKey());
  const [status, setStatus] = useState<string | null>(null);

  const save = () => {
    const stored = setGeminiKey(draft);
    setSaved(stored);
    setDraft('');
    setStatus(stored ? 'Key saved for this browser tab.' : 'Key cleared.');
  };

  const remove = () => {
    clearGeminiKey();
    setSaved('');
    setDraft('');
    setStatus('Key cleared.');
  };

  return (
    <div className="space-y-4">
      {!configured ? (
        <Card
          title="Connect a Firebase project"
          description="Create a web app in the Firebase console, then copy the config into your env file."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Copy <code className="text-slate-200">.env.example</code> to{' '}
              <code className="text-slate-200">.env.local</code> inside{' '}
              <code className="text-slate-200">apps/web</code> and fill in the six{' '}
              <code className="text-slate-200">VITE_FIREBASE_*</code> values.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
              cp apps/web/.env.example apps/web/.env.local
            </pre>
            <p>Production builds read the same keys from apps/web/.env.production.</p>
            <p>Enable Email/Password and Google sign-in, then create the Firestore database.</p>
            <p>
              Deploy the rules from{' '}
              <code className="text-slate-200">firestore/firestore.rules</code> — on the Spark plan
              they are the only backend authorisation layer.
            </p>
          </div>
        </Card>
      ) : null}

      <Card
        title="Gemini API key"
        description="This build runs on the Spark plan, so there are no Cloud Functions: the browser calls the Gemini REST API directly with a key you paste here."
        footer={
          <span>
            Kept in sessionStorage for this tab only — never in localStorage, the repo, Firestore or
            the build output. Closing the tab forgets it.
          </span>
        }
      >
        <Field
          label="API key"
          hint="Create one at aistudio.google.com/apikey. It is only sent to generativelanguage.googleapis.com."
        >
          <input
            className={inputClass}
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="AIza..."
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={!draft.trim()}>
            Save key
          </Button>
          <Button type="button" variant="ghost" onClick={remove} disabled={!saved}>
            Clear key
          </Button>
          {saved ? (
            <Badge tone="green">key set · {maskGeminiKey(saved)}</Badge>
          ) : (
            <Badge tone="amber">no key yet</Badge>
          )}
        </div>
        {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      </Card>

      <Card
        title="What is checked, and where"
        description="Same guarantees as the Cloud Functions build, enforced by Firestore rules and the client instead of a server."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>
            Firestore rules decide who may read or write a document; there is no trusted server.
          </li>
          <li>
            secureEcho writes to the secure_echo collection and lets the rules reject bad payloads.
          </li>
          <li>
            Structured output is re-validated with Zod in the browser before it reaches the UI.
          </li>
          <li>Your Gemini key stays in this tab and is never written to a database.</li>
          <li>Usage counters are appended per AI call and read back with Firestore count().</li>
        </ul>
      </Card>
    </div>
  );
}
