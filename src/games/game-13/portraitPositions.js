// portraitPositions.js
// Game 13 — THE TUNING FILE.
//
// BOILERPLATE ONLY. This table holds the { x, y, scale, rotation, z } of every
// assembled portrait part, read by the scene through the accessors
// below so the numbers could be tuned by eye without touching any logic. Game
// 13's mechanics are not specified yet, so the tables ship empty and the
// accessors return safe centred defaults. When the gameplay brief arrives, fill
// PORTRAIT_POSITIONS (or rename these tables to match the new mechanic) and the
// scene keeps working through the accessors unchanged.
//
// Coordinate space, when you start filling this in: x/y are INTERNAL pixels on
// the 720x1080 canvas (see DEFAULT_BASE_RESOLUTION in phaser/config.js), x = 0
// is the left edge, y = 0 the top. (360, 540) is the screen centre.

// Reusable starting transform for a part you haven't placed yet — centre of the
// screen, full size, upright.
export const DEFAULT_PART = { x: 360, y: 540, scale: 1, rotation: 0, z: 0 };

// The fixed point a whole portrait scales around (screen centre unless a
// portrait overrides it below).
export const DEFAULT_PIVOT = { x: 360, y: 540 };

export const PORTRAIT_POSITIONS = {};
export const PORTRAIT_SCALE = {};
export const PORTRAIT_POSITION = {};
export const PORTRAIT_PIVOT = {};

// Look up a part's transform, falling back to the centred default so a part
// missing from the table above is visible (dead centre) rather than invisible —
// much easier to notice and tune than a silent no-show. `z` defaults to 0 so an
// entry written before the layer field existed still resolves.
export function partTransform(textureKeyName) {
  const entry = PORTRAIT_POSITIONS[textureKeyName] || DEFAULT_PART;
  return { z: 0, ...entry };
}

// Overall scale for a portrait (1 if it has no entry). The scene applies this
// around the pivot above, so the whole picture resizes in place.
export function portraitScale(portrait) {
  return PORTRAIT_SCALE[portrait] ?? 1;
}

// Where the whole portrait sits on the canvas (screen centre unless overridden).
export function portraitPosition(portrait) {
  return PORTRAIT_POSITION[portrait] || DEFAULT_PIVOT;
}

// The fixed point a portrait scales around (screen centre unless overridden).
export function portraitPivot(portrait) {
  return PORTRAIT_PIVOT[portrait] || DEFAULT_PIVOT;
}
