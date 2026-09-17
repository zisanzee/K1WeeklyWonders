import { describe, it, expect } from 'vitest';
import { GAME_ICON_FILES, gameIconSrc } from './gameIcons';
import { GAME_CATALOG } from './gameAccess';

describe('gameIconSrc', () => {
  it('returns empty string for a game with no icon', () => {
    expect(gameIconSrc('nope')).toBe('');
    expect(gameIconSrc({ key: 'nope' })).toBe('');
  });

  it('tolerates missing / malformed input without throwing', () => {
    expect(gameIconSrc(undefined)).toBe('');
    expect(gameIconSrc(null)).toBe('');
    expect(gameIconSrc({})).toBe('');
  });

  it('resolves a configured key from either a key or a game object', () => {
    for (const [key, file] of Object.entries(GAME_ICON_FILES)) {
      // The whole point of accepting both shapes is that callers have one or
      // the other — a bare slug from a stats row, a whole game from a card.
      expect(gameIconSrc(key)).toBe(file);
      expect(gameIconSrc({ key })).toBe(file);
    }
  });
});

describe('emoji fallback', () => {
  it('every catalogue game has an emoji to fall back to', () => {
    // GameIcon shows this when a game has no icon (or its icon 404s), so a
    // missing emoji would render a blank card rather than a graceful degrade.
    for (const game of GAME_CATALOG) {
      expect(game.emoji, `${game.label} has no emoji fallback`).toBeTruthy();
    }
  });

  it('leaves every game un-iconed until one is registered', () => {
    // This pins the CURRENT state — the map is intentionally empty, so every
    // card should be showing its emoji. When you register the first icon this
    // assertion is expected to fail and should be updated, not deleted; it
    // exists so "did the images actually get wired up?" has a definitive answer.
    expect(Object.keys(GAME_ICON_FILES)).toHaveLength(0);
  });
});

describe('GAME_ICON_FILES', () => {
  it('only maps keys that exist in the catalogue', () => {
    // A typo'd key would be silently ignored — the game would just keep its
    // emoji and nobody would notice the icon never appeared.
    const known = new Set(GAME_CATALOG.map((g) => g.key));
    for (const key of Object.keys(GAME_ICON_FILES)) {
      expect(known.has(key), `"${key}" is not a GAME_CATALOG key`).toBe(true);
    }
  });

  it('maps every entry to a root-relative path under /game-icons/', () => {
    for (const [key, file] of Object.entries(GAME_ICON_FILES)) {
      expect(file.startsWith('/game-icons/'), `${key} → ${file}`).toBe(true);
      expect(/\.(png|webp|svg|jpg|jpeg)$/i.test(file), `${key} → ${file}`).toBe(true);
    }
  });
});
