# Game 7 — Number Bonds ("Mama Bird's Eggs") — Build Spec (v2)



## What I actually want (read this first)

- A **number bond splitting game**: every round shows a target number, the child drags eggs into a **Blue Nest** and a **Yellow Nest** until the two nests add up to that number, then presses **Check**.
- **4 levels, 3 rounds each.** Levels 1-2 use Robin and numbers 1-5. Levels 3-4 use Owl and numbers 1-10. Odd levels (1, 3) start both nests empty ("split"). Even levels (2, 4) start the Blue Nest with a fixed amount already in it, and the child only adds to the Yellow Nest ("fill").
- The **basket never runs out** — it's a bottomless supply of eggs shown a few at a time. There is no "correct number of eggs available" trick; the challenge is purely getting the two nests to add up correctly.
- **Check** button validates. Wrong -> gentle shake + "try again" voice line, board stays as-is so the child can adjust. Right -> bird swaps to its happy sprite, does a short dance, plays a "correct" voice line, then the next round loads automatically.
- After the 3rd round of a level: progress is saved, next level unlocks, bird finishes celebrating, and the child is returned to (or offered a button to) Level Select.
- **All text big and legible on a phone.** This is for young kids on small screens — err on the side of larger text everywhere.
- Voice lines are already recorded and linked in `assets.js` (see §0) — build against real audio, not stand-ins.

---

## 0. Files the agent already has (do not re-explain these, just reuse their patterns)

- `Game.jsx` — mounts `BaseGame`, builds the scene array via `buildScenes()`, wires `logPlaySession` to the `game7-complete` custom event.
- `PhaserDemo.jsx` — wraps everything in `NameGate` + `GameAccessGate`, renders the gradient page shell and the `<Game>` canvas.
- **`assets.js` — already finalized.** `IMAGES` has all 9 images. `AUDIO` has `bgMusic` plus all 12 `vo-*` voice line keys, all pointing at real recorded clips. `ASSET_MANIFEST` already flattens everything, including a spread of `NUMBERS_VOICE_MANIFEST`. **Do not regenerate this file or rebuild the manifest — just `import` from it.** The only thing the agent should touch here is adding a new image/audio key if the design genuinely needs one that doesn't exist yet (it shouldn't).
- `audioState.js` — `isMuted / ensureBgMusic / addMuteButton` — reuse as-is, do not duplicate.
- `numbersVoice.js` — `voice-one` … `voice-ten` clips + `playNumberVoice(scene, number)` + `getNumberVoiceUrl`. Reuse this for speaking the target number instead of recording "1..10" again.
- `levels.js` — currently one placeholder level + `createStarProgress`. **This needs to be rewritten** (see §2).
- `LevelSelectScene.js` — card grid UI, already loops `LEVELS` and calls `progress.isLevelUnlocked/getAllStars`. Only needs level-count-aware layout tweaks (4 cards instead of 1) — do not redesign the card component.
- `GameScene.js` — placeholder "Coming Soon" scene. **This gets fully replaced** (see §4).
- `BasePreloadScene`, `BaseGame`, `BaseScene` (in `../../Phaser/`) — not shown here; inspect them before writing code and reuse whatever helpers they expose (`createPillButton`, `stopSpeechOnShutdown`, anchor system, etc.) rather than reinventing button/label creation.
- `starProgress` (in `../../Phaser/common/starProgress`) — reuse its API for per-level completion; do not build a second progress system. Inspect its actual method names before calling them (the spec below guesses `setStars`/`isLevelUnlocked`/`getAllStars` based on existing call sites in `LevelSelectScene.js` — confirm against the real module).

**Hard constraints:**
- This is a Phaser **canvas** game. `@dnd-kit/*` is a DOM drag-and-drop library and **must not** be used for the egg dragging — use Phaser's native `setInteractive({ draggable: true })` + `'drag'/'dragend'` events.
- `react-confetti` and the React layer are for the level-complete overlay only (§7) — never for in-canvas effects.
- `use-sound` is not needed — all game audio goes through Phaser's `this.sound` manager, consistent with `audioState.js`/`numbersVoice.js`.
- Do not invent a second source of truth for how many eggs are in a nest — see §4.4's counting rule, this is the most common source of bugs in this kind of drag/drop game.

---

## 1. Game concept

| Level | Bird | Number range | Mode |
|---|---|---|---|
| 1 | Robin | 1-5 | **Split** — both nests start empty, child freely distributes eggs to reach the target |
| 2 | Robin | 1-5 | **Fill** — Blue Nest starts pre-filled with a fixed amount, child adds eggs to Yellow Nest to reach the target |
| 3 | Owl | 1-10 | Split (same as Level 1, bigger numbers) |
| 4 | Owl | 1-10 | Fill (same as Level 2, bigger numbers) |

3 rounds per level, 4 levels total = 12 rounds start to finish.

---

## 2. `levels.js` rewrite

Replace the single placeholder level with 4 levels and mode-aware round generation. Keep this file Phaser-free (no `import Phaser`) — small local helpers are simpler to reason about in a plain data module and avoid any load-order coupling with the Phaser instance.

```js
import { createStarProgress } from '../../Phaser/common/starProgress';

export const LEVELS = [
  { key: 'level1', name: 'Level 1', subtitle: 'Robin — Split (1-5)',  bird: 'robin', range: [1, 5],  mode: 'split', rounds: 3 },
  { key: 'level2', name: 'Level 2', subtitle: 'Robin — Fill (1-5)',   bird: 'robin', range: [1, 5],  mode: 'fill',  rounds: 3 },
  { key: 'level3', name: 'Level 3', subtitle: 'Owl — Split (1-10)',   bird: 'owl',   range: [1, 10], mode: 'split', rounds: 3 },
  { key: 'level4', name: 'Level 4', subtitle: 'Owl — Fill (1-10)',    bird: 'owl',   range: [1, 10], mode: 'fill',  rounds: 3 },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns an array of round configs: { target, given }
// `given` is only meaningful in 'fill' mode (Blue Nest's starting count).
// A target of 1 can't be split across two nests meaningfully, so the
// usable target pool always starts at 2.
export function buildRounds(level) {
  const [, max] = level.range;
  const minTarget = 2;

  // Build a shuffled pool of every usable target so 3 rounds in the same
  // level don't repeat unless the range is too small to avoid it.
  const pool = shuffle(Array.from({ length: max - minTarget + 1 }, (_, i) => minTarget + i));

  const rounds = [];
  for (let i = 0; i < level.rounds; i++) {
    // If we run out of unique targets (tiny ranges), wrap back around the pool.
    const target = pool[i % pool.length];
    const given = level.mode === 'fill' ? randInt(1, target - 1) : 0;
    rounds.push({ target, given });
  }
  return rounds;
}

export const progress = createStarProgress({
  storageKey: 'game7-progress-v1',
  levelCount: LEVELS.length,
});
```

---

## 3. Assets — already finalized, read-only for this task

`assets.js` already contains:
- `IMAGES`: `blue-nest`, `yellow-nest`, `background`, `robin`, `robin-happy`, `owl`, `owl-happy`, `egg-basket`, `egg`.
- `AUDIO`: `bgMusic`, plus every voice line below, all linked to real recordings:

| Key | Line | When it plays |
|---|---|---|
| `vo-welcome` | "Let's help Mama Bird organize the eggs!" | Once, on a level's first round only |
| `vo-this-family-has` | "This family has..." | Start of every round, before the number |
| `vo-eggs-altogether` | "...eggs altogether!" | Start of every round, right after the number |
| `vo-split-instruction` | "Put the eggs in the two nests to make that many." | Start of every round, split-mode levels |
| `vo-fill-instruction` | "The blue nest already has some. Add the rest to the yellow nest." | Start of every round, fill-mode levels |
| `vo-correct-1/2/3` | "Correct! Great job!" / "Yay! You did it!" / "Perfect! Well done!" | Pick one at random on a correct Check |
| `vo-try-again-1/2` | "Not quite! Try again." / "Oops, let's count again." | Pick one at random on an incorrect Check |
| `vo-level-complete` | "Amazing! You finished the level!" | After round 3, levels 1-3 |
| `vo-game-complete` | "Wow! You're a number bond superstar!" | After round 3, level 4 (instead of `vo-level-complete`) |
| `vo-hint` | "Let's count how many eggs are in the nests already." | Hint button pressed |

- `ASSET_MANIFEST`: already includes every image, every `AUDIO` entry, and the spread of `NUMBERS_VOICE_MANIFEST`. **Import `ASSET_MANIFEST` as-is in `Game.jsx`'s `BasePreloadScene` config — no changes needed there.**

### Safe voice playback (defensive coding, since a clip could still fail to load on a bad connection)

Add one small helper in `GameScene.js` (or a shared scene util) instead of calling `this.sound.add(key).play()` directly everywhere:

```js
function playVoice(scene, key, onComplete) {
  if (!scene.cache.audio.exists(key)) {
    console.warn(`playVoice(): "${key}" not loaded, skipping.`);
    if (onComplete) onComplete();
    return null;
  }
  const sound = scene.sound.add(key);
  sound.once('complete', () => {
    sound.destroy();
    if (onComplete) onComplete();
  });
  sound.play();
  return sound;
}
```

Use this for every `vo-*` clip. This is what makes the "this family has ⟨N⟩ eggs altogether" chain safe to build:

```js
playVoice(scene, 'vo-this-family-has', () => {
  playNumberVoice(scene, target); // from numbersVoice.js — does not take a callback, see below
});
// numbersVoice.js's playNumberVoice has no completion callback today — if precise
// chaining onto vo-eggs-altogether matters, either (a) add an optional onComplete
// param to playNumberVoice in numbersVoice.js, or (b) approximate the gap with a
// fixed this.time.delayedCall(700, ...) before vo-eggs-altogether. Prefer (a) — it's
// a small, backwards-compatible change (existing callers keep working unchanged).
```

### Egg coloring
There is only **one** `egg` texture. Produce 4 visual colors by tinting the same sprite — tint is cosmetic only, never part of the counting/validation logic:

```js
const EGG_TINTS = [0xff6fa5, 0xffd23f, 0x6fd66f, 0xa06fe0]; // pink, yellow, green, purple
egg.setTint(Phaser.Utils.Array.GetRandom(EGG_TINTS));
```

---

## 4. `GameScene.js` — full rewrite

### 4.1 Scene state (set in `init(data)`)
```js
init(data) {
  this.levelIndex = data?.levelIndex ?? 0;
  this.level = LEVELS[this.levelIndex];
  this.rounds = buildRounds(this.level);
  this.roundIndex = 0;
}
```

### 4.2 Core data model — read this before writing any drag/drop code

To avoid the classic bug where a counter variable drifts out of sync with what's actually on screen, **do not keep separate `blueCount`/`yellowCount` number variables that you increment/decrement by hand.** Instead:

```js
// One flat array of slot objects per nest, created once in create().
// slot = { x, y, occupiedBy: null | eggGameObject }
this.blueSlots = [];
this.yellowSlots = [];
```

Always derive counts on demand:
```js
const blueCount = this.blueSlots.filter(s => s.occupiedBy).length;
const yellowCount = this.yellowSlots.filter(s => s.occupiedBy).length;
```

This guarantees `checkAnswer()` always reflects exactly what's visible — there's no separate number to accidentally forget to update on some code path (e.g. Reset, or a slot-to-slot drag).

### 4.3 `create()` — build order
1. Background image, full-screen.
2. Bird sprite (`robin`/`owl` per `this.level.bird`), perched top-right area, gentle idle float tween (`y += 6`, yoyo, repeat -1, ~1600ms) running continuously. Store a reference (`this.bird`) — you'll swap its texture later.
3. Instruction banner (very large text, e.g. 42-56px, `Fredoka`, white fill + dark stroke like the existing "Game 7" title) — static per-level copy:
   - split levels: "Split the eggs between the nests!"
   - fill levels: "Finish filling the nests!"
4. Target banner: "This family has **{N}** eggs altogether." — the number itself noticeably larger/bolder/colored (red or orange) than the surrounding words.
5. Round indicator, top-right: pill text "Round {roundIndex+1}/{rounds.length}" (replaces the 3-star row from the reference mock — this codebase's star system is per-level, not per-round, so don't try to build a second one here).
6. Two nests, "Blue Nest" and "Yellow Nest", side by side, each with a labelled banner above it and a slot grid inside:
   - slot columns = `Math.min(5, level.range[1])`, rows = `Math.ceil(level.range[1] / 5)` — 1-5 levels get one row of 5 slots, 1-10 levels get 2 rows of 5.
   - build `this.blueSlots`/`this.yellowSlots` from this grid's actual world positions — every slot needs a real `{x, y}` for egg-snapping.
   - draw each empty slot as a simple dashed/faint circle so kids can see where eggs go.
7. Egg basket at the bottom center: the `egg-basket` image as a visual tray, with **3-4 egg sprites visible at once**, draggable, tinted randomly per §3. This is a *visual* queue only — every time an egg leaves the basket for a nest, spawn one replacement egg into the basket (after a short delay/tween) so the tray always looks stocked. There is no cap on total eggs available; the basket is infinite.
8. Buttons (reuse `createPillButton`):
   - **Home** (bottom-left) -> `this.scene.start('LevelSelectScene')`
   - **Check** (bottom-center, primary/green, largest button) -> `checkAnswer()`
   - **Reset** (bottom-right) -> `resetRound()`
   - **Hint** (mid-right, lightbulb icon/emoji) -> `showHint()`
9. `addMuteButton(this, 16, 16, { anchor: 'topLeft' })`, `ensureBgMusic(this)`, and the unlock-on-first-tap fallback — copy exactly from `LevelSelectScene.js`.
10. **Fill mode only:** immediately place `rounds[roundIndex].given` eggs into the Blue Nest's first N slots (set each slot's `occupiedBy` directly, no drag needed). These starting eggs are **not interactive** (never call `setInteractive`/`setDraggable` on them) so the child can only manipulate the Yellow Nest. Recreate these fresh every round — the `given` amount can differ round to round, so don't reuse leftover eggs from a previous round.
11. Play `vo-welcome` once per level, only on `roundIndex === 0`. Then play the round-start voice chain: `vo-this-family-has` -> number -> `vo-eggs-altogether` -> `vo-split-instruction` or `vo-fill-instruction` depending on `level.mode`. Chain each with the `playVoice` helper's `onComplete` so lines never overlap.

### 4.4 Drag & drop logic (read §4.2 first)

- Give every draggable egg a small data payload when created: `egg.setData('origin', { type: 'basket' })` or `egg.setData('origin', { type: 'slot', slots: this.blueSlots, slot })`. Update this payload every time the egg successfully lands somewhere new — it's how you know what to do if the *next* drag fails.
- `this.input.setDraggable(egg)`.
- On `'drag'` (args: `pointer, dragX, dragY`): `egg.x = dragX; egg.y = dragY;` and `egg.setDepth(50)` so it renders above nest art while being dragged.
- On `'dragend'`:
  1. Search **both** `blueSlots` and `yellowSlots` for the nearest slot with `occupiedBy === null`, within a snap radius (roughly half a slot's width/height) of the drop position. Reject slots outside that radius — a drop in empty space should not "reach" across the screen to grab a distant slot.
  2. **If a valid empty slot is found:**
     - Free the egg's previous location, if any: if `origin.type === 'slot'`, set that old `slot.occupiedBy = null`.
     - Occupy the new slot: `newSlot.occupiedBy = egg`, tween the egg to `newSlot.x/newSlot.y`.
     - Update the egg's origin payload to point at the new slot.
     - If the *old* origin was `'basket'`, spawn one replacement egg into the basket now.
  3. **If no valid slot is found** (dropped on empty space, or every nearby slot is full): tween the egg back to its origin position (its slot's x/y if it came from a slot, or the basket tray position if it came from the basket) — do **not** change any `occupiedBy` state, since nothing actually moved.
- This same logic naturally supports basket->nest, nest->nest, and nest->basket-ish (dropped in open space snaps back) without special-casing each case separately — the only branch that matters is "did we find an empty slot near the drop point or not."
- Never let two eggs occupy the same slot object — always check `occupiedBy === null` before assigning.

### 4.5 `checkAnswer()`
- Compute `blueCount`/`yellowCount` fresh from the slot arrays (§4.2) — never from a cached variable.
- **Split mode:** correct if `blueCount + yellowCount === target`.
- **Fill mode:** correct if `yellowCount === target - given` (the Blue Nest's `given` eggs are locked and never change, so this is equivalent to `blueCount + yellowCount === target`).
- Correct -> `playCorrectFeedback()`. Incorrect -> `playIncorrectFeedback()`.
- Disable the Check button (and ideally dragging) during the correct-feedback animation so a fast double-tap can't skip a round or double-fire `nextRound()`.

### 4.6 `playCorrectFeedback()`
1. Swap the bird's texture: `this.bird.setTexture(level.bird + '-happy')`.
2. "Dance" tween: alternate small scale pulses + slight rotation wiggle, looped 2-3 times (~1.5-2s total), e.g. `yoyo: true, repeat: 3, scale: 1.08, angle: {from: -4, to: 4}`.
3. Play one of `vo-correct-1/2/3` at random via `playVoice`.
4. Emit `this.game.events.emit('game7-round-correct')` for a small confetti burst on every correct round (see §7); use a bigger celebration only at level completion.
5. When the dance tween completes, call `nextRound()` — don't use a hardcoded `setTimeout` that might fire before/after the tween for unrelated reasons; hook the tween's `onComplete`.

### 4.7 `playIncorrectFeedback()`
- Small shake tween on both nest containers (`x: +/-8`, quick yoyo, short duration ~250ms).
- Play one of `vo-try-again-1/2` at random.
- Do **not** clear the nests or touch `occupiedBy` state — let the child adjust and press Check again.
- Re-enable the Check button immediately (it should only ever be disabled during the *correct*-feedback animation, per §4.5).

### 4.8 `nextRound()` / level completion
- `roundIndex += 1`.
- **If `roundIndex < rounds.length`:** reset bird texture back to normal (`level.bird`), destroy all eggs currently in either nest, reset `blueSlots`/`yellowSlots` occupancy to `null`, respawn the basket's visible eggs, rebuild the fill-mode locked Blue Nest eggs for the new round's `given` (if applicable), update the target banner text, and replay the round-start voice chain (§4.3 step 11 minus the once-per-level welcome line).
- **Else (level finished):**
  - Confirm the bird is back to its normal texture after the dance (or leave it happy through the completion screen — pick one, be consistent).
  - Call whatever the real `starProgress` method is for marking a level complete (inspect `starProgress.js` — used here as `progress.setStars(levelIndex, 1)`, confirm the actual name/signature).
  - Play `vo-level-complete`, or `vo-game-complete` if `levelIndex === LEVELS.length - 1`.
  - Emit `this.game.events.emit('game7-level-complete', { levelIndex })` for the React confetti overlay (§7).
  - Show two buttons: "Next Level" (only if `levelIndex + 1 < LEVELS.length`, starts `GameScene` with `{ levelIndex: levelIndex + 1 }`) and "Level Select" (`this.scene.start('LevelSelectScene')`).
  - If this was the last level, also dispatch the existing `game7-complete` custom event so `Game.jsx`'s `handleComplete`/`logPlaySession` flow fires exactly as it does today — don't bypass or duplicate that wiring.

### 4.9 `resetRound()`
- Tween every placed, *interactive* egg (i.e. everything except fill-mode's locked given-eggs) back to the basket tray position, then destroy them once the tween completes (a fresh basket egg will already be visible, so don't double-spawn).
- Set every non-locked slot's `occupiedBy` back to `null`.
- No voice line required (a light neutral cue is fine if one exists, but nothing in §3's list is designated for this — don't reuse `vo-try-again-*` here, that's specifically for a wrong Check).

### 4.10 `showHint()`
- Play `vo-hint`.
- Briefly highlight (pulse/glow tween, ~2s) the next empty slot in whichever nest still needs eggs to reach the target, computed from the same slot-derived counts as `checkAnswer()`.
- Optionally flash a small floating text like "You have 3, you need 4 more!" for 2 seconds then fade out.
- Keep this simple — it should never auto-place an egg or change any slot state, only draw attention.

---

## 5. Text sizing (mobile-first)

- Title/banner text: 40-56px
- Target number banner body: 28-32px, with the number itself 44-56px
- Nest labels: 26-30px
- Buttons: 22-26px label text, generous `paddingX/paddingY` (match existing `createPillButton` calls in `LevelSelectScene.js`, e.g. `paddingX: 26, paddingY: 14`)
- Always `fontFamily: 'Fredoka, sans-serif'` for headings (already loaded via the Google Fonts `<link>` in `PhaserDemoInner`), keep stroke+fill combo for contrast against the background art like the existing "Game 7" title.
- Scale font sizes relative to `this.scale.width` if fixed px sizes clip on very narrow viewports (check whether `BaseScene` already exposes a responsive helper before hand-rolling one).

---

## 6. `LevelSelectScene.js` changes

Minimal — it already maps over `LEVELS` and lays cards out based on `width/height`, so 4 levels should mostly "just work." Verify/adjust:
- Current layout vertically centers a single card (`cy = height/2 - cardH/2`); with 4 levels it needs either a 2x2 grid or a shorter vertical list that fits without scrolling on common mobile heights (~700-850px). Adjust `cy`/`cardW`/`cardH` per index accordingly.
- Nothing about `buildLevelCard` itself needs to change.

---

## 7. React layer (confetti on level complete)

In whichever component owns the Phaser game instance (`Game.jsx` or `PhaserDemoInner`), listen for the two custom Phaser events and render `react-confetti` as a short-lived overlay:

```jsx
useEffect(() => {
  const onRoundCorrect = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200); // short burst per round
  };
  const onLevelComplete = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500); // bigger celebration
  };
  // subscribe via however BaseGame exposes the Phaser Game's event emitter,
  // e.g. gameRef.current.events.on('game7-round-correct', onRoundCorrect)
  return () => { /* matching .off cleanup for both */ };
}, []);

{showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
```
Inspect how `BaseGame` exposes the underlying Phaser `Game` instance before wiring this — reuse whatever mechanism `completeEventName`/`onComplete` already relies on rather than inventing a new one.

---

## 8. Acceptance checklist

- [ ] 4 levels appear on Level Select, all showing correct name/subtitle/lock state via existing `progress` API.
- [ ] Level 1 & 3 (split): both nests start empty; any blue+yellow combo summing to target passes Check.
- [ ] Level 2 & 4 (fill): Blue Nest starts pre-filled with a fixed, non-interactive amount that regenerates correctly every round; only Yellow Nest count matters for Check.
- [ ] Eggs are visibly tinted 4 different colors, tint is random per spawn and irrelevant to scoring.
- [ ] Dragging an egg out of the basket always leaves the basket visually stocked (exactly one replacement spawns per egg taken — no double-spawns, no empty tray).
- [ ] Dragging an egg between the two nests (not just basket->nest) correctly frees its old slot and occupies the new one — counts never drift from what's visually on screen.
- [ ] Dropping an egg in empty space (not near any slot) always returns it to exactly where it came from.
- [ ] Wrong answers shake gently, play a "try again" voice line, and do **not** reset the board or touch slot state.
- [ ] Correct answers swap the bird to its happy sprite, play a short dance animation, play a "correct" voice line, and advance only after the dance tween completes (no double-advance from a fast double-tap on Check).
- [ ] After 3 rounds, level-complete state shows, progress persists, and the next level unlocks in `LEVELS`.
- [ ] After Level 4's 3rd round, the existing `game7-complete` event still fires so `logPlaySession` runs exactly as it does today.
- [ ] Mute button, background music, and pointer-unlock-on-first-tap all still work exactly as in `LevelSelectScene.js`.
- [ ] A missing/failed voice clip (simulate by temporarily blanking one `AUDIO` key) never freezes a round — `playVoice`'s fallback keeps the chain moving.
- [ ] All text is legible at common mobile widths (~360-420px) without overlap or clipping.
- [ ] No `@dnd-kit` import appears anywhere in the Phaser scene files.

---

## 9. Suggested build order for the agent

1. Rewrite `levels.js` (§2) and confirm `LevelSelectScene.js` renders 4 cards without layout breakage (§6).
2. Confirm `BasePreloadScene` loads every asset in `assets.js`'s existing `ASSET_MANIFEST` without console errors — this file is already finalized, no edits expected here.
3. Build the nest + slot grid rendering (with real `blueSlots`/`yellowSlots` position arrays) and static layout for one round — no drag yet. Visually confirm against the reference mock.
4. Add basket spawning + tinting + the full drag/drop logic from §4.4, using the slot-occupancy model from §4.2 (not separate counters).
5. Wire `checkAnswer()` for split mode only, verify Level 1 end-to-end including Reset/Hint.
6. Add fill-mode's locked starting eggs + verify Level 2, including that a fresh `given` amount is rebuilt every round.
7. Wire correct/incorrect feedback, bird sprite swap + dance, voice line chaining via `playVoice` (§4.6/4.7).
8. Wire round progression + level completion + progress persistence + event dispatch (§4.8).
9. Add the React confetti overlay (§7).
10. Confirm Levels 3-4 work purely by re-running the same scene logic with `bird: 'owl'`, `range: [1, 10]` — no new code should be needed if §4 was built level-agnostic.
11. Pass through the acceptance checklist (§8), including the deliberate "blank one voice key" test.