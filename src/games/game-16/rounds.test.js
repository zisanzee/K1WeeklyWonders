import { describe, it, expect } from 'vitest';
import {
  FINAL_ROUND,
  OPTIONS_PER_ROUND,
  OPTION_TYPES,
  ROUND_PLAN,
  SCENE1_ROUNDS,
  SINGLE_ROUNDS,
  buildReel,
  buildRound,
  buildRounds,
  hasAllOptions,
  isCorrect,
  isKnownClue,
  isOptionType,
  promptForCount,
} from '@/games/game-16/rounds';

// The generator decides what a kindergartner is asked to find. A round that shows
// a clue nobody can satisfy, or accepts a wrong shape, is unplayable — and
// invisible in code review. Each guarantee is asserted over many random runs.

const RUNS = 60;

// A seeded RNG, so a failure is reproducible.
//
// The seed is MIXED first, and that matters: an LCG stepped from consecutive
// integers produces almost identical FIRST values (0.2365, 0.2368, 0.2372…), so a
// test that draws once per seed would sample one corner of the space and look like
// a broken shuffle. Multiplying by a large odd constant and xor-folding spreads
// consecutive seeds across the whole range.
function seeded(seed = 1) {
  let s = (seed * 2654435761) ^ 0x9e3779b9;
  s = s >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The round plan
// ---------------------------------------------------------------------------

describe('ROUND_PLAN', () => {
  it('has four rounds, one per clue', () => {
    expect(ROUND_PLAN).toHaveLength(4);
    expect(SCENE1_ROUNDS).toBe(4);
  });

  it('uses the clues the scene is specified to ask', () => {
    // Canonical order — what the PLAN defines, and what the reel's laps show. The
    // order the CHILD sees is shuffled; see buildRounds.
    expect([...SINGLE_ROUNDS, FINAL_ROUND].map((r) => r.clue)).toEqual([
      '3 corners',
      'no corners',
      '4 equal sides',
      '4 corners',
    ]);
    expect(ROUND_PLAN).toHaveLength(4);
  });

  it('accepts only drawable shapes', () => {
    // A clue that accepts a shape we cannot draw is unanswerable.
    for (const round of ROUND_PLAN) {
      for (const type of round.accepts) expect(OPTION_TYPES).toContain(type);
    }
  });

  it('has a single answer for the first three rounds', () => {
    for (const round of ROUND_PLAN.slice(0, 3)) {
      expect(round.accepts).toHaveLength(1);
    }
  });

  it('accepts TWO shapes in the last round, and they differ', () => {
    // "4 corners" is satisfied by a square and a rectangle. Both, and distinct —
    // two squares would not be a pair.
    const last = ROUND_PLAN[3];
    expect(last.accepts).toHaveLength(2);
    expect(new Set(last.accepts).size).toBe(2);
    expect(last.accepts).toContain('square');
    expect(last.accepts).toContain('rectangle');
  });
});

// ---------------------------------------------------------------------------
// buildRound
// ---------------------------------------------------------------------------

describe('buildRound', () => {
  it('stamps the round index and takes its clues from the plan', () => {
    for (let i = 0; i < ROUND_PLAN.length; i += 1) {
      const r = buildRound(i);
      expect(r.round).toBe(i);
      expect(r.clue).toBe(ROUND_PLAN[i].clue);
      expect(r.accepts).toEqual(ROUND_PLAN[i].accepts);
    }
  });

  it('clamps an out-of-range round instead of crashing', () => {
    // A dev jump can land past the end; the scene must still render something.
    expect(buildRound(99).round).toBe(ROUND_PLAN.length - 1);
    expect(buildRound(-5).round).toBe(0);
  });

  it('shows all four options every round', () => {
    for (let i = 0; i < ROUND_PLAN.length; i += 1) {
      const r = buildRound(i);
      expect(r.options).toHaveLength(OPTIONS_PER_ROUND);
      expect(hasAllOptions(r)).toBe(true);
    }
  });

  it('never duplicates an option', () => {
    for (let i = 0; i < ROUND_PLAN.length; i += 1) {
      const types = buildRound(i).options.map((o) => o.type);
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it('gives every option a drawable type and a colour', () => {
    for (const o of buildRound(0).options) {
      expect(OPTION_TYPES).toContain(o.type);
      expect(typeof o.hex).toBe('number');
      expect(typeof o.colour).toBe('string');
    }
  });

  it('asks for one shape, or two in the final round', () => {
    expect(buildRound(0).count).toBe(1);
    expect(buildRound(3).count).toBe(2);
  });

  it('uses the generic prompt — the CLUE carries the question', () => {
    // If the prompt named the shape, a child who can read but cannot count
    // corners would pass without doing the maths.
    expect(buildRound(0).prompt).toBe('Put the shape on the belt.');
    expect(buildRound(3).prompt).toBe('Put 2 shapes on the belt.');
    for (let i = 0; i < ROUND_PLAN.length; i += 1) {
      expect(buildRound(i).prompt.toLowerCase()).toContain('on the belt');
    }
  });
});

describe('promptForCount', () => {
  it('is singular for one and plural for more', () => {
    expect(promptForCount(1)).toBe('Put the shape on the belt.');
    expect(promptForCount(2)).toBe('Put 2 shapes on the belt.');
    expect(promptForCount(0)).toBe('Put the shape on the belt.');
  });
});

// ---------------------------------------------------------------------------
// isCorrect
// ---------------------------------------------------------------------------

describe('isCorrect', () => {
  it('accepts the round’s answer and rejects the others', () => {
    const triangle = buildRound(0);
    expect(isCorrect(triangle, 'triangle')).toBe(true);
    expect(isCorrect(triangle, 'circle')).toBe(false);
    expect(isCorrect(triangle, 'square')).toBe(false);
  });

  it('accepts BOTH four-corner shapes in the final round', () => {
    const last = buildRound(3);
    expect(isCorrect(last, 'square')).toBe(true);
    expect(isCorrect(last, 'rectangle')).toBe(true);
    // …and rejects the two that do not have four corners.
    expect(isCorrect(last, 'circle')).toBe(false);
    expect(isCorrect(last, 'triangle')).toBe(false);
  });

  it('rejects a DUPLICATE once it is already on the belt', () => {
    // The final round wants ONE square and ONE rectangle, not two squares.
    const last = buildRound(3);
    expect(isCorrect(last, 'square', ['square'])).toBe(false);
    expect(isCorrect(last, 'rectangle', ['square'])).toBe(true);
  });

  it('tolerates broken round data rather than throwing', () => {
    expect(isCorrect(null, 'square')).toBe(false);
    expect(isCorrect({}, 'square')).toBe(false);
    expect(isCorrect({ accepts: null }, 'square')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The reel
// ---------------------------------------------------------------------------

describe('buildReel', () => {
  it('LANDS on the round’s clue', () => {
    for (let run = 0; run < RUNS; run += 1) {
      for (const round of ROUND_PLAN) {
        const { reel, landIndex } = buildReel(round.clue, 3, seeded(run + 1));
        expect(reel[landIndex]).toBe(round.clue);
      }
    }
  });

  it('shows every clue in each spun lap', () => {
    // Otherwise a clue looks favoured while it spins, planting a false
    // expectation right before the question.
    for (let run = 0; run < RUNS; run += 1) {
      const { reel } = buildReel('3 corners', 3, seeded(run + 1));
      for (let lap = 0; lap < 3; lap += 1) {
        const slice = reel.slice(lap * 4, lap * 4 + 4);
        expect(new Set(slice).size).toBe(4);
        for (const clue of slice) expect(isKnownClue(clue)).toBe(true);
      }
    }
  });

  it('is cycles*4 clues plus the landing clue and one after it', () => {
    const { reel, landIndex } = buildReel('4 corners', 3, seeded(2));
    expect(reel).toHaveLength(16);
    expect(landIndex).toBe(13);
    expect(reel.length).toBeGreaterThan(landIndex + 1);
  });

  it('treats zero or negative cycles as one lap', () => {
    expect(buildReel('4 corners', 0, seeded(2)).reel).toHaveLength(6);
    expect(buildReel('4 corners', -3, seeded(2)).reel).toHaveLength(6);
  });

  it('falls back to a real clue for an unknown one', () => {
    const { reel, landIndex } = buildReel('seven corners', 2, seeded(5));
    expect(isKnownClue(reel[landIndex])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildRounds + guards
// ---------------------------------------------------------------------------

describe('buildRounds — the play ORDER', () => {
  it('builds one round per plan entry', () => {
    expect(buildRounds(seeded(1))).toHaveLength(SCENE1_ROUNDS);
  });

  it('ALWAYS puts the two-shape round last', () => {
    // It is the harder task and the one that introduces placing a second shape,
    // so it must not be shuffled into the middle.
    for (let run = 0; run < RUNS; run += 1) {
      const rounds = buildRounds(seeded(run + 1));
      expect(rounds[3].clue, `run ${run}`).toBe(FINAL_ROUND.clue);
      expect(rounds[3].count).toBe(2);
    }
  });

  it('shuffles the first three', () => {
    // Every one of the six permutations should turn up across enough runs.
    const orders = new Set();
    for (let run = 0; run < RUNS * 4; run += 1) {
      orders.add(buildRounds(seeded(run + 1)).slice(0, 3).map((r) => r.clue).join('|'));
    }
    expect(orders.size).toBe(6);
  });

  it('never loses or duplicates a single round while shuffling', () => {
    const expected = SINGLE_ROUNDS.map((r) => r.clue).sort().join('|');
    for (let run = 0; run < RUNS; run += 1) {
      const got = buildRounds(seeded(run + 1)).slice(0, 3).map((r) => r.clue).sort().join('|');
      expect(got, `run ${run}`).toBe(expected);
    }
  });

  it('stamps rounds with their PLAY index, not their plan index', () => {
    // The HUD says "round 2 / 4", so the index must follow the order played.
    const rounds = buildRounds(seeded(7));
    expect(rounds.map((r) => r.round)).toEqual([0, 1, 2, 3]);
  });

  it('keeps every round answerable whatever the order', () => {
    for (let run = 0; run < RUNS; run += 1) {
      for (const r of buildRounds(seeded(run + 1))) {
        const shown = new Set(r.options.map((o) => o.type));
        const available = r.accepts.filter((t) => shown.has(t));
        expect(available.length, `run ${run} round ${r.round}`).toBeGreaterThanOrEqual(r.count);
      }
    }
  });
});

describe('guards', () => {
  it('isOptionType knows the drawable shapes', () => {
    for (const t of OPTION_TYPES) expect(isOptionType(t)).toBe(true);
    expect(isOptionType('hexagon')).toBe(false);
    expect(isOptionType(undefined)).toBe(false);
  });

  it('isKnownClue knows the plan’s clues', () => {
    for (const r of ROUND_PLAN) expect(isKnownClue(r.clue)).toBe(true);
    expect(isKnownClue('2 corners')).toBe(false);
  });

  it('hasAllOptions is false when a shape is missing', () => {
    const r = buildRound(0);
    const broken = { options: r.options.filter((o) => o.type !== 'circle') };
    expect(hasAllOptions(broken)).toBe(false);
  });
});
