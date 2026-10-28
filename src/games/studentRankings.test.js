import { describe, it, expect } from 'vitest';
import {
  TOP_N,
  scoreGames,
  favouriteGame,
  strongestGames,
  hardestGames,
} from '@/games/studentRankings';

// These functions decide which games a teacher is told are a child's strengths.
// The rules have several deliberate asymmetries, so each one is pinned
// explicitly rather than tested through a single "it produces a list" case.

const g = (game, plays, avgMistakes, avgStreak) => ({
  game,
  plays,
  avgMistakes,
  avgStreak,
});

describe('scoreGames', () => {
  it('returns nothing for empty or malformed input', () => {
    expect(scoreGames([])).toEqual([]);
    expect(scoreGames(null)).toEqual([]);
    expect(scoreGames(undefined)).toEqual([]);
    // A game with zero plays carries no information.
    expect(scoreGames([g('game1', 0, 0, 0)])).toEqual([]);
    // An entry with no game key is dropped rather than becoming NaN scores.
    expect(scoreGames([{ plays: 3, avgMistakes: 1, avgStreak: 1 }])).toEqual([]);
  });

  it('scores fewest mistakes as the highest mistakeScore', () => {
    const scored = scoreGames([g('clean', 5, 0, 3), g('messy', 5, 10, 3)]);
    const clean = scored.find((x) => x.game === 'clean');
    const messy = scored.find((x) => x.game === 'messy');
    expect(clean.mistakeScore).toBe(1);
    expect(messy.mistakeScore).toBe(0);
  });

  it('scores longest streaks as the highest streakScore', () => {
    const scored = scoreGames([g('high', 5, 0, 9), g('low', 5, 0, 1)]);
    expect(scored.find((x) => x.game === 'high').streakScore).toBe(1);
    expect(scored.find((x) => x.game === 'low').streakScore).toBe(0);
  });

  it('treats a degenerate range as neutral rather than dividing by zero', () => {
    // One game only: min === max for both metrics.
    const [only] = scoreGames([g('solo', 4, 2, 3)]);
    expect(only.mistakeScore).toBe(0.5);
    expect(only.streakScore).toBe(0.5);
    // Zero streak means the streak half is skipped entirely, leaving the
    // mistake half's neutral 0.5.
    expect(only.strongestScore).toBe(0.5);
    expect(Number.isNaN(only.strongestScore)).toBe(false);
  });

  it('gives identical games identical scores', () => {
    const scored = scoreGames([g('a', 3, 2, 2), g('b', 3, 2, 2)]);
    expect(scored[0].strongestScore).toBe(scored[1].strongestScore);
    expect(scored[0].hardestScore).toBe(scored[1].hardestScore);
  });
});

describe('favouriteGame', () => {
  it('picks the most played game', () => {
    const fav = favouriteGame([g('game1', 3, 1, 2), g('game2', 9, 5, 0), g('game3', 5, 0, 8)]);
    expect(fav.game).toBe('game2');
  });

  it('breaks a play-count tie with the stronger game, not list order', () => {
    // Both played 5 times; game3 is cleaner, so it wins even though game1 came
    // first in the input.
    const fav = favouriteGame([g('game1', 5, 9, 0), g('game3', 5, 0, 5)]);
    expect(fav.game).toBe('game3');
  });

  it('is deterministic when plays AND strength tie', () => {
    const a = favouriteGame([g('gameB', 4, 1, 1), g('gameA', 4, 1, 1)]);
    const b = favouriteGame([g('gameA', 4, 1, 1), g('gameB', 4, 1, 1)]);
    expect(a.game).toBe('gameA');
    expect(b.game).toBe('gameA');
  });

  it('returns null when there is nothing to rank', () => {
    expect(favouriteGame([])).toBeNull();
    expect(favouriteGame(null)).toBeNull();
  });
});

describe('strongestGames', () => {
  it('ranks fewest mistakes and longest streaks first', () => {
    const rows = [
      g('messy', 5, 10, 1), // worst on both
      g('clean', 5, 0, 9), // best on both
      g('mid', 5, 5, 5),
    ];
    expect(strongestGames(rows).map((x) => x.game)).toEqual(['clean', 'mid', 'messy']);
  });

  it('caps the list at three', () => {
    const rows = Array.from({ length: 6 }, (_, i) => g(`game${i}`, 2, i, i + 1));
    expect(strongestGames(rows)).toHaveLength(TOP_N);
    expect(TOP_N).toBe(3);
  });

  // THE DELIBERATE ASYMMETRY: a zero-streak game stays eligible here.
  it('keeps a zero-streak game in the list, judged on mistakes alone', () => {
    // 'flawless' has never built a streak, but it is the cleanest game played.
    const rows = [g('flawless', 6, 0, 0), g('ok', 6, 4, 2), g('rough', 6, 8, 1)];
    const strongest = strongestGames(rows);
    expect(strongest.map((x) => x.game)).toContain('flawless');
    // Scored purely on mistakes: perfect mistake score, no streak credit.
    expect(strongest[0].game).toBe('flawless');
    expect(strongest[0].strongestScore).toBe(1);
  });
});

describe('hardestGames', () => {
  it('ranks most mistakes and shortest streaks first', () => {
    const rows = [g('clean', 5, 0, 9), g('messy', 5, 10, 1), g('mid', 5, 5, 4)];
    expect(hardestGames(rows).map((x) => x.game)).toEqual(['messy', 'mid', 'clean']);
  });

  // THE DELIBERATE ASYMMETRY: a zero-streak game is EXCLUDED here.
  it('excludes zero-streak games entirely', () => {
    const rows = [
      // This is the messiest game, but its streak is 0, so the spec says ignore.
      g('neverStreaked', 8, 20, 0),
      g('bad', 5, 10, 1),
      g('mild', 5, 2, 4),
    ];
    const hardest = hardestGames(rows);
    expect(hardest.map((x) => x.game)).not.toContain('neverStreaked');
    expect(hardest[0].game).toBe('bad');
  });

  it('returns an empty list when every game has zero streak', () => {
    // Nothing is eligible, so the page shows its empty state rather than
    // inventing a ranking.
    expect(hardestGames([g('a', 3, 5, 0), g('b', 4, 9, 0)])).toEqual([]);
  });

  it('caps the list at three', () => {
    const rows = Array.from({ length: 6 }, (_, i) => g(`game${i}`, 2, i, i + 1));
    expect(hardestGames(rows)).toHaveLength(TOP_N);
  });
});

describe('the two lists do not contradict each other', () => {
  it('never ranks the same game top of both', () => {
    const rows = [g('clean', 5, 0, 9), g('messy', 5, 10, 1), g('mid', 5, 5, 4)];
    expect(strongestGames(rows)[0].game).not.toBe(hardestGames(rows)[0].game);
  });
});
