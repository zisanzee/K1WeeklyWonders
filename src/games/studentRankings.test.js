import { describe, it, expect } from 'vitest';
import {
  TOP_N,
  scoreGames,
  favouriteGame,
  strongestGames,
  hardestGames,
} from '@/games/studentRankings';

// These functions decide which games a teacher is told are a child's strengths.
//
// The regression these tests exist for: the first version scored a no-streak
// game on mistakes ALONE, which spans the full 0..1 range, while a game with a
// streak had to earn half its score from the streak. Having a streak became a
// disadvantage, and a real student page ranked "Number Pop" (1.5 wrong/play) as
// #3 STRONGEST while ranking "Position Mission" (1.4 wrong/play) in HARDEST.
// Both lists were internally consistent and together they were nonsense.

const g = (game, plays, avgMistakes, avgStreak) => ({
  game,
  plays,
  avgMistakes,
  avgStreak,
});

// The real payload from the screenshot that exposed the bug.
const REAL = [
  g('Grocery Run', 3, 0.7, 46.7),
  g('Compare Dice', 2, 0.5, 0),
  g('Number Pop', 30, 1.5, 0),
  g('Feed Me Shapes', 40, 1.6, 7.7),
  g('Position Mission', 65, 1.4, 5.7),
  g('Mirror Me', 48, 1.0, 9.4),
];

describe('scoreGames', () => {
  it('returns nothing for empty or malformed input', () => {
    expect(scoreGames([])).toEqual([]);
    expect(scoreGames(null)).toEqual([]);
    expect(scoreGames(undefined)).toEqual([]);
    expect(scoreGames([g('game1', 0, 0, 0)])).toEqual([]);
    expect(scoreGames([{ plays: 3, avgMistakes: 1, avgStreak: 1 }])).toEqual([]);
  });

  it('gives every game a score in 0..1', () => {
    for (const row of scoreGames(REAL)) {
      for (const key of ['mistakeScore', 'streakScore', 'strongestScore', 'hardestScore']) {
        expect(row[key], `${row.game}.${key}`).toBeGreaterThanOrEqual(0);
        expect(row[key], `${row.game}.${key}`).toBeLessThanOrEqual(1);
      }
      expect(Number.isNaN(row.strongestScore)).toBe(false);
    }
  });

  it('marks which games have a streak signal', () => {
    const byName = Object.fromEntries(scoreGames(REAL).map((r) => [r.game, r]));
    expect(byName['Number Pop'].hasStreak).toBe(false);
    expect(byName['Mirror Me'].hasStreak).toBe(true);
  });

  it('treats a single game as neutral rather than dividing by zero', () => {
    const [only] = scoreGames([g('solo', 4, 2, 3)]);
    expect(only.mistakeScore).toBe(0.5);
    expect(only.streakScore).toBe(0.5);
    expect(only.strongestScore).toBe(0.5);
  });

  it('gives identical games identical scores', () => {
    const [a, b] = scoreGames([g('a', 3, 2, 2), g('b', 3, 2, 2)]);
    expect(a.strongestScore).toBe(b.strongestScore);
    expect(a.hardestScore).toBe(b.hardestScore);
  });
});

// INVARIANT 2: one extreme value must not flatten everyone else's score.
describe('outlier resistance', () => {
  it('does not collapse other games when one streak is extreme', () => {
    const withOutlier = [g('outlier', 3, 0.7, 50), g('normal', 5, 1.0, 9), g('low', 5, 1.2, 4)];
    const normal = scoreGames(withOutlier).find((r) => r.game === 'normal');
    // Under min-max scaling this was ~0.03; a percentile keeps it meaningful.
    expect(normal.streakScore).toBeGreaterThan(0.4);
  });
});

// INVARIANT 1: "judged on mistakes alone" must not be a hidden BONUS.
describe('no-streak scoring is neutral, not rewarded', () => {
  it('does not let a no-streak game outrank a cleaner game with a streak', () => {
    const rows = [
      g('streakyClean', 5, 0.7, 9), // cleaner AND has a streak
      g('noStreakDirty', 5, 1.5, 0), // dirtier, no streak
    ];
    const [first] = strongestGames(rows);
    expect(first.game).toBe('streakyClean');
  });

  it('ranks a no-streak game below an equally clean game with a streak', () => {
    // Same mistakes; the streak should tip it. This is the only place having a
    // streak is allowed to be an advantage — with EQUAL mistakes.
    const rows = [g('noStreak', 5, 1.0, 0), g('withStreak', 5, 1.0, 8)];
    expect(strongestGames(rows)[0].game).toBe('withStreak');
  });
});

describe('favouriteGame', () => {
  it('picks the most played game', () => {
    expect(favouriteGame(REAL).game).toBe('Position Mission'); // 65 plays
  });

  it('breaks a play-count tie with the stronger game, not list order', () => {
    const fav = favouriteGame([g('game1', 5, 9, 0), g('game3', 5, 0, 5)]);
    expect(fav.game).toBe('game3');
  });

  it('is deterministic when plays AND strength tie', () => {
    expect(favouriteGame([g('gameB', 4, 1, 1), g('gameA', 4, 1, 1)]).game).toBe('gameA');
    expect(favouriteGame([g('gameA', 4, 1, 1), g('gameB', 4, 1, 1)]).game).toBe('gameA');
  });

  it('returns null when there is nothing to rank', () => {
    expect(favouriteGame([])).toBeNull();
    expect(favouriteGame(null)).toBeNull();
  });
});

describe('strongestGames', () => {
  it('ranks fewest mistakes and longest streaks first', () => {
    const rows = [g('messy', 5, 10, 1), g('clean', 5, 0, 9), g('mid', 5, 5, 5)];
    expect(strongestGames(rows).map((x) => x.game)).toEqual(['clean', 'mid', 'messy']);
  });

  it('caps the list at three', () => {
    const rows = Array.from({ length: 6 }, (_, i) => g(`game${i}`, 2, i, i + 1));
    expect(strongestGames(rows)).toHaveLength(TOP_N);
    expect(TOP_N).toBe(3);
  });

  it('keeps a no-streak game eligible, judged on mistakes alone', () => {
    const rows = [g('flawless', 6, 0, 0), g('ok', 6, 4, 2), g('rough', 6, 8, 1)];
    expect(strongestGames(rows).map((x) => x.game)).toContain('flawless');
    expect(strongestGames(rows)[0].game).toBe('flawless');
  });
});

describe('hardestGames', () => {
  it('ranks most mistakes and shortest streaks first', () => {
    const rows = [g('clean', 5, 0, 9), g('messy', 5, 10, 1), g('mid', 5, 5, 4)];
    expect(hardestGames(rows).map((x) => x.game)).toEqual(['messy', 'mid', 'clean']);
  });

  it('excludes no-streak games entirely, as specified', () => {
    const rows = [g('neverStreaked', 8, 20, 0), g('bad', 5, 10, 1), g('mild', 5, 2, 4)];
    expect(hardestGames(rows).map((x) => x.game)).not.toContain('neverStreaked');
    expect(hardestGames(rows)[0].game).toBe('bad');
  });

  it('returns an empty list when every game has no streak', () => {
    expect(hardestGames([g('a', 3, 5, 0), g('b', 4, 9, 0)])).toEqual([]);
  });

  it('caps the list at three', () => {
    const rows = Array.from({ length: 6 }, (_, i) => g(`game${i}`, 2, i, i + 1));
    expect(hardestGames(rows)).toHaveLength(TOP_N);
  });
});

// THE REGRESSION GUARD.
//
// The two cards must never tell a teacher contradictory things about the same
// child. Three separate invariants, because the bug had three layers:
//
//   1. A game in "strongest" must not have MORE mistakes than a game in
//      "hardest" (the reported symptom).
//   2. No game may appear in BOTH cards at once.
//   3. Hardest must not contain the child's cleanest game, even when it is the
//      only one with a streak.
//
// The property test in the last block is what actually found layers 2 and 3: a
// roster-by-roster check passed on the one example in the bug report while
// failing on 359 of 500 random rosters.
describe('cross-list consistency (the reported bug)', () => {
  const assertConsistent = (rows, label) => {
    const strongest = strongestGames(rows);
    const hardest = hardestGames(rows);

    // INVARIANT 2: disjoint sets.
    const shared = strongest
      .map((g) => g.game)
      .filter((name) => hardest.some((h) => h.game === name));
    expect(shared, `${label}: game in both cards`).toEqual([]);

    if (!strongest.length || !hardest.length) return;

    // INVARIANT 1: no mistakes inversion across the two cards.
    const worstInStrongest = Math.max(...strongest.map((x) => x.avgMistakes));
    const bestInHardest = Math.min(...hardest.map((x) => x.avgMistakes));
    expect(worstInStrongest, `${label}: mistakes inverted`).toBeLessThanOrEqual(bestInHardest);
  };

  it('passes on the real payload that exposed the bug', () => {
    assertConsistent(REAL, 'real payload');
  });

  it('excludes Number Pop from strongest', () => {
    // The exact report: 1.5 wrong/play outranked Position Mission's 1.4.
    expect(strongestGames(REAL).map((x) => x.game)).not.toContain('Number Pop');
  });

  it('keeps the cleanest game out of hardest when it is the only streaked game', () => {
    // INVARIANT 3. Found by the property check: with 3 games, the 0.5-wrong
    // game was the sole streaked one and so became "hardest".
    const rows = [g('cleanest', 11, 0.5, 8.3), g('mid', 15, 2.3, 0), g('worst', 17, 3.6, 0)];
    const hardest = hardestGames(rows).map((x) => x.game);
    expect(hardest).not.toContain('cleanest');
  });

  it('holds across 300 randomly generated rosters', () => {
    // The real proof: no contradictions for any shape of roster, including the
    // tiny ones (1-3 games) where the two top-3 lists necessarily overlap.
    for (let run = 0; run < 300; run += 1) {
      const rows = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, (_, i) => ({
        game: `game${i}`,
        plays: 1 + Math.floor(Math.random() * 20),
        avgMistakes: Math.round(Math.random() * 40) / 10,
        avgStreak: Math.random() < 0.4 ? 0 : Math.round(Math.random() * 150) / 10,
      }));

      // Every draw must be internally consistent — no `continue`, because
      // skipping the short rosters is exactly how the original bug escaped.
      assertConsistent(rows, `run ${run}: ${JSON.stringify(rows)}`);
    }
  });
});
