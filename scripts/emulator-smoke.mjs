#!/usr/bin/env node
/**
 * End-to-end smoke test against the local emulator suite.
 *
 * Run with:  npm run test:emulator
 * (uses AI_MOCK_MODE=true so no Gemini key is required)
 */
const PROJECT =
  process.env.GCLOUD_PROJECT ?? process.env.GCLOUD_PROJECT_ID ?? 'demo-fb-ai-starter-kit';
const REGION = process.env.FUNCTIONS_REGION ?? 'us-central1';
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

let failures = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function health() {
  const response = await fetch(`${FUNCTIONS}/apiHealth`);
  const body = await response.json().catch(() => ({}));
  check('GET apiHealth returns 200', response.status === 200, `status ${response.status}`);
  check('apiHealth reports ok', body.ok === true, JSON.stringify(body));
  check('apiHealth reports mock mode', body.ai === 'mock', JSON.stringify(body.ai));
}

async function unauthenticated() {
  const response = await fetch(`${FUNCTIONS}/aiGenerateText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { prompt: 'hello' } }),
  });
  check('callable rejects anonymous calls', response.status >= 400, `status ${response.status}`);
}

async function signUp() {
  const response = await fetch(`${AUTH}/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `smoke+${Date.now()}@example.com`,
      password: 'super-secret-123',
      returnSecureToken: true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!body.idToken) {
    check('auth emulator sign-up returns idToken', false, JSON.stringify(body).slice(0, 300));
    return null;
  }
  check('auth emulator sign-up returns idToken', true);
  return body.idToken;
}

async function callWithToken(token, name, data) {
  const response = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function authenticated(token) {
  const ok = await callWithToken(token, 'aiGenerateText', { prompt: 'Say hello in five words.' });
  check(
    'aiGenerateText accepts an authenticated call',
    ok.status === 200,
    JSON.stringify(ok.body).slice(0, 300),
  );
  check(
    'aiGenerateText returns mock text',
    ok.body?.result?.data?.mocked === true && typeof ok.body.result.data.text === 'string',
    JSON.stringify(ok.body).slice(0, 300),
  );

  const bad = await callWithToken(token, 'aiGenerateText', { prompt: '' });
  check('aiGenerateText rejects an empty prompt', bad.status === 400, `status ${bad.status}`);

  const profile = await callWithToken(token, 'ensureUserProfile', {});
  check(
    'ensureUserProfile creates a profile',
    profile.body?.result?.data?.created === true,
    JSON.stringify(profile.body).slice(0, 300),
  );

  const chat = await callWithToken(token, 'aiChat', { message: 'Remember the number 42.' });
  const conversationId = chat.body?.result?.data?.conversationId;
  check(
    'aiChat creates a conversation',
    Boolean(conversationId),
    JSON.stringify(chat.body).slice(0, 300),
  );

  if (conversationId) {
    const followUp = await callWithToken(token, 'aiChat', {
      message: 'What number did I say?',
      conversationId,
    });
    check(
      'aiChat continues the conversation',
      followUp.body?.result?.data?.conversationId === conversationId,
      JSON.stringify(followUp.body).slice(0, 300),
    );

    const deleted = await callWithToken(token, 'deleteConversation', { conversationId });
    check(
      'deleteConversation removes the conversation',
      deleted.body?.result?.data?.deleted >= 1,
      JSON.stringify(deleted.body).slice(0, 300),
    );
  }

  const summary = await callWithToken(token, 'aiUsageSummary', {});
  check(
    'aiUsageSummary returns a month list',
    Array.isArray(summary.body?.result?.data?.months),
    JSON.stringify(summary.body).slice(0, 300),
  );

  const echo = await callWithToken(token, 'secureEcho', {
    message: '<script>alert(1)</script>',
    priority: 'high',
  });
  const echoed = echo.body?.result?.data?.echo ?? '';
  check('secureEcho strips markup', !echoed.includes('<script>'), String(echoed));
}

const main = async () => {
  console.log(`emulator smoke test -> ${FUNCTIONS}`);
  await health();
  await unauthenticated();
  const token = await signUp();
  if (token) await authenticated(token);
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nall emulator smoke checks passed.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
