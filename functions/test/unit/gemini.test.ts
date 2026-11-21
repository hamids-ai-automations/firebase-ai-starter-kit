import { describe, expect, it, vi } from 'vitest';
import {
  createGeminiClient,
  createMockClient,
  isRetryableError,
  withRetry,
  type GeminiTransport,
} from '../../src/ai/gemini';

function fakeTransport(responses: Array<() => Promise<unknown>> | (() => Promise<unknown>)) {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  const calls: Array<{ model: string; config: Record<string, unknown>; contents: unknown }> = [];
  const transport: GeminiTransport = {
    async generateContent(params) {
      calls.push({ model: params.model, config: params.config, contents: params.contents });
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return (await next!()) as never;
    },
  };
  return { transport, calls };
}

describe('createGeminiClient', () => {
  it('normalises text, usage and finish reason', async () => {
    const { transport } = fakeTransport(async () => ({
      text: 'Hello from Gemini',
      candidates: [{ finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 },
    }));
    const client = createGeminiClient({ apiKey: 'test-key', transport });
    const result = await client.generate({ prompt: 'hi' });

    expect(result.text).toBe('Hello from Gemini');
    expect(result.usage?.totalTokens).toBe(12);
    expect(result.mocked).toBe(false);
    expect(result.finishReason).toBe('STOP');
  });

  it('requests JSON mode when a schema is supplied', async () => {
    const { transport, calls } = fakeTransport(async () => ({ text: '{}' }));
    const client = createGeminiClient({ apiKey: 'test-key', transport });
    await client.generate({ prompt: 'p', responseSchema: { type: 'object' } });

    expect(calls[0]?.config.responseMimeType).toBe('application/json');
    expect(calls[0]?.config.responseSchema).toEqual({ type: 'object' });
  });

  it('maps history into role-tagged turns', async () => {
    const { transport, calls } = fakeTransport(async () => ({ text: 'ok' }));
    const client = createGeminiClient({ apiKey: 'test-key', transport });
    await client.generate({
      prompt: 'third',
      history: [
        { role: 'user', text: 'first' },
        { role: 'model', text: 'second' },
      ],
    });

    const contents = calls[0]?.contents as Array<{ role: string }>;
    expect(contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('falls back to candidate parts when text is missing', async () => {
    const { transport } = fakeTransport(async () => ({
      candidates: [{ content: { parts: [{ text: 'from parts' }] } }],
    }));
    const client = createGeminiClient({ apiKey: 'test-key', transport });
    expect((await client.generate({ prompt: 'x' })).text).toBe('from parts');
  });
});

describe('createMockClient', () => {
  it('returns deterministic text and marks the result as mocked', async () => {
    const client = createMockClient();
    const result = await client.generate({ prompt: 'hello' });
    expect(result.mocked).toBe(true);
    expect(result.text).toContain('mock');
  });

  it('returns schema-shaped JSON for structured requests', async () => {
    const client = createMockClient();
    const result = await client.generate({ prompt: 'hello', responseSchema: { type: 'object' } });
    const parsed = JSON.parse(result.text);
    expect(parsed.title).toBeTruthy();
    expect(Array.isArray(parsed.keyPoints)).toBe(true);
  });
});

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const operation = vi.fn(async () => 'ok');
    await expect(withRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures and eventually succeeds', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('429 rate limit exceeded'))
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn(async () => undefined);

    await expect(withRetry(operation, { retries: 2, sleep })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable errors', async () => {
    const operation = vi.fn(async () => {
      throw new Error('invalid argument');
    });
    const sleep = vi.fn(async () => undefined);

    await expect(withRetry(operation, { retries: 3, sleep })).rejects.toThrow('invalid argument');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('gives up after the configured number of retries', async () => {
    const operation = vi.fn(async () => {
      throw new Error('503 unavailable');
    });
    const sleep = vi.fn(async () => undefined);

    await expect(withRetry(operation, { retries: 2, sleep })).rejects.toThrow('503');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});

describe('isRetryableError', () => {
  it.each([
    ['429 quota', true],
    ['Deadline exceeded', true],
    ['ECONNRESET', true],
    ['invalid argument', false],
    ['permission denied', false],
  ])('%s -> %s', (message, expected) => {
    expect(isRetryableError(new Error(message))).toBe(expected);
  });
});
