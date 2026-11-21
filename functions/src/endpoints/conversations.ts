import { onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config';
import { db } from '../lib/admin';
import { createCallableHandler } from '../middleware/handler';
import { deleteConversationForUser } from '../services/conversations';
import { deleteConversationInputSchema } from '../validation/schemas';

const callableOptions = {
  region: REGION,
  maxInstances: 10,
  memory: '256MiB' as const,
  timeoutSeconds: 30,
};

export const deleteConversation = onCall(callableOptions, (request) =>
  createCallableHandler<{ conversationId: string }, { deleted: number }>(
    { name: 'deleteConversation', schema: deleteConversationInputSchema },
    async ({ input, userId }) =>
      deleteConversationForUser(db(), {
        uid: userId as string,
        conversationId: input.conversationId,
      }),
  )(request),
);
