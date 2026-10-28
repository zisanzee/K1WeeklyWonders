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
// THE PRODUCT RULES:
//
//   Favourite  → most played.
//   Strongest  → fewest mistakes and longest streaks. A game with no streak is
//                judged on mistakes alone (its streak simply does not count).
//   Hardest    → most mistakes and shortest streaks. Games with no streak are
//                excluded from this list.
//
// ---------------------------------------------------------------------------
// TWO SCORING INVARIANTS THIS MODULE EXISTS TO PRESERVE
// ---------------------------------------------------------------------------
//
// 1. NEUTRAL STREAK CREDIT — "judged on mistakes alone" must not be a BONUS.
//
//    The first version scored a zero-streak game on mistakes alone, which spans
//    the full 0..1 range, while a game WITH a streak had to earn half its score
//    from the streak. So a zero-streak game could reach a higher score than a
//    cleaner game that had built a streak — having a streak was a DISADVANTAGE.
//    In a real run that ranked "Number Pop" (1.5 wrong/play, no streak) as
//    #3 strongest while ranking "Position Mission" (1.4 wrong/play, streak 5.7)
//    in hardest. Both lists were "right" by their own formula and together they
//    were nonsense.
//
//    Fix: a zero-streak game now gets the NEUTRAL streak value (the median of
//    the games that do have streaks). It is neither rewarded nor punished for
//    the missing data, and the two lists finally agree — a game with more
//    mistakes than another can never rank above it in strongest.
//
// 2. OUTLIER RESISTANCE — a single huge streak must not flatten everyone else.
//
//    Min-max scaling maps the maximum to 1.0 and everything else toward 0, so one
//    game with a streak of 46.7 drove every other game's streak component to
//    ~0.03. That is not measurement, it is a wrecking ball. Scores are now
//    derived from an EMPIRICAL PERCENTILE (the share of games beaten, ties
//    averaged), which is bounded, needs no distribution assumptions, and is not
//    dominated by an extreme value.
//
// Both properties are asserted in studentRankings.test.js.

// How many games each list shows.
export const TOP_N = 3;

function round4(n) {
  return Math.round(n * 10_000) / 10_000;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Empirical percentile of `value` within `all`, in 0..1.
//
// 0 = worse than (or equal to) every other game, 1 = better than every other.
// Ties average, so two identical games get the same number instead of being
// ordered by array position. `higherIsBetter` flips the comparison for metrics
// where smaller values are the good ones (mistakes).
function percentileOf(value, all, higherIsBetter) {
  if (all.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const other of all) {
    if (other === value) equal += 1;
    else if (higherIsBetter ? other < value : other > value) below += 1;
  }
  // Half credit for ties, over the number of OTHER games.
  return (below + (equal - 1) / 2) / (all.length - 1);
}

// Builds the scored view of every game once, so favourite/strongest/hardest all
// share one scoring pass over the SAME distributions. Scoring each list against
// its own subset would silently rescale the numbers between lists.
export function scoreGames(perGame = []) {
  const games = (Array.isArray(perGame) ? perGame : []).filter(
    (g) => g && g.game && (g.plays ?? 0) > 0
  );
  if (games.length === 0) return [];

  const mistakes = games.map((g) => g.avgMistakes ?? 0);
  const streaks = games.map((g) => g.avgStreak ?? 0);
  const streaksWithSignal = streaks.filter((s) => s > 0);

  // INVARIANT 1: the streak value a no-streak game receives. The median of the
  // games that DO have streaks — neutral by construction, and undefined-safe
  // (0 when nobody has a streak, which then makes every game's streak score 0.5
  // and leaves the ranking entirely to mistakes, which is correct).
  const neutralStreak = streaksWithSignal.length ? median(streaksWithSignal) : 0;

  return games.map((g) => {
    const avgMistakes = g.avgMistakes ?? 0;
    const avgStreak = g.avgStreak ?? 0;
    const hasStreak = avgStreak > 0;

    // Fewer mistakes ⇒ higher score.
    const mistakeScore = percentileOf(avgMistakes, mistakes, false);

    // Longer streak ⇒ higher score. A no-streak game stands in the neutral value
    // so it is judged on mistakes alone WITHOUT gaining an edge (INVARIANT 1).
    const streakBasis = hasStreak ? avgStreak : neutralStreak;
    const streakDistribution = streaksWithSignal.length
      ? [...streaksWithSignal, neutralStreak]
      : [neutralStreak];
    const streakScore = percentileOf(streakBasis, streakDistribution, true);

    // ONE mastery score. Strongest is the TOP of this axis, hardest the BOTTOM —
    // see the note on `strongestGames`/`hardestGames` for why that single axis is
    // what makes the two panels incapable of contradicting each other.
    const mastery = 0.5 * mistakeScore + 0.5 * streakScore;

    return {
      ...g,
      plays: g.plays ?? 0,
      avgMistakes,
      avgStreak,
      hasStreak,
      mistakeScore: round4(mistakeScore),
      streakScore: round4(streakScore),
      mastery: round4(mastery),
      // Kept as named aliases so callers/tests can talk about each list directly.
      strongestScore: round4(mastery),
      hardestScore: round4(1 - mastery),
    };
  });
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

// THE TWO LISTS ARE ONE RANKING, SPLIT AT BOTH ENDS.
//
// Why this shape, rather than scoring each list independently:
//
//   Scoring them independently let a game appear in BOTH lists. A percentile
//   property check over 500 random rosters produced a contradiction in 359 of
//   them — e.g. one game ranked #3 strongest AND #1 hardest simultaneously,
//   while another game with more mistakes sat in strongest. Both panels were
//   "correct" by their own formula, which is precisely the problem: a teacher
//   reads the two cards as one statement about the child.
//
//   A single `mastery` axis (mistakes + streak, 0..1) makes contradiction
//   impossible: strongest is the head of the ranking, hardest the tail, and the
//   two sets are disjoint by construction. It also matches how the cards are
//   read — "these are the games they're best at" / "these are the ones they
//   struggle with".
//
// Eligibility differs, per the product rules:
//   • strongest accepts every game. A no-streak game is eligible and judged on
//     mistakes alone, with neutral streak credit so it gains no edge.
//   • hardest excludes no-streak games ("0 streak games to be ignored").

// The full ranked axis, best game first.
//
// ORDER IS ACCURACY FIRST, STREAK SECOND. That is a deliberate choice, and it is
// what makes the two cards provably consistent rather than merely plausible:
//
//   A composite score (mistakes + streak) let a game with MORE mistakes outrank
//   a game with fewer, because a long streak could outweigh them. That is
//   defensible in isolation, but it broke the reading a teacher actually makes
//   across the two cards — "the games here are cleaner than the games there".
//   A real report: Number Pop (1.5 wrong/play) sat in strongest while Position
//   Mission (1.4 wrong/play) sat in hardest.
//
//   Sorting by mistakes and using streak as the TIE-BREAK means mistakes are
//   monotonic along the axis, so strongest (the head) and hardest (the tail) can
//   never invert: every game in strongest has <= the mistakes of every game in
//   hardest. Streak still decides between games of equal accuracy, which is the
//   case where it is genuinely the deciding evidence.
//
// Rounding mistakes to 2dp before comparing keeps floating-point noise from
// ordering two games that are equal in reality (1.4000000000001 vs 1.4).
function byAccuracyThenStreak(a, b) {
  const am = Math.round(a.avgMistakes * 100);
  const bm = Math.round(b.avgMistakes * 100);
  if (am !== bm) return am - bm; // fewer mistakes first
  if (a.streakScore !== b.streakScore) return b.streakScore - a.streakScore; // longer streak first
  if (b.plays !== a.plays) return b.plays - a.plays; // stronger evidence first
  return String(a.game).localeCompare(String(b.game)); // stable
}

export function rankByMastery(perGame = []) {
  return [...scoreGames(perGame)].sort(byAccuracyThenStreak);
}

// How many of the weakest games the hardest list may take.
//
// Once the roster is big enough to fill both cards (6+ games for two top-3
// lists) the full `limit` is used. Below that the two cards must SHARE games,
// so hardest is capped at half the roster — that keeps the split honest without
// emptying the card: with 3 games it takes 1, with 5 it takes 2.
//
// The cap is on how many the TAIL may claim, not on how many games are
// eligible, so excluding a no-streak game never removes a slot from a game that
// qualifies.
function hardestCapacity(ranked, limit) {
  if (ranked.length >= limit * 2) return limit;
  return Math.max(1, Math.min(limit, Math.floor(ranked.length / 2)));
}

// Top 3 cleanest games — the HEAD of the ranking.
//
// Two filters, both there to stop the cards contradicting each other:
//
//  1. Anything `hardestGames` claims is excluded, so a game is never presented
//     as both a strength and a struggle.
//  2. Anything with MORE mistakes than the hardest game on show is excluded,
//     even if it is not itself in that list. This closes the last gap: a game
//     with no streak is ineligible for "hardest" (per the product rule), so
//     without this it could sit in strongest purely because it was excluded
//     elsewhere — e.g. a 3.6-wrong game labelled a strength next to a 2.1-wrong
//     game labelled a struggle. A game worse than the hardest one shown is not a
//     strength, whatever its eligibility.
export function strongestGames(perGame = [], limit = TOP_N) {
  const ranked = rankByMastery(perGame);
  if (ranked.length === 0) return [];

  const hardest = hardestGames(perGame, limit);
  const claimedByHardest = new Set(hardest.map((g) => g.game));

  // The accuracy ceiling for "a strength".
  //
  // Two sources, and the STRICTER wins:
  //   • the worst game shown in hardest — a game no cleaner than a listed
  //     struggle is not a strength;
  //   • the median of the child's own accuracy — anything in the worse half is
  //     not a strength, EVEN IF it is not in hardest (e.g. a no-streak game
  //     excluded by the "0 streak games are ignored" rule would otherwise fall
  //     back into strongest purely by being ineligible elsewhere).
  //
  // Using the median here too is what makes this symmetric with hardestGames and
  // closes the last inversion the random-roster check found.
  const sortedMistakes = ranked.map((g) => g.avgMistakes).sort((a, b) => a - b);
  const mid = Math.floor(sortedMistakes.length / 2);
  const median =
    sortedMistakes.length % 2
      ? sortedMistakes[mid]
      : (sortedMistakes[mid - 1] + sortedMistakes[mid]) / 2;
  let ceiling = Math.round(median * 100);
  if (hardest.length) {
    ceiling = Math.min(ceiling, Math.round(hardest[0].avgMistakes * 100));
  }

  return ranked
    .filter((g) => !claimedByHardest.has(g.game))
    .filter((g) => Math.round(g.avgMistakes * 100) <= ceiling)
    .slice(0, limit);
}

// Top 3 hardest games — the TAIL of the same ranking.
//
// Games with no streak are EXCLUDED, as specified: "most amount of mistake and
// least amount of streaks. 0 streak games to be ignored." With fewer than two
// eligible games there is no meaningful "hardest", so the list is empty rather
// than repeating the sole game.
export function hardestGames(perGame = [], limit = TOP_N) {
  const ranked = rankByMastery(perGame);
  if (ranked.length === 0) return [];

  const capacity = hardestCapacity(ranked, limit);

  // INVARIANT 3: only games at or below the MEDIAN accuracy may be called hard.
  //
  // Without this gate a child whose only streaked game was also their cleanest
  // had that game listed as "hardest" — it was eligible, and it was all that was
  // left. The median is the natural boundary: a game in the better half of this
  // child's own history is not one they struggle with.
  const sortedMistakes = ranked.map((g) => g.avgMistakes).sort((a, b) => a - b);
  const mid = Math.floor(sortedMistakes.length / 2);
  const median =
    sortedMistakes.length % 2
      ? sortedMistakes[mid]
      : (sortedMistakes[mid - 1] + sortedMistakes[mid]) / 2;
  const medianKey = Math.round(median * 100);

  return ranked
    .filter((g) => g.avgStreak > 0) // "0 streak games are to be ignored"
    .filter((g) => Math.round(g.avgMistakes * 100) >= medianKey) // INVARIANT 3
    .slice(-capacity) // ranked best→worst, so the end is the hardest
    .reverse(); // present hardest first
}
