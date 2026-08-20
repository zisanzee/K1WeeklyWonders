// levels.js
// Level definitions for Game 7 (Number Bonds — "Mama Bird's Eggs").
// 2 levels × 6 rounds = one continuous 12-round run with no level-select
// screen. Level 1 is split mode (Robin), Level 2 is fill mode (Owl); both
// use the 1-10 range. Rounds alternate format within a level: 3 numerals
// then 3 spelled-out words.

export const LEVELS = [
  { key: 'level1', name: 'Level 1', subtitle: 'Robin \u2014 Split (1-10)', bird: 'robin', range: [1, 10], mode: 'split', rounds: 6 },
  { key: 'level2', name: 'Level 2', subtitle: 'Owl \u2014 Fill (1-10)',  bird: 'owl', range: [1, 10], mode: 'fill',  rounds: 6 },
];

// Total rounds across the whole run, used by the round indicator so it can
// count 1-12 instead of resetting to 1 at the start of level 2.
export const TOTAL_ROUNDS = LEVELS.reduce((sum, level) => sum + level.rounds, 0);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns an array of round configs: { target, given, format }.
// `given` is only meaningful in 'fill' mode (Blue Nest's starting count).
// A target of 1 can't be split across two nests meaningfully, so the
// usable target pool always starts at 2.
// Each level has 6 rounds: first 3 display the number as a numeral digit,
// last 3 display it as a spelled-out word.
export function buildRounds(level) {
  const [, max] = level.range;
  const minTarget = 2;

  // Generate `level.rounds` raw { target, given } entries (same logic as
  // before, now filling 6 rounds instead of 4).
  const rawRounds = [];
  if (level.mode === 'fill') {
    const pairs = [];
    for (let g = 1; g <= max - 1; g++) {
      for (let t = g + 1; t <= max; t++) {
        pairs.push({ target: t, given: g });
      }
    }
    const shuffled = shuffle(pairs);
    for (let i = 0; i < level.rounds; i++) {
      rawRounds.push(shuffled[i % shuffled.length]);
    }
  } else {
    const pool = shuffle(
      Array.from({ length: max - minTarget + 1 }, (_, i) => minTarget + i)
    );
    for (let i = 0; i < level.rounds; i++) {
      rawRounds.push({ target: pool[i % pool.length], given: 0 });
    }
  }

  // Assign format: first half of the level's rounds show numerals, second
  // half spell the number.
  const numeralCount = Math.ceil(level.rounds / 2);
  const rounds = rawRounds.map((r, i) => ({
    target: r.target,
    given: r.given,
    format: i < numeralCount ? 'numeral' : 'spelled',
  }));

  return rounds;
}
