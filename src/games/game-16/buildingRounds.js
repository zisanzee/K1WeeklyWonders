// buildingRounds.js
// Scene 4 ("The Building") — the QUESTIONS, as pure functions.
//
// NO PHASER, NO IMPORTS. Everything here decides WHAT is asked and WHICH animals
// are on offer: the ordinal word for a floor, the prompt sentence, which floors
// the run asks about, and which three animals stand in the option row. Those are
// the numbers that are invisible when wrong — a prompt that says "third" while
// the answer sits on the fourth floor, or a run that asks the same animal twice —
// so they are pinned by tests rather than eyeballed in the browser.
//
// THE ONE IDEA: floors are DISTINCT per run. Asking about the same animal twice
// in five rounds is the failure a child notices ("we did the frog"), and a repeat
// also means the previous answer was still on screen when the next question
// appeared. One distinct floor per round makes that impossible by construction.

// The ordinal words, indexed by floor - 1. Ten rooms, so ten words; `ordinalFor`
// falls back to a numeric form rather than returning undefined if the building
// ever grows.
export const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

// How many animals are offered at once. Three is the target: one right answer and
// two distractors is the smallest set that is still a real choice for a 4-6
// year-old, and it fits across the width of a tablet.
export const OPTION_COUNT = 3;

// The sentence, with the ordinal substituted in. Kept here rather than in the
// scene so the wording and the emphasis marker cannot drift apart.
export const PROMPT_TEMPLATE = 'Which animal is on the {ordinal} floor?';

/**
 * The ordinal word for a 1-based floor number.
 *
 * Falls back to the numeral ("11th") beyond the table, so an eleventh room reads
 * as a number rather than as an empty gap in the prompt.
 */
export function ordinalFor(floor) {
  if (!Number.isInteger(floor) || floor < 1) return '';
  return ORDINALS[floor - 1] || `${floor}th`;
}

/**
 * The prompt for one floor.
 *
 * Returns the SENTENCE and the WORD to emphasise, separately, because Phaser's
 * Text has no inline styling — the scene draws each word as its own object and
 * needs to know which one is the big coloured one.
 *
 * @returns {{text: string, emphasis: string}}
 */
export function promptFor(floor) {
  const ordinal = ordinalFor(floor);
  if (!ordinal) return { text: '', emphasis: '' };
  return {
    text: PROMPT_TEMPLATE.replace('{ordinal}', ordinal),
    emphasis: ordinal,
  };
}

/** A word with case and punctuation stripped, for emphasis matching. */
function bareWord(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Split a prompt into words, flagging the one to emphasise.
 *
 * Punctuation is ignored when matching, so an emphasised word at the end of a
 * sentence ("…on the third?") still matches "third".
 *
 * @returns {{word: string, isEm: boolean}[]}
 */
export function splitPromptWords(text, emphasis) {
  const em = bareWord(emphasis);
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, isEm: !!em && bareWord(word) === em }));
}

/** Fisher–Yates, returning a NEW array. Deterministic for a seeded `random`. */
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The floors this run asks about, one per round.
 *
 * DISTINCT, by shuffling the whole floor list and taking the first `rounds`. That
 * is the only way to get an even spread over the building: picking randomly per
 * round with a uniqueness retry would bias toward the floors drawn early.
 *
 * Capped at the room count — asking about a floor that does not exist is worse
 * than a shorter run — so a building with three rooms yields three questions.
 *
 * @param {number} roomCount  how many floors the building has
 * @param {number} rounds     how many questions the run asks
 * @returns {number[]} 1-based floor numbers, in ask order
 */
export function buildFloorPlan(roomCount, rounds, random = Math.random) {
  const total = Math.max(0, Math.floor(roomCount) || 0);
  const wanted = Math.min(Math.max(0, Math.floor(rounds) || 0), total);
  if (wanted === 0) return [];

  const floors = Array.from({ length: total }, (_, i) => i + 1);
  return shuffle(floors, random).slice(0, wanted);
}

/**
 * The animals to offer, as ARRAY INDICES into the building's room list.
 *
 * Always contains `targetIndex` exactly once, plus `count - 1` distinct others,
 * in shuffled order — so the right answer is not always in the same slot, which
 * is the thing that turns a question into a guessing habit.
 *
 * Returns [] for a target that is not in the building, so a caller can skip
 * rather than build a row with no correct answer in it.
 *
 * @param {number} targetIndex array index of the correct room
 * @param {number} roomCount   how many rooms exist
 * @param {number} count       how many options to show
 * @param {Function} random    injectable RNG, for tests
 * @param {Function} [keyOf]   roomIndex -> the texture key it will DRAW.
 *   Optional, but it makes the row correct rather than merely well-spread: if two
 *   rooms resolve to the same artwork the disc for the answer would show the wrong
 *   animal, and a child would be marked wrong for tapping the picture they were
 *   asked for. Passing this makes the picker skip a distractor that would draw the
 *   same image as the answer.
 *
 *   (This is not hypothetical: `optionDog` and `optionSheep` in assets.js point at
 *   the same Cloudinary file. Until that art is fixed, this keeps the dog's
 *   question answerable.)
 */
export function optionsFor(
  targetIndex,
  roomCount,
  count = OPTION_COUNT,
  random = Math.random,
  keyOf = null
) {
  const total = Math.max(0, Math.floor(roomCount) || 0);
  const wanted = Math.max(1, Math.floor(count) || 1);

  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= total) return [];

  const answerKey = keyOf ? keyOf(targetIndex) : null;

  const others = [];
  for (let i = 0; i < total; i += 1) {
    if (i === targetIndex) continue;
    // A distractor that draws the answer's own picture is not a distractor.
    if (answerKey && keyOf(i) === answerKey) continue;
    others.push(i);
  }

  const picked = shuffle(others, random).slice(0, wanted - 1);
  return shuffle([targetIndex, ...picked], random);
}
