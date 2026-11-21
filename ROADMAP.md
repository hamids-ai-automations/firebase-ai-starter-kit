# Roadmap

## Shipped

- v1.0.0 surface: authentication, owner-scoped Firestore model, Gemini text / structured / chat
  endpoints, six-panel demo application.
- Emulator-first workflow: unit tests, rules tests, end-to-end smoke checks, CI on Node 22/24.
- Documentation set under `docs/`.
- **Live Spark-plan deployment** — <https://fb-ai-starter-kit.web.app> (2026-11-21).
- Portfolio landing page with real screenshots and structured data (2026-11-21).

## Next (v1.1)

- App Check enforcement runbook plus a CSP header for the demo origin.
- Streaming responses in the client implementation (`fetch` + `ReadableStream`).
- Conversation search using a Firestore token index (no external vector store).
- Quota tiers (free/pro per user) enforced in both modes.

## Later (v1.2+)

- Deploy the Blaze variant and document the client → callable switch end to end.
- Multi-vendor model routing (Gemini + one alternative) behind the same contract.
- Embeddings + retrieval sample on Firestore vector search.
- Usage export (CSV) with cost projection.

## Non-goals

- A general-purpose CMS or admin panel.
- Storing user prompts for analytics.
- Shipping a shared project-wide Gemini key in any client bundle.
