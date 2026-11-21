# Development log

## 2026-11-21 — Spark deployment and portfolio launch

- Refactored `apps/web/src/lib/api.ts` from `httpsCallable` to browser-side Gemini REST calls,
  keeping the exported function names and error envelope intact; added `lib/geminiKey.ts`
  (session-scoped key storage) and a Setup panel.
- Rewrote `api.test.ts` for the new error shape (`gemini-key-missing`); 51 unit tests green.
- Hardened `firestore/firestore.rules` for the client-write model (owner checks, field allow-lists,
  append-only messages and usage events).
- Added `.firebaserc` binding `my-1st-web-app-ef52d` and the `web` hosting target to the new site
  `fb-ai-starter-kit`.
- Provisioned infrastructure on the Spark plan: Firestore `(default)` in `asia-south1`,
  Email/Password auth, default web app.
- Deployed `hosting:web` and `firestore:rules`; verified clean-URL routing and SPA fallback and ran a browser QA sweep
  (0 console errors, 6 panels, sign-up flow) capturing production screenshots.
- Rewrote the Marvis project page with real screenshots, `SoftwareApplication` / `WebPage` /
  `BreadcrumbList` / `Person` structured data, live demo CTA and honest roadmap; deployed the
  portfolio site.
- Added `docs/FREE_PLAN_DEPLOYMENT.md`, `PROJECT_STATE.md`, `TASK_LEDGER.md`, `QA_REPORT.md`,
  `SECURITY_AUDIT.md`; refreshed `DEPLOYMENT_STATUS.md` and README deployment sections.

## Earlier

- CI remediation cycle: ignore-rule fix for `apps/web/src/lib`, `firebase-tools` install in the rules
  job, Linux lockfile platform bindings, Node matrix raised to 22/24, explicit Firebase types in
  transaction callbacks, functions pre-built before emulator smoke tests. Result: green CI on `main`.
