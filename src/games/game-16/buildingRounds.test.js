import { describe, it, expect } from 'vitest';
import {
  ORDINALS,
  OPTION_COUNT,
  ordinalFor,
  promptFor,
  splitPromptWords,
  shuffle,
  buildFloorPlan,
  optionsFor,
} from './buildingRounds';

// A deterministic generator, so a "random" test cannot flake. Mulberry32.
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ordinalFor', () => {
  it('spells the floors 1..10', () => {
    expect(ORDINALS).toHaveLength(10);
    expect(ordinalFor(1)).toBe('first');
    expect(ordinalFor(3)).toBe('third');
    expect(ordinalFor(10)).toBe('tenth');
  });

  it('falls back to a numeral past the table', () => {
    expect(ordinalFor(11)).toBe('11th');
  });

  it('returns empty for a floor that does not exist', () => {
    expect(ordinalFor(0)).toBe('');
    expect(ordinalFor(-1)).toBe('');
    expect(ordinalFor(1.5)).toBe('');
    expect(ordinalFor(undefined)).toBe('');
  });
});

describe('promptFor', () => {
  it('builds the sentence and names the word to emphasise', () => {
    expect(promptFor(3)).toEqual({
      text: 'Which animal is on the third floor?',
      emphasis: 'third',
    });
  });

  it('produces no prompt for an invalid floor', () => {
    expect(promptFor(0)).toEqual({ text: '', emphasis: '' });
  });

  it('uses the spelled form, never a numeral, for every real floor', () => {
    for (let floor = 1; floor <= 10; floor += 1) {
      const { text } = promptFor(floor);
      expect(text).not.toMatch(/\d/);
      expect(text).toBe(`Which animal is on the ${ORDINALS[floor - 1]} floor?`);
    }
  });
});

describe('splitPromptWords', () => {
  it('flags exactly the emphasised word', () => {
    const { text, emphasis } = promptFor(4);
    const words = splitPromptWords(text, emphasis);

    expect(words.map((w) => w.word)).toEqual([
      'Which', 'animal', 'is', 'on', 'the', 'fourth', 'floor?',
    ]);
    expect(words.filter((w) => w.isEm).map((w) => w.word)).toEqual(['fourth']);
  });

  it('ignores case and punctuation when matching', () => {
    const words = splitPromptWords('on the third?', 'Third');
    expect(words.filter((w) => w.isEm)).toHaveLength(1);
  });

  it('emphasises nothing when there is no marker', () => {
    const words = splitPromptWords('Which animal is here?', '');
    expect(words.every((w) => !w.isEm)).toBe(true);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(7));

    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a seeded generator', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(3))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(3)));
  });
});

describe('buildFloorPlan', () => {
  it('asks about DISTINCT floors, one per round', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const plan = buildFloorPlan(10, 5, seeded(seed));
      expect(plan).toHaveLength(5);
      expect(new Set(plan).size).toBe(5);
      plan.forEach((floor) => {
        expect(floor).toBeGreaterThanOrEqual(1);
        expect(floor).toBeLessThanOrEqual(10);
      });
    }
  });

  it('never asks about a floor the building does not have', () => {
    const plan = buildFloorPlan(3, 5, seeded(11));
    // Capped at the room count rather than repeating a floor.
    expect(plan).toHaveLength(3);
    expect(new Set(plan).size).toBe(3);
    plan.forEach((floor) => expect(floor).toBeLessThanOrEqual(3));
  });

  it('spreads over the whole building rather than favouring the ends', () => {
    // Across many runs every floor must be asked at some point, which a
    // "random each time with retry" scheme tends to break.
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed += 1) {
      buildFloorPlan(10, 5, seeded(seed)).forEach((f) => seen.add(f));
    }
    expect(seen.size).toBe(10);
  });

  it('handles degenerate input', () => {
    expect(buildFloorPlan(0, 5, seeded(1))).toEqual([]);
    expect(buildFloorPlan(10, 0, seeded(1))).toEqual([]);
    expect(buildFloorPlan(NaN, 5, seeded(1))).toEqual([]);
  });
});

describe('optionsFor', () => {
  it('always contains the answer exactly once', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (let target = 0; target < 10; target += 1) {
        const opts = optionsFor(target, 10, 3, seeded(seed));
        expect(opts).toHaveLength(3);
        expect(opts.filter((i) => i === target)).toHaveLength(1);
      }
    }
  });

  it('never duplicates an option', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const opts = optionsFor(4, 10, 3, seeded(seed));
      expect(new Set(opts).size).toBe(3);
    }
  });

  it('does not leave the answer in the same slot every time', () => {
    const slots = new Set();
    for (let seed = 1; seed <= 60; seed += 1) {
      slots.add(optionsFor(4, 10, 3, seeded(seed)).indexOf(4));
    }
    expect(slots.size).toBeGreaterThan(1);
  });

  it('returns the answer alone when the building is smaller than the row', () => {
    expect(optionsFor(0, 1, 3, seeded(1))).toEqual([0]);
    expect(optionsFor(1, 2, 3, seeded(1))).toHaveLength(2);
  });

  it('refuses an out-of-range target instead of building an unanswerable row', () => {
    expect(optionsFor(-1, 10, 3, seeded(1))).toEqual([]);
    expect(optionsFor(10, 10, 3, seeded(1))).toEqual([]);
    expect(optionsFor(0, 0, 3, seeded(1))).toEqual([]);
  });

  it('defaults to the shared option count', () => {
    expect(optionsFor(2, 10, undefined, seeded(1))).toHaveLength(OPTION_COUNT);
  });

  describe('with a texture key resolver', () => {
    // Two rooms sharing one image — which assets.js really does have: `optionDog`
    // and `optionSheep` point at the same Cloudinary file.
    const keys = ['frog', 'sheep', 'sheep', 'cat', 'lion'];

    it('never offers a distractor that draws the answer', () => {
      for (let seed = 1; seed <= 60; seed += 1) {
        // Target the FROG (index 0): the two sheep-copies are both safe there.
        const opts = optionsFor(0, keys.length, 3, seeded(seed), (i) => keys[i]);
        expect(opts).toHaveLength(3);
        expect(opts).toContain(0);
      }
    });

    it('excludes the look-alike when the ANSWER is one of the duplicates', () => {
      // Target index 1 (a sheep). Index 2 draws the same picture, so it must never
      // appear — otherwise the disc showing a sheep "is" both the answer and a
      // distractor, and a correct tap could be marked wrong.
      for (let seed = 1; seed <= 60; seed += 1) {
        const opts = optionsFor(1, keys.length, 3, seeded(seed), (i) => keys[i]);
        expect(opts).not.toContain(2);
        expect(opts).toContain(1);
        expect(opts).toHaveLength(3);
      }
    });

    it('still returns a usable row when the duplicates shrink the pool', () => {
      // Three rooms, two of them the same picture, answer is the odd one out.
      const small = ['a', 'b', 'b'];
      const opts = optionsFor(0, small.length, 3, seeded(1), (i) => small[i]);
      expect(opts[0]).toBe(0);
      expect(opts.length).toBeGreaterThanOrEqual(1);
      expect(new Set(opts.map((i) => small[i])).size).toBe(opts.length);
    });

    it('behaves exactly as before when no resolver is given', () => {
      const withNone = optionsFor(1, 5, 3, seeded(9));
      expect(withNone).toHaveLength(3);
      expect(withNone).toContain(1);
    });
  });
});
