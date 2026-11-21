# Troubleshooting

## Authentication

**`auth/invalid-api-key`**
The web build has no Firebase config. `apps/web/.env.local` must contain all six `VITE_FIREBASE_*`
values; restart Vite after editing (Vite inlines them at build time).

**`auth/operation-not-allowed`**
Email/Password is not enabled in the console → Authentication → Sign-in method.

**`auth/unauthorized-domain`**
Add `localhost` and your production domain under Authentication → Settings → Authorized domains.

**Signed in but the dashboard says "unauthenticated" when calling functions**
The Functions emulator is not running, or `VITE_USE_EMULATORS` is false while the functions are not
deployed. Check `getFunctions()` region matches `FUNCTIONS_REGION`.

## Firestore

**`permission-denied` writing preferences**
Only whitelisted fields are writable by clients; counters and timestamps belong to the server. Use
`updateUserProfile` instead of writing directly.

**`permission-denied` on `usage/*`**
By design — usage counters are written only by Cloud Functions.

**Missing index error**
Copy the URL from the error message, or deploy `firestore.indexes.json`; indexes take a minute to
build.

## Functions and the emulator

**`Could not start Firestore Emulator ... Java version`**
The emulator needs Java 21+. Install a JDK 21 and set `JAVA_HOME`. On Windows without an installer:

```powershell
# portable JDK 21 into a temp folder
curl.exe -L -o "$env:TEMP\jdk21.zip" https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.zip
Expand-Archive "$env:TEMP\jdk21.zip" "$env:TEMP\jdk21" -Force
$env:JAVA_HOME = (Get-ChildItem "$env:TEMP\jdk21" -Directory | Select-Object -First 1).FullName
```

**Functions emulator returns `internal` on every AI call**
`GEMINI_API_KEY` is not visible to the emulator. Put it in `functions/.env`:

```dotenv
GEMINI_API_KEY=...
```

or run with `AI_MOCK_MODE=true` to bypass the model entirely.

**`unavailable` on the first call**
Cold start. Retry; the emulator prints the endpoint URL once it is ready.

**`resource-exhausted` while developing**
You hit the 20/min window. Wait 60 s, or set `AI_RATE_LIMIT_MAX_REQUESTS=200` in the emulator env.

## Build and tooling

**`npm ci` fails with EBADENGINE**
The Functions runtime is Node 22; some transitive packages warn on Node 20. Warnings are harmless. If
the install aborts, use Node 22 (`.nvmrc` friendly) and re-run.

**Windows: `EPERM` / `EBUSY` while installing**
A leftover link or a running dev server holds files. Stop Vite/the emulator, then
`npm --prefix functions ci` again.

**Port already in use (8080 / 9099 / 5001 / 4000)**
Stop the previous emulator instance: `firebase emulators:start` refuses to start twice.

**`firebase: command not found`**
Use `npx firebase-tools` or install globally (`npm i -g firebase-tools`).

## Deployment

**`HTTP Error: 403 ... permission`**
The CLI account lacks Editor/Owner, or the project is still on Spark (Functions v2 needs Blaze).

**Deploy fails on `functions[aiChat]` secret**
Run `firebase functions:secrets:set GEMINI_API_KEY` **before** deploying, and confirm the secret name
matches the one bound in code.

**Hosting serves the old bundle**
`index.html` is served with `no-cache`, but CDN edges can lag. Re-deploy and hard-refresh; confirm the
build hash in `apps/web/dist/assets/*` matches the live HTML.

**`permission-denied` right after deploying tighter rules**
Rules deploy before code. Roll the rules back one revision, deploy the code, then re-apply.

## Useful diagnostics

```bash
firebase projects:list
firebase apps:list
firebase functions:secrets:access GEMINI_API_KEY --project <id>   # prints only a prefix hint
firebase emulators:start --only auth,firestore,functions --inspect-functions
node scripts/check-secrets.mjs
```
