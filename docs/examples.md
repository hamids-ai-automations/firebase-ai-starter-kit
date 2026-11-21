# Examples

Copy-paste starting points. Every example assumes an authenticated user and an initialised Firebase
app (`apps/web/src/lib/firebase.ts` does this for the demo).

## 1. One-shot generation

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export async function summarize(text: string) {
  const call = httpsCallable<
    { prompt: string; systemInstruction?: string; maxOutputTokens?: number },
    { text: string; model: string; mocked: boolean }
  >(functions, 'aiGenerateText');

  const { data } = await call({
    systemInstruction: 'You are a concise technical editor. Reply in at most five sentences.',
    prompt: `Summarise the following for an engineering changelog:\n\n${text}`,
    maxOutputTokens: 512,
  });

  return data.text;
}
```

## 2. Structured output

```ts
type Brief = {
  title: string;
  summary: string;
  keyPoints: string[];
  tone: string;
  tags: string[];
};

export async function brief(topic: string): Promise<Brief> {
  const call = httpsCallable<{ prompt: string }, { brief: Brief; attempts: number }>(
    functions,
    'aiGenerateStructured',
  );
  const { data } = await call({ prompt: `Draft an article brief about: ${topic}` });
  return data.brief;
}
```

The server supplies a JSON schema to the model, so `keyPoints` is always an array and `tags` is
always a list of strings — no defensive `JSON.parse` in the component.

## 3. Multi-turn chat with persistence

```ts
type ChatReply = { conversationId: string; text: string };

export async function sendTurn(message: string, conversationId?: string): Promise<ChatReply> {
  const call = httpsCallable<{ message: string; conversationId?: string }, ChatReply>(
    functions,
    'aiChat',
  );
  const { data } = await call({ message, conversationId });
  return data;
}
```

- Omit `conversationId` for the first turn; the response returns the new id.
- Pass it back on later turns — history is re-read from Firestore, so the client cannot fabricate
  earlier messages.

## 4. React hook

```tsx
import { useCallback, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export function useGenerateText() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (prompt: string) => {
    setLoading(true);
    setError(null);
    try {
      const call = httpsCallable<{ prompt: string }, { text: string }>(
        getFunctions(),
        'aiGenerateText',
      );
      return (await call({ prompt })).data.text;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading, error };
}
```

## 5. Handling `resource-exhausted`

```ts
import { FirebaseError } from 'firebase/app';

function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof FirebaseError)) return null;
  if (error.code !== 'functions/resource-exhausted') return null;
  const details = error.details as { retryAfterSeconds?: number } | undefined;
  return details?.retryAfterSeconds ?? 60;
}

export async function generateWithBackoff(prompt: string) {
  const attempt = async (triesLeft: number): Promise<string> => {
    try {
      const call = httpsCallable<{ prompt: string }, { text: string }>(functions, 'aiGenerateText');
      return (await call({ prompt })).data.text;
    } catch (error) {
      const wait = retryAfterSeconds(error);
      if (wait === null || triesLeft <= 0) throw error;
      await new Promise((r) => setTimeout(r, Math.min(wait, 30) * 1000));
      return attempt(triesLeft - 1);
    }
  };
  return attempt(2);
}
```

## 6. Usage dashboard data

```ts
export async function loadUsage() {
  const call = httpsCallable<Record<string, never>, { months: UsageMonth[] }>(
    functions,
    'aiUsageSummary',
  );
  return (await call({})).data.months;
}
```

Render `byEndpoint` as a small table to see which feature drives cost.

## 7. Profile preferences

```ts
export async function savePreferences(preferences: {
  theme: 'light' | 'dark' | 'system';
  defaultModel: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  saveHistory: boolean;
}) {
  const call = httpsCallable(functions, 'updateUserProfile');
  return (await call({ preferences })).data;
}
```

## 8. Firestore read (client-safe)

```ts
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

export async function recentConversations(uid: string) {
  const q = query(
    collection(db, `users/${uid}/conversations`),
    orderBy('updatedAt', 'desc'),
    limit(20),
  );
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
}
```

Rules guarantee that `uid` equals the caller's uid; there is no cross-user read path.

## 9. Health probe (uptime monitors)

```bash
curl -s https://us-central1-<project>.cloudfunctions.net/apiHealth
# {"status":"ok","service":"firebase-ai-starter-kit","timestamp":"2026-11-21T..."}
```
