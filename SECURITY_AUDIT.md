# Security audit

Scope: Spark-mode deployment (client-side Gemini calls) of the Firebase AI Starter Kit.
Date: 2026-11-21.

## Threat model deltas for Spark mode

| Risk | Spark mode exposure | Mitigation in this repository |
| --- | --- | --- |
| API key disclosure | The **user's** key is readable by that user, by definition | Key is entered per session, held in `sessionStorage`, never sent anywhere except Google, never written to Firestore, never committed |
| Project owner's key leaking | Would happen if a key were put in `VITE_*` | No key is configured in `.env.production`; docs state `VITE_*` values are public |
| Cost abuse | Attacker with a stolen user session can spend that user's quota | Usage is metered per user in `usage_events`; Blaze mode adds transactional per-minute limits |
| Cross-tenant reads | Firestore is the only shared surface | Every document lives under `users/{uid}` with `request.auth.uid == uid`; catch-all denies the rest |
| Malformed model output | A prompt-injected response could break the UI | Structured output is re-validated with Zod before reaching React; text output is rendered as text, not HTML |
| Rule drift | Rules edited in console only | Rules are versioned in git and deployed from CI/manual runbook |

## Controls verified

- **Authentication required.** No Firestore path is readable without `request.auth`.
- **Owner-scoped access.** `isOwner(uid)` compares the path uid against the token uid; `list` requires
  the same condition, so collection queries cannot enumerate other users.
- **Field allow-lists.** Message and usage writes accept only the documented key set, with length caps
  (8,000 chars for message text, 2,000 for secure-echo payloads) and enum checks on `role`/`priority`.
- **Immutability.** `usage_events` and messages are append-only; updates and deletes are denied where
  the app does not need them.
- **Hosting headers.** `firebase.json` sets `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and long-lived
  immutable caching for hashed assets only.
- **No secrets in the repository.** `.env*`, service-account JSON and key files are git-ignored and
  scanned by `npm run check:secrets` in CI.
- **Public API key is public by design.** The Firebase web API key identifies the project; the audit
  confirms access is gated by rules and Auth, not by that key's secrecy. A referrer restriction is
  recommended in `docs/FREE_PLAN_DEPLOYMENT.md` §6.

## Outstanding recommendations

1. Enable **App Check** (reCAPTCHA v3/Enterprise) on Auth and Firestore; Spark allows it and it closes
   the scripted-abuse gap left by the absent server tier.
2. Add a **Content-Security-Policy** header allowing `https://generativelanguage.googleapis.com`,
   `https://*.googleapis.com` and `https://*.firebaseio.com`, then remove `unsafe-inline` needs.
3. If the demo is opened to the public, add a **budget alert** and per-user daily caps before switching
   any shared key into the deployment.
4. Move to **Blaze mode** if server-side key custody, rate limiting or App Check enforcement on
   Functions become requirements.
