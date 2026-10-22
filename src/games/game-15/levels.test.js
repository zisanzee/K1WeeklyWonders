import { describe, it, expect } from 'vitest';
import {
  LEVELS,
  ROUNDS_PER_DIRECTION,
  ORDINAL_WORDS,
  ordinalWord,
  oppositeDirection,
  targetIndexFor,
  buildList,
  buildRound,
  buildRoundDirectionPlan,
  buildLevelRounds,
  TOTAL_LISTS,
  TOTAL_ROUNDS,
  levelById,
} from '@/games/game-15/levels';

const RUNS = 200;
const ART = 10;

// These generators decide what a child is asked to do, and a wrong answer here is
// invisible in review but very visible to a five-year-old. Everything is asserted
// over many runs rather than once, because the output is random.

describe('game-15 levels — shape', () => {
  it('has two levels: 5 products then 10', () => {
    expect(LEVELS).toHaveLength(2);
    expect(LEVELS[0].products).toBe(5);
    expect(LEVELS[1].products).toBe(10);
  });

  it('builds each level from 4 rounds of 2 lists of 3 prompts', () => {
    for (const level of LEVELS) {
      expect(level.rounds).toBe(4);
      expect(level.listsPerRound).toBe(2);
      expect(level.promptsPerList).toBe(3);
      expect(level.rounds).toBe(ROUNDS_PER_DIRECTION * 2);
    }
  });

  it('never asks for more prompts in a list than there are products', () => {
    for (const level of LEVELS) {
      expect(level.promptsPerList).toBeLessThanOrEqual(level.products);
    }
  });

  it('derives TOTAL_ROUNDS and TOTAL_LISTS from the level definitions', () => {
    expect(TOTAL_ROUNDS).toBe(LEVELS.reduce((s, l) => s + l.rounds, 0));
    expect(TOTAL_LISTS).toBe(LEVELS.reduce((s, l) => s + l.rounds * l.listsPerRound, 0));
  });

  it('looks a level up by id, falling back safely', () => {
    expect(levelById(2).products).toBe(10);
    expect(levelById(999).id).toBe(LEVELS[0].id);
  });
});

describe('game-15 levels — ordinals', () => {
  it('spells the ordinals the prompts use', () => {
    expect(ordinalWord(1)).toBe('first');
    expect(ordinalWord(3)).toBe('third');
    expect(ordinalWord(10)).toBe('tenth');
  });

  it('covers every position the largest level can ask about', () => {
    const largest = Math.max(...LEVELS.map((l) => l.products));
    expect(ORDINAL_WORDS.length).toBeGreaterThanOrEqual(largest);
  });

  it('degrades to an empty string out of range instead of throwing', () => {
    expect(ordinalWord(0)).toBe('');
    expect(ordinalWord(11)).toBe('');
  });

  it('knows the opposite direction', () => {
    expect(oppositeDirection('left')).toBe('right');
    expect(oppositeDirection('right')).toBe('left');
  });
});

describe('game-15 levels — targetIndexFor', () => {
  it('counts from the left edge for "left"', () => {
    expect(targetIndexFor(1, 'left', 5)).toBe(0);
    expect(targetIndexFor(5, 'left', 5)).toBe(4);
  });

  it('counts from the right edge for "right"', () => {
    expect(targetIndexFor(1, 'right', 5)).toBe(4);
    expect(targetIndexFor(5, 'right', 5)).toBe(0);
  });

  it('resolves to a real slot for every position in both directions', () => {
    for (const level of LEVELS) {
      for (let p = 1; p <= level.products; p += 1) {
        for (const dir of ['left', 'right']) {
          const idx = targetIndexFor(p, dir, level.products);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(level.products);
        }
      }
    }
  });
});

describe('game-15 levels — buildList', () => {
  it('builds the requested number of prompts', () => {
    for (const level of LEVELS) {
      expect(buildList(level.products, 3, 'left')).toHaveLength(3);
    }
  });

  it('never targets the same product twice within a list', () => {
    for (const level of LEVELS) {
      for (let run = 0; run < RUNS; run += 1) {
        for (const dir of ['left', 'right']) {
          const prompts = buildList(level.products, 3, dir);
          expect(new Set(prompts.map((p) => p.slotIndex)).size).toBe(prompts.length);
        }
      }
    }
  });

  it('uses ONE direction for every prompt in the list', () => {
    for (const dir of ['left', 'right']) {
      for (let run = 0; run < RUNS; run += 1) {
        for (const p of buildList(10, 3, dir)) {
          expect(p.direction).toBe(dir);
        }
      }
    }
  });

  it('agrees with targetIndexFor, and spells a matching ordinal', () => {
    for (const level of LEVELS) {
      for (let run = 0; run < RUNS; run += 1) {
        for (const dir of ['left', 'right']) {
          for (const p of buildList(level.products, 3, dir)) {
            expect(targetIndexFor(p.position, p.direction, level.products)).toBe(
              p.slotIndex
            );
            expect(p.ordinal).toBe(ordinalWord(p.position));
            expect(p.ordinal).toBeTruthy();
          }
        }
      }
    }
  });
});

describe('game-15 levels — round direction plan', () => {
  it('splits the rounds evenly between the two sides', () => {
    for (let run = 0; run < 50; run += 1) {
      for (const level of LEVELS) {
        const plan = buildRoundDirectionPlan(level.rounds);
        expect(plan.filter((d) => d === 'left')).toHaveLength(ROUNDS_PER_DIRECTION);
        expect(plan.filter((d) => d === 'right')).toHaveLength(ROUNDS_PER_DIRECTION);
      }
    }
  });

  it('ALTERNATES, so every round changes side', () => {
    // The transition is tied to the side changing, so a plan that clustered the
    // sides together (left,left,right,right) would waste it.
    const plan = buildRoundDirectionPlan(4);
    expect(plan).toEqual(['left', 'right', 'left', 'right']);
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i]).not.toBe(plan[i - 1]);
    }
  });
});

describe('game-15 levels — buildRound / buildLevelRounds', () => {
  it('gives the round a line-up of the level size and 2 lists', () => {
    for (const level of LEVELS) {
      for (let run = 0; run < 40; run += 1) {
        const round = buildRound(level, 0, 'left', ART);
        expect(round.lineup).toHaveLength(level.products);
        expect(round.lists).toHaveLength(level.listsPerRound);
        for (const list of round.lists) {
          expect(list).toHaveLength(level.promptsPerList);
        }
      }
    }
  });

  it('makes every list in a round use the round’s direction', () => {
    for (const level of LEVELS) {
      for (let run = 0; run < 40; run += 1) {
        for (const dir of ['left', 'right']) {
          const round = buildRound(level, 0, dir, ART);
          expect(round.direction).toBe(dir);
          for (const list of round.lists) {
            for (const p of list) expect(p.direction).toBe(dir);
          }
        }
      }
    }
  });

  it('cycles the art when the shelf is larger than the art list', () => {
    const round = buildRound(levelById(2), 0, 'left', 4);
    for (const art of round.lineup) {
      expect(art).toBeGreaterThanOrEqual(0);
      expect(art).toBeLessThan(4);
    }
  });

  it('survives an empty art list without throwing', () => {
    const round = buildRound(levelById(1), 0, 'left', 0);
    expect(round.lineup).toHaveLength(5);
    expect(round.lineup.every((a) => a === 0)).toBe(true);
  });

  it('tags every level round with its direction, alternating', () => {
    for (const level of LEVELS) {
      const rounds = buildLevelRounds(level, ART);
      expect(rounds).toHaveLength(level.rounds);
      expect(rounds.map((r) => r.direction)).toEqual([
        'left',
        'right',
        'left',
        'right',
      ]);
    }
  });

  it('returns plain serialisable data', () => {
    for (const level of LEVELS) {
      for (const round of buildLevelRounds(level, ART)) {
        expect(() => structuredClone(round)).not.toThrow();
      }
    }
  });

  it('never throws for any level over many runs', () => {
    for (const level of LEVELS) {
      for (let run = 0; run < 40; run += 1) {
        expect(() => buildLevelRounds(level, ART)).not.toThrow();
      }
    }
  });

  it('varies the line-up order between rounds', () => {
    const orders = new Set();
    for (let run = 0; run < 30; run += 1) {
      orders.add(buildRound(levelById(2), 0, 'left', ART).lineup.join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});
