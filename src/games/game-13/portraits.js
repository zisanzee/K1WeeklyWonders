// portraits.js
// Game 13 — pure structural helpers (Phaser-free so they stay unit-testable).
//
// BOILERPLATE ONLY. This module owns the page order and the layer order of the
// assembled portraits. Game 13's mechanics are not specified yet,
// so the lists ship empty and only the generic, already-shaped pieces (ordering
// by a `z` callback) are provided — the round builders will use these once the
// gameplay brief lands.

// The rounds in play order. Empty until the gameplay brief defines them; every
// other module derives its round count/script from this single list.
export const ROUND_ORDER = [];

// Which part layer draws on which layer. Lower = further back. Kept from the
// shared bonus-game shape so a portrait-style round can reuse it unchanged.
export const LAYER_RECIPE = [1, 2, 3, 4];

// Human-readable name for a round index. Cosmetic only.
export function roundName(index) {
  return `Round ${index}`;
}

// Orders texture keys back-to-front by each part's `z` layer. `zOf` is passed in
// so this module stays Phaser-free and avoids importing the tuning tables. The
// sort is stable, so parts sharing a `z` keep the incoming order.
export function orderPartsByZ(keys, zOf) {
  return [...keys].sort((a, b) => zOf(a) - zOf(b));
}

// Total number of rounds the game presents (one per entry in ROUND_ORDER).
export const ROUND_COUNT = ROUND_ORDER.length;
