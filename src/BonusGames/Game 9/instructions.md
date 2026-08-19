# Game 9 — Boilerplate

Placeholder build spec. Replace this file with the real Game 9 design doc
(see `Game 7/idea.md` or `Game 8/instructions.md` for the established
format) once the game concept is decided.

## Current wiring

- `PhaserDemo.jsx` — `NameGate` → `GameAccessGate` (gameNumber 9) → the
  gradient page shell + `<Game>` canvas.
- `Game.jsx` — builds `PreloadScene` → `GameScene`, logs completion to the
  `game9` slug via `logPlaySession`.
- `GameScene.js` — placeholder "Coming soon" scene (renders, so the whole
  load path can be verified before real gameplay exists).
- `assets.js` — empty manifest; fill `IMAGES`/`AUDIO` once designed.
- `audioState.js` — mute + `bgMusic` helpers (`game9-muted-v1`).
- `levels.js` — placeholder; add level cards or a round builder per the
  chosen shape.

## When designing the real game

1. Fill `IMAGES` / `AUDIO` in `assets.js` (spread `NUMBERS_VOICE_MANIFEST`
   if it speaks numbers 1–10).
2. Replace `levels.js` (level cards + `createStarProgress`, or
   `buildRoundSequence()`).
3. Replace the placeholder body in `GameScene.js` — add a
   `LevelSelectScene.js` first if it needs level cards, following Game 7.
4. Update the `GAME_CATALOG` entry in `src/gameAccess.js` with the real
   emoji / title / subtitle / theme.
5. Update the `game9` label in `src/StatsPanel.jsx`.
