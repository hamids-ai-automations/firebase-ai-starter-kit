# API reference

All AI endpoints are **Cloud Functions v2 callables**. They accept a JSON object as `data`, return a
JSON object, and require a Firebase ID token. Region defaults to `us-central1` (override with
`FUNCTIONS_REGION` on the server and `VITE_FUNCTIONS_REGION` on the client).

## Common behaviour

| Concern        | Rule                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| Authentication | Anonymous callers get `unauthenticated`                                                  |
| Validation     | Strict Zod schemas; unknown keys are rejected, lengths are capped                        |
| Rate limit     | Fixed window stored in `users/{uid}/rateLimits/{endpoint}` (AI endpoints: 20 req / 60 s) |
| Logging        | Endpoint name, uid, latency, token count — never prompt text or keys                     |
| Errors         | `AppError` → `HttpsError`; unexpected errors become `internal` with a generic message    |

### Limits

| Limit                         | Value                                          |
| ----------------------------- | ---------------------------------------------- |
| Prompt characters             | 8 000                                          |
| System instruction characters | 4 000                                          |
| History messages accepted     | 40 (20 most recent are re-read from Firestore) |
| Output tokens                 | 1 024 default, 64–4 096 allowed                |
| Temperature                   | 0–2, default 0.7                               |
| Models                        | `gemini-2.5-flash` (default), `gemini-2.5-pro` |

---

## `aiGenerateText`

One-shot completion.

**Request**

```ts
{
  prompt: string;                 // 1..8000 chars
  systemInstruction?: string;     // <= 4000 chars
  model?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature?: number;           // 0..2
  maxOutputTokens?: number;       // 64..4096
}
```

**Response**

```ts
{
  text: string;
  model: string;
  mocked: boolean;
  usage?: { promptTokens?: number; candidatesTokens?: number; totalTokens?: number };
}
```

**Errors** — `unauthenticated`, `invalid-argument`, `resource-exhausted`, `unavailable`, `internal`.

---

## `aiGenerateStructured`

Returns a schema-constrained object. Gemini is given a response schema, and the server validates the
parsed value with Zod before returning it; a single repair attempt is made if the first result does
not validate.

**Request**

```ts
{ prompt: string; model?: 'gemini-2.5-flash' | 'gemini-2.5-pro' }
```

**Response**

```ts
{
  brief: {
    title: string;
    summary: string;
    keyPoints: string[];
    tone: string;
    tags: string[];
  };
  model: string;
  mocked: boolean;
  attempts: number;
}
```

---

## `aiChat`

Multi-turn conversation with server-side persistence.

**Request**

```ts
{
  conversationId?: string;        // 1..128 chars; omit to create a new conversation
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  systemInstruction?: string;
  model?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
}
```

**Response**

```ts
{
  conversationId: string;
  text: string;
  model: string;
  mocked: boolean;
  usage?: object;
  createdAt: string;             // ISO timestamp
}
```

**Behaviour**

1. `ensureConversation` creates `users/{uid}/conversations/{id}` when the id is absent.
2. The last 20 messages are read from Firestore and used as history — the client cannot inject
   history into an existing conversation.
3. The user message and the model reply are both persisted; counters and `lastMessagePreview` are
   updated in the same write batch.
4. Usage is recorded in `users/{uid}/usage/{YYYY-MM}`.

---

## `aiUsageSummary`

**Request** — `{}` (no rate limit applied).

**Response**

```ts
{
  months: Array<{
    id: string; // "2026-11"
    month: string;
    requests: number;
    tokens: number;
    byEndpoint: Record<string, number>;
    mocked: boolean;
    updatedAt: string;
  }>;
}
```

Returns at most six months, newest first.

---

## `deleteConversation`

Deletes a conversation and its messages. Only the owner can delete; a missing document returns
`not-found`.

**Request** — `{ conversationId: string }`
**Response** — `{ conversationId: string; deleted: true }`

---

## `ensureUserProfile`

Creates `users/{uid}` with defaults on first call. Idempotent.

**Request** — `{}`
**Response** — `{ uid: string; created: boolean }`

---

## `updateUserProfile`

**Request**

```ts
{
  displayName?: string;           // 1..80 chars
  bio?: string;                   // <= 280 chars
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    defaultModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    saveHistory?: boolean;
  };
}
```

**Response** — `{ uid: string; updated: string[] }` (field paths that changed)

---

## `secureEcho`

Demonstrates the security envelope without calling a model: auth, validation, rate limiting, and
error mapping.

**Request** — `{ message: string (1..500); priority?: 'low' | 'normal' | 'high' }`
**Response** — `{ ok: true; echo: string; priority: string; uid: string; mocked: true }`

---

## `apiHealth`

Plain HTTPS function (not a callable) for uptime probes.

```
GET /apiHealth  →  200 { status: "ok", service: "firebase-ai-starter-kit", timestamp: ISO }
```

`GET` is the only accepted method; a callable-style `POST` returns `405`.

---

## Error codes

| Code                 | Meaning                  | Client handling                               |
| -------------------- | ------------------------ | --------------------------------------------- |
| `unauthenticated`    | Missing/expired ID token | Re-authenticate                               |
| `invalid-argument`   | Schema violation         | Show field-level message                      |
| `resource-exhausted` | Rate limit               | Read `details.retryAfterSeconds` and back off |
| `not-found`          | Conversation missing     | Refresh the conversation list                 |
| `permission-denied`  | Not the owner            | Do not retry                                  |
| `unavailable`        | Model upstream issue     | Retry with backoff                            |
| `internal`           | Unexpected               | Show a generic error, log the request id      |

## Client usage

```ts
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';

const functions = getFunctions(undefined, 'us-central1');

export async function generateText(prompt: string): Promise<string> {
  const call = httpsCallable<{ prompt: string }, { text: string }>(functions, 'aiGenerateText');
  const res: HttpsCallableResult<{ text: string }> = await call({ prompt });
  return res.data.text;
}
```

The full example set lives in [`examples.md`](examples.md).
