import { onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config';
import { db } from '../lib/admin';
import { getAiProvider } from '../ai/provider';
import { generateStructuredOutput, generateText, sendChatMessage } from '../ai/service';
import { createCallableHandler } from '../middleware/handler';
import {
  appendMessage,
  ensureConversation,
  getRecentMessages,
  recordUsage,
} from '../services/conversations';
import {
  articleBriefJsonSchema,
  articleBriefSchema,
  chatInputSchema,
  generateTextInputSchema,
  structuredOutputInputSchema,
  type ChatInput,
  type GenerateTextInput,
  type StructuredOutputInput,
} from '../validation/schemas';

const callableOptions = {
  region: REGION,
  maxInstances: 10,
  memory: '256MiB' as const,
  timeoutSeconds: 60,
};

export const aiGenerateText = onCall(callableOptions, (request) =>
  createCallableHandler<
    GenerateTextInput,
    { text: string; model: string; mocked: boolean; usage?: unknown }
  >({ name: 'aiGenerateText', schema: generateTextInputSchema }, async ({ input, userId }) => {
    const provider = getAiProvider();
    const result = await generateText(provider.client, {
      prompt: input.prompt,
      systemInstruction: input.systemInstruction,
      model: input.model,
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
    });

    await recordUsage(db(), {
      uid: userId as string,
      endpoint: 'aiGenerateText',
      tokens: result.usage?.totalTokens,
      mocked: result.mocked,
    });

    return { text: result.text, model: result.model, mocked: result.mocked, usage: result.usage };
  })(request),
);

export const aiGenerateStructured = onCall(callableOptions, (request) =>
  createCallableHandler<
    StructuredOutputInput,
    { brief: unknown; model: string; mocked: boolean; attempts: number }
  >(
    { name: 'aiGenerateStructured', schema: structuredOutputInputSchema },
    async ({ input, userId }) => {
      const provider = getAiProvider();
      const result = await generateStructuredOutput(provider.client, {
        prompt: input.prompt,
        schema: articleBriefSchema,
        jsonSchema: articleBriefJsonSchema as unknown as Record<string, unknown>,
        model: input.model,
      });

      await recordUsage(db(), {
        uid: userId as string,
        endpoint: 'aiGenerateStructured',
        tokens: result.usage?.totalTokens,
        mocked: result.mocked,
      });

      return {
        brief: result.data,
        model: result.model,
        mocked: result.mocked,
        attempts: result.attempts,
      };
    },
  )(request),
);

export const aiChat = onCall(callableOptions, (request) =>
  createCallableHandler<
    ChatInput,
    {
      conversationId: string;
      text: string;
      model: string;
      mocked: boolean;
      usage?: unknown;
      createdAt: string;
    }
  >({ name: 'aiChat', schema: chatInputSchema }, async ({ input, userId }) => {
    const uid = userId as string;
    const provider = getAiProvider();
    const firestore = db();

    const conversation = await ensureConversation(firestore, {
      uid,
      conversationId: input.conversationId,
      model: input.model ?? 'gemini-2.5-flash',
      title: input.message.slice(0, 60),
    });

    // Server-owned history: the client can only continue a conversation it owns,
    // and prior turns are read from Firestore rather than trusted from the payload.
    const persistedHistory = await getRecentMessages(firestore, {
      uid,
      conversationId: conversation.id,
      limit: 20,
    });
    const history = persistedHistory.length > 0 ? persistedHistory : (input.history ?? []);

    await appendMessage(firestore, {
      uid,
      conversationId: conversation.id,
      role: 'user',
      text: input.message,
    });

    const result = await sendChatMessage(provider.client, {
      history,
      message: input.message,
      systemInstruction: input.systemInstruction,
      model: input.model,
    });

    await appendMessage(firestore, {
      uid,
      conversationId: conversation.id,
      role: 'model',
      text: result.text,
      model: result.model,
      tokens: result.usage?.totalTokens,
    });

    await recordUsage(firestore, {
      uid,
      endpoint: 'aiChat',
      tokens: result.usage?.totalTokens,
      mocked: result.mocked,
    });

    return {
      conversationId: conversation.id,
      text: result.text,
      model: result.model,
      mocked: result.mocked,
      usage: result.usage,
      createdAt: new Date().toISOString(),
    };
  })(request),
);

export const aiUsageSummary = onCall(callableOptions, (request) =>
  createCallableHandler<Record<string, never>, { months: Array<Record<string, unknown>> }>(
    { name: 'aiUsageSummary', schema: undefined, rateLimit: null },
    async ({ userId }) => {
      const snapshot = await db()
        .collection(`users/${userId}/usage`)
        .orderBy('month', 'desc')
        .limit(6)
        .get();

      return {
        months: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      };
    },
  )(request),
);
