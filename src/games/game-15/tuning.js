// tuning.js
// Game 15 — THE TUNING FILE.
//
// Every adjustable number the game reads lives here, so the layout and feel can
// be re-tuned by eye without touching any logic in GameScene.js. Nothing in this
// file is stateful and it imports nothing, so it is safe to edit and save; Vite
// hot-reloads it.
//
// Coordinates are INTERNAL pixels on the 720x1080 canvas (see
// DEFAULT_BASE_RESOLUTION in @/phaser/config): x = 0 is the left edge, y = 0 the
// top, (360, 540) is screen centre. Anything named `...Frac` is a 0..1 fraction
// of the canvas width/height, so it survives a different resolution.

// Phaser canvas clear colour (see Game.jsx), so the single frame before the
// backdrop draws is not a bare canvas.
export const BACKGROUND_COLOR = '#0b1220';

// Background music level for THIS game. Mute itself stays global (see
// @/phaser/common/audioState) — never add a per-game mute key.
export const SOUND = {
  bgMusicVolume: 0.27,
};

// ---------------------------------------------------------------------------
// SCREEN BANDS — the vertical split the layout is built from:
//   0.00 → 0.40  shelf (products)
//   0.40 → 0.60  DELIBERATELY EMPTY — prompt copy goes here later
//   0.60 → 1.00  character + joystick
// Only the shelf edge is a number the scene reads; the other two are described
// here because they constrain where CHARACTER.yFrac / JOYSTICK.yFrac may sit.
// ---------------------------------------------------------------------------
export const BANDS = {
  shelfEndFrac: 0.4,
};

// ---------------------------------------------------------------------------
// BACKDROP — the supermarket art, drawn as a horizontally LOOPED tile sprite
// inside the world container so it scrolls with the shelf and sells the feeling
// of exploring a wide area.
//
// The art is 720x1080 (one screen), so it is scaled to the canvas HEIGHT and
// then repeated to whatever width is needed: it therefore fills the scene at any
// aspect ratio, and keeps tiling as the camera pans.
// ---------------------------------------------------------------------------
export const BACKDROP = {
  // Texture key, matching IMAGES in assets.js.
  key: 'backdrop',

  // Fill drawn behind everything. Also the fallback if the art fails to load, so
  // the canvas is never left transparent over the platform gradient.
  color: 0x0b1220,

  // 1 = fully opaque.
  alpha: 1,

  // Vertical nudge in internal px, if the art's horizon needs adjusting.
  offsetY: 0,

  // Depth of the fallback fill only. The tiled art lives inside the world
  // container (draw order there is insertion order, not depth).
  fillDepth: -20,
};

// ---------------------------------------------------------------------------
// WORLD — how wide the explorable area is and how the camera/character move.
// ---------------------------------------------------------------------------
export const WORLD = {
  // Total products on the shelf, and how many of them fit on screen at once.
  // The world's width is derived from these two (count / visible), so the shelf
  // can grow to any number of products without touching the scene.
  products: 10,
  visibleProducts: 3,

  // Pan speed at full joystick deflection, internal px/s. Higher = the shelf
  // scrolls past faster.
  scrollSpeed: 520,

  // The character leans this far in the direction of travel and then STOPS
  // there while the world keeps moving — it reads as walking without drifting
  // off its spot.
  characterDriftPx: 26,
  // How quickly the lean eases in/out (per second; higher = snappier).
  driftEase: 7,

  // NOTE: there is deliberately no synthetic vertical bob any more. The walk
  // cycle now comes from the 27-frame animation, which carries its own bounce;
  // adding a bob on top would double it up and look seasick.

  // Largest simulation step (ms). A backgrounded tab hands a huge delta on
  // return; clamping keeps that from becoming one giant jump on the first frame.
  maxDeltaMs: 50,
};

// ---------------------------------------------------------------------------
// SHELF ART — the painted shop shelving (left end + looped middle + right end).
// The art is a 170x1080 unit containing several shelf levels. It is scaled so
// ONE of those levels fills the top band, and the levels above/below are hidden
// by a mask — so the band reads as a single shelf compartment.
// ---------------------------------------------------------------------------
export const SHELF_ART = {
  // Texture keys, matching IMAGES in assets.js.
  endKey: 'shelfEnd',
  mainKey: 'shelfMain',

  // Height of the artwork as a fraction of the canvas height. The default is
  // derived from the art: the compartment between its 0.696 and 0.906 boards is
  // 21% of the image, so 1 / 0.21 ≈ 1.9 makes that one compartment fill the
  // top 40% band exactly.
  heightFracOfCanvas: 0.65,

  // ---- ARTWORK PLACEMENT -------------------------------------------------
  // These two decide where the SHELF IMAGE sits. Changing them moves the art
  // only; the products have their own selector below.

  // Which board of the art is used as the placement reference, as a fraction of
  // the art's own height from its top. 0.906 is the unit's base board.
  rowTopFrac: 0.5,

  // Where that reference board lands on the canvas, as a fraction of the canvas
  // height. 0.4 = the bottom of the shelf band.
  rowLandsAtFrac: 0.4,

  // Vertical nudge for the artwork alone, in internal px. Negative = up.
  offsetY: 0,

  // ---- PRODUCT ROW PLACEMENT ---------------------------------------------
  // Measured on the SAME art coordinates as `rowTopFrac`, but applied only to the
  // product boxes — so you can slide the products up or down the shelf image
  // without moving the shelf image at all.
  //
  // The art's board tops are at these fractions of its height:
  //   top compartment   0.072
  //   second            0.256
  //   third             0.472
  //   fourth            0.696
  //   base              0.906
  // Use one of those to rest the products on that painted board, or any value in
  // between to float them.
  productsRowTopFrac: 0.425,

  // Fine vertical nudge for the PRODUCT ROW ONLY, in internal px, applied on top
  // of `productsRowTopFrac`. Negative = up. Use this for a few px of precision
  // once the board above is roughly right.
  productsOffsetY: 0,

  // 1 = fully opaque. Lower it only if the backdrop should show through the
  // shelving, which usually looks like a rendering bug rather than a design.
  alpha: 1,
};

// ---------------------------------------------------------------------------
// SHELF — the row of coloured product boxes across the top band.
// ---------------------------------------------------------------------------
export const SHELF = {
  // Fallback box row position used ONLY when the shelf art fails to load, as a
  // fraction of the canvas height.
  boxYFrac: 0.19,
  boxHeightFrac: 0.16, // box height, as a fraction of the canvas height
  // Box width, as a fraction of ONE product cell (cellW = worldWidth / products).
  // 0.8 leaves a comfortable gap between neighbouring boxes.
  boxWidthFracOfCell: 0.8,
  radius: 18, // rounded corner radius
  outline: 0x0f172a,
  outlineWidth: 4,

  // Empty shelf between the row and EACH upright, as a fraction of one product
  // cell. The row is always centred, so this applies symmetrically to both sides.
  //
  // This is the ONLY knob for the row's inset — the margin no longer derives from
  // the camera. 0 = boxes touching the uprights, 0.35 = about a third of a cell
  // of breathing room (current), 1 = a full empty cell.
  sidePadFracOfCell: 0.35,

  // Bare BACKGROUND before the first upright and after the last, as a fraction
  // of the canvas width. The world is widened by this on both sides, so the shelf
  // never runs flush to the edge of the explorable area — you can walk a little
  // past either end and see only shop, which reads as a room rather than a strip.
  //
  // 0 = shelf edges are the world edges (no run-off). 0.25 = a quarter screen of
  // shop floor at each end (current). 0.5 = half a screen.
  endMarginFracOfScreen: 0.25,

  // ---------------------------------------------------------------------
  // ORDINALS — the "1st, 2nd, 3rd…" label centred above each product.
  // ---------------------------------------------------------------------
  ordinals: {
    // How far ABOVE each product's baseline the label sits, as a fraction of the
    // shelf box height. THIS is the knob for moving the whole line up or down.
    // Negative = higher. At 1.0 the label sits just above the tallest a product
    // can be, so it clears the art rather than overlapping it.
    aboveBoxHeightFrac: 1.27,

    // Label size, as a fraction of the canvas width (so it scales with the game).
    fontSizeFracOfWidth: 0.06,
    fontFamily: 'Fredoka, sans-serif',
    color: '#ffffff',
    // Dark stroke keeps white text legible over a busy shop backdrop.
    stroke: '#0f172a',
    strokeWidthFrac: 0.22, // multiplies the font size
    alpha: 1,
    // Draw them behind the products, so a tall item can overlap its label rather
    // than the label floating on top of the art.
    depth: -1,
  },

  // One colour per product; the list is cycled if `WORLD.products` is larger.
  colors: [
    0xf87171, // red
    0xfbbf24, // amber
    0x34d399, // emerald
    0x60a5fa, // blue
    0xa78bfa, // violet
    0xf472b6, // pink
    0x22d3ee, // cyan
    0xa3e635, // lime
    0xfb923c, // orange
    0x94a3b8, // slate
  ],

  // How far above the shelf's board surface a product's bottom sits, in px. 0
  // rests it exactly on the board; a small positive value lets it settle into
  // the board's top edge instead of floating above it.
  restsOnRowNudgeY: 2,

  // FALLBACK ONLY (used when the shelf artwork is missing): a flat plank behind
  // the boxes so they are not floating in space.
  // NOTE: objects inside the world container are drawn in the order they are
  // added, not by depth — Phaser does not sort a container's children. Hence no
  // `depth` keys here.
  plank: {
    offsetYMult: 1.28, // multiplies the box height, measured from the box centre
    height: 10,
    color: 0x64748b,
    alpha: 0.95,
  },

  // FALLBACK ONLY: a faint lighter panel behind the shelf band.
  panel: {
    color: 0x132a44,
    alpha: 0.6,
  },
};

// ---------------------------------------------------------------------------
// CHARACTER — the walk-cycle sprite, with a placeholder box as the fallback.
// ---------------------------------------------------------------------------
export const CHARACTER = {
  sizeFrac: 0.22, // side length of the FALLBACK box, as a fraction of the canvas
  xFrac: 0.44, // base x (the lean is added on top of this)
  yFrac: 0.8, // vertical centre, inside the bottom band
  radius: 16,
  color: 0x38bdf8,
  outline: 0x0f172a,
  outlineWidth: 4,
  depth: 20,

  // Simple face, so the FALLBACK box reads as a character rather than a panel.
  // Unused when the sprite animation loads.
  eyeXFrac: 0.18, // eye offset from centre, as a fraction of the box size
  eyeYFrac: -0.08,
  eyeRadiusFrac: 0.075,
  eyeColor: 0x0f172a,

  // ---------------------------------------------------------------------
  // CART — a reference box standing in for the cart the character pushes.
  // It is drawn OVER the character (it is added to the same container after the
  // sprite, so it simply overlaps), because it is a placeholder for art that
  // will eventually be in front of the character.
  // ---------------------------------------------------------------------
  cart: {
    // Box size, as fractions of the canvas width/height. Width is deliberately
    // wider than tall so it reads as a cart rather than a second character.
    widthFrac: 0.44,
    heightFrac: 0.14,

    // Position relative to the character's centre, as fractions of the character
    // container. 0 = centred on the character. Positive y = lower on screen.
    // Sitting it low and slightly right puts the cart in front of the body
    // rather than on its face.
    xFrac: 0.45,
    yFrac: 0.10,

    radius: 14,
    color: 0xf59e0b,
    alpha: 0.9,
    outline: 0x0f172a,
    outlineWidth: 4,

    // Draw the cart box itself. Items dropped into it still appear even when the
    // box is hidden, so this only controls the placeholder rectangle.
    visible: false,

    // ---- ITEMS SEATED IN THE CART --------------------------------------
    // A dropped product shrinks to this size and stacks inside the cart.
    // A fraction of the cart WIDTH, so items always fit however the cart is sized.
    itemSizeFracOfCartWidth: 0.26,
    // Gap between items, as a fraction of an ITEM's own size.
    itemGapFracOfItem: 0.15,
    // Items per row before wrapping onto the next row.
    itemsPerRow: 3,
    // Inset from the cart's edges, as a fraction of the cart size, so items never
    // touch the outline.
    itemPadFrac: 0.1,
    // Seat pop: the item lands slightly larger and settles.
    itemPopFromScale: 1.3,
    itemPopMs: 200,
    itemPopEase: 'Back.easeOut',
    // Sound when an item lands.
    itemPopKey: 'pop1',
    itemPopVolume: 0.7,
  },

  // ---------------------------------------------------------------------
  // DRAG — picking a product off the shelf and dropping it in the cart.
  //
  // Hit-testing is done by hand rather than with per-object interactive areas:
  // the products live inside the PANNED world container while the cart is fixed
  // on screen, so a drag crosses two coordinate spaces. Manual testing against
  // `pointer.x/y` (already unscaled by Phaser) plus the camera offset keeps that
  // in one place and matches how the joystick is driven.
  // ---------------------------------------------------------------------
  drag: {
    // Extra grab area around each product, as a fraction of its own size. Kids
    // grab the edges, so the target is deliberately bigger than the art.
    //
    // Keep this under 0.25: the box is 0.8 of a cell, so a half-width of
    // 0.8/2 * (1 + pad) stays below the 0.5-cell midpoint only while pad < 0.25.
    // Above that, neighbouring grab zones overlap and a tap between two products
    // becomes ambiguous.
    grabPadFrac: 0.05,
    // Scale multiplier while a product is being dragged.
    dragScale: 0.5,
    // Alpha while dragging, so it reads as "held" rather than placed.
    dragAlpha: 0.92,
    // Depth of the dragged item. Above every world and HUD object.
    dragDepth: 900,
    // How long a dropped-but-missed item takes to fly back to the shelf.
    returnMs: 260,
    returnEase: 'Sine.easeOut',
    // A drop counts as "in the cart" within this extra margin around the cart
    // box, as a fraction of the cart size — forgiving for small hands.
    dropPadFrac: 0.35,
    // Sound when a product is picked up.
    pickupSound: 'pop1',
    pickupVolume: 0.35,
  },

  // ---------------------------------------------------------------------
  // ANIMATION — the sprite path. When `FRAME_ANIMATIONS.hero` has any URLs,
  // the sprite replaces the placeholder box entirely.
  // ---------------------------------------------------------------------
  anim: {
    // Phaser animation key. Identity value: the scene refers to it by name.
    key: 'g15-hero-walk',

    // ---- SIZE ----------------------------------------------------------
    // Drawn height, as a fraction of the canvas height. This is THE size knob
    // for the character; the fallback box uses `sizeFrac` instead.
    //
    // The character's centre sits at `yFrac` (0.8) and the bottom band starts at
    // 0.6, so anything up to ~0.38 keeps the sprite inside its band at 1080px.
    // 0.36 fills most of it (≈389px) without colliding with the prompt area.
    heightFracOfCanvas: 0.6,

    // Extra vertical nudge from the origin, as a fraction of the canvas height.
    // Negative = up. Use it to sit the feet on the floor line.
    yOffsetFrac: 0,

    // ---- SPEED ---------------------------------------------------------
    // Frame rate at FULL walking speed. This is THE speed knob for the animation.
    //
    // 27 frames at 16fps ≈ 1.69 s per loop, a relaxed walking pace. The previous
    // 26fps looped in ~1.04 s, which read as a scamper. Lower = slower stride.
    baseFrameRate: 12,

    // Playback speed at the lightest and heaviest stick deflection. This is what
    // ties the animation to the movement: the world scrolls at a speed
    // proportional to `|axis|`, and the stride is scaled by exactly the same
    // value, so the feet never skate relative to the background.
    //
    // These multiply `baseFrameRate`, so they are relative — lower both if the
    // walk still feels hurried, raise them if it feels sluggish.
    minTimeScale: 0.35,
    maxTimeScale: 1.35,
  },

  // ---------------------------------------------------------------------
  // IDLE — a single still frame, swapped in whenever the character stops.
  //
  // No tween and no idle animation: stopping simply shows this image, exactly
  // like every other frame in the walk cycle. It is scaled from the same
  // `anim.heightFracOfCanvas` as the walk sprite so the two never jump in size.
  // ---------------------------------------------------------------------
  idle: {
    // Texture key, matching IMAGES in assets.js.
    key: 'heroIdle',
  },
};

// ---------------------------------------------------------------------------
// JOYSTICK — drag it left/right to pan the world.
// ---------------------------------------------------------------------------
export const JOYSTICK = {
  xFrac: 0.80, // rest position, as a fraction of the canvas width
  yFrac: 0.50,
  baseRadiusFrac: 0.115, // of the canvas width
  knobRadiusFrac: 0.05,

  // The base disc's "blur". Baked into a canvas texture once (see
  // makeSoftDiscTexture) rather than a WebGL post-FX blur: a real blur pipeline
  // costs frames on school tablets and silently does nothing in canvas fallback,
  // while a gradient texture is free at runtime and identical on both renderers.
  baseColor: 0xffffff,
  baseAlpha: 0.14,
  baseGlow: {
    // Colour/alpha at the centre of the soft disc, fading to fully transparent
    // at the rim. A soft white bloom under the ring is what reads as "blurred".
    innerColor: 'rgba(255, 255, 255, 0.55)',
    midColor: 'rgba(160, 200, 255, 0.28)',
    outerColor: 'rgba(160, 200, 255, 0)',
    // Where the falloff starts, 0..1 of the radius. Lower = softer, wider glow.
    midStop: 0.35,
    // Texture resolution multiplier over the radius. 2 = crisp at 2x upscale;
    // a soft gradient tolerates downscaling well, so this stays cheap.
    resolution: 2,
    // How much BIGGER than the base circle the glow is drawn. This is the knob
    // that actually makes the blur visible: at 1.0 the glow is exactly the size
    // of the base, so its soft edge sits underneath the ring and nothing spills
    // outside — it looks like no blur at all. Anything above ~1.2 puts the
    // falloff outside the ring, which is what reads as a bloom.
    sizeMult: 6,
  },
  baseLineColor: 0xffffff,
  baseLineAlpha: 0.55,
  baseLineWidth: 3,
  knobColor: 0x60a5fa,
  knobAlpha: 1,
  knobLineColor: 0xffffff,
  knobLineAlpha: 0.9,
  knobLineWidth: 3,
  depth: 30,

  // Stick deflection below this fraction of the radius is treated as centred,
  // so a resting thumb cannot make the world creep.
  deadZone: 0.08,

  // Forgiving tap area around the base, as a fraction of the base radius — the
  // knob need not be touched exactly.
  hitPadFrac: 0.35,

  // Snap-back when released.
  returnMs: 160,
};

// ---------------------------------------------------------------------------
// CONTROLS — the shared mute button's position (audioState.addMuteButton).
// ---------------------------------------------------------------------------
export const CONTROLS = {
  muteX: 16,
  muteY: 16,
  muteDepth: 1000,
};

// ---------------------------------------------------------------------------
// EDGE ARROWS — the left/right direction hints pinned to the screen edges.
//
// These are SCREEN-space UI (they do not pan with the world): red on the left,
// blue on the right, pointing outward from each edge. They sit behind the
// content so they never block a drag, and they are purely decorative — no input.
//
// The "animation" is a small looping tween on x and alpha, shared by both arrows.
// Cheap on purpose: two tweens total, no textures, no per-frame work.
// ---------------------------------------------------------------------------
export const EDGE_ARROWS = {
  // Vertical position, as a fraction of the canvas height. THIS is the knob to
  // move both arrows together up or down.
  yFrac: 0.354,

  // Arrow size, as a fraction of the canvas width. Also sets how far the arrow
  // pokes in from its edge (see `insetFracOfSize`).
  sizeFrac: 0.14,

  // How far the arrow's tip sits from its screen edge, as a fraction of the
  // arrow's own size. 0 = tip exactly on the edge.
  insetFracOfSize: 0.15,

  // Arrow proportions, all as fractions of `size`. Together these make a real
  // arrow (shaft + head) rather than a bare triangle:
  //   headWidthFrac  — how long the head is (of the total length)
  //   headHeightFrac — how tall the head is (of the total length)
  //   shaftHeightFrac— how thick the shaft is (of the total length)
  headWidthFrac: 0.45,
  headHeightFrac: 0.9,
  shaftHeightFrac: 0.34,

  // Outline around the whole arrow. Drawn by stroking the arrow's own closed
  // path, so it wraps the silhouette continuously instead of leaving a seam
  // between the shaft and the head.
  //
  //   outlineWidth — stroke thickness in px. 0 disables the outline entirely.
  //   outlineColor — a dark navy reads as an outline against both the red and
  //                  the blue fill, and matches the shelf/cart outlines.
  //   outlineAlpha — 1 = solid.
  outlineWidth: 4,
  outlineColor: 0x0f172a,
  outlineAlpha: 1,

  colors: {
    left: 0xef4444, // red
    right: 0x3b82f6, // blue
  },

  // Which way the arrows POINT. One flag, so flipping them is a single value
  // rather than a geometry edit:
  //   true  → both point INWARD, toward the content (left arrow points right,
  //           right arrow points left)
  //   false → both point OUTWARD, toward their screen edges
  //
  // NOTE: this only changes the arrowHEAD. Their positions and the outward
  // drifting pulse are unchanged either way, so they always hug their edges.
  pointInward: true,

  // Slightly transparent, so the arrows read as hints rather than solid chrome.
  alpha: 1,

  // Depth: above the backdrop, below the character/joystick/cart so nothing
  // interactive is ever covered. The world container is at 0 and the character
  // at 20, so 5 keeps these well clear of both.
  depth: 5,

  // The pulse. Each arrow drifts this far OUTWARD (px, at full deflection) and
  // fades between `alphaMin` and `alpha`. Both arrows share the timing so they
  // breathe in sync.
  pulseDistancePx: 14,
  alphaMin: 0.7,
  halfCycleMs: 900,
  ease: 'Sine.easeInOut',
};

// A single aggregate, handy for a live-tuning panel or for printing the whole
// config at once.
export const TUNING = {
  BANDS,
  BACKDROP,
  WORLD,
  SHELF,
  CHARACTER,
  JOYSTICK,
  EDGE_ARROWS,
  SOUND,
};
