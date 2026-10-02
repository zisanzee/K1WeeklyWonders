# `@/devTuning` — shared live-tuning kit

A reusable, schema-driven editor for tuning Phaser games live (drag sliders,
copy values back to source) with **no page reload** and **zero production cost**.

- **`core.js`** — `createTuning({ id, tables })`. Framework-free engine. In a
  production build it returns a direct constant read (no globals/bus/HMR).
- **`config.js`** — the master switch (`TUNING_DEV_ENABLED`).
- **`panel.js`** — **THE single DEV gate.** Owns the *literal* `import.meta.env.DEV`
  expression on the dynamic `import()`, so the panel chunk is never emitted to a
  production build. Nothing else may re-declare this gate.
- **`DevTuningFrame.jsx`** — the wrapper a game mounts. In production it returns
  the game untouched (no DOM, no Suspense); in dev it lays out game + sidebar.
- **`DevTuningPanel.jsx`** — the lazy sidebar itself. Driven by a schema, so it
  never imports a game.

A game opts in by writing a tuning file that calls `createTuning`, reading values
through the returned accessors, and wrapping its game in `<DevTuningFrame>`:

```jsx
import DevTuningFrame from '@/devTuning/DevTuningFrame';

return (
  <DevTuningFrame tuning={TUNING} schema={TUNING_SCHEMA}>
    {game}
  </DevTuningFrame>
);
```

Games must **not** write their own `import.meta.env.DEV && … ? lazy(import(…))`
gate — the gate is centralized in `panel.js` so there is exactly one place to get
it right (see the next note).

**Full guide:** [`docs/DEV_TUNING.md`](../../docs/DEV_TUNING.md)
**Template:** [`docs/dev-tuning/gameTuning.template.js`](../../docs/dev-tuning/gameTuning.template.js)
**Worked example:** [`src/games/game-13/roadTuning.js`](../games/game-13/roadTuning.js)
