// GameScene.js
// Game 15 — the exploration mechanic.
//
// What this scene does:
//   • Splits the canvas into three bands: shelf (top 40%), empty prompt space
//     (the next 20%), and character + joystick (bottom 40%).
//   • Builds ONE wide world container (looped supermarket backdrop + shelf art +
//     10 coloured product boxes) that is wider than the screen. Moving the camera is
//     just sliding that container's x.
//   • The character box is NOT in the world: it stays put on screen and only
//     leans a little in the direction of travel, then stops. The WORLD keeps
//     moving, so the character feels like it is exploring the whole area.
//   • A draggable joystick (bottom right) drives the pan. Deflection maps to
//     speed, so a small push creeps and a full push sprints.
//
// EVERY adjustable number lives in `tuning.js`; the pan/camera maths lives in
// `world.js` (pure + unit tested). This file is logic and assembly only.
import * as Phaser from 'phaser';
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import { shelfLayout, ordinalLabel } from '@/games/game-15/world';
import { animationFrames, productKeyFor, PRODUCT_IMAGES } from '@/games/game-15/assets';
import {
  LEVELS,
  TOTAL_ROUNDS,
  buildLevelRounds,
} from '@/games/game-15/levels';
import { makeConfettiTexture, makeConfettiSquareTexture } from '@/phaser/common/sceneAssets';
import {
  SOUND,
  BANDS,
  BACKDROP,
  WORLD,
  SHELF_ART,
  SHELF,
  CHARACTER,
  JOYSTICK,
  CONTROLS,
  EDGE_ARROWS,
  PROMPT,
  CAMERA,
  FLOW,
} from '@/games/game-15/tuning';

// Re-exported so `import GameScene, { BACKGROUND_COLOR }` keeps working for
// Game.jsx — the value itself lives in tuning.js.
export { BACKGROUND_COLOR } from '@/games/game-15/tuning';

// Draws a real ARROW (square shaft + triangular head) into a Graphics.
//
// The arrow is ONE closed polygon, filled and then STROKED along the same path,
// so the outline wraps the whole silhouette as a single continuous line rather
// than being drawn per-piece (two stroked pieces leave a visible seam where the
// shaft meets the head).
//
// Local space: the arrow spans x 0..size, centred on y = 0. `pointsRight` picks
// which end the head is on. Coordinates are built for a RIGHT-pointing arrow and
// mirrored in x for the left one, so there is a single set of vertices to reason
// about:
//
//   [tail ....... shaft ... head>]
//
// The caller positions the container so the shape's OUTER end (the edge-side
// end) sits at x = 0, so both edges grow rightward in local space.
function drawArrowShape(g, size, pointsRight, cfg) {
  const headW = size * cfg.headWidthFrac;
  const headH = size * cfg.headHeightFrac;
  const shaftH = size * cfg.shaftHeightFrac;
  const half = shaftH / 2;
  const headBase = size - headW;

  // Vertices of a right-pointing arrow, clockwise from the tail's top corner.
  // The shaft is square-ended — no corner radius — per the tuning comment.
  const points = [
    [0, -half], // tail, top
    [headBase, -half], // shaft top, where the head begins
    [headBase, -headH / 2], // head base, top (barb)
    [size, 0], // apex
    [headBase, headH / 2], // head base, bottom (barb)
    [headBase, half], // shaft bottom
    [0, half], // tail, bottom
  ];

  // Mirror in x for a left-pointing arrow. One vertex list serves both. Only x is
  // mirrored; y is read straight from `points` when the path is built.
  const xs = points.map(([px]) => (pointsRight ? px : size - px));

  g.beginPath();
  g.moveTo(xs[0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    g.lineTo(xs[i], points[i][1]);
  }
  g.closePath();

  // Fill, then stroke the SAME path for the outline.
  g.fillPath();
  if (cfg.outlineWidth > 0) {
    g.lineStyle(cfg.outlineWidth, cfg.outlineColor, cfg.outlineAlpha);
    g.strokePath();
  }
}

// Bakes a soft-edged white disc once and caches it under a fixed key. This is
// the joystick base's "blur": a radial gradient from a translucent centre to
// fully transparent at the rim, so it fades into whatever is behind it instead
// of ending on a hard edge.
//
// A baked gradient is used rather than a Phaser blur post-FX pipeline because a
// real blur costs frames on low-end tablets, needs a WebGL-only pipeline, and
// would silently do nothing in canvas fallback. A texture is free at runtime and
// renders identically on both.
function makeSoftDiscTexture(scene, glow) {
  const key = 'g15-soft-disc';
  if (scene.textures.exists(key)) return key;

  const r = 64; // baked at a fixed size, then scaled to the joystick radius
  const size = r * 2 * glow.resolution;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const centre = size / 2;

  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre);
  gradient.addColorStop(0, glow.innerColor);
  gradient.addColorStop(glow.midStop, glow.midColor);
  gradient.addColorStop(1, glow.outerColor);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centre, centre, centre, 0, Math.PI * 2);
  ctx.fill();

  scene.textures.addCanvas(key, canvas);
  return key;
}


export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.resetRun();
  }

  // All per-RUN state. Called from the constructor AND at the top of create(),
  // because scene.restart() re-runs create() on the SAME instance (the
  // constructor does not run again) — anything initialised only there would
  // carry over into a replay.
  resetRun() {
    // Camera / world.
    this.world = null; // the pannable container holding backdrop + shelf
    this.layout = null; // shelfLayout() result: widths, pads, product centres
    this.worldWidth = 0;
    this.cameraX = 0; // 0..max, the world container's negative x offset
    this.cameraMin = 0;
    this.cameraMax = 0;

    // Character.
    this.character = null;
    this.characterBaseX = 0;
    this.characterBaseY = 0;
    this.characterSprite = null; // the walk-cycle sprite (null if frames are absent)
    this.idleSprite = null; // the still idle frame, shown when not moving
    this.cartBox = null; // the reference cart box, drawn over the character
    this.cartItems = null; // container holding the products seated in the cart
    this.cartW = 0;
    this.cartH = 0;
    this.cartLocalX = 0; // cart offset from the character's centre
    this.cartLocalY = 0;
    this.cartItemCount = 0; // how many products are seated, drives the stack grid
    this.isIdle = null; // current pose state; null = not yet applied

    // Products + drag.
    this.products = []; // one record per shelf product
    this.productBoxW = 0;
    this.productBoxH = 0;
    this.heldProduct = null; // { product, sprite, pointerId } while dragging
    this.productPointerId = null; // which pointer owns the product drag
    this.characterFacing = 0; // -1 playing backwards, +1 forwards, 0 idle/stopped
    this.heroFrameCount = 0; // number of loaded frames, for the reverse start index
    this.drift = 0; // current lean, eased toward ±WORLD.characterDriftPx

    // Joystick.
    this.joystickBase = null;
    this.joystickGlow = null; // the baked soft-blur disc behind the base ring
    this.joystickKnob = null;
    this.joystickX = 0;
    this.joystickY = 0;
    this.joystickRadius = 0;
    this.joystickPointerId = null; // which pointer owns the drag
    // -1 (full left) .. +1 (full right), 0 at rest. Read once per frame.
    this.axis = 0;

    // Backdrop + decorative edge hints.
    this.backdrop = null; // the looping supermarket tile sprite
    this.leftArrow = null;
    this.rightArrow = null;

    // Level / round / prompt progression.
    this.levelIndex = 0; // index into LEVELS
    this.roundIndex = 0; // index into the current level's rounds
    this.promptIndex = 0; // index into the current round's prompts
    this.listIndex = 0; // index into the current round's lists
    this.roundPlans = []; // buildLevelRounds() for the CURRENT level
    this.currentRound = null;
    this.currentPrompt = null;
    // Direction of the round most recently started, so startRound() can tell
    // whether the counting side actually changed (and only then transition).
    this.lastRoundDirection = null;
    this.mistakes = 0;
    this.roundsCleared = 0;
    this.transitioning = false; // blocks drops during a round/level change
    this.finished = false;
    this.startTime = 0; // run clock, for elapsedSeconds in the completion event
    this.endOverlay = null;

    // Prompt UI.
    this.promptCard = null; // container holding the backing card + words
    this.ordinalText = null;
    this.fromTheText = null;
    this.directionText = null;
    // True once a prompt has been painted, so the NEXT one cross-fades out first
    // instead of overwriting the text in place.
    this.promptVisible = false;
    // Pending fade-out timer, so a new deal can cancel the old one.
    this.promptTransition = null;
    // Reusable full-screen flash veil (scene-level, so it survives world rebuilds).
    this.flashRect = null;
    // time.now deadline until which the character keeps running through a
    // transition, even with the joystick at rest.
    this.celebrationUntil = 0;

    // Shelf ordinal labels + the direction they currently count from. Reset per
    // world rebuild so the first prompt of a round always re-applies its side.
    this.ordinalLabels = [];
    this.ordinalDirection = null;

  }

  create() {
    this.resetRun();
    const { width, height } = this.scale;

    // Flat fill behind everything, so the canvas is never transparent over the
    // platform gradient — and so a failed backdrop texture degrades to a plain
    // colour instead of showing through. The art itself is drawn inside the
    // panned world container (see buildWorld).
    this.add
      .rectangle(width / 2, height / 2, width, height, BACKDROP.color)
      .setDepth(BACKDROP.fillDepth);

    this.buildHeroAnimation();
    this.buildCharacter();
    this.buildJoystick();
    this.bindJoystickInput();
    this.buildPromptUi();
    // Edge arrows must exist BEFORE the first prompt is dealt, because dealing a
    // prompt shows the arrow for its direction.
    this.buildEdgeArrows();

    // Start the run: level 1, round 1. This builds the first shelf too.
    this.startTime = this.time.now;
    this.startLevel(0);

    // Shared bg music + first-tap unlock, plus the shared mute button. Mute is
    // a property of the player (one localStorage key) — never per-game.
    ensureBgMusic(this, SOUND.bgMusicVolume);
    this.input.once('pointerdown', () => ensureBgMusic(this, SOUND.bgMusicVolume));
    addMuteButton(this, CONTROLS.muteX, CONTROLS.muteY, {
      anchor: 'topLeft',
      depth: CONTROLS.muteDepth,
    });

    // Keep the character's "resting" position in sync with any resize.
    this.scale.on('resize', this.layoutCharacter, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layoutCharacter, this));
  }

  // ---------------------------------------------------------------------------
  // Edge arrows — decorative left/right hints pinned to the screen edges.
  // ---------------------------------------------------------------------------

  // Two arrows: RED pinned to the LEFT edge, BLUE pinned to the RIGHT edge, both
  // sitting slightly in from their edge and drawn behind the game content. Built
  // once and animated with ONE tween each, so the cost is a constant two objects
  // and two tweens.
  //
  // Position and direction are stated separately and literally, per edge:
  //   left  → pinned at the left edge,  head at its RIGHT end (points inward)
  //   right → pinned at the right edge, head at its LEFT end  (points inward)
  // `EDGE_ARROWS.pointInward` flips the head to the outer end instead.
  buildEdgeArrows() {
    const { width, height } = this.scale;
    const cfg = EDGE_ARROWS;
    const size = width * cfg.sizeFrac;
    const inset = size * cfg.insetFracOfSize;
    const y = height * cfg.yFrac;

    const makeArrow = (edge) => {
      const onLeft = edge === 'left';

      // An arrow pinned to the left edge has its outer end on the left, so it
      // points inward when its head is on the RIGHT, and outward when the head is
      // on the LEFT. The right edge is the mirror of that.
      const headOnRight = onLeft ? cfg.pointInward : !cfg.pointInward;

      const g = this.add.graphics();
      g.fillStyle(cfg.colors[edge], 1);
      drawArrowShape(g, size, headOnRight, cfg);

      // The shape spans local x 0..size with its OUTER end at 0, so the container
      // is simply placed at the inset from the arrow's own edge.
      const anchorX = onLeft ? inset : width - inset - size;

      const container = this.add
        .container(anchorX, y)
        .setDepth(cfg.depth)
        .setAlpha(cfg.alpha);
      container.add(g);

      // One looping tween per arrow: a small outward drift plus a fade, so it
      // reads as a gentle nudge rather than a blinking UI element.
      const outward = edge === 'left' ? -cfg.pulseDistancePx : cfg.pulseDistancePx;
      this.tweens.add({
        targets: container,
        x: container.x + outward,
        alpha: cfg.alphaMin,
        duration: cfg.halfCycleMs,
        ease: cfg.ease,
        yoyo: true,
        repeat: -1,
      });

      return container;
    };

    this.leftArrow = makeArrow('left');
    this.rightArrow = makeArrow('right');
  }

  // ---------------------------------------------------------------------------
  // World — looped backdrop + shelf, all inside one pannable container
  // ---------------------------------------------------------------------------

  // Rebuilds the whole pannable world for the round about to be played: the
  // backdrop, the shelving, the ordinal labels and one product per slot.
  //
  // Called for the FIRST round and again for every subsequent round, so it must
  // be safe to run repeatedly — the previous container is destroyed first.
  //
  // `startDirection` is the side the round counts from. The shelf is framed at
  // that end from the very first frame, so a "from the right" round starts at the
  // RIGHT end of the shelf (see CAMERA.startAtDirectionEnd). The default keeps
  // the old always-start-left rule for any caller that has no direction yet.
  buildWorld(round, startDirection = 'left') {
    const { height } = this.scale;
    const shelfBottom = height * BANDS.shelfEndFrac;
    const boxH = height * SHELF.boxHeightFrac;

    // Tear down the previous world (and its masks/children) before rebuilding.
    if (this.world) {
      this.world.destroy(true);
      this.world = null;
    }

    // Shelf + camera geometry for THIS round's product count. `minPad` is the
    // only design input; shelf length, symmetric margins and camera range are
    // solved from it and the product count.
    this.layout = shelfLayout({
      screenWidth: this.scale.width,
      count: round.products,
      visible: WORLD.visibleProducts,
      minPad: SHELF.sidePadFracOfCell * (this.scale.width / WORLD.visibleProducts),
      marginEach: this.scale.width * SHELF.endMarginFracOfScreen,
    });
    this.worldWidth = this.layout.worldWidth;
    this.cameraMin = this.layout.cameraMin;
    this.cameraMax = this.layout.cameraMax;
    // Start parked at the end this round counts from, so the child never has to
    // travel to the right end before they can begin counting from the right.
    this.cameraX = this.cameraStartFor(startDirection);

    const boxW = this.layout.cell * SHELF.boxWidthFracOfCell;
    this.productBoxW = boxW;
    this.productBoxH = boxH;

    // Children are drawn in insertion order (Phaser does not sort a container's
    // children), so this order IS the z-order: backdrop → shelf art → labels →
    // products.
    this.world = this.add.container(0, 0);
    this.products = [];
    // The label set was destroyed with the old world, so forget both the array
    // and the remembered direction (a rebuilt shelf starts in default order).
    this.ordinalLabels = [];
    this.ordinalDirection = null;
    this.clearCartItems();

    // The supermarket backdrop, tile-sprited across the FULL world width and
    // canvas height. A TileSprite repeats its texture automatically, so the art
    // loops horizontally for however wide the world is — and keeps looping as
    // the camera pans, because it scrolls with this container.
    //
    // scaleY is derived from the canvas height rather than the world width, so
    // one copy of the art spans exactly one screen height at any aspect ratio;
    // scaleX is matched to it so the art is never stretched.
    if (this.textures.exists(BACKDROP.key)) {
      const source = this.textures.get(BACKDROP.key).getSourceImage();
      const scaleY = height / source.height;
      const backdrop = this.add
        .tileSprite(0, BACKDROP.offsetY, this.worldWidth, height, BACKDROP.key)
        .setOrigin(0, 0)
        .setAlpha(BACKDROP.alpha);
      backdrop.tileScaleY = scaleY;
      backdrop.tileScaleX = scaleY;
      this.world.add(backdrop);
      this.backdrop = backdrop;
    }

    // The painted shelving, and the y the products stand on. Both come from
    // whichever path succeeded, so the boxes always rest on a real board.
    const rowSurfaceY = this.buildShelfArt(shelfBottom);

    // The products, laid out from the same maths the tests exercise. Each is a
    // single Graphics (rounded fill + outline together) so the corners are
    // genuinely rounded rather than a square fill behind a round outline.
    //
    // `productsOffsetY` moves ONLY the boxes, independently of the shelving
    // artwork, so a row that sits too low can be lifted without disturbing the
    // shelf itself.
    const boxY = rowSurfaceY - SHELF.restsOnRowNudgeY - boxH / 2 + SHELF_ART.productsOffsetY;

    // The BOTTOM edge of the slot is the alignment line every product shares, so
    // art of different heights all sits ON the board rather than floating at
    // different heights. `boxY` is the slot's centre; the baseline is below it.
    const baselineY = boxY + boxH / 2;

    // Ordinal labels are added BEFORE the products so they draw behind the art:
    // a tall product overlaps its own label instead of the label sitting on top
    // of it. One label per slot, centred on the same x as the product.
    this.buildOrdinalLabels(baselineY, boxH, round.products);

    // One product per slot. `round.lineup[i]` is the ART index for slot i, so a
    // level can shuffle which image sits where without changing the count.
    for (let i = 0; i < round.products; i += 1) {
      // Centres come from the layout, so the row is provably centred on the art.
      // All coordinates are in WORLD space (this container is panned, not the
      // camera), which is what the drag maths converts from.
      const cx = this.layout.productCenters[i];
      const artIndex = round.lineup[i] ?? i;
      const key = productKeyFor(artIndex);

      // Fall back to a plain box if this product's texture is missing, so a bad
      // URL shows up as a visible placeholder rather than an invisible item.
      if (!key || !this.textures.exists(key)) {
        const fallback = this.add.graphics();
        const colour = SHELF.colors[i % SHELF.colors.length];
        // Drawn from the baseline upward, matching the sprites' alignment.
        fallback.fillStyle(colour, 1);
        fallback.fillRoundedRect(cx - boxW / 2, baselineY - boxH, boxW, boxH, SHELF.radius);
        this.world.add(fallback);
        this.products.push({
          index: i,
          x: cx,
          baselineY,
          key: null,
          box: fallback,
          taken: false,
        });
        continue;
      }

      // Origin (0.5, 1) = horizontally centred, BOTTOM-anchored, so positioning
      // at the baseline aligns every product along its base regardless of the
      // art's own height. This is what stops tall items floating and short items
      // sinking relative to each other.
      const sprite = this.add.image(cx, baselineY, key).setOrigin(0.5, 1);
      // Fit inside the slot without distorting: scale by the smaller ratio.
      const scale = Math.min(boxW / sprite.width, boxH / sprite.height);
      sprite.setScale(scale);

      this.world.add(sprite);
      this.products.push({ index: i, x: cx, baselineY, key, box: sprite, taken: false });
    }

    // Apply the camera offset AFTER the container exists. A round starts at the
    // end of the shelf matching its counting side, so the child always begins
    // where counting is easiest.
    this.world.x = -this.cameraX;
  }

  // The camera x that frames the shelf's end for a given counting side:
  //   'left'  → the START of the world (cameraX = min)
  //   'right' → the END of the world (cameraX = max, minus a small inset)
  //
  // The ONLY place the "which end" rule lives, so a round start can never frame a
  // different spot than any other caller would.
  cameraStartFor(direction) {
    if (!CAMERA.startAtDirectionEnd) return this.cameraMin;
    const inset = this.layout.cell * CAMERA.endInsetFracOfCell;
    return direction === 'left'
      ? this.cameraMin
      : Math.max(this.cameraMin, this.cameraMax - inset);
  }

  // One ordinal label ("1st", "2nd", …) centred above each product slot. Labels
  // are children of the world container, so they pan with the shelf and sit at
  // the same world x as their product.
  //
  // The labels are KEPT (not just drawn) because they RENUMBER per prompt: when
  // the prompt counts from the right, the labels must count from the right too,
  // so the child can count along the shelf in the direction they were asked.
  buildOrdinalLabels(baselineY, boxH, productCount) {
    const cfg = SHELF.ordinals;
    const { width } = this.scale;
    const fontSize = width * cfg.fontSizeFracOfWidth;
    // Distance ABOVE the baseline, from the tuning fraction of the box height.
    const y = baselineY - boxH * cfg.aboveBoxHeightFrac;

    this.ordinalLabels = [];

    for (let i = 0; i < productCount; i += 1) {
      const label = this.add
        .text(this.layout.productCenters[i], y, ordinalLabel(i + 1), {
          fontSize: `${Math.round(fontSize)}px`,
          fontFamily: cfg.fontFamily,
          color: cfg.color,
          // Stroke thickness scales with the font, so resizing the label keeps
          // the outline proportionally readable.
          stroke: cfg.stroke,
          strokeThickness: fontSize * cfg.strokeWidthFrac,
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 1)
        .setAlpha(cfg.alpha);
      this.world.add(label);
      this.ordinalLabels.push(label);
    }
  }

  // Renumbers the shelf labels to match the prompt's counting direction.
  //
  // `direction === 'left'`  → 1st is the leftmost slot
  // `direction === 'right'` → 1st is the RIGHTMOST slot
  //
  // Guarded on the direction actually changing, so it does not rewrite N Texts
  // for every prompt when the direction happens to repeat.
  updateOrdinalDirection(direction) {
    if (!this.ordinalLabels || this.ordinalLabels.length === 0) return;
    if (this.ordinalDirection === direction) return;
    this.ordinalDirection = direction;

    const count = this.ordinalLabels.length;
    this.ordinalLabels.forEach((label, slotIndex) => {
      // From the right, slot 0 is the LAST number.
      const position = direction === 'left' ? slotIndex + 1 : count - slotIndex;
      label.setText(ordinalLabel(position));
    });
  }

  // The shelf artwork: a left end, looped middles, and the SAME left-end texture
  // flipped horizontally as the right end. All three share identical shelf
  // levels, so they tile without a seam.
  //
  // Returns the y of the surface the products stand on. That surface is chosen
  // with `productsRowTopFrac` — independent of `rowTopFrac`, which only decides
  // where the ARTWORK sits — so the products can be slid up or down the shelf
  // image without moving the image.
  buildShelfArt(shelfBottom) {
    const { width, height } = this.scale;
    const cfg = SHELF_ART;

    // If either texture is missing, fall back to a flat plank so the products
    // are never floating in space.
    if (!this.textures.exists(cfg.endKey) || !this.textures.exists(cfg.mainKey)) {
      this.buildShelfFallback(shelfBottom);
      return height * SHELF.boxYFrac + height * SHELF.boxHeightFrac * 0.5;
    }

    // Scale so ONE shelf compartment fills the top band. The art is drawn taller
    // than the band and then masked to it, which is what crops the compartments
    // above and below out of view.
    const artH = height * cfg.heightFracOfCanvas;
    const source = this.textures.get(cfg.endKey).getSourceImage();
    const artW = artH * (source.width / source.height);
    const artTop = height * cfg.rowLandsAtFrac - cfg.rowTopFrac * artH + cfg.offsetY;

    // Everything shelf-related lives in its own container so ONE mask can crop
    // it to the band. The mask is authored in screen space (the camera never
    // moves — the world container does), so it stays aligned while panning.
    const layer = this.add.container(0, 0);

    const tile = (key, centreX, flipX) => {
      const img = this.add
        .image(centreX, artTop, key)
        .setOrigin(0.5, 0)
        .setDisplaySize(artW, artH)
        .setAlpha(cfg.alpha);
      if (flipX) img.setFlipX(true);
      layer.add(img);
    };

    // The shelving occupies only the shelf span; the background margin on each
    // side is left bare, so the shelf reads as standing in a room.
    const shelfStart = this.layout.shelfStart;
    const shelfEnd = shelfStart + this.layout.shelfWidth;

    // Left upright, flush with the shelf's left edge.
    tile(cfg.endKey, shelfStart + artW / 2, false);

    // Middle tiles, stretched edge to edge between the two uprights so the
    // artwork spans EXACTLY the shelf width the layout computed. Stretching
    // slightly (rather than rounding to whole tiles) is what keeps the row
    // centred and stops dead space accumulating at the ends.
    const span = this.layout.shelfWidth - artW * 2;
    if (span > 0) {
      const tileCount = Math.max(1, Math.round(span / artW));
      const tileW = span / tileCount;
      for (let i = 0; i < tileCount; i += 1) {
        const centreX = shelfStart + artW + tileW * (i + 0.5);
        const img = this.add
          .image(centreX, artTop, cfg.mainKey)
          .setOrigin(0.5, 0)
          .setDisplaySize(tileW, artH)
          .setAlpha(cfg.alpha);
        layer.add(img);
      }
    }

    // Right upright — the left-end art mirrored, flush with the shelf's right edge.
    tile(cfg.endKey, shelfEnd - artW / 2, true);

    this.world.add(layer);

    // Crop the layer to the shelf BAND. A geometry mask is rendered in SCREEN
    // space, so this is a fixed screen-wide strip: it clips everything above and
    // below the band and stays correct as the world pans underneath it.
    const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(0, 0, width, shelfBottom);
    layer.setMask(maskGfx.createGeometryMask());

    // The products' lane is picked on the art's own coordinates, then mapped to
    // the canvas through the same artTop/artH used to draw the art.
    return artTop + cfg.productsRowTopFrac * artH;
  }

  // Flat-plank fallback used only when the artwork is unavailable. It spans only
  // the SHELF span, so the background margins on either side stay bare even on
  // this path.
  buildShelfFallback(shelfBottom) {
    const { height } = this.scale;
    const shelfBottomY = shelfBottom;
    const boxY = height * SHELF.boxYFrac;
    const boxH = height * SHELF.boxHeightFrac;
    const shelfStart = this.layout.shelfStart;
    const shelfWidth = this.layout.shelfWidth;

    this.world.add(
      this.add
        .rectangle(shelfStart, 0, shelfWidth, shelfBottomY, SHELF.panel.color, SHELF.panel.alpha)
        .setOrigin(0, 0)
    );
    this.world.add(
      this.add
        .rectangle(
          shelfStart,
          boxY + boxH * SHELF.plank.offsetYMult,
          shelfWidth,
          SHELF.plank.height,
          SHELF.plank.color,
          SHELF.plank.alpha
        )
        .setOrigin(0, 0)
    );
  }

  // ---------------------------------------------------------------------------
  // Character — fixed on screen, leans into the walk but never walks away.
  // The walk cycle itself comes from the 27-frame sprite animation.
  // ---------------------------------------------------------------------------

  // Builds the walk-cycle animation once. Guarded because the AnimationManager
  // is game-wide and survives scene.restart(), so an unguarded create() would
  // collide with itself on a replay.
  //
  // The frames are individual images, not a spritesheet, so each frame is
  // wrapped in a { key, frame } entry. Phaser treats a single-image texture as
  // having one frame, which is what `frame: undefined` resolves to.
  buildHeroAnimation() {
    const frames = animationFrames('hero');
    // No URLs pasted yet — the placeholder box is used instead (see buildCharacter).
    if (frames.length === 0) return;
    this.heroFrameCount = frames.length;
    if (this.anims.exists(CHARACTER.anim.key)) return;

    this.anims.create({
      key: CHARACTER.anim.key,
      // Frame order IS play order: index 0..N goes forward, and playReverse
      // walks the same list backwards — so 1..27 forward, 27..1 back, from one
      // definition with no duplicated animation.
      frames: frames.map(({ key }) => ({ key, frame: undefined })),
      frameRate: CHARACTER.anim.baseFrameRate,
      repeat: -1,
    });
  }

  buildCharacter() {
    const { width, height } = this.scale;
    const size = width * CHARACTER.sizeFrac;

    this.characterBaseX = width * CHARACTER.xFrac;
    this.characterBaseY = height * CHARACTER.yFrac;

    this.character = this.add.container(this.characterBaseX, this.characterBaseY).setDepth(CHARACTER.depth);

    // The CART is built FIRST so it renders BEHIND the character. Container
    // children draw in insertion order (Phaser does not sort them), so anything
    // added after the sprite would cover it — the cart must be the first child.
    this.buildCart();

    // Prefer the animated sprite; fall back to the placeholder box when the
    // animation has no frames (or the frames failed to load).
    if (this.anims.exists(CHARACTER.anim.key)) {
      const firstKey = animationFrames('hero')[0]?.key;
      if (firstKey && this.textures.exists(firstKey)) {
        this.buildWalkSprite(firstKey, height);
        this.buildIdleSprite(height);
        // Start in the idle pose — the child has not touched the joystick yet.
        this.applyCharacterPose(true);
        return;
      }
    }

    this.buildCharacterFallback(size);
  }

  // A reference box standing in for the cart. Deliberately a plain rectangle for
  // now — it exists to check placement and scale against the character, so all of
  // it is driven from `CHARACTER.cart` and can be hidden with one flag.
  buildCart() {
    const cfg = CHARACTER.cart;

    const { width, height } = this.scale;
    this.cartW = width * cfg.widthFrac;
    this.cartH = height * cfg.heightFrac;
    // Offsets are fractions of the CART's own size, so the box can be moved by
    // eye without recalculating pixels when its size changes.
    this.cartLocalX = cfg.xFrac * this.cartW;
    this.cartLocalY = cfg.yFrac * this.cartH;

    // Seated items live in their own container, added FIRST so the cart box (when
    // visible) draws over their lower edge and they read as being inside it.
    this.cartItems = this.add.container(this.cartLocalX, this.cartLocalY);
    this.character.add(this.cartItems);
    this.cartItemCount = 0;

    if (!cfg.visible) return;

    const cart = this.add.graphics();
    cart.fillStyle(cfg.color, cfg.alpha);
    cart.fillRoundedRect(-this.cartW / 2, -this.cartH / 2, this.cartW, this.cartH, cfg.radius);
    cart.lineStyle(cfg.outlineWidth, cfg.outline, 1);
    cart.strokeRoundedRect(-this.cartW / 2, -this.cartH / 2, this.cartW, this.cartH, cfg.radius);
    cart.setPosition(this.cartLocalX, this.cartLocalY);

    this.character.add(cart);
    this.cartBox = cart;
  }

  // The cart's drop zone in SCREEN space. The cart is parented to the character
  // container, which itself moves with the drift lean, so the local offset is
  // added to the character's live position rather than assumed to be fixed.
  cartDropRect() {
    const cx = this.characterBaseX + this.drift + this.cartLocalX;
    const cy = this.characterBaseY + this.cartLocalY;
    const pad = CHARACTER.drag.dropPadFrac;
    return {
      left: cx - this.cartW / 2 - this.cartW * pad,
      right: cx + this.cartW / 2 + this.cartW * pad,
      top: cy - this.cartH / 2 - this.cartH * pad,
      bottom: cy + this.cartH / 2 + this.cartH * pad,
    };
  }

  // ---------------------------------------------------------------------------
  // Product dragging — shelf → cart
  // ---------------------------------------------------------------------------

  // The product under a SCREEN point, or null. Products are stored in WORLD
  // coordinates, so the camera offset is added back before comparing.
  //
  // Picks the NEAREST centre among every box inside its grab zone rather than
  // the first match, so a tap between two adjacent products grabs the one the
  // child actually aimed at instead of whichever happens to be leftmost.
  productAtScreen(screenX, screenY) {
    if (!this.products) return null;
    const pad = CHARACTER.drag.grabPadFrac;
    const halfW = (this.productBoxW / 2) * (1 + pad);
    const halfH = (this.productBoxH / 2) * (1 + pad);
    const worldX = screenX + this.cameraX;
    const worldY = screenY;

    let best = null;
    let bestDist = Infinity;

    for (const product of this.products) {
      if (product.taken) continue;
      // PRODUCTS ARE BOTTOM-ALIGNED: `baselineY` is their BASE, not their centre,
      // so the grab zone spans from the baseline up by one slot height. Measuring
      // from a centre would offset every hit area by half a slot.
      const dx = Math.abs(worldX - product.x);
      const dy = worldY - (product.baselineY - this.productBoxH / 2);
      if (dx > halfW || Math.abs(dy) > halfH) continue;
      // Weight x more heavily: the row is horizontal, so the nearest neighbour
      // along the shelf is what matters, and y is the same for every product.
      const dist = dx * 2 + Math.abs(dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = product;
      }
    }

    return best;
  }

  pickUpProduct(pointer) {
    // One product per pointer, and never while one is already held — two fingers
    // must not grab or drop the same item.
    if (this.heldProduct || this.joystickPointerId !== null) return;

    const product = this.productAtScreen(pointer.x, pointer.y);
    if (!product) return;

    product.taken = true;
    const cfg = CHARACTER.drag;

    // A scene-level copy handles the drag; the shelf sprite is hidden underneath
    // so the item is not drawn twice while it is out of the row.
    const held = this.makeProductView(product.key, this.productBoxW, this.productBoxH);
    held.setDepth(cfg.dragDepth);
    held.x = product.x;
    // `baselineY` is the product's BASE, matching the view's bottom origin.
    held.y = product.baselineY;
    // Convert the WORLD position to screen once, then move in screen space.
    held.x -= this.cameraX;

    this.tweens.add({
      targets: held,
      scale: cfg.dragScale,
      duration: 120,
      ease: 'Sine.easeOut',
    });
    held.setAlpha(cfg.dragAlpha);

    product.box.setVisible(false);
    this.heldProduct = { product, sprite: held, pointerId: pointer.id };

    if (this.cache.audio.exists(cfg.pickupSound)) {
      this.sound.play(cfg.pickupSound, { volume: cfg.pickupVolume });
    }
  }

  // Builds one product fitted inside a w x h slot without distortion.
  //
  // The origin is (0.5, 1) — horizontally centred, BOTTOM-anchored — the same as
  // the shelf sprites, so the held copy and the cart miniature keep the product's
  // base on whatever y it is given. Shared by the drag and the cart so both look
  // identical.
  //
  // Returns a Sprite, or a Graphics fallback when the texture is missing — the
  // caller only relies on position/scale/alpha/destroy, which both support.
  makeProductView(key, w, h) {
    if (!key || !this.textures.exists(key)) {
      const g = this.add.graphics();
      g.fillStyle(SHELF.colors[0], 1);
      // Drawn from the baseline (y = 0) upward, matching the bottom anchor.
      g.fillRoundedRect(-w / 2, -h, w, h, SHELF.radius);
      g.setData('baseScale', 1);
      return g;
    }

    const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1);
    const scale = Math.min(w / sprite.width, h / sprite.height);
    sprite.setScale(scale);
    // Remember the fitted scale, so the seat tween can reason about it rather
    // than assume the art's pixel size equals its display size.
    sprite.setData('baseScale', scale);
    return sprite;
  }

  moveHeldProduct(pointer) {
    if (!this.heldProduct || pointer.id !== this.heldProduct.pointerId) return;
    this.heldProduct.sprite.x = pointer.x;
    this.heldProduct.sprite.y = pointer.y;
  }

  dropHeldProduct(pointer) {
    const held = this.heldProduct;
    if (!held || pointer.id !== held.pointerId) return;
    this.heldProduct = null;

    const rect = this.cartDropRect();
    const inCart =
      pointer.x >= rect.left &&
      pointer.x <= rect.right &&
      pointer.y >= rect.top &&
      pointer.y <= rect.bottom;

    // Kill the grab scale tween before animating either outcome, or the two
    // would fight over `scale`.
    this.tweens.killTweensOf(held.sprite);

    if (inCart) {
      // Answering is only allowed when the prompt is live — during a round or
      // level transition a drop is refused rather than silently scored.
      if (this.transitioning || !this.currentPrompt) {
        this.returnToShelf(held);
        return;
      }

      // Correctness is decided by the PROMPT, comparing the slot index the child
      // dropped against the slot the prompt names. The scene never recomputes
      // the curriculum (see levels.js).
      const isCorrect = held.product.index === this.currentPrompt.slotIndex;

      if (isCorrect) {
        // The seat is visual only, so it must NEVER be able to block progress.
        // It used to throw on a stale tuning reference and the prompt froze on
        // the first question — the game looked broken with no error shown to the
        // child. Wrapping it means a cosmetic failure costs a missing pop, not
        // an unplayable round.
        try {
          this.seatInCart(held);
        } catch (err) {
          console.warn('[game15] seatInCart failed (visual only):', err);
        }
        this.playSound(FLOW.correctSound, FLOW.correctVolume);
        this.advanceAfterCorrect();
        return;
      }

      // Wrong product: refuse it — sound, red flash, fly back to the shelf.
      this.mistakes += 1;
      this.playSound(FLOW.wrongSound, FLOW.wrongVolume);
      this.flashPromptWrong();
      this.returnToShelf(held);
      return;
    }

    // Dropped outside the cart: return it to the shelf.
    this.returnToShelf(held);
  }

  // Flies a held product back to its slot and restores the shelf sprite. Used
  // for a drop that missed the cart AND for a refused (wrong) product — either
  // way the item is never stranded mid-air and is never silently consumed.
  //
  // The target y is the product's BASELINE (its base), because the view is
  // bottom-anchored — and `scale` returns to the fitted shelf scale, not 1, or a
  // large PNG would fly back visibly larger than its own slot.
  returnToShelf(held) {
    const cfg = CHARACTER.drag;
    this.tweens.add({
      targets: held.sprite,
      x: held.product.x - this.cameraX,
      y: held.product.baselineY,
      scale: this.shelfScaleFor(held.sprite),
      alpha: 1,
      duration: cfg.returnMs,
      ease: cfg.returnEase,
      onComplete: () => {
        held.sprite.destroy();
        held.product.taken = false;
        // The shelf sprite may already be gone if the round was rebuilt while the
        // tween was running, so guard before touching it.
        if (held.product.box?.active) held.product.box.setVisible(true);
      },
    });
  }

  // The scale at which a product view exactly fills a shelf slot.
  shelfScaleFor(view) {
    const w = view.width || this.productBoxW;
    const h = view.height || this.productBoxH;
    return Math.min(this.productBoxW / w, this.productBoxH / h);
  }

  // Empties the cart between rounds: a new round starts with a new, empty cart.
  //
  // Only the SEATED ITEMS are removed. The cart container itself is built once in
  // buildCharacter() and reused, so a rebuilt world never has to re-parent or
  // recreate the cart.
  clearCartItems() {
    if (this.cartItems) this.cartItems.removeAll(true);
    this.cartItemCount = 0;
  }

  // Plays a shared SFX, tolerating a clip that failed to load.
  playSound(key, volume) {
    if (key && this.cache.audio.exists(key)) this.sound.play(key, { volume });
  }

  // Shrinks the dropped item into the cart and stacks it with the others.
  seatInCart(held) {
    const cfg = CHARACTER.cart;
    const size = this.cartW * cfg.itemSizeFracOfCartWidth;
    const gap = size * cfg.itemGapFracOfItem;
    const pad = this.cartW * cfg.itemPadFrac;

    // Grid position inside the cart, wrapping to a new row.
    const perRow = Math.max(1, cfg.itemsPerRow);
    const col = this.cartItemCount % perRow;
    const row = Math.floor(this.cartItemCount / perRow);
    this.cartItemCount += 1;

    // LOCAL to the cart container, which already sits at the cart's offset inside
    // the character — so the item rides the drift lean with no repositioning.
    //
    // y is the item's BASELINE (bottom edge of its cell), because product views
    // are bottom-anchored. Anchoring to the cell centre would push every item
    // down by half its height.
    const targetX = -this.cartW / 2 + pad + size / 2 + col * (size + gap);
    const targetY = -this.cartH / 2 + pad + size + row * (size + gap);

    // Reparent into the cart's item container, which was added BEFORE the cart
    // box, so seated items draw behind the box and read as being inside it.
    this.children.remove(held.sprite);
    this.cartItems.add(held.sprite);

    // Target scale: shrink from the slot-sized view down to the cart-item size.
    // The view was already fitted to the slot, so `size / productBoxW` is the
    // extra shrink needed — multiplying the view's own base scale would be wrong
    // because that already accounts for the art's pixel dimensions.
    const targetScale = size / this.productBoxW;

    this.tweens.add({
      targets: held.sprite,
      x: targetX,
      y: targetY,
      alpha: 1,
      scale: targetScale,
      duration: cfg.itemPopMs,
      ease: cfg.itemPopEase,
    });

    if (this.cache.audio.exists(cfg.itemPopKey)) {
      this.sound.play(cfg.itemPopKey, { volume: cfg.itemPopVolume });
    }

    // The shelf slot does NOT stay empty: a fresh copy of the same product pops
    // back in, so the line-up always reads as a full shelf. The product record is
    // reused (same slotIndex, same art), which keeps hit-testing and the prompt
    // mapping valid — only the visual is replaced.
    this.respawnProduct(held.product);
  }

  // Rebuilds a shelf product's visual in place after it has been taken.
  //
  // The OLD box is destroyed and a NEW one created at the same world position and
  // baseline, then popped in with a short scale tween so the refill reads as
  // deliberate rather than a flicker.
  respawnProduct(product) {
    if (product.box?.active) product.box.destroy();
    product.box = null;

    // The slot looks full again, so it must be grabbable again — otherwise the
    // child taps a visible product and nothing happens. Re-grabbing is safe:
    // prompts within a round target distinct slots, so a taken slot can only
    // ever be a WRONG answer, which the validation already refuses.
    product.taken = false;

    // If the round was rebuilt while the seat tween ran, this record is stale —
    // the world already has its own fresh products, so do nothing.
    if (!this.products.includes(product)) return;

    const { key, x, baselineY } = product;

    if (!key || !this.textures.exists(key)) {
      const fallback = this.add.graphics();
      const colour = SHELF.colors[product.index % SHELF.colors.length];
      fallback.fillStyle(colour, 1);
      fallback.fillRoundedRect(
        x - this.productBoxW / 2,
        baselineY - this.productBoxH,
        this.productBoxW,
        this.productBoxH,
        SHELF.radius
      );
      this.world.add(fallback);
      product.box = fallback;
      return;
    }

    const sprite = this.add.image(x, baselineY, key).setOrigin(0.5, 1);
    const scale = Math.min(
      this.productBoxW / sprite.width,
      this.productBoxH / sprite.height
    );
    sprite.setScale(scale);
    this.world.add(sprite);
    product.box = sprite;

    // Pop-in: start small and overshoot slightly, then settle to the fitted scale.
    const fromScale = scale * SHELF.respawn.fromScale;
    sprite.setScale(fromScale);
    this.tweens.add({
      targets: sprite,
      scale,
      duration: SHELF.respawn.durationMs,
      ease: SHELF.respawn.ease,
    });
  }

  // The walk-cycle sprite. Hidden by default; updateCharacterAnimation() shows it
  // when the joystick moves.
  buildWalkSprite(firstKey, height) {
    const sprite = this.add.sprite(0, 0, firstKey).setOrigin(0.5, 0.5);
    // Scale by drawn HEIGHT, not width: the walk cycle's art is taller than it
    // is wide, so fitting it by width would shrink it to nothing.
    const targetH = height * CHARACTER.anim.heightFracOfCanvas;
    sprite.setScale(targetH / sprite.height);
    sprite.y += height * CHARACTER.anim.yOffsetFrac;
    sprite.setVisible(false);

    this.character.add(sprite);
    this.characterSprite = sprite;

    // Start on frame 0, paused. update() starts it once the stick moves, and
    // picks the direction to play it in.
    sprite.play({ key: CHARACTER.anim.key, startFrame: 0 });
    sprite.anims.pause();
  }

  // The still idle pose: one extra frame, scaled exactly like the walk sprite so
  // the two never jump in size when the character starts or stops.
  buildIdleSprite(height) {
    if (!this.textures.exists(CHARACTER.idle.key)) return;

    const idle = this.add.sprite(0, 0, CHARACTER.idle.key).setOrigin(0.5, 0.5);
    const targetH = height * CHARACTER.anim.heightFracOfCanvas;
    idle.setScale(targetH / idle.height);
    idle.y += height * CHARACTER.anim.yOffsetFrac;
    // Hidden by default; applyCharacterPose() shows it when the character rests.
    idle.setVisible(false);

    this.character.add(idle);
    this.idleSprite = idle;
  }

  // Swaps between the walking pose and the idle pose. Guarded on `isIdle` so it
  // only does work when the state actually flips — this runs every frame.
  applyCharacterPose(idle) {
    if (this.isIdle === idle) return;
    this.isIdle = idle;

    if (this.idleSprite) this.idleSprite.setVisible(idle);
    if (this.characterSprite) this.characterSprite.setVisible(!idle);
  }

  // The original placeholder box, kept so the game still reads before the art
  // lands (and if a frame URL ever 404s).
  buildCharacterFallback(size) {
    const body = this.add.graphics();
    body.fillStyle(CHARACTER.color, 1);
    body.fillRoundedRect(-size / 2, -size / 2, size, size, CHARACTER.radius);
    body.lineStyle(CHARACTER.outlineWidth, CHARACTER.outline, 1);
    body.strokeRoundedRect(-size / 2, -size / 2, size, size, CHARACTER.radius);
    this.character.add(body);

    // Two eyes, so the box reads as a character rather than a UI panel.
    const eyeOffsetX = size * CHARACTER.eyeXFrac;
    const eyeOffsetY = size * CHARACTER.eyeYFrac;
    const eyeRadius = size * CHARACTER.eyeRadiusFrac;
    for (const dir of [-1, 1]) {
      const eye = this.add.circle(eyeOffsetX * dir, eyeOffsetY, eyeRadius, CHARACTER.eyeColor);
      this.character.add(eye);
    }
  }

  // Drives the walk cycle from the SAME axis value that scrolls the world, so
  // the stride and the background always agree.
  //
  //   axis > 0 → walking right → play 1..27 (forward)
  //   axis < 0 → walking left  → play 27..1 (reverse)
  //   axis = 0 → stopped, hold the current frame
  //
  // Speed is scaled by |axis|, so a gentle push gives a slow stride and a full
  // push a brisk one — the feet never skate against the scrolling shelf.
  updateCharacterAnimation() {
    const sprite = this.characterSprite;
    if (!sprite) return;

    const axis = this.axis;

    // A transition asked the character to run for a moment. Keep the walk cycle
    // alive until that window closes, so this per-frame joystick logic doesn't
    // immediately idle the character the frame after the celebration started.
    if (this.celebrationUntil > this.time.now) {
      return;
    }

    if (axis === 0) {
      // Swap to the still idle pose. The walk cycle freezes where it is rather
      // than snapping to frame 0, so the next step resumes from that pose.
      if (sprite.anims.isPlaying) sprite.anims.pause();
      this.applyCharacterPose(true);
      return;
    }

    // Moving: show the walk cycle and stop the breathing tween.
    this.applyCharacterPose(false);

    const direction = axis > 0 ? 1 : -1;

    // Only (re)start when the direction actually changes — restarting every
    // frame would reset playback to frame 0 and the walk would stutter.
    if (this.characterFacing !== direction) {
      this.characterFacing = direction;
      if (direction > 0) {
        sprite.play({ key: CHARACTER.anim.key, startFrame: 0, repeat: -1 });
      } else {
        // Reverse starts at the LAST frame so the cycle runs 27..1. Frames are
        // 0-based, so the last index is count - 1.
        const lastIndex = Math.max(0, this.heroFrameCount - 1);
        sprite.playReverse({ key: CHARACTER.anim.key, startFrame: lastIndex, repeat: -1 });
      }
    } else if (!sprite.anims.isPlaying) {
      // Was stopped, still holding the same direction — resume from the current
      // frame instead of jumping.
      sprite.anims.resume();
    }

    // Speed follows deflection. Measured against ONE frame of scroll so the two
    // stay locked together at any joystick sensitivity.
    const strength = Math.min(1, Math.abs(axis));
    const timeScale =
      CHARACTER.anim.minTimeScale +
      (CHARACTER.anim.maxTimeScale - CHARACTER.anim.minTimeScale) * strength;
    sprite.anims.timeScale = timeScale;
  }

  // Re-derive the character's resting spot after a resize.
  layoutCharacter() {
    if (!this.character) return;
    const { width, height } = this.scale;
    this.characterBaseX = width * CHARACTER.xFrac;
    this.characterBaseY = height * CHARACTER.yFrac;
  }

  // ---------------------------------------------------------------------------
  // Level / round / prompt flow
  // ---------------------------------------------------------------------------

  // Starts a level by index, generating all of its rounds up front.
  startLevel(levelIndex) {
    this.levelIndex = levelIndex;
    const level = LEVELS[levelIndex];
    this.roundPlans = buildLevelRounds(level, PRODUCT_IMAGES.length);
    this.roundIndex = 0;
    this.roundsCleared = 0;
    this.startRound(level, 0);
  }

  // Builds the world for a round and deals its first prompt.
  startRound(level, roundIndex) {
    this.roundIndex = roundIndex;
    this.listIndex = 0;
    this.promptIndex = 0;
    this.currentRound = this.roundPlans[roundIndex];
    this.transitioning = false;

    // A new round is a NEW SHELF LINE-UP, so it always rebuilds the world. Only
    // flash/celebrate when the COUNTING SIDE changed — otherwise moving from one
    // list to the next inside the same round would flash on every three taps.
    const sideChanged = this.lastRoundDirection !== this.currentRound.direction;
    this.lastRoundDirection = this.currentRound.direction;

    if (sideChanged) {
      // INSTANT, because this same frame tears down the world and re-frames the
      // camera at the other end of the shelf: the veil has to be opaque already,
      // or the child sees the shelf jump before the flash covers it.
      this.flashScene({ instant: true });
      // The NEW round's direction, not the prompt's: `currentPrompt` still holds
      // the prompt from the round that just ended, so the character would walk
      // away from the end it is about to be placed at.
      this.playCelebrationWalk(this.currentRound.direction);
    }

    // A pending prompt fade-out must not fire into the new round.
    if (this.promptTransition) {
      this.promptTransition.remove(false);
      this.promptTransition = null;
    }
    // The new round's first prompt appears without fading out an old one.
    this.promptVisible = false;

    // The world is framed at the end matching THIS round's counting side, so a
    // "from the right" round opens with the child already at the right end of
    // the shelf. (Every list in the round counts from the same side, so this does
    // not need to happen again until the next round.)
    this.buildWorld(this.currentRound, this.currentRound.direction);
    this.dealPrompt();
  }

  // The prompt objects of the current list.
  currentList() {
    return this.currentRound?.lists?.[this.listIndex] || [];
  }

  // Deals the prompt at promptIndex within the current list.
  //
  // A prompt change inside a list is a quiet swap: the words are replaced in
  // place with a small fade, with NO scene flash, camera move or celebration run
  // — those belong to a side change, not to every tap.
  dealPrompt() {
    const prompt = this.currentList()[this.promptIndex];
    if (!prompt) return;

    if (this.promptVisible) {
      this.transitionPromptOut(() => this.showPrompt(prompt), { quiet: true });
      return;
    }
    this.showPrompt(prompt);
  }

  // Paints and reveals one prompt. Split out of dealPrompt so the transition can
  // run first and then call back into this.
  showPrompt(prompt) {
    this.currentPrompt = prompt;
    this.updatePromptText(prompt);
    // The shelf labels must count from the SAME side the prompt does, so the
    // child can count along the shelf in the direction they were asked.
    this.updateOrdinalDirection(prompt.direction);
    // Only the arrow for the side being counted from is shown, so the hint is
    // unambiguous: red for "from the left", blue for "from the right".
    this.showArrowForDirection(prompt.direction);
    this.animatePromptIn();
    this.promptVisible = true;
  }

  // Fades/slides the current prompt away, then runs `onDone`.
  //
  // Uses the SAME three text objects for both prompts (they are re-styled, not
  // recreated), so this only has to animate them out — there is no second set to
  // keep in sync.
  //
  // The completion is driven by ONE timer rather than by counting tween
  // onComplete callbacks: a tween that gets killed (by the win, or by the next
  // transition) never fires its onComplete, so a counter over several tweens can
  // stall forever and freeze the prompt. A single delayed call always runs.
  transitionPromptOut(onDone, { quiet = false } = {}) {
    const cfg = PROMPT;
    const parts = [this.ordinalText, this.fromTheText, this.directionText];

    for (const t of parts) {
      this.tweens.killTweensOf(t);
      this.tweens.add({
        targets: t,
        alpha: 0,
        x: t.x + cfg.fadeOutOffsetX,
        duration: cfg.fadeOutMs,
        ease: cfg.fadeOutEase,
      });
    }

    this.tweens.killTweensOf(this.promptBg);
    this.tweens.add({
      targets: this.promptBg,
      alpha: 0,
      duration: cfg.fadeOutMs,
      ease: 'Sine.easeIn',
    });

    // A QUIET swap (next prompt in the same list) deliberately does not flash the
    // scene, move the camera or run the character — those are reserved for a
    // direction change, so an ordinary tap never feels like a big event.
    if (!quiet) {
      this.flashScene();
      this.playCelebrationWalk();
    }

    // The timer is cancelled if a newer transition starts, so two prompts can
    // never both call back and double-deal.
    if (this.promptTransition) this.promptTransition.remove(false);
    this.promptTransition = this.time.delayedCall(cfg.fadeOutMs, () => {
      this.promptTransition = null;
      onDone();
    });
  }

  // Runs the character's walk cycle for a moment even though the player is not
  // driving it, so the character takes part in the transition instead of standing
  // frozen while the shelf and prompt change around it.
  //
  // `direction` defaults to the current prompt's, but a ROUND start must pass the
  // NEW round's direction explicitly: at that point `currentPrompt` still belongs
  // to the round that just ended, so defaulting would walk the character the wrong
  // way — away from the end it is being moved to.
  //
  // Uses a deadline rather than a tween/flag teardown: `updateCharacterAnimation`
  // checks `celebrationUntil` each frame and keeps the walk alive until it passes,
  // then hands control back to the joystick logic. That way a transition that is
  // interrupted, or a joystick grab mid-walk, needs no special cleanup.
  playCelebrationWalk(direction = this.currentPrompt?.direction) {
    const sprite = this.characterSprite;
    if (!sprite) return;

    // Face the direction being counted from, so the character looks the way the
    // child is about to look.
    const walkRight = direction === 'right';
    this.characterFacing = walkRight ? 1 : -1;

    this.applyCharacterPose(false);

    if (walkRight) {
      sprite.play({ key: CHARACTER.anim.key, startFrame: 0, repeat: -1 });
    } else {
      const lastIndex = Math.max(0, this.heroFrameCount - 1);
      sprite.playReverse({ key: CHARACTER.anim.key, startFrame: lastIndex, repeat: -1 });
    }
    sprite.anims.timeScale = PROMPT.celebratoryWalkTimeScale;

    this.celebrationUntil = this.time.now + PROMPT.celebratoryWalkMs;
  }

  // Full-screen white veil for a transition.
  //
  // One reusable Rectangle is created on first use and tweened from peak alpha to
  // transparent, so this costs a single game object for the whole run rather than
  // allocating a new flash per prompt. It is non-interactive, so a tap during the
  // flash still reaches whatever is underneath.
  //
  // `instant` starts AT peak instead of rising to it. A round start needs that:
  // it rebuilds the world and re-frames the camera in the same frame, so the cut
  // has to be covered on the very first frame — a 60ms rise would show the jump
  // before the veil got there. Prompt transitions keep the rise, because nothing
  // jumps there and the pop reads better.
  flashScene({ instant = false } = {}) {
    const { width, height } = this.scale;

    if (!this.flashRect) {
      this.flashRect = this.add
        .rectangle(width / 2, height / 2, width, height, PROMPT.flashColor, 1)
        .setDepth(PROMPT.flashDepth)
        .setOrigin(0.5, 0.5)
        .setActive(false);
      // Non-interactive so it never swallows a tap meant for the shelf/joystick.
      this.flashRect.disableInteractive();
    }

    // Keep it full-bleed if the canvas resized since it was created.
    this.flashRect.setSize(width, height);
    this.flashRect.setPosition(width / 2, height / 2);

    this.tweens.killTweensOf(this.flashRect);

    const fall = () => {
      this.tweens.add({
        targets: this.flashRect,
        alpha: 0,
        duration: PROMPT.flashFallMs,
        ease: 'Quad.easeIn',
      });
    };

    // Instant: start already opaque so the frame the world is rebuilt on is
    // completely covered, then fall away from there.
    if (instant) {
      this.flashRect.setAlpha(PROMPT.flashPeakAlpha);
      fall();
      return;
    }

    this.flashRect.setAlpha(0);

    // Peak fast (the "pop"), then fall away — that asymmetry is what makes it
    // read as a flash rather than a fade.
    this.tweens.add({
      targets: this.flashRect,
      alpha: PROMPT.flashPeakAlpha,
      duration: PROMPT.flashRiseMs,
      ease: 'Quad.easeOut',
      onComplete: fall,
    });
  }

  // Shows exactly one edge arrow: the red one for a LEFT prompt, the blue one for
  // a RIGHT prompt. The other is hidden so there is never a competing hint.
  showArrowForDirection(direction) {
    if (this.leftArrow) this.leftArrow.setVisible(direction === 'left');
    if (this.rightArrow) this.rightArrow.setVisible(direction === 'right');
  }

  // Advances after a correct drop, in hierarchy order:
  //   next PROMPT in the list → next LIST in the round → next ROUND → next LEVEL → finish.
  //
  // Only crossing a LIST boundary changes anything visually significant (the
  // cart empties and the list counter resets); crossing a ROUND boundary is what
  // may change the counting side, which startRound() detects.
  advanceAfterCorrect() {
    const list = this.currentList();

    // 1. Another prompt in this list.
    if (this.promptIndex + 1 < list.length) {
      this.time.delayedCall(FLOW.afterCorrectMs, () => {
        this.promptIndex += 1;
        this.dealPrompt();
      });
      return;
    }

    // 2. List complete → the cart empties and the next list begins.
    this.playSound(FLOW.successSound, FLOW.successVolume);

    if (this.listIndex + 1 < this.currentRound.lists.length) {
      this.transitioning = true;
      this.spawnConfetti(FLOW.confettiCount);
      this.time.delayedCall(FLOW.afterRoundMs, () => this.afterList());
      return;
    }

    // 3. Round complete (both lists done).
    this.roundsCleared += 1;
    this.spawnConfetti(FLOW.confettiCount);
    this.transitioning = true;
    this.time.delayedCall(FLOW.afterRoundMs, () => this.afterRound());
  }

  // Starts the next list within the SAME round: empty the cart, reset the prompt
  // index, and deal the first prompt of the new list. The shelf line-up and its
  // labels stay as they are, because the lists in a round share one line-up.
  afterList() {
    this.listIndex += 1;
    this.promptIndex = 0;
    this.transitioning = false;
    this.clearCartItems();
    // A list boundary is a quiet hand-off: no scene flash, no camera move.
    this.promptVisible = false;
    this.dealPrompt();
  }

  afterRound() {
    const level = LEVELS[this.levelIndex];
    const isLastRoundOfLevel = this.roundIndex + 1 >= level.rounds;
    const isLastLevel = this.levelIndex + 1 >= LEVELS.length;

    if (!isLastRoundOfLevel) {
      // Same level, next round: NEW line-up, new direction, fresh cart.
      this.startRound(level, this.roundIndex + 1);
      return;
    }

    if (!isLastLevel) {
      // Next level: rebuild at the larger product count.
      this.startLevel(this.levelIndex + 1);
      return;
    }

    this.finishRun();
  }

  // Emits the completion event exactly once and shows the end card.
  finishRun() {
    if (this.finished) return;
    this.finished = true;
    this.transitioning = true;

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);
    this.game.events.emit('game15-complete', {
      stars: this.starsEarned(),
      totalRounds: TOTAL_ROUNDS,
      peakStreak: 0,
      mistakes: this.mistakes,
      elapsedSeconds,
    });

    this.showEndOverlay();
  }

  // 3 stars for a clean run, fewer as mistakes accumulate — same scale the other
  // games use, so the stats screen reads consistently.
  starsEarned() {
    if (this.mistakes === 0) return 3;
    if (this.mistakes <= 2) return 2;
    return 1;
  }

  // ---------------------------------------------------------------------------
  // Prompt UI — left of the joystick, above the character, below the arrows.
  // ---------------------------------------------------------------------------

  // The prompt is THREE Texts, because each phrase has a different style and a
  // single Text can only carry one fill+stroke:
  //   ordinal   — bold, dark fill, dark-green outline
  //   "from the" — plain, no outline, muted
  //   direction  — bold, outlined, RED for left or BLUE for right
  buildPromptUi() {
    this.promptCard = this.add.container(0, 0).setDepth(PROMPT.cardDepth);

    // White backing card.
    this.promptBg = this.add.graphics();
    this.promptCard.add(this.promptBg);

    const base = {
      fontSize: '54px',
      fontFamily: PROMPT.fontFamily,
    };

    // All three lines use a CENTRE origin, because they are stacked and centred
    // on one x. A left origin would make each line start at the same x and the
    // block would look ragged.
    this.ordinalText = this.add
      .text(0, 0, '', {
        ...base,
        color: PROMPT.ordinalColor,
        stroke: PROMPT.ordinalStroke,
        strokeThickness: 54 * PROMPT.ordinalStrokeWidthFrac,
        fontStyle: PROMPT.ordinalFontStyle,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(PROMPT.textDepth);

    // Plain connector: no stroke at all.
    this.fromTheText = this.add
      .text(0, 0, 'from the', {
        ...base,
        color: PROMPT.fromTheColor,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(PROMPT.textDepth);

    this.directionText = this.add
      .text(0, 0, '', {
        ...base,
        color: PROMPT.leftColor,
        stroke: PROMPT.directionStroke,
        strokeThickness: 54 * PROMPT.directionStrokeWidthFrac,
        fontStyle: PROMPT.directionFontStyle,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(PROMPT.textDepth);
  }

  // Paints the three phrases, stacks them and re-centres the card.
  //
  // EVERYTHING is multiplied by `PROMPT.cardScale` — font size, stroke widths,
  // line gaps and padding — so one number resizes the whole card proportionally
  // instead of leaving the text and the card to drift out of sync.
  updatePromptText(prompt) {
    const { width, height } = this.scale;
    const scale = PROMPT.cardScale;
    const fontSize = width * PROMPT.fontSizeFracOfWidth * scale;
    const directionColor =
      prompt.direction === 'left' ? PROMPT.leftColor : PROMPT.rightColor;

    this.ordinalText.setFontSize(fontSize);
    this.ordinalText.setStroke(PROMPT.ordinalStroke, fontSize * PROMPT.ordinalStrokeWidthFrac);
    this.ordinalText.setText(prompt.ordinal);

    this.fromTheText.setFontSize(fontSize);

    this.directionText.setFontSize(fontSize);
    this.directionText.setColor(directionColor);
    this.directionText.setStroke(
      PROMPT.directionStroke,
      fontSize * PROMPT.directionStrokeWidthFrac
    );
    this.directionText.setText(prompt.direction);

    // Reset alpha to FULL here, not in animatePromptIn. The transition moves the
    // whole block as one object; individual alpha is left alone so a stale 0 from
    // a cancelled fade cannot leave a word invisible.
    for (const t of [this.ordinalText, this.fromTheText, this.directionText]) {
      t.setAlpha(1);
    }
    this.promptBg.setAlpha(1);

    // THREE STACKED LINES, centred on the prompt x:
    //
    //     third
    //     from the
    //     left
    //
    // Stacking rather than running inline means a long ordinal ("seventh") and
    // the direction word never compete for horizontal space, so the card stays a
    // predictable width on a small tablet.
    const cx = width * PROMPT.xFrac;
    const cy = height * PROMPT.yFrac;

    const lineH = fontSize;
    const gap = PROMPT.lineGap * scale;
    const totalH = lineH * 3 + gap * 2;

    // Each line is horizontally centred (origin 0.5 set in buildPromptUi).
    // Recomputed from scratch every prompt, so no leftover fade-out offset
    // accumulates.
    const firstY = cy - totalH / 2 + lineH / 2;
    this.ordinalText.setPosition(cx, firstY);
    this.fromTheText.setPosition(cx, firstY + lineH + gap);
    this.directionText.setPosition(cx, firstY + (lineH + gap) * 2);
    const totalW = Math.max(
      this.ordinalText.width,
      this.fromTheText.width,
      this.directionText.width
    );

    // Card behind the words.
    //
    // `promptBg.x` is reset to 0 FIRST: the reveal animation shifts the graphics
    // object horizontally, and the card is drawn in absolute coordinates inside
    // it, so a leftover offset from the previous prompt would displace the whole
    // card away from the words.
    this.promptBg.x = 0;
    // Padding scales with the card too, so the text never crowds the edge at a
    // larger scale.
    const cardW = totalW + PROMPT.padX * scale * 2;
    // Height covers all THREE lines plus their gaps and the vertical padding.
    const cardH = totalH + PROMPT.padY * scale * 2;
    this.promptBg.clear();
    this.promptBg.fillStyle(PROMPT.cardColor, PROMPT.cardAlpha);
    this.promptBg.fillRoundedRect(
      cx - cardW / 2,
      cy - cardH / 2,
      cardW,
      cardH,
      PROMPT.cardRadius
    );
  }

  // Slides/fades the new prompt in from the right.
  //
  // The card and all three words move TOGETHER as one group: `updatePromptText`
  // has already placed every object at its resting position with alpha 1, so this
  // only has to offset the whole set and ease it back. Animating the words
  // separately from the card made the card appear to snap while the text crept
  // in, which read as "no transition".
  animatePromptIn() {
    const parts = [this.ordinalText, this.fromTheText, this.directionText];
    const group = [...parts, this.promptBg];

    // Kill anything still running from a previous in/out so positions are exact.
    for (const obj of group) this.tweens.killTweensOf(obj);

    // Offset each object from its OWN resting position by the same amount, so the
    // group keeps its internal layout as it slides.
    for (const obj of group) {
      obj.x += PROMPT.fadeInOffsetX;
      obj.setAlpha(0);
    }

    for (const obj of parts) {
      this.tweens.add({
        targets: obj,
        alpha: 1,
        x: obj.x - PROMPT.fadeInOffsetX,
        duration: PROMPT.fadeInMs,
        ease: PROMPT.fadeInEase,
      });
    }

    // The card's graphics origin is 0,0, not its centre, so its slide is applied
    // via the same x shift while its alpha eases slightly faster — it is the
    // surface behind the words and should settle first.
    this.tweens.add({
      targets: this.promptBg,
      alpha: 1,
      x: this.promptBg.x - PROMPT.fadeInOffsetX,
      duration: Math.round(PROMPT.fadeInMs * 0.8),
      ease: 'Sine.easeOut',
    });
  }

  // Red flash on the prompt card when a wrong product is dropped in.
  flashPromptWrong() {
    const flash = this.add.graphics().setDepth(PROMPT.cardDepth + 1);
    const { width, height } = this.scale;
    const cx = width * PROMPT.xFrac;
    const cy = height * PROMPT.yFrac;
    // Size the flash from the card's OWN geometry, so it tracks cardScale instead
    // of using a hand-tuned size that would drift from the card it sits over.
    const scale = PROMPT.cardScale;
    const lineH = this.ordinalText.height;
    const w = Math.max(
      this.ordinalText.width,
      this.fromTheText.width,
      this.directionText.width
    ) + PROMPT.padX * scale * 2;
    const h = lineH * 3 + PROMPT.lineGap * scale * 2 + PROMPT.padY * scale * 2;

    flash.fillStyle(PROMPT.wrongFlashColor, PROMPT.wrongFlashAlpha);
    flash.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, PROMPT.cardRadius);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: PROMPT.wrongFlashMs,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });

    // A small shake on the words, so the refusal is felt as well as seen.
    this.tweens.add({
      targets: [this.ordinalText, this.fromTheText, this.directionText],
      x: `+=6`,
      duration: 60,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Joystick
  // ---------------------------------------------------------------------------

  buildJoystick() {
    const { width, height } = this.scale;
    this.joystickX = width * JOYSTICK.xFrac;
    this.joystickY = height * JOYSTICK.yFrac;
    this.joystickRadius = width * JOYSTICK.baseRadiusFrac;
    const knobRadius = width * JOYSTICK.knobRadiusFrac;

    // Base: a soft blurred disc behind a crisp ring. The blur is a baked radial
    // gradient texture (see makeSoftDiscTexture) — cheap at runtime, and unlike a
    // WebGL post-FX blur it works identically on both renderers.
    const discKey = makeSoftDiscTexture(this, JOYSTICK.baseGlow);
    // Drawn LARGER than the base (sizeMult). At 1:1 the falloff would sit entirely
    // under the ring and read as no blur at all.
    const glowSize = this.joystickRadius * 2 * JOYSTICK.baseGlow.sizeMult;
    this.joystickGlow = this.add
      .image(this.joystickX, this.joystickY, discKey)
      .setDisplaySize(glowSize, glowSize)
      .setDepth(JOYSTICK.depth);

    // Crisp ring + faint fill on top of the glow.
    this.joystickBase = this.add.graphics().setDepth(JOYSTICK.depth + 1);
    this.joystickBase.fillStyle(JOYSTICK.baseColor, JOYSTICK.baseAlpha);
    this.joystickBase.fillCircle(this.joystickX, this.joystickY, this.joystickRadius);
    this.joystickBase.lineStyle(
      JOYSTICK.baseLineWidth,
      JOYSTICK.baseLineColor,
      JOYSTICK.baseLineAlpha
    );
    this.joystickBase.strokeCircle(this.joystickX, this.joystickY, this.joystickRadius);

    // Knob, centred at rest.
    this.joystickKnob = this.add
      .circle(this.joystickX, this.joystickY, knobRadius, JOYSTICK.knobColor, JOYSTICK.knobAlpha)
      .setStrokeStyle(JOYSTICK.knobLineWidth, JOYSTICK.knobLineColor, JOYSTICK.knobLineAlpha)
      .setDepth(JOYSTICK.depth + 2);
  }

  // Joystick drag is driven by scene-level pointer events rather than a hit area
  // on the knob: on touch, a pointer's own `pointermove` stops firing once the
  // finger leaves the target, which desyncs the drag. A scene-level move keeps
  // tracking until the pointer is released.
  bindJoystickInput() {
    this.input.on('pointerdown', (pointer) => {
      // A product grab is checked FIRST and takes the pointer outright, so
      // tapping a box on the shelf can never also nudge the stick. Without this
      // branch products are not draggable at all — the joystick hit test below
      // simply returns early for pointers outside the stick.
      if (this.productPointerId === null && !this.heldProduct) {
        this.pickUpProduct(pointer);
        if (this.heldProduct) {
          this.productPointerId = pointer.id;
          return;
        }
      }

      if (this.joystickPointerId !== null) return;
      // Forgiving hit area around the base so the knob need not be hit exactly.
      const reach = this.joystickRadius * (1 + JOYSTICK.hitPadFrac);
      const dx = pointer.x - this.joystickX;
      const dy = pointer.y - this.joystickY;
      if (Math.hypot(dx, dy) > reach) return;

      // Kill any snap-back still running, or it would fight the new drag.
      this.tweens.killTweensOf(this.joystickKnob);
      this.joystickPointerId = pointer.id;
      this.moveJoystick(pointer);
    });

    this.input.on('pointermove', (pointer) => {
      // A held product owns its pointer: it must never also drive the stick.
      if (pointer.id === this.productPointerId) {
        this.moveHeldProduct(pointer);
        return;
      }
      if (pointer.id !== this.joystickPointerId) return;
      this.moveJoystick(pointer);
    });

    this.input.on('pointerup', (pointer) => {
      if (pointer.id === this.productPointerId) {
        this.productPointerId = null;
        this.dropHeldProduct(pointer);
        return;
      }
      if (pointer.id !== this.joystickPointerId) return;
      this.releaseJoystick();
    });

    // A cancelled pointer (system gesture, app switch, drag off the canvas) must
    // not strand a held product or leave the stick deflected.
    this.input.on('pointerupoutside', (pointer) => {
      if (pointer.id === this.productPointerId) {
        this.productPointerId = null;
        this.dropHeldProduct(pointer);
        return;
      }
      if (pointer.id === this.joystickPointerId) this.releaseJoystick();
    });
  }

  // Position the knob for a pointer and derive the horizontal axis from it.
  // Only left/right is used — vertical motion is constrained so the knob slides
  // along the horizontal axis only.
  moveJoystick(pointer) {
    const maxOffset = this.joystickRadius;
    let dx = pointer.x - this.joystickX;
    dx = Math.max(-maxOffset, Math.min(maxOffset, dx));

    this.joystickKnob.x = this.joystickX + dx;

    const deflection = dx / maxOffset; // -1..1
    this.axis = Math.abs(deflection) < JOYSTICK.deadZone ? 0 : deflection;

    // Taking the stick ends any transition celebration, so the player always wins
    // control the moment they touch it.
    if (this.axis !== 0) {
      this.celebrationUntil = 0;
    }
  }

  releaseJoystick() {
    this.joystickPointerId = null;
    this.axis = 0;
    // Snap the knob home rather than leaving it stuck where the finger lifted.
    this.tweens.add({
      targets: this.joystickKnob,
      x: this.joystickX,
      duration: JOYSTICK.returnMs,
      ease: 'Sine.easeOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  update(_time, delta) {
    // Clamp a tab-wake delta so the world cannot jump a whole screen at once.
    const dt = Math.min(delta, WORLD.maxDeltaMs) / 1000;

    // Camera: deflection sets the speed. The bounds are cached per round, so this
    // is just a clamp — pushing past either end stops the scroll instead of
    // running off the shelf.
    //
    // The joystick is the ONLY thing that moves the camera now: a round opens
    // framed at its counting side (see cameraStartFor) and then stays wherever
    // the child leaves it, so there is no tween to arbitrate with here.
    if (this.axis !== 0) {
      const next = this.cameraX + this.axis * WORLD.scrollSpeed * dt;
      this.cameraX = Math.min(this.cameraMax, Math.max(this.cameraMin, next));
      this.world.x = -this.cameraX;
    }

    // Character lean: eases toward the deflection and STOPS at
    // ±characterDriftPx, so it leans into the walk without leaving its spot.
    const targetDrift = this.axis * WORLD.characterDriftPx;
    this.drift += (targetDrift - this.drift) * (1 - Math.exp(-WORLD.driftEase * dt));

    this.character.x = this.characterBaseX + this.drift;
    this.character.y = this.characterBaseY;

    // The walk cycle is driven by the SAME axis as the scroll above: direction
    // picks forward (1..27) or reverse (27..1), and |axis| scales the stride so
    // the feet stay locked to the moving background.
    this.updateCharacterAnimation();
  }

  // ---------------------------------------------------------------------------
  // Celebration + end of run
  // ---------------------------------------------------------------------------

  // Confetti burst, used for a completed round AND at the end of the run.
  // Uses the shared confetti textures from @/phaser/common/sceneAssets.
  spawnConfetti(count) {
    const { width, height } = this.scale;
    const texKeys = [makeConfettiTexture(this), makeConfettiSquareTexture(this)];
    const tints = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6];

    for (let i = 0; i < count; i += 1) {
      const key = texKeys[i % texKeys.length];
      const piece = this.add
        .image(
          Phaser.Math.Between(20, width - 20),
          Phaser.Math.Between(-180, -60),
          key
        )
        // Below the full-screen flash and the mute button. Confetti is part of the
        // scene being transitioned, so a flash must be able to cover it.
        .setDepth(FLOW.confettiDepth)
        .setTint(Phaser.Utils.Array.GetRandom(tints))
        .setScale(Phaser.Math.FloatBetween(1.1, 2.2))
        .setAngle(Phaser.Math.Between(0, 360));

      this.tweens.add({
        targets: piece,
        x: piece.x + Phaser.Math.Between(-80, 80),
        y: height + 60,
        angle: piece.angle + Phaser.Math.Between(220, 620),
        duration: Phaser.Math.Between(1500, 2600),
        delay: i * 40,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  // The end card: a star rating, the mistake count and a Play Again button.
  showEndOverlay() {
    const { width, height } = this.scale;

    const overlay = this.add.container(0, 0).setDepth(CONTROLS.muteDepth - 2);
    this.endOverlay = overlay;

    overlay.add(
      this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 0.62)
    );

    const panelW = width * 0.72;
    const panelH = width * 0.56;
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);
    bg.lineStyle(6, 0x22c55e, 1);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);

    const panel = this.add.container(width / 2, height / 2, [bg]).setScale(0);
    overlay.add(panel);
    this.tweens.add({
      targets: panel,
      scale: 1,
      duration: 380,
      ease: 'Back.easeOut',
    });

    panel.add(
      this.add
        .text(0, -panelH * 0.28, 'All done!', {
          fontSize: '42px',
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: '#166534',
        })
        .setOrigin(0.5)
    );

    panel.add(
      this.add
        .text(0, -panelH * 0.05, '\u2B50'.repeat(this.starsEarned()), {
          fontSize: '42px',
        })
        .setOrigin(0.5)
    );

    const note =
      this.mistakes === 0
        ? 'Perfect run!'
        : `${this.mistakes} ${this.mistakes === 1 ? 'wrong try' : 'wrong tries'}`;
    panel.add(
      this.add
        .text(0, panelH * 0.12, note, {
          fontSize: '24px',
          fontFamily: 'Fredoka, sans-serif',
          color: '#8a7758',
        })
        .setOrigin(0.5)
    );

    const btn = this.createPillButton(0, panelH * 0.34, 'Play Again \uD83D\uDD04', {
      fontSize: '26px',
      paddingX: 30,
      paddingY: 14,
      depth: CONTROLS.muteDepth,
    });
    panel.add(btn.container);
    btn.on('pointerup', () => this.scene.restart());
  }
}
