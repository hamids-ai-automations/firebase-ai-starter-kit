import { onRequest } from 'firebase-functions/v2/https';
import { REGION, SUPPORTED_MODELS } from '../config';
import { describeAiMode } from '../ai/provider';

/** Public, dependency-free readiness probe. Exposes no configuration details. */
export const apiHealth = onRequest({ region: REGION, cors: true, maxInstances: 5 }, (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'firebase-ai-starter-kit-functions',
    ai: describeAiMode(),
    models: Object.keys(SUPPORTED_MODELS),
    time: new Date().toISOString(),
  });
});
