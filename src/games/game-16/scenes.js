// scenes.js
// THE scene registry for Game 16 — the single source of truth for the five
// mini-games that make up one run.
//
// WHY A REGISTRY AND NOT FIVE PHASER SCENES:
// A run is a SEQUENCE — 5 scenes × 3 rounds. The hub (GameScene.js) mounts one
// scene module at a time inside its own Phaser scene, so the run keeps one
// create(), one music instance, one mute button and one dev-nav registration.
// See plans/game-16-five-scenes.md for the full reasoning.
//
// This module is deliberately dependency-free and Phaser-free: the hub, the
// tuning file, the dev panel and the tests all read it, and none of them should
// drag Phaser in to do that.
//
// ADDING/CHANGING A SCENE: the `id` is IDENTITY (it keys the tuning block, the
// dev panel's group, and the run progress), so treat it as immutable once a
// scene has shipped. `title`/`short`/`hint` are for humans and are free to
// change. `rounds` is fixed at 3 for this game by design.

// Default round count for a scene. A scene may override it with its own `rounds`
// — scene 1 runs FOUR, because its last round is a two-shape round that needs its
// own clue ("4 corners"), and folding that into three would drop a clue.
export const ROUNDS_PER_SCENE = 3;

export const SCENES = [
  {
    id: 'shapes',
    // 1-based position, used by the HUD ("2 / 5").
    number: 1,
    title: 'Shapes',
    short: 'Shapes',
    // Shown as the prompt placeholder until the real speech lines exist.
    hint: 'Which one is a circle?',
    // The mechanics that will live here, recorded now so the scene file has a
    // spec to build against. Not read by any code.
    plan: 'A robot shows a shape PROPERTY; drag the matching shape(s) onto the belt.',
    // FOUR rounds: three single-shape clues, then a two-shape "4 corners" round.
    rounds: 4,
    // Dev-only accent, so the five placeholders are distinguishable at a glance
    // while there is no art. Also the colour of the dev frame.
    color: 0x38bdf8,
    // Whether this scene has been implemented for real yet.
    implemented: false,
  },
  {
    id: 'mirror',
    number: 2,
    title: 'Mirror',
    short: 'Mirror',
    hint: 'Match the mirrored half.',
    plan: 'Rebuild a symmetrical picture by dragging pieces to the mirrored spot.',
    rounds: ROUNDS_PER_SCENE,
    color: 0xa78bfa,
    implemented: false,
  },
  {
    id: 'positions',
    number: 3,
    title: 'Positions',
    short: 'Positions',
    hint: 'Where is the bird?',
    plan: 'Name a position word (top, middle, bottom) for a character in a scene.',
    rounds: ROUNDS_PER_SCENE,
    color: 0x34d399,
    implemented: false,
  },
  {
    id: 'left-right',
    number: 4,
    title: 'Left - Right',
    short: 'Left/Right',
    hint: 'Which one is on the left?',
    plan: 'Pick the character on the left or right of a landmark.',
    rounds: ROUNDS_PER_SCENE,
    color: 0xfbbf24,
    implemented: false,
  },
  {
    id: 'ordinal',
    number: 5,
    title: 'Ordinal (first - tenth)',
    short: 'Ordinal',
    hint: 'Which animal is on the third floor?',
    plan: 'Find the character on the given ordinal floor / position.',
    rounds: ROUNDS_PER_SCENE,
    color: 0xfb7185,
    implemented: false,
  },
];

// Total rounds in a full run. Derived, so changing ROUNDS_PER_SCENE or the
// number of scenes cannot leave a stale constant behind.
export const TOTAL_ROUNDS = SCENES.reduce((sum, scene) => sum + scene.rounds, 0);

// Lookup by id. Returns undefined for an unknown id — callers must handle it
// rather than getting a silent fallback to scene 1.
export function sceneById(id) {
  return SCENES.find((scene) => scene.id === id);
}

// Lookup by 0-based index, clamped into range. The hub indexes by number, and a
// clamp here means a corrupt saved index shows scene 1 rather than crashing.
export function sceneAt(index) {
  if (!Number.isInteger(index) || index < 0) return SCENES[0];
  if (index >= SCENES.length) return SCENES[SCENES.length - 1];
  return SCENES[index];
}

export const SCENE_COUNT = SCENES.length;
