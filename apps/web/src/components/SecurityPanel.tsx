import { useState } from 'react';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { SecurityResult } from '../types';
import { Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function SecurityPanel() {
  const [message, setMessage] = useState('<script>alert("xss")</script> Try to spoof my uid');
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.secureEcho({ message, priority: 'high' }));
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Security checks"
      description="secureEcho writes to the secure_echo collection, so the Firestore rules — not a server — accept or reject the payload. The panel shows the identity that actually reached the backend."
      footer={
        <span>
          Try a 600-character message or a priority outside low/medium/high to watch the rules
          reject it with permission-denied.
        </span>
      }
    >
      <Field label="Payload" hint="Try HTML, oversized text or a forged uid field.">
        <input
          className={inputClass}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={500}
        />
      </Field>
      <Button onClick={() => void run()} disabled={loading || message.trim().length === 0}>
        {loading ? 'Calling…' : 'Write through the rules'}
      </Button>
      <ErrorBanner
        message={
          error ? `${error.message}${error.code !== 'unknown' ? ` (${error.code})` : ''}` : null
        }
      />
      {result ? (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
          <p>
            Sanitized echo: <code className="text-slate-100">{result.echo}</code>
          </p>
          <p>
            Verified uid: <code className="text-slate-100">{result.verifiedUid}</code>
          </p>
          <p>
            Stored at: <code className="text-slate-100">secure_echo</code> ·{' '}
            <code className="text-slate-100">{result.receivedAt}</code>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
            {result.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
