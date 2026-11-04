// buildingLayout.js
// Scene 4 ("The Building") — the wall + room geometry, as pure functions.
//
// NO PHASER IMPORT, deliberately. Everything here decides WHERE things are:
// how many wall tiles make the building, where each room's centre lands, how far
// the wall may scroll, and which floor a room is on. Those are the numbers that
// are invisible when wrong — a room half a tile out of step, a scroll range that
// stops one room short, or floor numbering that disagrees with the prompt — and
// they are exactly what a unit test pins.
//
// THE ONE IDEA: the building is built UPWARD from the bottom.
// Rooms are stacked with a fixed gap, the first room's centre is given by
// `firstRoomYFrac`, and the wall's height is derived from the rooms rather than
// being a separate number that can drift out of step with them. Add an eleventh
// room and the wall grows on its own.

// The three wall pieces. Named here rather than in the scene so the layout can
// reason about which tile a y coordinate falls in.
export const WALL_PART = { TOP: 'top', MIDDLE: 'middle', BOTTOM: 'bottom' };

/**
 * How tall one room is drawn, from the room art's own aspect.
 *
 * The WIDTH is the contract (`roomWidth`), so the height follows the image — a
 * room is never squashed to fit a slot. Returns 0 for a missing dimension so a
 * caller can skip rather than place a NaN-sized image.
 */
export function roomHeight(roomWidth, sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) return 0;
  return roomWidth * (sourceHeight / sourceWidth);
}

/**
 * One room's centre, as a canvas y, for a stack that starts at the top.
 *
 * `index` is the ARRAY position: 0 is the top room. Positions come from the
 * cumulative heights, not from `index * step`, because rooms of different
 * aspects have different heights and a fixed step would let the gap drift.
 *
 * @param {number} index        array position, 0 = top
 * @param {number} firstY       centre y of the top room
 * @param {number[]} heights    each room's drawn height, in array order
 * @param {number} gap          gap between rooms, px
 */
export function roomCentreY(index, firstY, heights, gap) {
  if (!Number.isInteger(index) || index <= 0) return firstY;

  let y = firstY;
  for (let i = 0; i < index; i += 1) {
    const h = heights[i] || 0;
    const next = heights[i + 1] || 0;
    // Down by half of this room, the gap, and half of the next room.
    y += h / 2 + gap + next / 2;
  }
  return y;
}

/**
 * Every room's centre y, in one pass.
 *
 * The same arithmetic as `roomCentreY` repeated, done once so the scene does not
 * recompute a cumulative sum per room per frame.
 */
export function roomCentres(firstY, heights, gap) {
  const out = [];
  let y = firstY;

  heights.forEach((h, i) => {
    if (i > 0) y += (heights[i - 1] || 0) / 2 + gap + h / 2;
    out.push(y);
  });

  return out;
}

/**
 * The same stack, laid out from the BOTTOM up instead of the top down.
 *
 * WHY THIS EXISTS: the building is measured from its BASE — the ground floor's
 * distance above the bottom of the wall is a real design decision ("80px from the
 * bottom"), whereas "where the tenth floor's centre happens to land" is a
 * consequence. Anchoring at the bottom makes the authored number the one that is
 * actually honoured, and the top of the stack fall where it falls.
 *
 * The returned array is still in TOP-DOWN order (index 0 = top floor), matching
 * `heights`, so every consumer indexes it the same way as before.
 *
 * @param {number} roomBottomY the BOTTOM edge of the lowest (last) room
 */
export function roomCentresFromBottom(roomBottomY, heights, gap) {
  const out = new Array(heights.length);
  let bottom = roomBottomY;

  for (let i = heights.length - 1; i >= 0; i -= 1) {
    const h = heights[i] || 0;
    out[i] = bottom - h / 2;
    // Step up past this room and the gap above it.
    bottom -= h + gap;
  }

  return out;
}

/**
 * The building's total height, from the top of the first room to the bottom of
 * the last — i.e. the span the WALL must cover to sit behind all of them.
 *
 * The wall's own height is this plus `topPad` and `bottomPad`, so the building has
 * a cap of wall above the top floor and a base below the ground floor.
 */
export function roomsSpan(heights, gap) {
  if (heights.length === 0) return 0;

  const rooms = heights.reduce((sum, h) => sum + h, 0);
  const gaps = gap * Math.max(0, heights.length - 1);
  return rooms + gaps;
}

/**
 * The wall's Y PLAN: where the top cap starts, how many middle tiles are needed,
 * and where the bottom cap ends.
 *
 * THE TOP AND BOTTOM CAPS ARE FIXED HEIGHT (their art's own), so the MIDDLE tiles
 * absorb all slack. `count` is `Math.ceil`, because a partial middle tile is
 * better than a gap — the bottom cap covers the overhang.
 *
 * @returns {{top: number, middleCount: number, span: number}}
 *   `top` is the canvas y of the wall's very top edge, `span` its full height.
 */
export function wallPlan({ wallHeight, topCapHeight, middleTileHeight, bottomCapHeight }) {
  const overhead = topCapHeight + bottomCapHeight;
  const middleSpan = Math.max(0, wallHeight - overhead);

  // A tile height of 0 would divide by zero; treat it as "no middle at all".
  const count =
    middleTileHeight > 0 ? Math.ceil(middleSpan / middleTileHeight) : 0;

  return {
    middleCount: count,
    span: overhead + count * middleTileHeight,
  };
}

/**
 * Every wall tile's centre y and part, in draw order from the top.
 *
 * Returned as data rather than drawn here, so the scene's `applyTuning` can
 * REPOSITION the tiles it already made instead of rebuilding them — dragging a
 * slider must not destroy and recreate twenty images.
 */
export function wallTiles(startY, plan, { topCapHeight, middleTileHeight, bottomCapHeight }) {
  const tiles = [];

  let y = startY;
  if (topCapHeight > 0) {
    tiles.push({ part: WALL_PART.TOP, y: y + topCapHeight / 2, height: topCapHeight });
    y += topCapHeight;
  }

  for (let i = 0; i < plan.middleCount; i += 1) {
    tiles.push({
      part: WALL_PART.MIDDLE,
      y: y + middleTileHeight / 2,
      height: middleTileHeight,
      index: i,
    });
    y += middleTileHeight;
  }

  if (bottomCapHeight > 0) {
    tiles.push({ part: WALL_PART.BOTTOM, y: y + bottomCapHeight / 2, height: bottomCapHeight });
  }

  return tiles;
}

/**
 * How far the wall may scroll, in px: 0 means "content fits, do not move".
 *
 * `viewport` is the visible height MINUS the space the scroll should keep clear at
 * each end, so a room is never flush against the HUD or the very bottom edge.
 */
export function scrollRange(contentHeight, viewportHeight, topInset = 0, bottomInset = 0) {
  const usable = viewportHeight - topInset - bottomInset;
  return Math.max(0, contentHeight - usable);
}

/**
 * The scroll offset at which the content's BOTTOM sits exactly `bottomInset` above
 * the bottom of the viewport — i.e. the farthest the content may travel.
 *
 * WHY THIS EXISTS, AND WHY `scrollRange` IS NOT ENOUGH:
 * `scrollRange` answers "does the content fit inside a band of this height", which
 * is the right question only when the content is centred in the band. The building
 * does NOT start at y=0 — at scroll 0 its top edge is at `contentTop`, below the
 * HUD. So the distance it may travel before its bottom reaches the screen edge is
 *
 *     contentTop + contentHeight - viewportHeight + bottomInset
 *
 * The band form forgets `contentTop`, so the wall stops short of the edge by
 * exactly that much. That is what left a 38px strip of backdrop under the
 * building — it reads as the wall having come loose from the floor.
 */
export function scrollMaxFor(contentTop, contentHeight, viewportHeight, bottomInset = 0) {
  return Math.max(0, contentTop + contentHeight - viewportHeight + bottomInset);
}

/**
 * The FULL scroll range, as `{min, max}`, for content that may start ABOVE the
 * viewport.
 *
 * WHY A RANGE AND NOT JUST A MAXIMUM: the building is tall enough that its top edge
 * sits at a NEGATIVE y at scroll 0 — the content already overlaps the whole viewport,
 * so "how far it can travel before its bottom reaches the edge" is 0, and a `[0, max]`
 * clamp locks the scroll solid. That is exactly what happened when the stack was
 * re-anchored at the bottom: the building loaded correctly and could not be moved.
 *
 * The two limits are:
 *   min — the content's TOP has reached `topInset` (as far up as is useful)
 *   max — the content's BOTTOM has reached `viewport - bottomInset` (flush)
 *
 * `scroll` is defined so the content's y is `-scroll`, hence the signs.
 */
export function scrollBoundsFor(contentTop, contentHeight, viewportHeight, topInset = 0, bottomInset = 0) {
  const min = contentTop - topInset;
  const max = contentTop + contentHeight - viewportHeight + bottomInset;

  // Content shorter than the viewport: pin it rather than inventing a range.
  if (max < min) return { min, max: min };
  return { min, max };
}

/**
 * Clamp an offset into a `{min, max}` range.
 *
 * The building uses this instead of `clampScroll` because its range is two-sided —
 * a lower bound of 0 would refuse to show anything above the initial view, which is
 * most of the building.
 */
export function clampToBounds(offset, bounds) {
  if (!bounds) return 0;
  const value = Number.isFinite(offset) ? offset : bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/** Clamp a scroll offset into `[0, max]`. Keeps a hard stop at both ends. */
export function clampScroll(offset, max) {
  if (!Number.isFinite(offset)) return 0;
  if (max <= 0) return 0;
  return Math.min(max, Math.max(0, offset));
}

/**
 * The floor NUMBER of a room, 1-based, counting from the GROUND floor up.
 *
 * The array is top-down, so the ground floor is the LAST entry. This is the one
 * conversion that matters: a prompt says "third floor" meaning third from the
 * ground, and getting the direction backwards sends the child to the wrong room.
 *
 * @param {number} index   array position, 0 = top
 * @param {number} total   number of rooms
 */
export function floorNumber(index, total) {
  if (!Number.isInteger(index) || !Number.isInteger(total) || total <= 0) return 0;
  if (index < 0 || index >= total) return 0;
  return total - index;
}

/** The array position of a given 1-based floor number, or -1 when out of range. */
export function indexForFloor(floor, total) {
  if (!Number.isInteger(floor) || !Number.isInteger(total) || total <= 0) return -1;
  if (floor < 1 || floor > total) return -1;
  return total - floor;
}

/**
 * A scroll offset that centres `roomY` in the viewport.
 *
 * The scroll moves the CONTENT, so a room further down needs a larger offset;
 * `roomY` is measured from the content's own top, so the two are in one space.
 */
export function scrollToCentre(roomY, contentTopOffset, viewportHeight, topInset = 0, bottomInset = 0) {
  const usable = viewportHeight - topInset - bottomInset;
  const centre = topInset + usable / 2;
  // `contentTopOffset` is where the content's y=0 sits on screen at scroll 0.
  return roomY - (centre - contentTopOffset);
}
