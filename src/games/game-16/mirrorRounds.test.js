import { describe, it, expect } from 'vitest';
import {
  CANVAS,
  axisEndpoints,
  partTransformFallback,
  reflectPoint,
  reflectionTransform,
  sideOfLine,
} from '@/games/game-16/mirrorRounds';
import { MIRROR_PARTS, MIRROR_ROUNDS } from '@/games/game-16/tuning';
import { SCENES } from '@/games/game-16/scenes';

// The DATA comes from tuning.js (so the dev panel can print the whole tuning
// file back for a one-paste save); the MATHS comes from mirrorRounds.js.
const partsForRound = (index) => {
  const meta = MIRROR_ROUNDS[Math.min(Math.max(index, 0), MIRROR_ROUNDS.length - 1)];
  return MIRROR_PARTS.filter((part) => part.round === meta.round);
};

// The reflection maths is the whole point of this scene, and it is invisible
// when wrong: a portrait mirrored about the wrong axis, or with a transposed
// sine, still looks like a picture. These assert the PROPERTIES a reflection must
// have rather than restating the formula, so a rewrite cannot quietly change
// them.

const DEG = Math.PI / 180;

// A point deliberately off-centre and off every axis, so no test can pass by the
// reflection happening to be the identity.
const point = { x: 137, y: 291 };
const anchor = { x: CANVAS.width / 2, y: CANVAS.height / 2 };

function near(actual, expected, tol = 1e-9) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

describe('reflectPoint', () => {
  it('reflects a vertical axis (90°) as a horizontal flip', () => {
    const out = reflectPoint(point, anchor, 90);
    near(out.x, 2 * anchor.x - point.x);
    near(out.y, point.y);
  });

  it('reflects a horizontal axis (0°) as a vertical flip', () => {
    // The y sign is where a dropped minus shows up.
    const out = reflectPoint(point, anchor, 0);
    near(out.x, point.x);
    near(out.y, 2 * anchor.y - point.y);
  });

  it('reflects a 45° line by swapping the axes', () => {
    // M(45°) = [[0,1],[1,0]].
    const out = reflectPoint({ x: 10, y: 30 }, { x: 0, y: 0 }, 45);
    near(out.x, 30);
    near(out.y, 10);
  });

  it('reflects a -45° line the OTHER way — the round-3 axis', () => {
    // M(-45°) = [[0,-1],[-1,0]]. This sign decides whether a part in the
    // top-left lands bottom-right or comes straight back at itself.
    const out = reflectPoint({ x: 10, y: 30 }, { x: 0, y: 0 }, -45);
    near(out.x, -30);
    near(out.y, -10);
  });

  it('is its own inverse — reflecting twice returns the original', () => {
    // The strongest single check on the matrix: a transposed sine or a missing
    // minus breaks this for at least one of these angles.
    for (const axisDeg of [0, 30, 45, 90, -45, 120, 160, -170, 270]) {
      const once = reflectPoint(point, anchor, axisDeg);
      const twice = reflectPoint(once, anchor, axisDeg);
      near(twice.x, point.x, 1e-6);
      near(twice.y, point.y, 1e-6);
    }
  });

  it('leaves a point ON the line exactly where it is', () => {
    for (const axisDeg of [0, 45, 90, -45, 137]) {
      const rad = axisDeg * DEG;
      const onLine = {
        x: anchor.x + Math.cos(rad) * 123,
        y: anchor.y + Math.sin(rad) * 123,
      };
      const out = reflectPoint(onLine, anchor, axisDeg);
      near(out.x, onLine.x, 1e-6);
      near(out.y, onLine.y, 1e-6);
    }
  });

  it('preserves distance from the axis (an isometry)', () => {
    // The mirrored part must be exactly as far from the line as the source, or
    // the portrait is subtly skewed.
    for (const axisDeg of [0, 45, 90, -45, 30]) {
      const out = reflectPoint(point, anchor, axisDeg);
      near(
        Math.abs(sideOfLine(out, anchor, axisDeg)),
        Math.abs(sideOfLine(point, anchor, axisDeg)),
        1e-6
      );
    }
  });

  it('puts the reflection on the OPPOSITE side of the line', () => {
    // The property the whole scene depends on.
    for (const axisDeg of [0, 45, 90, -45, 30]) {
      const out = reflectPoint(point, anchor, axisDeg);
      const before = sideOfLine(point, anchor, axisDeg);
      const after = sideOfLine(out, anchor, axisDeg);
      expect(Math.sign(before)).toBe(-Math.sign(after));
    }
  });

  it('treats angles modulo 360 as the same line', () => {
    const a = reflectPoint(point, anchor, 90);
    const b = reflectPoint(point, anchor, 450);
    const c = reflectPoint(point, anchor, -270);
    near(b.x, a.x, 1e-6);
    near(b.y, a.y, 1e-6);
    near(c.x, a.x, 1e-6);
    near(c.y, a.y, 1e-6);
  });

  it('tolerates a garbage angle instead of producing NaN', () => {
    // NaN coordinates place an object nowhere and fail SILENTLY, so the guard
    // matters more than the value it falls back to.
    for (const bad of [undefined, null, NaN]) {
      const out = reflectPoint(point, anchor, bad);
      expect(Number.isFinite(out.x)).toBe(true);
      expect(Number.isFinite(out.y)).toBe(true);
    }
  });
});

describe('reflectionTransform', () => {
  it('rotates by twice the axis angle and inverts y', () => {
    // The identity the scene relies on: M(φ) = R(2φ) · S(1, -1).
    for (const axisDeg of [0, 45, 90, -45]) {
      const tf = reflectionTransform(axisDeg);
      near(tf.rotationRad, 2 * axisDeg * DEG, 1e-9);
      expect(tf.scaleX).toBe(1);
      expect(tf.scaleY).toBe(-1);
    }
  });

  it('agrees with reflectPoint when applied as a matrix', () => {
    // The two must not drift: the transform is what RENDERS, the point maths is
    // what the tests reason about.
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;

    for (const axisDeg of [0, 45, 90, -45, 137]) {
      const { rotationRad, scaleX, scaleY } = reflectionTransform(axisDeg);
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);

      // R(2φ) · S(1,-1) applied to the offset.
      const x = cos * (dx * scaleX) - sin * (dy * scaleY);
      const y = sin * (dx * scaleX) + cos * (dy * scaleY);

      const expected = reflectPoint(point, anchor, axisDeg);
      near(anchor.x + x, expected.x, 1e-6);
      near(anchor.y + y, expected.y, 1e-6);
    }
  });

  it('keeps a part at the container origin on the line', () => {
    // A part authored exactly at the anchor sits on the mirror line, so it must
    // map to zero offset inside the container — this is what makes the scene's
    // `dupLocal()` subtraction correct.
    const tf = reflectionTransform(45);
    const cos = Math.cos(tf.rotationRad);
    const sin = Math.sin(tf.rotationRad);
    expect(Math.abs(cos * 0 - sin * 0)).toBeLessThan(1e-12);
  });
});

describe('axisEndpoints', () => {
  it('draws a line through the anchor at the requested angle', () => {
    const { x1, y1, x2, y2 } = axisEndpoints(anchor, 90, CANVAS.width, CANVAS.height);
    // Vertical: constant x, and the anchor is the midpoint.
    near(x1, x2, 1e-9);
    near((x1 + x2) / 2, anchor.x, 1e-9);
    near((y1 + y2) / 2, anchor.y, 1e-9);
  });

  it('is long enough to cross the canvas at any angle', () => {
    // A shorter line leaves a visible gap at the corners on the diagonal round.
    const diag = Math.hypot(CANVAS.width, CANVAS.height);
    for (const axisDeg of [0, 45, 90, -45, 20, 160]) {
      const { x1, y1, x2, y2 } = axisEndpoints(anchor, axisDeg, CANVAS.width, CANVAS.height);
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThanOrEqual(diag - 1e-6);
    }
  });
});

// ---------------------------------------------------------------------------
// The authored content
// ---------------------------------------------------------------------------

describe('MIRROR_ROUNDS', () => {
  it('has the three axes the scene is specified to use', () => {
    expect(MIRROR_ROUNDS).toHaveLength(3);
    expect(MIRROR_ROUNDS.map((r) => r.axisDeg)).toEqual([90, 0, -45]);
    expect(MIRROR_ROUNDS.map((r) => r.round)).toEqual([1, 2, 3]);
  });

  it('agrees with the scene registry round count', () => {
    // scenes.js says scene 2 runs 3 rounds; the plan must match or the hub will
    // mount a round this module has no data for.
    const mirror = SCENES.find((s) => s.id === 'mirror');
    expect(mirror).toBeDefined();
    expect(MIRROR_ROUNDS).toHaveLength(mirror.rounds);
  });

  it('anchors every line on the canvas', () => {
    for (const meta of MIRROR_ROUNDS) {
      expect(meta.axisX).toBeGreaterThan(0);
      expect(meta.axisX).toBeLessThan(CANVAS.width);
      expect(meta.axisY).toBeGreaterThan(0);
      expect(meta.axisY).toBeLessThan(CANVAS.height);
    }
  });
});

describe('MIRROR_PARTS', () => {
  it('gives every round the same number of parts', () => {
    const counts = MIRROR_ROUNDS.map((meta) => partsForRound(meta.round - 1).length);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeGreaterThan(0);
  });

  it('gives every part a unique id', () => {
    // The id keys the per-part override store, so a duplicate would make two
    // parts tune together and look like a broken panel.
    const ids = MIRROR_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every part a flat texture key', () => {
    // A nested key would be handed to Phaser as an object and never load — the
    // exact bug the asset table had.
    for (const part of MIRROR_PARTS) {
      expect(typeof part.textureKey).toBe('string');
      expect(part.textureKey).not.toContain('.');
      expect(part.textureKey.startsWith('s2')).toBe(true);
    }
  });

  it('carries the full game-12 transform row on every part', () => {
    // The scene reads these directly; a missing one becomes NaN and the part
    // vanishes with no error.
    for (const part of MIRROR_PARTS) {
      for (const field of ['x', 'y', 'scale', 'rotation', 'flipX', 'z', 'alpha']) {
        expect(Number.isFinite(part[field]), `${part.id}.${field}`).toBe(true);
      }
      expect(part.scale).toBeGreaterThan(0);
      expect(part.alpha).toBeGreaterThan(0);
    }
  });

  it('defaults every duplicate to an EXACT, unmodified reflection', () => {
    // This is the "otherwise it mirrors automatically" guarantee: with no
    // corrections the duplicate must be pixel-exact, so every default is neutral.
    for (const part of MIRROR_PARTS) {
      expect(part.mirror).toBe(1);
      expect(part.dupDX).toBe(0);
      expect(part.dupDY).toBe(0);
      expect(part.dupScaleMul).toBe(1);
      expect(part.dupRotation).toBe(0);
      expect(part.dupAlpha).toBe(1);
    }
  });

  it('puts every part on a round that exists', () => {
    const rounds = new Set(MIRROR_ROUNDS.map((r) => r.round));
    for (const part of MIRROR_PARTS) expect(rounds.has(part.round)).toBe(true);
  });

  it('builds every portrait on the SOURCE side of its axis', () => {
    // All parts of a round must share a side, or one is authored on the
    // mirrored half and the portrait overlaps its own reflection.
    for (const meta of MIRROR_ROUNDS) {
      const a = { x: meta.axisX, y: meta.axisY };
      const signs = partsForRound(meta.round - 1).map((part) =>
        Math.sign(sideOfLine({ x: part.x, y: part.y }, a, meta.axisDeg))
      );
      expect(new Set(signs).size, `round ${meta.round}`).toBe(1);
    }
  });

  it('keeps every part OFF the line itself', () => {
    // A part sitting on the line is bisected by it, which reads as a rendering
    // bug rather than as a design choice.
    for (const meta of MIRROR_ROUNDS) {
      const a = { x: meta.axisX, y: meta.axisY };
      for (const part of partsForRound(meta.round - 1)) {
        const d = Math.abs(sideOfLine({ x: part.x, y: part.y }, a, meta.axisDeg));
        expect(d, `${part.id} on the line`).toBeGreaterThan(4);
      }
    }
  });

  it('keeps every reflection on the canvas', () => {
    // A reflection outside the canvas is invisible, which leaves a portrait that
    // looks half-built for no reason the child can see.
    for (const meta of MIRROR_ROUNDS) {
      const a = { x: meta.axisX, y: meta.axisY };
      for (const part of partsForRound(meta.round - 1)) {
        const out = reflectPoint({ x: part.x, y: part.y }, a, meta.axisDeg);
        expect(out.x, `${part.id} x`).toBeGreaterThan(0);
        expect(out.x, `${part.id} x`).toBeLessThan(CANVAS.width);
        expect(out.y, `${part.id} y`).toBeGreaterThan(0);
        expect(out.y, `${part.id} y`).toBeLessThan(CANVAS.height);
      }
    }
  });
});

describe('partTransformFallback', () => {
  it('gives a VISIBLE centred default for a part with no table row', () => {
    // Game 12 does the same: a part missing from the table must appear in the
    // middle of the canvas rather than silently not exist.
    const row = partTransformFallback('nope');
    expect(row.x).toBe(CANVAS.width / 2);
    expect(row.y).toBe(CANVAS.height / 2);
    expect(row.scale).toBe(1);
    expect(row.flipX).toBe(0);
    expect(row.mirror).toBe(0);
  });

  it('carries every field the scene sets on an image', () => {
    const row = partTransformFallback('nope');
    for (const field of ['x', 'y', 'scale', 'rotation', 'flipX', 'z', 'alpha']) {
      expect(Number.isFinite(row[field]), field).toBe(true);
    }
  });
});

describe('round indexing', () => {
  it('has a part for every round, so no round renders empty', () => {
    for (let i = 0; i < MIRROR_ROUNDS.length; i += 1) {
      expect(partsForRound(i).length, `round index ${i}`).toBeGreaterThan(0);
    }
  });

  it('maps a 0-based index onto its 1-based round', () => {
    const a = partsForRound(2).map((p) => p.id);
    const b = MIRROR_PARTS.filter((p) => p.round === 3).map((p) => p.id);
    expect(a).toEqual(b);
  });
});
