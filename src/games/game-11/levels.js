// levels.js
// Game 11 — round curriculum.
//
// Pure data (Phaser-free) so it can be unit-tested. One round per portrait:
// the child rebuilds the portrait's mirrored duplicate by dragging each part
// into place. The order follows PORTRAIT_ORDER, so adding a portrait there
// adds a round here automatically.
import { PORTRAIT_ORDER, portraitName } from '@/games/game-11/portraits';

export const TOTAL_ROUNDS = PORTRAIT_ORDER.length;

// `portrait`   which portrait this round builds (its index into the tuning file)
// `name`       the portrait's display name (heading + instruction)
// `prompt`     the instruction line shown under the heading
export const ROUND_SCRIPT = PORTRAIT_ORDER.map((portrait) => ({
  portrait,
  name: portraitName(portrait),
  prompt: `Build the ${portraitName(portrait)}!`,
}));
