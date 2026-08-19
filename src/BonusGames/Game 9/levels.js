// levels.js
// Round-generation module for Game 9 ("Polly's Treasure Quest"). One
// continuous 10-round run: rounds 1-5 are "find the chest" (level 1) and
// rounds 6-10 are "find the keys" (level 2).
//
// Every bond always combines one FIRST-half key and one SECOND-half key:
//   Level 1 — the question shows one key of each half; the child taps the
//             chest that holds them both.
//   Level 2 — the chest shows the whole; the child picks one key from each
//             half so the two add up to it.
//
// Number ranges are constrained by the art: keys are numbered 1-9 (baked
// into the key images) and chests show 2-10 (text overlays).

export const TOTAL_ROUNDS = 10;
export const ROUNDS_PER_LEVEL = 5;
export const LEVELS = { FIND_CHEST: 1, FIND_KEYS: 2 };

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

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// One distractor in 1-9 that avoids every listed value (the two correct key
// values), so no key duplicates another key's number on the tray.
function distractorExcluding(excludes) {
  const pool = [];
  for (let v = 1; v <= 9; v += 1) {
    if (!excludes.includes(v)) pool.push(v);
  }
  return pool[randInt(0, pool.length - 1)];
}

// Correct whole plus two in-range distractors for the find-the-chest choices.
function buildChestOptions(whole) {
  const values = new Set([whole]);
  let guard = 0;
  while (values.size < 3 && guard < 40) {
    guard += 1;
    const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
    values.add(clamp(whole + delta, 2, 10));
  }
  return shuffle(Array.from(values).slice(0, 3));
}

// Level 2: the chest shows `whole`; the child chooses one key from each
// half's two options so firstKey + secondKey === whole.
function buildFindKeysRound() {
  const whole = randInt(3, 10); // skip 2 — the trivial 1+1 bond
  const firstKey = randInt(1, whole - 1);
  const secondKey = whole - firstKey;

  const excludes = [firstKey, secondKey];
  const firstDistractor = distractorExcluding(excludes);
  const secondDistractor = distractorExcluding([...excludes, firstDistractor]);

  return {
    level: LEVELS.FIND_KEYS,
    whole,
    firstKey,
    secondKey,
    firstHalfOptions: shuffle([firstKey, firstDistractor]),
    secondHalfOptions: shuffle([secondKey, secondDistractor]),
  };
}

// Level 1: the question shows one key of each half; the child taps the chest
// whose number is their sum.
function buildFindChestRound() {
  const firstKey = randInt(1, 9);
  // secondKey is capped so the sum stays within the 2-10 chest range.
  const secondKey = randInt(1, 10 - firstKey);
  const whole = firstKey + secondKey;

  return {
    level: LEVELS.FIND_CHEST,
    firstKey,
    secondKey,
    whole,
    chestOptions: buildChestOptions(whole),
  };
}

// Stable string for a round's key pair, used to reject exact duplicates.
function pairKey(round) {
  return `${round.firstKey}-${round.secondKey}`;
}

// Builds all 10 rounds up front so the repetition lookback has visibility
// across the entire run instead of being generated lazily per round.
export function buildRoundSequence() {
  const rounds = [];
  const usedWholes = [];

  const recentContains = (list, value, lookback = 3) =>
    list.slice(-lookback).includes(value);

  const buildWithGuard = (builder) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const round = builder();

      // Re-roll if the whole appeared within the last 3 rounds, or the exact
      // key pair duplicates an earlier round this game.
      if (recentContains(usedWholes, round.whole)) continue;
      if (rounds.some((r) => pairKey(r) === pairKey(round))) continue;

      usedWholes.push(round.whole);
      return round;
    }

    // Safety fallback (unreachable in practice given the pool sizes) — build
    // one valid round without enforcing the lookback so generation never
    // hangs.
    const round = builder();
    usedWholes.push(round.whole);
    return round;
  };

  for (let i = 0; i < ROUNDS_PER_LEVEL; i += 1) {
    rounds.push(buildWithGuard(buildFindChestRound));
  }
  for (let i = 0; i < ROUNDS_PER_LEVEL; i += 1) {
    rounds.push(buildWithGuard(buildFindKeysRound));
  }

  return rounds;
}
