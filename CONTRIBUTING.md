# Contributing

Thanks for taking the time to contribute.

## Ground rules

1. **Security first.** No change may weaken authentication, validation, rate limiting, or rules
   coverage. PRs that do will be asked to add a compensating control.
2. **Secrets never land in git.** Use `.env` files locally; `npm run check:secrets` must stay green.
3. **Tests for behaviour.** New endpoints need unit tests, rules changes need positive _and_
   negative rule tests.
4. Be respectful — see [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Workflow

```bash
git clone https://github.com/hamids-ai-automations/firebase-ai-starter-kit.git
git checkout -b feat/short-description

npm run setup
npm run verify          # must pass before you open a PR
```

## Commit messages

Conventional Commits:

```
feat(chat): stream model tokens to the panel
fix(ai): keep lastMessagePreview out of user messages
docs(readme): document App Check rollout
test(rules): cover cross-user conversation reads
chore(ci): cache npm downloads
```

## Pull requests

- One logical change per PR; keep it reviewable.
- Fill in the PR template: what changed, why, how it was verified, screenshots for UI changes.
- Link the issue it closes.
- CI must pass: secret scan, lint, typecheck, unit tests, rules tests, build.

## Adding an endpoint

1. Add the Zod schema in `functions/src/validation/schemas.ts` (strict, with length caps).
2. Implement the endpoint in `functions/src/endpoints/*` using `createCallableHandler`.
3. Register it in `functions/src/index.ts`.
4. Record usage through `recordUsage` so the cost dashboard stays accurate.
5. Add a unit test and an emulator smoke check.
6. Document the request/response in `docs/api-reference.md`.

## Adding a model

1. Add it to `SUPPORTED_MODELS` in `functions/src/config.ts` (id, label, description).
2. Confirm the id exists in the Gemini API and that `@google/genai` accepts it.
3. Update the client model picker (it reads the enum from the schema) and the docs table.

## Style

- TypeScript strict mode; no `any` in new code.
- Prettier for formatting (`npm run format`), ESLint for semantics.
- Prefer small pure functions in `utils/` over long endpoint bodies.

## Reporting bugs

Use the bug report template and include: expected vs actual, reproduction steps, Node/Firebase CLI
versions, and whether the emulator or production is affected. Never paste secrets or full prompts
containing customer data.
