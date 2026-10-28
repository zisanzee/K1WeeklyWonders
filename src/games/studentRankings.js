// studentRankings.js
// Pure ranking logic for the per-student detail page: favourite game, strongest
// games and hardest games.
//
// Kept out of the page component so it can be unit tested — these are judgement
// calls about a child's performance, and getting them wrong is invisible in a
// screenshot but very visible to a teacher.
//
// INPUT SHAPE (one entry per game, from the server's `perGame` facet):
//   { game, plays, avgMistakes, avgStreak, bestStreak, totalMistakes }
//
// All averages are PER PLAY. `avgStreak` is the mean `peakStreak` of that game's
// plays; `bestStreak` is the maximum.
//
// THE RULES, exactly as specified by the product owner:
//
//   Favourite  → most played.
//   Strongest  → least mistakes and most streaks. A game whose streak is 0 is
//                NOT excluded; its streak simply does not contribute, so it is
//                judged on mistakes alone.
//   Hardest    → most mistakes and least streaks. A game whose streak is 0 IS
//                excluded.
//
// The asymmetry is deliberate. See `hardestGames` for the note on it.

// How many games each list shows.
export const TOP_N = 3;

// Min-max normalise `value` against the observed range.
//
// Returns 0.5 when the range is degenerate (every game identical): that is the
// "no information, treat as average" answer, and it avoids a divide-by-zero that
// would otherwise make every score NaN and every ranking arbitrary.
function normalise(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

// Rounds to a stable number of decimals so two scores that are equal in reality
// don't get separated by float noise (0.30000000000000004 > 0.3), which would
// make tie-breaking look random between renders.
function round4(n) {
  return Math.round(n * 10_000) / 10_000;
}

// Builds the scored view of every game once, so favourite/strongest/hardest all
// share one normalisation pass over the SAME ranges. Scoring each list against
// its own subset would silently rescale the numbers between lists.
export function scoreGames(perGame = []) {
  const games = (Array.isArray(perGame) ? perGame : []).filter(
    (g) => g && g.game && (g.plays ?? 0) > 0
  );
  if (games.length === 0) return [];

  const mistakes = games.map((g) => g.avgMistakes ?? 0);
  const streaks = games.map((g) => g.avgStreak ?? 0);
  const minM = Math.min(...mistakes);
  const maxM = Math.max(...mistakes);
  const minS = Math.min(...streaks);
  const maxS = Math.max(...streaks);

  return games.map((g) => {
    const avgMistakes = g.avgMistakes ?? 0;
    const avgStreak = g.avgStreak ?? 0;

    // 1 = fewest mistakes, 0 = most.
    const mistakeScore = 1 - normalise(avgMistakes, minM, maxM);
    // 1 = longest streaks, 0 = shortest.
    const streakScore = normalise(avgStreak, minS, maxS);

    // A zero-streak game carries no streak signal, so it is scored on mistakes
    // alone rather than being credited with the 0.5 the normaliser would hand a
    // degenerate range.
    const strongest =
      avgStreak === 0 ? mistakeScore : 0.5 * mistakeScore + 0.5 * streakScore;

    // Hardest is the mirror: most mistakes (low mistakeScore) and least streak.
    const hardest = 0.5 * (1 - mistakeScore) + 0.5 * (1 - streakScore);

    return {
      ...g,
      plays: g.plays ?? 0,
      avgMistakes,
      avgStreak,
      mistakeScore: round4(mistakeScore),
      streakScore: round4(streakScore),
      strongestScore: round4(strongest),
      hardestScore: round4(hardest),
    };
  });
}

// Deterministic tie-break: better score first, then more plays (a game played
// once is weaker evidence than one played ten times), then alphabetical by key so
// the order never flickers between renders.
function byScore(scoreKey, playsDesc = true) {
  return (a, b) => {
    const diff = b[scoreKey] - a[scoreKey];
    if (diff !== 0) return diff;
    if (playsDesc && b.plays !== a.plays) return b.plays - a.plays;
    return String(a.game).localeCompare(String(b.game));
  };
}

// Most played. Ties go to the stronger game, so "favourite" never contradicts
// the strongest list when two games were played an equal number of times.
export function favouriteGame(perGame = []) {
  const scored = scoreGames(perGame);
  if (scored.length === 0) return null;
  const sorted = [...scored].sort((a, b) => {
    if (b.plays !== a.plays) return b.plays - a.plays;
    const diff = b.strongestScore - a.strongestScore;
    if (diff !== 0) return diff;
    return String(a.game).localeCompare(String(b.game));
  });
  return sorted[0];
}

// Top 3 cleanest games.
//
// Zero-streak games REMAIN eligible — the spec says their streak data is
// ignored, not the game. They are ranked on mistakes alone (see scoreGames).
export function strongestGames(perGame = [], limit = TOP_N) {
  return [...scoreGames(perGame)].sort(byScore('strongestScore')).slice(0, limit);
}

// Top 3 hardest games.
//
// Zero-streak games are EXCLUDED here. As specified:
//   "most amount of mistake and least amount of streaks. 0 streak games to be
//    ignored."
//
// NOTE ON THE ASYMMETRY: this means a game a child never built any streak in —
// arguably the hardest experience of all — cannot appear in "hardest". That is
// what was asked for, so it is what is implemented. If the intent was "don't
// *reward* streak" rather than "drop the game", delete the `.filter` below and
// the list becomes the exact mirror of strongestGames.
export function hardestGames(perGame = [], limit = TOP_N) {
  return [...scoreGames(perGame)]
    .filter((g) => g.avgStreak > 0)
    .sort(byScore('hardestScore'))
    .slice(0, limit);
}
