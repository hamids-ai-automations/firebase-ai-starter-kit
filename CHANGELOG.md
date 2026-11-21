# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- The hosted demo and the Marvis project page are pending deployment.

[1.0.0]: https://github.com/hamids-ai-automations/firebase-ai-starter-kit/releases/tag/v1.0.0
