# Roadmap

## Now (v1.0)

- [x] Secure callable surface with validation, rate limits, and typed errors
- [x] Gemini text, chat, and structured output behind a provider interface
- [x] Per-user Firestore model with tested rules
- [x] Emulator-first workflow with mock AI mode
- [x] Documentation set and CI

## Next (v1.1)

- [ ] **Streaming responses** via `onCall` + SSE bridge or callable streaming, with the chat panel
      rendering tokens as they arrive
- [ ] **App Check enforcement runbook** with metrics screenshots and a rollback path
- [ ] **Conversation search** using a Firestore token index (no external vector store)
- [ ] **Quota tiers** — free/pro limits stored per user, enforced in the same middleware
- [ ] **i18n** for the demo UI (EN / UR)

## Later (v1.2+)

- [ ] Multi-vendor routing (Gemini + a second provider) selected per request by policy
- [ ] Embeddings + retrieval sample on Firestore vector search
- [ ] Usage export (CSV) and a cost projection chart
- [ ] Optional Stripe-backed billing sample
- [ ] Hosted live demo with seeded data

## Non-goals

- A general-purpose CMS or admin panel
- Storing user prompts in analytics
- Client-side model calls of any kind
