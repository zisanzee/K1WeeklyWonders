# Game 8 — "Pizza Order!" (Number Bonds via Pizza Toppings)

Two chefs, one pizza. Kids fulfill topping orders by dragging the right
*amount* of toppings onto a pizza, then confirm what they just did by
solving a number-bond question about the same numbers.

**No level select screen.** The game is one continuous run of **10
rounds** — rounds 1–5 use the "find the total" bond, rounds 6–10 seamlessly
switch to "find the missing part" (no scene transition, no menu, no
restart — just an internal mode flip after round 5). Score logs once, at
the end of round 10.

This doc is the single source of truth for building Game 8. Follow it in
order. Where an existing shared helper's exact function signature isn't
repeated here (e.g. `numbersVoice.js`, `speech.js`), **open that file
first and match its real API** rather than guessing — don't invent method
names.

---

## 1. Concept summary

- **Chef Eka** sits bottom-left, **Chef Zee** sits bottom-right, facing
  inward toward a pizza centered on screen (`chefZee` texture is
  pre-flipped per the asset comment — do not flip it again in code).
- The whole game is **one scene** (`GameScene`) running an internal
  round counter `1..10` and a phase state machine per round:
  `'topping'` → `'numberBond'` → next round (or finish at round 10).
- **Phase A — Topping**: chefs announce how many toppings they each want
  (rounds 1–5) or how many Zee still needs (rounds 6–10). Child drags
  topping images from 5 container icons onto preset slot positions on the
  pizza, then presses **Fulfill Order**. Wrong count → "try again"
  prompt, pizza stays as-is, child keeps adjusting. Right count → small
  local success beat, advance to Phase B.
- **Phase B — Number Bond**: three connected circles (two parts + one
  total) recap the same numbers from Phase A, with one circle replaced by
  `?`. Three tappable option pills show candidate numbers. Wrong pick →
  "try again", pills stay live. Right pick → round-complete beat, advance
  to round `n+1` (new random numbers) or, if `n === 10`, end the game.

Rounds 1–5 and 6–10 reuse this exact two-phase shape; they differ only in
what starts on the pizza and which circle is the `?` (see §4–5). The
switch from round 5 to round 6 is just `roundIndex` crossing 5 — same
scene, same pizza object, no fade-to-menu, no reload.

---

## 2. Assets already wired (do not re-fetch/rename)

From `Game_8_assets.js` (all URLs already filled in):

**Images**: `chefEka`, `chefZee` (already pre-flipped source — just
place, don't mirror again), `chefEkaCelebrating`, `chefZeeCelebrating`,
`gameBackground`, `emptyPizza`, five containers (`container-pepperoni`,
`container-tomatoes`, `container-olives`, `container-mushrooms`,
`container-bellPepper`), five matching toppings (`pepperoni`, `tomato`,
`olives`, `mushrooms`, `bellPepper`).

**Audio**: `bgMusic`, `grab-fx` (play on drag-start), `paste-fx` (play on
successful drop-into-slot), and 5 voice lines `vo-1`..`vo-5` (text listed
in §6).

**Still needed from you**: import and spread `NUMBERS_VOICE_MANIFEST`
from `../../Phaser/common/numbersVoice` into `ASSET_MANIFEST` in
`assets.js` (per the file's own top comment — Game 7 does this exact
pattern, mirror it).

---

## 3. Data model — `levels.js`

Drop the level-select-oriented shape (no `LEVELS` cards, no
`createStarProgress` — there's nothing to show cards or stars for). Keep
this file as the round-generation module:

```js
export const MODES = {
  FIRST_HALF: 'find-total',   // rounds 1-5
  SECOND_HALF: 'find-part',   // rounds 6-10
};

export const ROUNDS_PER_HALF = 5;
export const TOTAL_ROUNDS = 10;
```

**Rounds 1–5 (`find-total`) round shape:**
```js
{ ekaWants: 3, zeeWants: 4, total: 7 }   // total = ekaWants + zeeWants
```

**Rounds 6–10 (`find-part`) round shape:**
```js
{ ekaHas: 4, total: 7, zeeNeeds: 3 }     // zeeNeeds = total - ekaHas
```

**Generation rules (apply to both halves):**
- Every individual addend (`ekaWants`/`zeeWants` in rounds 1–5,
  `ekaHas`/`zeeNeeds` in rounds 6–10) is random in **1–5**.
- Every `total` is capped at **≤10**, non-negotiable (numbersVoice only
  covers one–ten) — reject and re-roll any combo that exceeds it.
- **Reduce repetition across the whole 10-round run**, not just
  round-to-round: keep a running list of every `total` already used this
  game, and every "answer value" already used this game (the value the
  child had to solve for in Phase B — i.e. `total` for rounds 1–5,
  `zeeNeeds` for rounds 6–10). When generating a new round, re-roll if its
  `total` or its answer value has already appeared **within the last 3
  rounds**, and re-roll if it's an exact full duplicate (`{ekaWants,
  zeeWants}` pair, or `{ekaHas, zeeNeeds}` pair) of *any* earlier round
  this game. Since totals only range 1–10, don't require *global*
  uniqueness across all 10 rounds (impossible without shrinking the
  range) — the 3-round lookback is what actually reads as "not
  repetitive" to a 5-year-old while still leaving enough valid
  combinations to generate from.
- Build all 10 rounds **up front** at game start (`buildRoundSequence()`
  returning an array of 10 round objects, first 5 shaped for
  `find-total`, last 5 shaped for `find-part`), so the repetition check
  has full visibility across the whole run rather than being generated
  lazily per round.

**Number-bond options (both halves):** the correct answer plus **2 unique
distractors**, all within 1–10, generated as `correct ± 1` / `correct ±
2` (clamped into range, re-rolled if they'd collide with the correct
answer or each other), then shuffled before display. Generate these at
the same time as each round object (store as `round.options`) so Phase B
doesn't need to re-derive them.

---

## 4. Rounds 1–5 walkthrough — "find the total"

**Phase A (topping):**
1. On phase start: play `vo-1` once, **only on round 1 of the entire
   game** ("Help the Chefs complete the pizza by adding toppings"). Every
   round in 1–5 (including round 1) then plays: `vo-2` ("chef Eka
   wants") → number-voice for `ekaWants` → `vo-3` ("chef Zee wants") →
   number-voice for `zeeWants`. Chain these with `.once('complete', …)`
   on each `Sound` (or whatever queued-play helper `speech.js` already
   exposes — check it) so lines don't overlap.
2. Show both numbers as text near each chef (e.g. a small speech-bubble
   pill above each chef's head) alongside the spoken lines, since not
   every child will rely on audio alone.
3. Pizza starts **empty**. All 5 containers are visible (arranged in a
   row/arc above or beside the pizza) and are always draggable/repeatable
   — dragging a container does not consume it; it spawns a new topping
   sprite that follows the pointer (this is the "copy on drag start"
   pattern — Game 4/Game 7 do a comparable drag setup, check their
   `setInteractive({ draggable: true })` wiring for the exact drag-event
   idiom used elsewhere in this codebase before writing new code).
4. Define **10 preset slot positions** arranged around the pizza (e.g. a
   ring layout) computed once in `create()` from pizza center + radius.
   A topping drag released within snap-distance of the *next open slot*
   animates (tween) into that slot's exact position and locks it;
   released elsewhere, it tweens back to its container and is discarded.
   Play `grab-fx` on drag-start, `paste-fx` on successful slot-lock. A
   child can also tap a placed topping to pop it back out of its slot
   (there's no dedicated "remove" asset, so implement removal purely via
   this tap-to-pop interaction).
5. A **Fulfill Order** pill button sits under the pizza, always tappable.
   On tap: compare `filledSlotCount` to `round.total`.
   - Mismatch → shake the pizza slightly, show a small "Try again!" pill/
     toast (plain text — no voice asset covers this phrase), leave placed
     toppings as-is so the child can add/remove and retry.
   - Match → both chefs play their `*Celebrating` texture swap briefly
     with a local bounce/scale tween, then transition to Phase B (no
     full-screen confetti yet — that's reserved for Phase B success).

**Phase B (number bond):**
1. Render 3 connected circles: left circle = `ekaWants`, right circle =
   `zeeWants`, top/parent circle = `?`. Connect with simple lines/curves
   (check Game 7's number-bond rendering for the established visual
   convention in this codebase and reuse its layout logic if it's
   factored out; otherwise draw with `this.add.graphics()` circles +
   lines matching this game's sky/pizza color palette).
2. Below the bond, show the 3 shuffled option pills from `round.options`.
3. Tap an option:
   - Wrong → pill does a small shake/red-flash, stays interactive, no
     scene change.
   - Correct → pill flashes green, `?` circle fills with the number,
     emit `game8-round-correct` (Game.jsx already listens and shows
     confetti), then after a beat load round `n+1` and reset Phase A
     state. If `n === 5`, round 6 begins with rounds-6–10 rules (§5) —
     no scene restart, just swap which voice lines / pizza pre-fill /
     bond layout get used based on `roundIndex > 5`.

---

## 5. Rounds 6–10 walkthrough — "find the missing part"

Same two-phase shape, different starting state and different `?` circle.

**Phase A (topping):**
1. Voice sequence: `vo-4` ("chef Eka has put") → number-voice for
   `ekaHas` → `vo-5` ("Help chef Zee put the remaining toppings"). No
   `vo-1` here — that only ever plays once, on round 1.
2. **Pizza starts pre-filled**: at the start of Phase A for this round,
   immediately place `ekaHas` toppings into the first `ekaHas` slots (any
   topping graphic — type still doesn't matter). A quick staggered
   fade-in reads better than a jump-cut. These pre-filled slots are
   **locked** — not draggable/removable by the child.
3. Remaining empty slots behave exactly like §4 step 3–4: child drags
   from the 5 containers to fill them.
4. **Fulfill Order** now checks `filledSlotCount === round.total` (the
   pre-filled `ekaHas` count already contributes to `filledSlotCount`, so
   the child only needs to add `zeeNeeds` more toppings). Same
   mismatch/match handling as §4.

**Phase B (number bond):**
1. Same 3-circle layout, but now: left circle = `ekaHas` (known, filled
   in), right circle = `?` (this is what the child solves — matches
   `zeeNeeds`), top circle = `total` (known, filled in). This is the
   layout swap: *the total is no longer the question mark; one of the
   parts is, with the other part being the amount Chef Eka already put.*
2. Options, correctness handling, and round-advance logic are identical
   to §4 Phase B, solving for `zeeNeeds` instead of `total`. If `n ===
   10`, do **not** load another round — go to §7's end-of-game flow
   instead.

---

## 6. Voice line reference (exact usage)

| Key | Text | When |
|---|---|---|
| `vo-1` | Help the Chefs complete the pizza by adding toppings. | Once only, round 1 |
| `vo-2` | chef Eka wants | Every round 1–5, before Eka's number |
| `vo-3` | chef Zee wants | Every round 1–5, before Zee's number |
| `vo-4` | chef Eka has put | Every round 6–10, before Eka's number |
| `vo-5` | Help chef Zee put the remaining toppings | Every round 6–10, right after `vo-4` + number |

Numbers themselves always come from the shared `numbersVoice.js`
manifest/helper (`playNumberVoice(n)` or whatever its actual exported name
is — confirm in that file), never a locally recorded number. Queue clips
so they play sequentially, not overlapping — reuse whatever chaining
pattern `speech.js` or Game 7's scene already uses for this exact
"phrase + number" concatenation, since this is the second game to need
it.

---

## 7. Feedback, state, and end-of-game logging

- "Try again" has no dedicated voice asset — use text/animation only
  (shake + red flash reads as "wrong" without needing narration).
- Track `filledSlotCount` and `round.total` as scene-level state reset at
  the start of each round's Phase A (re-seeded with `ekaHas` pre-fills
  for rounds 6–10).
- `game8-round-correct` fires once per round, at the moment Phase B is
  answered correctly (not at Phase A success — that gets a smaller local
  celebration only, so the two phases feel distinct). This fires 10
  times total across a full playthrough.
- There is **no per-level star/complete event** anymore — no level
  select screen means nothing needs to render level cards. Don't call
  `createStarProgress` or emit a mid-game "level complete" event; the
  round-1-to-6 switch is silent (covered by the differing voice lines and
  pizza pre-fill already signaling the change to the child).
- **Score logging happens exactly once**, right after round 10's Phase B
  is answered correctly: emit `game8-complete` (matches
  `completeEventName` in `Game.jsx`, which already calls
  `logPlaySession`). Track through the run and include in the payload:
  `totalRounds: 10`, a `mistakes` count (increment on every wrong
  Fulfill-Order tap and every wrong bond-option tap across all 10
  rounds), and `stars` computed from that mistake count (e.g. 3 stars for
  0 mistakes, 2 for 1–3, 1 for 4+ — pick whatever scale matches how other
  bonus games translate mistakes → stars; check Game 4/Game 7's
  `handleComplete` payload shape in their `Game.jsx` and mirror the field
  names exactly so `logPlaySession`/the teacher dashboard parses it the
  same way).
- After logging, show an end-of-game screen state (reuse the pizza scene
  — e.g. both chefs celebrating, a "Great job!" pill, maybe a "Play
  Again" button that rebuilds a fresh 10-round sequence and resets
  `roundIndex` to 1) rather than navigating anywhere, since there's no
  level select to return to.

---

## 8. Mute / music / preload — no changes needed

`audioState.js` (`ensureBgMusic`, `addMuteButton`) is already correct as
scaffolded — keep calling it from `GameScene` exactly as the placeholder
does now. `assets.js` only needs the `NUMBERS_VOICE_MANIFEST` spread from
§2.

---

## 9. Build order (do these in sequence)

1. `assets.js` — spread in `NUMBERS_VOICE_MANIFEST`.
2. `levels.js` — replace with the round-sequence generator from §3
   (`buildRoundSequence()`, repetition rules, option generation). Rename
   file's exports as needed; it no longer needs to export level "cards."
3. `Game.jsx` — **remove `LevelSelectScene` from `buildScenes`** so the
   flow is `PreloadScene → GameScene` directly (`nextSceneKey:
   'GameScene'` on `BasePreloadScene`).
4. `LevelSelectScene.js` — **delete this file** (or leave it unimported
   and unused if you'd rather not touch git history right now) since
   there is no level-select entry point anymore.
5. `GameScene.js` — replace the placeholder body with the round/phase
   state machine (`roundIndex` 1–10, `'topping'` / `'numberBond'`), pizza
   + slot layout, chef placement, drag/drop for containers, Fulfill Order
   button, number-bond rendering + option pills, voice-line sequencing,
   mistake tracking, and the single end-of-game `game8-complete` emission
   with logging payload.
6. Manual playtest: play all 10 rounds start to finish, deliberately get
   a couple of Fulfill-Order and bond answers wrong along the way, and
   confirm: (a) round 6 switches rules with no visible scene break, (b)
   `game8-complete` fires exactly once at the very end, (c) the logged
   `mistakes`/`stars` reflect what actually happened, (d) totals never
   exceed 10, (e) no two of the ten rounds in a row repeat the same
   total/answer.
7. Registration (per `PROJECT_CONTEXT.md` §13, still outstanding for
   Game 8): add the `/game8` route in `main.jsx`, add a `key: '8'` entry
   to `GAME_CATALOG` in `gameAccess.js`. Separate from the in-game logic
   above; do it last.

---

## 10. Things to explicitly double-check against the real codebase before writing code

- Exact drag-and-drop event idiom already used in Game 4 / Game 7.
- Exact number-bond circle-drawing approach already used in Game 7.
- Exact exported function name(s) in `numbersVoice.js` and `speech.js`.
- Exact `handleComplete`/`logPlaySession` payload field names another
  bonus game already uses, so Game 8's single end-of-run log matches the
  same shape the teacher dashboard expects.