// levels.js
// Single source of truth for the 2 levels — value range, allowed
// difference between the two rolled values, how many "bigger"/"smaller"
// rounds each level has, and the per-level asset/voice keys.
// LevelSelectScene and CompareDiceScene both read from this array instead
// of hard-coding any of it.
//
// Domino note: Assets.json only ships domino artwork for values 2–10 (no
// "1"), so Level 2's range is 2–10, not 1–10 as in the original game
// design note — flag if a Domino-1 asset shows up later and this should
// change to minValue: 1.

import { createStarProgress } from '../../Phaser/common/starProgress';

export const LEVELS = [
  {
    key: 'dice',
    name: 'Level 1',
    subtitle: 'Compare the Dice',
    icon: 'dice5',
    iconSize: 102, // Dice-5.png
    itemType: 'dice',
    minValue: 1,
    maxValue: 5,
    diffOptions: [2, 3],
    biggerCount: 3,
    smallerCount: 3,
    passThreshold: 5,
    imagePrefix: 'dice',
    rollButtonKey: 'rollDiceButton',
    introVoice: { bigger: 'introBiggerDice', smaller: 'introSmallerDice' },
    accentColor: 0x3fb6ea,
    tint: 0xd7f0ff,
    // Absolute px, against the fixed 720x1080 base resolution (this never
    // changes at runtime — Phaser.Scale.FIT only rescales visually, so
    // hardcoding here is safe and simpler than deriving from scene size).
    boxWidth: 230,
    boxHeight: 230,
  },
  {
    key: 'domino',
    name: 'Level 2',
    subtitle: 'Compare the Dominoes',
    icon: 'domino8', 
    iconSize: 200,// Domino-8.png
    itemType: 'domino',
    minValue: 2,
    maxValue: 10,
    diffOptions: [1, 2],
    biggerCount: 4,
    smallerCount: 4,
    passThreshold: 5,
    imagePrefix: 'domino',
    rollButtonKey: 'rollDominoButton',
    introVoice: { bigger: 'introBiggerDomino', smaller: 'introSmallerDomino' },
    accentColor: 0xff8f3f,
    tint: 0xffe6bf,
    // Domino artwork reads as a tall rectangle (two pip groups stacked),
    // so its box is both wider AND noticeably taller than the dice box.
    boxWidth: 300,
    boxHeight: 430,
  },
];

// Shuffled sequence of 'bigger'/'smaller' prompts with the requested count
// of each, so every playthrough gets a different but still-balanced order
// (e.g. Level 1 -> 3 'bigger' + 3 'smaller', shuffled).
export function buildRounds(level) {
  const seq = [
    ...Array(level.biggerCount).fill('bigger'),
    ...Array(level.smallerCount).fill('smaller'),
  ];
  for (let i = seq.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq;
}

// One shared progress instance — LevelSelectScene and CompareDiceScene both
// import `progress` from here rather than each building their own.
export const progress = createStarProgress({
  storageKey: 'comparedice-progress-v1',
  levelCount: LEVELS.length,
});
