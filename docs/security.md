# Security

## Threat model

| Threat                                   | Impact                             | Control                                                                                               |
| ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| API key extracted from the bundle        | Unbounded spend on the owner's key | Key exists only as a Functions secret; the browser never sees it                                      |
| Anonymous abuse of AI endpoints          | Cost blow-up                       | `request.auth` required on every callable; rate limits per uid                                        |
| Cross-user data access                   | Privacy breach                     | Path-scoped rules (`users/{uid}/**`) with ownership assertions                                        |
| Prompt injection causing oversized input | Cost and latency                   | Character caps and history caps enforced before the model call                                        |
| Model output used as trusted data        | UI/logic corruption                | Structured output validated with Zod on the server                                                    |
| Secret committed to git                  | Permanent leak                     | `.gitignore` coverage plus `npm run check:secrets` in CI                                              |
| Emulator mock leaking to production      | Fake data in production            | Mock mode requires `FUNCTIONS_EMULATOR=true`                                                          |
| Clickjacking / MIME sniffing             | Client-side attacks                | Hosting headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |

## Authentication

- Only Email/Password is enabled by default; add providers in the console as needed.
- Every callable passes through `createCallableHandler`, which throws
  `AppError.unauthorized()` when `request.auth` is empty.
- The client never decides the uid; the server reads `request.auth.uid`.

## App Check

- When `VITE_APPCHECK_SITE_KEY` is set, the web SDK registers `ReCaptchaEnterpriseProvider` and sends
  App Check tokens with callable requests.
- The middleware reads `request.app` and logs the verification state; enabling **enforcement** in the
  console is the production step (see `docs/deployment.md`).
- Recommended rollout: monitoring for 1–2 weeks, review metrics, then enforce.

## Firestore rules

Design rules, not per-document exceptions:

- `isSignedIn()` / `isOwner(uid)` helpers instead of repeated inline checks.
- Profile writes are restricted to a whitelist of user-editable fields; `email`, `createdAt`, and
  `usage/*` are server-only.
- Conversation counters (`messageCount`, `lastMessagePreview`, `updatedAt`) can only be written by
  the Functions service account.
- Reads require ownership; there is no "list all" path.
- Rules tests (`functions/test/rules/*.spec.ts`) cover positive and negative cases for each path,
  including cross-user attempts.

## Input validation

- Zod schemas are `strict()`: unknown keys are rejected rather than ignored.
- Length caps: 8 000 prompt chars, 4 000 system-instruction chars, 40 history messages, 500 chars for
  the echo demo.
- Enumerations for `model`, `role`, `theme`, and `priority` mean a client cannot select an
  unsupported model id.
- Validation errors surface the failing path only, never the request body.

## Rate limiting

- `enforceRateLimit` runs inside a Firestore transaction on
  `users/{uid}/rateLimits/{endpointName}`.
- Fixed window (default 60 s) with a per-endpoint maximum (20 for AI, 60 for write endpoints).
- Exceeding the limit raises `resource-exhausted` with `retryAfterSeconds` in `details`.

## Logging and redaction

- `utils/logger.ts` records endpoint, uid, latency, model, token counts, and a status.
- Prompt text, model output, and secrets are never logged.
- Internal errors are logged server-side and replaced with a generic message for the client.

## Secret handling

| Secret           | Where it lives                           | Rotation                                       |
| ---------------- | ---------------------------------------- | ---------------------------------------------- |
| `GEMINI_API_KEY` | Secret Manager, bound to functions       | `firebase functions:secrets:set` then redeploy |
| Web API key      | `apps/web/.env.local` (public by design) | Firebase console                               |
| Service account  | GitHub secret for CI only                | Re-issue in the console                        |

`scripts/check-secrets.mjs` scans tracked files for Google API keys, private keys, and service-account
patterns; it runs inside `npm run verify` and in CI.

## Client hardening

- Hosting sets `Cache-Control: no-cache` for `index.html` and long-lived caching for hashed assets.
- `Permissions-Policy` disables camera, microphone, and geolocation.
- Errors rendered in the UI are the redacted `publicMessage`, not raw exception text.

## Reporting a vulnerability

Please follow [`SECURITY.md`](../SECURITY.md). Do not open a public issue for security reports.
