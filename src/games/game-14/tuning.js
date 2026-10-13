// tuning.js
// Game 14 — THE TUNING FILE. Every adjustable number the scene reads lives here,
// so the whole game can be re-centred and re-timed by eye without touching any
// logic in GameScene.js. Nothing in this file is stateful and it imports nothing,
// so it is safe to edit and save; Vite hot-reloads it.
//
// Coordinates are INTERNAL pixels on the 720x1080 canvas (see
// DEFAULT_BASE_RESOLUTION in @/phaser/config). x = 0 is the left edge, y = 0 the
// top, (360, 540) is screen centre. Anything expressed as a `Frac` is a 0..1
// fraction of the canvas width/height, so it survives a different resolution.

// Canvas clear colour (see Game.jsx), so the single frame before the sky draws
// is not a bare canvas.
export const BACKGROUND_COLOR = '#0f3d5c';

// The 3-stop sky this game's loading scene hands off from, so there is no seam.
export const SKY_THEME = {
  bgColors: ['#3fb6ea', '#8fe0fa', '#ffe9a8'],
  groundColor: '#8ee06a',
};

// Drifting clouds from the shared BaseScene.addDriftingClouds(). Each entry:
// xr/yr = position as a fraction of the canvas, plus scale/alpha. Only used as
// a FALLBACK when the background image is missing.
export const CLOUDS = [
  { xr: 0.18, yr: 0.16, scale: 1, alpha: 0.85 },
  { xr: 0.78, yr: 0.1, scale: 0.8, alpha: 0.7 },
];

// Background — the full-screen countryside image. Drawn COVER (scaled so it
// fills the canvas on both axes and centred), so it never stretches out of
// aspect. When it is missing, the scene falls back to SKY_THEME + CLOUDS.
export const BACKGROUND = {
  key: 'background', // must match the IMAGES key in assets.js
  depth: -10, // behind the track (0) and every cart
};

// ---------------------------------------------------------------------------
// TRAIN CONFIG
// ---------------------------------------------------------------------------
export const TRAIN = {
  // How many rounds a full game runs for. Each round re-rolls the task order.
  rounds: 3,
  // TOTAL sprites in the consist, including the locomotive. headIndex 0 is the
  // head, so the body carts (the numbered ones) run 1..carts-1 = 1..5.
  carts: 6,
  // INTRO: on load the train starts fully OFF-SCREEN to the right and rolls in
  // until the two carts named below straddle the screen centre; the controls
  // only appear after it stops.
  //   durationMs  — how long the roll-in takes.
  //   ease        — a decelerating ease so it glides to a halt, like a train.
  //   centerFrom/centerTo — the two cart indices whose MIDPOINT lands on centre.
  //   offscreenPad — extra px past "fully off screen" it starts from, so it is
  //                  convincingly invisible on frame 1.
  intro: {
    durationMs: 2700,
    ease: 'Cubic.easeOut',
    centerFrom: 0,
    centerTo: 1,
    offscreenPad: 40,
  },
  // PAN LIMIT: the train may be driven off either edge only as far as being
  // fully off-screen; `overshootPad` allows a little extra past that (0 = stop
  // exactly when the last cart clears the edge) so it can never run away.
  pan: { overshootPad: 0 },
  // Which slot is the locomotive (the `trainHead` image). 0 = the first/leftmost
  // cart. The head art replaces the lid+body stack for that one slot.
  headIndex: 0,
  // How many carts should be visible across the screen at once. The cart scale
  // is derived from this so it stays correct at any resolution.
  visibleCarts: 3,
  // Where the train sits vertically, as a fraction of the canvas height. Matches
  // TRACK.yFrac so the carts rest on the line.
  yFrac: 0.5,
  // The train's starting position as a fraction of the screen width, so a few
  // carts have already rolled into frame at load.
  startFrac: 0.62,
  // Fraction of the visible cart width the train covers per second at rest, and
  // the top speed in internal px/s while a control is held.
  speed: 320,
  // Easing rates (per second) for the velocity — this is what makes the train
  // roll away from a standstill and coast to a stop instead of snapping between
  // 0 and full speed. Higher = snappier, lower = more glide.
  accel: 2.5,
  brake: 2.0,
  // Speeds below this (px/s) settle to exactly 0, so a stopped train is still.
  settleSpeed: 4,
  // Largest simulation step (ms). A backgrounded tab hands a huge delta on
  // return; clamping keeps that from becoming one giant jump on the first frame.
  maxDeltaMs: 50,

  // Optional nudge (px) to close any transparent padding between the lid's
  // bottom edge and the body's top edge. 0 is a true butt joint.
  lidOverlap: 0,

  // The ENDING cart is always the LAST cart in the consist (index carts-1),
  // whatever the cart count or order. It uses the `cartBodyEnd` image for its
  // body, the same lid, and the same rider mechanism — nothing to tune here
  // except (optionally) which index is treated as "the end". -1 = the last.
  endCartIndex: -1,

  // CART NUMBERS: a big bold number centred on each cart body, counting the
  // body-bearing carts 1..N along the consist (the locomotive head is not
  // numbered). All sizes are fractions so they scale with the cart.
  number: {
    sizeFrac: 0.30, // font size as a fraction of the cart width
    strokeFrac: 0.028, // stroke thickness as a fraction of the cart width
    color: '#ffffff',
    stroke: '#1f2937',
    fontFamily: 'Fredoka, sans-serif',
    // Extra vertical nudge from the body's centre, as a fraction of the cart
    // height (negative = up). 0 = dead centre of the body.
    yOffsetFrac: -0.065,
  },

  // RIDERS — animals dragged from the task card onto a cart. A rider is placed
  // behind the body and in front of the lid (see GameScene.buildTrain for the
  // draw order).
  rider: {
    // A landed rider is scaled to this fraction of a cart's width.
    scaleFrac: 0.8,
    // WHERE A LANDED RIDER SITS. Coordinates are relative to the CART's own
    // centre (0,0 = dead centre of the whole cart), so the full travel is the
    // cart's own size — not the (much shorter) body's.
    //   xFrac  — horizontal position as a fraction of the cart WIDTH from centre:
    //            -0.5 = left edge, 0 = centred, +0.5 = right edge.
    //   yFrac  — vertical position as a fraction of the cart HEIGHT from centre:
    //            -0.5 = cart top, 0 = centre, +0.5 = cart bottom.
    //   offsetX / offsetY — fine px nudges applied ON TOP of the fractions
    //            (+x = right, +y = down), for pixel-precise placement.
    xFrac: 0,
    yFrac: -0.7,
    offsetX: 0,
    offsetY: 0,
    dragAlpha: 0.92,
    dragDepth: 40,
    // A drop lands when the pointer is inside a cart's drop box, sized as a
    // fraction of the cart's own width/height around its centre.
    dropHalfWFrac: 0.6,
    dropHalfHFrac: 0.95,
    // Landing pop.
    landScaleFrom: 1.35,
    landDurationMs: 240,
    landEase: 'Back.easeOut',
    // Controls / card reveal (after the intro finishes).
    popInDurationMs: 320,
    popInEase: 'Back.easeOut',
  },

  // TASK CARD — ONE card at the bottom at a time. It shows an animal and the
  // position it belongs in, SPELLED as a word ("second"). The player drags the
  // animal onto the matching cart. When grabbed the animal grows to its
  // on-cart size; a drop anywhere other than the correct cart sends it back.
  task: {
    // Position words, indexed by cart number - 1 (cart 1 = "first").
    ordinals: [
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'sixth',
      'seventh',
      'eighth',
    ],
    cardYFrac: 0.86, // card centre, as a fraction of the canvas height
    cardW: 250,
    cardH: 250,
    radius: 26,
    fill: 0xffffff,
    fillAlpha: 0.96,
    border: 0x6366f1,
    borderWidth: 6,
    shadowOffset: 6,
    shadowAlpha: 0.18,
    depth: 15,
    // Label (the spelled position) sits in the upper part of the card; the
    // animal in the lower part. Both are fractions of the card height from its
    // centre (negative = up).
    labelYFrac: -0.4,
    labelFontSize: 42,
    labelColor: '#4338ca',
    animalYFrac: 0.06,
    animalSize: 200, // the card animal is scaled to fit this square
    // Grabbing the card animal grows it to its cart size in this long.
    grabGrowMs: 150,
    grabEase: 'Back.easeOut',
    // Returning a mis-dropped animal to the card.
    returnMs: 240,
    doneText: 'All aboard!',
  },

  // ALL ABOARD — the confirm button between the two arrows. It appears once
  // every animal has been placed somewhere. Tapping it checks the placements:
  // right → the train leaves; wrong → the board flashes red and it counts a
  // wrong.
  allAboard: {
    label: 'All aboard!',
    yFrac: 0.16, // button centre, as a fraction of the canvas height
    fontSize: '30px',
    minWidth: 250,
    minHeight: 84,
    depth: 60,
    // Wrong-answer feedback.
    flashDurationMs: 420,
    flashColor: 0xff6b6b,
    shakeAmplitude: 12,
    shakeDurationMs: 380,
    wrongKey: 'wrong', // must match an assets.js AUDIO key
  },

  // The correct placement: the N-th RIDER_KEY (in its shuffled deal order) rides
  // the cart whose NUMBER is that same Nth numbered cart. In other words the
  // first-dealt animal belongs on the first-dealt position, the second on the
  // second, and so on. No extra config — it derives from the shuffle.
  placement: {
    // Extra settle time after a correct check before the train rolls out.
    leaveDelayMs: 260,
    leaveDurationMs: 1300,
    leaveEase: 'Cubic.easeIn',
    // Beat between rounds while the train is off screen.
    betweenRoundsMs: 420,
  },

  // Idle bob: each cart rises/falls by `bobAmplitude` px on a `bobPeriodMs`
  // half-cycle, phase-shifted by `bobPhaseStep` per cart so the consist ripples
  // like a real train rather than moving as one rigid block.
  bobAmplitude: 2,
  bobPeriodMs: 140,
  bobPhaseStep: 0.6,

  // The coloured block used when neither the cart nor the head art has loaded.
  placeholderAspect: 0.5, // placeholder height as a fraction of its width
  placeholderColor: 0x38bdf8,

  // Depth (z) layers. The head is lifted ABOVE the carts so it reads as being in
  // front of the consist; the smoke sits above everything.
  cartDepth: 5,
  headDepth: 6,
  smokeDepth: 7,

  // Cheap chimney smoke: puffs emitted from a FIXED point on the head. One
  // pooled emitter, exploded on a cadence — no per-puff tweens, so it stays
  // kind to old phones.
  smoke: {
    everyMs: 130,
    quantity: 1,
    // Where on the head the chimney sits, as a fraction of the head's width from
    // its centre. NEGATIVE = left of centre, POSITIVE = right. Fixed on purpose:
    // the plume must always rise from the SAME spot and never follow travel.
    chimneyX: -0.1633,
    topOffset: 8, // px down from the head's top edge where a puff starts
    lifeMinMs: 700,
    lifeMaxMs: 1100,
    riseMin: -130, // negative = drifts UP the screen
    riseMax: -70,
    driftX: 16,
    scaleMin: 0.2,
    scaleMax: 0.7,
    alphaStart: 0.7,
    tint: 0xdddddd,
    // Baked radial puff: source texture size (px) and its gradient stops.
    textureSize: 96,
    textureStops: [
      [0, 'rgba(255,255,255,0.9)'],
      [0.5, 'rgba(255,255,255,0.45)'],
      [1, 'rgba(255,255,255,0)'],
    ],
  },
};

// ---------------------------------------------------------------------------
// TRAIN SOUND — the looping "train running" bed, tied to the train's speed.
// ---------------------------------------------------------------------------
// The loop's RATE and VOLUME both follow |velocity| / speed:
//   • At TOP speed the rate is `restRate + rateRange` (= 1) and the volume is
//     `loudVolume`.
//   • At a standstill the rate is `restRate` (a slow chug) and the volume is
//     `quietVolume` — still audible, just quiet.
//   • In between, both scale linearly.
export const TRAIN_SOUND = {
  key: 'trainRunning', // must match the key in assets.js AUDIO
  loop: true,
  // Playback rate at rest (0..). 1 = the clip's own speed.
  restRate: 0.4,
  // Added to restRate at top speed — so restRate + rateRange = the top rate.
  rateRange: 0.6,
  // Volume at a standstill and at top speed. The resting level is deliberately
  // well above a whisper — a barely-there idle chug reads as "the sound broke".
  quietVolume: 0.24,
  loudVolume: 0.5,
  // How fast (per second) the rate/volume glide toward their targets, so
  // accelerating and stopping swell/settle smoothly rather than stepping.
  smoothRate: 3,
  smoothVolume: 3,
};

// ---------------------------------------------------------------------------
// TRACK CONFIG — the reference line. Purely visual; the train is not bound to
// it, it just reads as the rail the train runs along.
// ---------------------------------------------------------------------------
export const TRACK = {
  yFrac: 0.42,
  thickness: 8,
  color: 0x6b7280,
  lineAlpha: 0.75,
  // Length of each dash/segment of the line, and the blank run between dashes.
  dash: 46,
  gap: 26,
  // How finely the curve is sampled when stroking the dashes (smaller = smoother).
  drawStep: 6,
  // A subtle single ARCH in the line, so the train rides a real track rather
  // than a dead-flat rail. The line and every cart share these numbers, so each
  // cart sits exactly on the line wherever it bends.
  //   curveAmplitude — how far the line rises at its crown, in internal px.
  //   curveWaves     — 0.5 gives one gentle arch across the width.
  //   curvePhase     — shifts the wave left/right (radians).
  curveAmplitude: 18,
  curveWaves: 0.5,
  curvePhase: 0,
};

// ---------------------------------------------------------------------------
// CONTROLS — the two hold-to-drive buttons (top-left ◀, top-right ▶) and the
// shared mute button.
// ---------------------------------------------------------------------------
export const CONTROLS = {
  y: 150,
  // Distance of each drive button's centre from its screen edge.
  edgeInset: 110,
  fontSize: '52px',
  minWidth: 150,
  minHeight: 110,
  glyphLeft: '\u25C0',
  glyphRight: '\u25B6',
  // Shared mute button (top-left corner by default).
  muteX: 16,
  muteY: 16,
  muteDepth: 1000,
};

// CONFETTI — a short burst of coloured pieces when a round is confirmed
// (All aboard). Uses the shared confetti textures from @/phaser/common/sceneAssets.
export const CONFETTI = {
  count: 26,
  tints: [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6],
  depth: 90,
  minScale: 1.1,
  maxScale: 2.2,
  fallMinMs: 1500,
  fallMaxMs: 2600,
  startMinY: -180,
  startMaxY: -60,
  swayX: 80,
};

// A single aggregate, handy for a future live-tuning panel or for printing the
// whole config at once.
export const TUNING = {
  TRAIN,
  TRACK,
  CONTROLS,
  TRAIN_SOUND,
  CONFETTI,
  SKY_THEME,
  CLOUDS,
  BACKGROUND,
};
