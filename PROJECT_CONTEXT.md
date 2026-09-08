# K1 Weekly Wonders — Project Structure & Context

Auto-generated reference for LLM/developer onboarding. Two physical folders make
up the app:

- **This workspace** (`d:/Phaser/games`) — the **Vite + React frontend** ("the
  games"). Everything below the `src/` tree lives here.
- **`D:\K1 games project\server`** — the **Node/Express/Mongoose backend**
  (the actual `server/` described by [`🛡️ .roorules`](.roorules)). It is a
  *sibling* of this workspace (not nested inside it), so tools that operate on
  paths relative to the workspace can't reach it directly — use the absolute
  path or a `cd` when you need to read/edit it.

> Source of truth for architecture: [`🛡️ .roorules`](.roorules). If the repo and
> the rules disagree, the repo is stale/mid-migration — the rules describe the
> target. This file describes the **actual, current state** of both folders so
> the two can be cross-checked; any place the live code intentionally deviates
> from `.roorules` is called out inline.

---

## 1. Tech stack — frontend (from `package.json`)

- **Runtime/build**: Vite (`vite.config.js`, `appType: 'spa'`), React 19,
  `@vitejs/plugin-react`.
- **Styling**: Tailwind CSS **v4** via `@tailwindcss/vite`. Theme lives in CSS:
  [`index.css`](src/index.css) does `@import "tailwindcss"` + `@import
  "./aurora.css"` and a small `@theme`. [`tailwind.config.js`](tailwind.config.js)
  is a leftover no-op (v4 does not read it). A shared "Aurora" theme layer of
  `.aura-*` classes lives in [`src/aurora.css`](src/aurora.css); all chrome
  pages use these (spec: [`plans/unified-aurora-theme.md`](plans/unified-aurora-theme.md)).
- **State**: Zustand v5 (with `persist`) — `playerStore.js`, `gameAccess.js`,
  `students.js`.
- **Routing**: `react-router-dom` v7 (`BrowserRouter`), routes in
  [`main.jsx`](src/main.jsx).
- **Animation**: `motion` (`import { motion } from 'motion/react'`).
- **Game engine**: Phaser (`phaser` v4) for the canvas games
  (Game4/7/8/9/BonusGame1), wrapped in React by `BaseGame`.
- **Drag/drop**: `@dnd-kit/*` — only the admin reorder UI in
  [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx).
- **Badges/print**: `react-qr-code`, `html-to-image`, `jspdf` (student "Game
  Pass" badges, single PNG + whole-class PDF).
- **Extras**: `react-confetti`, `use-sound`, `react-helmet-async`, `clsx` +
  `tailwind-merge`, `react-use`.

Scripts: `dev`, `build`, `lint` (eslint .), `preview`.

## 2. Tech stack — backend (`D:\K1 games project\server\package.json`)

- **Node + Express 4**, **Mongoose 8** + `mongodb` driver 7, `cors`, `dotenv`
  (CommonJS, `"type": "commonjs"`). `nodemon` for `npm run dev`.
- Deployed on Render; uses MongoDB Atlas. Single entry point `server.js`.

---

## 3. Directory tree — frontend (actual, as of this writing)

```
.                                   # d:/Phaser/games
├── .env                            # VITE_API_BASE_URL (frontend)
├── 🛡️ .roorules
├── eslint.config.js · index.html · package.json · package-lock.json
├── README.md · PROJECT_CONTEXT.md
├── tailwind.config.js              # stale leftover — Tailwind v4 ignores it
├── vite.config.js                  # react() + tailwindcss(), appType: 'spa'
├── plans/
│   ├── class-type-admin-overhaul.md
│   ├── numbers-voice-shared-asset.md
│   └── unified-aurora-theme.md
├── public/
│   ├── _redirects · favicon-* · icons.svg · qr-icon.png · robots.txt
│   ├── site.webmanifest · sitemap.xml
│   ├── android-chrome-192/512x512.png · apple-touch-icon.png
│   ├── chest_closed.png / chest_open.png
│   └── PhaserAssets/ (bg_music.m4a · wrong.wav · pop_fx/)
└── src/
    ├── main.jsx                # router + lazy() imports + RotateHint + warmupSpeech
    ├── index.css               # @import tailwind + aurora.css, @theme
    ├── aurora.css              # shared .aura-* theme utilities
    ├── playerStore.js          # persisted zustand: player/teacher/student identity
    ├── gameAccess.js           # GAME_CATALOG + classId read store + admin classType mutators
    ├── logPlaySession.js       # per-play logging + stats/plays/leaderboard fetchers
    ├── students.js             # roster zustand + add/update/delete/lookup APIs
    ├── classInfo.js            # class info API (classId-scoped)
    ├── teacherCodes.js         # LOCAL FALLBACK teacher codes (server is primary)
    ├── NameGate.jsx            # whole-app entry gate (player name | teacher code)
    ├── GameAccessGate.jsx      # per-game unlock gate
    ├── GameAccessPage.jsx      # /game-access route wrapper (teachers only)
    ├── GameAccessPanel.jsx     # K1/K2 · Stats · Students · Settings tabs
    ├── StatsPanel.jsx          # teacher stats dashboard (embedded tab or modal)
    ├── StudentLogin.jsx        # /p/:code auto-login
    ├── StudentBadge.jsx        # QR "Game Pass" badge (PNG + whole-class PDF)
    ├── Home.jsx                # main home (game tiles + NextGameTimer)
    ├── BetaHome.jsx · BetaHome.css   # /beta-ezwonders marketing-style page
    ├── RotateHint.jsx          # "rotate to portrait" overlay (phones/tablets)
    ├── NextGameTimer.jsx       # "new game every Friday" countdown
    ├── App.jsx / App.css       # legacy shell (largely unused)
    ├── Game1.jsx · Game2.jsx · Game3.jsx · Game5.jsx · Game6.jsx   # React games
    ├── assets/
    ├── BonusGames/
    │   ├── BonusGame1/         # Number Pop! (b1, bonus)
    │   ├── Game4/              # Compare Die and Dominoes
    │   ├── Game 7/             # Mama Bird's Eggs
    │   ├── Game 8/             # Pizza Order!
    │   └── Game 9/             # Polly's Treasure Quest
    └── Phaser/
        ├── BaseGame.jsx · BasePreloadScene.js · BaseScene.js · config.js
        └── common/ (numbersVoice.js · sceneAssets.js · speech.js
                     · starProgress.js · uiHelpers.js)
```
(BonusGames each contain `assets.js · audioState.js · levels.js · Game.jsx ·
PhaserDemo.jsx` plus game-specific scene files — see §11.)

## 4. Directory tree — backend (`D:\K1 games project\server`, actual)

```
server/
├── .env · .env.example         # MONGODB_URI, PORT, ALLOWED_ORIGINS
├── package.json · package-lock.json
├── server.js                   # entire Express API + auth + boot migrations
├── directory.js                # DB-backed teacher/class lookup + seed
├── teacherCodes.js             # legacy static copy (unused by server.js)
├── logPlaySession.js           # legacy client-side copy (not used by server)
├── SETUP.md · IMPLEMENTATION_PROMPT.md
└── models/
    ├── ClassInfo.js            # classId, className, image, classType
    ├── Teacher.js              # code, name, classId, role
    ├── GameAccess.js           # classType, gameKey, added, unlocked, order, shiny
    ├── PlaySession.js          # one row per completed round
    └── Student.js              # studentId, classId, fullName, nickname, group, code
```

---

## 5. Core domain model

- **ClassType**: `'k1' | 'k2'` (enum in `ClassInfo` + `GameAccess`; not its own
  collection). Determines which game arrangement a class sees.
- **Class** (`ClassInfo`): `classId`, `className`, `image` (nullable,
  placeholder when absent), `classType`. Teacher list is *derived* by querying
  Teacher for matching classId, never stored on the class.
- **Teacher** (`Teacher`): `code` (unique access code), `name`, `classId` (home
  class), `role: 'teacher' | 'admin'`.
- **Student** (`Student`): `studentId` (server-generated UUID via `crypto`,
  not Mongo `_id`), `classId`, `fullName`, `nickname` (primary display name),
  `group` (freeform label), `code` (6-char, unique, sparse). Each student's QR
  "Game Pass" hits `/p/<code>`. Pure roster data — not wired into game
  unlocking / PlaySession matching.
- **GameAccess**: scoped by **classType** (not classId): `added`, `unlocked`,
  `shiny` (featured), `order`, per `{classType, gameKey}` (unique compound
  index). Every class of the same type sees identical arrangement/lock state.
- **PlaySession**: one row per completed round, `classId`-scoped: `game`,
  `playerName`, `classId`, `stars`, `totalRounds`, `peakStreak`, optional
  `elapsedSeconds`/`mistakes` (time-trial/bonus games), `device` fingerprint
  `{kind, os, browser, userAgent}`.
- **Legacy default**: `classId: 'k12026-pny'`, `classType: 'k1'`
  ("Kindergarten 1"). classId-scoped fallbacks use this id; classType defaults
  to `'k1'` when unset.

---

## 6. Auth model (two tiers, both DB-validated server-side)

- `isTeacher` / `isAdmin` in [`playerStore.js`](src/playerStore.js) are **UI
  state only — not a security boundary**. Every write endpoint re-validates
  `teacherCode` against the DB via `requireTeacher` / `requireAdmin`.
- **Teacher** (`requireTeacher`): can view own class info, add/update/delete
  students in their own roster, and read stats/summary/plays for their own
  class. Cannot mutate `GameAccess` (no reorder / lock / shiny / shop).
- **Admin** (`requireAdmin`, stricter — `role === 'admin'`): the only role that
  can mutate `GameAccess`. Admins edit by `classType` (K1 and/or K2) regardless
  of which class is their homeroom.
- **Login**: [`NameGate.jsx`](src/NameGate.jsx) calls
  `POST /api/teacher-login` → `{name, classId, className, classType, role}`.
  The server (`directory.js`) is the source of truth; there is **no
  client-side hardcoded mirror for normal operation**, though
  [`teacherCodes.js`](src/teacherCodes.js) is kept as an **offline fallback**
  when the server is unreachable (see §7.2).

---

## 7. Login system (current, in detail)

There are **three** ways into the app. [`NameGate.jsx`](src/NameGate.jsx) is the
whole-app entry gate rendered by Home and every game's `PhaserDemo`.

### 7.1 Player (child / guest)
Default mode: asks for a name; on submit `setPlayer(name, DEFAULT_CLASS)` where
`DEFAULT_CLASS = { id: 'k12026-pny', name: 'Kindergarten 1' }` — **everyone who
is not a teacher/student lands in the legacy K1 class** (no class picker). Once
`playerName` is set (and not `'guest'`), the persisted store keeps the gate from
prompting again.

### 7.2 Teacher / admin (server-first, local fallback)
Toggled by "I have a teacher code". On submit,
[`NameGate.jsx`](src/NameGate.jsx) calls `POST /api/teacher-login` with
`{ code }` (10 s `AbortController` timeout for Render cold-starts). Server
success → `setTeacher(data, code)`. If the server **rejects or is
unreachable/timeouts**, it falls back to the **local**
[`teacherCodes.js`](src/teacherCodes.js) `lookupTeacher` so a teacher can still
get in while the backend is down (a deliberate deviation from `.roorules`, which
said the mirror was removed; the DB remains authoritative). [`setTeacher`](src/playerStore.js:33)
sets `isTeacher: true`, `isAdmin: (role === 'admin')`, and stores `teacherCode`
for later authenticated writes.

### 7.3 Student (auto-login via QR / link)
[`StudentLogin.jsx`](src/StudentLogin.jsx) handles `/p/:code`. On mount it calls
`lookupStudentByCode(code)` → `GET /api/student-login/:code`, then
`setStudentPlayer(student, classInfo)` (no teacher/admin privileges) and
navigates to `/`. Students reach this via the printed QR "Game Pass" badges from
the Students tab (§10.6).

### Persisted identity — [`playerStore.js`](src/playerStore.js)
Zustand `persist` (localStorage key `k1weekly-player`): `playerName`, `classId`,
`className`, `classType`, `isTeacher`, `isAdmin`, `teacherCode`. Actions:
`setPlayer`, `setTeacher`, `setStudentPlayer`, `resetPlayer`.

---

## 8. Routing (`src/main.jsx`)

`warmupSpeech()` primes TTS at startup; `RotateHint` overlays phones/tablets in
landscape. All games are `lazy()`-loaded. Routes:

| Path | Component |
|---|---|
| `/` | `Home` |
| `/beta-ezwonders` | `BetaHome` |
| `/game1` … `/game6` | `Game1` … `Game6` (React games) |
| `/game4` | `BonusGames/Game4/PhaserDemo` |
| `/game7` | `BonusGames/Game 7/PhaserDemo` |
| `/game8` | `BonusGames/Game 8/PhaserDemo` — **Pizza Order!** (built) |
| `/game9` | `BonusGames/Game 9/PhaserDemo` — **Polly's Treasure Quest** (built) |
| `/bonus-game1` | `BonusGames/BonusGame1/PhaserDemo` — Number Pop! |
| `/game-access` | `GameAccessPage` |
| `/p/:code` | `StudentLogin` |

Routing is not gated by the route itself — each Phaser `PhaserDemo.jsx`
composes `NameGate → GameAccessGate`; React games are reached via Home (inside
NameGate).

---

## 9. Frontend gating flow

1. **`NameGate`** — captures player name / teacher code / student code.
2. **`GameAccessGate`** — re-checks per-game unlock via `useIsGameUnlocked`;
   teachers pass. Fetches access if not loaded for the current classId (handles
   direct URLs).
3. **`Home`** — fetches the same access data for the tiles, per-player progress
   from `fetchSummary`, and shows `NextGameTimer`.

The read/gating path is **classId-based**; the server resolves
`classId → classType` internally for `GET /api/game-access`, so this frontend
path was unchanged by the classType overhaul.

---

## 10. Key screens & frontend files

### 10.1 [`gameAccess.js`](src/gameAccess.js)
- **`GAME_CATALOG`** — canonical list of **10** games: keys `1`…`9` + `b1`
  (`1` Count & Win! · `2` Comparing Quantities · `3` Which Number? ·
  `4` Compare Die and Dominoes · `5` Making & Splitting Groups ·
  `6` Part-Part-Whole! · `7` Mama Bird's Eggs · `8` Pizza Order! ·
  `9` Polly's Treasure Quest · `b1` Number Pop!). Entries carry `key`, `emoji`,
  `label`, `title`, `subtitle`, `hue`, `tint`, `to`, `progressKey`, `gradient`,
  `ring`, and `isBonus` (b1 only).
- **Read store** `useGameAccessStore` (classId-based, used by Home/Gate):
  `unlocked`, `games`, `loaded`, `loadedClassId`, `loading`, `error`,
  `fetchGameAccess(classId)` (12 s timeout + abort of superseded requests).
  Optimistic local helpers `setUnlockedLocal`, `setShinyLocal`, `setOrderLocal`,
  `replaceRows`.
- **`mergeRows(rows)`** — merges raw server rows (`gameKey`, `unlocked`,
  `shiny`, `order`) onto `GAME_CATALOG`, keeping only games that have a row
  ("added"), sorted by `order`.
- **Helpers** `useIsGameUnlocked`, `isGameUnlockedNow`.
- **Legacy classId-scoped mutators** (`setGameUnlocked`, `setGameShiny`,
  `setGameOrder`, `addGameToClass`, `removeGameFromClass`) still exist but are
  **not used by the current panel**.
- **Admin-only classType-scoped mutators** (used by the admin panel):
  `fetchGameAccessForType(classType, teacherCode)` (GET by
  `?classType=&teacherCode=`), `setGameUnlockedForType`, `setGameShinyForType`,
  `setGameOrderForType`, `addGameToType`, `removeGameFromType`. Each sends
  `classType` + `teacherCode`, so an admin can edit K1 and/or K2.

### 10.2 [`logPlaySession.js`](src/logPlaySession.js)
- **`logPlaySession(...)`** — `POST /api/plays`; reads `classId` from the store,
  falling back to `LEGACY_CLASS_ID`; attaches a client-side `detectDevice()`
  fingerprint. Failures only `console.warn` (never break the game).
- Completion slugs across the app: `game1`…`game9`, `bonusGame1`.
- **Stats fetchers**: `fetchStats(teacherCode)` (`/api/stats`),
  `fetchSummary(...)` (`/api/summary`; paginated `{rows,total,page,limit,hasMore}`
  for the teacher panel, unpaginated array for Home/student progress),
  `fetchPlaysPage(...)` (`/api/plays`, paginated), `fetchLeaderboard(classId)`
  (`/api/leaderboard`, weekly trophies since last Friday noon), and
  `deletePlayerGame(game, playerName, teacherCode)` (`DELETE /api/plays`). All
  via a shared `fetchWithTimeout` (15 s).

### 10.3 [`students.js`](src/students.js)
Zustand `useStudentStore` (classId-scoped, 12 s timeout): `students`, `loaded`,
`loadedClassId`, `fetchStudents(teacherCode)`, `reset`, and optimistic
`addStudentLocal`/`updateStudentLocal`/`removeStudentLocal`.
API helpers: `addStudent({fullName, nickname, group, teacherCode})` (client
generates the 6-char code), `updateStudent({studentId, nickname, group,
teacherCode})`, `deleteStudent({studentId, teacherCode})`, and
`lookupStudentByCode(code)` (`GET /api/student-login/:code`).

### 10.4 [`classInfo.js`](src/classInfo.js)
`fetchClassInfo(classId)` → `GET /api/classes/:classId` → `{classId, className,
image, teachers[]}` (Settings tab).

### 10.5 [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx) — the controls
Rendered as a full-screen overlay; [`GameAccessPage.jsx`](src/GameAccessPage.jsx)
maps its `onClose` to `navigate('/')` and supports a `?tab=` override. Tab
structure is role-based:
- **Admin**: **K1 Games · K2 Games · Stats · Students · Settings**. Defaults to
  the admin's own `classType`.
- **Teacher (non-admin)**: **Games · Stats · Students · Settings** — a single
  read-only **Games** list for their own class type (`ReadOnlyGameList`), no
  drag/lock/shiny/shop controls.
- **Stats** tab renders `<StatsPanel embedded />`.

**Admin game editor (`GameAccessTypeEditor`)**, per class type:
- Fetches via `fetchGameAccessForType` into a local `draftGames` snapshot; a
  "Player access X / Y open" counter + **Unlock all / Lock all**.
- **Reorder**: `@dnd-kit` sortable slots (pointer + keyboard); bonus games
  labeled "BONUS", numbered games get running slot numbers that update live.
- **Lock/unlock** switch and **feature/shiny** (✨) per game, staged in the
  draft.
- **Confirm changes** batches only the deltas: order → `setGameOrderForType`,
  then `setGameUnlockedForType` + `setGameShinyForType` per change. **Reset**
  restores the last-saved snapshot; an unsaved-changes badge + change count
  shows.
- **Game shop (add/remove)**: full `GAME_CATALOG` list with per-game
  `+ Add` / `Remove`. `addGameToType` creates the `{classType, gameKey}` row;
  `removeGameFromType` soft-deletes it. After a shop change the editor re-fetches
  and resets the draft. An empty class type is a valid state ("has no games yet —
  add from the shop").

**Students tab** — `AddStudentForm` (nickname + optional group), `StudentRow`
list (inline edit nickname/group, delete with confirm, QR-badge button), and
`PrintAllBadgesButton`. Class assignment comes from the logged-in teacher's
classId.

**Settings tab** — `ClassInfoTab`: class image (or 🏫 placeholder), classId, and
the derived teacher list.

### 10.6 [`StatsPanel.jsx`](src/StatsPanel.jsx) — the stats
Teacher-only dashboard; embedded (panel tab) or modal. Details:
- Header stat cards from `fetchStats` (`totalPlays`, `uniquePlayers` for "all",
  or per-game `plays`, `players`, `avgStars`, `avgBestStreak`,
  `avgElapsedSeconds` when filtered; bonus/time-trial games show avg time).
- **Game filter dropdown** — "All games" + every game present in the data with
  play counts; known slugs map to emoji/name via `GAME_LABELS`, unknown fall
  back to "🎮 Game N".
- **Player search** (debounced 300 ms, server-side via `q`).
- Two views: **Summary** (`fetchSummary`, one row per player+game with
  timesPlayed badge, best streak, last played; two-tap "Confirm?" delete) and
  **All plays** (`fetchPlaysPage`, every raw session — stars/rounds or elapsed
  time, streak/time, played-at, and a **device** column).
- **Infinite scroll** via shared `usePaginatedList` + IntersectionObserver;
  server owns filtering/sorting/paging (PAGE_SIZE 50). Phones render stacked
  cards; sm+ render sortable tables. Slow/cold-start messaging after 3 s.

### 10.7 [`StudentBadge.jsx`](src/StudentBadge.jsx)
QR "Game Pass" per student: 410×580 px → 300 DPI PNG with true alpha corners,
copy login link, and **Print all badges** → multi-page A4 PDF (3×3 grid, 9 per
page) via `html-to-image` + `jsPDF`. The QR points at `${SITE_URL}/p/<code>`.

### 10.8 [`Home.jsx`](src/Home.jsx)
Wraps `NameGate` → `HomeContent`. Greets by name, shows `NextGameTimer`
("New game every Friday!"), a "Not you? Switch player" reset, and teacher-only
floating **Teacher controls** / **View Stats** buttons (→ `/game-access`).
Fetches access to decide which tiles are open (locked tiles show 🔒 "Coming
soon"); teachers see an extra lock badge reflecting the player-facing state.
Loads per-player progress via `fetchSummary({classId, playerName})` keyed by
`progressKey`; prefetches unlocked bundles via `requestIdleCallback`.

---

## 11. Backend (actual) — `server.js` and friends

### 11.1 Express app setup (`server.js`)
- Forces DNS servers (`8.8.8.8`/`1.1.1.1`) to survive Render networking.
- CORS allow-list from `ALLOWED_ORIGINS` (comma-separated) or `*`; requests with
  no `Origin` allowed.
- `Cache-Control: no-store` on every `/api` response (prevents stale cached
  errors locking the UI).
- **15 s hard request timeout** middleware → 504 `{error}`.
- `GET /api/health` — real Mongo round-trip ping (keeps Atlas connection warm,
  thwarts Render spin-down).

### 11.2 Auth middleware (`server.js`)
- `teacherFromRequest(req)` — `lookupTeacher(req.query.teacherCode ||
  req.body?.teacherCode)`.
- `requireTeacher(req,res)` — 401 if no/invalid code; returns the teacher doc
  (`{name, classId, className, classType, role}`).
- `requireAdmin(req,res)` — `requireTeacher` + `role === 'admin'` else 403.
  Gates **all** `GameAccess` write routes.
- `requireClass(req,res)` — resolves a valid `classId` from query/body (400 if
  unknown).
- `classIdFromRequest(req)` / `resolveClassType(classId)` — classId→classType,
  cached in an in-memory `classTypeCache` (single `ClassInfo` lookup per class
  per process).

### 11.3 Routes (all fail with `{error}` + non-2xx; frontend throws the message)

**Auth / teacher / classes**
- `POST /api/teacher-login` — `{code}` → teacher object or 401.
- `GET /api/classes` — `[{id, name, classType}]`.
- `GET /api/classes/:classId` — `{classId, className, image, classType,
  teachers[]}` (404 if unknown; teachers derived from `Teacher`).

**Students / roster** (teacher-only, scoped to caller's classId)
- `GET /api/students?teacherCode=` — sorted by `createdAt`, selected fields.
- `POST /api/students` — requires `nickname` + a 6-char `code`; pre-checks code
  uniqueness (409 friendly on duplicate, incl. Mongo 11000 race).
- `PUT /api/students/:studentId` — update `nickname`/`group` only (code is
  read-only); scoped to the teacher's classId.
- `DELETE /api/students/:studentId` — remove from roster.
- `GET /api/student-login/:code` — public; validates a 6-char code →
  `{student, classInfo}` (404 if not found).

**Game access / arrangement** (READ public-by-classId; WRITE admin-only)
- `GET /api/game-access` — dual shape: `?classType=&teacherCode=` (admin panel,
  `requireAdmin`) **or** `?classId=` (public; resolves classId→classType via
  cache). Returns rows for `added: true`, sorted by `order` then numeric
  `gameKey`. **No hardcoded game-key allowlist** — the DB is the source of truth,
  so new games need no server redeploy.
- `PUT /api/game-access/order` — admin; `{gameKeys, classType, teacherCode}`;
  validates the list is exactly the set of currently-added games, then
  `bulkWrite`s the order (each row stamped `updatedBy`/`updatedAt`).
- `POST /api/game-access/:gameKey` — admin; **add from shop**. Upserts
  `added:true, unlocked:false, shiny:false` and appends at `max(order)+1`.
- `DELETE /api/game-access/:gameKey` — admin; **soft-delete** (sets `added:false`
  and resets lock/shiny). 404 if not currently added.
- `PUT /api/game-access/:gameKey/shiny` — admin; toggle `shiny` for a classType.
- `PUT /api/game-access/:gameKey` — admin; lock/unlock a game for a classType.
- Route order matters: `/order` and `/:gameKey/shiny` are declared **above**
  `/:gameKey` so they aren't shadowed.

**Plays / stats** (teacher or public as noted)
- `POST /api/plays` — logs one session (slug regex `^[a-zA-Z][a-zA-Z0-9]*$`;
  clamps stars/rounds/streak/elapsed/mistakes; sanitizes `device`).
- `DELETE /api/plays` — teacher-only; `{game, playerName, teacherCode}` deletes
  all matching sessions for the teacher's class.
- `GET /api/stats?teacherCode=` — class-wide totals + per-game breakdown via a
  single `$facet` aggregation (plays, unique players, per-game avg stars /
  avg elapsed seconds / best-streak-per-player). Feeds header + per-game cards.
- `GET /api/summary?teacherCode=&page=&limit=&sortKey=&sortDir=&game=&q=` —
  one row per player+game, server-paginated `{rows,total,page,limit,hasMore}`.
  With `classId`+`playerName` instead (no teacherCode) it returns a **plain
  unpaginated array** for a single player's progress.
- `GET /api/plays?teacherCode=&page=&limit=&sortKey=&sortDir=&game=&q=` —
  paginated raw sessions, newest first by default; `device.kind` projected to a
  sortable field with sentinels so missing device pins to the bottom.
- `GET /api/leaderboard?classId=&since=` — public, class-wide; one trophy per
  completed play since the latest Friday-noon (or the `since` ISO timestamp).
- `GET /api/leaderboard/:game?classId=` — top 10 runs for one game.
- Shared list helpers: `parseListParams` (clamps `limit` to 200, whitelists
  sort keys), `escapeRegex` for literal search. SORT whitelists:
  `SUMMARY_SORT_KEYS` and `PLAYS_SORT_KEYS`.

### 11.4 Boot / migrations (in `mongoose.connect().then()`)
Ordered, self-guarding/idempotent (redeploys are no-ops):
1. `seedDirectoryIfEmpty()` — only when a collection is empty, seeds two
   teachers (codes `12/10/22` admin/Siti Soleha→k12026-pny, `92702689`
   admin/DEVZee→test2026-jyx) and two `ClassInfo` rows.
2. `migrateClassTypeAndGameAccess()` — backfills legacy `PlaySession.classId`;
   defaults teachers without `role` to `admin`; defaults `ClassInfo` without
   `classType` to `k1`; migrates `GameAccess` from old `{classId}` rows to
   `{classType:'k1'}` rows (prefers the legacy K1 class on conflicts), deletes
   old classId-keyed docs, then drops the old `classId_1_gameKey_1` / `gameKey_1`
   indexes and `syncIndexes()`.
3. `migrateStudentCodes()` — assigns random 6-char codes (same alphabet as the
   frontend) to students missing one.
4. `Student.syncIndexes()` + `PlaySession.syncIndexes()`.
Mongoose `bufferCommands: false` (fail fast when disconnected) and connect
options `maxIdleTimeMS: 720000`, `serverSelectionTimeoutMS: 5000`.

### 11.5 Models (`server/models/`)
- [`ClassInfo.js`](D:/K1 games project/server/models/ClassInfo.js) — `classId`
  (unique), `className`, `image` (nullable), `classType` enum `['k1','k2']`
  default `'k1'`.
- [`Teacher.js`](D:/K1 games project/server/models/Teacher.js) — `code` (unique),
  `name`, `classId` (indexed), `role` enum `['teacher','admin']` default
  `'teacher'`.
- [`GameAccess.js`](D:/K1 games project/server/models/GameAccess.js) — `classType`
  enum, `gameKey`, `added` (default false), `unlocked`, `order`, `shiny`,
  `updatedBy`, `updatedAt`; **unique index `{classType, gameKey}`**.
- [`PlaySession.js`](D:/K1 games project/server/models/PlaySession.js) —
  `classId` (default `'k12026-pny'`), `game`, `playerName`, `stars`,
  `totalRounds`, `peakStreak`, optional `elapsedSeconds`/`mistakes`,
  `completedAt`, `device` subdoc (`kind` enum — **not** `type`, see §12).
  Compound indexes for roster lookups and the leaderboard query.
- [`Student.js`](D:/K1 games project/server/models/Student.js) — `studentId`
  (UUID default), `classId`, `fullName`, `nickname`, `group`, `code` (unique +
  sparse, maxlength 6, uppercase), `createdAt`.
- [`directory.js`](D:/K1 games project/server/directory.js) — DB-backed
  `lookupTeacher`, `classTypeForClassId`, `getClasses`, `isKnownClass`,
  `seedDirectoryIfEmpty` (replaces the old hardcoded `teacherCodes.js`).

---

## 12. Mongoose / Mongo gotchas

- Nested subdocument fields must avoid a key literally named `type` (Mongoose
  reads it as a type-declaration shorthand) — see `PlaySession.device.kind`.
- **Schema field changes don't migrate indexes.** When `GameAccess` moved its
  unique key from `{classId, gameKey}` → `{classType, gameKey}`, the old index
  had to be explicitly dropped and `syncIndexes()` called (see
  `cleanupGameAccessIndexes`).
- Boot-time data migrations must be self-guarding/idempotent (check absence of
  the new field / presence of the old before acting).
- `bufferCommands: false` + tight `serverSelectionTimeoutMS` avoid silent hangs
  during Render/Atlas cold starts.

---

## 13. Phaser game anatomy (shared `src/Phaser/`)

- [`BaseGame.jsx`](src/Phaser/BaseGame.jsx) — measures available space
  (ResizeObserver), computes a 2:3 fit box, mounts one `Phaser.Game` per a
  `buildScenes()` factory, wires a `completeEventName` → `onComplete` callback
  and `onPhaserReady`.
- [`BasePreloadScene.js`](src/Phaser/BasePreloadScene.js) — generic loader from
  `{ key, assets, nextSceneKey, loadingEmoji, loadingText }`; manifest entries
  `{ type: 'image'|'audio'|'spritesheet'|'atlas', key, url, config? }`.
- [`BaseScene.js`](src/Phaser/BaseScene.js) — `createPillButton`,
  `addSkyBackground`, `addDriftingClouds`, `stopSpeechOnShutdown`.
- [`config.js`](src/Phaser/config.js) — Phaser config, `DEFAULT_ASPECT`,
  `DEFAULT_BASE_RESOLUTION`.
- `common/` — [`starProgress.js`](src/Phaser/common/starProgress.js)
  (`createStarProgress({storageKey, levelCount})`),
  [`uiHelpers.js`](src/Phaser/common/uiHelpers.js) (`createPillButton`),
  [`numbersVoice.js`](src/Phaser/common/numbersVoice.js),
  [`sceneAssets.js`](src/Phaser/common/sceneAssets.js),
  [`speech.js`](src/Phaser/common/speech.js) (`warmupSpeech`, TTS).

Per-game folder formation (Game4/7/8/9/BonusGame1): `assets.js`, `audioState.js`
(`isMuted`, `ensureBgMusic`, `addMuteButton`), `levels.js` (`LEVELS`,
`buildRounds`, `progress`), game-specific scene files (e.g. `GameScene.js`
emits a run-complete event like `game8-complete`), `Game.jsx` (`BaseGame` mount
whose `handleComplete` calls `logPlaySession({ game: '<slug>', ... })`), and
`PhaserDemo.jsx` (`NameGate → GameAccessGate` wrapper + page shell).

---

## 14. Conventions

- Comments explain *why*, not *what*.
- Prefer extending existing zustand stores / API helpers over parallel ones —
  one store per domain, one thin fetch-helper per API concern.
- Phaser canvas games use Phaser's native input; `@dnd-kit` is DOM-only (admin
  reorder).
- React `Confetti` is for level-complete overlays only; `use-sound` is not used
  in Phaser games (Phaser `this.sound` instead).
- Chrome pages share the `aura-*` theme from [`src/aurora.css`](src/aurora.css) —
  don't hand-roll new sky/white themes for new pages.
- The backend needs **no redeploy when a new game is added** — `GAME_CATALOG`
  (frontend) and the `GameAccess` DB rows drive everything; the server only
  validates generic slug/key regexes.

---

## 15. Adding a new game — checklist

1. Build the game component/scene under `src/` (React or `BonusGames/<Name>/`).
2. Add a `lazy()` import + `<Route>` in [`main.jsx`](src/main.jsx).
3. Add an entry to `GAME_CATALOG` in [`gameAccess.js`](src/gameAccess.js).
4. Wrap the route content in `NameGate` → `GameAccessGate`.
5. Call `logPlaySession(...)` on completion with the matching `game` slug.
6. Add the slug's emoji/label to `GAME_LABELS` in
   [`StatsPanel.jsx`](src/StatsPanel.jsx) so stats render nicely.
7. It appears once an **admin** adds it to a class type from the shop
   (`addGameToType`) — teachers cannot add games themselves. No server change
   is required.

---

## 16. Adding a new class type (e.g. future 'k3')

1. Add the value to the `classType` enum in `server/models/ClassInfo.js` and
   `server/models/GameAccess.js`, and to `isValidClassType` in `server/server.js`.
2. Add it as a new tab (alongside "K1 Games" / "K2 Games") in
   [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx)'s `AdminTabBar` +
   `CLASS_TYPE_LABELS`, plus a matching render branch.
3. No GameAccess rows exist for it until an admin adds games via the shop — an
   empty class type is a valid, expected state.
