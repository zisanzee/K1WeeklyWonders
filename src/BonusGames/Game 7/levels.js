// levels.js
// Level definitions for Game 7 (Number Bonds — "Mama Bird's Eggs").
// 4 levels alternating split/fill mode, two birds, two number ranges.
// Round generation produces shuffled non-repeating targets within a level.

import { createStarProgress } from '../../Phaser/common/starProgress';

export const LEVELS = [
  { key: 'level1', name: 'Level 1', subtitle: 'Robin \u2014 Split (1-5)',  bird: 'robin', range: [1, 5],  mode: 'split', rounds: 4 },
  { key: 'level2', name: 'Level 2', subtitle: 'Robin \u2014 Fill (1-5)',   bird: 'robin', range: [1, 5],  mode: 'fill',  rounds: 4 },
  { key: 'level3', name: 'Level 3', subtitle: 'Owl \u2014 Split (1-10)',   bird: 'owl',   range: [1, 10], mode: 'split', rounds: 4 },
  { key: 'level4', name: 'Level 4', subtitle: 'Owl \u2014 Fill (1-10)',    bird: 'owl',   range: [1, 10], mode: 'fill',  rounds: 4 },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Number word lookup for spelled-out display.
const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// Returns an array of round configs: { target, given, format }
// `given` is only meaningful in 'fill' mode (Blue Nest's starting count).
// A target of 1 can't be split across two nests meaningfully, so the
// usable target pool always starts at 2.
// Each level has 4 rounds: first 2 display the number as a numeral digit,
// last 2 display it as a spelled-out word.
export function buildRounds(level) {
  const [, max] = level.range;
  const minTarget = 2;

  // Generate 4 raw { target, given } entries (same logic as before).
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

  // Assign format: first 2 rounds show numerals, last 2 spell the number.
  const rounds = rawRounds.map((r, i) => ({
    target: r.target,
    given: r.given,
    format: i < 2 ? 'numeral' : 'spelled',
  }));

  return rounds;
}

export const progress = createStarProgress({
  storageKey: 'game7-progress-v1',
  levelCount: LEVELS.length,
});
