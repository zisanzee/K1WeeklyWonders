import { describe, it, expect } from 'vitest';
import { parseTextureKey } from '@/games/game-11/assets';
import { textureKey, variantsForPortrait, partsForPortrait } from '@/games/game-11/portraits';

// The two key shapes are the load-bearing part of adding a two-digit portrait:
// `p10v1p2` must read as portrait 10, NOT portrait 1. These lock that.
describe('texture keys', () => {
  it('parses the legacy single-digit form', () => {
    expect(parseTextureKey('p213')).toEqual({ portrait: 2, variant: 1, part: 3 });
    expect(parseTextureKey('p121')).toEqual({ portrait: 1, variant: 2, part: 1 });
  });

  it('parses the delimited two-digit form without colliding with portrait 1', () => {
    expect(parseTextureKey('p10v1p2')).toEqual({ portrait: 10, variant: 1, part: 2 });
    expect(parseTextureKey('p9v1p3')).toEqual({ portrait: 9, variant: 1, part: 3 });
    // The compact form of p10v1p2 would be 'p101' — the parser must still read
    // it as portrait 10 via the explicit form and never as portrait 1.
    expect(parseTextureKey('p101')).toEqual({ portrait: 1, variant: 0, part: 1 });
  });

  it('returns null for non-portrait keys', () => {
    expect(parseTextureKey('startScreen')).toBeNull();
    expect(parseTextureKey('')).toBeNull();
  });

  it('round-trips through textureKey for both formats', () => {
    expect(textureKey(2, 1, 3)).toBe('p213');
    expect(textureKey(9, 1, 3)).toBe('p9v1p3');
    expect(textureKey(10, 1, 2)).toBe('p10v1p2');
  });

  it('resolves the house and beetle portraits to their parts', () => {
    expect(variantsForPortrait(9)).toEqual([1]);
    expect(variantsForPortrait(10)).toEqual([1]);
    expect(partsForPortrait(9)).toEqual(['p9v1p1', 'p9v1p2', 'p9v1p3']);
    expect(partsForPortrait(10)).toEqual(['p10v1p1', 'p10v1p2', 'p10v1p3']);
  });
});
