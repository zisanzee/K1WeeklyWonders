// levels.js
// Grocery Run! — level / round / list curriculum. PURE: no Phaser, no DOM, no
// stores,
// so the whole "which product is the answer" decision is unit-testable. The scene
// never recomputes correctness; it only asks "is this product the prompt's target?".
//
// HIERARCHY
//   PROMPT = one instruction ("third from the left"), naming one shelf slot.
//   LIST   = 3 prompts, all counted from the SAME side. One line-up, one cart.
//   ROUND  = 2 lists, both counted from the round's OWN direction.
//   LEVEL  = 4 rounds: 2 counted from the left, 2 from the right.
//
// A round therefore holds 2 x 3 = 6 prompts of one direction. Directions
// ALTERNATE between rounds (left → right → left → right), which is what makes
// the side-switch transition meaningful instead of happening every few taps.
//
// Prompts resolve against a round's ORIGINAL line-up, not what is left on the
// shelf, so a prompt stays answerable after earlier products have been carried
// to the cart.

// How many products the shelf holds per level, plus the structural counts.
// Everything the scene and tests need about difficulty lives here, not in
// tuning.js (which is for visual/timing numbers only).
export const LEVELS = [
  {
    id: 1,
    products: 5,
    rounds: 4,
    listsPerRound: 2,
    promptsPerList: 3,
  },
  {
    id: 2,
    products: 10,
    rounds: 4,
    listsPerRound: 2,
    promptsPerList: 3,
  },
];

// How many rounds of a level count from each side. With 4 rounds this is 2 + 2.
export const ROUNDS_PER_DIRECTION = 2;

// The spelled ordinals used in prompts, indexed by position - 1. Covers the
// largest level (10 products).
export const ORDINAL_WORDS = [
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

// "3" → "third". Returns '' for out-of-range positions rather than throwing, so
// a bad caller degrades instead of crashing a scene.
export function ordinalWord(position) {
  return ORDINAL_WORDS[position - 1] || '';
}

// The other counting side.
export function oppositeDirection(direction) {
  return direction === 'left' ? 'right' : 'left';
}

// Fisher-Yates on a copy, driven by the injected rng so tests are reproducible.
function shuffled(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Which shelf slot a prompt points at.
//
//   direction 'left'  → counted from the left edge,  so position 1 is slot 0
//   direction 'right' → counted from the right edge, so position 1 is the LAST
//
// `products` is the full slot count of the level, NOT the number still on the
// shelf: positions are fixed by the original line-up.
export function targetIndexFor(position, direction, products) {
  return direction === 'left' ? position - 1 : products - position;
}

// Builds ONE LIST: `count` prompts that all count from `direction`, over
// `products` slots, each targeting a DISTINCT slot.
//
// Distinct targets is the important invariant: two prompts naming the same
// product would ask the child to put the same item in the cart twice, which is
// impossible once the first has been taken.
export function buildList(products, count, direction, rng = Math.random) {
  // Shuffle the slot indexes and take the first `count`, so the targets are
  // guaranteed unique without any retry loop.
  const slots = shuffled(
    Array.from({ length: products }, (_, i) => i),
    rng
  ).slice(0, count);

  return slots.map((slotIndex) => {
    // The 1-based position in that direction which resolves to this slot.
    const position = direction === 'left' ? slotIndex + 1 : products - slotIndex;
    return {
      slotIndex,
      direction,
      position,
      ordinal: ordinalWord(position),
    };
  });
}

// Builds one round: a fresh shuffled line-up plus `listsPerRound` lists, all
// counting from the round's `direction`.
//
// `artCount` is how many product images exist. A level whose shelf is larger than
// the art cycles through the images, and the line-up is shuffled so the same
// product is not always in the same position.
export function buildRound(level, roundIndex, direction, artCount, rng = Math.random) {
  const base = Array.from({ length: level.products }, (_, i) =>
    artCount > 0 ? i % artCount : 0
  );
  const lineup = shuffled(base, rng);

  return {
    levelId: level.id,
    roundIndex,
    direction,
    products: level.products,
    lineup,
    lists: Array.from({ length: level.listsPerRound }, () =>
      buildList(level.products, level.promptsPerList, direction, rng)
    ),
  };
}

// The direction of each round in a level, ALTERNATING so the two sides are split
// evenly (2 + 2 for a 4-round level) and the side changes as often as the counts
// allow — which is exactly when the scene should transition.
//
// Deterministic rather than shuffled on purpose: a shuffle can produce
// left,left,right,right, which gives a single direction change in an entire level
// and makes the side-switch transition almost pointless.
export function buildRoundDirectionPlan(rounds) {
  return Array.from({ length: rounds }, (_, i) => (i % 2 === 0 ? 'left' : 'right'));
}

// Builds every round of a level.
export function buildLevelRounds(level, artCount, rng = Math.random) {
  const plan = buildRoundDirectionPlan(level.rounds);
  return plan.map((direction, i) => buildRound(level, i, direction, artCount, rng));
}

// Total lists across every level — the unit a child actually completes.
export const TOTAL_LISTS = LEVELS.reduce(
  (sum, level) => sum + level.rounds * level.listsPerRound,
  0
);

// Total rounds across every level — used for the completion event, derived
// rather than hardcoded.
export const TOTAL_ROUNDS = LEVELS.reduce((sum, level) => sum + level.rounds, 0);

// Looks a level up by id, falling back to the first so a bad index cannot crash
// the scene mid-run.
export function levelById(id) {
  return LEVELS.find((level) => level.id === id) || LEVELS[0];
}
