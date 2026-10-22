import { describe, it, expect } from 'vitest';
import {
  cellWidth,
  shelfLayout,
  productIndexAt,
  focusedProductIndex,
  clampCamera,
  allProductsVisible,
  ordinalLabel,
} from '@/games/game-15/world';

const SCREEN = 720;
const COUNT = 10;
const VISIBLE = 3;
const CHAR_X = SCREEN * 0.24;
const PAD = (SCREEN / VISIBLE) * 0.35;
const MARGIN = SCREEN * 0.25;

const layout = (overrides = {}) =>
  shelfLayout({
    screenWidth: SCREEN,
    count: COUNT,
    visible: VISIBLE,
    minPad: PAD,
    marginEach: MARGIN,
    ...overrides,
  });

// The layout is the only non-trivial logic here. What matters to a child: the
// row must look centred on the shelf, no product may be unreachable, and the
// shelf must have bare background to either side. All are asserted.
describe('game-15 shelf — dimensions', () => {
  it('fits `visible` products on screen, whatever the count', () => {
    expect(cellWidth(SCREEN, 10, 3)).toBeCloseTo(SCREEN / 3);
    expect(cellWidth(SCREEN, 20, 3)).toBeCloseTo(SCREEN / 3);
  });

  it('sizes the shelving as the row plus one margin at each end', () => {
    const l = layout();
    expect(l.shelfWidth).toBeCloseTo(l.productsWidth + l.pad * 2);
  });

  it('keeps the side margin close to the requested design value', () => {
    const l = layout();
    // The regression this guards: the margin used to be inflated to >1.5 cells
    // of dead space by an over-strict camera constraint.
    expect(l.pad).toBeLessThan(l.cell);
    expect(l.pad).toBeCloseTo(PAD);
  });

  it('treats a negative margin as no margin', () => {
    expect(layout({ minPad: -50 }).pad).toBe(0);
  });
});

describe('game-15 world — background margins around the shelf', () => {
  it('adds bare background before and after the shelving', () => {
    const l = layout();
    expect(l.marginEach).toBeCloseTo(MARGIN);
    expect(l.shelfStart).toBeCloseTo(MARGIN);
    expect(l.worldWidth).toBeCloseTo(l.shelfWidth + MARGIN * 2);
  });

  it('leaves the same background space on both sides', () => {
    const l = layout();
    const beforeShelf = l.shelfStart;
    const afterShelf = l.worldWidth - (l.shelfStart + l.shelfWidth);
    expect(beforeShelf).toBeCloseTo(MARGIN);
    expect(afterShelf).toBeCloseTo(MARGIN);
    expect(beforeShelf).toBeCloseTo(afterShelf);
  });

  it('still works with no margins at all', () => {
    const l = layout({ marginEach: 0 });
    expect(l.shelfStart).toBe(0);
    expect(l.worldWidth).toBeCloseTo(l.shelfWidth);
  });

  it('treats a negative margin as no margin', () => {
    const l = layout({ marginEach: -100 });
    expect(l.marginEach).toBe(0);
    expect(l.shelfStart).toBe(0);
  });
});

describe('game-15 ordinals — labels above each product', () => {
  it('uses the right suffix for each single digit', () => {
    expect(ordinalLabel(1)).toBe('1st');
    expect(ordinalLabel(2)).toBe('2nd');
    expect(ordinalLabel(3)).toBe('3rd');
    expect(ordinalLabel(4)).toBe('4th');
    expect(ordinalLabel(9)).toBe('9th');
  });

  it('handles the 11-13 exception', () => {
    // These end in 1/2/3 but take "th", which naive suffix logic gets wrong.
    expect(ordinalLabel(11)).toBe('11th');
    expect(ordinalLabel(12)).toBe('12th');
    expect(ordinalLabel(13)).toBe('13th');
  });

  it('handles the twenties and thirties', () => {
    expect(ordinalLabel(21)).toBe('21st');
    expect(ordinalLabel(22)).toBe('22nd');
    expect(ordinalLabel(23)).toBe('23rd');
    expect(ordinalLabel(30)).toBe('30th');
  });

  it('labels every product the shelf can show', () => {
    // One label per slot, starting at 1st — the scene calls ordinalLabel(i + 1).
    for (let i = 0; i < COUNT; i += 1) {
      expect(ordinalLabel(i + 1)).toMatch(/^\d+(st|nd|rd|th)$/);
    }
    expect(ordinalLabel(1)).toBe('1st');
    expect(ordinalLabel(COUNT)).toBe('10th');
  });
});

describe('game-15 shelf — row is centred on the art', () => {
  it('leaves equal padding on both sides of the product row', () => {
    const l = layout();
    const rightGap = l.shelfWidth - (l.pad + l.productsWidth);
    expect(l.pad).toBeCloseTo(rightGap);
  });

  it('centres the row for a range of margins and product counts', () => {
    for (const minPad of [0, 40, 84, 150]) {
      for (const count of [4, 7, 10, 13]) {
        const l = layout({ minPad, count });
        const rightGap = l.shelfWidth - (l.pad + l.productsWidth);
        expect(l.pad).toBeCloseTo(rightGap);
      }
    }
  });

  it('is symmetric about the SHELF midpoint, background margins aside', () => {
    const l = layout();
    const mid = l.shelfStart + l.shelfWidth / 2;
    const first = l.productCenters[0];
    const last = l.productCenters[l.productCenters.length - 1];
    expect(mid - first).toBeCloseTo(last - mid);
  });
});

describe('game-15 shelf — product positions', () => {
  it('spaces every product exactly one cell apart', () => {
    const l = layout();
    for (let i = 1; i < l.productCenters.length; i += 1) {
      expect(l.productCenters[i] - l.productCenters[i - 1]).toBeCloseTo(l.cell);
    }
  });

  it('offsets the row by the leading background margin', () => {
    const l = layout();
    const noMargin = layout({ marginEach: 0 });
    expect(l.productCenters[0] - noMargin.productCenters[0]).toBeCloseTo(MARGIN);
  });

  it('round-trips index → x → index for every product', () => {
    const l = layout();
    l.productCenters.forEach((x, i) => {
      expect(productIndexAt(x, l)).toBe(i);
    });
  });

  it('round-trips with no background margin', () => {
    const l = layout({ marginEach: 0 });
    l.productCenters.forEach((x, i) => {
      expect(productIndexAt(x, l)).toBe(i);
    });
  });

  it('clamps out-of-range coordinates to the first/last product', () => {
    const l = layout();
    expect(productIndexAt(-500, l)).toBe(0);
    expect(productIndexAt(99_999, l)).toBe(COUNT - 1);
  });
});

describe('game-15 shelf — camera', () => {
  it('spans the whole world, margins included', () => {
    const l = layout();
    expect(l.cameraMin).toBe(0);
    expect(l.cameraMax).toBeCloseTo(l.worldWidth - SCREEN);
  });

  it('shows every product at some camera position', () => {
    const l = layout();
    // The real requirement: reachable by being VISIBLE, not by standing under
    // the character. This is what allows a small margin.
    expect(allProductsVisible(l, SCREEN)).toBe(true);
  });

  it('never scrolls past the ends of the world', () => {
    const l = layout();
    expect(clampCamera(-9999, l)).toBe(l.cameraMin);
    expect(clampCamera(9999, l)).toBe(l.cameraMax);
  });

  it('starts focused on the first product, even past the leading margin', () => {
    const l = layout();
    // The character stands at CHAR_X; with a background margin the first product
    // is further right, so camera 0 must still resolve to product 0.
    expect(focusedProductIndex(l.cameraMin, CHAR_X, l)).toBe(0);
  });

  it('resolves a product for every camera offset across the world', () => {
    const l = layout();
    for (let cam = l.cameraMin; cam <= l.cameraMax; cam += SCREEN / 8) {
      const idx = focusedProductIndex(cam, CHAR_X, l);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(COUNT - 1);
    }
  });

  it('has the last product ON SCREEN by the end of the world', () => {
    const l = layout();
    // Deliberately NOT "the character stands under the last product": the
    // trailing background margin means the camera stops past the row, and
    // requiring the character to reach every product is what previously inflated
    // the margins to over a cell of dead space. What matters for play is that the
    // product is VISIBLE, hence draggable, at some camera position.
    const lastX = l.productCenters[COUNT - 1];
    expect(lastX).toBeLessThanOrEqual(l.cameraMax + SCREEN);
    expect(lastX).toBeGreaterThanOrEqual(l.cameraMin);
  });

  it('holds its invariants across a spread of inputs', () => {
    for (const minPad of [0, 60, 120]) {
      for (const marginEach of [0, 90, 240]) {
        for (const count of [3, 5, 10, 12]) {
          const l = layout({ minPad, marginEach, count });
          expect(l.pad).toBeCloseTo(l.shelfWidth - l.pad - l.productsWidth);
          expect(l.worldWidth).toBeCloseTo(l.shelfWidth + marginEach * 2);
          expect(allProductsVisible(l, SCREEN)).toBe(true);
          expect(l.productCenters[count - 1]).toBeLessThanOrEqual(l.cameraMax + SCREEN);
        }
      }
    }
  });
});
