import { useState } from 'react';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { StructuredResult } from '../types';
import { Badge, Button, Card, ErrorBanner, Field, inputClass } from './ui';

const placeholder =
  'Write a short editorial brief about migrating an existing REST + MongoDB app to Firebase Auth, Firestore and client-side Gemini calls.';

export function StructuredPanel() {
  const [prompt, setPrompt] = useState(placeholder);
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.generateStructured({ prompt }));
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Structured output"
      description="Gemini is asked for application/json, then the payload is re-validated with Zod in the browser before it is rendered."
      footer={
        result ? (
          <span>
            Model calls: {result.attempts} (a second call means the first answer failed validation
            and was repaired)
          </span>
        ) : (
          <span>Invalid model output is never passed through to the UI.</span>
        )
      }
    >
      <Field label="Prompt">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={8000}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={() => void run()} disabled={loading || prompt.trim().length === 0}>
          {loading ? 'Generating…' : 'Generate brief'}
        </Button>
        {result?.mocked ? <Badge tone="amber">mock mode</Badge> : null}
      </div>
      <ErrorBanner
        message={
          error ? `${error.message}${error.code !== 'unknown' ? ` (${error.code})` : ''}` : null
        }
      />
      {error?.code === 'gemini-key-missing' ? (
        <p className="text-sm text-amber-300">
          Open the <strong>Setup</strong> tab and paste your Gemini API key — it is kept in this
          tab&apos;s sessionStorage only.
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div>
            <h3 className="text-sm font-semibold text-white">{result.brief.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{result.brief.summary}</p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {result.brief.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Badge>{result.brief.tone}</Badge>
            {result.brief.tags.map((tag) => (
              <Badge key={tag} tone="slate">
                #{tag}
              </Badge>
            ))}
          </div>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">Raw JSON</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result.brief, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </Card>
  );
}
