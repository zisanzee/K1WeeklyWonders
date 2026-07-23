// starProgress.js
// Tiny localStorage-backed store for which levels are unlocked and how many
// stars the player has earned. One star per level, max 4 total. Wrapped in
// try/catch everywhere since localStorage can throw (private browsing,
// disabled storage, etc.) — progress just won't persist in that case rather
// than crashing the game.

import { LEVELS } from './levels';

const STORAGE_KEY = 'numberpop-progress-v1';

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable — fail silently.
  }
}

export function getAllStars() {
  const data = loadRaw();
  return LEVELS.map((_, i) => (data[`level${i}`] ? 1 : 0));
}

export function totalStars() {
  return getAllStars().reduce((sum, s) => sum + s, 0);
}

export function isLevelUnlocked(levelIndex) {
  if (levelIndex === 0) return true;
  const data = loadRaw();
  return !!data[`level${levelIndex - 1}`];
}

export function completeLevel(levelIndex) {
  const data = loadRaw();
  data[`level${levelIndex}`] = true;
  saveRaw(data);
}

export function resetProgress() {
  saveRaw({});
}
