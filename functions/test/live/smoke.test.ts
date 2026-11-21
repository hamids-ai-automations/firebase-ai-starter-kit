import { describe, expect, it } from 'vitest';

/**
 * Opt-in smoke test against a deployed project. Skipped by default so the
 * normal `npm test` run never touches production.
 *
 * Usage:
 *   LIVE_TEST_REGION=us-central1 \
 *   LIVE_TEST_PROJECT=your-project \
 *   LIVE_TEST_ID_TOKEN=<firebase id token> \
 *   npm run test:live
 */
const project = process.env.LIVE_TEST_PROJECT;
const idToken = process.env.LIVE_TEST_ID_TOKEN;
const region = process.env.LIVE_TEST_REGION ?? 'us-central1';

const enabled = Boolean(project && idToken);

describe.skipIf(!enabled)('deployed functions smoke test', () => {
  it('answers the health probe', async () => {
    const response = await fetch(`https://${region}-${project}.cloudfunctions.net/apiHealth`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; ai: string };
    expect(body.ok).toBe(true);
    expect(['gemini', 'mock', 'unconfigured']).toContain(body.ai);
  });

  it('rejects an unauthenticated callable', async () => {
    const response = await fetch(`https://${region}-${project}.cloudfunctions.net/aiGenerateText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { prompt: 'hello' } }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
