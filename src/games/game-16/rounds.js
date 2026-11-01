// rounds.js
// Scene 1's round content, as pure data + pure functions.
//
// Kept out of the scene so it can be unit tested: what the reel shows, what the
// prompt says, and which shapes count as correct are all invisible in a
// screenshot when wrong.
//
// WHAT A ROUND IS, now:
//   • a CLUE shown on the slot reel — a PROPERTY of a shape, not its name:
//       "3 corners"      → triangle
//       "no corners"     → circle
//       "4 equal sides"  → square
//       "4 corners"      → BOTH the square and the rectangle (final round)
//   • the prompt is generic: "Put the shape on the belt." — so the child has to
//     read the clue rather than match a word to a word.
//   • the last round asks for TWO shapes: "Put 2 shapes on the belt."
//
// WHY CLUES AND NOT NAMES: naming the shape lets a child who can read succeed
// without knowing what a corner is. Describing the shape forces the geometry —
// which is the actual kindergarten objective here.
//
// The shapes are drawn procedurally (see the scene's makeShapeGraphic), so there
// is no art to load and the outline, palette and size are tunable.

import { SCENES } from '@/games/game-16/scenes';

export const SCENE1_ID = 'shapes';

// The four shapes that can appear in the options row. Identity strings, not
// tuning: they key the drawing routine.
export const OPTION_TYPES = ['square', 'triangle', 'rectangle', 'circle'];

// Every option is on screen every round, so the count is derived rather than
// written down twice.
export const OPTIONS_PER_ROUND = OPTION_TYPES.length;

// The palette. Colour is DECORATION, not the answer, so these only need to be
// distinct enough that four shapes in a row read as four separate things.
export const SHAPE_COLOURS = [
  { id: 'red', hex: 0xef4444, name: 'red' },
  { id: 'blue', hex: 0x3b82f6, name: 'blue' },
  { id: 'yellow', hex: 0xfacc15, name: 'yellow' },
  { id: 'green', hex: 0x22c55e, name: 'green' },
];

// THE ROUNDS. Each one is a CLUE plus the shape(s) that satisfy it.
//
// `accepts` is an array because the last round has two valid answers: a square
// and a rectangle both have four corners, so asking for "4 corners" twice is a
// legitimate request for both.
//
// THE LAST ROUND IS FIXED. The first three are SINGLE-SHAPE rounds and their
// order is randomised per run (see buildRounds), because the difficulty is the
// same whichever comes first — a child who knows what a corner is can do all
// three. The two-shape round must stay LAST: it is the harder task and it is the
// one that introduces placing a second shape.
export const SINGLE_ROUNDS = [
  { clue: '3 corners', accepts: ['triangle'] },
  { clue: 'no corners', accepts: ['circle'] },
  { clue: '4 equal sides', accepts: ['square'] },
];

export const FINAL_ROUND = { clue: '4 corners', accepts: ['square', 'rectangle'] };

// The canonical order, used for the reel's lap contents and for the tests. The
// SCENE does not run this order — buildRounds() shuffles the first three.
export const ROUND_PLAN = [...SINGLE_ROUNDS, FINAL_ROUND];

// How many rounds scene 1 runs. Derived from the plan so adding a clue cannot
// leave a stale count behind.
export const SCENE1_ROUNDS = ROUND_PLAN.length;

// The prompt is the SAME every round, deliberately: the clue carries the
// information, and a prompt that also named the shape would give it away.
export const PROMPT_ONE = 'Put the shape on the belt.';
export const PROMPT_TWO = 'Put 2 shapes on the belt.';

/** True when this string is one of the four shapes we can draw. */
export function isOptionType(type) {
  return OPTION_TYPES.includes(type);
}

/**
 * The prompt for a round, from how many shapes it wants.
 *
 * Exported so the SCENE can rebuild the prompt from what the reel actually
 * landed on; the count is the only thing that varies.
 */
export function promptForCount(count) {
  return count > 1 ? PROMPT_TWO : PROMPT_ONE;
}

/**
 * The strip of clues the slot machine spins, and where it must stop.
 *
 * Ending the strip ON the round's clue is the whole point: the child watches the
 * reel land and that is what the round then asks for. Every lap shows all four
 * clues once (shuffled) so none looks favoured while it spins; then the answer is
 * appended, plus one card after it so the box is not half empty at the stop.
 *
 * @returns {{reel: string[], landIndex: number}}
 */
export function buildReel(clue, cycles = 3, random = Math.random) {
  const answer = ROUND_PLAN.some((r) => r.clue === clue) ? clue : ROUND_PLAN[0].clue;
  const laps = Math.max(1, Math.round(Number(cycles) || 1));
  const everyClue = ROUND_PLAN.map((r) => r.clue);

  const reel = [];
  for (let lap = 0; lap < laps; lap += 1) {
    shuffled(everyClue, random).forEach((c) => reel.push(c));
  }

  reel.push(answer);
  const landIndex = reel.length - 1;
  // One trailing card, so the window is never half empty at the stop.
  reel.push(everyClue.find((c) => c !== answer) ?? everyClue[0]);

  return { reel, landIndex };
}

/**
 * Build one round.
 *
 * @param {number} round 0-based round index within scene 1
 *
 * @returns {{
 *   round: number,
 *   clue: string,
 *   accepts: string[],
 *   count: number,
 *   prompt: string,
 *   options: Array<{id, type, colour, hex}>,
 * }}
 */
export function buildRound(round = 0) {
  // Clamped rather than thrown: a dev jump can land past the end, and the scene
  // must still render something playable.
  const index = clamp(round, 0, ROUND_PLAN.length - 1);
  return buildRoundFor(ROUND_PLAN[index], index);
}

/**
 * Every round of scene 1, in the order this run will play them.
 *
 * The first three (single-shape) rounds are SHUFFLED; the two-shape round is
 * pinned last, because it is the harder task and the one that introduces placing
 * a second shape, so it only makes sense once the child has done the simpler
 * version three times.
 *
 * @param {() => number} random injectable RNG, so a test can pin the order
 */
export function buildRounds(random = Math.random) {
  const singles = shuffled(SINGLE_ROUNDS, random);
  return [...singles, FINAL_ROUND].map((plan, i) => ({
    ...buildRoundFor(plan, i),
  }));
}

/** Build one round from a specific plan entry, stamped with its position. */
function buildRoundFor(plan, index) {
  return {
    round: index,
    clue: plan.clue,
    accepts: [...plan.accepts],
    count: plan.accepts.length,
    prompt: promptForCount(plan.accepts.length),
    options: OPTION_TYPES.map((type, i) => ({
      id: `r${index}-o${i}`,
      type,
      colour: SHAPE_COLOURS[i % SHAPE_COLOURS.length].id,
      hex: SHAPE_COLOURS[i % SHAPE_COLOURS.length].hex,
    })),
  };
}

/**
 * Is this shape correct for this round?
 *
 * A shape is accepted if the round lists it AND it is not already on the belt —
 * the last round wants two DIFFERENT four-corner shapes, so dropping a second
 * square (which cannot happen from the tray, but defend anyway) is not a win.
 */
export function isCorrect(round, type, alreadyPlaced = []) {
  if (!round?.accepts?.includes(type)) return false;
  return !alreadyPlaced.includes(type);
}

// ---------------------------------------------------------------------------
// Shared helpers the scene also uses, exported so they can be tested once.
// ---------------------------------------------------------------------------

/** True when the round's options hold all four shapes exactly once. */
export function hasAllOptions(round) {
  const types = new Set(round.options.map((o) => o.type));
  return types.size === OPTION_TYPES.length && OPTION_TYPES.every((t) => types.has(t));
}

/** True when the clue is one the plan actually defines. */
export function isKnownClue(clue) {
  return ROUND_PLAN.some((r) => r.clue === clue);
}

function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Re-exported so callers can talk about the plan without importing scenes.js.
export { SCENES };
