import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, normalizeError, parseStructuredPayload } from './api';
import { clearGeminiKey, setGeminiKey } from './geminiKey';

afterEach(() => {
  clearGeminiKey();
  vi.unstubAllGlobals();
});

describe('normalizeError', () => {
  it('passes an ApiError through unchanged', () => {
    const original = new ApiError('permission-denied', 'nope');
    expect(normalizeError(original)).toBe(original);
  });

  it('strips the legacy functions/ prefix before mapping the code', () => {
    const error = normalizeError({ code: 'functions/unauthenticated', message: 'raw' });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('unauthenticated');
  });

  it('maps resource-exhausted to a retry message', () => {
    const error = normalizeError({ code: 'functions/resource-exhausted' });
    expect(error.code).toBe('resource-exhausted');
    expect(error.message).toMatch(/wait a moment/i);
  });

  it('explains a missing Gemini key', () => {
    const error = normalizeError({ code: 'gemini-key-missing' });
    expect(error.code).toBe('gemini-key-missing');
    expect(error.message).toMatch(/Setup tab/);
  });

  it('downgrades an unknown code to unknown', () => {
    expect(normalizeError({ code: 'functions/wat' }).code).toBe('unknown');
  });

  it('handles null without throwing', () => {
    const error = normalizeError(null);
    expect(error.code).toBe('unknown');
    expect(error.message).toBeTruthy();
  });
});

describe('parseStructuredPayload', () => {
  const brief = {
    title: 'Migrate to Firebase',
    summary: 'A short editorial brief.',
    keyPoints: ['Auth first', 'Then Firestore'],
    tone: 'technical' as const,
    tags: ['firebase', 'migration'],
  };

  it('accepts a valid payload wrapped in a json code fence', () => {
    expect(parseStructuredPayload(`\`\`\`json\n${JSON.stringify(brief)}\n\`\`\``)).toEqual(brief);
  });

  it('accepts a payload that shapes the object with surrounding prose', () => {
    expect(parseStructuredPayload(`Sure: ${JSON.stringify(brief)} — done`)).toEqual(brief);
  });

  it('rejects JSON that misses required fields with invalid-argument', () => {
    let caught: unknown;
    try {
      parseStructuredPayload('{"title":"only a title"}');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('invalid-argument');
  });

  it('rejects text that contains no JSON object', () => {
    expect(() => parseStructuredPayload('no json here')).toThrowError(/JSON/);
  });
});

describe('generateText input validation', () => {
  it('rejects an empty prompt before touching the network', async () => {
    await expect(api.generateText({ prompt: '   ' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects a system instruction that is too long', async () => {
    await expect(
      api.generateText({ prompt: 'hi', systemInstruction: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('generateText without a Gemini key', () => {
  it('fails fast with gemini-key-missing', async () => {
    await expect(api.generateText({ prompt: 'hello' })).rejects.toMatchObject({
      code: 'gemini-key-missing',
    });
  });
});

describe('generateText with a Gemini key', () => {
  it('calls the Gemini REST endpoint and returns text plus usage', async () => {
    setGeminiKey('test-key');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hello there' }] } }],
          usageMetadata: { promptTokenCount: 3, candidateTokenCount: 2, totalTokenCount: 5 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.generateText({ prompt: '  hi  ', systemInstruction: ' be brief ' });

    expect(result.text).toBe('hello there');
    expect(result.model).toBeTruthy();
    expect(result.mocked).toBe(false);
    expect(result.usage).toEqual({ promptTokens: 3, candidateTokens: 2, totalTokens: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain(':generateContent');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });

    const body = JSON.parse(String(init.body));
    expect(body.contents.at(-1).parts[0].text).toBe('hi');
    expect(body.systemInstruction.parts[0].text).toBe('be brief');
  });

  it('maps an HTTP 429 to resource-exhausted', async () => {
    setGeminiKey('test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 }),
      ),
    );

    await expect(api.generateText({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('maps a rejected key (HTTP 403) to permission-denied', async () => {
    setGeminiKey('test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 403 }),
      ),
    );

    await expect(api.generateText({ prompt: 'hi' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('reports an empty candidate as an internal error', async () => {
    setGeminiKey('test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 })),
    );

    await expect(api.generateText({ prompt: 'hi' })).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('Firestore-backed endpoints', () => {
  it('chat refuses to run without a signed-in user', async () => {
    await expect(api.chat({ message: 'hi' })).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('usageSummary refuses to run without a signed-in user', async () => {
    await expect(api.usageSummary()).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('secureEcho refuses to run without a signed-in user', async () => {
    await expect(api.secureEcho({ message: 'hi' })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});
