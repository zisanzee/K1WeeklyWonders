// progress.js
// The run's position within 5 scenes × 3 rounds, as pure data + pure functions.
//
// Kept out of GameScene so it can be unit tested without Phaser. The scene/round
// handover is the one piece of game-16 logic that is genuinely easy to get wrong
// (off-by-one at the last round of the last scene, wrap-around in the middle,
// dev jumps that must NOT end the run), and all of those are invisible until
// someone plays to the very end.
//
// TWO PATHS, DELIBERATELY SEPARATE:
//   advance()    — the PRODUCTION path. Takes one completed round and steps to
//                  the next, ending the run after the final round.
//   jumpScene()  / jumpRound() — DEV paths for the tuning panel. They CLAMP
//                  instead of wrapping and never set `done`, so a developer
//                  cannot accidentally end the run while tuning.
//
// They are separate functions rather than one function with a flag because the
// behaviours are genuinely different, and a boolean here would be the kind of
// parameter that gets passed wrong exactly once and silently ships.
import { SCENES, TOTAL_ROUNDS } from '@/games/game-16/scenes';

// The start of a run: first scene, first round.
export function startRun() {
  return { scene: 0, round: 0, done: false };
}

// Step to the next round after finishing the current one.
//
// - more rounds in this scene  → next round, same scene
// - last round, more scenes    → next scene, round 0
// - last round of last scene   → done
export function advance(position) {
  const { scene, round } = position;
  const current = SCENES[scene];
  if (!current) return { ...position, done: true };

  if (round + 1 < current.rounds) {
    return { scene, round: round + 1, done: false };
  }

  const nextScene = scene + 1;
  if (nextScene < SCENES.length) {
    return { scene: nextScene, round: 0, done: false };
  }

  // Past the last round of the last scene: the round just played was the final
  // one. Keep the position AT it, so a "run complete" screen can still say
  // "scene 5, round 3" rather than pointing one past the end.
  return { scene, round, done: true };
}

// DEV: step whole scenes, clamped at both ends. Round resets to 0 so the jump
// lands on something playable. Never marks the run done.
export function jumpScene(position, delta) {
  const target = clamp(position.scene + delta, 0, SCENES.length - 1);
  return { scene: target, round: 0, done: false };
}

// DEV: step rounds, rolling into the next/previous scene at the boundaries so
// ◀ ▶ can walk the whole run. Clamped at the very first and very last round and
// never marks the run done.
export function jumpRound(position, delta) {
  let scene = position.scene;
  let round = position.round + delta;

  // Walk backwards through scenes when the round goes negative.
  while (round < 0) {
    const prev = scene - 1;
    if (prev < 0) return { scene: 0, round: 0, done: false };
    scene = prev;
    round += SCENES[scene].rounds;
  }

  // …and forwards when it overshoots the current scene's round count.
  while (round >= SCENES[scene].rounds) {
    const next = scene + 1;
    if (next >= SCENES.length) {
      const last = SCENES.length - 1;
      return { scene: last, round: SCENES[last].rounds - 1, done: false };
    }
    round -= SCENES[scene].rounds;
    scene = next;
  }

  return { scene, round, done: false };
}

// 1-based counters for display, e.g. "scene 2 / 5 · round 3 / 3".
export function describe(position) {
  const scene = SCENES[position.scene] || SCENES[0];
  return `scene ${scene.number} / ${SCENES.length} · round ${position.round + 1} / ${scene.rounds}`;
}

// Short label for the dev panel's nav bar: "2/5 mirror · round 2/3".
export function navLabel(position) {
  const scene = SCENES[position.scene] || SCENES[0];
  return `${scene.number}/${SCENES.length} ${scene.short.toLowerCase()} · round ${
    position.round + 1
  }/${scene.rounds}`;
}

// How far through the whole run this position is, 0..1. Counts the rounds
// COMPLETED, so the first round of the run is 0 and a finished run is 1.
export function runProgress(position) {
  let completed = 0;
  for (let i = 0; i < position.scene; i += 1) completed += SCENES[i].rounds;
  completed += position.round;
  return TOTAL_ROUNDS > 0 ? completed / TOTAL_ROUNDS : 0;
}

export { TOTAL_ROUNDS };

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
