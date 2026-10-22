---
name: ezw-game-tuning
description: Use whenever writing or editing a game scene or Game.jsx in EZ Wonders - any layout, timing, speed, easing, colour, alpha, size, offset or depth number belongs in src/games/<slug>/tuning.js, never inline. Also use when asked to adjust, tweak or move magic numbers.
---

# Game tunables live in tuning files (MANDATORY)

Every adjustable magic number a game reads must live in `src/games/<slug>/tuning.js` (or `<slug>Tuning.js` if the game already has one, e.g. `roadTuning.js`). `GameScene.js` / `Game.jsx` are logic only and import the numbers.

## Rules
- Put layout, timing, speeds, easings, colours, alphas, sizes, offsets, depths and geometry in tuning. Give each a short *why* comment.
- Prefer fractions (`Frac`) of the canvas so tuning survives a different base resolution.
- Group by concern (`TRAIN`, `TRACK`, `CONTROLS`, ...) and export one aggregate `TUNING` object (for a future live-tuning panel).
- The tuning file imports **nothing** (dependency-free so it hot-reloads).
- Not tuning (stay in place): asset texture keys, the `game` slug passed to `logPlaySession`, event names like `game14-complete`.
- Pure round/curriculum logic goes in `rounds.js` / `levels.js`, not tuning.
- If a scene hardcodes a number a developer might reasonably want to change without reading the logic, that is a bug: move it.

## When editing an existing scene
1. Open the game's tuning file first; reuse an existing group/constant before adding one.
2. When you touch a scene, move any inline numbers you encounter in the lines you change.
3. Before finishing, grep the scene for numeric literals (`grep -nE "[0-9]{2,}|0\.[0-9]+"`) and justify or move each remaining one.

## Template
```js
// tuning.js - no imports on purpose (hot-reload friendly)
export const BACKDROP = {
  // why: fraction of canvas height so it survives a new base resolution
  cloudY: 0.18,
}
export const MUTE = { x: 0.92, y: 0.06 }
export const TUNING = { BACKDROP, MUTE }
```
