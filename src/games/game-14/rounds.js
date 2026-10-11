// rounds.js
// Game 14 — round curriculum + difficulty curve.
//
// Pure (Phaser-free) so the plan and the star rating can be unit tested without
// booting Phaser. This is a BOILERPLATE: the round model here is deliberately
// generic (pick the correct option out of a few) so you can swap the `target` /
// `options` shaping for whatever your game actually asks, while keeping the
// testable pure surface.
//
// One plan entry per round:
//   { round, target, options, answerIndex }
// `options` is the list of answer choices, `answerIndex` the index of the
// correct one. A fixed plan is built ONCE for the whole run so a replayed round
// keeps the same choices it had before a miss.

export const TOTAL_ROUNDS = 8;
export const OPTION_COUNT = 3;

// Largest number the boilerplate will ask about. Replace with your own range.
export const MAX_TARGET = 9;

// The star rating for a run, from how many rounds were missed.
export function starsForMistakes(mistakes) {
  if (mistakes <= 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

// A per-round difficulty scalar in [0, 1] (0 = round 1, 1 = final round). The
// scene can read this to speed things up or widen the option set as the run
// progresses. Kept here (not in the scene) so it stays testable.
export function difficultyForRound(round, total = TOTAL_ROUNDS) {
  if (total <= 1) return 0;
  const clamped = Math.min(Math.max(round, 1), total);
  return (clamped - 1) / (total - 1);
}

// Draw an integer in [1, max] using the injected rand so tests are stable.
function drawInt(rand, max) {
  return Math.min(max, Math.floor(rand() * max) + 1);
}

// Build the fixed per-run plan. `rand` is injectable so the output is
// deterministic under test. Each round gets a target plus `optionCount`
// distinct options (including the target), shuffled with a Fisher-Yates pass.
export function buildRoundPlan(rand = Math.random, total = TOTAL_ROUNDS, optionCount = OPTION_COUNT) {
  const plan = [];
  for (let round = 1; round <= total; round += 1) {
    const target = drawInt(rand, MAX_TARGET);

    // Collect distinct option values, always including the target.
    const pool = new Set([target]);
    let guard = 0;
    while (pool.size < optionCount && guard < 200) {
      pool.add(drawInt(rand, MAX_TARGET));
      guard += 1;
    }
    const options = shuffle([...pool], rand);
    plan.push({
      round,
      target,
      options,
      answerIndex: options.indexOf(target),
    });
  }
  return plan;
}

// Fisher-Yates on a copy, driven by the injected rand.
function shuffle(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
