// levels.js
// Level definitions for Game 7 (Number Bonds — "Mama Bird's Eggs").
// 2 levels × 6 rounds = one continuous 12-round run with no level-select
// screen. Both levels are fill mode (Blue Nest pre-filled, child adds to
// the Yellow Nest); they differ only in how the target is shown — Level 1
// (Robin) uses numerals, Level 2 (Owl) uses spelled-out words.

export const LEVELS = [
  { key: 'level1', name: 'Level 1', subtitle: 'Robin \u2014 Fill (1-10)', bird: 'robin', range: [1, 10], mode: 'fill', format: 'numeral', rounds: 6 },
  { key: 'level2', name: 'Level 2', subtitle: 'Owl \u2014 Fill (1-10)',    bird: 'owl',   range: [1, 10], mode: 'fill', format: 'spelled', rounds: 6 },
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
// Every level is fill mode now; the only per-level difference is how the
// target is shown, carried by the level's own `format`.
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

  // All rounds in a level share the level's display format — level 1 shows
  // digits, level 2 shows number words.
  const rounds = rawRounds.map((r) => ({
    target: r.target,
    given: r.given,
    format: level.format ?? 'numeral',
  }));

  return rounds;
}
