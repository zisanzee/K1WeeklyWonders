# Game 9 — "Polly's Treasure Quest" (Number Bonds via Keys & Chests)

Polly the pirate parrot guards a row of treasure chests. Every bond in this
game is built from **one FIRST-half key and one SECOND-half key** — the two
key art sets are always combined, never two keys from the same half.

**No level select screen.** One continuous run of **10 rounds** — rounds 1–5
are **Level 1** ("find the chest"), rounds 6–10 are **Level 2** ("find the
keys"). Score logs once, at the end of round 10.

---

## 1. Concept summary

- **Level 1 — find the chest**: the question shows one first-half key and
  one second-half key (side by side). Three chest options are shown; the
  child taps the chest whose number is their sum.
- **Level 2 — find the keys**: a chest shows the **whole** N. Four key
  options are shown — 2 first-half keys (stacked in the left column) and 2
  second-half keys (stacked in the right column). The child taps one key
  from each half; when the two add up to N the chest opens.
- **Polly** sits top-center as the mascot (`Polly` texture; swaps to
  `PollyHappy` on a correct answer).
- The whole game is **one scene** (`GameScene`) running an internal
  `roundIndex` `0..9` and a per-round `phase` of `'playing'` → `'success'`
  → next round (or finish at round 10).

---

## 2. Assets already wired (do not re-fetch/rename)

From `assets.js` (all URLs already filled in):

**Images**: `keyFirstHalf-1..9` and `keySecondHalf-1..9` (each image already
has its number baked in — the number on a key is the image key's suffix),
`chest-locked`, `chest-unlocked` (no number baked in — overlay the number
with Phaser text), `background`, `Polly`, `PollyHappy`.

**Audio**: `ahoyKey` ("Ahoy, choose the key that this chest needs"),
`ahoyChest` ("Ahoy, these two keys go in the same chest. Which chest holds
them both?"), `treasureFound` ("Treasure found!"), `correct` ("Correct"),
`wrongKey` ("Not quite, try another key"), `wrongChest` ("Not quite, try
another chest"), `treasureHunter` ("ye be a true treasure hunter"),
`chestOpening` (SFX), `bgMusic`.

**Not needed**: `NUMBERS_VOICE_MANIFEST`. Game 9 never speaks numbers aloud —
keys have their number baked into the art and chest numbers are text
overlays, so the fixed phrases above are the only voice needed.

---

## 3. Data model — `levels.js`

Keep this file Phaser-free (no `import Phaser`). Numbers are constrained by
the art: key values **1–9**, whole/chest values **2–10**.

```js
export const TOTAL_ROUNDS = 10;
export const ROUNDS_PER_LEVEL = 5;
export const LEVELS = { FIND_CHEST: 1, FIND_KEYS: 2 };
```

**Level 1 (find the chest) round shape:**
```js
{ level: 1, firstKey, secondKey, whole, chestOptions }
// whole = firstKey + secondKey; chestOptions = 3 shuffled values 2-10
```

**Level 2 (find the keys) round shape:**
```js
{ level: 2, whole, firstKey, secondKey, firstHalfOptions, secondHalfOptions }
// whole = firstKey + secondKey; each half's options = [correct, 1 distractor]
```

**Generation rules:**

- `buildRoundSequence()` builds all 10 rounds **up front**: 5 level-1
  (find the chest) rounds then 5 level-2 (find the keys) rounds.
- **Level 1**: `firstKey = randInt(1, 9)`, `secondKey = randInt(1, 10 -
  firstKey)` so the sum never exceeds 10. Chest distractors are `whole ±
  1..3` clamped into 2–10 until there are 3 distinct options.
- **Level 2**: `whole = randInt(3, 10)` (skip the trivial 1+1),
  `firstKey = randInt(1, whole - 1)`, `secondKey = whole - firstKey`. Each
  half's distractor is a 1–9 value that avoids **both** correct key numbers
  (and the two distractors differ from each other), so no key number repeats
  on the tray.
- **Reduce repetition across the whole run**: keep a running list of every
  `whole` used and re-roll if it appeared **within the last 3 rounds**, or if
  the exact key pair (`firstKey`+`secondKey`) duplicates an earlier round.
  Include a safety fallback so generation can never hang.

---

## 4. `GameScene.js` — full rewrite

### 4.1 Layout (720×1080 base resolution)

| Constant | Value | Meaning |
|---|---|---|
| `PROMPT_Y` | 280 | Speech bubble (light warm panel) |
| `CHEST_Y` | 425 | Level-2 chest center |
| `SLOT_PANEL_Y` | 610 | Level-2 mystery-slot panel (sky) |
| `SLOT_Y` | 610 | Level-2 chosen-key slots |
| `OPTIONS_PANEL_Y` | 880 | Level-2 options panel (mint) |
| `LEVEL2_PANEL_Y` | 470 | Level-1 question panel (warm) |
| `LEVEL2_CHESTS_Y` | 800 | Level-1 chest options (sky) |

Sizes are derived from each texture's native dimensions via `measureTexture`.

### 4.2 Backgrounds (requirement: light but colorful)

- **Question**: the prompt bubble is a warm panel (`0xfff4cf` fill, amber
  border) via `createPillButton`.
- **Level-2 mystery slots**: a light sky panel behind the two chosen-key
  slots.
- **Level-2 options**: a mint rounded panel (`0xcff5e7` fill, `0x34d399`
  border) behind the four big key options.
- **Level-1 question**: a warm rounded panel behind the two side-by-side
  keys.
- **Level-1 options**: a sky rounded panel (`0xd6f0ff` fill, `0x38bdf8`
  border) behind the three chest options.
- All panels are drawn by `addPanel(x, y, w, h, fillColor, borderColor)` into
  `roundLayer`, so they clean up with the round.
- **Background tint**: level 1 (find the chest) gets a prominent white-tan
  wash (`bg` tinted `0xfff2d2` + a white overlay); level 2 (find the keys)
  tints the background dark reddish (`0x8a4a55`) for a gloomy mood.
- **Round HUD**: only a top-right "Round / N/10" pill is shown — no star or
  streak counter in the HUD.
- **Animations**: the prompt, keys, and chests pop in with a `Back.easeOut`
  scale-in each round; the level-2 chest bobs gently while playing.

### 4.3 Level 1 — "find the chest" (tap to choose)

- The question panel shows `firstKey` and `secondKey` simply side by side (no
  `+`, arrow, or `?`).
- The instruction "Tap the chest with the right number!" is white text with a
  dark stroke.
- Three chest options sit on the sky panel, each with its number overlaid low
  and slightly left via `chestNumberOffset(scale)`.
- Tapping the chest whose number equals `firstKey + secondKey` opens it and
  calls `onCorrectAnswer()`; otherwise a red screen flash,
  `onWrongAnswer('wrongChest')`, + shake.

### 4.4 Level 2 — "find the keys" (tap to choose)

- The chest shows `whole` with its number overlaid **low and slightly left**
  (`chestNumberOffset(scale)` → `{ x: -halfW*0.25, y: halfH*0.42 }`).
- Two chosen-key slots sit on a light sky panel below the chest. The
  first-half key always lands left, the second-half key always lands right.
- Four **big** tappable key options sit on the mint panel, arranged two-up /
  two-down: the two first-half keys are stacked in the left column and the
  two second-half keys in the right column (labelled "1st half" / "2nd
  half").
- Tapping a key tweens it into its half's slot; tapping a placed key returns
  it. When both slots are filled, `maybeCheckLevel1()` compares
  `first + second` to `whole`:
  - Match → open the chest, `onCorrectAnswer()`.
  - Mismatch → red screen flash, `onWrongAnswer('wrongKey')`, shake both,
    then (after the shake finishes) send both back so the child can try
    again.

### 4.5 Feedback + progression

- **`onCorrectAnswer()`**: `phase = 'success'`, `stars++`, `streak++`,
  update `peakStreak`, play `chestOpening` SFX, play `correct` (level 1) or
  `treasureFound` (level 2), swap Polly to `PollyHappy`, then advance (or
  finish after round 10).
- **`onWrongAnswer(voiceKey)`**: `mistakes++`, `streak = 0`, flash the screen
  red (`flashRed()`), play the voice. State stays `playing` so the child can
  retry as many times as needed.
- **`finishGame()`**: `phase = 'finished'`, play `treasureHunter`, emit
  `game9-complete` with `{ stars, totalRounds: 10, peakStreak, mistakes,
  elapsedSeconds }`, show the end overlay with a Play Again button.

### 4.6 Helpers to include

- `playVoice(scene, key, onComplete)` — copy Game 8's version verbatim.
- `playSound(key, volume)` — parallel SFX (`chestOpening`).
- `measureTexture(scene, key)` — probe an off-screen image (copy Game 8's).
- `keyImageKey(half, n)` — `keyFirstHalf-${n}` / `keySecondHalf-${n}`.

---

## 5. Mute / music / preload

`audioState.js` is already correct as scaffolded. `assets.js` only needs the
`bgMusic` mp4 override (already added).

---

## 6. Registration (done)

- `main.jsx` routes `/game9`; `Game.jsx` logs to the `game9` slug on
  `game9-complete`.
- `GAME_CATALOG` entry and `StatsPanel` label are set to "Polly's Treasure
  Quest".

---

## 7. Acceptance checklist

- [ ] 10 rounds run start to finish; round 6 switches to "find the keys"
      with no visible scene break.
- [ ] Level 1 always shows one first-half + one second-half key; the correct
      chest opens and advances.
- [ ] Level 2 always shows 2 first-half + 2 second-half key options; only one
      key per half can be chosen, and a correct sum opens the chest.
- [ ] Key numbers stay 1–9; chest numbers stay 2–10; every bond is one
      first-half key + one second-half key.
- [ ] Chest numbers sit low and slightly left on the chest face.
- [ ] Question + options all sit on light, colorful panels; level 1 has a
      prominent white-tan wash and level 2 is dark reddish.
- [ ] The end screen shows no stars, just the parrot + "Treasure Hunter!" and
      a Play Again button.
- [ ] `game9-complete` fires exactly once with the full payload.
- [ ] Mute, background music, and first-tap unlock all work.
