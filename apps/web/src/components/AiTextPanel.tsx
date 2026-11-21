import { useState } from 'react';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { TextResult } from '../types';
import { Badge, Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function AiTextPanel() {
  const [prompt, setPrompt] = useState(
    'Explain Firestore security rules to a junior developer in 3 sentences.',
  );
  const [systemInstruction, setSystemInstruction] = useState(
    'You are a precise, practical engineering mentor.',
  );
  const [result, setResult] = useState<TextResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.generateText({
        prompt,
        systemInstruction: systemInstruction.trim() || undefined,
      });
      setResult(data);
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Text generation"
      description="Calls the Gemini REST API straight from this tab with the key you saved in Setup. No Cloud Functions are involved."
      footer={
        result ? (
          <span>
            Model: <code>{result.model}</code>
            {result.usage?.totalTokens ? ` · ${result.usage.totalTokens} tokens` : ''}
          </span>
        ) : (
          <span>
            Prompt length is validated on the client (max 8000 chars) and the key never leaves this
            tab.
          </span>
        )
      }
    >
      <Field label="Prompt">
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={8000}
        />
      </Field>
      <Field label="System instruction" hint="Optional. Shapes tone and constraints.">
        <input
          className={inputClass}
          value={systemInstruction}
          onChange={(event) => setSystemInstruction(event.target.value)}
          maxLength={2000}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={() => void run()} disabled={loading || prompt.trim().length === 0}>
          {loading ? 'Generating…' : 'Generate'}
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
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200">
          {result.text}
        </pre>
      ) : null}
    </Card>
  );
}
