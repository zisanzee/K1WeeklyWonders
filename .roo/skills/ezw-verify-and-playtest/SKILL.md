---
name: ezw-verify-and-playtest
description: Use before declaring any EZ Wonders task finished, and when lint, build, Vitest or the CI npm audit gate fails - the checks to run, a manual playtest checklist for games and pages, how to report results, and how to fix audit failures without lowering the gate.
---

# Verify and playtest before done

## 1. Automated checks (always)
1. `npm run lint` -> **0 errors**.
2. `npm run build` -> passes (Vite 8). Watch for alias/chunking errors.
3. `npm test` (Vitest, pure logic only). **Known environmental issue:** here it can fail for ALL suites for an unrelated runner reason. If every suite fails identically (including untouched ones), report it as environmental and rely on lint + build; do not edit unrelated code. If tests run, they must pass.
4. CI order: `npm ci` -> `npm audit --audit-level=high` (blocking) -> lint -> test -> build. All must pass.

## 2. Game playtest checklist (manual; list which you could not run)
- Loads from a cold start; preload screen shows; no missing textures (green boxes) or console errors.
- First run as a **student** (light login and QR/student-code login), as a **teacher**, and as **admin** (no classId). Game passes both gates (`NameGate` -> `GameAccessGate`); a locked/scheduled game shows the right message.
- Full run to completion: stars awarded, completion event fires once, `logPlaySession` posts (check Network: `POST /api/plays`, `game` equals `progressKey`), replay works.
- Wrong answers: gentle, can't get stuck, never soft-locks.
- Input abuse: tap spam, two fingers, drag off-screen, switch tabs mid-round.
- Mute toggle persists (`ezw-muted-v1`) and applies to music + sfx; audio starts only after a gesture.
- Resize and rotate (portrait/landscape, `RotateHint`), small phone and large tablet.
- Leave to home and re-enter; no leaked sounds/timers, state resets.
- Offline/slow network: game still loads from cache after first play; API failure doesn't break play.
- Title, heading and catalogue label agree; `(in works)` rename done only if finished.

## 3. Page/panel playtest
- Works signed out and signed in; correct for teacher vs admin; maintenance mode behaviour (`PUBLIC_DURING_MAINTENANCE`).
- Phone (stacked) and desktop (tables) layouts; keyboard navigation for dialogs; no horizontal scroll.
- Destructive actions confirm; optimistic updates reconcile after refetch.

## 4. `npm audit` failures
- A transitive advisory can land without any dependency edit. Fix with `npm audit fix`, which updates `package-lock.json` only; commit the lockfile.
- **Never** lower the audit level or add `|| true` (auth credential lives in localStorage, so a vulnerable dependency is an exfiltration path).

## 5. Server-side caveat
The backend is a separate folder (`D:\K1 games project\server`), not testable from the frontend workspace. Say whether a server change needs redeploy and was not run.

## 6. Final report (short)
What changed; which checks passed/failed; which manual checks you could not run; follow-ups for the user (redeploy, add game to a class in Catalogue, bump persist version only if a global re-login is intended).

## Don't touch
`dist/`, `_sout.log`, `server/IMPLEMENTATION_PROMPT.md`, `server/SETUP.md`, `server/logPlaySession.js` unless asked.
