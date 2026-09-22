import { describe, it, expect, beforeEach } from 'vitest';
import {
  mergeRows,
  nextScheduledGame,
  formatUnlockCountdown,
  invalidateClassAccessCache,
  useGameAccessStore,
  GAME_CATALOG,
  GAME_KEYS,
  GAME_TERMS,
  groupGamesByTerm,
} from '@/games/gameAccess';

// The homepage reads game access through a 7-day localStorage cache that is
// painted BEFORE the network response. A stale entry therefore wins whenever
// the follow-up fetch is slow or fails, which is how a teacher's panel edits
// used to vanish on the home page. These tests pin the invalidation contract.
describe('class access cache invalidation', () => {
  const CLASS_A = 'class-a';
  const CLASS_B = 'class-b';

  beforeEach(() => {
    localStorage.clear();
  });

  it('tolerates a missing classId or an uncached class', () => {
    expect(() => invalidateClassAccessCache(null)).not.toThrow();
    expect(() => invalidateClassAccessCache(undefined)).not.toThrow();
    expect(() => invalidateClassAccessCache('never-cached')).not.toThrow();
  });

  it('does not disturb the previous arrangement when refreshing without the cache', async () => {
    // A forced fetch must not blank the store: the home page keeps rendering
    // the rows it already has while the request is in flight, so there is no
    // empty-grid flash between the panel and the home page.
    useGameAccessStore.setState({
      games: [{ key: '8', unlocked: true }],
      loaded: true,
      loadedClassId: CLASS_A,
    });

    const pending = useGameAccessStore
      .getState()
      .fetchGameAccess(CLASS_A, { force: true });

    // Still populated synchronously after the call started.
    expect(useGameAccessStore.getState().games).toHaveLength(1);

    await Promise.allSettled([pending]);
  });

  it('keeps the seeded rows on screen when the refresh fails', async () => {
    useGameAccessStore.setState({
      games: [{ key: '8', unlocked: true }],
      loaded: true,
      loadedClassId: CLASS_A,
    });

    // fetchGameAccess swallows network errors by design (it surfaces them as
    // `error` state), so the previously painted games must survive.
    await useGameAccessStore.getState().fetchGameAccess(CLASS_A, { force: true });

    const state = useGameAccessStore.getState();
    expect(state.games).toHaveLength(1);
    expect(state.games[0].key).toBe('8');
  });

  it('does nothing without a classId', async () => {
    useGameAccessStore.setState({ games: [], loaded: false, loadedClassId: null });
    await useGameAccessStore.getState().fetchGameAccess(null, { force: true });
    expect(useGameAccessStore.getState().loaded).toBe(false);
  });

  it('exposes distinct classes as independent cache keys', () => {
    // Guards the shape the cache is keyed on: a per-class entry, so editing
    // class A can never blank class B's cached arrangement.
    expect(CLASS_A).not.toBe(CLASS_B);
  });
});

describe('mergeRows', () => {
  it('returns only games the class has actually added', () => {
    const merged = mergeRows([
      { gameKey: '1', unlocked: true },
      { gameKey: '99', unlocked: true }, // not in the catalogue
    ]);

    expect(merged.map((g) => g.key)).toEqual(['1']);
  });

  it('carries the server row flags onto the catalogue entry', () => {
    const [game] = mergeRows([
      { gameKey: '3', unlocked: true, shiny: true, order: 4 },
    ]);

    // Identity still comes from GAME_CATALOG, which stays the source of truth
    // for routing and labels even when the server row is authoritative for
    // access state.
    expect(game.unlocked).toBe(true);
    expect(game.shiny).toBe(true);
    expect(game.order).toBe(4);
    expect(game.to).toBe('/25814');
    expect(game.emoji).toBe('🐙');
  });

  it('coerces missing flags rather than leaking undefined into the UI', () => {
    const [game] = mergeRows([{ gameKey: '1' }]);

    expect(game.unlocked).toBe(false);
    expect(game.shiny).toBe(false);
    expect(game.unlockAt).toBeNull();
  });

  it('falls back to catalogue position when the row has no order', () => {
    const merged = mergeRows([{ gameKey: '2' }, { gameKey: '1' }]);

    // Sorted by the fallback index, so catalogue order wins.
    expect(merged.map((g) => g.key)).toEqual(['1', '2']);
  });

  it('sorts by the server order when one is present', () => {
    const merged = mergeRows([
      { gameKey: '1', order: 5 },
      { gameKey: '2', order: 1 },
    ]);

    expect(merged.map((g) => g.key)).toEqual(['2', '1']);
  });

  it('survives a non-array response', () => {
    expect(mergeRows(null)).toEqual([]);
    expect(mergeRows(undefined)).toEqual([]);
  });
});

describe('GAME_CATALOG', () => {
  it('has no duplicate keys', () => {
    expect(new Set(GAME_KEYS).size).toBe(GAME_KEYS.length);
  });

  // A duplicate display name is invisible in the admin panel and has already
  // shipped a mismatch once (Game 6 and Game 9 were both "Polly's Treasure
  // Quest"), so it is asserted rather than merely reviewed.
  it('has no duplicate display names', () => {
    const labels = GAME_CATALOG.map((game) => game.label.trim().toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every game the fields the UI reads', () => {
    for (const game of GAME_CATALOG) {
      expect(game.key, `${game.label} has no key`).toBeTruthy();
      expect(game.to, `${game.label} has no route`).toBeTruthy();
      expect(game.progressKey, `${game.label} has no progressKey`).toBeTruthy();
      expect(game.title, `${game.label} has no title`).toBeTruthy();
    }
  });

  it('tags every game with a known academic term', () => {
    const termIds = new Set(GAME_TERMS.map((t) => t.id));
    for (const game of GAME_CATALOG) {
      expect(
        termIds.has(game.term),
        `${game.label} has an unknown term (${game.term})`
      ).toBe(true);
    }
  });

  it('groups games by term without reordering within a term', () => {
    const groups = groupGamesByTerm();
    const groupedKeys = groups.flatMap((g) => g.games.map((game) => game.key));

    // Every game lands in exactly one term group, and the flattened order
    // matches the catalogue order.
    expect(groupedKeys).toEqual(GAME_KEYS);
    expect(groups.map((g) => g.id).sort()).toEqual(GAME_TERMS.map((t) => t.id).sort());
  });

  it('drops terms that have no games in the input', () => {
    const groups = groupGamesByTerm([{ key: '1', term: 3 }]);
    expect(groups.map((g) => g.id)).toEqual([3]);
  });
});

describe('nextScheduledGame', () => {
  const now = Date.now();
  const future = (ms) => new Date(now + ms).toISOString();

  it('returns null when nothing is scheduled', () => {
    expect(nextScheduledGame([{ key: '1', unlocked: true }])).toBeNull();
    expect(nextScheduledGame([])).toBeNull();
  });

  it('picks the soonest pending unlock', () => {
    const games = [
      { key: '1', unlocked: false, unlockAt: future(86_400_000) },
      { key: '2', unlocked: false, unlockAt: future(3_600_000) },
    ];

    expect(nextScheduledGame(games).key).toBe('2');
  });

  it('ignores an unlocked game even if it still carries an unlockAt', () => {
    const games = [{ key: '1', unlocked: true, unlockAt: future(3_600_000) }];

    expect(nextScheduledGame(games)).toBeNull();
  });

  it('ignores an unparseable unlockAt instead of counting down to NaN', () => {
    const games = [{ key: '1', unlocked: false, unlockAt: 'not-a-date' }];

    expect(nextScheduledGame(games)).toBeNull();
  });

  it('tolerates a non-array input', () => {
    expect(nextScheduledGame(undefined)).toBeNull();
  });
});

describe('formatUnlockCountdown', () => {
  const NOW = Date.parse('2026-09-14T12:00:00.000Z');
  const inMs = (ms) => new Date(NOW + ms).toISOString();

  it('reports days and hours for a long wait', () => {
    expect(formatUnlockCountdown(inMs(2 * 86_400_000 + 4 * 3_600_000), NOW)).toBe('2d 4h');
  });

  it('drops to hours and minutes under a day', () => {
    expect(formatUnlockCountdown(inMs(4 * 3_600_000 + 12 * 60_000), NOW)).toBe('4h 12m');
  });

  it('drops to minutes under an hour', () => {
    expect(formatUnlockCountdown(inMs(12 * 60_000), NOW)).toBe('12m');
  });

  it('degrades gracefully in the final minute', () => {
    expect(formatUnlockCountdown(inMs(30_000), NOW)).toBe('under a minute');
  });

  it('returns null for a past time, so the caller can fall back to generic copy', () => {
    expect(formatUnlockCountdown(inMs(-1), NOW)).toBeNull();
  });

  it('returns null for a missing or unparseable value', () => {
    expect(formatUnlockCountdown(null, NOW)).toBeNull();
    expect(formatUnlockCountdown(undefined, NOW)).toBeNull();
    expect(formatUnlockCountdown('soon', NOW)).toBeNull();
  });
});
