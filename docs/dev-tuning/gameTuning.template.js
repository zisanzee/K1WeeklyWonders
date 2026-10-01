// <game>Tuning.js — TEMPLATE
//
// Copy this file to `src/games/<slug>/<slug>Tuning.js` and edit:
//   - the tables (your tunable numbers)
//   - the accessors (one per section the scene reads)
//   - TUNING_SCHEMA.groups (one control per tunable)
//   - formatTuningCode (prints the tables back out as source)
//
// See docs/DEV_TUNING.md for the full walkthrough.
import { createTuning } from '@/devTuning/core';

// ---------------------------------------------------------------------------
// TABLES — the numbers you tune. Edit these and save; the running game updates.
// ---------------------------------------------------------------------------

// A flat section: every key is a scalar the panel can bind a slider to.
export const ENGINE = {
  speed: 300,
  gravity: 800,
  jump: 520,
};

// A nested section: `path` in the schema can go arbitrarily deep
// (e.g. 'player.jump.height'); patches deep-merge so siblings survive.
export const PLAYER = {
  x: 360,
  y: 900,
  scale: 1,
  jump: { height: 120, durationMs: 420 },
};

// An array section: rows MUST have a unique numeric `id` (the panel and the
// override store key off it).
export const LANES = [
  { id: 0, x: 180, w: 220 },
  { id: 1, x: 540, w: 220 },
];

// Every section the scene reads, by the SAME name the schema uses.
const TABLES = { ENGINE, PLAYER, LANES };

// ---------------------------------------------------------------------------
// TUNING INSTANCE
// ---------------------------------------------------------------------------
// `id` namespaces the globals the kit publishes (must be unique per game).
export const TUNING = createTuning({ id: 'MYGAME', tables: TABLES });

// ---------------------------------------------------------------------------
// ACCESSORS — the scene reads through these, never the raw constants.
// ---------------------------------------------------------------------------
export const getEngine = () => TUNING.get('ENGINE');
export const getPlayer = () => TUNING.get('PLAYER');
export const getLanes = () => TUNING.get('LANES');

// ---------------------------------------------------------------------------
// COPY-PASTE FORMATTER — turn the current values back into source.
// ---------------------------------------------------------------------------
function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatTuningCode() {
  const engine = getEngine();
  const player = getPlayer();
  const lanes = getLanes();
  return [
    `export const ENGINE = { speed: ${fmt(engine.speed)}, gravity: ${fmt(engine.gravity)}, jump: ${fmt(engine.jump)} };`,
    '',
    'export const PLAYER = {',
    `  x: ${fmt(player.x)}, y: ${fmt(player.y)}, scale: ${fmt(player.scale)},`,
    `  jump: { height: ${fmt(player.jump.height)}, durationMs: ${fmt(player.jump.durationMs)} },`,
    '};',
    '',
    'export const LANES = [',
    lanes.map((l) => `  { id: ${l.id}, x: ${fmt(l.x)}, w: ${fmt(l.w)} },`).join('\n'),
    '];',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// SCHEMA — the panel renders this.
// ---------------------------------------------------------------------------
export const TUNING_SCHEMA = {
  title: 'MY GAME · LIVE TUNING',
  help: 'Drag a slider for live updates; edit this file and save to hot-reload.',
  copyHint: 'paste into <game>Tuning.js',
  format: formatTuningCode,
  groups: [
    {
      key: 'ENGINE',
      label: 'Engine',
      fields: [
        { path: 'speed', label: 'speed', min: 0, max: 1000, step: 10 },
        { path: 'gravity', label: 'gravity', min: 0, max: 3000, step: 50 },
        { path: 'jump', label: 'jump', min: 0, max: 1500, step: 10, suffix: 'px/s' },
      ],
    },
    {
      key: 'PLAYER',
      label: 'Player',
      fields: [
        { path: 'x', label: 'x', min: 0, max: 720, step: 1 },
        { path: 'y', label: 'y', min: 0, max: 1080, step: 1 },
        { path: 'scale', label: 'scale', min: 0, max: 3, step: 0.01 },
        { path: 'jump.height', label: 'jump h', min: 0, max: 400, step: 5 },
        { path: 'jump.durationMs', label: 'jump ms', min: 100, max: 1200, step: 10, suffix: 'ms' },
      ],
    },
    {
      // Array group — pill picker for the row + sliders for the selected item.
      type: 'array',
      key: 'LANES',
      label: 'Lanes',
      itemLabel: (row) => `Lane ${row.id}`,
      fields: [
        { path: 'x', label: 'x', min: -200, max: 920, step: 1 },
        { path: 'w', label: 'w', min: 40, max: 720, step: 1 },
      ],
    },
  ],
};

// Dev-only hot-reload: the kit has already republished the new tables, so a poke
// re-applies them to the running scene. accept() keeps Vite from a full reload.
if (import.meta.hot) {
  import.meta.hot.accept(() => TUNING.requestRelayout());
}
