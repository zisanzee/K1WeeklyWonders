// scenes/BuildingScene.js
// Scene 4 of 4 — "The Building".
//
// THE GAME
// A tiled wall fills the screen, ten rooms stacked up its middle with an even
// gap, and the whole thing scrollable so every floor can be reached.
//
// The prompt names a FLOOR ("Which animal is on the third floor?"), the floor
// numbers are painted on the wall beside each room, and three animals stand in a
// shelf along the bottom. The child counts up the wall and taps the animal they
// find there.
//
//   · right  → the disc pops, `pop2` plays, the floor flashes green, next question
//   · wrong  → the disc wobbles, the screen flushes red, a buzzer plays, and the
//              SAME question stays up (tallied in the run's wrong total)
//
// Five questions per run, each about a DIFFERENT floor (see buildingRounds.js),
// so no animal is asked about twice and the previous answer is never still on
// screen when the next question appears.
//
// THE WALL IS TILED, NOT ONE IMAGE. Ten rooms need roughly four screens of
// height. A single stretched wall would smear its brickwork, and one tall texture
// is a large, slow download on a school tablet. Three pieces — a TOP cap, a
// repeating MIDDLE, a BOTTOM cap — cost normal-size images and scale to any
// height, with `Math.ceil` on the middle count so the caps always cover the ends.
//
// THE GEOMETRY IS IN buildingLayout.js, as pure functions with tests: how many
// tiles, where each room's centre lands, the scroll range, and how a floor number
// maps to the array (which is TOP-DOWN, so floor 1 is the LAST room). Those are
// the numbers that are wrong-but-plausible, so they are not computed inline here.
//
// SCROLLING is a vertical drag anywhere on the canvas, with momentum, clamped to
// the building's ends. The wheel works too, so it is usable while tuning on a
// desktop. Both go through one `setScroll` so the clamping cannot be bypassed by
// one of them.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';
import { getBuilding, getBuildingRooms, getHud } from '@/games/game-16/tuning';
import {
  buildFloorPlan,
  optionsFor,
  promptFor,
  splitPromptWords,
} from '@/games/game-16/buildingRounds';
import {
  WALL_PART,
  clampToBounds,
  floorNumber,
  indexForFloor,
  roomCentresFromBottom,
  roomHeight,
  roomsSpan,
  scrollBoundsFor,
  wallPlan,
  wallTiles,
} from '@/games/game-16/buildingLayout';

const CONFIG = SCENES.find((s) => s.id === 'building');

export default class BuildingScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });

    this.tiles = []; // { part, image, height }
    this.rooms = []; // { data, image, index, height }
    this.layerContent = null; // the container everything scrolls inside
    this.scroll = 0;
    this.scrollBounds = 0;
    this.velocity = 0;
    this.drag = null; // { pointerY, startScroll, moved }

    // THE QUESTION. `queued` is this round's one floor; the options and the
    // prompt container are rebuilt whenever it changes.
    this.phase = 'idle'; // 'playing' | 'resolving' | 'winning'
    this.queued = null; // { floor, index, parts } for this round
    this.options = []; // { index, disc, shadow, sprite, bobTween }
    this.promptContainer = null;
    this.floorHighlight = null;
    this.mistakes = 0;
    this.pendingCall = null; // the one delayedCall to cancel on destroy
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  beginRound() {
    this.tiles = [];
    this.rooms = [];
    this.floorNumbers = [];
    this.gapFills = [];
    this.gapEdges = [];
    this.layerContent = null;
    this.scroll = 0;
    this.scrollTarget = 0;
    this.scrollGoal = 0;
    this.scrollBounds = 0;
    this.velocity = 0;
    this.drag = null;

    this.phase = 'idle';
    this.queued = null;
    this.options = [];
    this.floorHighlight = null;

    this.cancelPending();
    this.clearPrompt();
    this.removeListeners();
  }

  /** One delayed call at a time, so a teardown cannot leave a timer to fire. */
  schedule(ms, fn) {
    this.cancelPending();
    this.pendingCall = this.ctx?.scene?.time?.delayedCall(Math.max(0, ms), () => {
      this.pendingCall = null;
      // The layer may already be gone if the hub moved on mid-wait.
      if (this.ctx?.scene) fn();
    });
  }

  cancelPending() {
    this.pendingCall?.remove?.();
    this.pendingCall = null;
  }

  destroy() {
    this.cancelPending();
    this.removeListeners();
    // MOST things live in ctx.layer, which the hub clears and destroys wholesale,
    // so the tiles and rooms need no explicit teardown.
    //
    // THE PROMPT IS THE EXCEPTION: it is added straight to the SCENE (it has to
    // be, or the tan band covers it), so the hub's layer teardown does not reach
    // it. Without this call every round would leave a sentence behind and they
    // would stack up across the run.
    this.clearPrompt();
    this.tiles = [];
    this.rooms = [];
    this.options = [];
    this.floorHighlight = null;
    this.queued = null;
    this.layerContent = null;
    super.destroy();
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  createRound(ctx, round) {
    const t = getBuilding();
    this.meta = { round: round + 1 };

    // A backdrop, so the wall's right-hand position reads as deliberate rather
    // than as a cropped image.
    const { width: W, height: H } = ctx.scene.scale;
    const sky = ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x1e293b).setDepth(-30);
    ctx.layer.add(sky);
    this.sky = sky;

    // ONE CONTAINER carries every tile and room. Scrolling is then a single
    // `y` on this container instead of twenty objects, which is the difference
    // between a smooth swipe and a janky one on a tablet.
    this.layerContent = ctx.scene.add.container(0, 0).setDepth(10);
    ctx.layer.add(this.layerContent);

    this.buildContent(ctx, t);
    this.installScroll(ctx);

    // WHICH FLOOR THIS ROUND ASKS ABOUT.
    //
    // The PLAN for the whole run is generated ONCE and parked in `sceneState`,
    // which survives the hub's destroy/recreate cycle at every round change.
    // Regenerating per round would re-pick the floors each time and could repeat
    // one — so the plan is the thing that makes "five different floors" true.
    this.queued = this.resolveQuestion(round);

    this.buildOptionShelf(ctx, t);
    this.askQuestion(ctx, t);
  }

  /**
   * This round's floor, and the animals to offer for it.
   *
   * Returns null only for a building with no rooms, in which case there is
   * nothing to ask and the scene says so rather than showing an unanswerable row.
   */
  resolveQuestion(round) {
    const rooms = this.rooms;
    if (!rooms.length) return null;

    const state = this.ctx?.sceneState;
    const key = 'buildingFloorPlan';
    const t = getBuilding();

    // A parked plan is reused only if it still describes THIS building: a stale
    // one from a different room count would index past the end.
    let plan = state?.[key];
    if (!Array.isArray(plan) || plan.some((f) => f < 1 || f > rooms.length)) {
      plan = buildFloorPlan(rooms.length, t.roundsPerRun ?? rooms.length);
      if (state) state[key] = plan;
    }

    const floor = plan[round] ?? plan[plan.length - 1];
    if (!floor) return null;

    // FLOOR → ARRAY INDEX. The array is top-down, so floor 1 is the LAST room.
    // Going through `indexForFloor` everywhere would be one conversion too many;
    // doing it once here is the only place it can be got wrong.
    const index = indexForFloor(floor, rooms.length);
    if (index < 0) return null;

    return { floor, index, room: rooms[index] };
  }

  /**
   * Build the wall and the rooms, then lay them out.
   *
   * Sizing comes from the ART's own dimensions, never from guessed numbers: the
   * wall's width is the tuning value and its caps' heights follow their aspect;
   * each room's height follows its own aspect at the tuned width. That is what
   * keeps the building looking right when an image is swapped.
   */
  buildContent(ctx, t) {
    const { width: W, height: H } = ctx.scene.scale;

    // ---- the wall's own sizes, from the art ------------------------------
    const topSrc = this.sourceSize(ctx, 'wallTop');
    const midSrc = this.sourceSize(ctx, 'wallMiddleLoop');
    const botSrc = this.sourceSize(ctx, 'wallBottom');

    // The wall's centre, from its own width and inset — NOT assumed to be the
    // canvas centre, so the wall can be nudged without moving the rooms.
    const wallX = W - t.wallRightInset - t.wallWidth / 2;
    // The rooms' centre is INDEPENDENT of the wall: widening the wall must leave
    // the picture where it is, which is why this is its own tuning value.
    const roomX = W * t.roomCentreXFrac;
    this.roomX = roomX;

    // Each cap keeps its aspect at the wall's width; the middle tile does too.
    const capH = (src) => (src.w ? t.wallWidth * (src.h / src.w) : 0);
    const topCapHeight = capH(topSrc);
    const bottomCapHeight = capH(botSrc);
    const middleTileHeight = capH(midSrc);

    // ---- the rooms -------------------------------------------------------
    // WHICH ROOM IS ON WHICH FLOOR can be randomised, so the building cannot be
    // memorised. The shuffle is done ONCE and parked in `sceneState`, which survives
    // round remounts: re-shuffling per round would move the animals mid-run while
    // the child is looking at them.
    this.roomOrder = this.resolveRoomOrder(getBuildingRooms(), t);

    const roomSrcs = this.roomOrder.map((room) => ({
      room,
      ...this.sourceSize(ctx, room.textureKey),
    }));

    const heights = roomSrcs.map((s) => roomHeight(t.roomWidth, s.w, s.h));
    this.roomHeights = heights;
    this.roomWidth = t.roomWidth;

    // ---- THE STACK, ANCHORED AT THE BOTTOM -------------------------------
    //
    // The ground floor's distance above the bottom of the wall is the AUTHORED
    // number; where the tenth floor lands is then a consequence. Anchoring at the
    // bottom is what makes "80px from the bottom" actually true, rather than an
    // accident of wherever the top room was placed.
    //
    // At scroll 0 the wall's bottom edge is at the canvas bottom, so:
    //   ground floor bottom = canvasHeight - groundRoomBottomGapPx
    const roomBottomY = H - (t.groundRoomBottomGapPx ?? 0);
    this.roomBottomY = roomBottomY;

    // Still returned TOP-DOWN, so every consumer indexes it exactly as before.
    const centres = roomCentresFromBottom(roomBottomY, heights, t.roomGap);
    this.centres = centres;
    this.firstRoomY = centres[0];

    // ---- the wall's plan -------------------------------------------------
    const roomsTotal = roomsSpan(heights, t.roomGap);
    const wallHeight = t.wallTopPadPx + roomsTotal + (t.groundRoomBottomGapPx ?? 0);

    this.plan = wallPlan({
      wallHeight,
      topCapHeight,
      middleTileHeight,
      bottomCapHeight,
    });

    // THE WALL'S TOP COMES FROM THE TOP ROOM, so there is no dead wall above it.
    //
    // The ground floor is pinned by `groundRoomBottomGapPx` (anchored from the
    // bottom), and the wall's TOP is then `wallTopPadPx` above the tenth floor. The
    // middle tiling's ceil overshoot therefore falls BELOW the ground floor, where the
    // bottom cap covers it — rather than a strip of empty wall above the top room,
    // which is what "extra space at the top" was.
    const topRoomTop = centres[0] - (heights[0] || 0) / 2;
    const wallStartY = topRoomTop - t.wallTopPadPx;
    const wallBottomY = wallStartY + this.plan.span;
    this.wallStartY = wallStartY;
    this.wallBottomY = wallBottomY;
    this.contentHeight = this.plan.span;

    // ---- draw the tiles --------------------------------------------------
    this.buildShadow(ctx, t, wallX, wallStartY);

    const tileSpecs = wallTiles(wallStartY, this.plan, {
      topCapHeight,
      middleTileHeight,
      bottomCapHeight,
    });

    this.tiles = tileSpecs.map((spec) => {
      const key = this.textureForPart(spec.part);
      const image = ctx.scene.add
        .image(wallX, spec.y, key)
        .setOrigin(0.5, 0.5)
        .setDepth(0)
        .setAlpha(t.wallAlpha);

      // The tile is drawn at the wall's WIDTH, so its height must follow its own
      // aspect rather than the spec's — a cap that is a different shape than the
      // middle would otherwise be stretched to the middle's tile height.
      const src = spec.part === WALL_PART.TOP ? topSrc : spec.part === WALL_PART.BOTTOM ? botSrc : midSrc;
      if (src.w) image.setScale(t.wallWidth / src.w);

      this.layerContent.add(image);
      return { part: spec.part, image, height: spec.height };
    });

    // ---- draw the rooms --------------------------------------------------
    // `centres` was computed above, bottom-anchored. The rooms are drawn in SLOT
    // order; `shuffleRooms` only changes which ARTWORK lands in which slot.
    this.rooms = roomSrcs.map((s, i) => {
      const image = ctx.scene.add
        .image(roomX, centres[i], s.room.textureKey)
        .setOrigin(0.5, 0.5)
        .setDepth(5)
        .setAlpha(t.roomAlpha);

      if (s.w) image.setScale(t.roomWidth / s.w);

      this.layerContent.add(image);
      return {
        data: s.room,
        image,
        index: i,
        height: heights[i],
        centreY: centres[i],
      };
    });

    // The gap bands go UNDER the rooms (depth 4 vs their 5), so a band can tuck
    // behind the art above and below it without any of its edge showing.
    this.syncGapFills(ctx, t, centres, heights, roomX);

    if (t.showFloorLines) this.drawFloorLines(ctx, t, roomX, centres, heights);
    if (t.showFloorNumbers) this.buildFloorNumbers(ctx, t, centres, heights, roomX);

    // Put the content where the scroll says it should be, and work out how far it
    // may travel. The TARGET starts level with the position, so the easing has
    // nothing to chase until the child touches the screen.
    this.measureScroll(t, H);
    // `startScrollPx` is an OFFSET, but it has to land inside the valid range — at
    // 0 the building's top is far above the viewport, so 0 may not even be reachable.
    this.setScroll((this.scrollBounds?.min ?? 0) + t.startScrollPx);
    // Position, target and goal all start level, so nothing moves until the child
    // touches the screen.
    this.scrollTarget = this.scroll;
    this.scrollGoal = this.scroll;
  }

  // A soft shadow behind the wall, so the building lifts off the backdrop instead
  // of looking pasted on. One rectangle, not a per-tile shadow.
  buildShadow(ctx, t, wallX, wallStartY) {
    if (t.buildingShadowAlpha <= 0) return;

    const shadow = ctx.scene.add
      .rectangle(
        wallX + t.buildingShadowOffsetPx,
        wallStartY + this.plan.span / 2 + t.buildingShadowOffsetPx,
        t.wallWidth,
        this.plan.span,
        0x000000,
        t.buildingShadowAlpha
      )
      .setDepth(-5);

    this.layerContent.add(shadow);
    this.shadow = shadow;
  }

  /**
   * THE FLOOR NUMBERS, in the strip of wall left of the rooms.
   *
   * Each number is horizontally centred in the gap between the SCREEN EDGE and the
   * room's left edge, and vertically centred on its room — so it belongs to that
   * floor however far the building is scrolled.
   *
   * THEY LIVE IN THE SCROLL CONTAINER, deliberately: a number pinned to the screen
   * would sit beside a different room as soon as the wall moved, which is worse
   * than no number at all.
   *
   * NUMBERING runs 1 at the BOTTOM up to `n` at the top. The array is TOP-DOWN, so
   * the label is `total - index` — the same conversion `floorNumber()` does, used
   * here so the picture and the prompts cannot disagree.
   */
  buildFloorNumbers(ctx, t, centres, _heights, roomX) {
    // ONE implementation: the same sync the relayout path uses, so a number can
    // never be styled one way on build and another after a slider move.
    this.floorNumbers = [];
    this.syncFloorNumbers(ctx, t, centres, roomX);
  }

  /**
   * Make the floor numbers match the tuning: create any that are missing, move and
   * restyle the rest, and drop them entirely when they are switched off.
   *
   * Written as a SYNC rather than a rebuild so dragging `floor number size` or
   * `room centre x` repositions ten existing text objects instead of destroying and
   * recreating them — the same reason the wall tiles are synced.
   */
  syncFloorNumbers(ctx, t, centres, roomX) {
    // Off: drop them and forget the references.
    if (!t.showFloorNumbers) {
      (this.floorNumbers || []).forEach((n) => {
        n.text.destroy();
        n.box?.destroy();
      });
      this.floorNumbers = [];
      return;
    }

    const roomLeft = roomX - t.roomWidth / 2;
    // Horizontally centred in the strip between the screen edge and the room.
    const numberX = Math.max(24, roomLeft / 2);
    const count = centres.length;

    this.floorNumbers = this.floorNumbers || [];

    // Grow to the room count. The BOX is created with the text, at depth 6.5 — just
    // behind it — because a Phaser Text has no background of its own.
    while (this.floorNumbers.length < count) {
      const box = ctx.scene.add.graphics().setDepth(6.5);
      this.layerContent.add(box);

      const text = ctx.scene.add
        .text(0, 0, '', { fontSize: '1px', fontFamily: 'Fredoka, sans-serif' })
        .setOrigin(0.5, 0.5)
        .setDepth(7);
      this.layerContent.add(text);

      this.floorNumbers.push({ text, box, index: this.floorNumbers.length });
    }

    // Shrink to it.
    while (this.floorNumbers.length > count) {
      const extra = this.floorNumbers.pop();
      extra.text.destroy();
      extra.box?.destroy();
    }

    // The WIDEST digit string, measured ONCE so every plate can share that width.
    // Done after the texts above have their labels, so the measurement is of the real
    // rendered strings rather than an estimate.
    this.floorNumberBoxWidthFitting = this.floorNumbers.reduce(
      (widest, n) => Math.max(widest, n.text.width || 0),
      0
    );

    this.floorNumbers.forEach((entry, i) => {
      // 1 at the BOTTOM: the array is top-down, so the label counts down the list.
      const label = String(floorNumber(i, count));

      entry.index = i;
      entry.text
        .setText(entry.text.text === label ? entry.text.text : label)
        .setPosition(numberX, centres[i])
        .setStyle({
          fontSize: `${t.floorNumberFontSize}px`,
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: t.floorNumberColor,
          stroke: t.floorNumberStrokeColor,
          strokeThickness: t.floorNumberStrokeThickness,
        })
        .setAlpha(t.floorNumberAlpha);

      // THE PLATE behind the digit.
      //
      // Sized from the TEXT's own measured box plus `boxPadPx`, so changing the font
      // size keeps the plate hugging the number instead of leaving it stranded in a
      // fixed rectangle. Redrawn every sync rather than resized, because a rounded
      // rect has to be re-pathed anyway.
      const box = entry.box;
      if (!box?.active) return;

      if (!t.floorNumberBox) {
        box.clear();
        return;
      }

      const pad = t.floorNumberBoxPadPx ?? 0;

      // ONE WIDTH FOR EVERY PLATE. Sized from the WIDEST digit in the column, not
      // from each plate's own text — otherwise "10" is visibly wider than "1" and the
      // column reads as ragged. Falls back to the plate's own width when the family
      // is mixed-height for some reason.
      const w =
        t.floorNumberBoxWidthPx > 0
          ? t.floorNumberBoxWidthPx
          : (this.floorNumberBoxWidthFitting ?? entry.text.width) + pad * 2;
      const h = entry.text.height + pad * 2;
      const left = numberX - w / 2;
      const top = centres[i] - h / 2;
      const radius = Math.min(t.floorNumberBoxRadius ?? 0, Math.min(w, h) / 2);

      box.clear();
      box.fillStyle(t.floorNumberBoxColor, t.floorNumberBoxAlpha);
      box.fillRoundedRect(left, top, w, h, radius);

      if (t.floorNumberBoxBorderWidth > 0) {
        box.lineStyle(t.floorNumberBoxBorderWidth, t.floorNumberBoxBorderColor, 1);
        box.strokeRoundedRect(left, top, w, h, radius);
      }

      // The plate travels with its floor, exactly like the number on it.
      box.setAlpha(t.floorNumberAlpha);
    });
  }

  /**
   * THE BROWN BANDS IN THE GAPS between floors.
   *
   * One rectangle per gap, sitting exactly where `roomGap` leaves empty wall, so the
   * floors read as separated by a floor slab. The band is drawn at depth 4 — BELOW
   * the rooms (depth 5) — and grown by `gapFillPadPx` vertically, so its edges tuck
   * under the room art and no hairline of wall shows at the seam.
   *
   * The band is POSITIONED from the two room centres it separates, not from a
   * running total: `(upperBottom + lowerTop) / 2` is the gap's exact centre, so it
   * stays centred whatever the two rooms' heights are.
   *
   * Synced rather than rebuilt, like the tiles and the numbers, so a slider drag
   * moves eight existing rectangles instead of recreating them.
   */
  syncGapFills(ctx, t, centres, heights, roomX) {
    // One fewer band than rooms: the gaps BETWEEN them.
    const wanted = t.gapFill ? Math.max(0, centres.length - 1) : 0;

    this.gapFills = this.gapFills || [];

    while (this.gapFills.length > wanted) {
      this.gapFills.pop().destroy();
    }
    while (this.gapFills.length < wanted) {
      const rect = ctx.scene.add.rectangle(0, 0, 1, 1, t.gapFillColor, 1).setDepth(4);
      this.layerContent.add(rect);
      this.gapFills.push(rect);
    }

    if (wanted === 0) return;

    const width = t.roomWidth * (t.gapFillWidthFrac ?? 1);
    // The band fills the gap PLUS the pad at each end, so it slides under the art.
    const bandH = Math.max(1, (t.roomGap ?? 0) + (t.gapFillPadPx ?? 0) * 2);

    this.gapFills.forEach((rect, i) => {
      const upperBottom = centres[i] + heights[i] / 2;
      const lowerTop = centres[i + 1] - heights[i + 1] / 2;
      const midY = (upperBottom + lowerTop) / 2;

      rect
        .setPosition(roomX, midY)
        .setSize(width, bandH)
        .setFillStyle(t.gapFillColor, t.gapFillAlpha)
        .setDepth(4);

      // The edge is a second, slightly taller/darker rectangle BEHIND the first, so
      // the band reads as a slab with thickness. No stroke call, because a stroke on
      // a rectangle is centred on its border and would show inside the band.
      if (t.gapFillEdgeWidth > 0) {
        const edge = this.gapEdges?.[i];
        const edgeH = bandH + t.gapFillEdgeWidth * 2;
        if (!edge) {
          const made = ctx.scene
            .add.rectangle(roomX, midY, width, edgeH, t.gapFillEdgeColor, t.gapFillAlpha)
            .setDepth(3.5);
          this.layerContent.add(made);
          this.gapEdges = this.gapEdges || [];
          this.gapEdges[i] = made;
        } else {
          edge
            .setPosition(roomX, midY)
            .setSize(width, edgeH)
            .setFillStyle(t.gapFillEdgeColor, t.gapFillAlpha)
            .setVisible(true);
        }
      } else if (this.gapEdges?.[i]) {
        this.gapEdges[i].setVisible(false);
      }
    });

    // Drop any surplus edges too.
    if (this.gapEdges) {
      while (this.gapEdges.length > wanted) this.gapEdges.pop()?.destroy();
    }
  }

  // Faint separators between floors, so counting them is easy. Off by default.
  drawFloorLines(ctx, t, wallX, centres, heights) {
    const g = ctx.scene.add.graphics().setDepth(6);
    this.layerContent.add(g);

    centres.forEach((y, i) => {
      if (i === 0) return;
      // Halfway up the gap above this room.
      const lineY = y - heights[i] / 2 - t.roomGap / 2;
      g.lineStyle(t.floorLineWidth, t.floorLineColor, t.floorLineAlpha);
      g.beginPath();
      g.moveTo(wallX - this.roomWidth / 2, lineY);
      g.lineTo(wallX + this.roomWidth / 2, lineY);
      g.strokePath();
    });
  }

  // The texture key for a wall part.
  textureForPart(part) {
    if (part === WALL_PART.TOP) return 'wallTop';
    if (part === WALL_PART.BOTTOM) return 'wallBottom';
    return 'wallMiddleLoop';
  }

  sourceSize(ctx, key) {
    if (!key || !ctx.scene.textures.exists(key)) return { w: 0, h: 0 };
    const src = ctx.scene.textures.get(key).getSourceImage();
    return { w: src?.width || 0, h: src?.height || 0 };
  }

  /**
   * Which room goes in which floor slot.
   *
   * With `shuffleRooms` off this is the authored order. With it on, the pool is
   * shuffled ONCE per run and parked in the hub's run-level `sceneState` — which
   * survives round remounts. Shuffling per round would move the animals between
   * rounds while the child is looking at them.
   *
   * The shuffle swaps WHOLE ROOM ROWS (art plus name), never their slots: the floor
   * NUMBER belongs to the slot, so "floor 3" keeps its place in the building.
   *
   * Fisher–Yates from the last index down, so every permutation is equally likely —
   * a naive `sort(() => Math.random() - 0.5)` is biased and would favour some
   * arrangements.
   */
  resolveRoomOrder(rooms, t) {
    const state = this.ctx?.sceneState;
    if (!state || !t.shuffleRooms) return rooms;

    const key = 'buildingRoomOrder';
    const parked = state[key];
    // Reuse a parked order only if it still holds exactly these rooms.
    if (Array.isArray(parked) && parked.length === rooms.length) {
      const byId = new Map(rooms.map((r) => [r.id, r]));
      const restored = parked.map((id) => byId.get(id)).filter(Boolean);
      if (restored.length === rooms.length) return restored;
    }

    const out = [...rooms];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }

    state[key] = out.map((r) => r.id);
    return out;
  }

  /**
   * How far the building may scroll, and where its ends land.
   *
   * THE INSETS ARE WHAT "STUCK TO THE END" MEANS. At max scroll the content's
   * BOTTOM lands at `H - bottomInset`, so a bottom inset of 0 puts the wall's
   * bottom cap FLUSH against the screen edge. Any inset there leaves a strip of
   * backdrop under the building, which reads as the wall having come loose.
   *
   * The travel is measured from `wallStartY` — where the content actually begins
   * at scroll 0 — not from y=0. Forgetting that offset is what left a 38px gap
   * under the wall.
   */
  measureScroll(t, H) {
    const bottomInset = H * (t.scrollBottomInsetFrac ?? 0);
    this.scrollTopInset = H * (t.scrollTopInsetFrac ?? 0);
    this.scrollBottomInset = bottomInset;

    // TWO-SIDED. The building is taller than the viewport AND starts above it, so
    // the range is `[min, max]` — a lower bound of 0 would refuse to show anything
    // above the initial view, which is most of the building. (A one-sided `[0, max]`
    // clamp is what made the scroll feel dead: max came out 0, so it could not move
    // at all.)
    this.scrollBounds = scrollBoundsFor(
      this.wallStartY,
      this.contentHeight,
      H,
      this.scrollTopInset,
      bottomInset
    );
  }

  /**
   * The ONE way the content moves.
   *
   * Every path — drag, momentum, wheel, `startScrollPx` — goes through here, so
   * clamping cannot be skipped by one of them. Clamping matters: without it a
   * child can swipe the building entirely off screen and has no cue to swipe back.
   */
  setScroll(value) {
    const t = getBuilding();
    const next = t.clampScroll ? clampToBounds(value, this.scrollBounds) : value;

    this.scroll = next;
    if (this.layerContent?.active) this.layerContent.y = -next;
    return next;
  }

  /**
   * Ask the content to travel to `value`.
   *
   * This is the EASED path: it records a TARGET and `update()` chases it, so the
   * motion spreads over a few frames instead of snapping. Everything the finger
   * does, and the wheel, goes through here — `setScroll` stays as the immediate
   * form used for the initial placement and for clamping after a rebuild.
   */
  requestScroll(value) {
    const t = getBuilding();
    // `scrollGoal` is where the finger WANTS the content; `scrollTarget` is where
    // it is allowed to be right now. update() ramps the second toward the first,
    // and that ramp is the acceleration.
    this.scrollGoal = t.clampScroll ? clampToBounds(value, this.scrollBounds) : value;

    // With acceleration off, the target tracks the goal exactly — the old,
    // immediately-responsive behaviour.
    if (!(t.scrollAccel > 0)) this.scrollTarget = this.scrollGoal;
  }

  // ---------------------------------------------------------------------------
  // SCROLLING
  // ---------------------------------------------------------------------------
  installScroll(ctx) {
    const scene = ctx.scene;

    this.onDown = (pointer) => {
      if (this.devDrag) return;
      this.drag = { pointerY: pointer.y, startScroll: this.scroll, moved: false };
      this.velocity = 0;
    };

    this.onMove = (pointer) => {
      if (!this.drag || this.devDrag) return;
      const t = getBuilding();
      // Dragging DOWN moves the content down, i.e. scrolls toward the TOP of the
      // building — so the scroll offset decreases as the pointer's y increases.
      // GAIN multiplies the finger's travel, so the building covers more ground for
      // the same gesture — the "faster" half of the request. Sensitivity divides it,
      // for when the movement needs to be finer.
      const gain = Number.isFinite(t.scrollGain) ? t.scrollGain : 1;
      const dy =
        ((pointer.y - this.drag.pointerY) * gain) / (t.scrollSensitivity || 1);
      if (Math.abs(dy) > 2) this.drag.moved = true;

      // EASED, not immediate: the goal is where the finger is, the target ramps
      // toward it (acceleration) and the content chases the target (smoothing).
      this.requestScroll(this.drag.startScroll - dy);
    };

    this.onUp = (pointer) => {
      if (!this.drag) return;
      const t = getBuilding();
      const moved = this.drag.moved;
      this.drag = null;

      if (!moved || !t.momentum) return;

      // Momentum: the last movement's velocity carries on, so a flick travels.
      // Read from the pointer's own travel since the last move, not from a
      // timer — a single flick then decays naturally.
      this.velocity = -(pointer.y - this.lastPointerY || 0);
    };

    this.onWheel = (_pointer, _objects, _dx, dy) => {
      const t = getBuilding();
      if (!t.scrollWheel) return;
      // Stepped through the GOAL, so a burst of wheel events accumulates into one
      // movement instead of fighting itself (and the acceleration then smooths the
      // whole burst).
      this.requestScroll((this.scrollGoal ?? this.scroll) + dy);
    };

    this.onPointerMoveTrack = (pointer) => {
      this.lastPointerY = pointer.y;
    };

    if (getBuilding().scrollSwipe) {
      scene.input.on('pointerdown', this.onDown);
      scene.input.on('pointermove', this.onMove);
      scene.input.on('pointerup', this.onUp);
    }
    scene.input.on('pointermove', this.onPointerMoveTrack);
    scene.input.on('wheel', this.onWheel);
  }

  update(_ctx, _time, delta) {
    const t = getBuilding();
    // One clamped step, regardless of frame rate: a backgrounded tab hands back a
    // huge delta on return, and an unclamped one would teleport the building.
    const dt = Math.min(delta, 50) / 16.666;

    // MOMENTUM runs on the GOAL, not the visible position, so a flick and a swipe
    // compose instead of fighting: the glide continues from wherever the finger
    // left it.
    if (!this.drag && Math.abs(this.velocity) > 0) {
      this.scrollGoal = clampToBounds((this.scrollGoal ?? this.scroll) + this.velocity * dt, this.scrollBounds);

      // `scrollEaseOut` bleeds the glide off as well as the decay, so it settles
      // rather than stopping dead.
      this.velocity *= Math.pow(t.momentum, dt);
      if (t.scrollEaseOut > 0) this.velocity *= 1 - Math.min(0.9, t.scrollEaseOut * dt);

      if (Math.abs(this.velocity) < t.momentumMinPx) this.velocity = 0;
    }

    // STAGE 1 — ACCELERATION. The target ramps toward the goal rather than jumping
    // to it, which is what makes the START of a swipe smooth instead of twitchy.
    // Frame-rate independent: the per-60fps fraction is raised to the number of
    // frames this one represents.
    const accel = Number.isFinite(t.scrollAccel) ? Math.min(0.95, Math.max(0, t.scrollAccel)) : 0;
    const goal = this.scrollGoal ?? this.scroll;

    if (accel > 0) {
      const goalDiff = goal - (this.scrollTarget ?? this.scroll);
      if (Math.abs(goalDiff) < 0.5) {
        this.scrollTarget = goal;
      } else {
        const accelFactor = 1 - Math.pow(1 - accel, dt);
        this.scrollTarget = (this.scrollTarget ?? this.scroll) + goalDiff * accelFactor;
      }
    } else {
      this.scrollTarget = goal;
    }

    // THE EASED CHASE. The visible position moves a fraction of the remaining
    // distance each frame, which is what makes a swipe feel like sliding something
    // with weight. `scrollSmoothing` 0 means "snap" (1:1 with the finger).
    const target = this.scrollTarget ?? this.scroll;
    const diff = target - this.scroll;

    if (Math.abs(diff) < 0.5) {
      if (this.scroll !== target) this.setScroll(target);
      return;
    }

    const smoothing = Number.isFinite(t.scrollSmoothing) ? Math.min(0.95, Math.max(0, t.scrollSmoothing)) : 0.22;
    // Frame-rate independent: the fraction applied per 60fps frame, raised to the
    // number of frames this one represents.
    const factor = smoothing <= 0 ? 1 : 1 - Math.pow(1 - smoothing, dt);

    this.setScroll(this.scroll + diff * factor);
  }

  removeListeners() {
    const scene = this.ctx?.scene;
    if (scene?.input) {
      if (this.onDown) scene.input.off('pointerdown', this.onDown);
      if (this.onMove) scene.input.off('pointermove', this.onMove);
      if (this.onUp) scene.input.off('pointerup', this.onUp);
      if (this.onWheel) scene.input.off('wheel', this.onWheel);
      if (this.onPointerMoveTrack) scene.input.off('pointermove', this.onPointerMoveTrack);
      if (this.onDevDown) scene.input.off('pointerdown', this.onDevDown);
    }
    this.onDown = null;
    this.onMove = null;
    this.onUp = null;
    this.onWheel = null;
    this.onPointerMoveTrack = null;
    this.onDevDown = null;
    this.devDrag = null;
    this.drag = null;
  }

  // ---------------------------------------------------------------------------
  // THE QUESTION
  // ---------------------------------------------------------------------------
  /**
   * The shelf the option row stands on.
   *
   * The discs overlap the bottom of the wall, and without a surface behind them
   * three circles look dropped onto a brickwork photo rather than placed. A
   * full-width band makes the overlap deliberate: this is a shelf at the bottom
   * of the screen, and the building continues behind it.
   *
   * Drawn at depth 12 — above the scrolling content (10) but below the discs
   * (20) — so it hides the wall it covers without hiding the options.
   */
  buildOptionShelf(ctx, t) {
    const { width: W, height: H } = ctx.scene.scale;
    const height = t.optionShelfHeight ?? 0;

    // REBUILT, so the old one must go first. `applyTuning` calls this on every
    // slider move, and creating a Graphics per move without destroying the last
    // would stack a hundred of them on the canvas during one drag.
    this.shelf?.destroy?.();
    this.shelf = null;

    if (height <= 0) return;

    const g = ctx.scene.add.graphics().setDepth(12);
    g.fillStyle(t.optionShelfColor, t.optionShelfAlpha);
    g.fillRect(0, H - height, W, height);

    // A lighter lip along the top, so the shelf reads as a ledge with thickness
    // rather than as a translucent wash across the bottom of the screen.
    if (t.optionShelfEdgeWidth > 0) {
      g.fillStyle(t.optionShelfEdgeColor, 1);
      g.fillRect(0, H - height, W, t.optionShelfEdgeWidth);
    }

    ctx.layer.add(g);
    this.shelf = g;
  }

  /** Draw the prompt, then the options for the round's floor. */
  askQuestion(ctx, t) {
    this.phase = 'playing';
    if (!this.queued) {
      // A building with no rooms: say so rather than showing an empty question.
      ctx.setPrompt('');
      this.clearPrompt();
      return;
    }

    this.highlightFloor(ctx, t);
    this.renderPrompt(ctx, t);
    this.buildOptions(ctx, t);
  }

  /**
   * The prompt, drawn word by word so the ordinal can be bigger and its own
   * colour.
   *
   * WHY NOT `ctx.setPrompt`: the hub's prompt is ONE Text object, and Phaser has
   * no inline styling — a single string cannot have one word at 1.45× in another
   * colour. So the sentence is measured and laid out here, then the hub's own
   * line is cleared so the two do not both show.
   *
   * The layout reads the SAME per-scene prompt values the hub does
   * (`promptYFrac`, `promptWrapFrac`, `promptAlign`), so this sits exactly where a
   * plain prompt would.
   */
  renderPrompt(ctx, t) {
    this.clearPrompt();
    const { text, emphasis } = promptFor(this.queued.floor);
    if (!text) return;

    const hud = getHud();
    const block = ctx.sceneTuning || {};
    const { width: W, height: H } = ctx.scene.scale;

    const pick = (perScene, fallback) =>
      Number.isFinite(perScene) && perScene >= 0 ? perScene : fallback;

    const wrapFrac = pick(block.promptWrapFrac, hud.promptWrapFrac);
    const yFrac = pick(block.promptYFrac, hud.promptYFrac);
    const align = typeof block.promptAlign === 'string' ? block.promptAlign : 'center';

    const bodySize = hud.promptFontSize;
    const emSize = Math.round(bodySize * (t.emphasisSizeMul ?? 1.45));
    const gap = Math.max(4, bodySize * 0.26);
    const lineGap = Math.max(6, bodySize * 0.3);
    const colWidth = W * wrapFrac;
    const baseY = H * yFrac;

    // The highlighted word is taller than the line, so the sentence's optical
    // centre is biased by half the difference — that keeps the whole sentence
    // centred on `baseY` rather than its small words only.
    const firstBaseline = baseY - (emSize - bodySize) / 2;

    // ADDED TO THE SCENE, NOT TO `ctx.layer`, AND THAT IS THE WHOLE POINT.
    //
    // The hub's layer container is at depth 10, and a child's depth only sorts
    // WITHIN its own container — it does not lift the child above the container.
    // So a prompt at depth 20 inside a depth-10 layer still draws UNDER the tan
    // band (depth 19), which is exactly why the sentence was invisible: buried,
    // not mis-coloured.
    //
    // Going straight onto the scene puts it genuinely above the band, and lets it
    // share the depth band with the hub's own prompt text. `clearPrompt` then has
    // to destroy it itself, because it is no longer inside the layer the hub
    // clears wholesale.
    const container = ctx.scene.add.container(0, 0).setDepth(25);
    this.promptContainer = container;

    // The plain prompt sits on the tan band, so the body text uses the scene's own
    // dark colour rather than the shared white-on-art default.
    const bodyColor = block.promptColor || hud.promptColor;
    const bodyStroke = block.promptStrokeColor || hud.promptStrokeColor;
    const bodyStrokeWidth =
      Number.isFinite(block.promptStrokeThickness) && block.promptStrokeThickness >= 0
        ? block.promptStrokeThickness
        : hud.promptStrokeThickness;

    const made = splitPromptWords(text, emphasis).map(({ word, isEm }) => {
      const obj = ctx.scene.add.text(0, 0, word, {
        fontSize: `${isEm ? emSize : bodySize}px`,
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: isEm ? t.emphasisColor : bodyColor,
        stroke: isEm ? t.emphasisStrokeColor : bodyStroke,
        strokeThickness: isEm
          ? (t.emphasisStrokeThickness ?? 0)
          : bodyStrokeWidth,
      });
      obj.setOrigin(0, 0.5);
      container.add(obj);
      return { text: obj, w: obj.width, h: obj.height };
    });

    // Wrap into lines ourselves, so the emphasised word is measured at its real
    // size — the hub's word-wrap would use the body size for every word.
    const lines = [];
    let line = { items: [], width: 0, height: 0 };

    made.forEach((item) => {
      const lead = line.items.length ? gap : 0;
      if (line.items.length && line.width + lead + item.w > colWidth) {
        lines.push(line);
        line = { items: [], width: 0, height: 0 };
      }
      const space = line.items.length ? gap : 0;
      line.items.push(item);
      line.width += space + item.w;
      line.height = Math.max(line.height, item.h);
    });
    if (line.items.length) lines.push(line);

    let y = firstBaseline;
    lines.forEach((ln, i) => {
      if (i > 0) y += lines[i - 1].height / 2 + lineGap + ln.height / 2;

      // Lines are centred on the canvas midline, matching `promptAlign: 'center'`
      // with no promptXFrac — the same thing the hub does for a plain prompt.
      let x = (W - ln.width) / 2;
      if (align === 'left') x = W * 0.03;
      else if (align === 'right') x = W * 0.97 - ln.width;

      ln.items.forEach((item) => {
        item.text.setPosition(x, y);
        x += item.w + gap;
      });
    });

    // Clear the hub's own line, so the sentence does not appear twice.
    ctx.setPrompt('');
  }

  clearPrompt() {
    this.promptContainer?.destroy?.(true);
    this.promptContainer = null;
  }

  /**
   * Outline the floor being asked about.
   *
   * The child has to COUNT up the wall to find the answer, and the floor numbers
   * are the aid for that. A soft outline on the target floor confirms they landed
   * on the right one — it does not give the ANIMAL away, which is the part they
   * still have to look at. Drawn inside the scroll container so it travels with
   * the floor, at depth 8 (above the rooms at 5, below the gap bands' edges).
   */
  highlightFloor(ctx, t) {
    this.clearFloorHighlight();
    if (!t.highlightFloor || !this.queued) return;

    const room = this.rooms[this.queued.index];
    if (!room) return;

    const g = ctx.scene.add.graphics().setDepth(8);
    const w = t.roomWidth + 12;
    const h = (room.height || 0) + 12;
    const left = this.roomX - w / 2;
    const top = room.centreY - h / 2;
    const radius = 16;

    g.lineStyle(t.floorHighlightWidth, t.floorHighlightColor, t.floorHighlightAlpha);
    g.strokeRoundedRect(left, top, w, h, radius);

    this.layerContent.add(g);
    this.floorHighlight = g;
  }

  clearFloorHighlight() {
    this.floorHighlight?.destroy?.();
    this.floorHighlight = null;
  }

  /**
   * The option row: one disc per animal on offer, evenly spaced about the canvas
   * midline along the bottom shelf.
   *
   * Each disc is a container so the press pulse and the wobble scale their own
   * shadow with them; the SPRITE is a child, so it is sized relative to the disc
   * rather than to the raw art.
   */
  buildOptions(ctx, t) {
    this.clearOptions();
    if (!this.queued) return;

    const { width: W, height: H } = ctx.scene.scale;
    const rowY = H * (t.optionYFrac ?? 0.885);
    const step = W * (t.optionStepFrac ?? 0.285);
    const count = Math.max(2, t.optionCount ?? 3);

    // `keyOf` makes the row CORRECT as well as well-spread: it tells the picker
    // which texture each room will draw, so it can refuse a distractor that
    // resolves to the same image as the answer. Two of the option assets share a
    // URL, and without this the answer's disc could show the wrong animal.
    const picks = optionsFor(
      this.queued.index,
      this.rooms.length,
      count,
      Math.random,
      (i) => this.rooms[i]?.data?.optionKey || this.rooms[i]?.data?.textureKey
    );

    // Centred about the midline: with three options the offsets are -step, 0, +step.
    const startX = W / 2 - ((picks.length - 1) * step) / 2;

    this.options = picks.map((roomIndex, slot) => {
      const room = this.rooms[roomIndex];
      if (!room) return null;

      const x = startX + slot * step;
      const key = room.data.optionKey || room.data.textureKey;

      const shadow = ctx.scene.add
        .circle(x, rowY + (t.optionShadowDy ?? 0), t.optionRadius, 0x000000, t.optionShadowAlpha ?? 0.22)
        .setDepth(19);
      ctx.layer.add(shadow);

      const disc = ctx.scene.add
        .circle(x, rowY, t.optionRadius, t.optionDiscColor, t.optionDiscAlpha)
        .setStrokeStyle(
          t.optionDiscStrokeWidth,
          t.optionDiscStrokeColor,
          t.optionDiscStrokeAlpha
        )
        .setDepth(20);
      ctx.layer.add(disc);

      // THE TAP TARGET IS A BIGGER, INVISIBLE CIRCLE.
      //
      // A child aiming at a circle lands slightly off it, so the target is the
      // disc's radius times `optionHitPad`. A transparent Arc keeps its own
      // circular hit area, which is what lets this be done without importing
      // Phaser for `Geom.Circle` — these scene modules stay Phaser-free and reach
      // the engine only through `ctx`.
      const hitRadius = t.optionRadius * (t.optionHitPad ?? 1.25);
      const hit = ctx.scene.add.circle(x, rowY, hitRadius, 0xffffff, 0).setDepth(20);
      hit.setInteractive();
      ctx.layer.add(hit);

      // The sprite is fitted to the disc's diameter from its own longer side, so
      // a tall animal and a wide one both sit inside the circle.
      const sprite = ctx.scene.textures.exists(key)
        ? ctx.scene.add.image(x, rowY, key).setDepth(21)
        : null;

      if (sprite) {
        sprite.setScale(this.fitScaleFor(sprite, t));
        ctx.layer.add(sprite);
      }

      const entry = {
        roomIndex,
        isAnswer: roomIndex === this.queued.index,
        x,
        disc,
        hit,
        shadow,
        sprite,
        // The fitted scale, kept so the press pulse can return to EXACTLY the
        // resting size instead of re-deriving it and drifting on every tap.
        restScale: sprite ? sprite.scaleX : 1,
        bobTween: null,
      };

      // A slow bob, so the row reads as tappable. The SPRITE bobs and the disc
      // stays put — the disc is the target, and a moving target is harder to hit.
      if (sprite && (t.optionBobPx ?? 0) > 0) {
        entry.bobTween = ctx.scene.tweens.add({
          targets: sprite,
          y: rowY - t.optionBobPx,
          duration: Math.max(1, t.optionBobMs ?? 1400),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: slot * 180, // a slight stagger, so the row does not pulse in unison
        });
      }

      hit.on('pointerdown', () => this.pressOption(ctx, entry, t));
      hit.on('pointerup', () => this.releaseOption(ctx, entry, t));
      // A finger that lands on a disc and slides off before lifting leaves the
      // press pulse on for good unless it is put back here.
      hit.on('pointerout', () => {
        if (this.phase !== 'playing') return;
        entry.disc.setScale(1);
        entry.sprite?.setScale(entry.restScale);
      });

      return entry;
    }).filter(Boolean);

    void H;
  }

  /**
   * The scale that fits a sprite inside a disc.
   *
   * Sized from the art's LONGER side, so a tall animal and a wide one both sit
   * inside the circle rather than one of them spilling over the rim.
   */
  fitScaleFor(sprite, t) {
    const target = t.optionRadius * 2 * (t.optionSpriteFrac ?? 0.78);
    return Math.min(
      target / Math.max(1, sprite.width),
      target / Math.max(1, sprite.height)
    );
  }

  clearOptions() {
    this.options.forEach((entry) => {
      entry.bobTween?.remove?.();
      entry.bobTween = null;
      entry.hit?.destroy?.();
      entry.disc?.destroy?.();
      entry.shadow?.destroy?.();
      entry.sprite?.destroy?.();
    });
    this.options = [];
  }

  /** Press feedback: the disc grows slightly, so the tap is acknowledged. */
  pressOption(ctx, entry, t) {
    if (this.phase !== 'playing') return;
    const scale = t.optionPressScale ?? 1.08;
    entry.disc.setScale(scale);
    entry.sprite?.setScale(entry.restScale * scale);
  }

  /**
   * The answer, on RELEASE.
   *
   * Released rather than pressed, so a finger that lands on the wrong disc and
   * slides off before lifting does not score — the same rule as scene 3.
   */
  releaseOption(ctx, entry, t) {
    if (this.phase !== 'playing') return;

    // Back to rest first, whatever happens next.
    entry.disc.setScale(1);
    entry.sprite?.setScale(entry.restScale);

    if (entry.isAnswer) this.correctAnswer(ctx, entry, t);
    else this.wrongAnswer(ctx, entry, t);
  }

  /** Right: pop the disc, play `pop2`, flash green, then the next question. */
  correctAnswer(ctx, entry, t) {
    this.phase = 'resolving';

    // Kill the bob so the pop is not fighting a looping tween for the sprite's y.
    entry.bobTween?.remove?.();
    entry.bobTween = null;

    if (entry.sprite) {
      const base = entry.sprite.scaleX;
      ctx.scene.tweens.add({
        targets: entry.sprite,
        scale: base * (t.correctPopScale ?? 1.16),
        duration: Math.max(1, t.correctPopMs ?? 180),
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => entry.sprite?.setScale(base),
      });
    }

    this.tweenDiscRing(ctx, entry, t.correctFlashColor, t);
    this.playSound(ctx, t.successSound || 'pop2', t.successVolume ?? 0.85);
    this.flash(ctx, t.correctFlashColor, t.correctFlashAlpha, t.correctFlashMs, t.correctFlashHoldMs);

    // Only THIS disc survives the beat — the row is about to be replaced, and
    // leaving the losing options on screen would let a second tap score.
    this.options.forEach((other) => {
      if (other === entry) return;
      other.disc?.disableInteractive?.();
      ctx.scene.tweens.add({
        targets: [other.disc, other.sprite].filter(Boolean),
        alpha: 0,
        duration: Math.max(1, t.correctPopMs ?? 180),
      });
    });

    // THE LAST QUESTION HOLDS LONGER. Every other round only has to separate two
    // questions, but the last one ends the scene — so the finished building stays
    // on screen for a beat before the hub takes over with the run celebration.
    const isLast = this.round >= (CONFIG.rounds || 1) - 1;
    const hold = isLast ? (t.winHoldMs ?? 1000) : (t.nextPromptMs ?? 620);

    this.schedule(Math.max(0, hold), () => {
      ctx.roundComplete({ correct: true, mistakes: this.mistakes || 0 });
    });
  }

  /**
   * Wrong: wobble the disc, flush the screen red, buzz, and LEAVE the same
   * question up. The miss is tallied, and input is locked briefly so a
   * double-tap cannot score twice off the same mistake.
   */
  wrongAnswer(ctx, entry, t) {
    this.phase = 'resolving';

    this.mistakes += 1;
    this.playSound(ctx, t.wrongSound || 'wrong', t.wrongVolume ?? 0.6);
    this.flash(ctx, t.wrongFlashColor, t.wrongFlashAlpha, t.wrongFlashMs, t.wrongFlashHoldMs);
    this.wobbleDisc(ctx, entry, t);

    this.schedule(Math.max(0, t.wrongLockMs ?? 420), () => {
      // Re-enable and keep asking. The prompt, the floor outline and the row are
      // all still exactly as they were.
      this.phase = 'playing';
    });
  }

  // The disc shakes about its own centre and settles exactly back.
  wobbleDisc(ctx, entry, t) {
    // Radians inline rather than `Phaser.Math.DegToRad`: these modules do not
    // import Phaser, and an implicit global would be a hidden dependency.
    const shake = ((t.wrongShakeDeg ?? 8) * Math.PI) / 180;
    const sprite = entry.sprite;

    if (!sprite) {
      ctx.scene.tweens.add({
        targets: entry.disc,
        scale: 0.94,
        duration: Math.max(1, t.wrongWobbleMs ?? 70),
        yoyo: true,
        repeat: t.wrongWobbleRepeats ?? 2,
      });
      return;
    }

    // `x` wobble rather than rotation: a rotated disc would tilt the ART, which
    // reads as the game moving the animal rather than as a "no".
    const baseX = sprite.x;
    const dx = entry.disc.radius * Math.sin(shake) * 0.5;

    ctx.scene.tweens.add({
      targets: sprite,
      x: baseX + dx,
      duration: Math.max(1, t.wrongWobbleMs ?? 70),
      yoyo: true,
      repeat: t.wrongWobbleRepeats ?? 2,
      ease: 'Sine.easeInOut',
      onComplete: () => sprite?.setX(baseX),
    });
  }

  // A ring that expands off the pressed disc, so the right answer is confirmed
  // AT the thing that was tapped rather than only by the screen flash.
  tweenDiscRing(ctx, entry, colour, t) {
    const ring = ctx.scene.add
      .circle(entry.x, entry.disc.y, entry.disc.radius, undefined, 0)
      .setStrokeStyle(6, colour, 1)
      .setDepth(22);
    ctx.layer.add(ring);

    ctx.scene.tweens.add({
      targets: ring,
      scale: 1.45,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    void t;
  }

  // A full-canvas flush, above the art and the shelf but below the HUD.
  flash(ctx, colour, alpha, fadeMs, holdMs) {
    this.flashScreen(ctx, { colour, alpha, fadeMs, holdMs, depth: 45 });
  }

  // One-shot sound, wrapped: audio must never break a round.
  playSound(ctx, key, volume = 1) {
    try {
      const sound = ctx.scene.sound;
      if (!sound || !ctx.scene.cache.audio.exists(key)) return null;
      return sound.play(key, { volume });
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // TUNING (live relayout)
  // ---------------------------------------------------------------------------
  /**
   * Re-lay the building from the current tuning WITHOUT rebuilding it.
   *
   * The tile COUNT can change (a taller building needs more middle tiles), so this
   * adds or removes tiles as required — but it keeps the rooms, which is what
   * makes dragging a slider feel like adjusting the building rather than
   * reloading it.
   */
  applyTuning(ctx) {
    const t = getBuilding();
    if (!this.layerContent?.active) return;

    const { width: W, height: H } = ctx.scene.scale;
    const wallX = W - t.wallRightInset - t.wallWidth / 2;

    // Recompute the plan from the unchanged room art.
    const heights = this.roomHeights || [];
    const topSrc = this.sourceSize(ctx, 'wallTop');
    const midSrc = this.sourceSize(ctx, 'wallMiddleLoop');
    const botSrc = this.sourceSize(ctx, 'wallBottom');

    const capH = (src) => (src.w ? t.wallWidth * (src.h / src.w) : 0);
    const topCapHeight = capH(topSrc);
    const bottomCapHeight = capH(botSrc);
    const middleTileHeight = capH(midSrc);

    // The same bottom-anchored stack as buildContent — ONE formula, so a slider move
    // cannot put the rooms somewhere a fresh build would not.
    //
    // The gap is subtracted ONCE. It used to be subtracted twice here, which put
    // every room `groundRoomBottomGapPx` higher the moment any slider was touched
    // — the building visibly jumped on the first drag.
    const roomBottomY = H - (t.groundRoomBottomGapPx ?? 0);
    this.roomBottomY = roomBottomY;

    const centres = roomCentresFromBottom(roomBottomY, heights, t.roomGap);
    this.centres = centres;
    this.firstRoomY = centres[0];

    const roomsTotal = roomsSpan(heights, t.roomGap);
    const wallHeight = t.wallTopPadPx + roomsTotal + (t.groundRoomBottomGapPx ?? 0);

    this.plan = wallPlan({ wallHeight, topCapHeight, middleTileHeight, bottomCapHeight });

    // Same top anchoring as buildContent: the wall's top follows the tenth floor, so
    // the tiling's overshoot lands under the ground floor and no dead wall appears
    // above the top room.
    const topRoomTop = centres[0] - (heights[0] || 0) / 2;
    const wallStartY = topRoomTop - t.wallTopPadPx;
    const wallBottomY = wallStartY + this.plan.span;
    this.wallStartY = wallStartY;
    this.wallBottomY = wallBottomY;
    this.contentHeight = this.plan.span;

    // Reposition the existing tiles; add or drop middles to match the plan.
    const specs = wallTiles(wallStartY, this.plan, {
      topCapHeight,
      middleTileHeight,
      bottomCapHeight,
    });

    this.syncTiles(ctx, specs, wallX, t, { topSrc, midSrc, botSrc });

    // Rooms follow the new bottom anchor / gap / width. `centres` was computed with
    // the same bottom-anchored formula as buildContent (see above), so a slider can
    // never leave the rooms somewhere a fresh build would not.
    this.roomWidth = t.roomWidth;

    // The rooms keep THEIR OWN x, independent of the wall's width.
    const roomX = W * t.roomCentreXFrac;
    this.roomX = roomX;

    this.rooms.forEach((room, i) => {
      room.centreY = centres[i];
      room.image
        .setPosition(roomX, centres[i])
        .setAlpha(t.roomAlpha);
      const src = this.sourceSize(ctx, room.data.textureKey);
      if (src.w) room.image.setScale(t.roomWidth / src.w);
    });

    // The gap bands follow the rooms they separate.
    this.syncGapFills(ctx, t, centres, heights, roomX);

    // The floor numbers follow their rooms. The strip they sit in is between the
    // screen edge and the room's left edge, so a wider wall or a moved room
    // re-centres them on its own.
    this.syncFloorNumbers(ctx, t, centres, roomX);

    if (this.shadow?.active) {
      this.shadow
        .setPosition(
          wallX + t.buildingShadowOffsetPx,
          wallStartY + this.plan.span / 2 + t.buildingShadowOffsetPx
        )
        .setSize(t.wallWidth, this.plan.span);
      this.shadow.setFillStyle(0x000000, t.buildingShadowAlpha);
      this.shadow.setVisible(t.buildingShadowAlpha > 0);
    }

    this.measureScroll(t, H);
    // Re-clamp ALL THREE: the building may now be shorter than any of them, and a
    // stale goal would send the content accelerating toward an offset that no
    // longer exists.
    this.setScroll(this.scroll);
    this.scrollTarget = this.scroll;
    this.scrollGoal = this.scroll;

    // THE QUESTION follows the picture. The shelf, the floor outline and the option
    // row are all positioned from the same tuning the building just adopted, so
    // dragging a slider moves them live rather than only on the next round.
    //
    // Rebuilt rather than nudged: the discs' hit areas, the shelf's height and the
    // outline's box all derive from several values at once, and a stale one of any
    // of them is what makes a slider look broken. Cheap enough — it is three
    // circles and a rounded rect.
    this.buildOptionShelf(ctx, t);
    if (this.queued) {
      this.highlightFloor(ctx, t);
      this.renderPrompt(ctx, t);
      this.buildOptions(ctx, t);
    }
  }

  /**
   * Make the tile objects match `specs`.
   *
   * Position and scale are applied to the tiles that already exist; only the
   * difference in middle-tile COUNT creates or destroys anything. That keeps a
   * slider drag cheap — the common case changes no count at all.
   */
  syncTiles(ctx, specs, wallX, t, srcs) {
    // Destroy any surplus tiles beyond what the plan needs.
    while (this.tiles.length > specs.length) {
      const extra = this.tiles.pop();
      extra.image.destroy();
    }

    specs.forEach((spec, i) => {
      const src =
        spec.part === WALL_PART.TOP ? srcs.topSrc
          : spec.part === WALL_PART.BOTTOM ? srcs.botSrc
            : srcs.midSrc;

      let tile = this.tiles[i];

      // A tile whose PART changed cannot be reused: it would show the wrong art.
      if (tile && tile.part !== spec.part) {
        tile.image.destroy();
        tile = null;
      }

      if (!tile) {
        tile = {
          part: spec.part,
          image: ctx.scene.add.image(wallX, spec.y, this.textureForPart(spec.part)).setDepth(0),
          height: spec.height,
        };
        this.layerContent.add(tile.image);
        this.tiles[i] = tile;
      }

      tile.height = spec.height;
      tile.image.setPosition(wallX, spec.y).setAlpha(t.wallAlpha);
      if (src.w) tile.image.setScale(t.wallWidth / src.w);
    });
  }

  // The horizontal centre of the wall, so the dev panel's readout and anything
  // else that needs it agree with the build.
  wallCentreX(ctx) {
    const t = getBuilding();
    return ctx.scene.scale.width - t.wallRightInset - t.wallWidth / 2;
  }
}
