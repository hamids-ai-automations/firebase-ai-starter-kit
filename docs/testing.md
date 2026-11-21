# Testing

## Test pyramid

| Layer                 | Tool                                      | Count | What it proves                                                                           |
| --------------------- | ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| Unit                  | Vitest                                    | 51    | Validation, error mapping, rate limit math, AI service, Gemini client, API error mapping |
| Rules                 | `@firebase/rules-unit-testing` + emulator | 22    | Ownership, field whitelists, server-only paths, cross-user denial                        |
| End-to-end (emulator) | Node script + emulator                    | 14    | Real callables: auth, AI, chat persistence, deletion, usage, echo                        |
| Live (optional)       | Vitest + real key                         | 1     | The real Gemini path still works after an SDK/provider upgrade                           |

## Commands

```bash
npm test                 # functions unit + web unit
npm run test:unit        # functions unit only
npm run test:rules       # Firestore rules tests (needs Java 21)
npm run test:emulator    # full callable smoke test against the emulator
npm run test:live        # optional; requires GEMINI_API_KEY
npm run verify           # secrets + lint + typecheck + tests + build
```

## Unit tests (`functions/test/unit`)

| File                | Focus                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `schemas.test.ts`   | Accept/reject cases for each Zod schema, boundary lengths              |
| `errors.test.ts`    | `AppError` → `HttpsError` mapping, redaction                           |
| `rateLimit.test.ts` | Window rollover, limit enforcement, retry seconds                      |
| `aiService.test.ts` | Prompt assembly, history trimming, structured repair, usage extraction |
| `gemini.test.ts`    | Request shape passed to `@google/genai`, error translation             |

`apps/web/src/lib/api.test.ts` covers client-side error normalisation so panels render consistent
messages.

## Rules tests (`functions/test/rules`)

Each rule gets a positive case and the closest negative case:

- owner can read/write their profile
- owner cannot write server-managed fields
- user A cannot read or write user B's conversations
- `usage/*` is read-only for any client
- unauthenticated access is always denied

Run them through `firebase emulators:exec --only auth,firestore "npm --prefix functions run test:rules"`.

## Emulator smoke test (`scripts/emulator-smoke.mjs`)

Boots the emulator suite, then exercises the deployed-like surface:

1. `apiHealth` returns `status: ok`; unauthenticated callable rejected
2. sign-up → ID token
3. `aiGenerateText` returns text (mock mode) and rejects an empty prompt
4. `ensureUserProfile` creates the profile; second call reports `created: false`
5. `aiChat` creates a conversation, a second call continues it from persisted history
6. `deleteConversation` removes it, and the messages are gone
7. `aiUsageSummary` lists the current month
8. `secureEcho` round-trips a message

All 14 checks must pass; the script exits non-zero on the first failure.

## Mock mode

`AI_MOCK_MODE=true` plus the emulator makes the AI deterministic:

- `aiChat` echoes the last user message with a fixed prefix
- `aiGenerateStructured` returns a valid `ArticleBrief`
- usage still gets recorded, with `mocked: true`

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests:

1. checkout + Node 22 + npm cache
2. `npm --prefix apps/web ci` and `npm --prefix functions ci`
3. secret scan → lint → typecheck → unit tests → rules tests (Java 21 via `actions/setup-java`) → build
4. upload build artefacts for inspection

No live model calls run in CI: the suite is deterministic and free.

## Writing a new test

1. Add the case to the closest existing spec; do not create a new top-level folder.
2. Use `describe/it` with behaviour names ("rejects prompts over 8000 characters").
3. For rules, always pair the allowed case with the denied case.
4. Keep fixtures local to the file; the suite must stay parallel-safe.
