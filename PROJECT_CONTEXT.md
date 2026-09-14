# K1 Weekly Wonders — Project Structure & Context

Auto-generated reference for LLM/developer onboarding. Two physical folders make
up the app:

- **This workspace** (`d:/Phaser/games`) — the **Vite + React frontend** ("the
  games"). Everything below the `src/` tree lives here.
- **`D:\K1 games project\server`** — the **Node/Express/Mongoose backend**. It is
  a *sibling* of this workspace (not nested inside it), so tools that operate on
  paths relative to the workspace can't reach it directly — use the absolute
  path or a `cd` when you need to read/edit it.

> Source of truth for architecture: [`🛡️ .roorules`](.roorules). This file
> describes the **actual, current state** of both folders. Where the live code
> intentionally deviates from `.roorules`, it is called out inline.

---

## 1. Tech stack — frontend (from `package.json`)

- **Runtime/build**: Vite (`vite.config.js`, `appType: 'spa'`), React 19,
  `@vitejs/plugin-react`.
- **Styling**: Tailwind CSS **v4** via `@tailwindcss/vite`. Theme lives in CSS:
  [`index.css`](src/index.css) does `@import "tailwindcss"` + `@import
  "./aurora.css"` plus a small `@theme`, and declares the shared
  `.font-heading` / `.font-body` utilities. (There is deliberately **no**
  `tailwind.config.js` — v4 does not read one, and the stale leftover was
  removed so nobody edits config that does nothing.) A shared "Aurora" theme layer of
  `.aura-*` classes lives in [`src/aurora.css`](src/aurora.css); all chrome
  pages use these (spec: [`plans/unified-aurora-theme.md`](plans/unified-aurora-theme.md)).
- **State**: Zustand v5 (+`persist`) — [`playerStore.js`](src/playerStore.js),
  [`gameAccess.js`](src/gameAccess.js), [`students.js`](src/students.js),
  [`systemConfig.js`](src/systemConfig.js).
- **Routing**: `react-router-dom` v7 (`BrowserRouter`), routes in
  [`main.jsx`](src/main.jsx).
- **Animation**: `motion` (`import { motion } from 'motion/react'`).
- **Game engine**: Phaser **v4** for the canvas games (Game4/7/8/9/BonusGame1),
  wrapped in React by `BaseGame`.
- **Drag/drop**: `@dnd-kit/*` — only the game reorder UI in
  [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx).
- **Badges/print**: `react-qr-code`, `html-to-image`, `jspdf` (student "Game
  Pass" badges, single PNG + whole-class PDF).
- **Extras**: `react-confetti`, `use-sound`, `react-helmet-async`, `clsx` +
  `tailwind-merge`, `react-use`.

Scripts: `dev`, `build`, `lint`, `preview`.

## 2. Tech stack — backend (`D:\K1 games project\server\package.json`)

- **Node + Express 4**, **Mongoose 8** + `mongodb` driver, `cors`, `dotenv`
  (CommonJS, `"type": "commonjs"`). `nodemon` for `npm run dev`.
- Deployed on Render; MongoDB Atlas. Single entry point
  [`server.js`](D:/K1 games project/server/server.js).

---

## 3. Directory tree — frontend (actual)

```
.                                   # d:/Phaser/games
├── .env                            # VITE_API_BASE_URL
├── .roorules · AGENT_IMPLEMENTATION_BRIEF.md
├── eslint.config.js · index.html · package.json · package-lock.json
├── README.md · PROJECT_CONTEXT.md
├── vite.config.js                  # react() + tailwindcss() + PWA + chunking
├── plans/
│   ├── class-type-admin-overhaul.md
│   ├── numbers-voice-shared-asset.md
│   └── unified-aurora-theme.md
├── public/
│   ├── _redirects · favicon-* · icons.svg · qr-icon.png · robots.txt
│   ├── llms.txt · logo.png · og-image.png · site.webmanifest · sitemap.xml
│   ├── android-chrome-192/512x512.png · apple-touch-icon.png
│   ├── chest_closed.png / chest_open.png
│   └── PhaserAssets/ (bg_music.m4a · wrong.wav · pop_fx/)
└── src/
    ├── main.jsx                # providers + router + lazy() imports + two error boundaries
    ├── ErrorBoundary.jsx       # app-level + per-route crash recovery
    ├── seo.jsx                 # per-route canonical + robots (RouteSeo)
    ├── cn.js                   # shared clsx + tailwind-merge helper
    ├── index.css · aurora.css  # Tailwind entry + shared .aura-* utilities
    ├── brand.js · BrandLoader.jsx          # logo/icon URLs + shared loader
    ├── playerStore.js          # persisted zustand: the ONE credential + identity
    ├── gameAccess.js           # GAME_CATALOG + classId read store + classId mutators
    ├── logPlaySession.js       # per-play logging + stats/plays/leaderboard fetchers
    ├── students.js             # roster zustand + student/identity APIs
    ├── classInfo.js            # class info API (classId-scoped)
    ├── systemConfig.js         # maintenance-mode store (polled)
    ├── NameGate.jsx            # whole-app entry gate (code-first)
    ├── TeacherOnboarding.jsx   # /teacher-onboarding guide (renderer only)
    ├── teacherOnboardingContent.js  # guide copy + ONBOARDING_GIFS map
    ├── MaintenanceGate.jsx     # app-wide maintenance overlay + staff ribbon
    ├── GameAccessGate.jsx      # per-game unlock gate
    ├── GameAccessPage.jsx      # /game-access route wrapper (teachers only)
    ├── GameAccessPanel.jsx     # role-based control panel (see §10.5)
    ├── StatsPanel.jsx · MissionHeroes.jsx  # teacher stats + weekly mission
    ├── StudentLogin.jsx        # /p/:code auto-login
    ├── StudentBadge.jsx        # QR "Game Pass" badge (PNG + class PDF)
    ├── BetaHome.jsx · BetaHome.css   # THE home page (root route) + public landing
    ├── PublicLanding.jsx       # signed-out marketing copy inside BetaHome
    ├── NextGameTimer.jsx       # schedule-driven "next game" countdown
    ├── WeeklyGoals.jsx · FeedbackButton.jsx · ContactStrip.jsx
    ├── RotateHint.jsx · confirmDialog.jsx
    ├── App.jsx / App.css       # legacy shell (unused)
    ├── Game1.jsx · Game2.jsx · Game3.jsx · Game5.jsx · Game6.jsx
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
Each `BonusGames/<name>/` folder contains `assets.js · audioState.js ·
levels.js · Game.jsx · GamePage.jsx` plus game-specific scene files (§13).

## 4. Directory tree — backend (`D:\K1 games project\server`, actual)

```
server/
├── .env · .env.example          # MONGODB_URI, PORT, ALLOWED_ORIGINS, ADMIN_CODE
├── package.json · package-lock.json
├── server.js                    # entire Express API + auth + boot migrations
├── directory.js                 # DB-backed teacher/class lookup + seed
├── logPlaySession.js            # legacy client-side copy (unused by server)
├── SETUP.md · IMPLEMENTATION_PROMPT.md
└── models/
    ├── ClassInfo.js             # classId, className, classCode, isPublic, ...
    ├── Teacher.js               # code, name, classId, role
    ├── GameAccess.js            # classId, gameKey, added, unlocked, unlockAt, ...
    ├── PlaySession.js           # one row per completed round
    ├── PlayerMerge.js           # name-identity merge groups
    ├── Student.js               # studentId, classId, fullName, nickname, code
    └── SystemConfig.js          # maintenance mode singleton
```
There is **no `teacherCodes.js` on either side any more** — the old static
teacher-code mirror was removed (an older revision of this doc referenced it).

---

## 5. Core domain model

- **ClassType**: `'k1' | 'k2'` (enum, not its own collection). Historically
  determined game arrangement, but that role is **retired** — see GameAccess.
- **Class** (`ClassInfo`): `classId` (unique), `className`, `classYear`,
  `classAlias`, `classCode` (unique + sparse), `isPublic`, `active`, `image`
  (nullable → placeholder), and a **deprecated** `classType` kept only so legacy
  documents validate. Teacher list is *derived* by querying Teacher for a
  matching `classId`, never stored on the class.
- **Teacher** (`Teacher`): `code` (unique access code), `name`, `classId` (home
  class), `role: 'teacher' | 'admin'`.
- **Student** (`Student`): `studentId` (server-generated UUID, not Mongo `_id`),
  `classId`, `fullName`, `nickname` (primary display name), `group`, `code`
  (6-char, unique, sparse), and `mergedInto`/`mergedAt`/`mergedBy` for merges.
  Each student's QR "Game Pass" hits `/p/<code>`.
- **GameAccess**: scoped by **classId** (one row per `{classId, gameKey}`, unique
  **partial** index). Fields: `added` (opted in from the catalogue), `unlocked`,
  `shiny` (featured), `order`, `unlockAt`, `updatedBy`, `updatedAt`. A
  deprecated `classType` field survives on migrated rows purely as a rollback
  backup — it is excluded from the index by the partial filter and drives
  nothing.
- **PlayerMerge**: name-based merge groups within one class. `primaryName`,
  `members[]`, `active`. The authoritative merge record, because merges mostly
  target "light" kids who have no Student row (`Student.mergedInto` is still
  written when a merged name maps to a roster student, so student-code logins
  resolve to the primary too).
- **PlaySession**: one row per completed round, `classId`-scoped: `game`,
  `playerName`, `studentId`, `classId`, `stars`, `totalRounds`, `peakStreak`,
  optional `elapsedSeconds`/`mistakes`, `mergedFrom`, `completedAt`, and a
  `device` fingerprint `{kind, os, browser, userAgent}`.
- **SystemConfig**: singleton (`_id: 'system'`) holding `maintenanceMode`,
  `maintenanceMessage`, `maintenanceEndsAt`.
- **Legacy default**: `classId: 'k12026-pny'`, `classType: 'k1'`
  ("Kindergarten 1"). classId-scoped fallbacks use this id; classType defaults to
  `'k1'` when unset.

---

## 6. Auth model — two tiers, both DB-validated server-side

- `isTeacher` / `isAdmin` in [`playerStore.js`](src/playerStore.js) are **UI
  state only — not a security boundary**. Every write endpoint re-validates the
  code against the DB.
- **`requireTeacher`** — valid teacher/admin code. Grants: view own class info,
  full student/roster CRUD + identity merge for the actor's own class, delete
  plays, and read stats/summary/plays.
- **`requireAdmin`** — `requireTeacher` + `role === 'admin'`; 403 otherwise.
  Currently used by class create/update, `PATCH /api/system/config`, and the
  admin stats routes.
- **`requireClassAccess`** — the workhorse for class-scoped writes: an admin may
  target **any** classId, a teacher only their **own**. Gates the per-class
  student merge/unmerge/delete routes and **all `GameAccess` writes**.
  > Note: `.roorules` describes GameAccess writes as admin-only, but the live
  > code lets a teacher manage their own class's games, and the panel exposes a
  > teacher Games tab accordingly. Treat the code as authoritative here.
- **Code namespace**: teacher, class, student and admin codes share ONE global
  namespace. `findCodeOwner()` is called by every create/update that changes a
  code (`POST /api/codes/check` backs the live UI availability badge); the admin
  code comes from `ADMIN_CODE` in the environment.
- **Login**: code-first (see §7). There is **no client-side teacher-code mirror**
  and no `teacherCodes.js` fallback.

---

## 7. Login system (current, in detail)

[`NameGate.jsx`](src/NameGate.jsx) is the whole-app entry gate rendered by
BetaHome and every `GamePage`. It is **code-first**: one code field, classified
server-side, branching into three outcomes.

### 7.1 Flow
1. A code is submitted (or picked up from `?code=` / `?studentCode=` /
   `?classCode=` / `?teacherCode=` in the URL, which auto-runs the flow).
2. `POST /api/code-lookup` classifies it:
   - `teacherCode` / `adminCode` / `studentCode` → **signs in immediately**.
   - `classCode` → advances to step 2: a **name** prompt for a *public* class,
     or a **student code** prompt for a *private* one.
3. A stored session only counts if it carries an `identityKind`, which every
   path sets. Old pre-code-only sessions were wiped once via the persist
   `version` bump (see §7.3).

### 7.2 Sign-in actions ([`playerStore.js`](src/playerStore.js))
- `signInWithCode(code)` — sets `{code, mode:'code'}`, then `hydrate()`.
- `signInLight(name, classCode)` — sets `{code, name, mode:'light'}` for a
  public-class "light" student, then `hydrate()`.
- `hydrate()` — re-posts the stored credential to `/api/code-lookup` (mode
  `code`) or `/api/student-login` (mode `light`) to rebuild the identity. If it
  no longer resolves, the session is cleared and the user signed out.
- `signOut()` / `resetPlayer()` (alias).

### 7.3 Persisted identity
Zustand `persist`, **localStorage key `ezwonders-player`, version 3**.
`partialize` keeps **only** `{ code, name, mode }` — deliberately nothing else,
so a removed/edited user is signed out on the next validation. Everything else
(`playerName`, `classId`, `className`, `classAlias`, `classCode`, `classType`,
`studentCode`, `studentId`, `isTeacher`, `isAdmin`, `teacherCode`,
`identityKind`, `status`) is **runtime-only** and re-derived from the DB.
The legacy `k1weekly-player` key is explicitly removed on boot.
`AuthBootstrap` in [`main.jsx`](src/main.jsx) awaits `hydrate()` before the app
renders, so a signed-in user never flashes the login screen.

### 7.4 Student QR login
[`StudentLogin.jsx`](src/StudentLogin.jsx) handles `/p/:code` →
`lookupStudentByCode(code)` → `GET /api/student-login/:code`.

---

## 8. Routing (`src/main.jsx`)

`startSystemConfigPolling()` fires at module scope (before render) so the
maintenance request races auth hydration instead of queueing behind it. All
games are `lazy()`-loaded. Providers: `HelmetProvider → BrowserRouter →
RotateHint + ConfirmHost → AuthBootstrap → MaintenanceGate → Suspense`.

| Path | Component |
|---|---|
| `/` | `BetaHome` — **the real production home** (public landing + NameGate) |
| `/beta-ezwonders` | `Navigate to="/"` (legacy alias) |
| `/game1` … `/game6` | `Game1` … `Game6` (React games) |
| `/game10` | `BonusGames/Game 10/GamePage` — **Feed the Shapes** |
| `/game4` | `BonusGames/Game4/GamePage` |
| `/game7` | `BonusGames/Game 7/GamePage` |
| `/game8` | `BonusGames/Game 8/GamePage` — **Pizza Order!** |
| `/game9` | `BonusGames/Game 9/GamePage` — **Polly's Treasure Quest** |
| `/bonus-game1` | `BonusGames/BonusGame1/GamePage` — Number Pop! |
| `/game-access` | `GameAccessPage` |
| `/teacher-onboarding` | `TeacherOnboarding` — the teacher guide |
| `/p/:code` | `StudentLogin` |

`Home.jsx` (the older, simpler home layout that BetaHome replaced at `/`) has
been **deleted**. It was unrouted dead code, but it duplicated the game grid,
`GameCard` and timer wiring, so every feature change cost edits in two places.

Routing is not gated by the route itself — each Phaser `GamePage.jsx` composes
`NameGate → GameAccessGate`; React games are reached via the home grid (already
inside NameGate). Every one of them is named `GamePage.jsx` so the six Phaser
entry points share a single name; only the folder distinguishes them.

---

## 9. Frontend gating flow

1. **`NameGate`** — resolves the credential (see §7).
2. **`GameAccessGate`** — re-checks per-game unlock via `useIsGameUnlocked`;
   teachers pass straight through (checked **before** the loading gate, since the
   admin has no classId and would otherwise spin forever). Fetches access itself
   if it isn't loaded for the current classId, so a bookmarked game URL works.
3. **`BetaHome`** — fetches the same access data for the game grid, per-player
   progress from `fetchSummary`, and renders `NextGameTimer`.

The read/gating path is **classId-based**: the client passes its classId as-is
and the server returns that class's rows. New game routes need both gates, in
that order.

---

## 10. Key screens & frontend files

### 10.1 [`gameAccess.js`](src/gameAccess.js)
- **`GAME_CATALOG`** — canonical list of **10** games: keys `1`…`9` + `b1`
  (`1` Count & Win! · `2` Comparing Quantities · `3` Which Number? ·
  `4` Compare Die and Dominoes · `5` Making & Splitting Groups ·
  `6` Part-Part-Whole! · `7` Mama Bird's Eggs · `8` Pizza Order! ·
  `9` Polly's Treasure Quest · `b1` Number Pop!). Entries carry `key`, `emoji`,
  `label`, `title`, `subtitle`, `description`, `hue`, `tint`, `to`,
  `progressKey`, `gradient`, `ring`, and `isBonus` (b1 only).
- **Read store** `useGameAccessStore` (classId-based, used by BetaHome/Gate):
  `unlocked`, `games`, `loaded`, `loadedClassId`, `loading`, `error`,
  `fetchGameAccess(classId)` — 12 s timeout, aborts superseded requests, and
  **seeds from a localStorage cache** (`ezw.gameAccess.v1`, 7-day max age) so the
  grid paints before a cold Render instance wakes. Local helpers:
  `setUnlockedLocal`, `setShinyLocal`, `setUnlockAtLocal`, `setOrderLocal`,
  `replaceRows`.
- **`mergeRows(rows)`** — merges raw server rows (`gameKey`, `unlocked`, `shiny`,
  `order`, `unlockAt`) onto `GAME_CATALOG`, keeping only games that have a row
  ("added"), sorted by `order`.
- **Helpers** `useIsGameUnlocked`, `isGameUnlockedNow`.
- **Scheduling helpers** `nextScheduledGame(games)` (soonest `!unlocked &&
  unlockAt`, else null) and `useNextScheduledGame()`.
- **ClassId-scoped mutators** (used by the panel):
  `fetchGameAccessForClass(classId, teacherCode)`, `setGameUnlockedForClass`,
  `setGameShinyForClass`, `setGameOrderForClass`, `setGameUnlockScheduleForClass`,
  `addGameForClass`, `removeGameForClass`.
- **Legacy classType-scoped mutators** (`setGameUnlocked`, `setGameShiny`,
  `setGameOrder`, `addGameToClass`, `removeGameFromClass`,
  `fetchGameAccessForType`, `…ForType`) still exist but are **unused**.

### 10.2 [`logPlaySession.js`](src/logPlaySession.js)
- **`logPlaySession(...)`** — `POST /api/plays`; reads `classId` from the store
  with a legacy fallback; attaches a client-side `detectDevice()` fingerprint.
  Failures only `console.warn` (never break the game).
- Completion slugs: `game1`…`game9`, `bonusGame1`.
- **Fetchers**: `fetchStats(teacherCode)`, `fetchSummary(...)` (paginated
  `{rows,total,page,limit,hasMore}` for the panel, plain array for a single
  player), `fetchPlaysPage(...)`, `fetchLeaderboard(classId)`,
  `fetchPlayerWeekly(classId, playerName)`, `fetchWeeklyMission(teacherCode)`,
  `fetchAdminClassStats(teacherCode)`, `fetchAdminClassDetail(classId,
  teacherCode)`, and `deletePlayerGame(game, playerName, teacherCode)`.

### 10.3 [`students.js`](src/students.js)
Zustand `useStudentStore` (classId-scoped, 12 s timeout): `students`, `loaded`,
`loadedClassId`, `fetchStudents(teacherCode)`, `reset`, and optimistic
`addStudentLocal`/`updateStudentLocal`/`removeStudentLocal`.
API helpers: legacy `addStudent` / `updateStudent` / `deleteStudent` /
`lookupStudentByCode`, plus the class-scoped set the panel uses:
`fetchClassIdentities(classId, teacherCode)` (roster ∪ distinct play names),
`addStudentToClass`, `updateStudentInClass`, `deleteStudentInClass`,
`deleteIdentityInClass` (**name-only** identities — removes their play sessions),
`mergeIdentities`, `unmergeIdentity`, and the exported `generateStudentCode()`.

### 10.4 [`classInfo.js`](src/classInfo.js) / [`systemConfig.js`](src/systemConfig.js)
- `classInfo.js` — `fetchClassInfo`, `fetchClasses`, `createClass`, `updateClass`,
  `setClassPublic`, `setClassCode`, `checkCodeAvailable`.
- `systemConfig.js` — maintenance-mode zustand store. Reads its last-known value
  from localStorage (`ezw.systemConfig.v1`) so the flag never blocks first paint,
  then polls to correct it live.

### 10.5 [`GameAccessPanel.jsx`](src/GameAccessPanel.jsx) — the controls
Rendered as a full-screen overlay; [`GameAccessPage.jsx`](src/GameAccessPage.jsx)
maps its `onClose` to `navigate('/')` and supports a `?tab=` override. The header
carries a **Teacher guide** button linking to `/teacher-onboarding` (§10.9). Tab
sets are **role-split**:
- **Teacher**: **Games · Catalogue · Students · Stats · Settings**, all scoped to
  their own classId.
- **Admin**: **Classes · Catalogue · Stats · Settings**. Admins pick a class from
  the Classes tab and manage that class's games inline.

**Games editor (`GameAccessEditor`)** — per classId, used for both roles:
- Fetches via `fetchGameAccessForClass` into a local `draftGames` snapshot with a
  "Player access X / Y open" counter and **Unlock all / Lock all**.
- **Reorder** via `@dnd-kit` sortable slots (pointer + keyboard); bonus games
  labelled "BONUS", numbered games get running slot labels.
- **Lock/unlock** switch, **featured/shiny** (✨), and a **clock button** that
  opens `ScheduleUnlockDialog` (a `datetime-local` prompt). Rows with a pending
  schedule show an "⏰ Unlocks …" badge. The clock button is hidden once a game is
  unlocked. Scheduling writes through immediately (it has its own confirm) so it
  can't discard unsaved reorder/lock drafts; unlocking a game clears its schedule.
- **Confirm changes** batches only the deltas: order → `setGameOrderForClass`,
  then unlock/shiny per change. **Reset** restores the last-saved snapshot.

**Catalogue tab (`GameCatalogue`)** — the full `GAME_CATALOG` as a searchable
add/remove list; searching matches title, subtitle and description.
`addGameForClass` / `removeGameForClass` then re-fetch.

**Students tab (`StudentsTab`)** — `AddStudentForm` (name + optional group +
generated code), an identity list (`IdentityRow`) supporting inline edit, delete
with confirm, QR badge, and multi-select merge; a hidden "merged identities"
section with unmerge. Rostered students are editable; name-only "light"
identities are selectable and deletable but not editable.

**Settings tab** — teacher: class info, privacy toggle, editable class code,
sign-out. Admin: identity + global maintenance mode + message/end-time.

### 10.6 [`StatsPanel.jsx`](src/StatsPanel.jsx) / [`MissionHeroes.jsx`](src/MissionHeroes.jsx)
Teacher stats dashboard (embedded tab or modal, `adminMode` for admins):
header stat cards from `fetchStats` (all-classes vs per-game), a game filter
dropdown, debounced player search, and two views — **Summary** (`fetchSummary`,
one row per player+game, two-tap "Confirm?" delete) and **All plays**
(`fetchPlaysPage`, every raw session incl. a **device** column). Infinite scroll
via a shared `usePaginatedList` + IntersectionObserver; the server owns
filtering/sorting/paging (PAGE_SIZE 50). Phones get stacked cards, sm+ gets
sortable tables.

### 10.7 [`StudentBadge.jsx`](src/StudentBadge.jsx)
QR "Game Pass" per student: 410×580 px → 300 DPI PNG with true alpha corners,
copy login link, and **Print all badges** → multi-page A4 PDF (3×3 grid) via
`html-to-image` + `jsPDF`. The QR points at `${SITE_URL}/p/<code>`.

### 10.8 [`NextGameTimer.jsx`](src/NextGameTimer.jsx) — scheduled unlocks
**Schedule-driven, not calendar-driven.** The old hardcoded "new game every
Friday" countdown is gone; there is no default cadence.
- Renders **nothing** when the class has no pending schedule. Callers gate it on
  `useNextScheduledGame()` so surrounding layout collapses cleanly (BetaHome's
  `TimerLeaderboardCard` also drops its divider; the Weekly Champions leaderboard
  always shows regardless).
- Names the soonest scheduled game and counts down in days/hours/mins/secs.
  Ticks every second, resyncing to the wall clock; at zero it calls
  `fetchGameAccess()` so the server applies the due unlock and the banner either
  rolls on or disappears.
- Teachers see it too (schedule preview); the admin has no class, so it
  self-hides.

### 10.9 [`TeacherOnboarding.jsx`](src/TeacherOnboarding.jsx) — the teacher guide
`/teacher-onboarding`. A six-step walkthrough of the panel (Log in · Games ·
Catalogue · Students · Stats · Settings). **No copy or imagery lives in the
component** — everything comes from
[`teacherOnboardingContent.js`](src/teacherOnboardingContent.js):
`ONBOARDING_SECTIONS` (blocks typed `p` / `bullets` / `cards` / `sub` /
`callout`) and `ONBOARDING_GIFS`, a `{ sectionId: url }` map. Paste a URL into
that map to ship a section's animation; an empty string renders the dashed
"coming soon" placeholder automatically, and a broken URL falls back to it via
`onError`. Each section is a half-and-half row (text + visual) that alternates
sides on `lg`, with a sticky jump nav that tracks scroll position.

> **Do not rename the content file to `teacherOnboarding.js`.** It would differ
> from `TeacherOnboarding.jsx` only by case, and on a case-insensitive
> filesystem (Windows/macOS) an extension-less `./TeacherOnboarding` import can
> resolve to the data file instead of the component — producing a module with no
> default export and a runtime "lazy element type is invalid" crash.

The page is deliberately **public** — a teacher can read it before signing in —
so it is *not* wrapped in `NameGate`. Its "Control Panel" links still point at
`/game-access`, which does its own teacher check. The teacher guide button in
the panel header ([`GameAccessPanel.jsx`](src/GameAccessPanel.jsx)) links here.

It is also exempt from maintenance mode: `/teacher-onboarding` is listed in
`PUBLIC_DURING_MAINTENANCE` in [`MaintenanceGate.jsx`](src/MaintenanceGate.jsx:15),
so `showOverlay` stays false for it. The rationale is that a teacher locked out
during an outage is exactly who needs the sign-in documentation; the page is
read-only and reaches nothing privileged, and its panel links are still gated
server-side.

### 10.10 [`BetaHome.jsx`](src/BetaHome.jsx) — the home page
Wraps `NameGate` → `BetaHomeContent`, and renders [`PublicLanding.jsx`](src/PublicLanding.jsx)
marketing copy beneath the sign-in card while signed out. Signed in it shows the
hero/logo, player identity + switch-player, `WeeklyGoals` (students),
`TimerLeaderboardCard` (game timer strip + Weekly Champions podium), the game
grid (featured/shiny spotlight separate from regular, locked games overlaid
"Coming soon"), a surprise card that opens a random unlocked game, and
teacher/admin floating controls (→ `/game-access`).

---

## 11. Backend (actual) — `server.js` and friends

### 11.1 Express app setup
- Forces DNS servers (`8.8.8.8`/`1.1.1.1`) to survive Render networking.
- CORS allow-list from `ALLOWED_ORIGINS` (comma-separated) or `*`; requests with
  no `Origin` allowed.
- **`compression`** — gzip/deflate on every response (the JSON payloads here are
  large and repetitive).
- **`helmet`** — security headers, with `contentSecurityPolicy: false` (this
  server only returns JSON) and `crossOriginResourcePolicy: 'cross-origin'`
  (the frontend is a different origin).
- `express.json({ limit: '100kb' })` — explicit body cap.
- **Rate limiting** on the unauthenticated/abuse-prone routes only:
  `code-lookup`, `teacher-login`, `student-login`, `plays`, `feedback`.
  `app.set('trust proxy', 1)` is required for per-IP limits to work behind
  Render's TLS terminator. The authenticated write paths are deliberately
  unlimited — a whole class can burst through `/api/plays` at once, and a
  per-IP cap would throttle everyone behind one school NAT.
- `Cache-Control: no-store` on every `/api` response.
- **15 s hard request timeout** middleware → 504 `{error}`.
- `GET /api/ping` (trivial) and `GET /api/health` (real Mongo round-trip, keeps
  Atlas warm and thwarts Render spin-down).

### 11.2 Auth middleware
`teacherFromRequest` resolves the code; `requireTeacher` (401) and `requireAdmin`
(403) gate by role; `requireClassAccess` allows an admin to target any class but a
teacher only their own. `classIdFromRequest` / `requireClass` resolve and validate
a classId (400 when unknown). Boot-time migrations and `syncIndexes()` run in the
`mongoose.connect()` chain **before** `app.listen` (§11.6).

### 11.3 Routes (all fail with `{error}` + non-2xx)

**Auth / codes**
- `POST /api/teacher-login` — `{code}` → `{name, classId, className, classType, role}` or 401.
- `POST /api/code-lookup` — classifies a code → `teacherCode | adminCode |
  studentCode | classCode` payloads (drives the whole login flow).
- `POST /api/student-login` — mode A `{code}` / mode B `{name, classCode}` → identity.
- `GET /api/student-login/:code` — public; validates a 6-char code.
- `POST /api/codes/check` — live code-availability check for the UI.

**Classes**
- `GET /api/classes` · `GET /api/classes/:classId` (teachers derived from Teacher).
- `POST /api/classes` · `PUT /api/classes/:classId` — admin.
- `PATCH /api/classes/:classId/public` · `PATCH /api/classes/:classId/code`.

**Students / roster** (classId-scoped)
- `GET/POST /api/classes/:classId/students`,
  `PUT/DELETE /api/classes/:classId/students/:studentId`.
- `GET /api/classes/:classId/identities` — roster ∪ distinct play names + merges.
- `POST /api/classes/:classId/students/merge` ·
  `POST /api/classes/:classId/students/:studentId/unmerge` (pass the literal
  `name` as `:studentId` for a light identity).
- `DELETE /api/classes/:classId/identities/:name` — deletes a **name-only**
  identity by removing its play sessions (the only thing that makes it exist).
  409s if the name still matches a roster student. Matches `classId` against both
  the URL param *and* the actor's own classId.
- Legacy teacher-only `GET/POST /api/students`, `PUT/DELETE /api/students/:studentId`
  remain for backward compatibility.

**Game access / arrangement** (WRITE requires `requireClassAccess`)
- `GET /api/game-access?classId=` — public read; ownership enforced only when a
  `teacherCode` is supplied. Rows for `added: true`, sorted by `order` then
  numeric `gameKey`, each including `unlockAt`. **No hardcoded game-key
  allowlist** — the DB is the source of truth.
- `PUT /api/game-access/order` — validates the list is exactly the currently-added
  set, then `bulkWrite`s the order.
- `POST /api/game-access/:gameKey` — add from the catalogue (appends at
  `max(order)+1`, starts locked, clears any stale `unlockAt`).
- `DELETE /api/game-access/:gameKey` — soft-delete (`added:false`, resets
  lock/shiny/`unlockAt`).
- `PUT /api/game-access/:gameKey/shiny` — toggle featured.
- `PUT /api/game-access/:gameKey/schedule` — set `unlockAt` (400 on a past time,
  409 if already unlocked).
- `PUT /api/game-access/:gameKey` — lock/unlock; **unlocking clears `unlockAt`**.
- Route order matters: `/order`, `/:gameKey/shiny` and `/:gameKey/schedule` are
  declared **above** `/:gameKey` so they aren't shadowed.

**Scheduled unlocks** — `resolveDueUnlocks(classId)` runs lazily at the top of
`getGameAccessRows()`, flipping any due `unlocked:false` row and clearing
`unlockAt`. There is **no cron**, so a schedule still fires correctly after the
server slept through the exact minute. Any new read path that returns game rows
must call `getGameAccessRows()` rather than querying `GameAccess` directly.

To keep that write off the hot path, a module-scope `pendingUnlockCache` records
the soonest pending unlock per class and lets the sweep be skipped entirely when
it is comfortably in the future (re-checked at least every 30 s). It is a cache
for *skipping work*, never a source of truth — `getGameAccessRows()` re-reads
from Mongo on every request regardless. **Any write that can change `unlockAt`
must call `invalidateUnlockCache(classId)`** (schedule, lock/unlock, catalogue
add/remove all do).

**Plays / stats**
- `POST /api/plays` — logs one session (slug regex, clamped numeric fields,
  sanitized `device`).
- `DELETE /api/plays` — teacher-only; `{game, playerName, teacherCode}`.
- `GET /api/stats?teacherCode=` — `$facet` aggregation: totals + per-game
  breakdown (plays, unique players, avg stars, avg elapsed, best streak/player).
- `GET /api/summary?…` — one row per player+game, server-paginated; with
  `classId`+`playerName` returns a plain array for a single player.
- `GET /api/plays?…` — paginated raw sessions, newest first.
- `GET /api/leaderboard?classId=&since=` — public, class-wide weekly trophies.
- `GET /api/leaderboard/:game?classId=` — top 10 runs for one game.
- `GET /api/player/weekly` · `GET /api/weekly-mission` — weekly goals/mission.
- `GET /api/admin/stats/classes` · `GET /api/admin/stats/classes/:classId` — admin
  grid + drill-down.
- `GET/PATCH /api/system/config` — maintenance mode (read public, write admin).
- `POST /api/feedback`.

### 11.4 Shared server helpers worth knowing
- `getGameAccessRows(classId)` — the **only** sanctioned way to read game rows
  (auto-unlocks first).
- `resolveDueUnlocks(classId)` — the lazy unlock sweeper.
- `removeStudentPlaySessions(classId, student)` — a deleted student's own history
  goes with them, so the identity doesn't linger as a name-only entry.
- `resolvePrimaryStudent(student)` — walks `Student.mergedInto` chains.
- `findCodeOwner(code, exclude)` — global code-namespace uniqueness check.
- `classInfoPayload(classroom)` — the shared class payload for every login mode.
- List helpers `parseListParams` (clamps `limit`, whitelists sort keys) and
  `escapeRegex`; sort whitelists `SUMMARY_SORT_KEYS` / `PLAYS_SORT_KEYS`.

### 11.5 Models (`server/models/`)
- [`ClassInfo.js`](D:/K1 games project/server/models/ClassInfo.js) — `classId`
  (unique), `className`, `classYear`, `classAlias`, `classCode` (unique sparse),
  `isPublic`, `active`, `image`, deprecated `classType`.
- [`Teacher.js`](D:/K1 games project/server/models/Teacher.js) — `code` (unique),
  `name`, `classId` (indexed), `role` enum `['teacher','admin']`.
- [`GameAccess.js`](D:/K1 games project/server/models/GameAccess.js) — `classId`
  (indexed), `gameKey`, `added`, `unlocked`, `unlockAt`, `order`, `shiny`,
  `updatedBy`, `updatedAt`, deprecated `classType`; **unique partial index
  `{classId, gameKey}`** filtered on `classId` existing.
- [`PlaySession.js`](D:/K1 games project/server/models/PlaySession.js) —
  `classId` (default `'k12026-pny'`), `game`, `playerName`, `studentId`, `stars`,
  `totalRounds`, `peakStreak`, optional `elapsedSeconds`/`mistakes`, `mergedFrom`,
  `completedAt`, `device` subdoc (`kind` enum — **not** `type`, see §12).
- [`Student.js`](D:/K1 games project/server/models/Student.js) — `studentId`
  (UUID default), `classId`, `fullName`, `nickname`, `group`, `code` (unique +
  sparse, maxlength 6, uppercase), `mergedInto`. `directory.js` supplies the
  DB-backed `lookupTeacher`, `classTypeForClassId`, `getClasses`,
  `isKnownClass`, `seedDirectoryIfEmpty`.

### 11.6 Boot migrations
Ordered in the `mongoose.connect().then()` chain, all self-guarding/idempotent:
1. `ensureSystemConfig()`
2. `migrateAdminRole()` — defaults role-less teachers to `admin`.
3. `migrateClassFields()` — backfills `isPublic`/`active`/`classAlias`/`classCode`.
4. `migrateGameAccessToClassId()` — clones legacy classType-keyed rows into
   per-classId rows (dropping the old unique index **first**, then
   `syncIndexes()`). The classType rows are intentionally retained, not deleted.
5. `migrateStudentCodes()`, `auditCodeConflicts()`, then `syncIndexes()` for
   ClassInfo, Teacher, Student, PlaySession, PlayerMerge.
Connect options: `bufferCommands: false`, `maxIdleTimeMS: 720000`,
`serverSelectionTimeoutMS: 5000`.

---

## 12. Mongoose / Mongo gotchas

- Nested subdocument fields must avoid a key literally named `type` (Mongoose
  reads it as a type-declaration shorthand) — see `PlaySession.device.kind`.
- **Schema field changes don't migrate indexes.** Moving `GameAccess`'s unique
  key from `{classId, gameKey}` → `{classType, gameKey}` → back to
  `{classId, gameKey}` required explicitly dropping the old index and calling
  `syncIndexes()`; a schema edit alone does nothing in MongoDB. The current index
  is **partial** so legacy classType-only backup rows (which have no `classId`)
  can't collide with live per-class rows.
- Unscheduled rows hold `unlockAt: null`, which **sorts below every Date** — the
  due-unlock filter must be `{ $ne: null, $lte: now }`, since a bare `$lte` would
  match every unscheduled row.
- Boot-time data migrations must be self-guarding/idempotent (check absence of
  the new field / presence of the old before acting).
- `bufferCommands: false` + a tight `serverSelectionTimeoutMS` avoid silent hangs
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
  [`uiHelpers.js`](src/Phaser/common/uiHelpers.js),
  [`numbersVoice.js`](src/Phaser/common/numbersVoice.js),
  [`sceneAssets.js`](src/Phaser/common/sceneAssets.js),
  [`speech.js`](src/Phaser/common/speech.js) (`warmupSpeech`, TTS).

Per-game folder shape: `assets.js`, `audioState.js` (`isMuted`,
`ensureBgMusic`, `addMuteButton`), `levels.js` (`LEVELS`, `buildRounds`,
`progress`), game-specific scene files (e.g. `GameScene.js` emits a run-complete
event like `game8-complete`), `Game.jsx` (`BaseGame` mount whose `handleComplete`
calls `logPlaySession({ game: '<slug>', ... })`), and `GamePage.jsx`
(`NameGate → GameAccessGate` wrapper + page shell).

---

## 14. Conventions

- Comments explain *why*, not *what*.
- Prefer extending existing zustand stores / API helpers over parallel ones — one
  store per domain, one thin fetch-helper per API concern.
- Phaser canvas games use Phaser's native input; `@dnd-kit` is DOM-only.
- React `Confetti` is for level-complete overlays only; `use-sound` is not used in
  Phaser games (Phaser `this.sound` instead).
- Chrome pages share the `aura-*` theme from [`src/aurora.css`](src/aurora.css) —
  don't hand-roll new sky/white themes.
- **The backend needs no redeploy when a new game is added** — `GAME_CATALOG`
  (frontend) and the `GameAccess` DB rows drive everything; the server only
  validates generic slug/key regexes.
- `VITE_API_BASE_URL` (frontend, defaults to `http://localhost:4000`);
  `MONGODB_URI` (backend).

---

## 15. Adding a new game — checklist

1. Build the game component/scene under `src/` (React or `BonusGames/<Name>/`).
2. Add a `lazy()` import + `<Route>` in [`main.jsx`](src/main.jsx).
3. Add an entry to `GAME_CATALOG` in [`gameAccess.js`](src/gameAccess.js).
4. Wrap the route content in `NameGate` → `GameAccessGate`.
5. Call `logPlaySession(...)` on completion with the matching `game` slug.
6. Add the slug's emoji/label to `GAME_LABELS` in
   [`StatsPanel.jsx`](src/StatsPanel.jsx) so stats render nicely.
7. It appears once a teacher/admin adds it to a class from the **Catalogue**
   tab (`addGameForClass`). No server change is required.

---

## 16. Adding a new class type (e.g. future 'k3')

1. Add the value to the `classType` enum in `server/models/ClassInfo.js` and
   `server/models/GameAccess.js`.
2. Add it to any classType-labelled UI (the admin Classes flow).
3. Note that `classType` no longer drives game arrangement — per-class
   `GameAccess` rows do. An empty class type is a valid, expected state.
