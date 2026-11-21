import { describe, expect, it } from 'vitest';
import {
  articleBriefSchema,
  chatInputSchema,
  generateTextInputSchema,
  profileUpdateSchema,
  secureEchoInputSchema,
} from '../../src/validation/schemas';
import { parseOrThrow } from '../../src/validation/parse';
import { AppError } from '../../src/utils/errors';

describe('generateTextInputSchema', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = generateTextInputSchema.parse({ prompt: 'Explain Firestore rules' });
    expect(parsed.prompt).toBe('Explain Firestore rules');
  });

  it('rejects empty prompts', () => {
    expect(() => generateTextInputSchema.parse({ prompt: '' })).toThrow();
  });

  it('rejects oversized prompts', () => {
    expect(() => generateTextInputSchema.parse({ prompt: 'x'.repeat(9000) })).toThrow();
  });

  it('rejects unknown fields (mass assignment protection)', () => {
    expect(() => generateTextInputSchema.parse({ prompt: 'hello', isAdmin: true })).toThrow();
  });

  it('rejects unsupported models', () => {
    expect(() => generateTextInputSchema.parse({ prompt: 'hello', model: 'gpt-4o' })).toThrow();
  });

  it('rejects out-of-range temperature', () => {
    expect(() => generateTextInputSchema.parse({ prompt: 'hi', temperature: 5 })).toThrow();
  });
});

describe('chatInputSchema', () => {
  it('accepts history turns', () => {
    const parsed = chatInputSchema.parse({
      message: 'Summarise the above',
      history: [
        { role: 'user', text: 'hello' },
        { role: 'model', text: 'hi there' },
      ],
    });
    expect(parsed.history).toHaveLength(2);
  });

  it('rejects invalid roles', () => {
    expect(() =>
      chatInputSchema.parse({ message: 'x', history: [{ role: 'system', text: 'x' }] }),
    ).toThrow();
  });

  it('rejects oversized history', () => {
    const history = Array.from({ length: 41 }, () => ({ role: 'user', text: 'hi' }));
    expect(() => chatInputSchema.parse({ message: 'x', history })).toThrow();
  });
});

describe('profileUpdateSchema', () => {
  it('accepts partial updates', () => {
    expect(profileUpdateSchema.parse({ bio: 'Hello' }).bio).toBe('Hello');
  });

  it('rejects privileged fields', () => {
    expect(() => profileUpdateSchema.parse({ role: 'admin' })).toThrow();
  });

  it('rejects unknown preference keys', () => {
    expect(() => profileUpdateSchema.parse({ preferences: { isAdmin: true } })).toThrow();
  });
});

describe('articleBriefSchema', () => {
  it('accepts a valid brief', () => {
    const brief = {
      title: 'Firestore rules in practice',
      summary: 'A practical overview of ownership checks and field-level guards.',
      keyPoints: ['Ownership from auth.uid', 'Deny by default', 'Test your rules'],
      tone: 'technical',
      tags: ['firestore', 'security'],
    };
    expect(articleBriefSchema.parse(brief).keyPoints).toHaveLength(3);
  });

  it('rejects too few key points', () => {
    expect(() =>
      articleBriefSchema.parse({
        title: 'Too short',
        summary: 'x'.repeat(30),
        keyPoints: ['one'],
        tone: 'neutral',
        tags: ['a'],
      }),
    ).toThrow();
  });
});

describe('parseOrThrow', () => {
  it('returns parsed data on success', () => {
    expect(parseOrThrow(secureEchoInputSchema, { message: 'hi' }).priority).toBe('normal');
  });

  it('throws an invalid-argument AppError with field details', () => {
    try {
      parseOrThrow(secureEchoInputSchema, { message: '' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('invalid-argument');
      expect(appError.details?.issues).toBeInstanceOf(Array);
    }
  });
});
