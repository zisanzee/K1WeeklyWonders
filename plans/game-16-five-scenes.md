# Game 16 — five scenes, one run: scaffold + dev tooling

Game 16 is five **separate mini-games** played back to back. Each scene has its
own mechanic, its own art, and exactly **3 rounds**. This document is the spec for
the scaffold that has to carry all five without turning into a monolith.

---

## 1. The shape

```
src/games/game-16/
  scenes.js              ← THE scene registry (identity + dev metadata)
  progress.js            ← pure cycling state (scene/round), unit tested
  tuning.js              ← every tunable, + the dev panel schema
  Game.jsx               ← BaseGame + DevTuningFrame
  GameScene.js           ← THE HUB: runs the 5 scenes in sequence
  scenes/
    SceneBase.js         ← shared scaffold every scene extends
    ShapesScene.js       ← 1. shapes
    MirrorScene.js       ← 2. mirror
    PositionsScene.js    ← 3. positions
    LeftRightScene.js    ← 4. left - right
    OrdinalScene.js      ← 5. ordinal (first - tenth)
```

**One Phaser scene, five scene MODULES.** Not five `Phaser.Scene` subclasses
mounted at once. Reasons:

- `BaseGame` swaps Phaser scenes by key, and a run is a *sequence*: round 3 of
  scene 2 must hand straight to round 1 of scene 3 with no scene-switch cost or
  teardown of the HUD.
- One Phaser scene means one `create()`, one music instance, one mute button and
  one dev-nav registration. Five Phaser scenes would each need to re-establish
  all of it.
- Swapping a module keeps the transition inside our own code, so a scene change
  can be animated (slide/fade) instead of being a hard cut.

`GameScene` owns the run: which scene, which round, scoring, and the handover. A
scene module only owns **one round on screen**.

---

## 2. The scene contract

Every scene module is an object with a small, fixed surface. This is the API the
five placeholders implement now and the real mechanics fill in later.

```js
export default {
  id: 'shapes',                       // must match scenes.js
  ROUNDS: 3,                          // fixed for every scene this game

  // Draw one round. Called again for each round in the same scene, with
  // `round` 0..2. `ctx` is the hub's handles (see below).
  create(ctx, round) { … },

  // Per-frame, only while this scene is active and playing.
  update(ctx, time, delta) { … },

  // Scene is being torn down for the next one (or the run ended).
  destroy(ctx) { … },
}
```

`ctx` gives a scene everything it needs without importing the hub:

| handle | purpose |
| --- | --- |
| `ctx.scene` | the Phaser scene (add images/text/graphics, tweens, input) |
| `ctx.layer` | a `Phaser.GameObjects.Container` the scene MUST draw into — cleared wholesale on round change, so a scene never has to track its own display objects |
| `ctx.tuning` | this scene's tuning block, already resolved through the kit |
| `ctx.place(obj, xFrac, yFrac)` | position a display object by canvas FRACTION (so a scene is resolution-independent) |
| `ctx.roundComplete(payload)` | tell the hub this round is done (`{ correct, mistakes }`) |
| `ctx.say(key)` | play a spoken line by asset key (no-op until audio exists) |

The `layer` container is the important one: a placeholder scene is ~20 lines
because it never tracks or destroys its own objects. That also means the real
mechanics can't leak objects between rounds — the commonest bug in a multi-round
game.

---

## 3. Dev tooling — this is the point of the scaffold

Five mechanics means five things to tune by eye, plus a need to *get to* any
scene/round in one click. The shared kit (`@/devTuning`) already supports this;
the scaffold wires it up properly.

### 3.1 Scene/round navigation in the panel

`tuning.js` sets `schema.nav = true`, and the hub registers:

```js
TUNING.setNav({
  label: () => `2/5 mirror · round 2/3`,
  prevScene / nextScene,   // « »  jump whole scenes
  prev / next,             // ◀ ▶  step rounds, rolling over into the next scene
})
```

That gives the sidebar `«  ◀  2/5 mirror · round 2/3  ▶  »`. The panel's
existing nav bar renders exactly those handlers, so there is **no new panel
code** — the scaffold only has to register them.

It is also reachable from the game itself in dev: `[` / `]` for scene,
`,` / `.` for round. Same handlers, so the two can't drift.

### 3.2 Per-scene tuning groups

Each scene gets its own table **and its own schema group**, named after it, so a
slider is never ambiguous. `SCENES` in `tuning.js` holds one block per scene id
with placeholder numbers (label position, prompt Y, object scale…). The
mechanics will add real ones to their own block.

`scope` is used on the array groups so the panel shows only the **current**
scene's rows — the panel's array renderer already supports `group.scope(all, nav)`.

### 3.3 What the panel shows

| group | what it tunes |
| --- | --- |
| HUD | header/prompt/footer positions, dev badge |
| ENGINE | round count, transition ms, whether dev chrome is drawn |
| SCENES | one nested block per scene, resolved by scene id |
| DEV | placeholder-drawing switches that only matter before art exists |

### 3.4 Relayout, not rebuild

Scenes expose `applyTuning(ctx)`; the hub registers
`TUNING.setRelayout(...)` to call it on the active scene, so dragging a slider
moves the live objects instead of re-running `create()` and losing state. This
is the difference between usable and infuriating when tuning 5 mechanics.

### 3.5 Dev-only canvas chrome

With `ENGINE.devChrome` on (dev builds only), each placeholder draws its own
frame, its scene/round id, and a coloured border per scene — so it is obvious at
a glance which of the 5 you are looking at while the art is missing. Off in
production by `import.meta.env.DEV`.

---

## 4. Progress model (pure, testable)

`progress.js` holds the cycling logic with no Phaser import:

```js
const p = startRun();          // { scene: 0, round: 0, done: false }
advance(p)                     // round 0→1→2, then scene 0→1, … , then done
jumpScene(p, +1)               // dev: clamps, never marks done
jumpRound(p, +1)               // dev: rolls over into the next scene
```

`advance` is the production path: 5 scenes × 3 rounds = **15 rounds per run**.
`jumpScene`/`jumpRound` are dev paths and deliberately behave differently (they
clamp and never end the run), which is exactly why they are separate functions
and unit tested rather than being `advance` with a flag.

Tests cover: 15 steps to done, no skipping, wrap-around from the last round of
one scene into the first of the next, dev jumps clamping at both ends, and
`totalRounds()` = 15.

---

## 5. Build order

1. `plans/game-16-five-scenes.md` (this file).
2. `scenes.js` — ids/names/rounds + dev colour & description.
3. `progress.js` + `progress.test.js`.
4. `tuning.js` — rebuilt as a real tuning file (kit + schema + nav).
5. `scenes/SceneBase.js` — the shared scaffold.
6. The 5 placeholder scenes.
7. `GameScene.js` — the hub + dev nav + relayout.
8. `Game.jsx` — mount `DevTuningFrame`.
9. `npm run lint` + `npm run build`.

## 6. Explicitly NOT in this scaffold

No mechanic, no scoring rules, no real art, no speech lines, no win screen per
scene. The completion event stays wired but dormant, exactly as the boilerplate
left it. Those arrive one scene at a time once the mechanics are specified.

The game **stays** `(in works)` in the registry: it is scaffolding, and the
`preview: true` flag already keeps it out of class catalogues.
