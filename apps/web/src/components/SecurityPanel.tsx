import { useState } from 'react';
import type { Functions } from 'firebase/functions';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { SecurityResult } from '../types';
import { Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function SecurityPanel({ functions }: { functions: Functions }) {
  const [message, setMessage] = useState('<script>alert("xss")</script> Try to spoof my uid');
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.secureEcho(functions, { message, priority: 'high' }));
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Security checks"
      description="secureEcho returns the identity the server actually verified, plus the sanitized payload it accepted."
      footer={<span>Rate limited to 30 calls/minute per user.</span>}
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
        {loading ? 'Calling…' : 'Call protected endpoint'}
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
