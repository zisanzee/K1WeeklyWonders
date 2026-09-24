// portraits.js
// Game 11 — pure portrait logic (Phaser-free so it is unit-testable).
//
// A "portrait" is one assembled character/object. It is built from a set of
// independent PNGs ("parts"). This module owns only the *structural* facts:
//
//   - the page order (which portrait shows on page 1, 2, ...)
//   - the layer order (which part draws on top of which)
//   - how a (portrait, variant, part) triple maps to a texture key
//
// Where each part actually sits, how big it is and how it is rotated lives in
// portraitPositions.js. Splitting it out means the tuning file stays a plain
// table of numbers you can edit without touching any logic.

import { IMAGES, parseTextureKey } from '@/games/game-11/assets';

// The portraits, in round/page order: boat, butterfly, beetle, frog, rocket,
// house, plane, kite, sun, flower. This is the single source of the round
// sequence — the level script and the page labels both derive from it.
//   1 boat · 2 butterfly · 3 flower · 4 sun · 5 frog · 6 kite · 7 rocket ·
//   8 plane · 9 house · 10 beetle
export const PORTRAIT_ORDER = [1, 2, 10, 5, 7, 9, 8, 6, 4, 3];

// Human-readable names, keyed by portrait index. Used by the game's heading and
// instruction line. Cosmetic only.
export const PORTRAIT_NAMES = {
  1: 'Boat',
  2: 'Butterfly',
  3: 'Flower',
  4: 'Sun',
  5: 'Frog',
  6: 'Kite',
  7: 'Rocket',
  8: 'Plane',
  9: 'House',
  10: 'Beetle',
};

export function portraitName(portrait) {
  return PORTRAIT_NAMES[portrait] || `Portrait ${portrait}`;
}

// Which part key draws on which layer. Lower = further back. These are the
// relative part *indices* inside a portrait (1, 2, 3, 4 — the third character
// of a texture key), NOT the portrait index.
//
// 1 = base, 2 = mid overlay, 3 = front overlay, 4 = trail / extra frame (only
// boat and rocket use it today). Re-order this array to change what sits on top
// of what for every portrait at once.
//
// For a per-part exception (e.g. an arm that must draw over the head), set that
// part's own `z` in portraitPositions.js instead — a higher `z` wins without
// touching the global order.
export const LAYER_RECIPE = [1, 2, 3, 4];

// The distinctive hex colour treated as transparent in the portrait PNGs.
// Cloudinary's remove-background output occasionally leaves a faint fringe;
// scenes can key this out if a halo shows. Exported here so the value lives
// next to the portraits it applies to rather than being buried in the scene.
export const PORTRAIT_CHROMA_KEY = 0xffffff;

// A texture key for a (portrait, variant, part) triple. Portraits 1-8 use the
// compact `p<portrait><variant><part>` form (p213 = portrait 2, variant 1,
// part 3); portrait 10 needs two digits, which that form cannot express without
// colliding (`p101` would read as portrait 1), so 9 and up use the delimited
// `p<portrait>v<variant>p<part>` form (p10v1p2). This must match the keys in
// assets.js exactly.
export function textureKey(portrait, variant, part) {
  return portrait > 8 ? `p${portrait}v${variant}p${part}` : `p${portrait}${variant}${part}`;
}

// The page label shown under each portrait (e.g. page 1 -> "Portrait 1").
export function portraitLabel(pageNumber) {
  return `Portrait ${pageNumber}`;
}

// Portrait index for a 1-based page number, wrapping around. Page 1 -> the
// first entry in PORTRAIT_ORDER, and past the end it loops back to the start.
export function portraitForPage(pageNumber) {
  const n = PORTRAIT_ORDER.length;
  const i = ((pageNumber - 1) % n + n) % n;
  return PORTRAIT_ORDER[i];
}

// Variants actually present for a portrait, ascending (e.g. [1, 2, 3] for most,
// [1, 2] for boat/rocket). Derived from which texture keys exist in IMAGES so a
// portrait that gains/loses a frame needs no edit here.
export function variantsForPortrait(portrait) {
  const variants = new Set();
  for (const key of Object.keys(IMAGES)) {
    const parsed = parseTextureKey(key);
    if (parsed && parsed.portrait === portrait) variants.add(parsed.variant);
  }
  return [...variants].sort((a, b) => a - b);
}

// The parts present for one portrait, sorted into LAYER_RECIPE order so callers
// can add them back-to-front without re-sorting. Returns texture keys.
export function partsForPortrait(portrait) {
  const parts = [];
  for (const part of LAYER_RECIPE) {
    for (const variant of variantsForPortrait(portrait)) {
      const key = textureKey(portrait, variant, part);
      if (IMAGES[key]) parts.push(key);
    }
  }
  return parts;
}

// Orders texture keys back-to-front by each part's `z` layer (see
// portraitPositions.js). `zOf` is passed in so this module stays Phaser-free and
// avoids importing the tuning tables. The sort is stable, so parts sharing a `z`
// keep the incoming LAYER_RECIPE order.
//
// This is the ONLY stacking either copy uses: the original and its mirrored
// duplicate are both built from these same keys with the same `z` values, so the
// mirror always follows the original's layering. Flip and rotation cannot change
// it, because order is derived from `z` alone — never from position or flip.
export function orderPartsByZ(keys, zOf) {
  return [...keys].sort((a, b) => zOf(a) - zOf(b));
}

// Total number of pages the game can present (one page per portrait).
export const PORTRAIT_COUNT = PORTRAIT_ORDER.length;
