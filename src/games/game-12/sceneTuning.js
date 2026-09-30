// sceneTuning.js
// Position Mission! — THE TUNING FILE.
//
// This is the one file you edit to place the characters in each scene. Every
// character (and each scene's background) is listed below with its own
// { x, y, scale, rotation, flipX, z }. Change the numbers, save, and Phaser
// hot-reloads the scene — no logic changes needed.
//
// ---------------------------------------------------------------------------
// COORDINATE SPACE
// ---------------------------------------------------------------------------
// x / y are in the game's INTERNAL pixels: the canvas is 720 wide x 1080 tall
// (see DEFAULT_BASE_RESOLUTION in phaser/config.js). That space is then scaled
// to fit the screen, so you never need to think about device sizes.
//
//   x = 0   is the LEFT edge,      x = 720 is the RIGHT edge
//   y = 0   is the TOP edge,       y = 1080 is the BOTTOM edge
//   (360, 540) is the exact centre of the screen — a good home for a character.
//
// `rotation` is in DEGREES, clockwise. `scale` is a multiplier (1 = original
// PNG size, 2 = twice as big). `flipX: true` mirrors that one image
// left-to-right. `z` is the layer order within a scene: a higher `z` draws on
// top of a lower one (backgrounds are always behind every character).
//
// EVERY VALUE BELOW IS A STARTING GUESS — the characters ship as separate,
// pre-cropped cut-outs with no baked-in offsets, so tune them by eye (the
// in-page dev editor — see devEditor.js — lets you drag/slider them live). A
// character left out of this table still loads but draws dead centre at scale 1,
// which is much easier to notice and tune than a silent no-show.

// Reusable starting transform for a character you haven't placed yet.
export const DEFAULT_PART = { x: 360, y: 540, scale: 1, rotation: 0, flipX: false, z: 0 };

// ---------------------------------------------------------------------------
// BACKGROUND COVER FIT
// ---------------------------------------------------------------------------
// Every scene background is a full-screen image drawn COVER-fit: scaled so it
// fills the whole 720x1080 canvas with no letterboxing, its centre at the
// canvas centre. `offsetX` / `offsetY` slide it before the fit so you can push
// a skyline down or a horizon up without distorting it. `zoom` scales the
// cover-fit result slightly (1 = exact cover). `flipX: true` mirrors the whole
// backdrop left-to-right (handy when a scene's art is composed for the opposite
// side of the screen).
export const BACKGROUND_FIT = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  flipX: false,
};

// Per-scene overrides merged over BACKGROUND_FIT above. Only list what differs:
// a scene absent from this table uses the global defaults unchanged.
export const BACKGROUND_FIT_BY_SCENE = {
  3: { flipX: true },
};

// Default box size (centre-anchored w x h) for a character with no explicit box
// below — see CHARACTER_BOXES.
export const DEFAULT_BOX = { w: 200, h: 240 };

// ---------------------------------------------------------------------------
// CHARACTER TRANSFORMS  —  keyed by texture key (scene<N>Character<I>)
// ---------------------------------------------------------------------------
export const CHARACTER_POSITIONS = {
  // =========================================================================
  // SCENE 1
  // =========================================================================
  scene1Character2: { x: 148.235, y: 461.765, scale: 0.43, rotation: 0, flipX: false, z: 2 },
  scene1Character3: { x: 314.706, y: 445.294, scale: 0.43, rotation: 0, flipX: false, z: 3 },
  scene1Character4: { x: 491.176, y: 529.412, scale: 0.43, rotation: 0, flipX: false, z: 4 },
  
  // =========================================================================
  // SCENE 2
  // =========================================================================
  scene2Character1: { x: 296.059, y: 266.118, scale: 0.15, rotation: 0, flipX: false, z: 1 },
  scene2Character2: { x: 466.471, y: 605.882, scale: 0.4, rotation: 0, flipX: true, z: 2 },
  
  // =========================================================================
  // SCENE 3  (same cast keys as scene 1; whole scene mirrored like its backdrop)
  // =========================================================================
  scene3Character1: { x: 320.941, y: 635.353, scale: 0.49, rotation: 0, flipX: true, z: 1 },
  scene3Character2: { x: 458.235, y: 618.824, scale: 0.49, rotation: 0, flipX: true, z: 2 },
  scene3Character3: { x: 614.118, y: 607.647, scale: 0.49, rotation: 0, flipX: true, z: 3 },
  // =========================================================================
  // SCENE 4
  // =========================================================================
   scene4Character1: { x: 324.118, y: 517.647, scale: 0.36, rotation: 0, flipX: false, z: 1 },
  scene4Character2: { x: 355.294, y: 231.176, scale: 0.36, rotation: 0, flipX: false, z: 2 },

  // =========================================================================
  // SCENE 5  (starting guesses — tune with the dev editor)
  // =========================================================================
  scene5Character1: { x: 165.217, y: 577.101, scale: 0.59, rotation: 0, flipX: false, z: 1 },
  scene5Character2: { x: 628.986, y: 453.043, scale: 0.81, rotation: 0, flipX: false, z: 2 },

  // =========================================================================
  // SCENE 6  (starting guesses — tune with the dev editor)
  // =========================================================================
  scene6Character1: { x: 354.493, y: 102.029, scale: 0.92, rotation: 0, flipX: false, z: 1 },
  scene6Character2: { x: 409.855, y: 711.304, scale: 0.73, rotation: 0, flipX: false, z: 2 },
};

// ---------------------------------------------------------------------------
// DROP BOXES  —  keyed by texture key (scene<N>Character<I>)
// ---------------------------------------------------------------------------
// Each character has a rectangle ("box") on the scene. A character is accepted
// ONLY when dropped inside ITS OWN box; dropping inside ANY OTHER box counts as
// wrong. Boxes are drawn while tuning (and are target-preview-only in play —
// see GameScene's SHOW_BOXES_IN_PLAY).
//
//   x, y   the box CENTRE, in the same 720x1080 internal pixels as characters
//   w, h   the box size in px
//
// You do NOT have to list every character: a character with no entry here gets a
// box centred on its art, sized to its art plus a slice of padding (see
// BOX_PADDING in GameScene). Add an entry only when you want to move/resize a
// specific box, and tune it with the dev editor's Box section.
export const CHARACTER_BOXES = {
  scene1Character2: { x: 126.206, y: 530.171, w: 246, h: 858 },
  scene1Character3: { x: 326.3, y: 442.975, w: 144, h: 411.69 },
  scene1Character4: { x: 527.118, y: 538.687, w: 251, h: 969 },
    scene2Character1: { x: 306.494, y: 184.959, w: 517, h: 319 },
  scene2Character2: { x: 411.978, y: 682.404, w: 596, h: 345 },
    scene3Character1: { x: 239.782, y: 521.73, w: 308, h: 883 },
  scene3Character2: { x: 458.235, y: 618.824, w: 122, h: 438.21 },
  scene3Character3: { x: 622.234, y: 514.893, w: 201, h: 935 },
    scene4Character1: { x: 357.741, y: 554.748, w: 720, h: 285 },
  scene4Character2: { x: 359.932, y: 211.466, w: 720, h: 319 },
    scene5Character1: { x: 165.217, y: 577.101, w: 281.57, h: 960 },
  scene5Character2: { x: 617.392, y: 542.318, w: 203.72, h: 935 },
    scene6Character1: { x: 340.58, y: 185.507, w: 539, h: 319 },
  scene6Character2: { x: 360, y: 800.579, w: 720, h: 396 },
};

// How much padding a default (auto) box adds around the character's art.
export const BOX_PADDING = 16;

// The accessors below read through `tables()` rather than the module constants
// directly, so a running scene keeps seeing the latest saved numbers, and any
// live dev-editor overrides on top. See the LIVE TABLES + DEV HOT-SWAP note at
// the bottom of this file.

// Look up a character's transform, falling back to the centred default so a
// character missing from the table above is visible (dead centre) rather than
// invisible. Any live dev override for this key is merged on top.
export function partTransform(textureKeyName) {
  const t = tables();
  const entry = t.CHARACTER_POSITIONS[textureKeyName] || t.DEFAULT_PART;
  const patch = devOverrides()[textureKeyName];
  const merged = patch ? { ...entry, ...patch } : entry;
  return { flipX: false, z: 0, ...merged };
}

// The resolved cover-fit config for a scene's background: the global defaults
// with that scene's override (if any) merged on top.
export function backgroundFit(scene) {
  const t = tables();
  const base = t.BACKGROUND_FIT;
  const over = t.BACKGROUND_FIT_BY_SCENE?.[scene];
  return over ? { ...base, ...over } : { ...base };
}

// A character's drop box override, or null when it has none. The scene derives a
// default box from the character's art when this is null, so boxes exist for
// every character whether or not one is listed above.
export function boxOverride(textureKeyName) {
  const t = tables();
  const entry = t.CHARACTER_BOXES?.[textureKeyName] || null;
  const patch = boxDevOverrides()[textureKeyName];
  const merged = patch ? { ...(entry || {}), ...patch } : entry;
  return merged || null;
}

// The padding applied to a character's auto (default) box.
export function boxPadding() {
  return tables().BOX_PADDING ?? 16;
}

// ---------------------------------------------------------------------------
// LIVE TABLES + DEV HOT-SWAP
// ---------------------------------------------------------------------------
// When you save an edit, Vite replaces this whole module, but a Phaser scene
// that is already running still holds the OLD module's copies of the accessors
// above — so reading the module constants directly would keep showing the
// previous numbers, which is why tuning used to mean a manual page refresh for
// every tweak.
//
// Instead the tables are published on globalThis. A replaced module immediately
// overwrites that global with the new numbers, and the (old) running scene's
// accessors pick them up on their next call via tables(). The HMR block then
// merely nudges the scene to re-lay itself out.
function tables() {
  if (typeof globalThis !== 'undefined' && globalThis.__G12_TUNING__) {
    return globalThis.__G12_TUNING__;
  }
  return LIVE_TABLES;
}

// Live dev-editor overrides, set by devEditor.js while tuning. Empty in the
// shipped game, so partTransform() is a plain table read.
function devOverrides() {
  if (typeof globalThis !== 'undefined' && globalThis.__G12_OVERRIDES__) {
    return globalThis.__G12_OVERRIDES__;
  }
  return EMPTY_OVERRIDES;
}
const EMPTY_OVERRIDES = {};

// Box overrides live in their own global so a character drag (x/y/scale) never
// clobbers a box edit and vice-versa.
function boxDevOverrides() {
  if (typeof globalThis !== 'undefined' && globalThis.__G12_BOX_OVERRIDES__) {
    return globalThis.__G12_BOX_OVERRIDES__;
  }
  return EMPTY_OVERRIDES;
}

const LIVE_TABLES = {
  BACKGROUND_FIT,
  BACKGROUND_FIT_BY_SCENE,
  CHARACTER_POSITIONS,
  CHARACTER_BOXES,
  BOX_PADDING,
  DEFAULT_BOX,
  DEFAULT_PART,
};

// Publish on load so a running scene can resolve the tables even before any
// edit happens.
if (typeof globalThis !== 'undefined') {
  globalThis.__G12_TUNING__ = LIVE_TABLES;
}

// Dev-only: when this file is saved, tell the live game to re-lay out so the
// change is visible instantly (instead of needing a refresh). accept() makes
// Vite treat this as a self-accepting update rather than reloading the page.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    const game = globalThis.__G12_GAME__;
    if (game) game.events.emit('g12:tuning');
  });
}
