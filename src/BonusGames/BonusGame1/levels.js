// levels.js
// Single source of truth for the 4 levels — their number range, whether the
// label is a numeral or a spelled-out word, their emoji theme, color
// palette, and background gradient. LevelSelectScene and NumberOrderScene
// both read from this array instead of hard-coding any of it, so adding a
// 5th level later just means pushing one more entry here.

import { createStarProgress } from '../../Phaser/common/starProgress';

export const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];

export const LEVELS = [
  {
    key: 'level1',
    name: 'Level 1',
    subtitle: 'Numbers 1–10',
    icon: '🫧',
    title: 'Tap the number from smallest to biggest 🫧',
    direction: 'asc',
    totalNumbers: 10,
    labelType: 'numeral',
    itemRadius: 48,
    objectEmojis: null,
    palette: [0xff6b6b, 0xffa94d, 0xffd43b, 0x94d82d, 0x51cf66],
    bgColors: ['#1e1b5a', '#4338ca', '#7c3aed'],
    groundColor: 'rgba(147, 51, 234, 0.55)',
    accentColor: 0x3fb6ea,
  },
  {
    key: 'level2',
    name: 'Level 2',
    subtitle: 'Numbers 1–10',
    icon: '🍎',
    title: 'Tap the number from biggest to smallest  🍎',
    direction: 'desc',
    totalNumbers: 10,
    badgeOffsetY: -22,
    labelType: 'numeral',
    itemRadius: 52,
    objectEmojis: ['🍎'],
    palette: [
      0xff6b6b, 0xffa94d, 0xffd43b, 0x94d82d, 0x51cf66,
      0x20c997, 0x22b8cf, 0x4dabf7, 0x845ef7, 0xf783ac,
    ],
    bgColors: ['#241a63', '#5b21b6', '#9333ea'],
    groundColor: 'rgba(109, 40, 217, 0.5)',
    accentColor: 0xff8f3f,
  },
  {
    key: 'level3',
    name: 'Level 3',
    subtitle: 'Spelled words 1–10',
    icon: '🌸',
    title: 'Tap the number from smallest to biggest 🌸',
    direction: 'asc',
    totalNumbers: 10,
    labelType: 'word',
    itemRadius: 62,
    objectEmojis: ['🌸', '🌺', '🪷'],
    palette: [0xff6fa8, 0xb96bf0, 0xff8fc7, 0xff5c8a, 0xc65cd9],
    bgColors: ['#1e1b5a', '#7c3aed', '#a21caf'],
    groundColor: 'rgba(190, 24, 93, 0.5)',
    accentColor: 0xe0559f,
  },
  {
    key: 'level4',
    name: 'Level 4',
    subtitle: 'Spelled words 1–10',
    badgeOffsetY: -12,
    icon: '🐠',
    title: 'Tap the number from biggest to smallest  🐠',
    direction: 'desc',
    totalNumbers: 10,
    labelType: 'word',
    itemRadius: 62,
    objectEmojis: ['🐠', '🐡', '🐟'],
    palette: [
      0x0f9dc2, 0x22b8cf, 0x3bc9db, 0x4dabf7, 0x66d9e8,
      0x20c997, 0x38d9a9, 0x4dc9c9, 0x0ea5b7, 0x5eead4,
    ],
    bgColors: ['#312e81', '#6d28d9', '#be185d'],
    groundColor: 'rgba(79, 70, 229, 0.5)',
    accentColor: 0x0f9dc2,
  },
];

export function labelForValue(level, value) {
  if (level.labelType === 'word') {
    const word = NUMBER_WORDS[value - 1];
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return String(value);
}

// One shared progress instance for this game — LevelSelectScene and
// NumberOrderScene both import `progress` from here rather than each
// building their own, so they always read/write the same localStorage
// bucket.
export const progress = createStarProgress({
  storageKey: 'numberpop-progress-v1',
  levelCount: LEVELS.length,
});
