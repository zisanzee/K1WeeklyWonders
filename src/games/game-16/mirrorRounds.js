// mirrorRounds.js
// Scene 2 ("Mirror") — the portrait builder's GEOMETRY, and nothing else.
//
// THE DATA TABLES ARE NOT HERE. The rounds and parts live in tuning.js, because
// the dev panel's copy-paste readout prints that whole file back for a one-paste
// save; a table split across two files could not be saved in one paste. Game 12
// keeps its CHARACTERS table in sceneTuning.js for the same reason.
//
// This module is therefore pure maths: no Phaser import, no tuning import, and a
// test can check a reflection without dragging either in.
//
// MODELLED ON GAME 12 (src/games/game-12/GameScene.js), the house pattern for
// composing a picture out of positioned cut-outs. Parts are drawn from a flat
// row of absolute-pixel values (`x, y, scale, rotation, flipX, z`), and a part
// with no row still renders from a VISIBLE centred fallback rather than
// vanishing.
//
// WHERE IT DIFFERS FROM GAME 12 — and why:
// game 12 mirrors individual images with `setFlipX`, which is a left-right flip
// of the ART. This scene needs a true reflection about a LINE that can be
// vertical, horizontal or diagonal, so the duplicate portrait is drawn inside
// one container carrying
//
//     R(2φ) · S(1, -1)
//
// which IS the reflection matrix for a line at angle φ. That means the
// duplicate is exact for every part at any rotation and any scale, and
// "otherwise it mirrors automatically" is what the container does by default —
// the per-part `dup*` fields are only corrections on top of an already-exact
// reflection.
//
const DEG = Math.PI / 180;

// Canvas the tuning numbers are authored against (DEFAULT_BASE_RESOLUTION in
// @/phaser/config). Exported so the scene and the tests agree on one value.
export const CANVAS = { width: 720, height: 1080 };

// ---------------------------------------------------------------------------
// GEOMETRY
// ---------------------------------------------------------------------------

/**
 * Reflect a point about the line through `anchor` at `axisDeg`.
 *
 *   M(φ) = [[cos2φ, sin2φ], [sin2φ, -cos2φ]]
 *
 * Reflecting twice is the identity — the property the tests pin, and the thing
 * that catches a transposed sine or a dropped minus.
 */
export function reflectPoint(point, anchor, axisDeg) {
  const twice = 2 * normalizeDeg(axisDeg) * DEG;
  const cos2 = Math.cos(twice);
  const sin2 = Math.sin(twice);

  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;

  return {
    x: anchor.x + cos2 * dx + sin2 * dy,
    // The minus is on the y term, matching M(φ). Reversing it produces a
    // reflection that still looks plausible on a symmetric portrait and is only
    // obviously wrong on an asymmetric one.
    y: anchor.y + sin2 * dx - cos2 * dy,
  };
}

/**
 * The container transform that reflects its children about `axisDeg`.
 *
 * `M(φ) = R(2φ) · S(1, -1)`, so the answering container is rotated by twice the
 * line angle with its y scale inverted. Nothing else is needed — which is why
 * the duplicate is exact for rotated and scaled parts too.
 */
export function reflectionTransform(axisDeg) {
  return {
    rotationRad: 2 * normalizeDeg(axisDeg) * DEG,
    scaleX: 1,
    // -1, not a part's own scale: this IS the reflection.
    scaleY: -1,
  };
}

/**
 * The two ends of the mirror line, long enough to cross the whole canvas.
 *
 * Length is the canvas DIAGONAL, so any angle reaches both edges — a shorter
 * segment leaves a visible gap at the corners on the diagonal round.
 */
export function axisEndpoints(anchor, axisDeg, width, height) {
  const length = Math.hypot(width, height);
  const rad = normalizeDeg(axisDeg) * DEG;
  const dx = Math.cos(rad) * length * 0.5;
  const dy = Math.sin(rad) * length * 0.5;

  return {
    x1: anchor.x - dx,
    y1: anchor.y - dy,
    x2: anchor.x + dx,
    y2: anchor.y + dy,
  };
}

/**
 * Signed perpendicular distance from `point` to the mirror line.
 *
 * Only the SIGN is load-bearing (which side a point is on); the magnitude is
 * useful for keeping a part off the line itself.
 */
export function sideOfLine(point, anchor, axisDeg) {
  const rad = normalizeDeg(axisDeg) * DEG;
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  // Dot with the unit NORMAL (-sin, cos).
  return -dx * Math.sin(rad) + dy * Math.cos(rad);
}

/**
 * Split the canvas into the two half-planes either side of the mirror line.
 *
 * WHY THIS EXISTS: the two halves are tinted (pastel red on the side being
 * built, pastel blue on the mirrored side) and the line itself is invisible, so
 * the ONLY thing separating them is the colour change. A fill cannot be "half a
 * canvas" for a diagonal line, so the rectangle is clipped by the plane and the
 * result is a polygon Phaser can fill.
 *
 * The clipping is one pass of Sutherland–Hodgman against a single plane, which
 * for a convex rectangle always yields a simple polygon of at most four extra
 * vertices. Done here rather than in the scene because it is exactly the kind of
 * geometry that is wrong-but-plausible: an off-by-one in the intersection maths
 * leaves a hairline gap along the axis that only shows on the diagonal round.
 *
 * @returns {{positive: Array<{x,y}>, negative: Array<{x,y}>}}
 *   `positive` is the side where sideOfLine() is >= 0, `negative` the other.
 *   Either can come back empty when the line misses the canvas entirely.
 */
export function splitCanvas(anchor, axisDeg, width, height) {
  const rect = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const f = (p) => sideOfLine(p, anchor, axisDeg);

  return {
    positive: clipToHalfPlane(rect, f, 1),
    negative: clipToHalfPlane(rect, f, -1),
  };
}

// Keep the part of a polygon where `sign * f(p) >= 0`.
function clipToHalfPlane(poly, f, sign) {
  const inside = (p) => sign * f(p) >= -1e-9;
  const out = [];

  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);

    if (curIn) {
      // Crossing IN: emit the boundary point first, then the vertex.
      if (!prevIn) out.push(crossing(prev, cur, f));
      out.push(cur);
    } else if (prevIn) {
      // Crossing OUT: emit the boundary point and stop contributing this edge.
      out.push(crossing(prev, cur, f));
    }
  }

  return out;
}

// Where segment a→b crosses f = 0.
function crossing(a, b, f) {
  const fa = f(a);
  const fb = f(b);
  const d = fa - fb;
  // Both zero means the edge lies ON the line; picking `a` keeps the polygon
  // closed instead of producing a NaN vertex.
  const t = Math.abs(d) < 1e-12 ? 0 : fa / d;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ---------------------------------------------------------------------------
// ACCESSORS
// ---------------------------------------------------------------------------

/**
 * A VISIBLE centred default for a part with no tuning row.
 *
 * The fallback is deliberately visible rather than blank: a part missing from
 * the table appears in the middle of the canvas at native size, so the omission
 * is obvious instead of being a silently empty portrait. Game 12 does the same
 * in its `partTransform`.
 *
 * The tables themselves live in tuning.js (so the dev panel can print the whole
 * file back), which is why this takes the id rather than reading a table.
 */
export function partTransformFallback(id) {
  return {
    id,
    round: 0,
    textureKey: `s2${id}`,
    x: CANVAS.width / 2,
    y: CANVAS.height / 2,
    scale: 1,
    rotation: 0,
    flipX: 0,
    z: 0,
    alpha: 1,
    mirror: 0,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
  };
}

/** A round clamped into range for a table of `rows`. */
export function roundMeta(round, rows) {
  const list = rows?.length ? rows : [{}];
  const i = clamp(Math.round(round) || 0, 0, list.length - 1);
  return list[i];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Phaser treats rotation as unbounded, so 450 and 90 are the same angle.
// Normalising keeps `2 * axisDeg` sane and stops a slider dragged far round from
// producing a needlessly huge rotation value.
function normalizeDeg(deg) {
  const d = (((Number(deg) || 0) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}
