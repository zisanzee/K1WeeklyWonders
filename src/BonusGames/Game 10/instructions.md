# Game 10 — "Feed the Shape Monster" — Build Instructions

This replaces the scaffold instructions. It is the full spec for turning the
placeholder Game 10 into the real game. Read this entire file before touching
code — several decisions below (asset mapping, scoring semantics, spawn
rules) are load-bearing for other files and shouldn't be re-derived ad hoc
mid-implementation.

---

## 0. One-line pitch

Fruit-Ninja-style shapes (cookie/circle, cracker/square, pizza/triangle,
juicebox/rectangle) launch up from the bottom of the screen and arc back down
under gravity. A monster in the bottom-right corner calls out a shape — by
name in Level 1, by geometric property in Level 2 — and the player must
**catch the matching shape mid-air and drag it into the monster's mouth**.
Wrong shapes fed to the monster are rejected. Each round needs 3 correct
feeds to clear; 10 rounds total, with a progress bar up top that fills as
feeds land.

---

## 1. Shape ↔ food ↔ asset map (already correct in `assets.js` — do not rename keys)

| Shape | Food | Image key | Notes |
|---|---|---|---|
| Circle | Cookie | `cookie-circle` | 250×250 |
| Square | Cracker | `cracker-square` | 250×250 |
| Triangle | Pizza slice | `pizza-triangle` | 250×225 |
| Rectangle | Juicebox | `juicebox-rectangle` | 150×250 — taller than wide, keep its aspect ratio when scaling so it still reads as a rectangle, not a square |

Use these four keys for every spawned shape sprite in the play area. No new
image assets are required for the shapes themselves.

---

## 2. Round script (fixed order — do NOT shuffle or randomize round order)

The 10 rounds are curriculum content, not random generation. `levels.js`
should export this as a fixed, explicit array (not procedurally built),
so it exactly matches what's below.

### Level 1 — rounds 1–4, called by shape name (3 correct feeds each)

| Round | Target shape | Monster prompt (on-screen text) | Voice clip key |
|---|---|---|---|
| 1 | Triangle | "Feed me triangles!" | `VA-I want triangle` |
| 2 | Square | "Feed me squares!" | `VA-I want square` |
| 3 | Rectangle | "Feed me rectangles!" | `VA-I want rectangle` |
| 4 | Circle | "Feed me circles!" | *(none — see gap below)* |

**Known asset gap:** there is no "I want circle" voice clip in
`AUDIO`/`assets.js`, only property-based circle clips (`VA-I want shape that
is round with no corners`). Round 4 will just play silently — `playSound()`
already no-ops safely on a missing key, so this won't throw. Don't
substitute the property clip here (it would contradict Level 1 being
name-based and spoil Level 2's "round with no corners" line). Flag this back
to the user as a follow-up asset request ("I want circle" VO clip); don't
try to work around it with a different clip.

### Level 2 — rounds 5–10, called by property (3 correct feeds each)

Use this exact order (it deliberately interleaves shapes rather than
grouping by shape, which is better for the "listen to the property, don't
pattern-match on repetition" learning goal — keep it in this order):

| Round | Target shape | Monster prompt (on-screen text) | Voice clip key |
|---|---|---|---|
| 5 | Triangle | "I want a shape with 3 sides!" | `VA-I want shape with 3 sides` |
| 6 | Circle | "I want a shape that is round with no corners!" | `VA-I want shape that is round with no corners` |
| 7 | Square | "I want a shape with 4 equal sides!" | `VA-I want shape that has 4 equal sides` |
| 8 | Rectangle | "I want a shape with 2 long sides and 2 short sides!" | `VA-I want shape that has 2 long sides and 2 short sides` |
| 9 | Triangle | "I want a shape with 3 corners!" | `VA-I want shape that has 3 corners` |
| 10 | Square | "I want a shape with 4 corners and 4 equal sides!" | `VA-I want shape that has 4 corners and 4 equal sides` |

`levels.js` should export something shaped like:

```js
export const TOTAL_ROUNDS = 10;
export const FEEDS_PER_ROUND = 3;
export const ROUND_SCRIPT = [
  { level: 1, shape: 'triangle', prompt: 'Feed me triangles!', voiceKey: 'VA-I want triangle' },
  // ...rounds 2–10 exactly as tabulated above, voiceKey: null for round 4
];
```
Keep the shape identifiers (`'triangle' | 'square' | 'circle' | 'rectangle'`)
as a single small enum/lookup (e.g. `SHAPES`) mapping each to its image key,
label, and geometry, so `GameScene.js` never hardcodes an image-key string
inline — one source of truth for "what is a triangle" (image key + display
label), reused by both the spawner and the scoring check.

---

## 3. Screen layout (720×1080 base canvas)

Top → bottom:

1. **Progress bar** — full-width pill near the very top (replaces the
   plain "Game 10" title text; keep the title small/removed or tucked behind
   the bar, it's not load-bearing). See §6 for fill behavior.
2. **Prompt bubble** — left-of-center, roughly where `PROMPT_Y` sits today.
   Shows the current round's text prompt (`createPillButton`-style bubble,
   same visual language as the scaffold). This is the "the text that says
   feed me squares" from the brief.
3. **Play area** — the large middle zone where shapes launch, arc, and fall.
   This is the whole canvas width, behind the monster/bubble UI (lower
   depth), so shapes can fly anywhere including behind/near the monster.
4. **Monster** — bottom-right corner. Placeholder only for now: a simple
   round blob (e.g. a Phaser `graphics` ellipse, green/purple, with two dot
   eyes and a mouth arc) — no art asset needed yet, but build it as its own
   contained method (e.g. `buildMonster()`) so swapping in real art later is
   a localized change, not a rewrite.
5. **Feed zone** — an invisible hit-circle centered on the monster's mouth,
   used to detect "was this shape dropped into the monster."

---

## 4. Core gameplay loop

### 4.1 Spawning ("fruit ninja" launches)

- Use Phaser **arcade physics** for the shapes (gravity + initial velocity).
  Check `Phaser/config.js` — if arcade physics isn't already enabled in the
  shared config, add `physics: { default: 'arcade', arcade: { gravity: { y: <value> } } }`
  there (shared by all games, so pick a gravity value that still feels good
  as a default if another game later reuses it, or scope it locally to this
  scene's physics world if the config is otherwise physics-less by design —
  check how Game 9 handles physics, if it uses any, before deciding).
- Spawn interval: a shape launches roughly every 900–1400ms (randomize
  within that band so it doesn't feel metronomic).
- Launch parameics: start below the bottom edge at a random x (with margin
  so it doesn't spawn under the monster/UI), velocity up-and-slightly-sideways,
  with enough upward speed to arc into the middle-upper play area before
  gravity pulls it back down off the bottom edge if unclaimed.
- **Max 2 shapes concurrently in flight.** More than that is too visually
  busy for the K1 audience and makes "which one is the target" hard to parse.
- **Distractor mix:** don't spawn the *same* shape type twice back-to-back,
  and don't let more than ~3 consecutive spawns pass without the target
  shape appearing (a "pity timer") — otherwise a slow/unlucky RNG streak
  reads as broken to a 5-year-old.
- A shape that reaches the bottom unclaimed simply despawns (fade out) —
  no penalty, no mistake counted. Only a *wrong shape fed to the monster*
  is a mistake (see §4.3).

### 4.2 Catching + dragging

- `pointerdown` on a shape while airborne: freeze its physics body (zero
  velocity, disable gravity on it) and mark it "held," scale it up slightly
  (~1.15×) with a soft glow/ring to show it's grabbed.
- While held, the shape's position follows the pointer (`pointermove`),
  with a light lerp/smoothing rather than snapping exactly to the cursor —
  reads better on touch.
- `pointerup`: check overlap between the shape and the feed zone.
  - **Inside the feed zone** → resolve as a feed attempt (§4.3).
  - **Outside** → release it back into flight (re-enable physics/gravity,
    give it a small downward velocity) rather than snapping back to its
    original spot; it's fine if it then despawns off-screen normally.

### 4.3 Feeding the monster

- **Correct shape** (matches the round's target):
  - Play `eating_sound`.
  - Monster "chomp" animation — quick squash/stretch scale tween on the
    monster placeholder.
  - Shape sprite shrinks/pops out with a small tween (don't just
    `.destroy()` instantly — one frame of feedback matters here).
  - `feedsThisRound += 1`; `streak += 1`; `peakStreak = max(peakStreak, streak)`.
  - Advance the progress bar (§6).
  - When `feedsThisRound === FEEDS_PER_ROUND`: `stars += 1` (one star per
    **round**, not per feed — see §7 for why), then either advance to the
    next round or, if this was round 10, call `finishGame()`.
- **Wrong shape:**
  - Reuse the existing `flashRed()` + `shake()` feedback already in
    `GameScene.js`.
  - Monster gives a quick "no" head-shake tween.
  - The shape bounces back out of the feed zone (small outward velocity,
    physics re-enabled) rather than being destroyed — it's still catchable
    again.
  - `mistakes += 1`; `streak = 0`. Round does **not** advance and
    `feedsThisRound` does **not** increment.
  - Look for a shared "wrong" SFX before defaulting to silence — `public/PhaserAssets/wrong.wav`
    already exists as a shared cross-game asset; if other bonus games
    reference it directly by URL (not through `assets.js`'s Cloudinary
    manifest), do the same here for consistency rather than leaving wrong
    answers silent. If it turns out no other game references it this way,
    it's fine to leave wrong answers as visual-only feedback (as the
    scaffold already does) rather than inventing a new asset pipeline for it.

### 4.4 Round / level progression

- Same phase machine as the scaffold (`'playing' → 'success' → 'finished'`),
  just re-scoped to "3 feeds" instead of "1 tap": stay in `'playing'` across
  wrong *and* correct-but-not-yet-3rd feeds; only flip phase once the 3rd
  correct feed of the round lands, mirroring how `onWrongAnswer` today
  leaves phase alone so retries work.
- **Level 1 → Level 2 transition** (after round 4's 3rd feed, before round
  5 starts): show a short "Level 2! 🎉" banner/overlay (reuse the
  `popIn`-style tween already in the file) for ~1–1.5s, no player input
  required, then proceed straight into round 5. No level-select screen —
  matches the brief exactly.

---

## 5. Scoring semantics (must match existing logging schema)

`finishGame()` still emits exactly:
```js
this.game.events.emit('game10-complete', {
  stars, totalRounds, peakStreak, mistakes, elapsedSeconds,
});
```
Keep the field meanings consistent with how `StatsPanel.jsx` /
`logPlaySession` interpret them across the other bonus games:
- `stars`: one per **round** completed (max 10) — not one per feed. This
  keeps `stars` comparable to `totalRounds` the way other games report it.
- `totalRounds`: `TOTAL_ROUNDS` (10), unchanged.
- `peakStreak`: highest consecutive **correct feeds** across the whole run
  (a wrong feed anywhere resets it, even mid-round).
- `mistakes`: total wrong-shape-fed-to-monster count across the whole run.
- `elapsedSeconds`: unchanged, wall-clock from scene start to finish.

---

## 6. Top progress bar

- Full-width pill, ~24–28px tall, near the top (where the title/round-pill
  currently sit — consolidate into one element rather than stacking a
  separate round counter pill, title, and bar all at once; three
  top-of-screen UI pieces is too much for a K1 layout).
- Background: translucent white/track color; fill: a bright gradient or
  solid accent color, rounded ends, animated with a tween on every change
  (don't snap the fill instantly).
- Fill fraction = `(completedFeeds) / (TOTAL_ROUNDS * FEEDS_PER_ROUND)`
  where `completedFeeds` = `roundsFullyCompleted * 3 + feedsThisRound`, so
  it fills smoothly across all 30 correct feeds in the run, reaching 100%
  exactly when round 10's 3rd feed lands — not in 10 discrete round-sized
  jumps.
- Optional nice-to-have: 10 faint tick marks along the bar marking round
  boundaries, since the brief calls out "after 10 rounds it fills up
  completely" specifically.

---

## 7. Animation / polish pass ("make the design really nice")

- **Background:** keep the existing aurora/night-sky theme
  (`addSkyBackground(THEME, ...)`) for visual continuity with the other
  bonus games; consider layering `addDriftingClouds` from `BaseScene` if
  available, matching what other bonus games do.
- **Shapes in flight:** continuous slow rotation while airborne, a subtle
  squash on launch and stretch at apex, and a soft drop-shadow ellipse
  under each shape that scales with its (simulated) height — cheap but
  reads as "throwing," not "sliding."
- **Launch SFX:** cycle randomly through `throw-whoosh1` / `throw-whoosh2`
  / `throw-whoosh3` on every spawn (don't always play the same one).
- **Held/dragging state:** scale-up + soft glow ring while a shape is held,
  as described in §4.2.
- **Monster:** idle bob/breathing loop (small y-oscillation + scale pulse)
  when not eating, so the corner doesn't look static; mouth animation on
  both correct-chomp and wrong-reject as described in §4.3.
- **Prompt bubble:** pop-in when a new round starts (reuse `popIn`); a
  brief "+1" or star-pop floating text near the monster on each correct
  feed is a nice small reward beat for this age group.
- **Round/level transitions:** keep the existing `shake()`/`flashRed()` for
  wrong answers; add the Level 2 banner from §4.4; keep the existing
  end-of-run overlay (`showEndOverlay()`) as-is, it's already in final shape.
- Keep all of this performant — target the same cheap, GPU-composited style
  the rest of the codebase already uses (tweens/scale/alpha, not per-frame
  manual redraws).

---

## 8. File-by-file task list

### `assets.js`
- No key renames. Confirm all 4 shape images, `bgMusic`, the 3 whooshes,
  `eating_sound`, and all 9 `VA-*` clips are wired into `IMAGES`/`AUDIO`
  exactly as already present.
- Add a one-line comment noting the missing "I want circle" name clip
  (round 4 gap from §2) so it's not mistaken for an oversight later.

### `levels.js`
- Replace the scaffold's random 3-option generator entirely.
- Export `TOTAL_ROUNDS = 10`, `FEEDS_PER_ROUND = 3`, a `SHAPES` lookup
  (id → `{ imageKey, label }` for the 4 shapes), and the fixed
  `ROUND_SCRIPT` array from §2 (10 entries, in that exact order — not
  shuffled, not procedurally built).
- Keep the file Phaser-free, per the existing convention.

### `GameScene.js`
- This needs a substantial rewrite (spawner, drag/catch input, monster,
  feed-zone overlap, progress bar), but keep everything the pipeline
  depends on unchanged: `ensureBgMusic` + first-tap retry + `addMuteButton`,
  the emit-once `game10-complete` contract from `finishGame()`, and the
  general shape of the phase state machine.
- Suggested new pieces (naming is a suggestion, not a requirement):
  `spawnShape()`, `onShapeGrabbed()`, `onShapeReleased()`,
  `resolveFeedAttempt(shape)`, `buildMonster()`, `buildProgressBar()`,
  `advanceProgressBar()`, `showLevelBanner()`.
- Remove the scaffold's `buildOptions()`/three-button-pick interaction
  entirely — it's fully superseded by the catch-and-drag loop.

### `audioState.js`
Final shape already — no changes needed.

### `Game.jsx` / `PhaserDemo.jsx`
Final shape already — no changes needed. Don't touch the
`NameGate` → `GameAccessGate(gameNumber={10})` wrapping or the
`completeEventName="game10-complete"` wiring.

### `Phaser/config.js`
Check whether arcade physics is already enabled globally; if not, add it
(see §4.1) — this is a shared file, so confirm it doesn't change behavior
for Games 4/7/8/9/BonusGame1 before committing the change.

---

## 9. QA / acceptance checklist

- [ ] Exactly 10 rounds play in fixed order; no level-select screen; Level 2
      banner appears once, automatically, between rounds 4 and 5.
- [ ] Each round requires exactly 3 correct feeds of the target shape before
      advancing; wrong feeds don't advance the round or the progress bar.
- [ ] Progress bar reaches exactly 100% on the 30th correct feed (round 10's
      3rd feed), not before.
- [ ] Catching/dragging works with both mouse and touch input.
- [ ] At most 2 shapes are ever airborne at once; the target shape can't be
      absent for more than ~3 consecutive spawns.
- [ ] An unclaimed shape despawns at the bottom with no penalty.
- [ ] A wrong shape dropped on the monster is rejected (visual + mistake++)
      and remains catchable afterward — it isn't destroyed.
- [ ] Round 4 (circle, name-based) plays correctly with no audio and
      doesn't error/throw due to the missing voice clip.
- [ ] `game10-complete` payload matches the schema in §5 (`stars` out of 10,
      not out of 30).
- [ ] Mute button and bg music behavior unchanged from the scaffold.
- [ ] Visually consistent with the other bonus games' aurora theme —
      doesn't look like a different app bolted on.

---

## 10. Registration (already done — do not redo)

- `main.jsx` — `Game10` lazy import + `<Route path="/game10">`.
- `gameAccess.js` — `GAME_CATALOG` entry `{ key: '10', to: '/Game10', progressKey: 'game10' }`.
- `StatsPanel.jsx` — `game10` label.
- `BetaHome.jsx` — idle prefetch for game 10.
- An admin still needs to add game 10 to a class type from the Catalogue tab
  before students see it (per §15 of `PROJECT_CONTEXT.md` — no code change
  needed for this step).