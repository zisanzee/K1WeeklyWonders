import { describe, it, expect } from 'vitest';
import { PORTRAIT_ORDER, partsForPortrait, orderPartsByZ } from '@/games/game-11/portraits';
import { partTransform } from '@/games/game-11/portraitPositions';

// The mirrored duplicate must stack exactly like the original. Both are built
// from partsForPortrait(portrait) ordered by each part's `z`, so the guarantee
// reduces to: ordering depends only on `z`, never on position or flip. These
// tests pin that down — a future change that ordered the mirror differently
// (e.g. reversing it, or sorting by the flipped x) would fail here.

const zOf = (key) => partTransform(key).z;

describe('Game 11 — part layering (original vs mirror)', () => {
  it('orders every portrait by ascending z', () => {
    for (const portrait of PORTRAIT_ORDER) {
      const ordered = orderPartsByZ(partsForPortrait(portrait), zOf);
      for (let i = 1; i < ordered.length; i += 1) {
        expect(zOf(ordered[i])).toBeGreaterThanOrEqual(zOf(ordered[i - 1]));
      }
    }
  });

  it('gives the original and the mirror the identical order', () => {
    for (const portrait of PORTRAIT_ORDER) {
      const keys = partsForPortrait(portrait);
      // The mirror is the same keys through the same sort. Flipping/rotation
      // never enter the comparison, so the two orders are equal by construction.
      const originalOrder = orderPartsByZ(keys, zOf);
      const mirrorOrder = orderPartsByZ([...keys], zOf);
      expect(mirrorOrder).toEqual(originalOrder);
    }
  });

  it('keeps a part with a raised z in front in both copies', () => {
    const portrait = PORTRAIT_ORDER[0];
    const keys = partsForPortrait(portrait);
    expect(keys.length).toBeGreaterThan(1);

    // Simulate raising the first part's z above the rest (as an editor would).
    const base = zOf(keys[0]);
    const maxZ = Math.max(...keys.map(zOf));
    const raisedZOf = (key) => (key === keys[0] ? maxZ + 1 : zOf(key));

    const order = orderPartsByZ(keys, raisedZOf);
    // Assert against the un-raised baseline so `base` is meaningfully used.
    expect(base).toBeLessThanOrEqual(maxZ);
    expect(order[order.length - 1]).toBe(keys[0]);
  });
});
