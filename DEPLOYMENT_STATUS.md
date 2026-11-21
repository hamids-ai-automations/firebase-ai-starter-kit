# Deployment status

This file records exactly what is live, what is verified, and what is still blocked. It is updated
by hand at the end of every release cycle — there are no automatic claims about production state.

_Last updated: 2026-11-21_

## Summary

| Item                        | State                             | Notes                                                                      |
| --------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Source code                 | Complete                          | `apps/web` (React 19 + Vite), `functions` (Node 22, firebase-functions v2) |
| Automated checks            | Green locally                     | `npm run verify`, `npm run test:rules`, `npm run test:emulator`            |
| CI pipeline                 | Committed, not yet observed green | `.github/workflows/ci.yml` runs on the first push to `main`                |
| Firestore rules + indexes   | Written and unit-tested           | `firestore/rules.test.ts` (22 assertions)                                  |
| Gemini integration          | Implemented, mock-tested          | Real calls need `GEMINI_API_KEY`; `AI_MOCK_MODE=true` for tests            |
| Firebase Hosting deployment | **Blocked**                       | Requires a Firebase project on the Blaze plan and repository secrets       |
| Public demo URL             | Not available                     | No project has been linked to this repository yet                          |
| Portfolio project page      | **Blocked**                       | Depends on the Hosting deployment                                          |

## Verification evidence

Recorded from the development machine (Windows 10, Node 22, JDK 21, firebase-tools 15.x):

| Command                 | Result                                            |
| ----------------------- | ------------------------------------------------- |
| `npm run check:secrets` | pass — no credential patterns in tracked files    |
| `npm run lint`          | pass — 0 errors, 0 warnings                       |
| `npm run typecheck`     | pass — web + functions                            |
| `npm run test`          | pass — functions unit tests + web component tests |
| `npm run build`         | pass — web bundle + functions compile             |
| `npm run test:rules`    | pass — auth + firestore emulators                 |
| `npm run test:emulator` | pass — all callable smoke checks                  |

The two screenshots in `docs/screenshots/` were captured from the running build: the setup screen
from a build without Firebase configuration, and the dashboard after signing a throwaway account up
against the Auth emulator with `AI_MOCK_MODE=true`.

## What is required to go live

1. A Firebase project with **Cloud Functions (2nd gen)** enabled — the Blaze plan is mandatory.
2. Gemini API key from Google AI Studio, stored as the `GEMINI_API_KEY` secret:
   `firebase functions:secrets:set GEMINI_API_KEY`
3. A registered Web App whose config is copied into `.env` (`VITE_FIREBASE_*`).
4. App Check registration (recommended) with a reCAPTCHA Enterprise site key in
   `VITE_APPCHECK_SITE_KEY` and enforcement enabled in the console.
5. Repository secrets for the deploy workflow: `FIREBASE_SERVICE_ACCOUNT_JSON`,
   `FIREBASE_PROJECT_ID`, and optionally `GEMINI_API_KEY`.
6. A manual `Deploy` workflow run with `target=all` and the confirmation string.

Steps 1–5 require account owner access and billing approval, so they are intentionally left as an
owner action rather than something this repository does automatically.

## Deliberately out of scope for v1.0.0

- Multi-region function deployment
- Vertex AI (the kit uses the Google AI Studio Gemini API through `@google/genai`)
- Server-side conversation pagination beyond the documented `limit` parameter
- Billing integration for per-user quotas beyond the built-in rate limiter
