// scenes.js
// Position Mission! — pure structural facts about the scenes (Phaser-free so it is
// unit-testable). This module owns only:
//
//   - the scene order (which scene shows on scene 1, 2, ...)
//   - the human-readable name of each scene
//   - which characters appear in each scene (derived from assets.js keys)
//
// It deliberately owns NO artwork URLs (that is assets.js) and NO positions /
// scales / rotations (that is sceneTuning.js). Splitting the three apart keeps
// the tuning file a plain table of numbers you can edit without touching logic.

import { sceneCharacterKeys, presentSceneIds } from '@/games/game-12/assets';

// The scenes, in show order. Each entry is the numeric scene id used by the
// texture keys (`scene<id>Background`). This is the single source of the scene
// sequence — levels.js and the game's scene labels both derive from it.
export const SCENE_ORDER = [1, 2, 3, 4, 5, 6];

// Human-readable names, keyed by scene id. Cosmetic only (heading text).
export const SCENE_NAMES = {
  1: 'Scene 1',
  2: 'Scene 2',
  3: 'Scene 3',
  4: 'Scene 4',
  5: 'Scene 5',
  6: 'Scene 6',
};

export function sceneName(scene) {
  return SCENE_NAMES[scene] || `Scene ${scene}`;
}

// Every scene shows its prompt in the standard top position now (scene 6 used to
// opt into a bottom/side layout; that was removed so all scenes match). Kept as
// a function so a scene could still opt in later without touching the scene code.
export const PROMPT_AT_BOTTOM = {};

export function isPromptAtBottom(scene) {
  return !!PROMPT_AT_BOTTOM[scene];
}

// The character texture keys present in a scene, in numeric order. Thin wrapper
// over assets.js so callers depend on this module for structure only.
export function charactersForScene(scene) {
  return sceneCharacterKeys(scene);
}

// Characters that are ALWAYS part of the scene (drawn permanently, never an
// option, never movable): the person the round is "in front of / behind"
// relative to. Keyed by scene id; a scene absent here has no permanent cast.
export const PERMANENT_BY_SCENE = {
  1: ['scene1Character3'], // the man
  3: ['scene3Character2'], // the woman
};

export function permanentCharactersForScene(scene) {
  return PERMANENT_BY_SCENE[scene] || [];
}

// The characters that start off-scene and are placed by dragging — every
// scene character except the permanent ones above. This is the set the option
// tray and the wrong-drop detection are built from.
export function movableCharactersForScene(scene) {
  const permanent = new Set(permanentCharactersForScene(scene));
  return charactersForScene(scene).filter((key) => !permanent.has(key));
}

// Scene ids that actually have artwork loaded, ascending. Prefer this over
// SCENE_ORDER when building, so a scene whose art has not landed yet is simply
// skipped rather than drawing an empty frame.
export function availableScenes() {
  const present = new Set(presentSceneIds());
  return SCENE_ORDER.filter((id) => present.has(id));
}

// How many scenes the game can present (one per scene id).
export const SCENE_COUNT = SCENE_ORDER.length;

// Scene id for a 1-based page number, wrapping around. Page 1 -> the first
// entry in SCENE_ORDER, and past the end it loops back to the start.
export function sceneForPage(pageNumber) {
  const n = SCENE_ORDER.length;
  const i = ((pageNumber - 1) % n + n) % n;
  return SCENE_ORDER[i];
}
