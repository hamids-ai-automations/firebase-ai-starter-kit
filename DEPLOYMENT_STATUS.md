# Deployment status

Last updated: 2026-11-21

## Live endpoints

| What                          | URL                                                                | State                                    |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| Demo application (Spark mode) | <https://fb-ai-starter-kit.web.app>                                | Live, HTTP 200, six panels verified      |
| Portfolio project page        | <https://marvis.web.app/projects/firebase-ai-starter-kit>          | Live, HTTP 200                           |
| Repository                    | <https://github.com/hamids-ai-automations/firebase-ai-starter-kit> | Public, MIT                              |
| Cloud Functions (Blaze mode)  | —                                                                  | Not deployed: requires a billing account |

## Infrastructure in use

| Resource           | Value                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Firebase project   | `my-1st-web-app-ef52d` — **Spark plan, no billing account**                                             |
| Hosting site       | `fb-ai-starter-kit` (dedicated site, `target: web`), existing sites untouched                           |
| Firestore database | `(default)`, location `asia-south1`, production mode, free tier                                         |
| Authentication     | Email/Password enabled; Default Web App registered                                                      |
| Rules              | `firestore/firestore.rules` deployed (owner-scoped `users/{uid}/**`, `secure_echo`, deny-all catch-all) |
| Indexes            | `firestore/firestore.indexes.json` deployed                                                             |

## What was deployed

```bash
npm ci
npm run build:web                                  # apps/web/dist
firebase deploy --only hosting:web
firebase deploy --only firestore:rules
```

Frontend build: single hashed bundle ≈0.9 MB uncompressed. No `httpsCallable` imports remain in the
shipped bundle; Gemini is called over REST with the user's key (see
[`docs/FREE_PLAN_DEPLOYMENT.md`](docs/FREE_PLAN_DEPLOYMENT.md)).

## Verification performed after deploy

- `https://fb-ai-starter-kit.web.app` returns 200 and the SPA shell; deep links resolve.
- Sign-up with a throwaway account succeeds and the dashboard renders all six tabs
  (Text, Structured, Chat, Profile, Security, Setup).
- Zero console errors and zero failed network requests across 23 loaded resources and all six panels.
- Firestore reads work against the deployed rules (`count()` aggregation on usage events returned 0).
- Screenshots captured from production: `docs/screenshots/shot-auth.png`,
  `shot-dashboard.png`, `shot-mobile.png`.

## Not verified (and why)

- **Live Gemini generation.** QA deliberately did not enter an API key; generation paths are covered by
  unit tests with mocked responses. Adding a personal key in the Setup tab exercises them.
- **Cloud Functions.** Not deployable on Spark; the Blaze runbook in
  [`docs/deployment.md`](docs/deployment.md) is unchanged and ready.
- **Firestore emulator suite in this cycle.** `npm run test:rules` needs Java 21 and was not re-run;
  rules were validated by deployment (`firebase deploy` compiles the ruleset before release).

## How to go fully production (Blaze)

1. Upgrade the project to Blaze and set a budget alert.
2. `firebase functions:secrets:set GEMINI_API_KEY`.
3. Switch `apps/web/src/lib/api.ts` back to the callable implementation, rebuild, redeploy.
4. Register App Check (reCAPTCHA Enterprise) and enforce it on Auth, Firestore and Functions.
