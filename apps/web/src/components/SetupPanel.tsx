import { Card } from './ui';

export function SetupPanel() {
  return (
    <Card
      title="Connect a Firebase project"
      description="The UI is running, but no Firebase web config was found. Copy .env.example to .env.local and fill in your project values."
    >
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
        <li>
          Create a project in the Firebase console and register a Web App (Project settings → Your
          apps).
        </li>
        <li>
          Copy the config values into{' '}
          <code className="rounded bg-slate-800 px-1">apps/web/.env.local</code> using the keys from{' '}
          <code className="rounded bg-slate-800 px-1">apps/web/.env.example</code>.
        </li>
        <li>
          For local development set{' '}
          <code className="rounded bg-slate-800 px-1">VITE_USE_EMULATORS=true</code> and run{' '}
          <code className="rounded bg-slate-800 px-1">npm run emulators</code> at the repo root.
        </li>
        <li>Restart the dev server — this panel disappears once config is present.</li>
      </ol>
      <p className="text-xs text-slate-500">
        The Gemini API key is never part of the web config. It lives in Cloud Functions only (Secret
        Manager).
      </p>
    </Card>
  );
}
