// milestones.js
// Pure helper: which "round number" milestones has the couple already passed?
//
// The MILESTONES list itself lives in ./config.js (the one editable file); this
// module just re-exports it and provides the SELECTOR. PAST ONLY, like the rest
// of the page — nothing here counts toward a future date. A milestone appears
// the moment it is reached, so opening the page on the right day shows a new chip.

import { MILESTONES } from './config';

export { MILESTONES };

// `a` is the object returned by getAnniversary(). Returns the achieved subset.
export function achievedMilestones(a) {
  return MILESTONES.filter((m) => Number(a?.[m.field]) >= m.at);
}
