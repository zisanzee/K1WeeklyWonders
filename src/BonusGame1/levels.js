// levels.js
// Single source of truth for the 4 levels — their number range, whether the
// label is a numeral or a spelled-out word, their emoji theme, color
// palette, and background gradient. LevelSelectScene and NumberOrderScene
// both read from this array instead of hard-coding any of it, so adding a
// 5th level later just means pushing one more entry here.

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
    totalNumbers: 10,
    labelType: 'numeral',
    itemRadius: 42,
    objectEmojis: null,
    palette: [0xff6b6b, 0xffa94d, 0xffd43b, 0x94d82d, 0x51cf66],
    bgColors: ['#3fb6ea', '#8fe0fa', '#ffe9a8'],
    groundColor: 'rgba(111, 207, 87, 0.85)',
    accentColor: 0x3fb6ea,
  },
  {
    key: 'level2',
    name: 'Level 2',
    subtitle: 'Numbers 1–10',
    
    icon: '🍎',
    title: 'Tap the number from smallest to biggest  🍎',
    totalNumbers: 10,
    badgeOffsetY: -22,
    labelType: 'numeral',
    itemRadius: 45,
    objectEmojis: ['🍎'],
    palette: [
      0xff6b6b, 0xffa94d, 0xffd43b, 0x94d82d, 0x51cf66,
      0x20c997, 0x22b8cf, 0x4dabf7, 0x845ef7, 0xf783ac,
    ],
    bgColors: ['#ffb46b', '#ffe08a', '#cdeec0'],
    groundColor: 'rgba(122, 87, 48, 0.55)',
    accentColor: 0xff8f3f,
  },
  {
    key: 'level3',
    name: 'Level 3',
    subtitle: 'Spelled words 1–10',
    icon: '🌸',
    title: 'Tap the number from smallest to biggest 🌸',
    totalNumbers: 10,
    labelType: 'word',
    itemRadius: 54,
    objectEmojis: ['🌸',  '🌺', '🪷'],
    palette: [0xff6fa8, 0xb96bf0, 0xff8fc7, 0xff5c8a, 0xc65cd9],
    bgColors: ['#f9a8d4', '#fbcfe8', '#fff1f8'],
    groundColor: 'rgba(150, 190, 110, 0.6)',
    accentColor: 0xe0559f,
  },
  {
    key: 'level4',
    name: 'Level 4',
    subtitle: 'Spelled words 1–10',
     badgeOffsetY: -12,
    icon: '🐠',
    title: 'Tap the number from smallest to biggest  🐠',
    totalNumbers: 10,
    labelType: 'word',
    itemRadius: 54,
    objectEmojis: ['🐠',  '🐡', '🐟'],
    palette: [
      0x0f9dc2, 0x22b8cf, 0x3bc9db, 0x4dabf7, 0x66d9e8,
      0x20c997, 0x38d9a9, 0x4dc9c9, 0x0ea5b7, 0x5eead4,
    ],
    bgColors: ['#0f7ea0', '#3fc6d6', '#a9ecec'],
    groundColor: 'rgba(232, 194, 115, 0.7)',
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