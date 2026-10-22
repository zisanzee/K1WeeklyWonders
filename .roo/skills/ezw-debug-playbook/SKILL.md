---
name: ezw-debug-playbook
description: Use when something is broken in EZ Wonders - CORS errors, "lazy element type is invalid", manualChunks errors, blank screen, stale chunk or dynamic import failures, game won't unlock or shows wrong state, login loops, slow first load, plays not logged, Mongo index or duplicate key errors, Render cold-start hangs, or lint/build/audit failures.
---

# Known failure modes and fixes

Start by reproducing, read the actual error, then match below. Prefer the root cause over a workaround.

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser shows a **CORS error** to the API | Frontend `.env` untracked/missing, so `VITE_API_BASE_URL` fell back to `http://localhost:4000` (misleading CORS message). Or the server's `ALLOWED_ORIGINS` lacks the origin | Keep frontend `.env` committed (public API origin only). Check the Network request URL first, then `ALLOWED_ORIGINS` |
| "Lazy element type is invalid" / module has no default export | A content file (e.g. `teacherOnboarding.js`) differs from the component (`TeacherOnboarding.jsx`) only by case; extension-less import resolves to the wrong file on Windows/macOS | Never rename the content file; use `teacherOnboardingContent.js`. Check default exports of lazy modules |
| Build: "manualChunks is not a function" | Rollup object-form `manualChunks` under Vite 8/rolldown | Use the function form in `vite.config.js` |
| "Failed to fetch dynamically imported module" after deploy | Stale chunk from an old service worker/cache | `src/pwa/staleChunkRecovery.js` should recover; verify it isn't bypassed; hard reload to confirm |
| App hangs on blank at boot | A network call without timeout blocking `AuthBootstrap` `hydrate()` | All calls via `@/api/apiClient.js` (`fetchWithTimeout`); never add boot-blocking requests |
| Login loops / signed out unexpectedly | `hydrate()` can't resolve credential (user removed, code changed, API down); persist `version` bump | Inspect `ezwonders-player` in localStorage and `/api/code-lookup` response. Persist only `{code,name,mode}` |
| Admin spinner forever on a game | Class-scoped code assumes a `classId` (admin has none) | Let teacher/admin pass `GameAccessGate` before the loading gate; guard null classId |
| Scheduled game didn't unlock / unlocked early | Read path bypassed `getGameAccessRows()`; missing `invalidateUnlockCache(classId)`; due filter used bare `$lte` | See skill `ezw-scheduled-unlocks` |
| New game missing from a class | Not added from Catalogue (needs `added:true` row) | Add via Catalogue tab; no server change needed |
| Game shows but wrong title/label | Registry `meta`, `GamePage` `gameLabel`, on-screen heading disagree | Align all; ensure the name is unique |
| Plays not appearing in stats | `game` slug != registry `progressKey`; `POST /api/plays` rate-limited/failing (only `console.warn`) | Check Network + console; fix slug |
| Mongo `E11000 duplicate key` on GameAccess | Old unique index on `{classType,gameKey}` still present, or partial filter missing | Drop old index explicitly, then `syncIndexes()` (schema edits don't migrate indexes) |
| Unscheduled rows treated as due | `unlockAt: null` sorts below every Date; query used `$lte` only | Use `{ $ne: null, $lte: now }` |
| Mongoose subdoc field silently wrong | Nested key literally named `type` | Rename (e.g. `device.kind`) |
| Server hangs on cold start | Atlas/Render cold; buffering | Keep `bufferCommands: false`, tight `serverSelectionTimeoutMS`, rely on `/api/health` warm-up; frontend shows cached grid |
| Whole class throttled / 429 on plays | Per-IP limit behind school NAT | Don't add limits to authenticated write paths |
| `npm audit` fails in CI | New transitive advisory | `npm audit fix` (lockfile only); never lower the gate |
| `npm test` fails for every suite | Environmental Vitest runner issue here | Don't touch unrelated code; trust lint + build |
| Audio doesn't play / plays twice | Started before user gesture; mute key duplicated; no dedupe | Start after first tap; use `audioState` and `ezw-muted-v1` only |
| Green box texture in Phaser | Wrong key/URL in `assets.js` or asset not in manifest | Check manifest and `public/` path |

## Method
1. Reproduce and capture the exact error + Network request.
2. Read the relevant real file (docs drift, including `.roorules` and `PROJECT_CONTEXT.md`; server truth is `server.js` and `models/*.js` in the sibling folder).
3. Fix the root cause with the smallest change; add a Vitest test if the bug was in pure logic.
4. Re-run lint + build (skill `ezw-verify-and-playtest`) and say what you could not verify.
