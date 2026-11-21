type LogPayload = Record<string, unknown>;

/**
 * Minimal structured logger.
 *
 * Rules enforced here:
 *  - prompts, model output, tokens and user PII are never logged verbatim
 *  - only identifiers, lengths, counts and error metadata are recorded
 */
const REDACTED_KEYS = new Set([
  'prompt',
  'text',
  'content',
  'message',
  'response',
  'apiKey',
  'apikey',
  'authorization',
  'token',
  'password',
  'email',
]);

function sanitize(payload: LogPayload): LogPayload {
  const out: LogPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (REDACTED_KEYS.has(key)) {
      out[key] = typeof value === 'string' ? `[redacted:${value.length}]` : '[redacted]';
      continue;
    }
    if (value instanceof Error) {
      out[key] = value.message;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function emit(
  severity: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  event: string,
  payload: LogPayload = {},
) {
  const line = JSON.stringify({
    severity,
    event,
    ...sanitize(payload),
    at: new Date().toISOString(),
  });
  if (severity === 'ERROR') {
    console.error(line);
  } else if (severity === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, payload?: LogPayload) => emit('INFO', event, payload),
  warn: (event: string, payload?: LogPayload) => emit('WARN', event, payload),
  error: (event: string, payload?: LogPayload) => emit('ERROR', event, payload),
  debug: (event: string, payload?: LogPayload) => {
    if (process.env.DEBUG_LOGS === 'true') emit('DEBUG', event, payload);
  },
};
