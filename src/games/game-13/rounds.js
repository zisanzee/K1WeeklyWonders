// rounds.js
// Game 13 — round curriculum + difficulty curve.
//
// Pure (Phaser-free) so the curve and the prompt/obstacle pairing can be unit
// tested. One entry per round: the round speaks a DIRECTION ("left"/"right") and
// the obstacle is planted in the OPPOSITE lane, so obeying the prompt keeps the
// car clear. Clearing a round = the obstacle has passed below the car.
//
// Difficulty ramps each round: the road speeds up (roundSpeed) and the gap
// between the prompt appearing and the obstacle arriving shrinks (roundDelay),
// down to a floor so it never becomes impossible.
export const TOTAL_ROUNDS = 15;

export const SPEED_STEP = 15; // px/s the road gains each round
export const DELAY_STEP = 150; // ms shaved off the prompt→obstacle gap each round
export const MIN_DELAY = 0; // the gap never drops below this

export const DIRECTIONS = ['left', 'right'];

// The road speed for a 1-based round number.
export function roundSpeed(baseSpeed, round) {
  return baseSpeed + Math.max(0, round - 1) * SPEED_STEP;
}

// The prompt→obstacle delay (ms) for a 1-based round number.
export function roundDelay(baseDelay, round) {
  return Math.max(MIN_DELAY, baseDelay - Math.max(0, round - 1) * DELAY_STEP);
}

// The lane the obstacle must occupy: the OPPOSITE of the spoken direction.
export function obstacleLaneIndex(direction, laneCount) {
  return direction === 'left' ? laneCount - 1 : 0;
}

// True when no direction appears three times consecutively.
function hasTriple(dirs) {
  for (let i = 2; i < dirs.length; i += 1) {
    if (dirs[i] === dirs[i - 1] && dirs[i] === dirs[i - 2]) return true;
  }
  return false;
}

// Fisher-Yates on a copy, driven by the injected rand so it stays testable.
function shuffled(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// One plan entry per round (index 0 = round 1). Fixed for the whole run so a
// replayed round keeps the same prompt it had before the hit.
//
// The sequence is BALANCED (split as evenly as the round count allows) and
// RANDOMIZED, but
// a direction can never repeat three times in a row — you may get "left, left"
// once, and then the next is guaranteed different. Built by shuffling the
// balanced multiset and rejecting any shuffle that contains a triple, with the
// deterministic L,R,L,R… interleave as a guaranteed-valid fallback (a uniform
// shuffle will essentially never need it for 10 rounds).
export function buildRoundPlan(laneCount, rand = Math.random, total = TOTAL_ROUNDS) {
  const half = Math.floor(total / 2);
  const balanced = [
    ...Array(half).fill('left'),
    ...Array(total - half).fill('right'),
  ];

  let dirs = balanced;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = shuffled(balanced, rand);
    if (!hasTriple(candidate)) {
      dirs = candidate;
      break;
    }
  }
  // Fallback (also the result when the loop exhausts): a strict alternation,
  // which is balanced and can never contain a triple for any total > 0.
  if (hasTriple(dirs)) {
    dirs = Array.from({ length: total }, (_, i) => (i % 2 === 0 ? 'left' : 'right'));
  }

  return dirs.map((direction, i) => ({
    round: i + 1,
    direction,
    obstacleLane: obstacleLaneIndex(direction, laneCount),
  }));
}

// Star rating from how many obstacles were hit across the run.
export function starsForMistakes(mistakes) {
  if (mistakes <= 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}
