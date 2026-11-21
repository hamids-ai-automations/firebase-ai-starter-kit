import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

const OWNER = 'owner-uid';
const OTHER = 'other-uid';

let testEnv: RulesTestEnvironment;

const rulesPath = join(__dirname, '..', '..', '..', 'firestore', 'firestore.rules');

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-starter-kit',
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

const ownerDb = () => testEnv.authenticatedContext(OWNER).firestore();
const otherDb = () => testEnv.authenticatedContext(OTHER).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

const profile = {
  email: 'owner@example.com',
  displayName: 'Owner',
  bio: 'Hello',
  role: 'user',
  preferences: { theme: 'dark' },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

describe('users/{uid} profile rules', () => {
  it('lets a user create and read their own profile', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}`), profile));
    await assertSucceeds(getDoc(doc(ownerDb(), `users/${OWNER}`)));
  });

  it('blocks unauthenticated reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER}`), profile);
    });
    await assertFails(getDoc(doc(anonDb(), `users/${OWNER}`)));
  });

  it('blocks cross-user reads and writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER}`), profile);
    });
    await assertFails(getDoc(doc(otherDb(), `users/${OWNER}`)));
    await assertFails(setDoc(doc(otherDb(), `users/${OWNER}`), { ...profile, bio: 'takeover' }));
  });

  it('rejects self-assigned admin roles', async () => {
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}`), { ...profile, role: 'admin' }));
  });

  it('rejects unknown fields on create', async () => {
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}`), { ...profile, isPaid: true }));
  });

  it('prevents role escalation on update', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}`), profile));
    await assertFails(updateDoc(doc(ownerDb(), `users/${OWNER}`), { role: 'admin' }));
  });

  it('allows benign profile updates', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}`), profile));
    await assertSucceeds(updateDoc(doc(ownerDb(), `users/${OWNER}`), { bio: 'Updated bio' }));
  });

  it('rejects oversized bios', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}`), profile));
    await assertFails(updateDoc(doc(ownerDb(), `users/${OWNER}`), { bio: 'x'.repeat(400) }));
  });

  it('forbids deleting a profile', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}`), profile));
    await assertFails(deleteDoc(doc(ownerDb(), `users/${OWNER}`)));
  });
});

describe('conversation rules', () => {
  const conversation = {
    title: 'First chat',
    model: 'gemini-2.5-flash',
    messageCount: 0,
    lastMessagePreview: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  it('lets owners create and read conversations', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), conversation));
    await assertSucceeds(getDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`)));
  });

  it('blocks other users from reading a conversation', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), conversation));
    await assertFails(getDoc(doc(otherDb(), `users/${OWNER}/conversations/c1`)));
  });

  it('ignores client attempts to fake message counts on update', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), conversation));
    await assertFails(
      updateDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), { messageCount: 999 }),
    );
  });

  it('allows owners to rename a conversation and delete it', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), conversation));
    await assertSucceeds(
      updateDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), { title: 'Renamed' }),
    );
    await assertSucceeds(deleteDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`)));
  });

  it('rejects empty titles', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c2`), { ...conversation, title: '' }),
    );
  });
});

describe('message rules', () => {
  const conversation = {
    title: 'Chat',
    model: 'gemini-2.5-flash',
    messageCount: 0,
    lastMessagePreview: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  beforeEach(async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1`), conversation));
  });

  it('lets an owner append a user message', async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1/messages/m1`), {
        role: 'user',
        text: 'Hello',
        model: null,
        tokens: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('forbids clients from writing assistant messages', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1/messages/m2`), {
        role: 'model',
        text: 'Forged assistant answer',
        model: 'gemini-2.5-flash',
        tokens: 10,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('forbids oversized messages', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/conversations/c1/messages/m3`), {
        role: 'user',
        text: 'x'.repeat(9000),
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('blocks cross-user message reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER}/conversations/c1/messages/m4`), {
        role: 'user',
        text: 'private',
        createdAt: new Date(),
      });
    });
    await assertFails(getDoc(doc(otherDb(), `users/${OWNER}/conversations/c1/messages/m4`)));
  });
});

describe('server-owned collections', () => {
  it('denies all client access to rate limit buckets', async () => {
    await assertFails(getDoc(doc(ownerDb(), 'rateLimits/some-bucket')));
    await assertFails(setDoc(doc(ownerDb(), 'rateLimits/some-bucket'), { count: 0 }));
  });

  it('allows reading own usage but not writing it', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER}/usage/2026-11`), {
        month: '2026-11',
        requests: 5,
      });
    });
    await assertSucceeds(getDoc(doc(ownerDb(), `users/${OWNER}/usage/2026-11`)));
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER}/usage/2026-11`), { month: '2026-11', requests: 0 }),
    );
  });

  it('blocks cross-user usage reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER}/usage/2026-11`), {
        month: '2026-11',
        requests: 5,
      });
    });
    await assertFails(getDoc(doc(otherDb(), `users/${OWNER}/usage/2026-11`)));
  });

  it('denies access to unrelated top-level collections', async () => {
    await assertFails(getDoc(doc(ownerDb(), 'admin/settings')));
    await assertFails(setDoc(doc(anonDb(), 'anything/doc'), { a: 1 }));
  });
});
