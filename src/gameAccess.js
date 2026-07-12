// Which games are unlocked for everyone right now. Add a game's number
// here to open it up (e.g. [1, 2] opens Week 1 and Week 2, keeping
// Week 3 showing "Coming soon" until you add 3 too).
//
// Teachers always see every game regardless of this list — entering a
// valid teacher code overrides it completely.
export const UNLOCKED_GAMES = [1];

export function isGameUnlocked(gameNumber, isTeacher) {
  return Boolean(isTeacher) || UNLOCKED_GAMES.includes(gameNumber);
}
