# EZ Wonders: kids' numeracy game platform

## Repo map (read first)
- Workspace `d:/Phaser/games` IS the frontend (Vite 8 + React 19 + Phaser 4 + Tailwind 4 + zustand 5). `src/games/` is the games domain of the frontend, not a backend.
- Backend = `D:\K1 games project\server` (Express + Mongoose), a **sibling folder outside the workspace**. Tools can't read it by default, edits there aren't part of this repo, and a server change can't be tested from here. Use the absolute path, and say so when you touch it.
- Docs drift (including these rules and `PROJECT_CONTEXT.md`). For API truth, read the real `server.js` and `server/models/*.js`. For helpers, read the file; recent consolidations removed near-duplicates and re-adding one undoes that.
- Leave alone unless asked: `dist/`, `_sout.log`, `server/IMPLEMENTATION_PROMPT.md`, `server/SETUP.md`, `server/logPlaySession.js` (stale unused copy).
- Don't re-explain React/Tailwind/Express basics.

## Workflow
- Players are kindergartners on shared school tablets/Chromebooks. Favor big tap targets, little text, forgiving flows, low memory use.
- Before changing a thing, read the closest existing example and match it.
- Keep changes small and scoped. Comments explain *why*, not *what*.
- Done means: `npm run lint` (0 errors) and `npm run build` pass. `npm test` currently fails for every suite in this environment for an unrelated Vitest runner issue; that is environmental, so trust lint + build and don't "fix" unrelated code.
- Final message: what changed, what was verified, what was not (server, devices), and any follow-up the user must do.
