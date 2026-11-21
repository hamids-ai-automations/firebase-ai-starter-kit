# Project state

Schema: 1 · Updated: 2026-11-21 · Owner: Muhammad Hamid

## Snapshot

| Field                | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| Repository           | `hamids-ai-automations/firebase-ai-starter-kit` (public, MIT) |
| Current phase        | Phase 9–10 complete; long-term maintenance                    |
| Deployment mode live | Spark (client-side Gemini, no billing)                        |
| Live app             | <https://fb-ai-starter-kit.web.app>                           |
| Portfolio page       | <https://marvis.web.app/projects/firebase-ai-starter-kit>     |
| CI                   | Green on `main` (Node 22 + 24 matrix, rules job)              |
| Open blockers        | Blaze deployment of `functions/` (needs billing account)      |

## Done

- Auth, Firestore, Gemini text/structured/chat endpoints, six-panel demo UI.
- Owner-scoped Firestore rules with field allow-lists; rules deployed to production.
- Client-side API implementation so the default build runs on Spark.
- 51 unit tests, lint, typecheck, production build all green.
- Hosting site `fb-ai-starter-kit` created and released; deep links and SPA fallback verified.
- Documentation set: `README`, `docs/*` (architecture, setup, api-reference, security, testing,
  deployment, examples, troubleshooting) plus `docs/FREE_PLAN_DEPLOYMENT.md`.
- Portfolio landing page rewritten with real screenshots, structured data and live demo link.

## In progress

- Keeping the two API implementations (`client` / `callable`) in sync as features land.

## Next actions

1. Add App Check and a CSP header.
2. Publish a `v1.0.0` GitHub release referencing the live demo.
3. Deploy the Blaze variant when a billing account is available; document the delta.
4. Add streaming responses to the client implementation (fetch + ReadableStream).

## Recovery notes

If this session is interrupted: the deployed release is immutable and listed under
`firebase hosting:releases:list --site fb-ai-starter-kit`; `git status` in the repository shows any
uncommitted documentation work; `DEPLOYMENT_STATUS.md` carries the authoritative infra values.
