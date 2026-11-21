# Task ledger

| ID   | Task                                                 | Phase | Status      | Completed  | Files                                                      | Verification          |
| ---- | ---------------------------------------------------- | ----- | ----------- | ---------- | ---------------------------------------------------------- | --------------------- |
| T-01 | Discovery: repo, Firebase project, Marvis site audit | 1     | Done        | 2026-11-20 | —                                                          | Research notes        |
| T-02 | Architecture: data model, rules, endpoint contract   | 2     | Done        | 2026-11-20 | `docs/architecture.md`                                     | Review                |
| T-03 | Core: auth, Firestore services, Gemini endpoints     | 3     | Done        | 2026-11-20 | `apps/web/src`, `functions/src`                            | Unit tests            |
| T-04 | Demo app: six panels                                 | 4     | Done        | 2026-11-20 | `apps/web/src/components`                                  | Manual + tests        |
| T-05 | QA: unit, rules, emulator smoke                      | 5     | Done        | 2026-11-20 | `**/*.test.ts`                                             | CI run 44888117515    |
| T-06 | Docs: README + `docs/` set                           | 6     | Done        | 2026-11-20 | `README.md`, `docs/`                                       | Review                |
| T-07 | GitHub publication + CI                              | 7     | Done        | 2026-11-20 | `.github/workflows`                                        | Green CI              |
| T-08 | Profile integration                                  | 8     | Done        | 2026-11-20 | profile README                                             | Links checked         |
| T-09 | Spark-mode client refactor                           | 9     | Done        | 2026-11-21 | `apps/web/src/lib/api.ts`, `geminiKey.ts`                  | 51 tests, build       |
| T-10 | Firestore + Auth + Hosting site provisioning         | 9     | Done        | 2026-11-21 | `firebase.json`, `.firebaserc`                             | Console state         |
| T-11 | Production deploy (hosting + rules)                  | 9     | Done        | 2026-11-21 | `apps/web/dist`                                            | HTTP 200, QA sweep    |
| T-12 | Marvis landing page rewrite + deploy                 | 9     | Done        | 2026-11-21 | `marvis-site/public/projects/firebase-ai-starter-kit.html` | Live 200, assets 200  |
| T-13 | `docs/FREE_PLAN_DEPLOYMENT.md`                       | 6     | Done        | 2026-11-21 | `docs/FREE_PLAN_DEPLOYMENT.md`                             | Review                |
| T-14 | Final verification report                            | 10    | In progress | —          | `QA_REPORT.md`, `SECURITY_AUDIT.md`                        | This cycle            |
| T-15 | Blaze deployment of `functions/`                     | 10    | Blocked     | —          | —                                                          | Needs billing account |
