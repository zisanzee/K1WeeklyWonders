---
name: ezw-backend-server
description: Use for any change to the Node/Express/Mongoose backend of EZ Wonders (D:\K1 games project\server) - server.js routes, middleware, rate limits, models, boot migrations, indexes, Mongo queries, CORS/helmet/Render deployment, or when the frontend needs a new API endpoint.
---

# Backend (`D:\K1 games project\server`)

## Repo reality
- The server is a **sibling folder outside the frontend workspace** (`d:/Phaser/games`). Workspace-relative tools cannot reach it; use the absolute path or `cd`. Edits there are NOT part of the frontend repo, and a server change is not testable from the frontend workspace. Say so explicitly when you change it.
- Docs drift (including `.roorules` and `PROJECT_CONTEXT.md`). **Read the real `server.js` and `models/*.js` before trusting any spec.**
- Leave alone unless asked: `server/IMPLEMENTATION_PROMPT.md`, `server/SETUP.md`, `server/logPlaySession.js` (stale unused copy).
- Stack: Express 4, Mongoose 8, CommonJS, nodemon. Deployed on Render + MongoDB Atlas.

## Routes
- Every failure returns `{ error: '...' }` with a non-2xx status.
- Express matches in registration order: `/api/game-access/order`, `/:gameKey/shiny`, `/:gameKey/schedule` MUST stay above `/api/game-access/:gameKey`.
- Pick the right guard: `requireTeacher`, `requireAdmin`, or `requireClassAccess` (admin any class, teacher own). Validate `classId` with `requireClass` (400 if unknown).
- Reading game rows: ALWAYS through `getGameAccessRows(classId)`; never query `GameAccess` directly on a read path (see skill `ezw-scheduled-unlocks`).
- Lists: use `parseListParams` (clamps `limit`, whitelists sort keys) and `escapeRegex`; add sort keys only via the `SUMMARY_SORT_KEYS` / `PLAYS_SORT_KEYS` whitelists.

## Rate limits and middleware
- Rate limit ONLY the unauthenticated/abuse-prone routes: `code-lookup`, `teacher-login`, `student-login`, `plays`, `feedback`.
- Do NOT add limits to authenticated write paths: a whole class bursts `/api/plays` and a per-IP cap would throttle everyone behind one school NAT.
- Per-IP limits require `app.set('trust proxy', 1)` behind Render.
- Existing globals: `compression`, `helmet` (CSP off, cross-origin resource policy `cross-origin`), `express.json({ limit: '100kb' })`, `Cache-Control: no-store` on `/api`, 15 s hard timeout -> 504, CORS allow-list from `ALLOWED_ORIGINS`.

## Mongoose / Mongo gotchas
- Never name a nested subdoc key literally `type` (Mongoose reads it as a type declaration). Hence `PlaySession.device.kind`.
- Schema edits do NOT migrate indexes. Drop the old index explicitly, then `syncIndexes()`.
- `GameAccess` unique index is `{classId, gameKey}` with `partialFilterExpression: { classId: { $exists: true } }`. The partial filter is load-bearing (legacy `classType`-only backup rows must not collide).
- `unlockAt: null` sorts below every Date: filter with `{ $ne: null, $lte: now }`.
- Adding an enum value (e.g. a role): update the model enum AND the boot replay path that applies it to existing documents.
- Keep `bufferCommands: false` and tight `serverSelectionTimeoutMS` (avoids silent hangs on Render/Atlas cold starts).
- Soft-delete / soft-retire: `ClassInfo.active`, `Teacher.active`, `GameAccess.added:false`. Merged students are never deleted (merge must stay reversible).

## Boot migrations
Run in the `mongoose.connect().then()` chain **before `app.listen`**, must be self-guarding and idempotent (check the new field is absent / the old present). Order: `ensureSystemConfig` -> `migrateAdminRole` -> `migrateClassFields` -> `migrateGameAccessToClassId` -> `migrateStudentCodes` / `auditCodeConflicts` -> `syncIndexes()`. Append new migrations in a sensible position; never reorder existing ones.

## Env
`MONGODB_URI`, `PORT`, `ALLOWED_ORIGINS`, `ADMIN_CODE`. Never commit secrets; never log codes.

## After a change
Tell the user whether the server needs a redeploy and whether the frontend needs a matching change. A new game never needs a server redeploy.
