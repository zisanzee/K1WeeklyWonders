import { describe, it, expect } from 'vitest';
import {
  TOTAL_ROUNDS,
  SPEED_STEP,
  DELAY_STEP,
  MIN_DELAY,
  roundSpeed,
  roundDelay,
  obstacleLaneIndex,
  buildRoundPlan,
  starsForMistakes,
} from '@/games/game-13/rounds';

describe('game-13 rounds — difficulty curve', () => {
  it('round 1 uses the base speed and every later round is strictly faster', () => {
    expect(roundSpeed(400, 1)).toBe(400);
    for (let r = 2; r <= TOTAL_ROUNDS; r += 1) {
      expect(roundSpeed(400, r)).toBeGreaterThan(roundSpeed(400, r - 1));
    }
    expect(roundSpeed(400, 3)).toBe(400 + 2 * SPEED_STEP);
  });

  it('the prompt→obstacle delay shrinks each round but never below the floor', () => {
    expect(roundDelay(1000, 1)).toBe(1000);
    expect(roundDelay(1000, 2)).toBe(1000 - DELAY_STEP);
    // Late rounds clamp to MIN_DELAY rather than going to zero or negative.
    expect(roundDelay(1000, TOTAL_ROUNDS)).toBe(MIN_DELAY);
    for (let r = 1; r <= TOTAL_ROUNDS; r += 1) {
      expect(roundDelay(1000, r)).toBeGreaterThanOrEqual(MIN_DELAY);
    }
  });
});

describe('game-13 rounds — prompt/obstacle pairing', () => {
  it('plants the obstacle in the lane OPPOSITE the spoken direction', () => {
    // "Left" → obstacle on the right lane; "Right" → obstacle on the left lane.
    expect(obstacleLaneIndex('left', 2)).toBe(1);
    expect(obstacleLaneIndex('right', 2)).toBe(0);
  });
});

describe('game-13 rounds — plan', () => {
  it('produces one step per round with a matching obstacle lane', () => {
    // Deterministic rand so the plan is stable for the assertion.
    let i = 0;
    const rand = () => [0.2, 0.8][i++ % 2];
    const plan = buildRoundPlan(2, rand);
    expect(plan).toHaveLength(TOTAL_ROUNDS);
    plan.forEach((step, idx) => {
      expect(step.round).toBe(idx + 1);
      expect(['left', 'right']).toContain(step.direction);
      expect(step.obstacleLane).toBe(
        step.direction === 'left' ? 1 : 0
      );
    });
  });

  it('splits the rounds as evenly as the count allows', () => {
    // Sweep many random seeds — the balance must hold regardless of draw order.
    // The split is floor(n/2) left + the rest right, so it stays valid for an
    // odd round count (e.g. 15 → 7 left / 8 right).
    const expectedLeft = Math.floor(TOTAL_ROUNDS / 2);
    for (let seed = 0; seed < 50; seed += 1) {
      let n = seed;
      const rand = () => {
        n = (n * 1103515245 + 12345) % 2147483648;
        return n / 2147483648;
      };
      const plan = buildRoundPlan(2, rand);
      const left = plan.filter((s) => s.direction === 'left').length;
      expect(left).toBe(expectedLeft);
    }
  });

  it('never repeats a direction three times in a row', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      let n = seed * 7 + 3;
      const rand = () => {
        n = (n * 1103515245 + 12345) % 2147483648;
        return n / 2147483648;
      };
      const plan = buildRoundPlan(2, rand);
      for (let i = 2; i < plan.length; i += 1) {
        const a = plan[i - 2].direction;
        const b = plan[i - 1].direction;
        const c = plan[i].direction;
        expect(a === b && b === c).toBe(false);
      }
    }
  });
});

describe('game-13 rounds — stars', () => {
  it('awards 3 stars for a clean run and fewer as bumps accumulate', () => {
    expect(starsForMistakes(0)).toBe(3);
    expect(starsForMistakes(2)).toBe(2);
    expect(starsForMistakes(5)).toBe(1);
  });
});
