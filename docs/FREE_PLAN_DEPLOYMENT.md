# Free-plan (Spark) deployment guide

This guide deploys the starter kit **without a billing account**: Firebase Hosting + Firestore +
Authentication only. Cloud Functions stay in the repository as the optional Blaze-mode path and are
never deployed here.

Verified end to end on 2026-11-21 against a Spark project — the result is live at
<https://fb-ai-starter-kit.web.app>.

---

## 1. What Spark mode is (and is not)

| | Spark mode (this guide) | Blaze mode (`functions/`) |
| --- | --- | --- |
| Gemini calls | Browser → `generativelanguage.googleapis.com/v1beta` with the **user's own key** | Cloud Functions 2nd gen with server-only secret |
| API key location | `sessionStorage` of the current tab, supplied in the Setup tab | Functions secret `GEMINI_API_KEY` |
| Billing account | Not required | Required |
| Server-side rate limiting | Not available — usage is metered client-side into `usage_events` | Transaction-based per-minute limits |
| App Check | Optional, add `VITE_APPCHECK_SITE_KEY` | Recommended and enforceable |
| Code path | `apps/web/src/lib/api.ts` (client implementation) | Same module, callable implementation |

Both modes expose the same function names (`generateText`, `generateStructured`, `chat`,
`deleteConversation`, `ensureProfile`, `updateProfile`, `secureEcho`, `usageSummary`), so an
application built on one mode moves to the other by changing the API module, not the UI.

**Security consequence you must accept in Spark mode:** the Gemini key belongs to the end user and
is visible to them. Never ship your own key in `VITE_*` variables — anything in a `VITE_` variable is
inlined into the public bundle and readable by anyone who loads the site.

## 2. Prerequisites

- Node.js 22.x or 24.x and npm 10+
- Firebase CLI: `npm i -g firebase-tools` (or `npx firebase-tools`)
- A Google account with access to the Firebase console
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) — for testing only;
  users supply their own

## 3. Create the Firebase project (Spark)

1. <https://console.firebase.google.com> → **Add project** → name it, keep Google Analytics optional.
2. Do **not** upgrade the plan. The project stays on Spark; no card is required.

## 4. Authentication

1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable → Save**.
3. Optional: enable *Email link* or Google if you want those buttons wired.

Firebase creates a **Default Web App** automatically when a web app is registered; its config feeds
step 6.

## 5. Firestore

1. **Build → Firestore Database → Create database**.
2. Choose **production mode** (rules come from this repository, so nothing is readable until you
   deploy them).
3. Pick a location. `asia-south1` (Mumbai) was used for this deployment — closest to the target
   audience and inside the free tier.
4. Leave the free tier alone: no backups, no extra indexes beyond `firestore/firestore.indexes.json`.

Deploy the rules:

```bash
firebase deploy --only firestore:rules
```

Spark supports rules, indexes, the emulator and read/write quotas; it does **not** support Cloud
Functions, Cloud Storage provisioning for functions, or scheduled functions.

## 6. Register the web app and capture its config

**Project settings → General → Your apps → Web (`</>`)** → register the app (e.g. `starter-kit-web`).
Copy the `firebaseConfig` values into `apps/web/.env.production`:

```dotenv
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_APP_ID=1:...:web:...
VITE_GEMINI_MODEL=gemini-2.5-flash
VITE_USE_EMULATORS=false
```

The Firebase web API key is a **public** identifier, not a secret — it is safe in the bundle. Access
control comes from Firestore rules and Auth, not from hiding that key.

Then harden it in **Google Cloud console → APIs & Services → Credentials → browser key** by adding an
HTTP referrer restriction for your domains (`*.web.app`, `*.firebaseapp.com`, your custom domain).
Also confirm **API restrictions** allow only *Identity Toolkit*, *Firestore* and *Token Service*.

## 7. Build

```bash
npm ci
npm run build:web          # outputs apps/web/dist
```

The build fails on type errors by design (`tsc -b` runs first). Expected output: one JS bundle of
roughly 0.9 MB uncompressed, well under the Hosting limits.

Sanity check before uploading — the bundle must contain the project id and must not contain any
callable references:

```bash
grep -c "<project-id>" apps/web/dist/assets/*.js     # >= 1
grep -c "httpsCallable" apps/web/dist/assets/*.js    # 0
```

## 8. Hosting: a dedicated site, without touching existing ones

Multi-site Hosting is available on Spark. This keeps the demo on its own origin while an existing
site in the same project stays untouched:

```bash
firebase hosting:sites:create fb-ai-starter-kit     # site id, becomes fb-ai-starter-kit.web.app
firebase target:apply hosting web fb-ai-starter-kit
```

`firebase.json` in this repository is already wired:

```json
{ "hosting": { "target": "web", "public": "apps/web/dist", "cleanUrls": true } }
```

`.firebaserc` binds the target:

```json
{
  "projects": { "default": "<project-id>" },
  "targets": { "<project-id>": { "hosting": { "web": ["fb-ai-starter-kit"] } } }
}
```

Deploy:

```bash
firebase deploy --only hosting:web
```

Because the target is explicit (`hosting:web`), a `firebase deploy` can never overwrite another
site's release in the same project.

## 9. Caching and SPA routing

`cleanUrls` is on and Firebase serves `index.html` for unknown paths, so deep links resolve. The build
emits content-hashed asset names; `firebase.json` sets `Cache-Control: public, max-age=31536000,
immutable` for hashed assets. Keep `index.html` at `no-cache` if you add a header rule, otherwise a
stale shell can reference deleted hashes after a deploy.

## 10. Post-deploy verification

```bash
curl -sI https://fb-ai-starter-kit.web.app | head -1        # HTTP/2 200
curl -s  https://fb-ai-starter-kit.web.app | grep -c root   # SPA shell present
```

Then, in the browser:

1. Sign-up with a throwaway email → the dashboard renders with six tabs (Text, Structured, Chat,
   Profile, Security, Setup).
2. Leave the Setup tab empty → AI actions fail with `gemini-key-missing` and a pointer to the Setup
   tab. That is the expected Spark behaviour, not a bug.
3. Paste a personal Gemini key into Setup → text, structured and chat panels call Gemini directly.
4. Profile → *AI usage* shows the event count read through a Firestore `count()` aggregation.
5. Security → *Write through the rules* proves the rules accept a valid payload and reject an
   over-long or wrong-owner one.

Verified on 2026-11-21: 0 console errors, 0 failed requests across all six panels after sign-up.

## 11. Rollback

```bash
firebase hosting:releases:list --site fb-ai-starter-kit
firebase hosting:rollback --site fb-ai-starter-kit
```

Rollback is instant because releases are immutable. Firestore rules are versioned separately —
re-deploy the previous `firestore.rules` from git history with `firebase deploy --only firestore:rules`.

## 12. Cost and quota posture

| Resource | Free-tier behaviour | Guardrail in this repo |
| --- | --- | --- |
| Hosting | 10 GB storage, 360 MB/day transfer | Single ~0.9 MB bundle, immutable caching |
| Firestore | 1 GiB storage, 50k reads / 20k writes / 20k deletes per day | Per-user paths, capped message text (8k), usage aggregation via `count()` |
| Authentication | Email/password included, generous MAU | No verification emails required for demo accounts |
| Gemini | Billed to whoever owns the key | Users bring their own key; nothing is billed to the project owner |

## 13. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `auth/unauthorized-domain` | Domain not allowlisted | Authentication → Settings → Authorized domains → add the site host |
| `auth/invalid-api-key` | `VITE_FIREBASE_*` wrong or stale build | Fix `.env.production`, rebuild, redeploy |
| Blank page after deploy | `public` path points at the wrong directory | `firebase.json` → `apps/web/dist` |
| `Missing or insufficient permissions` | Rules not deployed to the right project | `firebase use <project>` then `firebase deploy --only firestore:rules` |
| `gemini-key-missing` | No key in the Setup tab | Expected in Spark mode until the user adds one |
| `403 API key not valid` from Gemini | Key restricted to a different referrer | Relax the key's HTTP referrer restriction in Google Cloud |
| Deploy overwrote another site | Target not set | Always deploy `hosting:web`; check `firebase target:apply` |

## 14. What this mode intentionally does not give you

- Server-side rate limiting and abuse protection (use App Check plus per-user quotas in Blaze mode).
- A hidden key: the user's key is in their own browser by definition.
- Admin-only writes: everything in `usage_events` is written by the authenticated owner.
- Streaming responses: the client implementation is request/response only.

If any of those are hard requirements, deploy the `functions/` variant on Blaze — the UI does not
change.
