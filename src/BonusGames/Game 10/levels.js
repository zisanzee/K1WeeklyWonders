// levels.js
// Round script for Game 10 ("Feed the Shapes").
//
// The 10 rounds are FIXED CURRICULUM, not generated: Level 1 (rounds 1-4)
// names the shape, Level 2 (rounds 5-10) describes a geometric property. The
// order is deliberate — Level 2 interleaves shapes so the child has to listen
// to the property instead of pattern-matching on repetition — so nothing here
// is shuffled or randomized. Keep this file Phaser-free.

export const TOTAL_ROUNDS = 10;
export const FEEDS_PER_ROUND = 3;

// Single source of truth for "what is a triangle" (image key + display label).
// GameScene never hardcodes an image-key string; it looks shapes up here.
export const SHAPES = {
  circle: { imageKey: 'cookie-circle', label: 'circle' },
  square: { imageKey: 'cracker-square', label: 'square' },
  triangle: { imageKey: 'pizza-triangle', label: 'triangle' },
  rectangle: { imageKey: 'juicebox-rectangle', label: 'rectangle' },
};

export const SHAPE_IDS = Object.keys(SHAPES);

// Fixed order — index 0 is round 1. `voiceKey: null` means "no clip for this
// round" (the caller must no-op rather than substitute a different clip).
export const ROUND_SCRIPT = [
  // --- Level 1 — called by shape name -------------------------------------
  { level: 1, shape: 'triangle', prompt: 'Feed me triangles!', voiceKey: 'VA-I want triangle' },
  { level: 1, shape: 'square', prompt: 'Feed me squares!', voiceKey: 'VA-I want square' },
  { level: 1, shape: 'rectangle', prompt: 'Feed me rectangles!', voiceKey: 'VA-I want rectangle' },
  { level: 1, shape: 'circle', prompt: 'Feed me circles!', voiceKey: 'VA-I want circle' },

  // --- Level 2 — called by geometric property -----------------------------
  { level: 2, shape: 'triangle', prompt: 'I want a shape with 3 sides!', voiceKey: 'VA-I want shape with 3 sides' },
  { level: 2, shape: 'circle', prompt: 'I want a shape that is round with no corners!', voiceKey: 'VA-I want shape that is round with no corners' },
  { level: 2, shape: 'square', prompt: 'I want a shape with 4 equal sides!', voiceKey: 'VA-I want shape that has 4 equal sides' },
  { level: 2, shape: 'rectangle', prompt: 'I want a shape with 2 long sides and 2 short sides!', voiceKey: 'VA-I want shape that has 2 long sides and 2 short sides' },
  { level: 2, shape: 'triangle', prompt: 'I want a shape with 3 corners!', voiceKey: 'VA-I want shape that has 3 corners' },
  { level: 2, shape: 'square', prompt: 'I want a shape with 4 corners and 4 equal sides!', voiceKey: 'VA-I want shape that has 4 corners and 4 equal sides' },
];
