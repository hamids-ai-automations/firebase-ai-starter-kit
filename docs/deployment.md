# Deployment

> Deployment is deliberately manual. The repository never deploys on push; every production release
> is an explicit, reviewed action.

## Preconditions

- [ ] Blaze plan enabled (Functions v2 requirement)
- [ ] `.firebaserc` points at the target project
- [ ] `firebase login` completed with an account that has Editor/Owner on the project
- [ ] `GEMINI_API_KEY` secret created
- [ ] `npm run verify` green locally or in CI

## One-time setup

```bash
firebase login
firebase use --add                     # choose the project, alias it as "default"
firebase functions:secrets:set GEMINI_API_KEY
firebase apps:list                     # confirm the web app id used by .env
```

## Release steps

```bash
git pull
npm run setup
npm run verify

# 1. rules and indexes first (safe to run before functions)
firebase deploy --only firestore:rules,firestore:indexes

# 2. functions
firebase deploy --only functions

# 3. hosting (serves apps/web/dist via the "web" target)
npm --prefix apps/web run build
firebase deploy --only hosting
```

Or, once you are confident, `npm run deploy` (which builds then deploys functions and hosting), still
requiring the approval described below.

## Post-deploy verification

```bash
# health probe
curl -s https://<region>-<project>.cloudfunctions.net/apiHealth

# hosting headers
curl -sI https://<project>.web.app | findstr /i "x-frame-options x-content-type-options"

# callable smoke (authenticated, from the deployed app)
npm run test:live        # uses the real key; asserts a non-empty model response
```

Then open the app, sign in, and check the Usage panel records the request.

## App Check rollout

1. Register the production domain in **App Check → reCAPTCHA Enterprise**.
2. Add `VITE_APPCHECK_SITE_KEY` to the build environment and redeploy hosting.
3. Watch App Check metrics for 1–2 weeks (monitoring mode).
4. **App Check → APIs → Cloud Functions → Enforce** once verified metrics dominate.

## Rollback

| Artefact  | Rollback                                                                             |
| --------- | ------------------------------------------------------------------------------------ |
| Hosting   | `firebase hosting:rollback` (previous release) or redeploy the last good commit      |
| Functions | Deploy the previous commit: `git checkout <sha> && firebase deploy --only functions` |
| Rules     | Deploy the previous commit's `firestore.rules`; rules are versioned in git           |
| Secret    | `firebase functions:secrets:set GEMINI_API_KEY` with the old key, then redeploy      |

Because rules are additive in practice, ship rule relaxations _before_ the code that needs them, and
rule tightenings _after_ the code no longer produces the old shape.

## Cost guardrails

- Set a budget alert on the GCP project (Billing → Budgets).
- Keep `maxInstances` low (10 global, 5 for `apiHealth`) to bound fan-out.
- Rate limits are the primary cost control: 20 AI requests per minute per user by default.
- Consider App Check enforcement plus a per-plan quota stored in Firestore for public launches.

## CI/CD (optional)

The repository ships CI (lint/typecheck/test/build) but not CD. If you want automated deploys, add a
workflow that:

1. authenticates with `FIREBASE_SERVICE_ACCOUNT_<PROJECT>` (a JSON key stored as a GitHub secret),
2. runs `npm run verify`,
3. deploys rules → functions → hosting,
4. runs `npm run test:live` as a gate.

Keep the deploy job behind a manual `workflow_dispatch` trigger and a protected environment so a
merge alone never reaches production.
