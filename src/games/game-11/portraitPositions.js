// portraitPositions.js
// Game 11 — THE PORTRAIT TUNING FILE.
//
// This is the one file you edit to build the portraits. Every part of every
// portrait is listed below with its own { x, y, scale, rotation }. Change the
// numbers, save, and Phaser hot-reloads the scene — no logic changes needed.
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
//   (360, 540) is the exact centre of the screen — a good home for a base part.
//
// `rotation` is in DEGREES, clockwise. `scale` is a multiplier (1 = original
// PNG size, 2 = twice as big). `z` is the layer order: a higher `z` draws on
// top of a lower one, so you can override the default back-to-front part order
// (see LAYER_RECIPE in portraits.js) on a per-part basis. Equal `z` values fall
// back to the part's natural layer order.
//
// ---------------------------------------------------------------------------
// PART KEYS  —  p<portrait><variant><part>
// ---------------------------------------------------------------------------
//   key[1] portrait  which character/object (1-8)
//   key[2] variant   which frame of that portrait (1-4)
//   key[3] part      which layer           (1 = back ... 4 = front)
//
// e.g. `p213` = the 2nd portrait, 1st variant, 3rd part.
//
// Layers are drawn back-to-front, so part 4 paints on top of part 3, etc.
// Re-order LAYER_RECIPE in portraits.js to change that globally.
//
// ---------------------------------------------------------------------------
// EVERY VALUE BELOW IS A STARTING GUESS — the parts ship as separate images
// with no baked-in offsets, so tune them by eye. A part left out of this table
// still loads but will not draw, so keep it in sync with assets.js.
// ---------------------------------------------------------------------------

// Reusable starting transform for a part you haven't placed yet — centre of the
// screen, full size, upright.
export const DEFAULT_PART = { x: 360, y: 540, scale: 1, rotation: 0, z: 0 };

// ---------------------------------------------------------------------------
// OVERALL PORTRAIT SCALE
// ---------------------------------------------------------------------------
// One multiplier per portrait that resizes the WHOLE assembled portrait at
// once, without touching any of the per-part numbers above.
//
// This works by scaling the portrait around a PIVOT point: the scene places
// each part relative to the pivot and then scales the container, so the whole
// picture grows/shrinks in place. The parts' relative positions, overlaps and
// layer order are all preserved — only the size changes. So if a portrait is
// sitting too big or too small, change the one number here and nothing else.
//
//   0.5 = half size     1 = original     1.5 = 50% bigger
//
// The pivot is the point that stays fixed while scaling. It defaults to the
// screen centre (see DEFAULT_PIVOT). Only add a PORTRAIT_PIVOT override if a
// portrait's art is built around some other point (e.g. a fish sitting on the
// seabed) and you want it to scale from there instead of the middle.
export const PORTRAIT_SCALE = {
  1: 1, // boat
  2: 1.8, // butterfly
  3: 2, // flower
  4: 3, // sun
  5: 1.5, // frog
  6: 2, // kite
  7: 1.2, // rocket
  8: 1.6, // plane
};

// ---------------------------------------------------------------------------
// OVERALL PORTRAIT POSITION
// ---------------------------------------------------------------------------
// Where the whole assembled portrait sits on the canvas, and how far it is spun.
// One { x, y, rotation } per portrait, in the same 720x1080 internal pixels as
// everything else — adjust it to slide a finished portrait up/down or left/right
// and to rotate it, WITHOUT re-tuning any part or its scale.
//
//   x, y      the position of the portrait's PIVOT (see below)
//   rotation  whole-portrait spin, in DEGREES clockwise (0, 90, -45, ...)
//
// The rotation turns the entire picture about the pivot, so the parts keep their
// relative layout. Default is the screen centre, upright, so leaving a portrait
// out of the table keeps it centred and unrotated.
export const PORTRAIT_POSITION = {
  1: { x: 363, y: 435, rotation: 0 }, // boat
  2: { x: 360, y: 457, rotation: 0 }, // butterfly
  3: { x: 415, y: 400, rotation: 10 }, // flower
  4: { x: 295, y: 750, rotation: 12 }, // sun
  5: { x: 295, y: 480, rotation: 0 }, // frog
  6: { x: 402, y: 727, rotation: -12 }, // kite
  7: { x: 323, y: 540, rotation: 0 }, // rocket
  8: { x: 360, y: 550, rotation: -11 }, // plane
};

// The fixed point each portrait scales around, in design space. Omit a portrait
// to use the screen-centre default. Only change this if a portrait should grow
// from somewhere other than the middle — moving the whole portrait is what
// PORTRAIT_POSITION above is for.
export const DEFAULT_PIVOT = { x: 360, y: 540 };
export const PORTRAIT_PIVOT = {
  // 5: { x: 360, y: 760 }, // e.g. scale the frog from its feet, not its middle
};

// ---------------------------------------------------------------------------
// MIRRORED DUPLICATE
// ---------------------------------------------------------------------------
// Every page draws a second, flipped copy of the whole portrait, so the two
// face each other. The copy shares the original's scale and its internal part
// layout 1:1 — only the values below are yours to tune:
//
//   x, y      where the copy sits (same 720x1080 internal pixels)
//   rotation  extra spin, in DEGREES clockwise, applied to the copy
//   flip      which way the copy is mirrored:
//               'horizontal' = left-right flip (mirror across a vertical line)
//               'vertical'   = top-bottom flip (turned upside down)
//   enabled   set false to hide the copy without losing your tuning
//
// Because scale and relative positioning track the original automatically, if
// you resize or re-tune the original the copy follows — you only nudge the copy
// around and choose its flip.
export const PORTRAIT_MIRROR = {
  1: { enabled: true, x: 363, y: 645, rotation: 0, flip: 'vertical' }, // boat — upside down
  2: { enabled: true, x: 360, y: 624, rotation: 0, flip: 'vertical' }, // butterfly — upside down
  3: { enabled: true, x: 205, y: 555, rotation: -82, flip: 'horizontal' }, // flower
  4: { enabled: true, x: 565, y: 567, rotation: -80, flip: 'horizontal' }, // sun
  5: { enabled: true, x: 425, y: 480, rotation: 0, flip: 'horizontal' }, // frog
  6: { enabled: true, x: 175, y: 580, rotation: 78, flip: 'horizontal' }, // kite
  7: { enabled: true, x: 395, y: 540, rotation: 0, flip: 'horizontal' }, // rocket
  8: { enabled: true, x: 350, y: 545, rotation: 79, flip: 'horizontal' }, // plane
};

// Each entry's `z` is its drawing layer — a higher `z` paints on top of a lower
// one, so raise a part to pull it forward (e.g. a hand over a body) without
// moving it. Leave them in their natural 1,2,3,4 order for the default stacking.
export const PORTRAIT_POSITIONS = {
  // =========================================================================
  // 1 — BOAT (4 frames)
  // =========================================================================
    p111: { x: 369, y: 617.5, scale: 0.7, rotation: 0, z: 1 },
  p112: { x: 379, y: 501, scale: 0.42, rotation: 0, z: 2 },
  p113: { x: 417, y: 529, scale: 0.34, rotation: 0, z: 3 },
  p121: { x: 298, y: 529, scale: 0.34, rotation: 0, z: 4 },
  // =========================================================================
  // 2 — BUTTERFLY (4 frames)
  // =========================================================================
  p211: { x: 314, y: 550, scale: 0.18, rotation: 0, z: 1 },
  p212: { x: 408, y: 550, scale: 0.18, rotation: 0, z: 2 },
  p213: { x: 360, y: 540, scale: 0.18, rotation: 0, z: 3 },
  p221: { x: 360, y: 508, scale: 0.16, rotation: 0, z: 4 },

  // =========================================================================
  // 3 — FLOWER (4 frames)
  // =========================================================================
   p311: { x: 297, y: 601, scale: 0.2, rotation: 0, z: 1 },
  p312: { x: 312, y: 650, scale: 0.2, rotation: 0, z: 2 },
  p313: { x: 360, y: 661, scale: 0.2, rotation: 0, z: 3 },
  p321: { x: 341, y: 618, scale: 0.14, rotation: 0, z: 4 },

  // =========================================================================
  // 4 — SUN (3 frames)
  // =========================================================================
   p411: { x: 359, y: 471, scale: 0.14, rotation: 0, z: 1 },
  p412: { x: 362, y: 502, scale: 0.1, rotation: 0, z: 2 },
  p413: { x: 328, y: 467, scale: 0.1, rotation: 0, z: 3 },
  
  // =========================================================================
  // 5 — FROG (3 frames)
  // =========================================================================
  p511: { x: 381, y: 501, scale: 0.2, rotation: 0, z: 1 },
  p512: { x: 385, y: 572, scale: 0.24, rotation: 0, z: 2 },
  p513: { x: 357, y: 598, scale: 0.24, rotation: 0, z: 3 },

  // =========================================================================
  // 6 — KITE (3 frames)
  // =========================================================================
  p611: { x: 350, y: 438, scale: 0.19, rotation: 0, z: 1 },
  p612: { x: 369, y: 416, scale: 0.12, rotation: 0, z: 2 },
  p613: { x: 320, y: 391, scale: 0.13, rotation: 47, z: 2 },

  // =========================================================================
  // 7 — ROCKET (4 frames)
  // =========================================================================
  p711: { x: 362, y: 538, scale: 0.41, rotation: 0, z: 1 },
  p712: { x: 368, y: 415, scale: 0.32, rotation: 0, z: 2 },
  p713: { x: 317, y: 590, scale: 0.32, rotation: 0, z: 3 },
  p721: { x: 368, y: 686, scale: 0.23, rotation: 0, z: 4 },

  // =========================================================================
  // 8 — PLANE (3 frames)
  // =========================================================================
  p811: { x: 351, y: 536, scale: 0.35, rotation: 45.5, z: 1 },
  p812: { x: 325, y: 497, scale: 0.24, rotation: 0, z: 2 },
  p813: { x: 271, y: 584, scale: 0.22, rotation: 0, z: 3 },
};

// The accessors below read through `tables()` rather than the module constants
// directly, so a running scene keeps seeing the latest saved numbers. See the
// LIVE TABLES + DEV HOT-SWAP note at the bottom of this file.

// Look up a part's transform, falling back to the centred default so a part
// missing from the table above is visible (dead centre) rather than invisible —
// much easier to notice and tune than a silent no-show. `z` defaults to 0 so an
// entry written before the layer field existed still resolves.
export function partTransform(textureKeyName) {
  const t = tables();
  const entry = t.PORTRAIT_POSITIONS[textureKeyName] || t.DEFAULT_PART;
  return { z: 0, ...entry };
}

// Overall scale for a portrait (1 if it has no entry). The scene applies this
// around the pivot below, so the whole picture resizes in place.
export function portraitScale(portrait) {
  return tables().PORTRAIT_SCALE[portrait] ?? 1;
}

// Where the whole portrait sits on the canvas (screen centre unless overridden).
export function portraitPosition(portrait) {
  const t = tables();
  return t.PORTRAIT_POSITION[portrait] || t.DEFAULT_PIVOT;
}

// The fixed point a portrait scales around (screen centre unless overridden).
export function portraitPivot(portrait) {
  const t = tables();
  return t.PORTRAIT_PIVOT[portrait] || t.DEFAULT_PIVOT;
}

// The mirrored copy's transform, or null when it is disabled/absent. Returns
// { x, y, rotation, flipX, flipY } so the scene never has to know how to read
// the 'horizontal'/'vertical' choice.
export function portraitMirror(portrait) {
  const entry = tables().PORTRAIT_MIRROR[portrait];
  if (!entry || entry.enabled === false) return null;
  const vertical = entry.flip === 'vertical';
  return {
    x: entry.x,
    y: entry.y,
    rotation: entry.rotation || 0,
    flipX: !vertical,
    flipY: vertical,
  };
}

// ---------------------------------------------------------------------------
// OPTION (TRAY) PIECE TRANSFORMS
// ---------------------------------------------------------------------------
// The pieces are laid out in a row along the bottom. Each piece's portrait
// transform comes from the duplicate (so it looks like it will once placed),
// and this table adds a PER-PIECE override for how it sits as an option.
//
//   key      the part key, e.g. 'p213'
//   scale    multiplied onto the row's shared scale (1 = leave as is)
//   x, y     an offset from the piece's automatic slot position, in px
//
// The defaults are x:0, y:0, scale:1 — i.e. no override — so an empty table
// lays every piece out automatically. Add only the pieces you want to nudge:
//
//   p311: { scale: 1.4, x: 0, y: -8 },
//
// The row's shared scale and the slot spacing are tuned by the TRAY_* constants
// in GameScene.js; this table is for the individual exceptions.
export const OPTION_TRANSFORM = {
  // p111: { scale: 1, x: 0, y: 0 },
};

export function optionTransform(partKey) {
  const entry = tables().OPTION_TRANSFORM[partKey] || {};
  return {
    scale: entry.scale ?? 1,
    x: entry.x ?? 0,
    y: entry.y ?? 0,
  };
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
  if (typeof globalThis !== 'undefined' && globalThis.__G11_TUNING__) {
    return globalThis.__G11_TUNING__;
  }
  return LIVE_TABLES;
}

const LIVE_TABLES = {
  PORTRAIT_SCALE,
  PORTRAIT_POSITION,
  PORTRAIT_PIVOT,
  PORTRAIT_MIRROR,
  PORTRAIT_POSITIONS,
  OPTION_TRANSFORM,
  DEFAULT_PART,
  DEFAULT_PIVOT,
};

// Publish on load so a running scene can resolve the tables even before any
// edit happens.
if (typeof globalThis !== 'undefined') {
  globalThis.__G11_TUNING__ = LIVE_TABLES;
}

// Dev-only: when this file is saved, tell the live game to re-lay out so the
// change is visible instantly (instead of needing a refresh). accept() makes
// Vite treat this as a self-accepting update rather than reloading the page.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    const game = globalThis.__G11_GAME__;
    if (game) game.events.emit('g11:tuning');
  });
}
