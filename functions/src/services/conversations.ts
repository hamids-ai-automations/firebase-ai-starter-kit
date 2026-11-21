import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { notFound, permissionDenied } from '../utils/errors';
import { logger } from '../utils/logger';

export interface ConversationRecord {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  lastMessagePreview: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const conversationsPath = (uid: string) => `users/${uid}/conversations`;

/**
 * Conversation persistence. All reads/writes are scoped by `uid` on the server,
 * so a client cannot reach another user's data even by guessing an id.
 */
export async function ensureConversation(
  firestore: Firestore,
  params: { uid: string; conversationId?: string; model: string; title?: string },
): Promise<ConversationRecord> {
  const { uid, model } = params;
  const collection = firestore.collection(conversationsPath(uid));

  if (!params.conversationId) {
    const ref = collection.doc();
    const data = {
      title: params.title ?? 'New conversation',
      model,
      messageCount: 0,
      lastMessagePreview: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(data);
    return { id: ref.id, title: data.title, model, messageCount: 0, lastMessagePreview: '' };
  }

  const ref = collection.doc(params.conversationId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw notFound('Conversation not found.');
  }

  const data = snapshot.data() ?? {};
  return {
    id: ref.id,
    title: typeof data.title === 'string' ? data.title : 'Conversation',
    model: typeof data.model === 'string' ? data.model : model,
    messageCount: Number(data.messageCount ?? 0),
    lastMessagePreview: typeof data.lastMessagePreview === 'string' ? data.lastMessagePreview : '',
    createdAt: (data.createdAt as Timestamp | undefined) ?? null,
    updatedAt: (data.updatedAt as Timestamp | undefined) ?? null,
  };
}

export async function appendMessage(
  firestore: Firestore,
  params: {
    uid: string;
    conversationId: string;
    role: 'user' | 'model';
    text: string;
    model?: string;
    tokens?: number;
  },
): Promise<void> {
  const conversationRef = firestore
    .collection(conversationsPath(params.uid))
    .doc(params.conversationId);

  const messageRef = conversationRef.collection('messages').doc();

  await firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(conversationRef);
    if (!snapshot.exists) throw notFound('Conversation not found.');

    tx.set(messageRef, {
      role: params.role,
      text: params.text.slice(0, 8000),
      model: params.model ?? null,
      tokens: params.tokens ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(1),
    };
    // Only assistant turns refresh the preview; Firestore rejects `undefined`.
    if (params.role === 'model') {
      updates.lastMessagePreview = params.text.slice(0, 140);
    }
    if (params.role === 'user' && Number(snapshot.get('messageCount') ?? 0) === 0) {
      updates.title = params.text.slice(0, 60);
    }
    tx.set(conversationRef, updates, { merge: true });
  });
}

export async function getRecentMessages(
  firestore: Firestore,
  params: { uid: string; conversationId: string; limit: number },
): Promise<Array<{ role: 'user' | 'model'; text: string }>> {
  const snapshot = await firestore
    .collection(conversationsPath(params.uid))
    .doc(params.conversationId)
    .collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(params.limit)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        role: (data.role === 'model' ? 'model' : 'user') as 'user' | 'model',
        text: typeof data.text === 'string' ? data.text : '',
      };
    })
    .reverse();
}

export async function deleteConversationForUser(
  firestore: Firestore,
  params: { uid: string; conversationId: string },
): Promise<{ deleted: number }> {
  const ref = firestore.collection(conversationsPath(params.uid)).doc(params.conversationId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw notFound('Conversation not found.');
  if (snapshot.get('ownerId') && snapshot.get('ownerId') !== params.uid) {
    throw permissionDenied('You can only delete your own conversations.');
  }

  const messages = await ref.collection('messages').limit(200).get();
  const batch = firestore.batch();
  for (const doc of messages.docs) batch.delete(doc.ref);
  batch.delete(ref);
  await batch.commit();

  logger.info('conversation_deleted', { uid: params.uid, messages: messages.size });
  return { deleted: messages.size + 1 };
}

/** Monthly AI usage counters, incremented server-side only. */
export async function recordUsage(
  firestore: Firestore,
  params: { uid: string; endpoint: string; tokens?: number; mocked: boolean },
): Promise<void> {
  const now = new Date();
  const bucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ref = firestore.doc(`users/${params.uid}/usage/${bucket}`);

  await ref.set(
    {
      month: bucket,
      requests: FieldValue.increment(1),
      tokens: FieldValue.increment(params.tokens ?? 0),
      byEndpoint: { [params.endpoint]: FieldValue.increment(1) },
      mocked: params.mocked,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
