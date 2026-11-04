import { describe, it, expect } from 'vitest';
import {
  WALL_PART,
  clampScroll,
  floorNumber,
  indexForFloor,
  roomCentreY,
  roomCentres,
  roomHeight,
  roomsSpan,
  scrollMaxFor,
  scrollRange,
  scrollToCentre,
  wallPlan,
  wallTiles,
} from '@/games/game-16/buildingLayout';

// The building's geometry is where the invisible bugs live: a room half a gap out
// of step, a wall one tile short of covering the last floor, or floor numbering
// reading the wrong way. All of those still LOOK like a building, so they are
// pinned here rather than eyeballed.

const W = 720;
const H = 1080;

// A realistic setup: ten rooms of the same aspect, at the shipped tuning.
const ROOM_W = 456;
const ROOM_H = roomHeight(ROOM_W, 900, 700); // ~354.7
const ROOM_HEIGHTS = Array.from({ length: 10 }, () => ROOM_H);
const GAP = 10;
const FIRST_Y = H * 0.3;
const CAP_H = (W, srcW, srcH) => (W * srcH) / srcW;

describe('roomHeight', () => {
  it('follows the art aspect at the requested width', () => {
    // A 2:1 image at 456 wide is 228 tall.
    expect(roomHeight(456, 900, 450)).toBeCloseTo(228, 6);
  });

  it('returns 0 for a missing dimension instead of NaN', () => {
    // NaN would place the image at an invisible coordinate with no error.
    expect(roomHeight(456, 0, 100)).toBe(0);
    expect(roomHeight(456, 100, 0)).toBe(0);
    expect(roomHeight(456, undefined, undefined)).toBe(0);
  });

  it('never squashes: width is the contract', () => {
    const tall = roomHeight(456, 100, 400);
    const wide = roomHeight(456, 400, 100);
    expect(tall).toBeGreaterThan(wide);
    // Both are 456 wide; only the height differs.
    expect(tall / wide).toBeCloseTo(16, 6);
  });
});

describe('roomCentres — the stack', () => {
  it('puts the first room at the requested y', () => {
    expect(roomCentreY(0, FIRST_Y, ROOM_HEIGHTS, GAP)).toBe(FIRST_Y);
    expect(roomCentres(FIRST_Y, ROOM_HEIGHTS, GAP)[0]).toBe(FIRST_Y);
  });

  it('leaves an EXACT gap between every pair', () => {
    // The gap is what "beautifully done" means: it must be the same everywhere,
    // which a fixed y-step cannot guarantee when rooms have different heights.
    const centres = roomCentres(FIRST_Y, ROOM_HEIGHTS, GAP);
    for (let i = 1; i < centres.length; i += 1) {
      const gap = centres[i] - ROOM_H / 2 - (centres[i - 1] + ROOM_H / 2);
      expect(gap, `gap ${i}`).toBeCloseTo(GAP, 6);
    }
  });

  it('keeps the gap with ROOMS OF DIFFERENT HEIGHTS', () => {
    // The real art will not have one aspect. A fixed step drifts here; cumulative
    // heights do not.
    const mixed = [200, 350, 120, 400, 260];
    const centres = roomCentres(FIRST_Y, mixed, GAP);
    for (let i = 1; i < centres.length; i += 1) {
      const gap = centres[i] - mixed[i] / 2 - (centres[i - 1] + mixed[i - 1] / 2);
      expect(gap, `gap ${i}`).toBeCloseTo(GAP, 6);
    }
  });

  it('is strictly increasing, so floors never overlap', () => {
    const centres = roomCentres(FIRST_Y, ROOM_HEIGHTS, GAP);
    for (let i = 1; i < centres.length; i += 1) {
      expect(centres[i]).toBeGreaterThan(centres[i - 1]);
    }
  });

  it('agrees with the single-index form', () => {
    const centres = roomCentres(FIRST_Y, ROOM_HEIGHTS, GAP);
    ROOM_HEIGHTS.forEach((_, i) => {
      expect(roomCentreY(i, FIRST_Y, ROOM_HEIGHTS, GAP)).toBeCloseTo(centres[i], 9);
    });
  });
});

describe('roomsSpan', () => {
  it('is every room plus every gap', () => {
    const total = ROOM_HEIGHTS.reduce((a, b) => a + b, 0);
    expect(roomsSpan(ROOM_HEIGHTS, GAP)).toBeCloseTo(total + GAP * 9, 6);
  });

  it('is 0 for no rooms, not negative', () => {
    expect(roomsSpan([], GAP)).toBe(0);
    expect(roomsSpan([100], GAP)).toBe(100);
  });
});

describe('wallPlan — the tiling', () => {
  const topCapHeight = CAP_H(W, 600, 100); // 120
  const middleTileHeight = CAP_H(W, 600, 200); // 240
  const bottomCapHeight = CAP_H(W, 600, 160); // 192

  it('uses ceil on the middle count so the caps always cover the ends', () => {
    // A partial middle tile means the wall is never short — the bottom cap hides
    // the overhang. Floor would leave a gap.
    const plan = wallPlan({
      wallHeight: topCapHeight + middleTileHeight * 2.2 + bottomCapHeight,
      topCapHeight,
      middleTileHeight,
      bottomCapHeight,
    });
    expect(plan.middleCount).toBe(3);
  });

  it('never returns a span SHORTER than the height asked for', () => {
    for (const wallHeight of [300, 1200, 2600, 4000, 5432.7]) {
      const plan = wallPlan({ wallHeight, topCapHeight, middleTileHeight, bottomCapHeight });
      expect(plan.span, `height ${wallHeight}`).toBeGreaterThanOrEqual(wallHeight - 1e-9);
    }
  });

  it('is exactly the caps when the building fits between them', () => {
    const plan = wallPlan({ wallHeight: 10, topCapHeight, middleTileHeight, bottomCapHeight });
    expect(plan.middleCount).toBe(0);
    expect(plan.span).toBeCloseTo(topCapHeight + bottomCapHeight, 6);
  });

  it('does not divide by zero when the middle art is missing', () => {
    const plan = wallPlan({ wallHeight: 1000, topCapHeight, middleTileHeight: 0, bottomCapHeight });
    expect(plan.middleCount).toBe(0);
    expect(Number.isFinite(plan.span)).toBe(true);
  });

  it('covers a TEN-ROOM building', () => {
    // The actual case: ten rooms, both pads, and the caps must reach both ends.
    const roomsTotal = roomsSpan(ROOM_HEIGHTS, GAP);
    const wallHeight = 120 + roomsTotal + 200;
    const plan = wallPlan({ wallHeight, topCapHeight, middleTileHeight, bottomCapHeight });
    expect(plan.span).toBeGreaterThanOrEqual(wallHeight);
    expect(plan.middleCount).toBeGreaterThan(5);
  });
});

describe('wallTiles', () => {
  const topCapHeight = 120;
  const middleTileHeight = 240;
  const bottomCapHeight = 192;
  const plan = { middleCount: 3, span: topCapHeight + middleTileHeight * 3 + bottomCapHeight };
  const startY = 100;

  it('starts at the top with the top cap, ends with the bottom cap', () => {
    const tiles = wallTiles(startY, plan, { topCapHeight, middleTileHeight, bottomCapHeight });
    expect(tiles[0].part).toBe(WALL_PART.TOP);
    expect(tiles[tiles.length - 1].part).toBe(WALL_PART.BOTTOM);
  });

  it('lays the tiles end to end with NO gaps or overlaps', () => {
    // A one-pixel seam here is a visible line across the building.
    const tiles = wallTiles(startY, plan, { topCapHeight, middleTileHeight, bottomCapHeight });
    for (let i = 1; i < tiles.length; i += 1) {
      const prevBottom = tiles[i - 1].y + tiles[i - 1].height / 2;
      const thisTop = tiles[i].y - tiles[i].height / 2;
      expect(thisTop, `seam ${i}`).toBeCloseTo(prevBottom, 6);
    }
  });

  it('covers exactly the planned span', () => {
    const tiles = wallTiles(startY, plan, { topCapHeight, middleTileHeight, bottomCapHeight });
    const bottom = tiles[tiles.length - 1].y + tiles[tiles.length - 1].height / 2;
    expect(bottom - startY).toBeCloseTo(plan.span, 6);
  });

  it('has top + middles + bottom tiles', () => {
    const tiles = wallTiles(startY, plan, { topCapHeight, middleTileHeight, bottomCapHeight });
    expect(tiles).toHaveLength(plan.middleCount + 2);
    expect(tiles.filter((t) => t.part === WALL_PART.MIDDLE)).toHaveLength(plan.middleCount);
  });

  it('works with no caps at all', () => {
    const tiles = wallTiles(startY, { middleCount: 2, span: 480 }, {
      topCapHeight: 0,
      middleTileHeight,
      bottomCapHeight: 0,
    });
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.part === WALL_PART.MIDDLE)).toBe(true);
  });
});

describe('scrollRange + clampScroll', () => {
  it('allows no movement when the content fits', () => {
    expect(scrollRange(900, H, 100, 40)).toBe(0);
  });

  it('is content minus the usable viewport', () => {
    // 4000 content in a 1080 canvas with 100+40 insets → 4000-940 = 3060.
    expect(scrollRange(4000, H, 100, 40)).toBeCloseTo(3060, 6);
  });

  it('clamps into range at both ends', () => {
    expect(clampScroll(-500, 1000)).toBe(0);
    expect(clampScroll(5000, 1000)).toBe(1000);
    expect(clampScroll(400, 1000)).toBe(400);
  });

  it('treats a non-finite offset as 0 rather than NaN', () => {
    // NaN would park the whole building at an invisible coordinate.
    expect(clampScroll(NaN, 1000)).toBe(0);
    expect(clampScroll(undefined, 1000)).toBe(0);
  });

  it('is 0 when nothing can scroll', () => {
    expect(clampScroll(500, 0)).toBe(0);
  });
});

describe('scrollMaxFor — the END WALL MUST BE FLUSH', () => {
  it('puts the content bottom exactly on the screen edge', () => {
    // THE BUG THIS PINS: the band form (`scrollRange`) forgets that the content
    // does not start at y=0, so the wall stopped 38px short of the bottom and left
    // a strip of backdrop under the building.
    const contentTop = 70;
    const contentHeight = 4082;
    const H = 1080;

    const max = scrollMaxFor(contentTop, contentHeight, H, 0);
    const bottomAtMax = contentTop + contentHeight - max;

    expect(bottomAtMax).toBeCloseTo(H, 6);
  });

  it('keeps a bottom inset when one is asked for', () => {
    const max = scrollMaxFor(70, 4082, 1080, 40);
    const bottom = 70 + 4082 - max;
    expect(bottom).toBeCloseTo(1080 - 40, 6);
  });

  it('never goes negative when the content already fits', () => {
    expect(scrollMaxFor(0, 400, 1080, 0)).toBe(0);
    expect(scrollMaxFor(100, 400, 1080, 0)).toBe(0);
  });

  it('differs from scrollRange by exactly the content offset', () => {
    // The two answer different questions, and the difference is `contentTop` —
    // which is precisely what made the wall stop short.
    const contentTop = 70;
    const contentHeight = 4082;
    const H = 1080;

    const flush = scrollMaxFor(contentTop, contentHeight, H, 0);
    const band = scrollRange(contentHeight, H, 0, 0);

    expect(flush - band).toBeCloseTo(contentTop, 6);
  });
});

describe('floorNumber / indexForFloor', () => {
  const TOTAL = 10;

  it('counts from the GROUND floor, which is the LAST entry', () => {
    // The array is top-down. Getting this backwards sends the child to the wrong
    // room, and it still looks plausible.
    expect(floorNumber(9, TOTAL)).toBe(1); // last entry = ground
    expect(floorNumber(8, TOTAL)).toBe(2);
    expect(floorNumber(7, TOTAL)).toBe(3); // "third floor"
    expect(floorNumber(0, TOTAL)).toBe(10); // first entry = top floor
  });

  it('round-trips with indexForFloor', () => {
    for (let i = 0; i < TOTAL; i += 1) {
      expect(indexForFloor(floorNumber(i, TOTAL), TOTAL)).toBe(i);
    }
  });

  it('the third floor is three quarters down a ten-floor building', () => {
    // Sanity on the mapping the prompts rely on: "third floor" is near the BOTTOM.
    const index = indexForFloor(3, TOTAL);
    expect(index).toBe(7);
    expect(index).toBeGreaterThan(TOTAL / 2);
  });

  it('returns -1 / 0 for out-of-range and junk', () => {
    expect(floorNumber(-1, TOTAL)).toBe(0);
    expect(floorNumber(TOTAL, TOTAL)).toBe(0);
    expect(floorNumber(0, 0)).toBe(0);
    expect(indexForFloor(0, TOTAL)).toBe(-1);
    expect(indexForFloor(11, TOTAL)).toBe(-1);
    expect(indexForFloor(1.5, TOTAL)).toBe(-1);
  });
});

describe('scrollToCentre', () => {
  it('centres a room in the usable band', () => {
    // Content starts 0 on screen; the usable band is 100..1040, centre 570.
    const offset = scrollToCentre(2000, 0, H, 100, 40);
    expect(offset).toBeCloseTo(2000 - 570, 6);
  });

  it('accounts for content that starts below the top of the screen', () => {
    const offset = scrollToCentre(2000, 200, H, 100, 40);
    expect(offset).toBeCloseTo(2000 - (570 - 200), 6);
  });
});
