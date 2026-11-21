import { useState } from 'react';
import type { Functions } from 'firebase/functions';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { TextResult } from '../types';
import { Badge, Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function AiTextPanel({ functions }: { functions: Functions }) {
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
      const data = await api.generateText(functions, {
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
      description="Calls the aiGenerateText callable. The model runs server-side, so no API key is exposed to this page."
      footer={
        result ? (
          <span>
            Model: <code>{result.model}</code>
            {result.usage?.totalTokens ? ` · ${result.usage.totalTokens} tokens` : ''}
          </span>
        ) : (
          <span>
            Prompt is validated server-side (length, model allow-list, temperature range).
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
      {result ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200">
          {result.text}
        </pre>
      ) : null}
    </Card>
  );
}
