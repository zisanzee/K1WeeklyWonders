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

  // Every addend pair for a mode, as candidate rounds. Used both to re-roll
  // randomly and, if that exhausts, to pick a GUARANTEED-valid round below.
  const allRoundsForMode = (mode) => {
    const out = [];
    for (let a = 1; a <= 5; a += 1) {
      for (let b = 1; b <= 5; b += 1) {
        out.push(
          mode === MODES.FIRST_HALF
            ? { mode, ekaWants: a, zeeWants: b, total: a + b }
            : { mode, ekaHas: a, total: a + b, zeeNeeds: b }
        );
      }
    }
    return out;
  };

  // Does a round satisfy every constraint this game enforces?
  const roundPasses = (round) =>
    round.total <= 10 &&
    !recentContains(usedTotals, round.total) &&
    !recentContains(usedAnswers, answerValueOf(round)) &&
    !rounds.some((r) => duplicateKeyOf(r) === duplicateKeyOf(round));

  const commitRound = (round) => {
    round.options = buildOptions(answerValueOf(round));
    usedTotals.push(round.total);
    usedAnswers.push(answerValueOf(round));
    return round;
  };

  const tryBuildRound = (mode) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const round = allRoundsForMode(mode)[randInt(0, 24)];
      if (roundPasses(round)) return commitRound(round);
    }

    // The random loop can exhaust under the strict lookback. Rather than fall
    // back to an UNCONSTRAINED round (which would repeat a recent total — the
    // exact thing the lookback exists to prevent, and what flaked CI), scan the
    // candidate pairs in order and take the first that actually passes. The
    // total-lookback invariant is always satisfiable: at most 3 of the 9 totals
    // (2..10) are excluded at once, so valid totals always remain.
    const candidate = allRoundsForMode(mode).find(roundPasses);
    if (candidate) return commitRound(candidate);

    // Last resort (mathematically unreachable given the pools above): relax only
    // the answer-lookback, still honouring the total lookback + duplicate rules.
    const relaxed = allRoundsForMode(mode).find(
      (round) =>
        !recentContains(usedTotals, round.total) &&
        !rounds.some((r) => duplicateKeyOf(r) === duplicateKeyOf(round))
    );
    return commitRound(relaxed || allRoundsForMode(mode)[0]);
  };

  for (let i = 0; i < ROUNDS_PER_HALF; i += 1) {
    rounds.push(tryBuildRound(MODES.FIRST_HALF));
  }
  for (let i = 0; i < ROUNDS_PER_HALF; i += 1) {
    rounds.push(tryBuildRound(MODES.SECOND_HALF));
  }

  return rounds;
}
