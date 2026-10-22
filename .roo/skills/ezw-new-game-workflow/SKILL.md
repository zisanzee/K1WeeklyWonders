---
name: ezw-new-game-workflow
description: Use when the user wants to create, scaffold, build, extend or rename a game in EZ Wonders (K1 Weekly Wonders) - from a game idea to a working game. Covers the phased build order, registry wiring, boilerplate rules, "(in works)" naming, shared Phaser building blocks, completion logging and icons.
---

# New game workflow (idea -> shipped game)

A game = **one folder in `src/games/<slug>/` + one `GAME_REGISTRY` entry**. Routes, catalogue, prefetch and stats labels all derive from the registry. No server change or redeploy is ever needed.

## Never
- Never add a `lazy()` import or `<Route>` for a game in `main.jsx`; never edit `GAME_CATALOG` directly.
- Never change an existing game's `key` / `slug` / `route` / `progressKey`.
- Never copy mute/audio code per game or add a per-game mute key (use `@/phaser/common/audioState`).
- Never inline tunable numbers (skill `ezw-game-tuning`).

## Phase 0 - Learn the house style (always, ~2 minutes)
1. Read `src/games/registry.js`.
2. Pick the existing game closest to the request (same input style: tap / drag / choose) and read its `GamePage.jsx`, `Game.jsx`, scene, `levels.js`, `tuning.js`, `assets.js`. Copy its structure; do not invent a new one.
3. Skim shared code you will reuse: `src/phaser/BaseGame.jsx`, `BasePreloadScene.js`, `BaseScene.js`, `common/` (`starProgress`, `uiHelpers`, `numbersVoice`, `speech`, `sceneAssets`, `audioState`). If unsure a helper exists, read the file; do not re-add a near-duplicate.

## Phase 1 - Spec (write it down before coding)
Produce a short spec and show it to the user if anything is ambiguous (ask at most one question):
- Learning goal and number range (skill `ezw-k1-numeracy-design`).
- Core interaction in one sentence + input type (skill `ezw-phaser-interaction-juice`).
- Round structure: rounds per run, difficulty ramp, how stars are earned.
- Assets needed (skill `ezw-game-assets`).
- Name, emoji, card colours. Title, on-screen heading and catalogue `label` must agree; search the registry so no other game shares the name.

## Phase 2 - Scaffold (wiring only)
Create `src/games/<slug>/` with:
- `GamePage.jsx`: `NameGate` -> `GameAccessGate` (correct `gameNumber`/`gameLabel`) -> `Game`. Copy from a sibling.
- `Game.jsx`: `BaseGame` + `BasePreloadScene`, `completeEventName` / `onComplete` wired to `logPlaySession({ game: '<progressKey>', ... })`.
- `GameScene.js`: paints shared sky + mute button only.
- `assets.js` (empty `IMAGES` at first), `tuning.js` (backdrop/placeholder/mute only).
- Registry entry: unique `key`, `slug`, opaque unique 5-digit `route`, `term`, `progressKey`, card `meta`, `load: () => import('@/games/<slug>/GamePage')`.

**When the user asks only for "boilerplate"/"skeleton", stop here.** No mechanic, rounds, scoring, HUD, start/end screens or placeholder gameplay. Ship it named `'(in works)'`: `meta.label` and `meta.title` both exactly `(in works)`, the same string in `GamePage.jsx` `gameLabel` values and any on-screen heading, a subtitle saying it is unfinished, generic emoji/colours. Rename all together only when it really works.

## Phase 3 - Build the mechanic incrementally
Do one slice at a time and run `npm run lint` + `npm run build` after each (skill `ezw-verify-and-playtest`):
1. `levels.js`: pure round generator + Vitest tests first (skill `ezw-round-generators-testing`).
2. Static scene: render one round from `buildRounds()` with placeholder shapes, numbers from `tuning.js`.
3. Interaction: input, correct/wrong handling, feedback (skill `ezw-phaser-interaction-juice`).
4. Round flow: next round, difficulty ramp, run complete -> stars -> `logPlaySession`.
5. Start/end screens, replay, star progress (`createStarProgress`).
6. Real art + audio, replace placeholders (skill `ezw-game-assets`).
7. Perf + QA pass (skills `ezw-tablet-performance`, `ezw-verify-and-playtest`).
Finish the rename from `(in works)` only at the end.

## Wiring details
- `logPlaySession({ game })`: `game` must equal the entry's `progressKey`. Fire-and-forget; failures only `console.warn`.
- Optional icon: `public/game-icons/<slug>.png` + one line in `@/games/gameIcons.js` (root-relative `/game-icons/...`).
- It appears only after a teacher/admin adds it to a class from the Catalogue tab. Say so in your final message.
- React games (a single `Game.jsx`) are reached via the home grid, already inside `NameGate`; Phaser games compose both gates in `GamePage.jsx`.
