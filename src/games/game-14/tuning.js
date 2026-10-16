// tuning.js
// Choo-Choo to the Zoo! — THE TUNING FILE. Every adjustable number lives here,
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

// Background depth — shared by every level's backdrop image.
export const BACKGROUND_DEPTH = -10; // behind the track (0) and every cart

// ---------------------------------------------------------------------------
// START SCREEN — the fullscreen title art shown before each run, with a Start
// button near the bottom. Tap Start to fade it away and roll the train in.
// ---------------------------------------------------------------------------
export const START_SCREEN = {
  key: 'startScreen', // must match the IMAGES key in assets.js
  depth: 200, // above the whole game
  // Start button.
  buttonY: 980, // button centre, in internal px (720x1080 canvas)
  buttonLabel: 'Start \u25B6',
  buttonFontSize: '36px',
  buttonPaddingX: 56,
  buttonPaddingY: 22,
  buttonDepth: 201,
  // Gentle attention pulse on the button.
  pulseScale: 1.06,
  pulseMs: 780,
  // Fade-out when Start is tapped, then the run begins.
  fadeMs: 420,
  // Welcome voice line, played over the title screen and CUT OFF the moment
  // Start is tapped (see GameScene.beginPlay).
  voiceKey: 'StartscreenVoice', // must match an assets.js AUDIO key
  voiceVolume: 0.9,
};

// ---------------------------------------------------------------------------
// VOICE + UI SOUND — the spoken ordinal ("first", "second", …) and the small
// button BESIDE the card that replays it on demand.
// ---------------------------------------------------------------------------
export const VOICE = {
  volume: 0.95,
  // The ordinal clips are keyed exactly like TASK.ordinals ('first'…'tenth'), so
  // the spoken word matches the card text automatically.
  // Sound button: an IMAGE (assets.js `soundButton`), semi-transparent, placed to
  // the RIGHT of the card so it does not clutter it.
  button: {
    key: 'soundButton', // must match the IMAGES key in assets.js
    dxFrac: 0.70, // x offset from the card centre, as a fraction of the card width
    dYFrac: -0.28, // y offset from the card centre, as a fraction of the card height
    scale: 0.5, // image scale
    alpha: 0.75, // semi-transparent
    alphaHover: 1, // fully opaque on hover
    depth: 30, // above the card (TASK.depth)
    // Forgiving tap area: pad on every side, as a fraction of the image's own
    // frame size, so the tap need not be accurate.
    hitPadFrac: 0.6,
    // Glow: an ADD-blend copy of the art, tinted and scaled up a little, that
    // pulses softly whenever the ordinal voice plays. Deliberately subtle.
    glowColor: 0xffe9a8,
    glowScale: 1.25,
    glowPeakAlpha: 0.4,
    glowRiseMs: 120,
    glowMs: 1600,
  },
  // Small pop when the button is tapped.
  tapScale: 0.88,
  tapMs: 90,
};

// ---------------------------------------------------------------------------
// LEVELS — the 3 levels. Each level swaps the backdrop, the cart colours and
// the number of numbered carts. Every key must match an IMAGES key in assets.js.
// ---------------------------------------------------------------------------
export const LEVELS = [
  {
    background: 'background1',
    cartLid: 'cartLidGreen',
    cartBody: 'cartBodyGreen',
    cartBodyEnd: 'cartBodyEndGreen',
    carts: 5, // numbered CARTS (the locomotive is extra)
    headTint: null, // no tint — a bright day scene
    riderTint: null,
  },
  {
    background: 'background2',
    cartLid: 'cartLidRed',
    cartBody: 'cartBodyRed',
    cartBodyEnd: 'cartBodyEndRed',
    carts: 7,
    headTint: null,
    riderTint: null,
  },
  {
    background: 'background3',
    cartLid: 'cartLidBlue',
    cartBody: 'cartBodyBlue',
    cartBodyEnd: 'cartBodyEndBlue',
    carts: 10,
    // Night scene: the locomotive and riders are darkened a LITTLE so they read
    // as outdoors after dark without going muddy. Multiply-tints, so keep them
    // light — the riders get the lighter of the two.
    headTint: null,
    riderTint: null,
  },
];

// ---------------------------------------------------------------------------
// TRAIN CONFIG
// ---------------------------------------------------------------------------
export const TRAIN = {
  // How many rounds EACH level runs before the train moves on. Every round
  // re-rolls the animal/position order on the same level's carts + backdrop.
  roundsPerLevel: 2,
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
    // Extra px past "fully off screen" the train starts (and ends the outro), so
    // no part of it peeks in on frame 1. Generous so a wide head art + its
    // offset cannot show at the edge.
    offscreenPad: 260,
  },
  // PAN LIMIT: the train may be driven off either edge only as far as being
  // fully off-screen; `overshootPad` allows a little extra past that (0 = stop
  // exactly when the last cart clears the edge) so it can never run away.
  pan: { overshootPad: 0 },
  // Which slot is the locomotive (the `trainHead` image). 0 = the first/leftmost
  // cart. The head art replaces the lid+body stack for that one slot.
  headIndex: 0,
  // The locomotive sits SLIGHTLY LARGER and SLIGHTLY HIGHER, and shifted a touch
  // LEFT so its nose does not overlap the cart behind it.
  //   headScaleFrac  — extra scale, relative to the carts (1 = same size).
  //   headYOffsetFrac — vertical nudge as a fraction of the cart height
  //                     (negative = up).
  //   headXOffsetFrac — horizontal nudge as a fraction of the cart width
  //                     (negative = left).
  headScaleFrac: 1.12,
  headYOffsetFrac: -0.12,
  headXOffsetFrac: -0.10,
  // How many carts should be visible across the screen at once. The cart scale
  // is derived from this so it stays correct at any resolution.
  visibleCarts: 3,
  // Where the train sits vertically, as a fraction of the canvas height. Matches
  // TRACK.yFrac so the carts rest on the line.
  yFrac: 0.5,
  // Fraction of the visible cart width the train covers per second at rest, and
  // the top speed in internal px/s while a control is held.
  speed: 610,
  // Easing rates (per second) for the velocity — this is what makes the train
  // roll away from a standstill and coast to a stop instead of snapping between
  // 0 and full speed. Higher = snappier, lower = more glide.
  accel: 1.8,
  brake: 3.5,
  // Speeds below this (px/s) settle to exactly 0, so a stopped train is still.
  settleSpeed: 10,
  // Largest simulation step (ms). A backgrounded tab hands a huge delta on
  // return; clamping keeps that from becoming one giant jump on the first frame.
  maxDeltaMs: 50,

  // Optional nudge (px) to close any transparent padding between the lid's
  // bottom edge and the body's top edge. 0 is a true butt joint.
  lidOverlap: 0,

  // Gap between adjacent carts, as a fraction of the cart width (0 = butted
  // together, 0.06 = a 6%-of-cart-width gap between each pair).
  cartGapFrac: -0.03,

  // The ENDING cart is always the LAST cart in the consist (index carts-1),
  // whatever the cart count or order. It uses the `cartBodyEnd` image for its
  // body, the same lid, and the same rider mechanism — nothing to tune here
  // except (optionally) which index is treated as "the end". -1 = the last.
  endCartIndex: -1,

  // CART NUMBERS: a big bold number centred on each cart body, counting the
  // body-bearing carts 1..N along the consist (the locomotive head is not
  // numbered). All sizes are fractions so they scale with the cart.
  number: {
    sizeFrac: 0.28, // font size as a fraction of the cart width
    strokeFrac: 0.028, // stroke thickness as a fraction of the cart width
    color: '#ffffff',
    stroke: '#1f2937',
    fontFamily: 'Fredoka, sans-serif',
    // Extra vertical nudge from the body's centre, as a fraction of the cart
    // height (negative = up). 0 = dead centre of the body.
    yOffsetFrac: -0.078,
    // Slightly see-through so the body art reads through the number.
    alpha: 0.8,
  },

  // RIDERS — animals dragged from the task card onto a cart. A rider is placed
  // behind the body and in front of the lid (see GameScene.buildTrain for the
  // draw order).
  rider: {
    // A landed rider is scaled to this fraction of a cart's width.
    scaleFrac: 0.8,
    // Sound played at the moment an animal is placed on a cart.
    popKey: 'pop1', // must match an assets.js AUDIO key
    popVolume: 0.7,
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
    // Position words, indexed by cart number - 1 (cart 1 = "first"). Spelled in
    // full, up to the largest level's cart count.
    ordinals: [
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'sixth',
      'seventh',
      'eighth',
      'ninth',
      'tenth',
    ],
    cardYFrac: 0.76, // card centre, as a fraction of the canvas height
    // The card is an IMAGE (key in assets.js). Adjust its size in one place here;
    // the label + animal are positioned on top of it.
    cardImage: 'cardFrame',
    cardScale: 0.64,
    depth: 15,
    // (Approximate) card size, for positioning the label/animal as fractions.
    cardW: 250,
    cardH: 250,

    // LABEL — the spelled position, drawn ON TOP of the card. yFrac is a fraction
    // of the card height from its centre (negative = up). Bold green outline.
    labelYFrac: -0.495,
    labelFontSize: 44,
    labelFontFamily: 'Fredoka, sans-serif',
    labelColor: '#ffffff',
    labelStroke: '#22c55e',
    labelStrokeWidth: 8,

    // The draggable animal, also on the card (below the label).
    animalYFrac: 0.18,
    animalSize: 200, // the card animal is scaled to fit this square

    // Grabbing the card animal grows it to its cart size in this long.
    grabGrowMs: 150,
    grabEase: 'Back.easeOut',
    // Returning a mis-dropped animal to the card.
    returnMs: 240,

    // POP-IN when a new task is dealt: the label drops in and the animal springs
    // up, so the card change reads as an arrival rather than a hard switch.
    dealAnim: {
      labelFromScale: 0.5,
      labelFromYFrac: -0.13, // extra fall, as a fraction of the card height
      labelDelayMs: 0,
      animalFromScale: 0.3,
      animalFromYFrac: 0.16, // extra rise, as a fraction of the card height
      animalDelayMs: 70,
      durationMs: 320,
      ease: 'Back.easeOut',
    },
  },

  // WRONG-ANSWER FEEDBACK — an animal dropped on the wrong cart registers a
  // wrong and the board flashes + shakes red.
  feedback: {
    flashDurationMs: 420,
    flashColor: 0xff6b6b,
    shakeAmplitude: 12,
    shakeDurationMs: 380,
    wrongKey: 'wrong', // must match an assets.js AUDIO key
    wrongVolume: 0.7,
  },

  // The correct placement: the N-th RIDER_KEY (in its shuffled deal order) rides
  // the cart whose NUMBER is that same Nth numbered cart. In other words the
  // first-dealt animal belongs on the first-dealt position, the second on the
  // second, and so on. No extra config — it derives from the shuffle.
  placement: {
    // Extra settle time after a correct check before the train rolls out.
    leaveDelayMs: 260,
    // The OUTRO (train leaving off the left) is deliberately slow and gentle so
    // the departure lingers rather than snapping away.
    leaveDurationMs: 2400,
    leaveEase: 'Sine.easeInOut',
    // Beat between rounds while the train is off screen (same level).
    betweenRoundsMs: 420,
  },

  // TRANSITION — how the backdrop swaps when a new level begins (in addition to
  // the train rolling out left / in from right, which is in `intro`/`placement`).
  transition: {
    // The old backdrop slides left to this many px off-screen (and the new one
    // enters from +this), so the two cross the canvas like passing scenery.
    slideX: 720,
    durationMs: 900,
    ease: 'Cubic.easeInOut',
  },

  // Idle bob: each cart rises/falls by `bobAmplitude` px on a `bobPeriodMs`
  // half-cycle, phase-shifted by `bobPhaseStep` per cart so the consist ripples
  // like a real train rather than moving as one rigid block.
  bobAmplitude: 2,
  bobPeriodMs: 140,
  bobPhaseStep: 0.6,
  // Below this change in rotation (radians), layoutCarts skips the rotation
  // write — an old phone repaints far less when the train is parked. Raise it to
  // trade a hair of tilt accuracy for fewer transform updates.
  rotEpsilon: 0.0015,

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
    chimneyX: -0.2500,
    topOffset: -9, // px down from the head's top edge where a puff starts
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

  // One-shot honk played as the train rolls into frame at the start of each
  // round (see GameScene.playIntroHonk). A short delay lets it land a beat after
  // the roll-in begins so it reads as the train announcing itself.
  honkKey: 'trainHonk', // must match the key in assets.js AUDIO
  honkVolume: 0.85,
  honkDelayMs: 150,
};

// ---------------------------------------------------------------------------
// TRACK CONFIG — the reference line. Purely visual; the train is not bound to
// it, it just reads as the rail the train runs along.
// ---------------------------------------------------------------------------
export const TRACK = {
  // The line is a REFERENCE for where the carts ride — hidden from players by
  // default. The carts still follow its curve/height either way.
  show: false,
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
// CONTROLS — the two hold-to-drive targets flank the task card at the BOTTOM.
// The whole area to the left / right of the card is tappable (a forgiving, no-
// accuracy-needed hit zone); a visible arrow button sits at each zone's centre.
// ---------------------------------------------------------------------------
export const CONTROLS = {
  // Each zone spans this fraction of the canvas WIDTH from its own edge. Keep
  // it clear of the card in the middle (0.30 leaves the centre ~40% for the card).
  sideFrac: 0.3,
  // Vertical centre of the zones — the task-card band.
  yFrac: 0.86,
  // Zone height as a fraction of the canvas height.
  zoneHeightFrac: 0.22,
  // Zones sit BELOW the card (depth 15) so the card + animal still receive their
  // own taps; the zones only catch taps in the open area beside the card.
  depth: 5,

  // The visible arrow buttons — a single image (see assets.js `arrowButton`),
  // flipped horizontally for the left one. Drawn by GameScene.makeDriveButton().
  buttonImage: 'arrowButton',
  buttonScale: 0.5, // scale of the arrow image
  pressScale: 0.9, // scale while held
  // Lightening: an ADD-blend copy of the art faded over it (a tint can only
  // darken, so brightening needs an additive layer). Higher = lighter.
  buttonLighten: 0.3, // at rest
  buttonLightenPressed: 0.6, // while held — even lighter
  lightenMs: 90, // fade time for the lighten change

  // Shared mute button (top-left corner by default).
  muteX: 16,
  muteY: 16,
  muteDepth: 1000,
};

// ---------------------------------------------------------------------------
// NUMBER SLIDER — an interactive strip of 1..N numbers across the TOP. A window
// of `visible` numbers shows at once; the middle one is HIGHLIGHTED and the
// spelled ordinal ("first", "second"…) is shown below it. Drag the strip (or tap
// a number) to slide to another; on release it snaps to the nearest number.
// ---------------------------------------------------------------------------
export const NUMBER_SLIDER = {
  count: 10,
  visible: 5, // how many numbers show at once
  yFrac: 0.11,
  // Horizontal shift of the whole slider, as a fraction of the canvas width.
  xFrac: 0,
  widthFrac: 0.9, // band width, as a fraction of the canvas width
  depth: 8,

  // The semi-transparent band behind the numbers.
  band: {
    color: 0xffffff,
    alpha: 0.3,
    radius: 26,
    heightMult: 1.8, // band height = number.fontSizePx * this
  },

  // The numbers.
  number: {
    fontSizePx: 58,
    fontFamily: 'Fredoka, sans-serif',
    color: '#ffffff',
    stroke: '#1f2937',
    strokeWidth: 6,
    sideAlpha: 0.4, // the non-selected numbers
    sideScale: 0.78,
  },

  // The highlight pill behind the centred number.
  highlight: {
    color: 0x6366f1,
    alpha: 0.9,
    radius: 42, // pill half-height
    insetX: 8, // px trimmed off each cell side so pills do not touch
  },

  // The spelled ordinal, below the highlighted number.
  label: {
    offsetY: 84, // px below the band centre
    fontSizePx: 40,
    fontFamily: 'Fredoka, sans-serif',
    color: '#ffffff',
    stroke: '#22c55e',
    strokeWidth: 8,
  },

  // Snapping when released.
  snapMs: 200,
  snapEase: 'Cubic.easeOut',
  tapThresholdPx: 12, // movement under this = a tap (select the tapped number)
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
  LEVELS,
  START_SCREEN,
  VOICE,
  TRAIN,
  TRACK,
  CONTROLS,
  NUMBER_SLIDER,
  TRAIN_SOUND,
  CONFETTI,
  SKY_THEME,
  CLOUDS,
};
