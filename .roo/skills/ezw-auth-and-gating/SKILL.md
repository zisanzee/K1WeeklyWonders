---
name: ezw-auth-and-gating
description: Use when touching login, codes, roles or access in EZ Wonders - NameGate, GameAccessGate, MaintenanceGate, playerStore, /api/code-lookup, student QR login (/p/:code), teacher/admin/student/class codes, requireTeacher/requireAdmin/requireClassAccess, isTeacher/isAdmin, or the no-class admin case.
---

# Auth model and gating

## Server is the security boundary
Auth is NOT JWT/session. Every write endpoint re-validates a code against the DB per request via `requireTeacher` / `requireAdmin` / `requireClassAccess` in `server.js`. `isTeacher` / `isAdmin` in zustand are **UI state only**. Never rely on them for security and never skip a server check because the UI hides a button.

- `requireTeacher`: own class info, own roster, own class's games, stats/plays.
- `requireAdmin` (teacher + `role === 'admin'`, else 403): class create/update, `PATCH /api/system/config`, admin stats routes.
- `requireClassAccess`: admin may target any `classId`, teacher only their own. Gates ALL `GameAccess` writes and per-class student merge/unmerge/delete. (Older docs saying game-access is admin-only are wrong.)
- Teacher, class, student and admin codes share ONE global namespace; any create/update that changes a code must call `findCodeOwner()`.

## Login flow
`NameGate.jsx` is code-first: one field, classified by `POST /api/code-lookup` into exactly one of `teacherCode | adminCode | studentCode | classCode`.
- teacher/admin/student code -> signs in immediately.
- classCode -> public class: name prompt (`signInLight`, mode `light`); private class: student-code prompt.
- URL params `?code=`, `?studentCode=`, `?classCode=`, `?teacherCode=` auto-run the flow.
- `hydrate()` re-posts the stored credential to rebuild identity; if it no longer resolves the user is signed out. `AuthBootstrap` awaits it before render.
- QR login: `/p/:code` -> `StudentLogin.jsx` -> `GET /api/student-login/:code`.

## Do not
- Do NOT reintroduce a client-side teacher-code mirror (`src/teacherCodes.js` was deleted because it drifted and locked out new teachers).
- Do NOT persist anything beyond `{ code, name, mode }`.
- Do NOT key behaviour on `classType` (deprecated).

## Gate order (new routes need both)
`NameGate` -> `GameAccessGate` -> game. `GameAccessGate` checks per-game unlock via `useIsGameUnlocked`, re-fetches if data isn't loaded for the current classId, and lets teachers/admins through **before** its loading gate (the admin has no `classId` and would spin forever). Any new class-scoped component must handle `classId === null` gracefully (e.g. `NextGameTimer` self-hides).

## Maintenance mode
`MaintenanceGate` overlays the app when `SystemConfig.maintenanceMode` is on. Public, read-only pages that must stay reachable (like `/teacher-onboarding`) are listed in `PUBLIC_DURING_MAINTENANCE`. New public pages that teachers need during an outage go there too.

## Student privacy
Kids' names and play data are class-scoped. Never log names/codes to console in production paths, never put them in URLs other than the existing `/p/:code`, and never add third-party analytics.
