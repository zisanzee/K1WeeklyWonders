import { describe, it, expect } from 'vitest';
import {
  TOTAL_ROUNDS,
  OPTION_COUNT,
  MAX_TARGET,
  starsForMistakes,
  difficultyForRound,
  buildRoundPlan,
} from '@/games/game-14/rounds';

// Deterministic pseudo-random so the plan is stable for assertions.
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe('game-14 rounds — star rating', () => {
  it('awards 3 stars for a clean run and drops with misses', () => {
    expect(starsForMistakes(0)).toBe(3);
    expect(starsForMistakes(1)).toBe(2);
    expect(starsForMistakes(2)).toBe(2);
    expect(starsForMistakes(3)).toBe(1);
  });
});

describe('game-14 rounds — difficulty curve', () => {
  it('runs from 0 on round 1 to 1 on the final round', () => {
    expect(difficultyForRound(1)).toBe(0);
    expect(difficultyForRound(TOTAL_ROUNDS)).toBe(1);
  });

  it('clamps out-of-range rounds and never returns NaN', () => {
    expect(difficultyForRound(-5)).toBe(0);
    expect(difficultyForRound(999)).toBe(1);
    expect(difficultyForRound(1, 1)).toBe(0);
  });
});

describe('game-14 rounds — plan', () => {
  it('produces one step per round, each with the target among its options', () => {
    const plan = buildRoundPlan(seededRand(42));
    expect(plan).toHaveLength(TOTAL_ROUNDS);
    plan.forEach((step, idx) => {
      expect(step.round).toBe(idx + 1);
      expect(step.options).toContain(step.target);
      expect(step.options[step.answerIndex]).toBe(step.target);
      expect(step.options).toHaveLength(OPTION_COUNT);
    });
  });

  it('keeps every target and option within [1, MAX_TARGET]', () => {
    const plan = buildRoundPlan(seededRand(7));
    plan.forEach((step) => {
      expect(step.target).toBeGreaterThanOrEqual(1);
      expect(step.target).toBeLessThanOrEqual(MAX_TARGET);
      step.options.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(MAX_TARGET);
      });
    });
  });

  it('never repeats an option value within a round', () => {
    const plan = buildRoundPlan(seededRand(123));
    plan.forEach((step) => {
      expect(new Set(step.options).size).toBe(step.options.length);
    });
  });
});
