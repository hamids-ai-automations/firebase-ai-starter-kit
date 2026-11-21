import { z } from 'zod';
import { AI_LIMITS, DEFAULT_MODEL, SUPPORTED_MODELS } from '../config';

/**
 * Every endpoint validates its own input with these schemas.
 * Rules encoded here are enforced regardless of what the client sends.
 */

const modelSchema = z
  .enum(Object.keys(SUPPORTED_MODELS) as [string, ...string[]])
  .default(DEFAULT_MODEL);

const promptSchema = z
  .string()
  .min(1, { message: 'prompt must not be empty' })
  .max(AI_LIMITS.maxPromptChars, {
    message: `prompt must be at most ${AI_LIMITS.maxPromptChars} characters`,
  });

const systemInstructionSchema = z
  .string()
  .max(AI_LIMITS.maxSystemInstructionChars, {
    message: `systemInstruction must be at most ${AI_LIMITS.maxSystemInstructionChars} characters`,
  })
  .optional();

export const generateTextInputSchema = z
  .object({
    prompt: promptSchema,
    systemInstruction: systemInstructionSchema,
    model: modelSchema.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().min(64).max(4096).optional(),
  })
  .strict();

export const structuredOutputInputSchema = z
  .object({
    prompt: promptSchema,
    model: modelSchema.optional(),
  })
  .strict();

export const chatMessageSchema = z
  .object({
    role: z.enum(['user', 'model']),
    text: z.string().min(1).max(AI_LIMITS.maxPromptChars),
  })
  .strict();

export const chatInputSchema = z
  .object({
    conversationId: z.string().min(1).max(128).optional(),
    message: promptSchema,
    history: z.array(chatMessageSchema).max(AI_LIMITS.maxHistoryMessages).optional(),
    systemInstruction: systemInstructionSchema,
    model: modelSchema.optional(),
  })
  .strict();

export const profileUpdateSchema = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    bio: z.string().max(280).optional(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        defaultModel: z.enum(Object.keys(SUPPORTED_MODELS) as [string, ...string[]]).optional(),
        saveHistory: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const deleteConversationInputSchema = z
  .object({
    conversationId: z.string().min(1).max(128),
  })
  .strict();

export const secureEchoInputSchema = z
  .object({
    message: z.string().min(1).max(500),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  })
  .strict();

/** Shape of the structured output produced by the AI structured-output demo. */
export const articleBriefSchema = z
  .object({
    title: z.string().min(3).max(120),
    summary: z.string().min(20).max(600),
    keyPoints: z.array(z.string().min(3).max(160)).min(3).max(6),
    tone: z.enum(['neutral', 'persuasive', 'technical', 'friendly']),
    tags: z.array(z.string().min(2).max(30)).min(1).max(8),
  })
  .strict();

export type GenerateTextInput = z.infer<typeof generateTextInputSchema>;
export type ChatInput = z.infer<typeof chatInputSchema>;
export type StructuredOutputInput = z.infer<typeof structuredOutputInputSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ArticleBrief = z.infer<typeof articleBriefSchema>;

/**
 * JSON Schema handed to Gemini so the model itself is constrained, and used
 * again by `articleBriefSchema` to validate what actually came back.
 */
export const articleBriefJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    tone: { type: 'string', enum: ['neutral', 'persuasive', 'technical', 'friendly'] },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'keyPoints', 'tone', 'tags'],
  propertyOrdering: ['title', 'summary', 'keyPoints', 'tone', 'tags'],
} as const;
