// sceneTuning.js
// Position Mission! — THE TUNING FILE.
//
// Every number the game reads lives here, so characters, their drop boxes and
// the whole layout can be re-tuned by eye without touching any logic. This is a
// thin wrapper over the shared dev-tuning kit (@/devTuning): the tables below
// are handed to createTuning(), and the exported accessors read through it, so
// two things apply live with no page reload:
//   1. Edit a number below and save — Vite hot-reloads this module and the kit
//      re-applies it to the running scene.
//   2. In dev, drag the sliders in the shared DevTuningPanel (see Game.jsx) or
//      drag a character / box straight on the canvas.
// In a production build createTuning() returns a plain direct read — no globals,
// no bus, no merge — and the panel is never loaded.
//
// Coordinate space: x / y are INTERNAL pixels on the 720x1080 canvas (see
// DEFAULT_BASE_RESOLUTION in phaser/config.js). x = 0 is the left edge, y = 0
// the top, (360, 540) is the exact centre.
import { createTuning } from '@/devTuning/core';
import { availableScenes } from '@/games/game-12/scenes';

// ---------------------------------------------------------------------------
// DEV SCOPE — which scene/round the panel is editing (cycled in the nav bar)
// ---------------------------------------------------------------------------
// Not a real table (not registered with the kit); plain module state the panel's
// nav handlers mutate and the schema's `scope` functions read. Dev-only.
// Per-game dev-editor switch. The whole kit wiring stays in place; flip this to
// true to bring the live editor back for this game (it also requires
// import.meta.env.DEV, so it can never reach a production build).
export const DEV_TUNING_ENABLED = false;

let devScene = availableScenes()[0] ?? 1;

// The scene calls this whenever its dev navigation changes scene, so the panel's
// figure grids follow what is actually on screen. Dev-only.
export function setDevScope(scene) {
  if (scene != null) devScene = scene;
}

// Rows whose key belongs to the current scene (scene<N>…). Empty when the scope
// spans rounds (the "All" pill) so a whole scene's figures can be edited at once.
const inCurrentScene = (rows) => rows.filter((r) => r.id.startsWith(`scene${devScene}`));

// ---------------------------------------------------------------------------
// BACKGROUND COVER FIT
// ---------------------------------------------------------------------------
// Each scene background is cover-fit: scaled to fill the whole canvas with no
// letterboxing, centred, then nudged/zoomed/flipped. SCENE_FIT holds per-scene
// overrides (only the values that differ); a scene absent from it uses
// BACKGROUND_FIT unchanged.
export const BACKGROUND_FIT = { offsetX: 0, offsetY: 0, zoom: 1, flipX: false };
export const SCENE_FIT = [{ id: 3, flipX: true }];

// ---------------------------------------------------------------------------
// CHARACTERS — every character cut-out in the game, one row per scene slot
// ---------------------------------------------------------------------------
//   id        texture key (scene<N>Character<I>)
//   x,y       centre on the canvas
//   scale     multiplier (1 = original PNG size)
//   rotation  degrees, clockwise
//   flipX     0 = normal, 1 = mirrored left-to-right
//   z         layer order within the scene (higher draws on top)
export const CHARACTERS = [
  { id: 'scene1Character2', x: 148.235, y: 461.765, scale: 0.43, rotation: 0, flipX: 0, z: 2 },
  { id: 'scene1Character3', x: 314.706, y: 445.294, scale: 0.43, rotation: 0, flipX: 0, z: 3 },
  { id: 'scene1Character4', x: 491.176, y: 529.412, scale: 0.43, rotation: 0, flipX: 0, z: 4 },
  { id: 'scene2Character1', x: 296.059, y: 266.118, scale: 0.15, rotation: 0, flipX: 0, z: 1 },
  { id: 'scene2Character2', x: 466.471, y: 605.882, scale: 0.4, rotation: 0, flipX: 1, z: 2 },
  { id: 'scene3Character1', x: 320.941, y: 635.353, scale: 0.49, rotation: 0, flipX: 1, z: 1 },
  { id: 'scene3Character2', x: 458.235, y: 618.824, scale: 0.49, rotation: 0, flipX: 1, z: 2 },
  { id: 'scene3Character3', x: 614.118, y: 607.647, scale: 0.49, rotation: 0, flipX: 1, z: 3 },
  { id: 'scene4Character1', x: 324.118, y: 517.647, scale: 0.36, rotation: 0, flipX: 0, z: 1 },
  { id: 'scene4Character2', x: 355.294, y: 231.176, scale: 0.36, rotation: 0, flipX: 0, z: 2 },
  { id: 'scene5Character1', x: 165.217, y: 577.101, scale: 0.59, rotation: 0, flipX: 0, z: 1 },
  { id: 'scene5Character2', x: 555.986, y: 440.043, scale: 0.81, rotation: 0, flipX: 0, z: 2 },
  { id: 'scene6Character1', x: 364.038, y: 254.756, scale: 0.77, rotation: 0, flipX: 0, z: 1 },
  { id: 'scene6Character2', x: 400.091, y: 732.182, scale: 0.5, rotation: 0, flipX: 0, z: 2 },
];

export const BOXES = [
  { id: 'scene1Character2', x: 126.206, y: 530.171, w: 246, h: 858 },
  { id: 'scene1Character3', x: 326.3, y: 442.975, w: 144, h: 411.69 },
  { id: 'scene1Character4', x: 527.118, y: 538.687, w: 251, h: 969 },
  { id: 'scene2Character1', x: 306.494, y: 184.959, w: 517, h: 319 },
  { id: 'scene2Character2', x: 411.978, y: 682.404, w: 596, h: 345 },
  { id: 'scene3Character1', x: 239.782, y: 521.73, w: 308, h: 883 },
  { id: 'scene3Character2', x: 458.235, y: 618.824, w: 122, h: 438.21 },
  { id: 'scene3Character3', x: 622.234, y: 514.893, w: 201, h: 935 },
  { id: 'scene4Character1', x: 357.741, y: 554.748, w: 720, h: 285 },
  { id: 'scene4Character2', x: 359.932, y: 211.466, w: 720, h: 319 },
  { id: 'scene5Character1', x: 165.217, y: 577.101, w: 281.57, h: 960 },
  { id: 'scene5Character2', x: 607.392, y: 542.318, w: 220.72, h: 935 },
  { id: 'scene6Character1', x: 366.766, y: 411.574, w: 807, h: 305 },
  { id: 'scene6Character2', x: 360, y: 800.579, w: 720, h: 396 },
];

export const LAYOUT = {
  promptY: 96,
  promptSideY: 946,
  promptSideLeft: 330,
  promptSideMaxW: 340,
  promptLineGap: 14,
  startBtnYRatio: 0.83,
  startBtnW: 320,
  trayTop: 856,
  trayTopRaised: 812,
  traySideX: 168,
  trayBox: 196,
  boxDropPad: 24,
  boxMinSize: 40,
  boxPadding: 16,
  roundAdvanceMs: 520,
  successHoldMs: 1690,
};
// ---------------------------------------------------------------------------
// PROMPT STYLE + CARD
// ---------------------------------------------------------------------------
export const PROMPT_STYLE = {
  font: 'Fredoka, sans-serif',
  size: 32,
  emphasisScale: 1.5, // extra size on the relation word
  color: '#3b2f1e',
  emphasisColor: '#c2410c',
  stroke: '#fffdf5',
  gap: 12,
  imgW: 124, // inline pictures share this width…
  imgMinH: 60, // …then their height is clamped into this band
  imgMaxH: 104,
};

export const CARD = {
  fill: 0xfff7e6,
  fillAlpha: 0.94,
  stroke: 0x5b4a2f,
  strokeAlpha: 0.28,
  strokeWidth: 4,
  radius: 26,
  padX: 30,
  padY: 20,
  shadowAlpha: 0.16,
  shadowDy: 7,
};

export const DEPTH = { backdrop: 0, chars: 5, hud: 33, tray: 30, drag: 60, start: 400 };

// ===========================================================================
// LIVE TUNING (shared kit)
// ===========================================================================
const TABLES = {
  BACKGROUND_FIT,
  SCENE_FIT,
  CHARACTERS,
  BOXES,
  LAYOUT,
  PROMPT_STYLE,
  CARD,
  DEPTH,
};

export const TUNING = createTuning({ id: 'G12', tables: TABLES });

// --- read API — one accessor per section the scene consumes. ---
export const getCharacters = () => TUNING.get('CHARACTERS');
export const getBoxes = () => TUNING.get('BOXES');
export const getLayout = () => TUNING.get('LAYOUT');
export const getPromptStyle = () => TUNING.get('PROMPT_STYLE');
export const getCard = () => TUNING.get('CARD');
export const getDepth = () => TUNING.get('DEPTH');

// A character's transform, falling back to a centred default so a character
// missing from CHARACTERS is visible (dead centre) rather than invisible.
export function partTransform(id) {
  const row = getCharacters().find((c) => c.id === id);
  return row ? { ...row } : { x: 360, y: 540, scale: 1, rotation: 0, flipX: 0, z: 0 };
}

// A character's explicit drop box, or null when it has none (the scene then
// derives a default box from the character's art).
export function boxOverride(id) {
  return getBoxes().find((b) => b.id === id) || null;
}

// The resolved cover-fit config for a scene: BACKGROUND_FIT with that scene's
// SCENE_FIT override (if any) merged on top.
export function backgroundFit(scene) {
  const base = TUNING.get('BACKGROUND_FIT');
  const over = getSceneFit(scene);
  return over ? { ...base, ...over } : { ...base };
}

export function getSceneFit(scene) {
  const row = TUNING.get('SCENE_FIT').find((s) => s.id === scene);
  return row ? { flipX: !!row.flipX } : null;
}

// The padding a default (auto) box adds around the character's art.
export function boxPadding() {
  return getLayout().boxPadding ?? 16;
}

// ---------------------------------------------------------------------------
// Copy-paste readout — a snapshot a good live session can be pasted back into.
// ---------------------------------------------------------------------------
function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatTuningCode() {
  const chars = getCharacters()
    .map(
      (c) =>
        `  { id: '${c.id}', x: ${fmt(c.x)}, y: ${fmt(c.y)}, scale: ${fmt(c.scale)}, rotation: ${fmt(
          c.rotation
        )}, flipX: ${c.flipX ? 1 : 0}, z: ${fmt(c.z)} },`
    )
    .join('\n');
  const boxes = getBoxes()
    .map((b) => `  { id: '${b.id}', x: ${fmt(b.x)}, y: ${fmt(b.y)}, w: ${fmt(b.w)}, h: ${fmt(b.h)} },`)
    .join('\n');
  const layout = getLayout();
  const layoutLines = Object.entries(layout)
    .map(([k, v]) => `  ${k}: ${fmt(v)},`)
    .join('\n');
  return [
    'export const CHARACTERS = [',
    chars,
    '];',
    '',
    'export const BOXES = [',
    boxes,
    '];',
    '',
    'export const LAYOUT = {',
    layoutLines,
    '};',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// DEV PANEL SCHEMA — describes every tunable as a slider (or toggle). The shared
// DevTuningPanel renders this; `format` prints the copy-paste source above.
// ---------------------------------------------------------------------------
const charFields = [
  { path: 'x', label: 'x', min: -400, max: 1120, step: 1 },
  { path: 'y', label: 'y', min: -400, max: 1480, step: 1 },
  { path: 'scale', label: 'scale', min: 0, max: 4, step: 0.01 },
  { path: 'rotation', label: 'rotation', min: -180, max: 180, step: 1, suffix: '°' },
  { path: 'flipX', label: 'flipX (0/1)', min: 0, max: 1, step: 1 },
  { path: 'z', label: 'z', min: 0, max: 20, step: 1 },
];

const boxFields = [
  { path: 'x', label: 'x', min: -400, max: 1120, step: 1 },
  { path: 'y', label: 'y', min: -400, max: 1480, step: 1 },
  { path: 'w', label: 'w', min: 20, max: 900, step: 1 },
  { path: 'h', label: 'h', min: 20, max: 1200, step: 1 },
];

export const TUNING_SCHEMA = {
  title: 'POSITION MISSION · LIVE TUNING',
  help: 'Step scenes/rounds with ◀ ▶; the figure grids show only that scene. Drag a character/box on the canvas, or a slider. Edit sceneTuning.js and save to hot-reload.',
  copyHint: 'paste into sceneTuning.js',
  format: formatTuningCode,
  // Show the scene/round navigator in the panel.
  nav: true,
  groups: [
    // Scope the figure grids to the scene/round chosen in the nav — so what you
    // edit is exactly the scene (or the whole scene) currently on screen.
    {
      type: 'array',
      key: 'CHARACTERS',
      label: 'Characters',
      itemLabel: (r) => r.id,
      fields: charFields,
      scope: inCurrentScene,
    },
    {
      type: 'array',
      key: 'BOXES',
      label: 'Drop boxes',
      itemLabel: (r) => r.id,
      fields: boxFields,
      scope: inCurrentScene,
    },
    {
      key: 'LAYOUT',
      label: 'Layout',
      fields: [
        { path: 'promptY', label: 'prompt y', min: 0, max: 1080, step: 1 },
        { path: 'promptSideY', label: 'side prompt y', min: 0, max: 1080, step: 1 },
        { path: 'promptSideLeft', label: 'side left', min: 0, max: 720, step: 1 },
        { path: 'promptSideMaxW', label: 'side max w', min: 100, max: 720, step: 1 },
        { path: 'startBtnYRatio', label: 'btn y ratio', min: 0, max: 1, step: 0.01 },
        { path: 'startBtnW', label: 'btn width', min: 80, max: 720, step: 4 },
        { path: 'trayTop', label: 'tray top', min: 600, max: 1000, step: 1 },
        { path: 'trayTopRaised', label: 'tray top raised', min: 500, max: 1000, step: 1 },
        { path: 'traySideX', label: 'tray side x', min: 0, max: 720, step: 1 },
        { path: 'trayBox', label: 'disc size', min: 80, max: 320, step: 2 },
        { path: 'boxDropPad', label: 'drop pad', min: 0, max: 120, step: 1 },
        { path: 'boxPadding', label: 'auto box pad', min: 0, max: 120, step: 1 },
        { path: 'roundAdvanceMs', label: 'round beat', min: 0, max: 3000, step: 10, suffix: 'ms' },
        { path: 'successHoldMs', label: 'success hold', min: 0, max: 4000, step: 10, suffix: 'ms' },
      ],
    },
    {
      key: 'PROMPT_STYLE',
      label: 'Prompt style',
      fields: [
        { path: 'size', label: 'font size', min: 16, max: 80, step: 1 },
        { path: 'emphasisScale', label: 'emphasis ×', min: 1, max: 3, step: 0.05 },
        { path: 'gap', label: 'gap', min: 0, max: 60, step: 1 },
        { path: 'imgW', label: 'img width', min: 40, max: 300, step: 2 },
        { path: 'imgMinH', label: 'img min h', min: 20, max: 200, step: 2 },
        { path: 'imgMaxH', label: 'img max h', min: 20, max: 300, step: 2 },
      ],
    },
    {
      key: 'CARD',
      label: 'Prompt card',
      fields: [
        { path: 'fillAlpha', label: 'fill alpha', min: 0, max: 1, step: 0.02 },
        { path: 'strokeAlpha', label: 'stroke alpha', min: 0, max: 1, step: 0.02 },
        { path: 'strokeWidth', label: 'stroke w', min: 0, max: 12, step: 1 },
        { path: 'radius', label: 'radius', min: 0, max: 80, step: 1 },
        { path: 'padX', label: 'pad x', min: 0, max: 120, step: 1 },
        { path: 'padY', label: 'pad y', min: 0, max: 120, step: 1 },
        { path: 'shadowDy', label: 'shadow dy', min: 0, max: 40, step: 1 },
      ],
    },
    {
      key: 'BACKGROUND_FIT',
      label: 'Background fit',
      fields: [
        { path: 'offsetX', label: 'offset x', min: -400, max: 400, step: 1 },
        { path: 'offsetY', label: 'offset y', min: -400, max: 400, step: 1 },
        { path: 'zoom', label: 'zoom', min: 0.5, max: 2, step: 0.01 },
        { path: 'flipX', label: 'flipX', type: 'toggle' },
      ],
    },
  ],
};

// Dev-only: when this file is saved, the kit has already published the new
// tables, so a relayout poke re-applies them to the running scene. accept()
// makes Vite treat this as a self-accepting update rather than reloading.
if (import.meta.hot) {
  import.meta.hot.accept(() => TUNING.requestRelayout());
}
