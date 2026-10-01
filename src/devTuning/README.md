# `@/devTuning` — shared live-tuning kit

A reusable, schema-driven editor for tuning Phaser games live (drag sliders,
copy values back to source) with **no page reload** and **zero production cost**.

- **`core.js`** — `createTuning({ id, tables })`. Framework-free engine. In a
  production build it returns a direct constant read (no globals/bus/HMR).
- **`config.js`** — the master switch (`TUNING_DEV_ENABLED`).
- **`DevTuningPanel.jsx`** — the lazy, DEV-gated React sidebar. Driven by a
  schema, so it never imports a game.

A game opts in by writing a tuning file that calls `createTuning`, reading values
through the returned accessors, and mounting the panel in its `Game.jsx`.

**Full guide:** [`docs/DEV_TUNING.md`](../../docs/DEV_TUNING.md)
**Template:** [`docs/dev-tuning/gameTuning.template.js`](../../docs/dev-tuning/gameTuning.template.js)
**Worked example:** [`src/games/game-13/roadTuning.js`](../games/game-13/roadTuning.js)
