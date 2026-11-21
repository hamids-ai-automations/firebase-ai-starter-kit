# Setup

## 0. Checklist

- [ ] Node.js 20.19+ (22.x recommended) and npm 10+
- [ ] Java 21 (Firestore emulator)
- [ ] Firebase CLI (`npm i -g firebase-tools`)
- [ ] A Firebase project (Blaze plan for Functions v2)
- [ ] A Gemini API key

## 1. Clone and install

```bash
git clone https://github.com/hamids-ai-automations/firebase-ai-starter-kit.git
cd firebase-ai-starter-kit
npm run setup
```

`npm run setup` runs `npm install` in `apps/web` and `functions`. If you prefer explicit steps:

```bash
npm --prefix apps/web install
npm --prefix functions install
```

## 2. Create the Firebase project

1. Open the [Firebase console](https://console.firebase.google.com/) → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database → Production mode** (rules are deployed from the repo).
4. **Project settings → Your apps → Web (`</>`)** → register the app and copy the config object.

## 3. Wire the project id

```bash
cp .firebaserc.example .firebaserc
```

```json
{
  "projects": { "default": "your-project-id" },
  "targets": {
    "your-project-id": {
      "hosting": { "web": ["web"] }
    }
  }
}
```

The `targets` block is what lets `firebase deploy --only hosting` publish the `web` target defined in
`firebase.json`.

## 4. Configure the web app

```bash
cp .env.example apps/web/.env.local
```

Fill in the six `VITE_FIREBASE_*` values from the console snippet. For emulator work add:

```dotenv
VITE_USE_EMULATORS=true
```

## 5. Add the Gemini secret

```bash
firebase login
firebase use your-project-id
firebase functions:secrets:set GEMINI_API_KEY
```

Paste the key when prompted. It is stored in Secret Manager and bound to the functions through
`secrets: [GEMINI_API_KEY]` in the endpoint options — it is never written to `.env` in production.

## 6. Run everything locally

Terminal A:

```bash
npm run emulators
```

Terminal B:

```bash
npm run dev
```

Open http://localhost:5173, sign up with any email (the Auth emulator accepts fake addresses), and the
dashboard panels become available.

### Mock mode

Without a Gemini key the emulator can still exercise the full path:

```bash
# .env in the repo root
AI_MOCK_MODE=true
```

Mock mode is honoured **only** when `FUNCTIONS_EMULATOR` is set, so it cannot leak into production.

## 7. Verify the installation

```bash
npm run verify          # secrets scan + lint + typecheck + unit tests + build
npm run test:rules      # needs Java 21 and a free emulator port
npm run test:emulator   # needs the emulator suite; uses the demo project id
```

All three should pass on a clean checkout.

## 8. Optional: App Check

1. **Build → App Check → Web app → reCAPTCHA Enterprise** → register your domain.
2. Put the site key in `VITE_APPCHECK_SITE_KEY`.
3. The SDK is registered automatically by `lib/firebase.ts` when the key is present.

Keep App Check in _monitoring_ mode until the dashboard reports healthy traffic, then enable
enforcement.

## 9. Project layout after setup

```
firebase-ai-starter-kit/
  apps/web/            React + Vite client
  functions/           Cloud Functions (TypeScript)
  firestore/           rules + indexes
  scripts/             dev orchestrator, secret scanner, emulator smoke test
  docs/                documentation and screenshots
  firebase.json        hosting / functions / emulator config
  .firebaserc          project alias (git-ignored after you edit it)
```
