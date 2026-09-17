// levels.js
// Round script for Game 10 ("Feed Me Shapes").
//
// The 10 rounds are FIXED CURRICULUM, not generated: Level 1 (rounds 1-4)
// names the shape, Level 2 (rounds 5-10) describes a geometric property. The
// order is deliberate — Level 2 interleaves shapes so the child has to listen
// to the property instead of pattern-matching on repetition — so nothing here
// is shuffled or randomized. Keep this file Phaser-free.

export const TOTAL_ROUNDS = 10;
// Two feeds per round (was 3). Everything else — round completion and the
// TOTAL_FEEDS progress denominator in GameScene — derives from this constant.
export const FEEDS_PER_ROUND = 2;

// Single source of truth for "what is a triangle" — its display label and the
// foods that ARE that shape. GameScene never hardcodes an image-key string; it
// looks both up here.
//
// Two foods per shape, and the choice between them is cosmetic only. The game
// logic is entirely shape-level: the monster asks for "a shape with 3 sides"
// and any triangle counts. So which food appears is variety, not difficulty —
// adding a third food for a shape needs no other change.
export const SHAPES = {
  circle: {
    label: 'circle',
    foods: ['cookie-circle', 'donut-circle'],
  },
  square: {
    label: 'square',
    foods: ['cracker-square', 'waffle-square'],
  },
  triangle: {
    label: 'triangle',
    foods: ['pizza-triangle', 'sandwich-triangle'],
  },
  rectangle: {
    label: 'rectangle',
    foods: ['juicebox-rectangle', 'chocolate-rectangle'],
  },
};

export const SHAPE_IDS = Object.keys(SHAPES);

// Every food key, flattened. Used to measure each texture once at scene start.
export const FOOD_KEYS = SHAPE_IDS.flatMap((id) => SHAPES[id].foods);

// Fixed order — index 0 is round 1. `voiceKey: null` means "no clip for this
// round" (the caller must no-op rather than substitute a different clip).
export const ROUND_SCRIPT = [
  // --- Level 1 — called by shape name -------------------------------------
  { level: 1, shape: 'triangle', prompt: 'Feed me triangles!', voiceKey: 'VA-I want triangle' },
  { level: 1, shape: 'square', prompt: 'Feed me squares!', voiceKey: 'VA-I want square' },
  { level: 1, shape: 'rectangle', prompt: 'Feed me rectangles!', voiceKey: 'VA-I want rectangle' },
  { level: 1, shape: 'circle', prompt: 'Feed me circles!', voiceKey: 'VA-I want circle' },

  // --- Level 2 — called by geometric property -----------------------------
  { level: 2, shape: 'triangle', prompt: 'I want shapes with 3 sides!', voiceKey: 'VA-I want shape with 3 sides', hintImage: 'https://res.cloudinary.com/hijmipga/image/upload/v1789636147/hint-3-sides_jw3zem.png' },
  { level: 2, shape: 'circle', prompt: 'I want shapes that are round with no corners!', voiceKey: 'VA-I want shape that is round with no corners', hintImage: 'https://res.cloudinary.com/hijmipga/image/upload/v1789636147/hint-round-no-corners_n9upfd.png' },
  { level: 2, shape: 'square', prompt: 'I want shapes with 4 equal sides!', voiceKey: 'VA-I want shape that has 4 equal sides', hintImage: 'https://res.cloudinary.com/hijmipga/image/upload/v1789636146/hint-4-equal-sides_floncs.png' },
  { level: 2, shape: 'rectangle', prompt: 'I want shapes with 2 long sides and 2 short sides!', voiceKey: 'VA-I want shape that has 2 long sides and 2 short sides', hintImage: 'https://res.cloudinary.com/hijmipga/image/upload/v1789636146/hint-2-long-sides-2-short-sides_lda127.png' },
  { level: 2, shape: 'triangle', prompt: 'I want shapes with 3 corners!', voiceKey: 'VA-I want shape that has 3 corners', hintImage: 'https://res.cloudinary.com/hijmipga/image/upload/v1789636148/hint-3-corners_rlvm0q.png' },
  { level: 2, shape: 'square', prompt: 'I want shapes with 4 corners and 4 equal sides!', voiceKey: 'VA-I want shape that has 4 corners and 4 equal sides', hintImage: 'https://res.cloudinary.com/hijmipga/image/upload/v1789636147/hint-4-corners-4-equal-sides_eucpjz.png' },
];
