// Phaser/common/starProgress.js
// Factory for a tiny localStorage-backed store tracking which levels are
// unlocked and how many stars the player has earned (one star per level).
// Wrapped in try/catch everywhere since localStorage can throw (private
// browsing, disabled storage, etc.) — progress just won't persist in that
// case rather than crashing the game.
//
// This is the shared version of BonusGame1's original starProgress.js.
// Each game creates its own instance with its own storage key and level
// count so games never collide in localStorage, e.g. (from a game's
// levels.js):
//
//   export const progress = createStarProgress({
//     storageKey: 'numberpop-progress-v1',
//     levelCount: LEVELS.length,
//   });

const LEVEL_KEY_PREFIX = 'level';

export function createStarProgress({ storageKey, levelCount }) {
  function loadRaw() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveRaw(data) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Storage unavailable — fail silently.
    }
  }

  return {
    getAllStars() {
      const data = loadRaw();
      return Array.from({ length: levelCount }, (_, i) => (data[`${LEVEL_KEY_PREFIX}${i}`] ? 1 : 0));
    },

    totalStars() {
      return this.getAllStars().reduce((sum, s) => sum + s, 0);
    },

    isLevelUnlocked(levelIndex) {
      if (levelIndex === 0) return true;
      const data = loadRaw();
      return !!data[`${LEVEL_KEY_PREFIX}${levelIndex - 1}`];
    },

    completeLevel(levelIndex) {
      const data = loadRaw();
      data[`${LEVEL_KEY_PREFIX}${levelIndex}`] = true;
      saveRaw(data);
    },

    resetProgress() {
      saveRaw({});
    },
  };
}
