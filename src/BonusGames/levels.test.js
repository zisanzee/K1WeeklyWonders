import { describe, it, expect } from 'vitest';
import { LEVELS, buildRounds, TOTAL_ROUNDS } from './Game 7/levels';
import {
  buildRoundSequence,
  MODES,
  ROUNDS_PER_HALF,
  TOTAL_ROUNDS as GAME8_ROUNDS,
} from './Game 8/levels';

// These generators are the only genuinely complex logic in the games, and
// until now nothing checked that a round was answerable. A generator that can
// emit an impossible bond is invisible in code review and very visible to a
// five-year-old, so each one is asserted over many runs rather than once.

describe('Game 7 — buildRounds (number bonds, fill mode)', () => {
  const RUNS = 60;

  it('emits exactly the number of rounds each level declares', () => {
    for (const level of LEVELS) {
      expect(buildRounds(level)).toHaveLength(level.rounds);
    }
  });

  it('keeps every round solvable within the level range', () => {
    for (const level of LEVELS) {
      const [, max] = level.range;
      for (let run = 0; run < RUNS; run++) {
        for (const round of buildRounds(level)) {
          expect(round.given).toBeGreaterThanOrEqual(1);
          expect(round.target).toBeGreaterThan(round.given);
          expect(round.target).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('never asks the child to fill zero or a negative amount', () => {
    for (const level of LEVELS) {
      for (let run = 0; run < RUNS; run++) {
        for (const round of buildRounds(level)) {
          // given is pre-filled; the answer is target - given.
          expect(round.target - round.given).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('stamps each round with its level format', () => {
    const [numerals, words] = LEVELS.map((level) => buildRounds(level));

    expect(numerals.every((r) => r.format === 'numeral')).toBe(true);
    expect(words.every((r) => r.format === 'spelled')).toBe(true);
  });

  it('derives TOTAL_ROUNDS from the level definitions', () => {
    expect(TOTAL_ROUNDS).toBe(LEVELS.reduce((sum, l) => sum + l.rounds, 0));
  });
});

describe('Game 8 — buildRoundSequence', () => {
  const RUNS = 60;

  it('builds the full run up front', () => {
    expect(buildRoundSequence()).toHaveLength(GAME8_ROUNDS);
  });

  it('splits into two halves of the right modes', () => {
    const rounds = buildRoundSequence();

    expect(rounds.slice(0, ROUNDS_PER_HALF).every((r) => r.mode === MODES.FIRST_HALF)).toBe(true);
    expect(rounds.slice(ROUNDS_PER_HALF).every((r) => r.mode === MODES.SECOND_HALF)).toBe(true);
  });

  it('keeps every total within the 1-10 voice range', () => {
    for (let run = 0; run < RUNS; run++) {
      for (const round of buildRoundSequence()) {
        expect(round.total).toBeGreaterThanOrEqual(2);
        expect(round.total).toBeLessThanOrEqual(10);
      }
    }
  });

  it('always offers three options containing the correct answer', () => {
    for (let run = 0; run < RUNS; run++) {
      for (const round of buildRoundSequence()) {
        const answer = round.mode === MODES.FIRST_HALF ? round.total : round.zeeNeeds;

        expect(round.options).toHaveLength(3);
        expect(new Set(round.options).size).toBe(3); // no duplicate buttons
        expect(round.options).toContain(answer);
        for (const option of round.options) {
          expect(option).toBeGreaterThanOrEqual(1);
          expect(option).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('makes the two halves arithmetically consistent', () => {
    for (let run = 0; run < RUNS; run++) {
      for (const round of buildRoundSequence()) {
        if (round.mode === MODES.FIRST_HALF) {
          expect(round.total).toBe(round.ekaWants + round.zeeWants);
        } else {
          expect(round.total).toBe(round.ekaHas + round.zeeNeeds);
        }
      }
    }
  });

  it('avoids repeating a total within the three-round lookback', () => {
    for (let run = 0; run < RUNS; run++) {
      const rounds = buildRoundSequence();
      for (let i = 3; i < rounds.length; i++) {
        const recent = rounds.slice(i - 3, i).map((r) => r.total);
        // The generator re-rolls up to 200 times to guarantee this; the
        // fallback path is documented as practically unreachable.
        expect(recent).not.toContain(rounds[i].total);
      }
    }
  });
});
