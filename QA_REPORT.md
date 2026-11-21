# QA report

Cycle: 2026-11-21 — Spark-mode deployment of the client-side build.

## Automated checks (local, now passing)

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (web + functions) | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass, 0 warnings |
| Unit tests | `npm run test:unit` | **51 passed**, 5 files |
| Production build | `npm run build:web` | Pass — `apps/web/dist`, ≈0.9 MB JS |
| Secrets scan | `npm run check:secrets` | Pass |
| Firestore rules tests | `npm run test:rules` | Not run this cycle (needs Java 21); ruleset compiled successfully during `firebase deploy` |

Defect found and fixed during this cycle: `normalizeError` unit test constructed `ApiError` with
positional arguments, so the missing-key branch never matched. Test now passes
`{ code: 'gemini-key-missing' }` and asserts the Setup-tab guidance text.

## End-to-end verification against production

Target: <https://fb-ai-starter-kit.web.app>

| Item | Result |
| --- | --- |
| Page title / H1 | `Firebase AI Starter Kit` |
| Network requests | 23 loaded, **0 failed** (no 4xx/5xx) |
| Console errors / unhandled rejections | **0** |
| Sign-up (email + password) | Succeeds, lands on dashboard |
| Tab: Text | Renders prompt + system-instruction form and Generate action |
| Tab: Structured | Renders JSON-output form; Zod validation wired client-side |
| Tab: Chat | Renders multi-turn chat with empty state, send and delete |
| Tab: Profile | Renders profile form; usage counter reads 0 events via Firestore `count()` |
| Tab: Security | Renders payload form that writes through the deployed rules |
| Tab: Setup | Renders Gemini key field, reports "no key yet" |
| Mobile viewport (390×844) | Single column, no overflow, no errors |
| Secrets in bundle | None; no user key persisted to `localStorage` during the test |

## Known gaps

- Gemini generation not exercised against the live deployment (no key supplied by design).
- Blaze-mode functions untested end to end this cycle; covered by 14 emulator smoke checks in CI.
- Lighthouse was not run; the page is a single small bundle with no blocking third-party requests.
