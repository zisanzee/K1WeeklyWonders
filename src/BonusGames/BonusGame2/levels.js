// levels.js — TODO: define Bubble Shooter's level configs here, following
// the same pattern as BonusGame1/levels.js: an array of level configs plus
// a shared `progress` instance built from the common star-progress store.
import { createStarProgress } from '../../Phaser/common/starProgress';

export const LEVELS = [
  // { key: 'level1', name: 'Level 1', ... },
];

export const progress = createStarProgress({
  storageKey: 'bubbleshooter-progress-v1',
  levelCount: LEVELS.length,
});
