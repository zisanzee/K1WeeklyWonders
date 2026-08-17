# K1 Weekly Wonders — Project Structure & Context

Auto-generated reference for LLM/developer onboarding. Describes what exists in
**this workspace** (`d:/Phaser/games`), which is the Vite + React frontend. The
`.roorules` file describes a monorepo that also contains a `server/` (Node +
Express + Mongoose) backend, but that folder is **not present in this
workspace** — treat its contract below as the target API the frontend talks to.

> Source of truth for architecture: [`🛡️ .roorules`](.roorules). If the repo and
> the rules disagree, the repo is stale/mid-migration — the rules describe the
> target.

---

## 1. Tech stack (frontend, from `package.json`)

- **Runtime/build**: Vite (`vite.config.js`), React 19, `@vitejs/plugin-react`
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`
  postcss workflow — theme lives in CSS via `@import "tailwindcss"` / `@theme`)
- **State**: Zustand v5 (with `persist`)
- **Routing**: `react-router-dom` v7 (`BrowserRouter`)
- **Animation**: `motion` (`import { motion } from 'motion/react'`)
- **Game engine**: Phaser (`phaser` v4)
- **Drag/drop**: `@dnd-kit/*` (admin panel reorder only — **not** in-canvas)
- **Extras**: `react-confetti`, `use-sound`, `react-helmet-async`,
  `clsx` + `tailwind-merge` (check for shared `cn()` before writing conditional
  classNames by hand), `html-to-image`, `jspdf`, `react-qr-code`, `react-use`

Scripts: `dev` (vite), `build` (vite build), `lint` (eslint .), `preview`.

---

## 2. Directory tree (actual, as of this writing)

```
.
├── .env
├── .gitignore
├── 🛡️ .roorules                     # project rules / architecture source of truth
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── tailwind.config.js
├── vite.config.js                   # react() + tailwindcss() plugins, appType: 'spa'
├── plans/
│   ├── class-type-admin-overhaul.md
│   └── numbers-voice-shared-asset.md
├── public/
│   ├── _redirects                   # Netlify/Render SPA redirects
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── chest_closed.png / chest_open.png
│   ├── favicon-16/32/96.png · favicon.ico · favicon.png · favicon.svg
│   ├── icons.svg
│   ├── qr-icon.png
│   ├── robots.txt
│   ├── site.webmanifest
│   ├── sitemap.xml
│   └── PhaserAssets/
│       ├── bg_music.m4a
│       ├── wrong.wav
│       └── pop_fx/ (pop-1.mp3 · pop-2.mp3 · pop-3.mp3)
└── src/
    ├── App.jsx / App.css            # legacy app shell
    ├── BetaHome.jsx / BetaHome.css  # /beta-ezwonders page
    ├── Home.jsx                     # main home (game tiles)
    ├── main.jsx                     # router + all lazy() imports
    ├── index.css                    # Tailwind import + @theme
    ├── playerStore.js               # persisted zustand: player identity/role
    ├── gameAccess.js                # GAME_CATALOG + classId read store + admin mutators
    ├── logPlaySession.js            # per-game completion logging + stats fetchers
    ├── students.js                  # roster API (classId-scoped)
    ├── classInfo.js                 # class info API (classId-scoped)
    ├── teacherCodes.js              # legacy client-side code mirror (stale per .roorules)
    ├── NameGate.jsx                 # whole-app entry gate (name or teacher code)
    ├── GameAccessGate.jsx           # per-game unlock gate
    ├── GameAccessPage.jsx           # admin/teacher access panel page
    ├── GameAccessPanel.jsx          # K1/K2 tabs, Students, Settings
    ├── StudentLogin.jsx             # /p/:code student landing
    ├── StudentBadge.jsx
    ├── StatsPanel.jsx               # teacher dashboard stats
    ├── NextGameTimer.jsx
    ├── Game1.jsx · Game2.jsx · Game3.jsx · Game5.jsx · Game6.jsx   # React games
    ├── assets/ (hero.png · react.svg · vite.svg)
    ├── BonusGames/
    │   ├── BonusGame1/              # Number Pop! (bonus game)
    │   │   ├── assets.js · levels.js · Game.jsx · PhaserDemo.jsx
    │   │   ├── LevelSelectScene.js · NumberOrderScene.js · speech.js
    │   ├── Game4/                   # Compare Die & Dominoes
    │   │   ├── assets.js · audioState.js · levels.js · Game.jsx · PhaserDemo.jsx
    │   │   ├── CompareDiceScene.js · LevelSelectScene.js
    │   ├── Game 7/                  # Mama Bird's Eggs (Number Bonds)
    │   │   ├── assets.js · audioState.js · levels.js · Game.jsx · PhaserDemo.jsx
    │   │   ├── GameScene.js · LevelSelectScene.js · idea.md
    │   └── Game 8/                  # boilerplate scaffold (design not written yet)
    │       ├── assets.js · audioState.js · levels.js · Game.jsx · PhaserDemo.jsx
    │       ├── GameScene.js · LevelSelectScene.js · instructions.md (empty)
    └── Phaser/
        ├── BaseGame.jsx             # shared canvas mount/fit-box/resize logic
        ├── BasePreloadScene.js      # shared loading scene (asset manifest config)
        ├── BaseScene.js             # shared scene base (createPillButton, sky, clouds)
        ├── config.js                # Phaser game config / aspect / base resolution
        └── common/
            ├── numbersVoice.js      # shared voice-one..voice-ten clips + playNumberVoice
            ├── sceneAssets.js       # canvas texture generators (bg/clouds/splat/confetti)
            ├── speech.js            # warmupSpeech + TTS helpers
            ├── starProgress.js      # createStarProgress factory (localStorage)
            └── uiHelpers.js         # createPillButton
```

---

## 3. Core domain model

- **ClassType**: `'k1' | 'k2'` (enum, not a Mongo collection — same
  hardcoded-list pattern as `GAME_CATALOG`). Determines which game
  arrangement a class sees.
- **Class** (`ClassInfo`): `classId`, `className`, `image` (nullable,
  placeholder when absent), `classType`. Teacher list is *derived* by
  querying Teacher for matching classId.
- **Teacher**: `code` (unique access code), `name`, `classId` (home class),
  `role: 'teacher' | 'admin'`.
- **Student** (`Student.js`): `studentId` (server-generated UUID), `classId`,
  `fullName`, `nickname` (optional). Pure roster data — not wired into game
  unlocking / PlaySession matching. Adding a student has no side effects.
- **GameAccess**: scoped by **classType**, not classId: `unlocked`, `shiny`
  (featured), `order`, `added` (opted in from the shop), per
  `{classType, gameKey}` (unique compound index). Same class type = same
  arrangement/lock state.
- **PlaySession**: one row per completed round, still `classId`-scoped
  (`game`, `playerName`, `classId`, `stars`, `totalRounds`, `peakStreak`,
  optional `elapsedSeconds`/`mistakes` for time-trial games, `device`
  fingerprint).
- **Legacy default**: `classId: 'k12026-pny'`, `classType: 'k1'`
  ("Kindergarten 1"). classId-scoped fallbacks use this id; classType
  defaults to `'k1'` when unset.

---

## 4. Auth model (two tiers, both DB-validated server-side)

- `isTeacher` / `isAdmin` in [`playerStore.js`](src/playerStore.js) are **UI
  state only** — not a security boundary. Every write endpoint re-validates
  `teacherCode` against the DB.
- **Teacher** (`requireTeacher`): view own class info, add students to own
  roster, view (never edit) own class type's game arrangement. No reorder /
  lock / shiny / shop / student edit-delete / class-info edit.
- **Admin** (`requireAdmin`): the only role that can mutate `GameAccess`.
  Admins edit by `classType`, regardless of their homeroom.
- **Login**: `NameGate.jsx` calls `POST /api/teacher-login` → returns
  `{name, classId, className, classType, role}`. No client-side teacher-code
  mirror (the old [`teacherCodes.js`](src/teacherCodes.js) is stale/legacy).

---

## 5. Routing (`src/main.jsx`)

All game routes are `lazy()`-loaded. Current routes:

| Path | Component |
|---|---|
| `/` | `Home` |
| `/beta-ezwonders` | `BetaHome` |
| `/game1` | `Game1` |
| `/game2` | `Game2` |
| `/game3` | `Game3` |
| `/game4` | `BonusGames/Game4/PhaserDemo` |
| `/game5` | `Game5` |
| `/game6` | `Game6` |
| `/game7` | `BonusGames/Game 7/PhaserDemo` |
| `/bonus-game1` | `BonusGames/BonusGame1/PhaserDemo` |
| `/game-access` | `GameAccessPage` |
| `/p/:code` | `StudentLogin` |

> `/game8` is **not registered yet** — the Game 8 folder is a boilerplate
> scaffold awaiting its design/implementation.

---

## 6. Frontend gating flow

`NameGate.jsx` (whole-app entry) → captures player name (legacy default class)
or teacher code (real class via login) → persisted in `playerStore.js`.
`GameAccessGate.jsx` (wraps each game) → re-checks per-game unlock via
`useIsGameUnlocked`; teachers/admins always pass through. Both gates
independently re-fetch if data isn't loaded for the current classId.

The read/gating path is **classId-based**; the server resolves
`classId → classType` internally for `GET /api/game-access`. New game routes
need both gates, in that order.

---

## 7. Key frontend files

- [`playerStore.js`](src/playerStore.js) — persisted zustand: `playerName`,
  `classId`, `className`, `isTeacher`, `isAdmin`, `classType`, `teacherCode`.
- [`gameAccess.js`](src/gameAccess.js) — `GAME_CATALOG` (canonical game list),
  classId-based read store (`useIsGameUnlocked`, `fetchGameAccess`), plus
  classType-scoped admin mutators (`setGameUnlockedForType`,
  `setGameShinyForType`, `setGameOrderForType`, `addGameToType`,
  `removeGameFromType`).
- [`logPlaySession.js`](src/logPlaySession.js) — called by every game on
  completion; also `fetchStats` / `fetchSummary` / `fetchAllPlays` /
  `deletePlayerGame`.
- [`students.js`](src/students.js) / [`classInfo.js`](src/classInfo.js) —
  roster + class-info API, classId-scoped, any teacher for their own class.
- [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx) — admins see **K1 Games /
  K2 Games / Students / Settings** tabs (each fully editable, defaulting to
  the admin's own classType). Non-admin teachers see a single read-only
  **Games** tab.

---

## 8. GAME_CATALOG inventory (`gameAccess.js`)

Keys: `1` Count & Win, `2` Comparing Quantities, `3` Which Number?,
`4` Compare Die and Dominoes, `5` Making & Splitting Groups,
`6` Part-Part-Whole, `b1` Number Pop! (bonus), `7` Mama Bird's Eggs.

`key: '8'` does not exist yet — it must be added alongside the route +
GAME_CATALOG entry when Game 8 is built.

---

## 9. Server endpoint contract (target API)

All routes return `{ error: '...' }` with non-2xx on failure; frontend helpers
throw `new Error(body.error || 'fallback message')`.

- `POST /api/teacher-login` — `{code}` → `{name, classId, className, classType, role}` or 401.
- `GET /api/classes` — `[{id, name, classType}]`.
- `GET /api/classes/:classId` — `{classId, className, image, classType, teachers[]}`.
- `GET /api/game-access?classId=` — READ; resolves classId→classType server-side.
- `PUT/POST/DELETE /api/game-access[...]` — WRITE, admin-only (`requireAdmin`),
  body includes `classType` directly.
- `GET/POST/DELETE /api/students` — teacher-only, scoped to caller's classId.
- `POST /api/plays` — logs a session; classId-scoped (legacy fallback if absent).
- `GET /api/stats` · `/api/summary` · `/api/plays` — teacher dashboard reads.
- `DELETE /api/plays` — teacher-only.

Env: `VITE_API_BASE_URL` (frontend, default `http://localhost:4000`);
`MONGODB_URI` (backend).

---

## 10. Mongoose / Mongo gotchas

- Nested subdocument fields must avoid a key literally named `type` (Mongoose
  reads it as type-declaration shorthand) — see `PlaySession.device.kind`.
- **Schema field changes don't migrate indexes.** When `GameAccess` moved its
  unique key from `{classId, gameKey}` → `{classType, gameKey}`, the old index
  had to be explicitly dropped and `syncIndexes()` called.
- Boot-time data migrations must be self-guarding/idempotent (check absence of
  new field / presence of old before acting).

---

## 11. Phaser game anatomy (shared `src/Phaser/`)

- [`BaseGame.jsx`](src/Phaser/BaseGame.jsx) — measures real available space
  (ResizeObserver), computes a 2:3 fit box, mounts one `Phaser.Game` per
  `buildScenes()` factory, wires `completeEventName` → `onComplete` and
  `onPhaserReady` for extra events.
- [`BasePreloadScene.js`](src/Phaser/BasePreloadScene.js) — generic loader
  configured with `{ key, assets, nextSceneKey, loadingEmoji, loadingText }`.
  Asset manifest entries: `{ type: 'image'|'audio'|'spritesheet'|'atlas', key, url, config? }`.
- [`BaseScene.js`](src/Phaser/BaseScene.js) — `createPillButton`, `addSkyBackground`,
  `addDriftingClouds`, `stopSpeechOnShutdown`.
- [`config.js`](src/Phaser/config.js) — Phaser game config, `DEFAULT_ASPECT`,
  `DEFAULT_BASE_RESOLUTION`.
- `common/` — [`starProgress.js`](src/Phaser/common/starProgress.js)
  (`createStarProgress({ storageKey, levelCount })`),
  [`uiHelpers.js`](src/Phaser/common/uiHelpers.js) (`createPillButton`),
  [`numbersVoice.js`](src/Phaser/common/numbersVoice.js),
  [`sceneAssets.js`](src/Phaser/common/sceneAssets.js),
  [`speech.js`](src/Phaser/common/speech.js).

### Per-game folder formation (Game 4 / Game 7 / Game 8)

Each BonusGames folder follows this shape:

- `assets.js` — `IMAGES`, `AUDIO`, `AUDIO_TYPE_OVERRIDES`, flattened `ASSET_MANIFEST`.
- `audioState.js` — `isMuted`, `ensureBgMusic`, `addMuteButton` (per-game mute key).
- `levels.js` — `LEVELS`, `buildRounds(level)`, `progress = createStarProgress(...)`.
- `LevelSelectScene.js` — cards from `LEVELS`, starts the main scene with `{ levelIndex }`.
- `GameScene.js` (or `CompareDiceScene.js`) — main gameplay scene.
- `Game.jsx` — `BaseGame` mount + `logPlaySession` via the game's complete event.
- `PhaserDemo.jsx` — `NameGate` → `GameAccessGate` wrapper + page shell.
- `idea.md` / `instructions.md` — design spec notes.

---

## 12. Conventions

- Comments explain *why*, not *what*.
- Prefer extending existing zustand stores / API helpers over creating parallel
  ones — one store per domain, one thin fetch-helper per API concern.
- Phaser canvas games use Phaser's native input (`setInteractive({ draggable:
  true })`); `@dnd-kit` is DOM-only (admin panel).
- React `Confetti` is for the level-complete overlay, never in-canvas effects;
  `use-sound` is not used in Phaser games (Phaser `this.sound` instead).

---

## 13. Adding a new game — checklist

1. Build the game component/scene under `src/`.
2. Add a `lazy()` import + `<Route>` in [`main.jsx`](src/main.jsx).
3. Add an entry to `GAME_CATALOG` in [`gameAccess.js`](src/gameAccess.js).
4. Wrap the route content in `NameGate` → `GameAccessGate`.
5. Call `logPlaySession(...)` on completion with the matching `game` slug.
6. It appears once an **admin** adds it to a class type from the shop
   (`addGameToType`) — teachers cannot do this themselves.

---

## 14. Adding a new class type (e.g. future 'k3')

1. Add the value to the `classType` enum in `models/ClassInfo.js` and
   `models/GameAccess.js`.
2. Add it as a new tab in [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx).
3. No GameAccess rows exist until an admin adds games via the shop — an empty
   class type is valid/expected.
