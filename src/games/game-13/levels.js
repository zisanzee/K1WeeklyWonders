// levels.js
// Game 13 — round curriculum.
//
// Pure data (Phaser-free) so it can be unit-tested. One round per entry in
// ROUND_ORDER, so adding an entry there adds a round here automatically. The
// round contents are placeholders until the gameplay brief arrives.
import { ROUND_ORDER, roundName } from '@/games/game-13/portraits';

export const TOTAL_ROUNDS = ROUND_ORDER.length;

// `round`   which round this is (its index into the tuning file)
// `name`    the round's display name (heading)
// `prompt`  the instruction line shown under the heading
export const ROUND_SCRIPT = ROUND_ORDER.map((round) => ({
  round,
  name: roundName(round),
  prompt: `${roundName(round)}`,
}));
