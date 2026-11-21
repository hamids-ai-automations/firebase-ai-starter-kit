# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-11-21

Runs without a billing account. The default build calls Gemini from the browser with a key the user
supplies for the session, so the kit can be demoed and forked on the free Spark plan. The Cloud
Functions variant is unchanged and remains the upgrade path.

### Added

- **Spark mode** — `apps/web/src/lib/api.ts` now calls `generativelanguage.googleapis.com/v1beta`
  directly, keeping the exported function names (`generateText`, `generateStructured`, `chat`,
  `deleteConversation`, `ensureProfile`, `updateProfile`, `secureEcho`, `usageSummary`) so panels and
  tests are unaffected.
- **Setup panel + `lib/geminiKey.ts`** — per-session key entry held in `sessionStorage`; the key is
  never committed, never bundled and never written to Firestore.
- **Live demo** — <https://fb-ai-starter-kit.web.app>, deployed to a dedicated Hosting site
  (`fb-ai-starter-kit`) on the Spark plan; no existing site in the project was touched.
- **[`docs/FREE_PLAN_DEPLOYMENT.md`](docs/FREE_PLAN_DEPLOYMENT.md)** — console clicks, env values,
  build, target wiring, verification, rollback, quota posture and troubleshooting.
- **Project operations docs** — `PROJECT_STATE.md`, `TASK_LEDGER.md`, `DEVELOPMENT_LOG.md`,
  `QA_REPORT.md`, `SECURITY_AUDIT.md`, plus production screenshots in `docs/screenshots/`.

### Changed

- Firestore rules reworked for the client-write model: owner-scoped paths, field allow-lists, length
  caps, append-only messages, immutable `usage_events`, deny-all catch-all.
- Usage readout uses Firestore `count()`/`sum()` aggregation instead of reading every event.
- README documents both modes side by side (key custody, rate limiting, deployment commands).

### Fixed

- `normalizeError` test passed `ApiError` positionally, so the `gemini-key-missing` branch was never
  asserted; now uses the object form and checks the Setup-tab guidance.

### Known limitations

- Spark mode has no server-side rate limiting; per-user usage is metered client-side.
- Responses are still not streamed.
- The `functions/` variant requires the Blaze plan and is not deployed.

## [1.0.0] — 2026-11-21

### Added

- **Web app** — React 19 + Vite 8 dashboard with auth, text generation, structured output, chat,
  conversation list, usage summary, profile/preferences, and a setup checklist for unconfigured
  environments.
- **Cloud Functions (v2)** — `aiGenerateText`, `aiGenerateStructured`, `aiChat`, `aiUsageSummary`,
  `deleteConversation`, `ensureUserProfile`, `updateUserProfile`, `secureEcho`, `apiHealth`.
- **Middleware** — authentication gate, strict Zod validation, Firestore-backed fixed-window rate
  limiting, `AppError` → `HttpsError` mapping, redacted structured logging.
- **AI layer** — provider abstraction with a Gemini implementation (`@google/genai`), deterministic
  mock provider, prompt/history trimming, structured-output repair attempt, usage extraction.
- **Data layer** — hardened Firestore rules for profiles, conversations, messages, usage counters,
  and rate-limit documents; composite indexes for the UI queries.
- **Security** — secret scanning script, hosting hardening headers, App Check integration points,
  documented threat model.
- **Testing** — 51 unit tests, 22 rules tests, 14 end-to-end emulator checks, optional live Gemini
  test.
- **Tooling** — `npm run setup / dev / build / verify / test:rules / test:emulator / deploy`,
  emulator orchestrator, GitHub Actions CI, issue and PR templates, Dependabot.
- **Documentation** — README, architecture, setup, API reference, security, testing, deployment,
  troubleshooting, examples.

### Fixed

- `aiChat` wrote `lastMessagePreview: undefined` for user messages, which Firestore rejects; the
  field is now only written for model replies.
- A stray `>` in the Gemini client broke the Functions build.
- Removed a self-referential workspace dependency (`firebase-ai-starter-kit: file:..`) that created
  recursive `node_modules` junctions and broke CI installs on Windows.

### Known limitations

- Responses are not streamed.
- App Check ships in monitoring mode by default.
- ~~The hosted demo and the Marvis project page are pending deployment.~~ Superseded by 1.1.0 — both are live.

[1.1.0]: https://github.com/hamids-ai-automations/firebase-ai-starter-kit/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/hamids-ai-automations/firebase-ai-starter-kit/releases/tag/v1.0.0
