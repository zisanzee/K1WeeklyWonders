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

// Default round count for a scene. A scene overrides it with its own `rounds`
// when its shape differs: scene 1 runs FOUR (its last round is a two-shape round
// needing its own clue), scene 3 runs FOUR (one portrait per relation pair), and
// scene 4 runs FIVE (one question about one floor per round).
// Scene 2 uses this default.
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
    hint: 'Drag each piece to its spot.',
    // Implemented. The three rounds share one mechanic and differ only in the
    // AXIS: vertical, horizontal, then diagonal. Which parts belong to which
    // round, and where they sit, lives in mirrorRounds.js — not here.
    plan: 'Build a portrait on one side of a mirror line; each part reflects onto the other side as it is placed.',
    rounds: ROUNDS_PER_SCENE,
    color: 0xa78bfa,
    implemented: true,
  },
  {
    // FORMERLY TWO SCENES. "Positions" (top/middle/bottom) and "Left - Right"
    // were separate mini-games, but they are one mechanic: a prompt names a
    // RELATIVE POSITION and the child drags an object to the spot that answers
    // it. Merged into this one scene with FOUR portraits, each asking two
    // opposite relations (above/below, front/behind, inside/outside,
    // left/right) — which is also how the curriculum wants the pairs taught.
    //
    // `id` stays 'positions': it is identity and keys the tuning block, the dev
    // panel group and the run's progress, so it must not change now.
    id: 'positions',
    number: 3,
    title: 'Positions',
    short: 'Positions',
    hint: 'Where does it go?',
    plan: 'A prompt names a relative position (on top of, in front of, inside, to the left of); drag the object to the matching spot in the picture.',
    // FOUR portraits (each word appears twice, so each has two prompts).
    rounds: 4,
    // Pastel green: distinct from scene 2's violet and scene 1's sky blue.
    color: 0x34d399,
    implemented: false,
  },
  {
    // THE ORDINAL SCENE, with its real picture. It replaces the `ordinal`
    // placeholder one-for-one: same idea (ten floors, one animal per floor), same
    // position in the run, but now built from the wall + room artwork and
    // scrollable so all ten floors can be reached.
    //
    // The wall is tiled from three pieces — a top cap, a repeating middle and a
    // bottom cap — so it grows to whatever height the ten rooms need instead of
    // being stretched.
    id: 'building',
    number: 4,
    title: 'The Building',
    short: 'Building',
    hint: 'Which animal is on the third floor?',
    plan: 'Ten rooms stacked in a tiled building; swipe to scroll the wall and find the animal on a given floor.',
    // FIVE questions, not the default three: each round asks about ONE floor,
    // and three floors out of ten is too thin a sample of the building. The
    // floors are distinct per run (see buildingRounds.js).
    rounds: 5,
    color: 0xfb7185,
    implemented: true,
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

