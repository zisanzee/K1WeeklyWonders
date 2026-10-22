# Architecture invariants (never break)

## Games
- Every game = one `src/games/<slug>/` folder + one `GAME_REGISTRY` entry in `src/games/registry.js`. The registry drives routes, catalogue, prefetch and stats labels.
- NEVER hand-add a game `lazy()` import or `<Route>` in `main.jsx`. NEVER edit `GAME_CATALOG` directly.
- A game's `key` / `slug` / `route` / `progressKey` are identity and never change. `logPlaySession({ game })` must equal `progressKey`.
- New game routes use gates in this order: `NameGate` -> `GameAccessGate` -> game.
- A boilerplate is scaffolding only: wiring, no invented mechanic. An unfinished game is named exactly `(in works)` everywhere (meta label/title, `gameLabel`, on-screen heading).
- Audio goes through `@/phaser/common/audioState`. Mute is one shared key, `ezw-muted-v1`; never a per-game mute key.

## Tunables (MANDATORY)
Every adjustable magic number a game reads lives in `src/games/<slug>/tuning.js` (or an existing `<slug>Tuning.js`), never inline in `GameScene.js` / `Game.jsx`. Prefer canvas fractions, group by concern, export a `TUNING` aggregate, import nothing, add a short *why* comment. Identity values (texture keys, `game` slug, event names) are not tuning. Round/curriculum logic goes in `levels.js` / `rounds.js`.

## Domain
- `classType` is DEPRECATED and drives nothing. Key everything on `classId`. Never use the legacy classType-scoped mutators.
- A class only sees games it has `added` from the Catalogue. A scheduled game (`unlockAt` set) is always `unlocked: false`.
- Merged students are never deleted (merges stay reversible). Classes and teachers are soft-retired (`active`), never deleted.

## Auth
- Auth is NOT JWT/session. Every write endpoint re-validates a code against the DB via `requireTeacher` / `requireAdmin` / `requireClassAccess`. `isTeacher` / `isAdmin` in zustand are UI state only, never a security boundary.
- Teachers manage their own class's games (`requireClassAccess`); older "admin-only" docs are wrong.
- Never reintroduce a client-side teacher-code mirror (`src/teacherCodes.js` was deleted; it drifted and locked out new teachers).
- `playerStore` persists ONLY `{ code, name, mode }`. Everything else is runtime-derived. Bump persist `version`/`name` only to force a global re-login.
- The admin's `classId` is `null`: class-scoped code must handle it (`GameAccessGate` lets teachers/admins through before its loading gate).

## Network and state
- `@/api/apiClient.js` is the ONLY source of `API_BASE`, `withQuery`, `fetchWithTimeout`, `requestJson`, `postJson`, `ApiError`. Never redeclare an origin or roll your own timeout (a missing one hung app boot).
- One zustand store per domain, one thin fetch helper per API concern. Extend, don't duplicate.
- `AuthBootstrap` awaits `hydrate()` before render: never add boot-blocking requests.

## Backend (when asked to touch it)
- Every failure returns `{ error }` with non-2xx.
- Read game rows ONLY via `getGameAccessRows()`. Any write that can change `unlockAt` MUST call `invalidateUnlockCache(classId)`. No cron; due unlocks resolve lazily on read.
- Express route order matters: `/api/game-access/order`, `/:gameKey/shiny`, `/:gameKey/schedule` stay above `/:gameKey`.
- Rate-limit ONLY unauthenticated/abuse-prone routes (`code-lookup`, `teacher-login`, `student-login`, `plays`, `feedback`). Never limit authenticated writes (a school NAT shares one IP).
- Mongo: schema edits don't migrate indexes (drop explicitly, then `syncIndexes()`); `unlockAt: null` sorts below every Date (use `{ $ne: null, $lte: now }`); never name a nested key `type`; boot migrations are idempotent and run before `app.listen`; adding an enum value also needs the boot replay path.
