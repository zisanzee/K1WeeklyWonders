# Dev Tuning Kit

A reusable, schema-driven **live tuning editor** for Phaser games. Drag sliders
beside the running game to re-tune numbers, drag on-canvas handles, and copy the
final values back into your tuning file — with **no page reload**.

- **Zero cost when off.** In a production build the whole thing folds away:
  `createTuning()` returns a direct constant read, and the panel chunk is never
  emitted. See [Turning it off / no production cost](#turning-it-off--no-production-cost).
- One shared engine (`src/devTuning/`) serves every game. Add a game by writing a
  tuning file + a schema — no new panel code.

## Files

| File | Role |
| --- | --- |
| `src/devTuning/core.js` | The engine (`createTuning`). **Framework-free.** |
| `src/devTuning/config.js` | The shared master switch (`TUNING_DEV_ENABLED`). |
| `src/devTuning/panel.js` | **The single DEV gate** — owns the literal `import.meta.env.DEV` on the dynamic `import()`. |
| `src/devTuning/DevTuningFrame.jsx` | The wrapper a game mounts (gate + layout). |
| `src/devTuning/DevTuningPanel.jsx` | The lazy, DEV-gated React sidebar. |
| `src/games/<game>/<game>Tuning.js` | A game's tables + accessors + schema. |

## How it works

```
   your game's tuning file            the kit                the scene
   ───────────────────────           ────────               ─────────
   tables (the numbers)  ─────────▶  createTuning()  ──────▶  get('CAR')
                                          ▲
        panel sliders ── set(patch) ──────┤  (dev overrides)
                                          │
   save the file (HMR) ── publish ────────┤  (base tables)
                                          ▼
                               subscribe() + setRelayout()
```

- The scene reads every value through the kit's `get(key)` — **never** the raw
  constants. `get()` overlays any live dev override on top of the base tables.
- **Two ways to apply live:**
  1. **Edit a number and save** — Vite hot-reloads the module, its `accept` hook
     re-publishes the tables to a `globalThis` slot, and pokes the scene. The
     running scene's old `get()` closure see the new values on its next call.
     (This is why a plain `export const` edit alone is not enough: a running scene
     holds the *old* module's copy.)
  2. **Drag a slider** in the panel — it writes to the override store, which is
     separate from the base tables so the two never clobber each other.
- The scene registers one `setRelayout(fn)` callback. Every change (slider, HMR,
  on-canvas drag) calls it, so the scene re-applies values to what is on screen.

## Integrating into a new game

### 1. Create the tuning file

Copy [`docs/dev-tuning/gameTuning.template.js`](./dev-tuning/gameTuning.template.js)
to `src/games/<slug>/<slug>Tuning.js` and fill in your tables + schema.

The key parts:

```js
import { createTuning } from '@/devTuning/core';

export const CAR = { y: 900, scale: 1 }; // your tunable tables

const TABLES = { CAR /* … */ };

export const TUNING = createTuning({ id: 'MYGAME', tables: TABLES });

// Thin accessors the scene reads through (never the raw constants).
export const getCar = () => TUNING.get('CAR');

// Describe the controls for the panel; `format` prints copy-paste source.
export const TUNING_SCHEMA = {
  title: 'MY GAME · LIVE TUNING',
  format: formatTuningCode,
  groups: [
    { key: 'CAR', label: 'Car', fields: [
      { path: 'y', label: 'y', min: 0, max: 1080, step: 1 },
      { path: 'scale', label: 'scale', min: 0, max: 3, step: 0.01 },
    ] },
  ],
};
```

### 2. Read through the accessors in the scene

```js
import { getCar, TUNING } from '@/games/<slug>/<slug>Tuning';

create() {
  // …build your objects…
  TUNING.setRelayout(() => this.applyTuning()); // re-apply on any change
}

applyTuning() {
  // push the current values onto the live objects (no rebuild)
  this.car.setY(getCar().y);
}
```

### 3. Mount the shared panel in `Game.jsx`

Wrap the game in the shared `<DevTuningFrame>` — it owns BOTH the DEV gate and
the layout, so there is no `if` and no `lazy()`/`Suspense` to write yourself:

```jsx
import { TUNING, TUNING_SCHEMA } from '@/games/<slug>/<slug>Tuning';
import DevTuningFrame from '@/devTuning/DevTuningFrame';

// …build `game`…

// Production (or the editor switched off) → returns `game` unchanged.
return (
  <DevTuningFrame tuning={TUNING} schema={TUNING_SCHEMA}>
    {game}
  </DevTuningFrame>
);
```

In production the frame returns `children` untouched — no extra DOM, no Suspense,
no chunk. Two optional props:

- `layout="stack"` — game on top, panel below (for portrait / constrained pages).
  Default is side-by-side.
- `enabled={MY_GAME_TUNING_ENABLED}` — a game's own **local-dev** off switch so
  one game can go player-facing while the shared `TUNING_DEV_ENABLED` stays on
  for the others. It is checked *after* the build gate, so it can only ever hide
  the editor in dev — never re-enable it in production.

> **Do NOT write your own `import.meta.env.DEV && … ? lazy(import(…))` gate.**
> The gate must live on the *literal* `import.meta.env.DEV` expression in the
> same module as the dynamic `import()`, or Vite can't prove it's dead output:
> with a helper like `export const DEV_TUNING = import.meta.env.DEV && …` the
> condition is no longer a literal at the import site, so the panel chunk is
> still **emitted** (only not loaded). That single correct gate already exists
> in [`src/devTuning/panel.js`](../src/devTuning/panel.js); `<DevTuningFrame>`
> consumes it. Games stay gate-free.
### 4. Add on-canvas handles (optional)

For draggable lane boxes / drop zones, create invisible interactive zones in dev
and write back through the kit — the panel then mirrors them:

```js
if (import.meta.env.DEV) {
  zone.on('pointermove', () => {
    if (!dragging) return;
    TUNING.set({ LANES: { [laneId]: { x: pointer.x } } });
  });
}
```

## Schema reference

Each group is one of:

- **Object group** — `{ key, label, fields }`. `key` is a table name; each field
  is a slider (`{ path, label, min, max, step, suffix }`) or a toggle
  (`{ type: 'toggle' }`). `path` may be dotted (`crash.shake.amplitude`) and
  deep-merges, so patching one leaf never drops its siblings.
- **Array group** — `{ type: 'array', key, itemLabel, fields }`. For arrays of
  `{ id, … }` rows (e.g. lanes); the panel shows a pill picker for the row and
  sliders for the selected item. `itemLabel(row)` customises the pill text.

`format(values)` receives the full current value set and returns copy-paste
source. `copyHint` is the little text next to the copy button.

## Turning it off / no production cost

Two layers, both keyed off `import.meta.env.DEV`:

1. **Runtime** — `createTuning()` checks `import.meta.env.DEV` once. Off, `get()`
   is `(key) => tables[key]`; no globals, no bus, no merge, no HMR. This is
   precise: off means "a plain property read", nothing else.
2. **Bundle** — `panel.js` holds the one literal `import.meta.env.DEV` gate on
   the dynamic `import()`. In production it folds to `null`, the import is dead
   code, and the sidebar chunk is not emitted at all. Games that mount
   `<DevTuningFrame>` ship zero panel code.

To keep the wiring but disable the editor **during local dev** (e.g. to test the
shipping code path), set `TUNING_DEV_ENABLED = false` in
[`src/devTuning/config.js`](../src/devTuning/config.js). To disable it for just
one game, pass `enabled={false}` to that game's `<DevTuningFrame>`.

> **This guarantee survives pushing with the editor on.** Even if
> `TUNING_DEV_ENABLED` (and a game's own flag) are `true`, a `vite build` — what
> CI and Netlify run — always emits `import.meta.env.DEV === false`, so the panel
> chunk is absent from `dist/`. The switches only affect the local `vite dev`
> server.

## Backing up / removing a game's editor

The kit is a single shared folder; a game's opt-in is entirely its own tuning
file's `createTuning` call + the `Game.jsx` mount. To retire an editor for one
game, drop the mount (the tuning file keeps working as plain constants). To
remove the whole kit, delete `src/devTuning/` and the `Game.jsx` mounts.

## Games using the kit

- **Game 13** — `src/games/game-13/roadTuning.js` (lanes, car, obstacle, HUD).
- **Game 12** — `src/games/game-12/sceneTuning.js` (characters + drop boxes, via
  arrays keyed by texture key; `GameScene` also adds on-canvas drag handles).

Game 12 originally shipped a bespoke copy of this editor, backed up by hand under
`src/games/game-12/dev-backup/`. It has since been ported to this kit and the
bespoke copy deleted — the engine and panel are shared, and a game only supplies
data, so there is nothing to copy around.
