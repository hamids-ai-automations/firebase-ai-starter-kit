import { describe, expect, it, vi } from 'vitest';
import type { AiClient } from '../../src/ai/gemini';
import {
  extractJson,
  generateStructuredOutput,
  generateText,
  sendChatMessage,
} from '../../src/ai/service';
import { articleBriefJsonSchema, articleBriefSchema } from '../../src/validation/schemas';
import { AppError } from '../../src/utils/errors';

const validBrief = {
  title: 'Server-side Gemini with Firebase',
  summary: 'How to keep the Gemini API key out of the browser using callable functions.',
  keyPoints: ['Verify ID tokens', 'Validate payloads', 'Rate limit per user'],
  tone: 'technical',
  tags: ['gemini', 'firebase'],
};

function stubClient(responses: string[]): AiClient {
  let index = 0;
  return {
    async generate() {
      const text = responses[Math.min(index, responses.length - 1)] ?? '';
      index += 1;
      return { text, model: 'gemini-2.5-flash', mocked: false };
    },
  };
}

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores surrounding prose', () => {
    expect(extractJson('Here you go: {"a":1} enjoy')).toEqual({ a: 1 });
  });

  it('throws when no object exists', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('generateText', () => {
  it('trims model output', async () => {
    const result = await generateText(stubClient(['  hello  ']), { prompt: 'hi' });
    expect(result.text).toBe('hello');
  });

  it('rejects empty model output', async () => {
    await expect(generateText(stubClient(['   ']), { prompt: 'hi' })).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe('generateStructuredOutput', () => {
  const params = {
    prompt: 'Write a brief',
    schema: articleBriefSchema,
    jsonSchema: articleBriefJsonSchema as unknown as Record<string, unknown>,
  };

  it('returns validated data on the first attempt', async () => {
    const result = await generateStructuredOutput(stubClient([JSON.stringify(validBrief)]), params);
    expect(result.attempts).toBe(1);
    expect(result.data.title).toContain('Server-side');
  });

  it('repairs invalid JSON once', async () => {
    const client = stubClient(['not json at all', JSON.stringify(validBrief)]);
    const spy = vi.spyOn(client, 'generate');
    const result = await generateStructuredOutput(client, params);

    expect(result.attempts).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throws when the repaired answer is still invalid', async () => {
    const client = stubClient(['nope', '{"title":"x"}']);
    await expect(generateStructuredOutput(client, params)).rejects.toBeInstanceOf(AppError);
  });
});

describe('sendChatMessage', () => {
  it('forwards history and message', async () => {
    const client = stubClient(['answer']);
    const spy = vi.spyOn(client, 'generate');
    await sendChatMessage(client, {
      history: [{ role: 'user', text: 'hi' }],
      message: 'follow up',
    });

    const request = spy.mock.calls[0]?.[0];
    expect(request?.prompt).toBe('follow up');
    expect(request?.history).toHaveLength(1);
    expect(request?.systemInstruction).toBeTruthy();
  });
});
