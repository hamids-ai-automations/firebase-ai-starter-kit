import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { z } from 'zod';
import type {
  ArticleBrief,
  ChatResult,
  ChatTurn,
  SecurityResult,
  StructuredResult,
  TextResult,
  Usage,
  UsageSummary,
} from '../types';
import { geminiModel } from './config';
import { getFirebase } from './firebase';
import { getGeminiKey } from './geminiKey';

export type ErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'not-found'
  | 'gemini-key-missing'
  | 'internal'
  | 'unknown';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Kept for parity with the Cloud Functions build: every endpoint resolved an
 * `Envelope` there. The Spark implementation returns payloads directly, but the
 * shape stays exported so downstream code/type imports do not break.
 */
export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

const MAX_PROMPT = 8000;
const MAX_SYSTEM_INSTRUCTION = 2000;
const MAX_MESSAGE = 8000;
const MAX_ECHO = 500;
const MAX_DISPLAY_NAME = 80;
const MAX_BIO = 280;
const MAX_PREFERENCES_KEYS = 32;
const HISTORY_LIMIT = 20;
const USAGE_READ_LIMIT = 300;
const DELETE_BATCH = 400;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const ECHO_PRIORITIES = ['low', 'medium', 'high'] as const;
type EchoPriority = (typeof ECHO_PRIORITIES)[number];

const MESSAGES: Record<ErrorCode, string> = {
  unauthenticated: 'Please sign in to continue.',
  'permission-denied': 'You do not have permission to do that.',
  'invalid-argument': 'The request was rejected because a field is invalid.',
  'resource-exhausted': 'Too many requests. Wait a moment and try again.',
  'failed-precondition': 'The operation cannot run in the current state.',
  'not-found': 'Not found.',
  'gemini-key-missing':
    'No Gemini API key yet. Open the Setup tab and paste your key (it stays in this tab only).',
  internal: 'Something went wrong on the client. Try again.',
  unknown: 'Something went wrong. Try again.',
};

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const raw = (error ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
  const rawCode = typeof raw.code === 'string' ? raw.code.replace(/^functions\//, '') : '';
  const code = (Object.keys(MESSAGES) as ErrorCode[]).includes(rawCode as ErrorCode)
    ? (rawCode as ErrorCode)
    : 'unknown';

  return new ApiError(
    code,
    MESSAGES[code],
    raw.details ?? (typeof raw.message === 'string' ? raw.message : undefined),
  );
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function requireSession(): { db: Firestore; uid: string } {
  const { db, auth } = getFirebase();
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) throw new ApiError('unauthenticated', MESSAGES.unauthenticated);
  return { db, uid };
}

function requireGeminiKey(): string {
  const key = getGeminiKey();
  if (!key) throw new ApiError('gemini-key-missing', MESSAGES['gemini-key-missing']);
  return key;
}

// ---------------------------------------------------------------------------
// Gemini REST client (browser side, user-supplied key)
// ---------------------------------------------------------------------------

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidateTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: GeminiUsageMetadata;
  error?: { message?: string; status?: string };
}

interface GeminiRequest {
  prompt: string;
  systemInstruction?: string;
  history?: ChatTurn[];
  responseMimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Purely for the usage log; mirrors the old callable names. */
  endpoint: string;
}

interface GeminiResult {
  text: string;
  model: string;
  usage?: Usage;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function geminiHttpError(status: number, detail?: string): ApiError {
  const suffix = detail ? ` (${detail})` : '';
  if (status === 400) return new ApiError('invalid-argument', `Gemini rejected the request.${suffix}`);
  if (status === 401 || status === 403) {
    return new ApiError(
      'permission-denied',
      `Gemini rejected the API key. Check the key in the Setup tab.${suffix}`,
    );
  }
  if (status === 429) {
    return new ApiError(
      'resource-exhausted',
      `Gemini rate limit or quota reached. Wait a moment and retry.${suffix}`,
    );
  }
  if (status === 404) {
    return new ApiError('not-found', `Model ${geminiModel} is not available for this key.${suffix}`);
  }
  return new ApiError('internal', `Gemini call failed (HTTP ${status}).${suffix}`);
}

/** Best effort: a failed usage write must never break the AI response. */
async function logUsage(endpoint: string, model: string, usage?: Usage): Promise<void> {
  const { db, auth } = getFirebase();
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return;
  try {
    await addDoc(collection(db, 'users', uid, 'usage_events'), {
      endpoint,
      model,
      promptTokens: usage?.promptTokens ?? 0,
      candidateTokens: usage?.candidateTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Ignored on purpose — the AI answer is more important than the counter.
  }
}

async function callGemini(request: GeminiRequest): Promise<GeminiResult> {
  const apiKey = requireGeminiKey();
  const model = geminiModel;
  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;

  const contents = [
    ...(request.history ?? []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: 'user', parts: [{ text: request.prompt }] },
  ];

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.4,
      maxOutputTokens: request.maxOutputTokens ?? 2048,
      ...(request.responseMimeType ? { responseMimeType: request.responseMimeType } : {}),
    },
  };
  if (request.systemInstruction) {
    body.systemInstruction = { parts: [{ text: request.systemInstruction }] };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Header instead of a query string keeps the key out of URL logs.
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('internal', 'Could not reach the Gemini API. Check your network connection.');
  }

  const payload = (await readJson(response)) as GeminiResponse | null;
  if (!response.ok) throw geminiHttpError(response.status, payload?.error?.message);

  const text = (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new ApiError('internal', 'Gemini returned an empty response. Try a shorter prompt.');
  }

  const usage: Usage | undefined = payload?.usageMetadata
    ? {
        promptTokens: payload.usageMetadata.promptTokenCount,
        candidateTokens: payload.usageMetadata.candidateTokenCount,
        totalTokens: payload.usageMetadata.totalTokenCount,
      }
    : undefined;

  await logUsage(request.endpoint, model, usage);

  return { text, model, usage };
}

// ---------------------------------------------------------------------------
// Structured-output validation (client side, Zod)
// ---------------------------------------------------------------------------

const articleBriefSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(800),
  keyPoints: z.array(z.string().min(1).max(400)).min(1).max(8),
  tone: z.enum(['neutral', 'persuasive', 'technical', 'friendly']),
  tags: z.array(z.string().min(1).max(40)).min(1).max(10),
});

function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return '';
  return candidate.slice(start, end + 1);
}

/**
 * Parses the model's raw text into a validated brief. Exported so the unit tests
 * can cover the JSON extraction + schema checks without any network call.
 */
export function parseStructuredPayload(raw: string): ArticleBrief {
  const json = extractJson(raw);
  if (!json) {
    throw new ApiError('invalid-argument', 'The model did not return a JSON object.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ApiError('invalid-argument', 'The model returned malformed JSON.');
  }

  const result = articleBriefSchema.safeParse(parsed);
  if (!result.success) {
    throw new ApiError(
      'invalid-argument',
      'The model returned JSON that does not match the brief schema.',
      result.error.issues,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim();
}

function toIsoString(value: unknown): string {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function monthId(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function loadHistory(
  db: Firestore,
  uid: string,
  conversationId: string,
): Promise<ChatTurn[]> {
  const messagesRef = collection(db, 'users', uid, 'conversations', conversationId, 'messages');
  const snapshot = await getDocs(
    query(messagesRef, orderBy('createdAt', 'desc'), limit(HISTORY_LIMIT)),
  );
  return snapshot.docs
    .map((document) => document.data() as { role?: unknown; text?: unknown })
    .filter(
      (data): data is { role: 'user' | 'model'; text: string } =>
        (data.role === 'user' || data.role === 'model') &&
        typeof data.text === 'string' &&
        data.text.length > 0,
    )
    .map((data) => ({ role: data.role, text: data.text }))
    .reverse();
}

// ---------------------------------------------------------------------------
// Endpoints (same names as the callable build, now client-side)
// ---------------------------------------------------------------------------

async function generateText(payload: {
  prompt: string;
  systemInstruction?: string;
}): Promise<TextResult> {
  try {
    const prompt = (payload.prompt ?? '').trim();
    if (!prompt) throw new ApiError('invalid-argument', 'Prompt cannot be empty.');
    if (prompt.length > MAX_PROMPT) {
      throw new ApiError('invalid-argument', `Prompt must be at most ${MAX_PROMPT} characters.`);
    }

    const systemInstruction = (payload.systemInstruction ?? '').trim();
    if (systemInstruction.length > MAX_SYSTEM_INSTRUCTION) {
      throw new ApiError(
        'invalid-argument',
        `System instruction must be at most ${MAX_SYSTEM_INSTRUCTION} characters.`,
      );
    }

    const result = await callGemini({
      prompt,
      systemInstruction: systemInstruction || undefined,
      endpoint: 'aiGenerateText',
    });

    return { text: result.text, model: result.model, mocked: false, usage: result.usage };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function generateStructured(payload: { prompt: string }): Promise<StructuredResult> {
  try {
    const prompt = (payload.prompt ?? '').trim();
    if (!prompt) throw new ApiError('invalid-argument', 'Prompt cannot be empty.');
    if (prompt.length > MAX_PROMPT) {
      throw new ApiError('invalid-argument', `Prompt must be at most ${MAX_PROMPT} characters.`);
    }

    let attempts = 0;
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      attempts = attempt;
      const repairNote =
        attempt === 1
          ? ''
          : '\n\nYour previous answer was not valid JSON for the requested shape. Return ONLY the JSON object.';

      const result = await callGemini({
        prompt: `${prompt}${repairNote}`,
        responseMimeType: 'application/json',
        temperature: 0.2,
        endpoint: 'aiGenerateStructured',
      });

      try {
        const brief = parseStructuredPayload(result.text);
        return { brief, model: result.model, mocked: false, attempts };
      } catch (cause) {
        lastError = cause;
      }
    }

    throw lastError instanceof ApiError
      ? lastError
      : new ApiError('internal', 'The model did not return valid JSON after two attempts.');
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function chat(payload: {
  message: string;
  conversationId?: string;
  history?: ChatTurn[];
}): Promise<ChatResult> {
  try {
    const { db, uid } = requireSession();

    const message = (payload.message ?? '').trim();
    if (!message) throw new ApiError('invalid-argument', 'Message cannot be empty.');
    if (message.length > MAX_MESSAGE) {
      throw new ApiError('invalid-argument', `Message must be at most ${MAX_MESSAGE} characters.`);
    }

    // Fail before writing anything so a missing key never leaves a dangling turn.
    requireGeminiKey();

    const model = geminiModel;
    const requestedId = (payload.conversationId ?? '').trim();
    const conversationsPath: [string, string, string] = ['users', uid, 'conversations'];

    let conversationId: string;
    let history: ChatTurn[];

    if (!requestedId) {
      const created = doc(collection(db, ...conversationsPath));
      await setDoc(created, {
        title: message.slice(0, 120),
        model,
        messageCount: 0,
        lastMessagePreview: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      conversationId = created.id;
      history = payload.history ?? [];
    } else {
      conversationId = requestedId;
      // Firestore is the source of truth for follow-up turns.
      history = await loadHistory(db, uid, requestedId);
    }

    const messagesRef = collection(db, ...conversationsPath, conversationId, 'messages');

    await addDoc(messagesRef, {
      role: 'user',
      text: message,
      createdAt: serverTimestamp(),
    });

    const result = await callGemini({ prompt: message, history, endpoint: 'aiChat' });

    await addDoc(messagesRef, {
      role: 'model',
      text: result.text,
      model: result.model,
      tokens: result.usage?.totalTokens ?? 0,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, ...conversationsPath, conversationId), {
      messageCount: increment(2),
      lastMessagePreview: result.text.slice(0, 140),
      updatedAt: serverTimestamp(),
    });

    return {
      conversationId,
      text: result.text,
      model: result.model,
      mocked: false,
      usage: result.usage,
      createdAt: new Date().toISOString(),
    };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function deleteConversation(conversationId: string): Promise<{ deleted: number }> {
  try {
    const { db, uid } = requireSession();
    const id = (conversationId ?? '').trim();
    if (!id) throw new ApiError('invalid-argument', 'conversationId is required.');

    const messagesRef = collection(db, 'users', uid, 'conversations', id, 'messages');
    let deleted = 0;

    // Batches cap at 500 writes; loop until the subcollection is empty.
    for (;;) {
      const snapshot = await getDocs(query(messagesRef, limit(DELETE_BATCH)));
      if (snapshot.empty) break;
      const batch = writeBatch(db);
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deleted += snapshot.size;
      if (snapshot.size < DELETE_BATCH) break;
    }

    await deleteDoc(doc(db, 'users', uid, 'conversations', id));
    return { deleted };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function ensureProfile(): Promise<{ uid: string; created: boolean }> {
  try {
    const { db, uid } = requireSession();
    const profileRef = doc(db, 'users', uid);
    const snapshot = await getDoc(profileRef);
    if (snapshot.exists()) return { uid, created: false };

    const user = getFirebase().auth?.currentUser;
    await setDoc(profileRef, {
      email: user?.email ?? '',
      displayName: (user?.displayName ?? '').slice(0, MAX_DISPLAY_NAME),
      bio: '',
      role: 'user',
      preferences: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { uid, created: true };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function updateProfile(payload: {
  displayName?: string;
  bio?: string;
  preferences?: Record<string, unknown>;
}): Promise<{ uid: string; updated: string[] }> {
  try {
    const { db, uid } = requireSession();
    const profileRef = doc(db, 'users', uid);

    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const updated: string[] = [];

    if (payload.displayName !== undefined) {
      const displayName = payload.displayName.trim();
      if (displayName.length > MAX_DISPLAY_NAME) {
        throw new ApiError(
          'invalid-argument',
          `Display name must be at most ${MAX_DISPLAY_NAME} characters.`,
        );
      }
      updates.displayName = displayName;
      updated.push('displayName');
    }

    if (payload.bio !== undefined) {
      const bio = payload.bio.trim();
      if (bio.length > MAX_BIO) {
        throw new ApiError('invalid-argument', `Bio must be at most ${MAX_BIO} characters.`);
      }
      updates.bio = bio;
      updated.push('bio');
    }

    if (payload.preferences !== undefined) {
      const entries = Object.entries(payload.preferences);
      if (entries.length > MAX_PREFERENCES_KEYS) {
        throw new ApiError(
          'invalid-argument',
          `Preferences must have at most ${MAX_PREFERENCES_KEYS} keys.`,
        );
      }
      updates.preferences = payload.preferences;
      updated.push('preferences');
    }

    if (updated.length === 0) {
      throw new ApiError('invalid-argument', 'Nothing to update: send displayName, bio or preferences.');
    }

    // The update rule diffs against an existing document, so make sure it exists.
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) await ensureProfile();

    await updateDoc(profileRef, updates);
    return { uid, updated };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function secureEcho(payload: {
  message: string;
  priority?: string;
}): Promise<SecurityResult> {
  try {
    const { db, uid } = requireSession();

    const message = (payload.message ?? '').trim();
    const priority = (payload.priority ?? 'medium') as EchoPriority;

    if (!message) throw new ApiError('invalid-argument', 'Message cannot be empty.');
    if (message.length > MAX_ECHO) {
      throw new ApiError('invalid-argument', `Message must be at most ${MAX_ECHO} characters.`);
    }
    if (!ECHO_PRIORITIES.includes(priority)) {
      throw new ApiError(
        'invalid-argument',
        `priority must be one of ${ECHO_PRIORITIES.join(', ')}.`,
      );
    }

    // Client-side sanitising is the first line; the rules are the second.
    const echo = sanitizeText(message);

    // `secure_echo` is a top-level collection on purpose: the rules — not a
    // server — prove ownership and validate the payload shape.
    const created = await addDoc(collection(db, 'secure_echo'), {
      message: echo,
      priority,
      uid,
      createdAt: serverTimestamp(),
    });

    const snapshot = await getDoc(created);
    const stored = snapshot.exists() ? (snapshot.data() as { createdAt?: unknown }) : {};

    return {
      echo,
      priority,
      verifiedUid: uid,
      receivedAt: toIsoString(stored.createdAt),
      checks: [
        'Signed in: request.auth.uid is the only source of identity.',
        `message is a string with 1-${MAX_ECHO} characters (rules + client check).`,
        `priority must be one of ${ECHO_PRIORITIES.join(', ')} (rules enum).`,
        'uid field must equal request.auth.uid, so a forged uid is rejected.',
        'HTML tags were stripped before the write.',
      ],
    };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

async function usageSummary(): Promise<UsageSummary> {
  try {
    const { db, uid } = requireSession();
    const eventsRef = collection(db, 'users', uid, 'usage_events');

    // Firestore count() aggregation replaces the server-side counters.
    const total = await getCountFromServer(eventsRef);

    const snapshot = await getDocs(
      query(eventsRef, orderBy('createdAt', 'desc'), limit(USAGE_READ_LIMIT)),
    );

    const buckets = new Map<string, { requests: number; tokens: number; byEndpoint: Record<string, number> }>();

    snapshot.forEach((document) => {
      const data = document.data() as {
        endpoint?: unknown;
        totalTokens?: unknown;
        createdAt?: { toDate?: () => Date };
      };
      const createdAt = data.createdAt?.toDate?.();
      if (!createdAt) return;

      const id = monthId(createdAt);
      const bucket = buckets.get(id) ?? { requests: 0, tokens: 0, byEndpoint: {} };
      bucket.requests += 1;
      bucket.tokens += typeof data.totalTokens === 'number' ? data.totalTokens : 0;
      if (typeof data.endpoint === 'string') {
        bucket.byEndpoint[data.endpoint] = (bucket.byEndpoint[data.endpoint] ?? 0) + 1;
      }
      buckets.set(id, bucket);
    });

    const months = [...buckets.entries()]
      .sort((left, right) => (left[0] < right[0] ? 1 : -1))
      .map(([id, bucket]) => ({
        id,
        month: id,
        requests: bucket.requests,
        tokens: bucket.tokens,
        byEndpoint: bucket.byEndpoint,
      }));

    return { months, totalEvents: total.data().count };
  } catch (cause) {
    throw normalizeError(cause);
  }
}

export const api = {
  generateText,
  generateStructured,
  chat,
  deleteConversation,
  ensureProfile,
  updateProfile,
  secureEcho,
  usageSummary,
};
