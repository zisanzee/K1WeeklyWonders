// levels.js
// Round-generation module for Game 8 ("Pizza Order!"). No level cards or
// star progress — the game is one continuous 10-round run that flips from
// "find the total" to "find the missing part" after round 5.

export const MODES = {
  FIRST_HALF: 'find-total', // rounds 1-5: solve for the total
  SECOND_HALF: 'find-part', // rounds 6-10: solve for the missing part
};

export const ROUNDS_PER_HALF = 5;
export const TOTAL_ROUNDS = 10;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The value the child must solve for in Phase B: the total in rounds 1-5,
// the missing part (zeeNeeds) in rounds 6-10.
function answerValueOf(round) {
  return round.mode === MODES.FIRST_HALF ? round.total : round.zeeNeeds;
}

// Stable string identifying the round's full addend pair, used to reject
// exact duplicates across the whole run.
function duplicateKeyOf(round) {
  return round.mode === MODES.FIRST_HALF
    ? `${round.ekaWants}-${round.zeeWants}`
    : `${round.ekaHas}-${round.zeeNeeds}`;
}

// Builds the 2 distractors for a correct answer (both within 1-10), using
// correct ± 1 / ± 2 clamped into range and de-duplicated.
function buildOptions(correct) {
  const candidates = [];
  for (const delta of [1, -1, 2, -2]) {
    const v = correct + delta;
    if (v >= 1 && v <= 10 && v !== correct) candidates.push(v);
  }

  const unique = [...new Set(candidates)];
  const distractors = shuffle(unique).slice(0, 2);

  // Defensive padding for the (practically unreachable) case where the pool
  // is too small to supply two in-range distractors.
  while (distractors.length < 2) {
    const fallback = randInt(1, 10);
    if (fallback !== correct && !distractors.includes(fallback)) {
      distractors.push(fallback);
    }
  }

  return shuffle([correct, ...distractors]);
}

// Builds all 10 rounds up front so the repetition lookback has visibility
// across the entire run instead of being generated lazily per round.
export function buildRoundSequence() {
  const rounds = [];
  const usedTotals = []; // every total used this game, in order
  const usedAnswers = []; // every Phase B answer value used this game, in order

  const recentContains = (list, value, lookback = 3) =>
    list.slice(-lookback).includes(value);

  const tryBuildRound = (mode) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      let round;
      if (mode === MODES.FIRST_HALF) {
        const ekaWants = randInt(1, 5);
        const zeeWants = randInt(1, 5);
        round = { mode, ekaWants, zeeWants, total: ekaWants + zeeWants };
      } else {
        const ekaHas = randInt(1, 5);
        const zeeNeeds = randInt(1, 5);
        round = { mode, ekaHas, total: ekaHas + zeeNeeds, zeeNeeds };
      }

      const answer = answerValueOf(round);

      // Totals are always ≤ 10 by construction (max addend pair is 5+5),
      // but keep the guard so a future edit can't silently exceed the
      // numbersVoice range.
      if (round.total > 10) continue;

      // Re-roll if the total or the answer value appeared within the last 3
      // rounds, or if the full addend pair is an exact duplicate of any
      // earlier round this game.
      if (recentContains(usedTotals, round.total)) continue;
      if (recentContains(usedAnswers, answer)) continue;
      if (rounds.some((r) => duplicateKeyOf(r) === duplicateKeyOf(round))) continue;

      round.options = buildOptions(answer);
      usedTotals.push(round.total);
      usedAnswers.push(answer);
      return round;
    }

    // Safety fallback (unreachable in practice given the pool sizes) — build
    // one valid round without enforcing the lookback so generation never hangs.
    let fallback;
    if (mode === MODES.FIRST_HALF) {
      const ekaWants = randInt(1, 5);
      const zeeWants = randInt(1, 5);
      fallback = { mode, ekaWants, zeeWants, total: ekaWants + zeeWants };
    } else {
      const ekaHas = randInt(1, 5);
      const zeeNeeds = randInt(1, 5);
      fallback = { mode, ekaHas, total: ekaHas + zeeNeeds, zeeNeeds };
    }
    fallback.options = buildOptions(answerValueOf(fallback));
    usedTotals.push(fallback.total);
    usedAnswers.push(answerValueOf(fallback));
    return fallback;
  };

  for (let i = 0; i < ROUNDS_PER_HALF; i += 1) {
    rounds.push(tryBuildRound(MODES.FIRST_HALF));
  }
  for (let i = 0; i < ROUNDS_PER_HALF; i += 1) {
    rounds.push(tryBuildRound(MODES.SECOND_HALF));
  }

  return rounds;
}
