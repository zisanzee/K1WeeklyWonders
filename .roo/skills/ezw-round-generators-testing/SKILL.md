---
name: ezw-round-generators-testing
description: Use when writing or changing a game's levels.js / round generator (LEVELS, buildRounds, progress) or any pure logic in EZ Wonders, and when adding Vitest tests - random round generation, difficulty ramps, answer/distractor generation, mergeRows, nextScheduledGame, formatUnlockCountdown.
---

# Round generators + Vitest

Game logic that decides *what the child sees and what is correct* must be pure, deterministic-testable code in `levels.js` (or `rounds.js`), separate from Phaser. This is the cheapest place to get quality: bugs here ship wrong answers to kids.

## Structure
- `levels.js` exports `LEVELS` (difficulty config), `buildRounds(...)` (returns an array of round objects), and `progress` helpers. No imports from Phaser, DOM, React or the stores.
- Pure round/curriculum logic belongs here, NOT in `tuning.js` (visual/timing numbers) and NOT in the scene.
- A round object should contain everything the scene needs: the prompt/quantity, the correct answer, distractors, layout seed/arrangement id. The scene never recomputes correctness.

## Randomness
- Accept an injectable RNG (`rng = Math.random`) or a seed so tests are reproducible. Avoid calling `Math.random()` inside deeply nested helpers.
- Avoid immediate repeats (same answer twice in a row) and ensure variety in arrangement across a run.
- Shuffle with Fisher-Yates, not `sort(() => Math.random() - 0.5)`.

## Invariants to test (write these as Vitest tests)
For every level, over many seeds/iterations (e.g. 200 runs):
1. The correct answer is always present among the options exactly once.
2. Distractors are unique, within the allowed number range, and never equal the answer.
3. Quantities stay within the level's min/max; objects fit the layout capacity.
4. The run has the expected number of rounds and difficulty never decreases unexpectedly.
5. No two consecutive rounds are identical (when the range allows it).
6. `buildRounds` never throws for any valid level and returns plain serializable data.
Also test edge ranges (smallest and largest level).

## Vitest conventions
- Runner: Vitest via `npm test` (`vitest run`). Existing example: `src/games/levels.test.js`; read it and follow its style and file placement (`*.test.js` next to the code).
- Test pure functions only: `mergeRows`, `nextScheduledGame`, `formatUnlockCountdown`, round generators, device fingerprint. There is no DOM/E2E suite; do not add one.
- Mock nothing from Phaser; if you need to, the logic is not pure enough yet.
- **Known environment issue:** `npm test` may fail for ALL suites for an unrelated Vitest runner reason in this environment. If every suite fails identically (including untouched ones), report it as environmental and keep tests correct anyway; rely on lint + build locally. Do not rewrite unrelated code to "fix" it.

## Workflow
1. Write the round shape and 2-3 failing invariant tests.
2. Implement `buildRounds` until tests pass.
3. Only then hook it into the scene.
4. When tuning difficulty, change `LEVELS` data, not scene code.
