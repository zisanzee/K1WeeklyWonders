// tuning.js
// Game 16 — THE TUNING FILE, wired to the shared live-tuning kit.
//
// WHY THIS FILE IS SHAPED LIKE THIS
// ---------------------------------------------------------------------------
// Game 16 is FIVE mini-games in one run (see scenes.js), so five sets of numbers
// share one file. Each scene gets its own block or table, named after it, so a
// slider is never ambiguous:
//
//   ENGINE / HUD   whole-run numbers
//   SCENE1         the factory + conveyor (scene 1)
//   SCENE2         the mirror builder's shared numbers (scene 2)
//   MIRROR_ROUNDS  one row per round: the mirror axis + line look
//   MIRROR_PARTS   one row per portrait part (scene 2) — the table you live in
//   SCENES_TUNING  generic placeholder spacing for scenes without their own art
//
// THE COPY-PASTE READOUT IS THE WHOLE FILE
// ---------------------------------------------------------------------------
// The dev panel's "Copy tuning code" button prints THIS FILE, complete, with the
// tuned values baked in. Paste it over tuning.js and nothing else needs
// touching — imports, comments, schema, formatter and all.
//
// HOW THAT IS DONE WITHOUT THE COPY GOING STALE: the formatter reads this
// module's OWN SOURCE (the `?raw` import below) and replaces just the six
// value-bearing blocks with freshly rendered ones. Everything else — every
// comment, the accessors, the schema, the formatter itself — is the real file,
// byte for byte. There is no second copy of the file to keep in step, which is
// what makes "paste it back and nothing breaks" true rather than aspirational.
//
// Keep it that way: if you add a tunable, add it here AND to the matching
// render* function, or the pasted copy will lose it.
//
// Coordinates are INTERNAL pixels on the 720x1080 canvas (DEFAULT_BASE_RESOLUTION
// in @/phaser/config). Anything named `...Frac` is 0..1 of the canvas.
//
// Nothing here is stateful. Edit a number and save: Vite hot-reloads this module,
// the kit re-publishes the tables, and the running scene picks them up.

import { createTuning } from '@/devTuning/core';
import { SCENES } from '@/games/game-16/scenes';
import { CANVAS, partTransformFallback } from '@/games/game-16/mirrorRounds';
// This module's own text, so the copy-paste readout can hand back the real file
// with only the values swapped. Vite inlines it at build time.
import ownSource from '@/games/game-16/tuning.js?raw';

// ---------------------------------------------------------------------------
// MASTER SWITCHES
// ---------------------------------------------------------------------------

// Phaser canvas clear colour (see Game.jsx). Also the backdrop fallback.
export const BACKGROUND_COLOR = '#0b1220';

// The 3-stop sky the loading scene hands off from, so there is no seam.
export const SKY_THEME = {
  bgColors: ['#3fb6ea', '#8fe0fa', '#ffe9a8'],
  groundColor: '#8ee06a',
};

// Drifting clouds from BaseScene.addDriftingClouds().
export const CLOUDS = [
  { xr: 0.18, yr: 0.16, scale: 1, alpha: 0.85 },
  { xr: 0.78, yr: 0.1, scale: 0.8, alpha: 0.7 },
];

// Per-game local-dev switch for the tuning editor. Production folds it away
// regardless, via import.meta.env.DEV in @/devTuning/panel.js.
export const DEV_TUNING_ENABLED = true;

// ---------------------------------------------------------------------------
// ENGINE — run-wide numbers
// ---------------------------------------------------------------------------
export const ENGINE = {
  // How long the scene-to-scene handover takes. A short dip keeps the run
  // feeling continuous; 0 makes it a hard cut.
  transitionMs: 320,
  // Fade the incoming scene in over this fraction of transitionMs.
  crossfade: 0.5,
  // Dev-only: draw the placeholder frame, ids and per-scene accent.
  devChrome: true,
};

// ---------------------------------------------------------------------------
// HUD — the chrome the hub draws around every scene
// ---------------------------------------------------------------------------
// Fractions of the canvas, because the hub is the one part that must not move
// when a scene changes: a prompt that shifts between mini-games reads as a bug.
export const HUD = {
  // WHITE WITH A THIN DARK OUTLINE: the prompt sits over each scene's own art,
  // so a flat fill is invisible on some of the five and fine on others.
  promptYFrac: 0.16,
  promptFontSize: 34,
  promptColor: '#ffffff',
  promptStrokeColor: '#000000',
  promptStrokeThickness: 3,
  promptWrapFrac: 0.86,
  // Scene title chip, top-left.
  titleX: 24,
  titleY: 24,
  titleFontSize: 18,
  titleColor: '#0f172a',
};

// ---------------------------------------------------------------------------
// SCENE 1 — SHAPES (the factory)
// ---------------------------------------------------------------------------
// The conveyor is the part that must be tuned by eye: where the belt sits on the
// painted factory and how fast it moves are both art decisions.
export const SCENE1 = {
  bgAlpha: 1,
  bgOffsetXFrac: 0,
  bgOffsetYFrac: 0,
  beltYFrac: 0.65,
  beltHeightFrac: 0.16,
  beltAlpha: 1,
  beltOverlap: 0.012,
  charHeightFrac: 0.555,
  charXFrac: 0.59,
  charBeltGapFrac: -0.048,
  charAlpha: 1,
  charDepth: 2,
  rollAnimKey: 'characterRoll',
  rollFps: 30,
  rollHoldMs: 220,
  shapesFadeInMs: 280,
  slotFollowRobot: true,
  slotOffsetXFrac: -0.105,
  slotOffsetYFrac: 0.09,
  slotXFrac: 0.59,
  slotYFrac: 0.46,
  slotWidthFrac: 0.34,
  slotAspect: 0.7,
  slotBoxFillColor: 0xffffff,
  slotBoxFillAlpha: 1,
  slotBoxBorderColor: 0x1e293b,
  slotBoxBorderWidth: 4,
  slotBoxRadius: 12,
  slotCardSizeOfWindow: 0.8,
  slotCardGapFrac: 0.32,
  // One colour for every clue: the clue TEXT is the content, so varying its
  // colour made the colours look meaningful when only the words are.
  slotWordColor: 0xffffff,
  slotWordSizeOfCard: 0.42,
  slotWordFitOfWindow: 0.9,
  slotWordStroke: 6,
  slotCycles: 3,
  slotSpinMs: 2600,
  // The whirr plays at a rate solved from the clip's OWN length, so it ends
  // exactly when the slot sequence does. These three are the only knobs.
  slotSpinVolume: 0.5,
  slotSpinRateMin: 0.6,
  slotSpinRateMax: 3.5,
  slotSettleMs: 260,
  slotEase: 'Cubic.easeOut',
  slotLandPulseScale: 1.14,
  slotLandPulseMs: 200,
  slotHighlightColor: 0xfacc15,
  slotHighlightAlpha: 0.55,
  slotHighlightSizeOfBox: 0.34,
  slotHighlightGrow: 1.75,
  slotHighlightMs: 520,
  slotDepth: 6,
  optionRowXFrac: 0.5,
  optionRowYFrac: 0.855,
  optionSizeFrac: 0.17,
  optionGapPx: 40,
  shapeStrokeWidth: 6,
  shapeStrokeColor: 0x1e293b,
  shapeIdleAlpha: 1,
  shapeDragScale: 1.14,
  rectangleAspect: 0.62,
  dropYOffsetFrac: -0.054,
  dropSnapMs: 250,
  // A drop within this fraction of the belt's height above/below the belt still
  // counts: a forgiving band, not a precision test.
  dropToleranceFrac: 0.18,
  dropXFrac: 0.5,
  parkSpreadFrac: 0.42,
  dropZoneColor: 0xffffff,
  dropZoneAlpha: 0.18,
  dropZoneRadiusFrac: 0.1,
  dropZonePulseAlpha: 0.25,
  dropZonePulseMs: 900,
  // Green = won, red = try again, through one helper so they read as the same
  // piece of feedback with opposite meanings.
  correctFlashColor: 0x22c55e,
  correctFlashAlpha: 0.4,
  correctFlashMs: 130,
  correctFlashHoldMs: 240,
  // The effective hold is the LARGER of this and the flash's own length, so
  // retuning the flash can never outrun the hold and cut itself off.
  winHoldMs: 900,
  winHoldPadMs: 250,
  wrongFlashColor: 0xef4444,
  wrongFlashAlpha: 0.4,
  wrongFlashMs: 130,
  wrongFlashHoldMs: 240,
  wrongRestartMs: 520,
  sendOffSpeed: 420,
};

// ---------------------------------------------------------------------------
// SCENE 2 — MIRROR (shared)
// ---------------------------------------------------------------------------
// PORTRAIT-BUILDING STAGE: there is no drag-and-drop task and no right or wrong
// answer yet. The scene draws three portraits either side of a mirror line so
// they can be composed and tuned. The parts and the axis angles are the tables
// below.
export const SCENE2 = {
  // THE TWO HALVES ARE THE DIVIDER — no line is drawn; the colour change is
  // the axis. `source` is the half the portrait is built on.
  sourceFillColor: 0xfecdd3,
  sourceFillAlpha: 1,
  mirrorFillColor: 0xbfdbfe,
  mirrorFillAlpha: 1,
  fillBehindPortrait: true,
  // The optional divider. 0 width leaves it invisible.
  lineWidth: 0,
  lineColor: 0xffffff,
  lineAlpha: 0,
  // Optional full-bleed backdrop drawn ABOVE the washes. 0 alpha means "none".
  bgAlpha: 0,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgZoom: 1,
  // One slider to dim the whole portrait while judging it.
  portraitAlpha: 1,
  // The tray: parts start here at PREVIEW size, dragged out at TRUE size.
  trayY: 986,
  trayGapX: 132,
  trayBoxPx: 112,
  trayBoxInset: 10,
  trayBobPx: 7,
  trayBobMs: 1100,
  trayDiscAlpha: 0.22,
  trayDiscStrokeAlpha: 0.6,
  trayDiscStrokeWidth: 4,
  trayShadowAlpha: 0.12,
  trayShadowDy: 6,
  // The drop boxes: a piece belongs on the socket for its OWN id.
  dropPad: 22,
  boxMinPx: 40,
  boxPadding: 16,
  // Derived box size (a square of the longest side × this, floored at boxMinPx).
  boxSizeFrac: 0.85,
  // Dev: outline every drop box so it can be judged against the art.
  showBoxes: false,
  // Faint sockets on the mirrored side, sized from the piece.
  socketSizeMul: 1.25,
  socketAlpha: 0.16,
  // A correct drop snaps, reveals the reflection, and pulses.
  snapMs: 140,
  landPulseScale: 1.12,
  landPulseMs: 180,
  correctFlashColor: 0x22c55e,
  correctFlashAlpha: 0.22,
  correctFlashMs: 120,
  correctFlashHoldMs: 160,
  wrongFlashColor: 0xef4444,
  wrongFlashAlpha: 0.3,
  wrongFlashMs: 120,
  wrongFlashHoldMs: 160,
  wrongShakeDeg: 7,
  winHoldMs: 900,
  // Dev: allow re-grabbing a placed part on the canvas.
  allowReplacingPlaced: false,
  // Dev aid: a ring at each computed duplicate position.
  showMirrorHints: false,
};

// ---------------------------------------------------------------------------
// MIRROR_ROUNDS — one row per round: the axis and the line
// ---------------------------------------------------------------------------
// `axisDeg` is the DIRECTION of the mirror LINE, in degrees (0 points right,
// positive turns clockwise because screen y points down). It describes the line,
// not the normal, so the three rounds read as 90 / 0 / -45.
//
// `axisX`/`axisY` are a point the line passes through, in pixels. The line is
// infinite; the point only anchors the reflection.
export const MIRROR_ROUNDS = [
  {
    id: 'mr1',
    round: 1,
    axisDeg: 90,
    axisX: 360,
    axisY: 540,
    lineWidth: 6,
    lineColor: 0xffffff,
    lineAlpha: 0.85,
    glowAlpha: 0.22,
    glowWidthMul: 3.2,
  },
  {
    id: 'mr2',
    round: 2,
    axisDeg: 0,
    axisX: 360,
    axisY: 540,
    lineWidth: 6,
    lineColor: 0xffffff,
    lineAlpha: 0.85,
    glowAlpha: 0.22,
    glowWidthMul: 3.2,
  },
  {
    id: 'mr3',
    round: 3,
    axisDeg: -45,
    axisX: 360,
    axisY: 540,
    lineWidth: 6,
    lineColor: 0xffffff,
    lineAlpha: 0.85,
    glowAlpha: 0.22,
    glowWidthMul: 3.2,
  },
];

// ---------------------------------------------------------------------------
// MIRROR_PARTS — one row per portrait part, in absolute pixels
// ---------------------------------------------------------------------------
// Same shape as game 12's CHARACTERS table:
//
//   id         IDENTITY — keys the per-part overrides and the canvas drag, so
//              never change it once a round has been tuned
//   round      which round this part belongs to (1-based)
//   textureKey the flat key from assets.js (`s2Crab1`, …)
//   x, y       CENTRE on the canvas, pixels
//   scale      multiplier on the source PNG (1 = native size)
//   rotation   degrees, clockwise
//   flipX      flips the SOURCE art left-to-right (art facing the wrong way).
//              NOT the mirroring — the reflection is geometric and automatic.
//   z          draw order within the portrait (higher draws on top)
//   alpha      opacity (multiplied by SCENE2.portraitAlpha)
//   mirror     whether this part gets a reflected duplicate at all
//
// The `dup*` fields are corrections on the duplicate ONLY, and every default is
// neutral so an untouched table is an EXACT reflection:
//
//   dupScaleMul  extra scale on the duplicate
//   dupRotation  extra rotation, degrees
//   dupDX/DY     nudge in pixels, applied in the source-side frame so a shift
//                moves the duplicate symmetrically about the line
//   dupAlpha     duplicate opacity
//
// THE DROP BOX: `boxW` / `boxH` override the derived box, in canvas px, centred
// on the part's mirrored position. Leave both 0 to derive one (a square of
// `SCENE2.boxSizeFrac` × the piece's longest side).
//
// The override exists because a PNG's bounds include TRANSPARENT PADDING: a
// cut-out with a lot of empty space around it produces a box far larger than the
// piece looks, neighbouring boxes overlap, and a piece dropped dead-on its own
// spot is judged to be in a neighbour's box — the round reports "wrong" for a
// correct placement. Game 12 hits exactly this and answers it with an explicit
// BOXES table; these two fields are that table, folded into the row so there is
// only one table to tune.
//
// These are STARTING points, not finished portraits: drag a part on the canvas
// in dev and the new x/y is written back here. `showBoxes` outlines every box so
// the overrides can be judged against the art.
export const MIRROR_PARTS = [
  {
    id: 'crab1',
    round: 1,
    textureKey: 's2Crab1',
    x: 314,
    y: 517,
    scale: 0.42,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'crab2',
    round: 1,
    textureKey: 's2Crab2',
    x: 302,
    y: 605,
    scale: 0.56,
    rotation: 0,
    flipX: 0,
    z: 2,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'crab3',
    round: 1,
    textureKey: 's2Crab3',
    x: 245,
    y: 601,
    scale: 0.56,
    rotation: 0,
    flipX: 0,
    z: 3,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'guitar1',
    round: 2,
    textureKey: 's2Guitar1',
    x: 127,
    y: 464,
    scale: 0.38,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'guitar2',
    round: 2,
    textureKey: 's2Guitar2',
    x: 283,
    y: 480,
    scale: 0.38,
    rotation: 0,
    flipX: 0,
    z: 2,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'guitar3',
    round: 2,
    textureKey: 's2Guitar3',
    x: 517,
    y: 503,
    scale: 0.57,
    rotation: 0,
    flipX: 0,
    z: 3,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'bird1',
    round: 3,
    textureKey: 's2Bird1',
    x: 276,
    y: 384,
    scale: 0.62,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'bird2',
    round: 3,
    textureKey: 's2Bird2',
    x: 320,
    y: 494,
    scale: 1.02,
    rotation: 0,
    flipX: 0,
    z: 2,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'bird3',
    round: 3,
    textureKey: 's2Bird3',
    x: 184,
    y: 675,
    scale: 0.25,
    rotation: 0,
    flipX: 0,
    z: 3,
    alpha: 1,
    mirror: 1,
    dupScaleMul: 1,
    dupRotation: 0,
    dupDX: 0,
    dupDY: 0,
    dupAlpha: 1,
    boxW: 0,
    boxH: 0,
  },
];

// ---------------------------------------------------------------------------
// SCENE 3 — POSITIONS (four portraits, eight prompts)
// ---------------------------------------------------------------------------
// THE MECHANIC (built on scene 2's tray, which is already game 12's disc):
// a prompt names a RELATIVE POSITION — "Put the cat on top of the wall" — and the
// child drags the object from its option disc to the spot that answers it.
//
// THE PORTRAIT IS AUTHORED, NOT COMPUTED. Each portrait has a background and two
// placements (`POSITION_ROUNDS`), and each placement carries:
//
//   x, y     where the object lands (absolute px)
//   scale    multiplier on the PNG (1 = native), like every other part row
//   boxW/H   the accept zone, in px, centred on x/y. 0 = derive from the piece.
//
// A placement does NOT store the object's texture: the object is chosen per
// PROMPT (`POSITION_PARTS`), because both prompts of a portrait place the SAME
// object in two places (top then bottom, inside then outside). Keeping the
// object on the prompt and the position on the placement is what lets one
// portrait answer two opposite relations without duplicating the art.
//
// Positions are starting points — tune them by dragging in dev and reading the
// values back with "Copy tuning code".
export const POSITIONS = {
  bgFit: 'cover',
  bgZoom: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  objectAlpha: 1,
  showTargets: false,
  targetRadius: 52,
  targetColor: 0xfacc15,
  targetAlpha: 0.22,
  snapMs: 160,
  landPulseScale: 1.1,
  landPulseMs: 170,
  correctFlashColor: 0x22c55e,
  correctFlashAlpha: 0.2,
  correctFlashMs: 110,
  correctFlashHoldMs: 150,
  wrongFlashColor: 0xef4444,
  wrongFlashAlpha: 0.28,
  wrongFlashMs: 110,
  wrongFlashHoldMs: 150,
  winHoldMs: 850,
  optionXFrac: 0.2,
  optionY: 940,
  optionRadius: 88,
  optionDiscAlpha: 0.24,
  optionDiscStrokeAlpha: 0.7,
  optionDiscStrokeWidth: 4,
  optionShadowAlpha: 0.14,
  optionShadowDy: 6,
  optionBoxInset: 12,
  optionBobPx: 6,
  optionBobMs: 1200,
  areaSizePx: 230,
  dropPad: 20,
  mistakeShakeDeg: 7,
  mistakeReturnMs: 260,
  wrongAreaPulseAlpha: 0.45,
  wrongAreaPulseMs: 220,
  successPopVolume: 0.8,
  successPopRate: 1,
  nextPromptMs: 420,

  // ---- THE EMPHASISED WORD IN THE PROMPT ---------------------------------
  // Each prompt marks ONE word as the relationship it asks about — "top",
  // "behind", "inside". That word is drawn BIGGER and in its own colour, because
  // it is the part of the sentence the child has to act on.
  //
  // Phaser Text has no inline styling, so the prompt is laid out as individual
  // word objects (see `renderPrompt` in PositionsScene). These four knobs style
  // the emphasised one.
  emphasisSizeMul: 1.45,
  // Warm amber: reads as "this is the important bit" against white body text, and
  // stays legible over every portrait's artwork thanks to its own outline.
  emphasisColor: '#fbbf24',
  emphasisStrokeColor: '#000000',
  emphasisStrokeThickness: 4,
};

// ONE ROW PER PORTRAIT (and therefore per ROUND of scene 3).
//
//   id       'p1'..'p4' — IDENTITY, keys the tuning rows and the dev scope
//   round    1-based round number of scene 3
//   bgKey    the flat texture key from assets.js
export const POSITION_ROUNDS = [
  {
    id: 'p1',
    round: 1,
    bgKey: 's3r1Bg',
    bgScale: 1,
    bgX: 360,
    bgY: 540,
    slotAX: 395,
    slotAY: 253,
    slotAScale: 0.5,
    slotABoxW: 0,
    slotABoxH: 0,
    slotBX: 368,
    slotBY: 754,
    slotBScale: 0.5,
    slotBBoxW: 0,
    slotBBoxH: 0,
  },
  {
    id: 'p2',
    round: 2,
    bgKey: 's3r2Bg',
    bgScale: 1,
    bgX: 360,
    bgY: 540,
    slotAX: 360,
    slotAY: 141,
    slotAScale: 0.5,
    slotABoxW: 0,
    slotABoxH: 0,
    slotBX: 363,
    slotBY: 676,
    slotBScale: 0.5,
    slotBBoxW: 0,
    slotBBoxH: 0,
  },
  {
    id: 'p3',
    round: 3,
    bgKey: 's3r3Bg',
    bgScale: 1,
    bgX: 360,
    bgY: 540,
    slotAX: 360,
    slotAY: 285,
    slotAScale: 0.4,
    slotABoxW: 0,
    slotABoxH: 0,
    slotBX: 373,
    slotBY: 632,
    slotBScale: 0.4,
    slotBBoxW: 0,
    slotBBoxH: 0,
  },
  {
    id: 'p4',
    round: 4,
    bgKey: 's3r4Bg',
    bgScale: 1,
    bgX: 360,
    bgY: 540,
    slotAX: 67,
    slotAY: 477,
    slotAScale: 0.45,
    slotABoxW: 0,
    slotABoxH: 0,
    slotBX: 657,
    slotBY: 466,
    slotBScale: 0.45,
    slotBBoxW: 0,
    slotBBoxH: 0,
  },
];

// ONE ROW PER PROMPT — the object that gets placed, and the words that ask for
// it. `slot` says which placement on the portrait this prompt answers.
//
//   id        IDENTITY, keys the per-part overrides and the drag
//   round     1-based round (portrait) of scene 3
//   slot      'A' or 'B' — which placement in POSITION_ROUNDS
//   textureKey the flat key from assets.js
//   prompt    the sentence shown and spoken
//   scale     multiplier applied on top of the slot's scale
export const POSITION_PARTS = [
  {
    id: 'p1cat',
    round: 1,
    slot: 'A',
    textureKey: 's3r1Cat',
    prompt: 'Put the cat on top of the wall',
    emphasis: 'top',
    x: 395,
    y: 253,
    scale: 1,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p1flower',
    round: 1,
    slot: 'B',
    textureKey: 's3r1Flower',
    prompt: 'Put the flower at the bottom of the wall',
    emphasis: 'bottom',
    x: 368,
    y: 754,
    scale: 1,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p2bike',
    round: 2,
    slot: 'A',
    textureKey: 's3r2Bike',
    prompt: 'Put the bike in front of the car',
    emphasis: 'front',
    x: 360,
    y: 141,
    scale: 1.51,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p2truck',
    round: 2,
    slot: 'B',
    textureKey: 's3r2Truck',
    prompt: 'Put the truck behind the car',
    emphasis: 'behind',
    x: 363,
    y: 676,
    scale: 1.47,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p3car',
    round: 3,
    slot: 'A',
    textureKey: 's3r3ToyCar',
    prompt: 'Put the toy car inside the box',
    emphasis: 'inside',
    x: 360,
    y: 285,
    scale: 1.42,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p3teddy',
    round: 3,
    slot: 'B',
    textureKey: 's3r3Teddy',
    prompt: 'Put the teddy bear outside the box',
    emphasis: 'outside',
    x: 373,
    y: 632,
    scale: 1.4,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p4fork',
    round: 4,
    slot: 'A',
    textureKey: 's3r4Fork',
    prompt: 'Put the fork to the left of the plate',
    emphasis: 'left',
    x: 67,
    y: 477,
    scale: 1.21,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
  {
    id: 'p4plate',
    round: 4,
    slot: 'B',
    textureKey: 's3r4Plate',
    prompt: 'Put the knife to the right of the plate',
    emphasis: 'right',
    x: 657,
    y: 466,
    scale: 1.21,
    rotation: 0,
    flipX: 0,
    z: 1,
    alpha: 1,
    boxW: 0,
    boxH: 0,
  },
];

// ---------------------------------------------------------------------------
// SCENE 4 — THE BUILDING (ten rooms, tiled wall, scrollable)
// ---------------------------------------------------------------------------
// A wall built from three pieces: a TOP cap, a repeating MIDDLE, a BOTTOM cap.
// Ten room images are stacked up the middle, and the whole thing scrolls
// vertically so the child can reach every floor.
//
// WHY THE WALL IS TILED AND NOT ONE IMAGE: ten rooms need roughly four screens of
// height. A single stretched wall would smear its brickwork, and a single tall
// texture is a large, slow download on a school tablet. Tiling a small middle
// segment costs three images of normal size and scales to any height.
export const BUILDING = {
  // The wall spans the FULL canvas width.
  //
  // It used to be 575px pinned to the right edge, with the rooms centred inside
  // it. Now the wall is the whole screen and the rooms KEEP THEIR POSITION — so
  // `roomCentreXFrac` is what places them, not the wall's midpoint. Widening the
  // wall must not drag the rooms sideways with it.
  wallWidth: 720,
  wallRightInset: 0,

  // Where each room's centre sits, as a fraction of the canvas width. An ABSOLUTE
  // position, deliberately independent of the wall's width.
  //
  // The rooms are anchored from the RIGHT edge, because that is the design intent:
  // `roomRightInsetFrac` of clear wall on the right, then the rooms.
  //
  //   right edge = 720 - 16 = 704; centre = 704 - 500/2 = 454; 454 / 720 = 0.6306
  //
  // A 500px room whose right edge sits exactly 16px from the screen edge.
  roomCentreXFrac: 0.6306,
  // Clear wall between the rooms' right edge and the canvas edge.
  roomRightInsetFrac: 16 / 720,

  // Each room is this wide, with `roomGap` between rooms.
  roomWidth: 500,
  // GAP BETWEEN ROOMS, in px. This is the "gaps beautifully done" number: too
  // small and the floors merge, too large and the building stops reading as one
  // structure.
  roomGap: 10,

  // THE STACK IS ANCHORED AT THE BOTTOM, not the top.
  //
  // `groundRoomBottomGapPx` is the ground floor's distance above the bottom of the
  // wall — a real design number, and the one that should be honoured. Where the
  // TENTH floor lands is then a consequence of the room heights and gaps, not
  // something to author.
  //
  // 80px "from the bottom of the wall". This single number IS the wall below the
  // ground floor — there is no separate bottom pad, because two numbers for one
  // measurement can contradict each other (a pad of 200 alongside a gap of 80 once
  // pushed the wall's base below the canvas).
  groundRoomBottomGapPx: 80,

  // WHERE THE BUILDING OPENS, as an offset from the TOP of the scroll range
  // (`bounds.min`). 0 = the top floor (floor 10) is on screen and the ground floor
  // is far below, which is how a building is normally read.
  //
  // The stack is anchored at the BOTTOM, so the ground floor is what sits at a
  // sensible place at scroll 0 — the offset needed to open there is the whole range,
  // which is not a number worth writing down. Leave this at 0 and swipe down.
  startScrollPx: 0,

  // The area the building occupies vertically, so the tiled wall knows how tall to
  // be and the rooms know where to stop.
  //
  // ONLY THE TOP CAP IS A SEPARATE NUMBER. The wall BELOW the ground floor is
  // `groundRoomBottomGapPx` — the same measurement, so it must not have a second
  // tunable that can contradict it. (It used to: `wallBottomPadPx: 200` alongside a
  // gap of 80 put the wall's base 120px below the canvas, so it could never sit
  // flush with the screen.)
  wallTopPadPx: 120,

  // ---- SCROLLING ----------------------------------------------------------
  // `swipe` = drag anywhere to scroll (a kind on a tablet). The wheel is enabled
  // too, so it works while tuning with a mouse.
  scrollSwipe: true,
  scrollWheel: true,
  // Moves are divided by this, so a swipe scrolls a comfortable distance rather
  // than 1:1 with the finger.
  scrollSensitivity: 1,
  // Momentum: a released swipe keeps travelling, decaying by `friction` per
  // second. 0 disables it.
  momentum: 0.92,
  momentumMinPx: 12,
  // The wall must not scroll past its ends; a hard stop reads better than a
  // bounce for a child working out which floor they are on.
  clampScroll: true,

  // HOW MUCH SPACE THE SCROLL KEEPS CLEAR AT EACH END, as canvas fractions.
  //
  // The BOTTOM inset is 0 ON PURPOSE: scrolled all the way down, the wall's bottom
  // cap must sit FLUSH against the bottom of the screen. Any inset there leaves a
  // strip of backdrop under the building, which reads as the wall having come
  // loose — and it is the thing "stuck to the end" means.
  //
  // The TOP inset keeps the wall clear of the HUD title chip and prompt band, so
  // the top cap is not tucked under them when scrolled fully up.
  scrollTopInsetFrac: 0.1,
  scrollBottomInsetFrac: 0,

  // ---- LOOK ---------------------------------------------------------------
  wallAlpha: 1,
  roomAlpha: 1,
  // A soft shadow behind the whole building, so it lifts off the backdrop.
  buildingShadowAlpha: 0.22,
  buildingShadowOffsetPx: 10,
  // Faint floor separators between the rooms, so counting floors is easy.
  showFloorLines: false,
  floorLineColor: 0xffffff,
  floorLineAlpha: 0.25,
  floorLineWidth: 3,

  // ---- THE GAP BETWEEN FLOORS ---------------------------------------------
  // The `roomGap` between rooms is FILLED with a brown band rather than left empty,
  // so the floors read as separated by a floor SLAB instead of floating apart with
  // the wall showing through.
  //
  // `gapFillWidthFrac` is the band's width as a fraction of the ROOM width: 1 makes
  // it line up with the rooms' edges exactly. `gapFillPadPx` grows it slightly
  // vertically so it tucks UNDER the room art and no hairline of wall shows at the
  // seam.
  gapFill: true,
  gapFillColor: 0x6b4423,
  gapFillAlpha: 1,
  gapFillWidthFrac: 1,
  gapFillPadPx: 2,
  // A darker edge, so the band reads as a slab with thickness rather than as a flat
  // stripe. 0 turns the edge off.
  gapFillEdgeColor: 0x4a2f18,
  gapFillEdgeWidth: 2,

  // ---- FLOOR NUMBERS ------------------------------------------------------
  // One number per floor, in the strip of wall LEFT of the rooms — horizontally
  // centred between the screen edge and the room's left edge, and vertically
  // centred on the room. Numbers count 1 at the BOTTOM up to 10 at the top, which
  // is how a child reads a building.
  showFloorNumbers: true,
  floorNumberFontSize: 76,
  floorNumberColor: '#fde68a',
  floorNumberStrokeColor: '#7c2d12',
  floorNumberStrokeThickness: 8,
  // The numbers live INSIDE the scroll container, so they travel with their floor
  // — a number that stayed put while the rooms moved would point at nothing.
  floorNumberAlpha: 1,

  // WHICH ROOM IS ON WHICH FLOOR IS RANDOMISED each run, so the building cannot be
  // memorised ("the frog is always on 3"). Off by default in the sense that the
  // order stays as authored while the picture is being tuned — flip it on to check
  // a shuffle.
  shuffleRooms: false,

  // THE NUMBER'S BOX. A filled plate behind each digit, so it reads as a floor
  // badge rather than as loose text on brickwork — easier to read, and more like a
  // real building's floor plate.
  //
  // Sized from the TEXT (`boxPadPx` grows it) rather than from a fixed number, so
  // changing `floorNumberFontSize` keeps the plate hugging the number.
  floorNumberBox: true,
  // WHITE, so the plate reads as a painted floor number on the wall rather than as a
  // brown tag. The digit keeps its amber fill and dark outline, which is what makes it
  // legible ON white — dark-on-light is the opposite of the old dark box.
  floorNumberBoxColor: 0xffffff,
  floorNumberBoxAlpha: 0.92,
  floorNumberBoxPadPx: 14,
  floorNumberBoxRadius: 14,
  floorNumberBoxBorderColor: 0x8b5e34,
  floorNumberBoxBorderWidth: 3,
  // EVERY PLATE THE SAME WIDTH, so the column reads as a stack of identical badges.
  // 0 = size each plate to its own digits (which makes "10" visibly wider than "1").
  floorNumberBoxWidthPx: 0,

  // ---- THE QUESTION -------------------------------------------------------
  // FIVE rounds, each naming one floor. The floors are DISTINCT per run (see
  // buildingRounds.js), so no animal is asked about twice and the previous answer
  // is never still on screen when the next question appears.
  //
  // The ordinal is SPELLED ("third", not "3") because reading the word is the
  // point of the exercise at this age; the numeral is already on the wall beside
  // every room, so the child matches a word to a digit.
  roundsPerRun: 5,
  // How many animal options stand in the row. One right answer plus two
  // distractors — the smallest set that is still a real choice.
  optionCount: 3,

  // ---- THE OPTION ROW ------------------------------------------------------
  // Three discs across the bottom of the screen, BELOW the building so they never
  // cover a room the child is trying to read, and clear of the prompt band at the
  // top. `optionYFrac` is the row's centre.
  optionYFrac: 0.885,
  // Laid out symmetrically about the canvas midline: the three centres are
  // `0.5 ± step`. At 0.285 they sit at 0.215 / 0.50 / 0.785 — 205px apart on a
  // 720 canvas, which is 33px of clear space between two 86px-radius discs.
  //
  // The spacing has to EXCEED the diameter or the discs touch: 0.24 gave exactly
  // 172.8px for a 172px diameter, so the row read as one merged blob.
  optionStepFrac: 0.285,
  optionRadius: 86,
  // THE DISC, styled like scene 3's option circle but OPAQUE ENOUGH TO READ.
  //
  // A translucent fill alone over brickwork, rooms and floor numbers at once was
  // too weak: the animals competed with whatever happened to be behind them.
  // 0.72 gives the row its own surface without turning the discs into flat white
  // cut-outs — you can still tell there is a building behind them.
  optionDiscColor: 0xffffff,
  optionDiscAlpha: 0.72,
  // A VISIBLE RIM. With a strong fill the edge needs definition, or the discs look
  // like blurry white blobs rather than circles. Warm amber picks up the floor
  // numbers and the band's edge, so the row reads as part of the same design.
  optionDiscStrokeWidth: 6,
  optionDiscStrokeColor: 0xfbbf24,
  optionDiscStrokeAlpha: 1,
  // The animal inside the disc, as a fraction of the disc's DIAMETER. Sized from
  // the art's longer side, so a tall animal and a wide one both sit comfortably
  // inside the circle instead of one of them spilling out.
  optionSpriteFrac: 0.78,
  // A soft shadow under each disc, so the row reads as lifted off the art. Light,
  // like scene 3's — the discs are translucent, and a heavy shadow under a
  // see-through circle looks like a mistake.
  optionShadowDy: 6,
  optionShadowAlpha: 0.14,
  // The disc grows slightly on press and returns on release — the "I have it"
  // acknowledgement that makes a tap feel registered.
  optionPressScale: 1.08,
  optionPressMs: 90,
  // A slow bob, so the row reads as tappable rather than as part of the picture.
  // 0 turns it off.
  optionBobPx: 5,
  optionBobMs: 1400,
  // A child aiming at a circle taps slightly off it; the HIT area is the disc's
  // radius times this, so a near miss still counts.
  optionHitPad: 1.25,
  // THE SHELF behind the row — OFF by default.
  //
  // It was a full-width band to make the discs' overlap with the wall look
  // deliberate. With translucent discs that band is no longer needed: the circles
  // lift themselves off the art, and a solid strip hides the bottom of the
  // building for no gain. Raise `optionShelfHeight` to bring it back.
  optionShelfHeight: 0,
  optionShelfColor: 0x6b4423,
  optionShelfAlpha: 0.94,
  optionShelfEdgeColor: 0xd2b48c,
  optionShelfEdgeWidth: 5,

  // ---- FEEDBACK ------------------------------------------------------------
  // The floor we were asking about is OUTLINED while the child looks for it, so
  // the answer is findable by counting rather than by luck.
  highlightFloor: true,
  floorHighlightColor: 0xfbbf24,
  floorHighlightAlpha: 0.4,
  floorHighlightWidth: 6,
  // Correct: the disc pops, `pop2` plays, the floor flashes green, then the next
  // question. Held long enough for the child to see WHAT was right.
  correctFlashColor: 0x22c55e,
  correctFlashAlpha: 0.22,
  correctFlashMs: 160,
  correctFlashHoldMs: 120,
  correctPopScale: 1.16,
  correctPopMs: 180,
  successSound: 'pop2',
  successVolume: 0.85,
  // The beat before the next question, so one question does not slide straight
  // into the next.
  nextPromptMs: 620,
  // Wrong: the disc wobbles, the screen flushes red, a buzzer plays, and the SAME
  // question stays up. Counted in the run's wrong total.
  wrongFlashColor: 0xef4444,
  wrongFlashAlpha: 0.34,
  wrongFlashMs: 150,
  wrongFlashHoldMs: 190,
  wrongShakeDeg: 8,
  wrongWobbleMs: 70,
  wrongWobbleRepeats: 2,
  wrongSound: 'wrong',
  wrongVolume: 0.6,
  // A wrong tap locks input for this long, so a double-tap cannot score twice.
  wrongLockMs: 420,
  // After the last question: hold on the finished building, then hand over.
  winHoldMs: 1000,

  // The emphasised ordinal in the prompt: bigger and its own colour, drawn
  // word-by-word because Phaser Text has no inline styling.
  emphasisSizeMul: 1.45,
  emphasisColor: '#b45309',
  emphasisStrokeColor: '#fff7ed',
  emphasisStrokeThickness: 0,

  // ---- SCROLL EASING + ACCELERATION ---------------------------------------
  // THREE stages, deliberately separate, because together they are what makes a
  // swipe feel like pushing something with weight:
  //
  //   1. ACCELERATION  the target itself ramps up toward where the finger is,
  //                    instead of jumping to it. This is the stage that makes the
  //                    start feel smooth rather than twitchy.
  //   2. SMOOTHING     the visible position chases the target. This is the trailing
  //                    "heaviness".
  //   3. EASE-OUT      on release, the glide loses speed so it settles instead of
  //                    stopping dead.
  //
  // Each is a fraction applied per 60fps frame, so the feel does not change with
  // the frame rate.
  //
  // `accel` 0 = the target snaps to the finger (old behaviour: responsive but
  // twitchy). 1 = the target barely moves (sluggish). 0.45 reaches the finger
  // quickly while still ramping.
  scrollAccel: 0.45,
  scrollSmoothing: 0.22,
  scrollEaseOut: 0.14,
  // MULTIPLIES the distance a swipe travels, so the building covers more ground for
  // the same finger movement. 1 = exactly follow the finger; 1.6 = noticeably
  // faster without losing the connection to the gesture.
  scrollGain: 1.6,
};

// The ten rooms, in BUILDING order: index 0 is the TOP floor.
//
//   id          IDENTITY — keys the row and the dev panel's row picker
//   textureKey  the flat key from assets.js, for the ROOM picture on the wall
//   optionKey   the flat key for the OPTION cut-out in the choice row. Listed per
//               row rather than derived from `id`, because two of the asset keys
//               are misspelled ("Girrafe") and derivation would silently miss.
//   name        the animal, used by the prompts
//
// ORDER IS THE WHOLE CONTRACT HERE: the array counts DOWN the building, so
// `rooms[0]` is the TOP slot and `rooms[9]` is the GROUND floor. The floor NUMBER
// is derived from the array length rather than written down, so inserting a room
// cannot leave the numbering wrong — and "third floor" means the third from the
// ground, which is `length - 3` in this array.
//
// WHICH ROOM SITS IN WHICH SLOT IS RANDOMISED per run (see `shuffleRooms` below),
// so a child cannot learn "the frog is always on 3". The array below is therefore a
// POOL of ten rooms, in the order they are drawn into the reference picture; the
// floor numbers are a property of the SLOT, not of the room.
export const BUILDING_ROOMS = [
  { id: 'cat', textureKey: 'roomCat', optionKey: 'optionCat', name: 'cat' },
  { id: 'elephant', textureKey: 'roomElephant', optionKey: 'optionElephant', name: 'elephant' },
  { id: 'cow', textureKey: 'roomCow', optionKey: 'optionCow', name: 'cow' },
  { id: 'lion', textureKey: 'roomLion', optionKey: 'optionLion', name: 'lion' },
  { id: 'fish', textureKey: 'roomFish', optionKey: 'optionFish', name: 'fish' },
  { id: 'dog', textureKey: 'roomDog', optionKey: 'optionDog', name: 'dog' },
  { id: 'penguin', textureKey: 'roomPenguin', optionKey: 'optionPenguin', name: 'penguin' },
  { id: 'giraffe', textureKey: 'roomGirrafe', optionKey: 'optionGirrafe', name: 'giraffe' },
  { id: 'sheep', textureKey: 'roomSheep', optionKey: 'optionSheep', name: 'sheep' },
  { id: 'frog', textureKey: 'roomFrog', optionKey: 'optionFrog', name: 'frog' },
];

// ---------------------------------------------------------------------------
// SCENES — generic placeholder spacing for scenes without their own block
// ---------------------------------------------------------------------------
// Built from the registry, so adding a scene to scenes.js adds its block too —
// there is no second list to forget.
const sceneDefaults = (index) => ({
  playTopFrac: 0.26,
  playBottomFrac: 0.82,
  objectHeightFrac: 0.22,
  sideInsetFrac: 0.1,
  slots: 3,
  accentIndex: index,
  // WHERE THIS SCENE'S PROMPT SITS, as a canvas fraction.
  //
  // The prompt is shared HUD, drawn once by the hub, so without an override every
  // scene would have to accept the same y. Scene 3 needs it at the BOTTOM (its
  // portraits fill the top half and the placements read better with the sentence
  // underneath), while scenes 1 and 2 keep it high where their art leaves room.
  //
  // -1 means "use HUD.promptYFrac", so this only has to be set on the scenes that
  // actually differ.
  promptYFrac: -1,

  // HORIZONTAL placement and wrapping — only used by a scene that puts the prompt
  // BESIDE something rather than centred.
  //
  //   promptXFrac      left edge of the text, as a fraction (-1 = centred)
  //   promptWrapFrac   wrap width as a fraction of the canvas (-1 = shared HUD
  //                    width)
  //   promptAlign      'left' to make the wrap read as a block (-1 = centred)
  //
  // A prompt that sits to the right of an option circle has to be left-aligned
  // and wrapped narrower, or a long sentence would run under the art or off the
  // screen instead of breaking cleanly.
  promptXFrac: -1,
  promptWrapFrac: -1,
  promptAlign: -1,

  // A FULL-WIDTH BAND behind the prompt.
  //
  // The prompt is drawn over whatever art the scene brings, and a scene whose
  // picture reaches the top of the screen has no clear space for it — the sentence
  // ends up sitting on brickwork. A band gives it a surface to live on WITHOUT
  // pushing the art down.
  //
  // 0 height = no band, which is the default for the scenes that already have room.
  promptBandHeight: 0,
  // TAN, like the brick it sits above, so the band reads as part of the building
  // rather than as a UI panel pasted over it.
  promptBandColor: 0xd2b48c,
  promptBandAlpha: 0.96,
  // A hairline under the band, so it reads as a header bar rather than as a
  // translucent wash. 0 width turns it off.
  promptBandEdgeColor: 0x8b5e34,
  promptBandEdgeWidth: 0,
  // The scene title chip is `#0f172a` — near-black, for a light backdrop. On a dark
  // band it vanishes, so a banded scene sets its own.
  promptTitleColor: null,

  // PROMPT COLOUR overrides, for a scene that puts a band behind the prompt.
  //
  // The shared HUD prompt is WHITE with a dark outline, because it normally sits
  // straight on the art. On a pale tan band that is exactly backwards — the
  // outline does the reading and the fill disappears — so a banded scene flips it
  // to dark text with no outline.
  //
  // null / -1 = keep the shared HUD styling, which the hub re-applies on every
  // mount so a banded scene cannot leak its colours into the next one.
  promptColor: null,
  promptStrokeColor: null,
  promptStrokeThickness: -1,
});

// Scenes whose prompt is NOT in the default top-centre position. Kept as a small
// override table so `sceneDefaults` stays one obvious function.
const SCENE_PROMPT = {
  // Scene 3 — lower part of the screen, SIDE BY SIDE with its option circle: disc
  // on the left, sentence to its right, both sharing one baseline.
  //
  //   prompt y 0.90 ≈ 972 — high enough to clear the very bottom edge (0.955 sat
  //                         almost on it, which read as falling off the screen)
  //   prompt x 0.38 — the LEFT EDGE of the text column, just right of the disc
  //                   (disc 0.22 + radius 88 ≈ 0.35, plus a gap)
  //   wrap 0.58 — the rest of the width, so a long prompt breaks onto a SECOND
  //               line instead of running off the canvas
  //   align 'center' — CENTRED within that column, which is what reads as tidy
  //                    beside the disc; the column itself stays where promptXFrac
  //                    puts it, so the text never creeps under the circle
  positions: {
    promptYFrac: 0.87,
    promptXFrac: 0.38,
    promptWrapFrac: 0.58,
    promptAlign: 'center',
  },

  // Scene 4 reaches the top of the screen with its wall, so its prompt needs a
  // surface: a full-width band pinned to the very top.
  building: {
    // ONE ROW OF CONTENT: the progress dots are gone (the scene title "4 / 4 ·
    // The Building" already says where you are), so the band only has to hold the
    // prompt and can be much shorter than the two-row 190px it used to be.
    //
    // At 0.089 on a 1080-tall canvas the prompt's centre is y≈96. One line of
    // 34px type spans y 74…118; a wrapped SECOND line spans y 52…140. Both clear
    // the title chip (which ends at y≈42) above and the band's edge (146) below,
    // which is why the y cannot go any higher now the dots are gone.
    promptYFrac: 0.089,
    // -1 = no column: the prompt is anchored on the canvas MIDLINE, so it is
    // genuinely centred rather than centred inside a column that starts at 0.
    promptXFrac: -1,
    promptWrapFrac: 0.94,
    promptAlign: 'center',
    promptBandHeight: 150,
    promptBandColor: 0xd2b48c,
    promptBandAlpha: 0.96,
    // A darker brown hairline, so the tan band has a defined lower edge against
    // the brickwork behind it.
    promptBandEdgeColor: 0x8b5e34,
    promptBandEdgeWidth: 4,
    // Dark on tan: the shared white-with-black-outline prompt is built for art,
    // and on a solid tan band it reads as a smudge.
    //
    // The body is a near-black brown and keeps a THIN pale outline. Dark-on-tan
    // alone was legible up close but thin at a glance across a full-width band;
    // the pale hairline gives the letterforms an edge without becoming the heavy
    // drop shadow the shared art style uses.
    promptTitleColor: '#4a2f18',
    promptColor: '#241705',
    promptStrokeColor: '#fdf3e3',
    promptStrokeThickness: 2,
  },
};

export const SCENES_TUNING = Object.fromEntries(
  SCENES.map((scene, index) => [
    scene.id,
    {
      ...sceneDefaults(index),
      // Only override the ones that differ; -1 keeps the shared HUD position.
      ...(SCENE_PROMPT[scene.id] || {}),
    },
  ])
);

// ---------------------------------------------------------------------------
// DEV SCOPE — which round the panel's part table is editing
// ---------------------------------------------------------------------------
// Not a table (never registered with the kit): plain module state the scene
// writes whenever it mounts a round, and the schema's `scope` reads. Exactly
// game 12's setDevScope / inCurrentScene pair.
let devRound = MIRROR_ROUNDS[0].round;

/** Called by the scene on every round mount, so the panel follows the canvas. */
export function setDevScope(round) {
  if (round != null) devRound = round;
}

/** The round the panel is currently showing rows for. */
export function getDevScope() {
  return devRound;
}

// Rows belonging to the round on screen.
const inCurrentRound = (rows) => rows.filter((row) => row.round === devRound);

// ---------------------------------------------------------------------------
// KIT INSTANCE
// ---------------------------------------------------------------------------
const TABLES = {
  ENGINE,
  HUD,
  SCENE1,
  SCENE2,
  MIRROR_ROUNDS,
  MIRROR_PARTS,
  POSITIONS,
  POSITION_ROUNDS,
  POSITION_PARTS,
  BUILDING,
  BUILDING_ROOMS,
  SCENES: SCENES_TUNING,
};

// `id` namespaces the kit's globals. Must be unique; 'G16' is this game's.
export const TUNING = createTuning({ id: 'G16', tables: TABLES });

// ---------------------------------------------------------------------------
// ACCESSORS — the hub and the scenes read through these, never the constants.
// ---------------------------------------------------------------------------
export const getEngine = () => TUNING.get('ENGINE');
export const getHud = () => TUNING.get('HUD');
export const getScene1 = () => TUNING.get('SCENE1');
export const getScene2 = () => TUNING.get('SCENE2');
export const getMirrorRounds = () => TUNING.get('MIRROR_ROUNDS') || [];
export const getMirrorParts = () => TUNING.get('MIRROR_PARTS') || [];

// One round's meta by its 1-based round number, with any live override applied.
export const getMirrorRound = (roundNumber) =>
  getMirrorRounds().find((row) => row.round === roundNumber) ||
  MIRROR_ROUNDS.find((row) => row.round === roundNumber) ||
  MIRROR_ROUNDS[0];

// The parts belonging to one round, resolved through the kit.
export const getMirrorPartsFor = (roundNumber) =>
  getMirrorParts().filter((part) => part.round === roundNumber);

// ONE part's transform, resolved through the kit — game 12's partTransform.
// Falls back to a centred default so a part missing from the table is VISIBLE
// in the middle of the canvas rather than silently absent.
export const getMirrorPart = (id) => {
  const row = getMirrorParts().find((part) => part.id === id);
  return row || partTransformFallback(id);
};

// ---- scene 3 ---------------------------------------------------------------
export const getPositions = () => TUNING.get('POSITIONS');
export const getPositionRounds = () => TUNING.get('POSITION_ROUNDS') || [];
export const getPositionParts = () => TUNING.get('POSITION_PARTS') || [];

// One portrait by its 1-based round number.
export const getPositionRound = (roundNumber) =>
  getPositionRounds().find((row) => row.round === roundNumber) ||
  POSITION_ROUNDS.find((row) => row.round === roundNumber) ||
  POSITION_ROUNDS[0];

// The prompts belonging to one portrait, in slot order. A portrait asks two
// opposite relations, so this is where "top then bottom" comes from.
export const getPositionPartsFor = (roundNumber) =>
  getPositionParts()
    .filter((part) => part.round === roundNumber)
    .sort((a, b) => String(a.slot).localeCompare(String(b.slot)));

// ---- scene 4 ---------------------------------------------------------------
export const getBuilding = () => TUNING.get('BUILDING');
export const getBuildingRooms = () => TUNING.get('BUILDING_ROOMS') || [];

// One scene's placeholder block, resolved with any live override applied.
export const getSceneTuning = (sceneId) =>
  TUNING.get('SCENES')?.[sceneId] ?? TUNING.get('SCENES')?.[SCENES[0].id];

// ---------------------------------------------------------------------------
// VALUES → SOURCE (the copy-paste readout)
// ---------------------------------------------------------------------------
function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

// Colours are authored as 0xRRGGBB literals; this prints them the same way.
function hex(n) {
  return `0x${Number(n).toString(16).padStart(6, '0')}`;
}

function bool(v) {
  return v ? 'true' : 'false';
}

function field(key, value, indent = '  ') {
  return `${indent}${key}: ${value},`;
}

// Engine and HUD are short, hand-commented blocks, so they are emitted with
// their comments rather than from a key list.
function renderEngine(v) {
  return [
    'export const ENGINE = {',
    '  // How long the scene-to-scene handover takes. A short dip keeps the run',
    '  // feeling continuous; 0 makes it a hard cut.',
    field('transitionMs', fmt(v.transitionMs)),
    '  // Fade the incoming scene in over this fraction of transitionMs.',
    field('crossfade', fmt(v.crossfade)),
    '  // Dev-only: draw the placeholder frame, ids and per-scene accent.',
    field('devChrome', bool(v.devChrome)),
    '};',
  ].join('\n');
}

function renderHud(v) {
  return [
    'export const HUD = {',
    "  // WHITE WITH A THIN DARK OUTLINE: the prompt sits over each scene's own art,",
    '  // so a flat fill is invisible on some of the five and fine on others.',
    field('promptYFrac', fmt(v.promptYFrac)),
    field('promptFontSize', fmt(v.promptFontSize)),
    field('promptColor', `'${v.promptColor}'`),
    field('promptStrokeColor', `'${v.promptStrokeColor}'`),
    field('promptStrokeThickness', fmt(v.promptStrokeThickness)),
    field('promptWrapFrac', fmt(v.promptWrapFrac)),
    '  // Scene title chip, top-left.',
    field('titleX', fmt(v.titleX)),
    field('titleY', fmt(v.titleY)),
    field('titleFontSize', fmt(v.titleFontSize)),
    field('titleColor', `'${v.titleColor}'`),
    '};',
  ].join('\n');
}

// SCENE1 is long but flat, so it is emitted from one ordered key list rather
// than a hand-written line per field — that is what keeps the printed copy and
// the real block in step when a conveyor number is added.
const SCENE1_FIELDS = [
  ['bgAlpha', 'n'], ['bgOffsetXFrac', 'n'], ['bgOffsetYFrac', 'n'],
  ['beltYFrac', 'n'], ['beltHeightFrac', 'n'], ['beltAlpha', 'n'], ['beltOverlap', 'n'],
  ['charHeightFrac', 'n'], ['charXFrac', 'n'], ['charBeltGapFrac', 'n'],
  ['charAlpha', 'n'], ['charDepth', 'n'],
  ['rollAnimKey', 's'], ['rollFps', 'n'], ['rollHoldMs', 'n'], ['shapesFadeInMs', 'n'],
  ['slotFollowRobot', 'b'], ['slotOffsetXFrac', 'n'], ['slotOffsetYFrac', 'n'],
  ['slotXFrac', 'n'], ['slotYFrac', 'n'], ['slotWidthFrac', 'n'], ['slotAspect', 'n'],
  ['slotBoxFillColor', 'h'], ['slotBoxFillAlpha', 'n'], ['slotBoxBorderColor', 'h'],
  ['slotBoxBorderWidth', 'n'], ['slotBoxRadius', 'n'],
  ['slotCardSizeOfWindow', 'n'], ['slotCardGapFrac', 'n'],
  ['slotWordColor', 'h'], ['slotWordSizeOfCard', 'n'], ['slotWordFitOfWindow', 'n'],
  ['slotWordStroke', 'n'], ['slotCycles', 'n'], ['slotSpinMs', 'n'],
  ['slotSpinVolume', 'n'], ['slotSpinRateMin', 'n'], ['slotSpinRateMax', 'n'],
  ['slotSettleMs', 'n'], ['slotEase', 's'], ['slotLandPulseScale', 'n'],
  ['slotLandPulseMs', 'n'], ['slotHighlightColor', 'h'], ['slotHighlightAlpha', 'n'],
  ['slotHighlightSizeOfBox', 'n'], ['slotHighlightGrow', 'n'], ['slotHighlightMs', 'n'],
  ['slotDepth', 'n'],
  ['optionRowXFrac', 'n'], ['optionRowYFrac', 'n'], ['optionSizeFrac', 'n'],
  ['optionGapPx', 'n'],
  ['shapeStrokeWidth', 'n'], ['shapeStrokeColor', 'h'], ['shapeIdleAlpha', 'n'],
  ['shapeDragScale', 'n'], ['rectangleAspect', 'n'],
  ['dropYOffsetFrac', 'n'], ['dropSnapMs', 'n'], ['dropToleranceFrac', 'n'],
  ['dropXFrac', 'n'], ['parkSpreadFrac', 'n'],
  ['dropZoneColor', 'h'], ['dropZoneAlpha', 'n'], ['dropZoneRadiusFrac', 'n'],
  ['dropZonePulseAlpha', 'n'], ['dropZonePulseMs', 'n'],
  ['correctFlashColor', 'h'], ['correctFlashAlpha', 'n'], ['correctFlashMs', 'n'],
  ['correctFlashHoldMs', 'n'], ['winHoldMs', 'n'], ['winHoldPadMs', 'n'],
  ['wrongFlashColor', 'h'], ['wrongFlashAlpha', 'n'], ['wrongFlashMs', 'n'],
  ['wrongFlashHoldMs', 'n'], ['wrongRestartMs', 'n'],
  ['sendOffSpeed', 'n'],
];

function scalar(kind, value) {
  if (kind === 'h') return hex(value);
  if (kind === 'b') return bool(value);
  if (kind === 's') return `'${value}'`;
  return fmt(value);
}

// The handful of SCENE1 keys whose comment carries real reasoning: emitted just
// above the field so the pasted copy keeps the "why", not just the number.
const SCENE1_NOTES = {
  slotWordColor: [
    '  // One colour for every clue: the clue TEXT is the content, so varying its',
    '  // colour made the colours look meaningful when only the words are.',
  ],
  slotSpinVolume: [
    "  // The whirr plays at a rate solved from the clip's OWN length, so it ends",
    '  // exactly when the slot sequence does. These three are the only knobs.',
  ],
  dropToleranceFrac: [
    '  // A drop within this fraction of the belt\'s height above/below the belt still',
    '  // counts: a forgiving band, not a precision test.',
  ],
  correctFlashColor: [
    '  // Green = won, red = try again, through one helper so they read as the same',
    '  // piece of feedback with opposite meanings.',
  ],
  winHoldMs: [
    '  // The effective hold is the LARGER of this and the flash\'s own length, so',
    '  // retuning the flash can never outrun the hold and cut itself off.',
  ],
};

function renderScene1(v) {
  const lines = ['export const SCENE1 = {'];
  SCENE1_FIELDS.forEach(([key, kind]) => {
    if (SCENE1_NOTES[key]) lines.push(...SCENE1_NOTES[key]);
    lines.push(field(key, scalar(kind, v[key])));
  });
  lines.push('};');
  return lines.join('\n');
}

function renderScene2(v) {
  return [
    'export const SCENE2 = {',
    '  // THE TWO HALVES ARE THE DIVIDER — no line is drawn; the colour change is',
    '  // the axis. `source` is the half the portrait is built on.',
    field('sourceFillColor', hex(v.sourceFillColor)),
    field('sourceFillAlpha', fmt(v.sourceFillAlpha)),
    field('mirrorFillColor', hex(v.mirrorFillColor)),
    field('mirrorFillAlpha', fmt(v.mirrorFillAlpha)),
    field('fillBehindPortrait', bool(v.fillBehindPortrait)),
    '  // The optional divider. 0 width leaves it invisible.',
    field('lineWidth', fmt(v.lineWidth)),
    field('lineColor', hex(v.lineColor)),
    field('lineAlpha', fmt(v.lineAlpha)),
    '  // Optional full-bleed backdrop drawn ABOVE the washes. 0 alpha means "none".',
    field('bgAlpha', fmt(v.bgAlpha)),
    field('bgOffsetX', fmt(v.bgOffsetX)),
    field('bgOffsetY', fmt(v.bgOffsetY)),
    field('bgZoom', fmt(v.bgZoom)),
    '  // One slider to dim the whole portrait while judging it.',
    field('portraitAlpha', fmt(v.portraitAlpha)),
    '  // The tray: parts start here at PREVIEW size, dragged out at TRUE size.',
    field('trayY', fmt(v.trayY)),
    field('trayGapX', fmt(v.trayGapX)),
    field('trayBoxPx', fmt(v.trayBoxPx)),
    field('trayBoxInset', fmt(v.trayBoxInset)),
    field('trayBobPx', fmt(v.trayBobPx)),
    field('trayBobMs', fmt(v.trayBobMs)),
    field('trayDiscAlpha', fmt(v.trayDiscAlpha)),
    field('trayDiscStrokeAlpha', fmt(v.trayDiscStrokeAlpha)),
    field('trayDiscStrokeWidth', fmt(v.trayDiscStrokeWidth)),
    field('trayShadowAlpha', fmt(v.trayShadowAlpha)),
    field('trayShadowDy', fmt(v.trayShadowDy)),
    '  // The drop boxes: a piece belongs on the socket for its OWN id.',
    field('dropPad', fmt(v.dropPad)),
    field('boxMinPx', fmt(v.boxMinPx)),
    field('boxPadding', fmt(v.boxPadding)),
    '  // Derived box size (a square of the longest side × this, floored at boxMinPx).',
    field('boxSizeFrac', fmt(v.boxSizeFrac)),
    '  // Dev: outline every drop box so it can be judged against the art.',
    field('showBoxes', bool(v.showBoxes)),
    '  // Faint sockets on the mirrored side, sized from the piece.',
    field('socketSizeMul', fmt(v.socketSizeMul)),
    field('socketAlpha', fmt(v.socketAlpha)),
    '  // A correct drop snaps, reveals the reflection, and pulses.',
    field('snapMs', fmt(v.snapMs)),
    field('landPulseScale', fmt(v.landPulseScale)),
    field('landPulseMs', fmt(v.landPulseMs)),
    field('correctFlashColor', hex(v.correctFlashColor)),
    field('correctFlashAlpha', fmt(v.correctFlashAlpha)),
    field('correctFlashMs', fmt(v.correctFlashMs)),
    field('correctFlashHoldMs', fmt(v.correctFlashHoldMs)),
    field('wrongFlashColor', hex(v.wrongFlashColor)),
    field('wrongFlashAlpha', fmt(v.wrongFlashAlpha)),
    field('wrongFlashMs', fmt(v.wrongFlashMs)),
    field('wrongFlashHoldMs', fmt(v.wrongFlashHoldMs)),
    field('wrongShakeDeg', fmt(v.wrongShakeDeg)),
    field('winHoldMs', fmt(v.winHoldMs)),
    '  // Dev: allow re-grabbing a placed part on the canvas.',
    field('allowReplacingPlaced', bool(v.allowReplacingPlaced)),
    '  // Dev aid: a ring at each computed duplicate position.',
    field('showMirrorHints', bool(v.showMirrorHints)),
    '};',
  ].join('\n');
}

function renderMirrorRounds(rows) {
  const blocks = rows.map((r) =>
    [
      '  {',
      field('id', `'${r.id}'`, '    '),
      field('round', r.round, '    '),
      field('axisDeg', fmt(r.axisDeg), '    '),
      field('axisX', fmt(r.axisX), '    '),
      field('axisY', fmt(r.axisY), '    '),
      field('lineWidth', fmt(r.lineWidth), '    '),
      field('lineColor', hex(r.lineColor), '    '),
      field('lineAlpha', fmt(r.lineAlpha), '    '),
      field('glowAlpha', fmt(r.glowAlpha), '    '),
      field('glowWidthMul', fmt(r.glowWidthMul), '    '),
      '  },',
    ].join('\n')
  );
  return ['export const MIRROR_ROUNDS = [', blocks.join('\n'), '];'].join('\n');
}

// The part fields in a FIXED order, so a reordered object literal cannot make
// the printed copy look different from the block it replaced.
const PART_FIELDS = [
  ['textureKey', 's'],
  ['x', 'n'],
  ['y', 'n'],
  ['scale', 'n'],
  ['rotation', 'n'],
  ['flipX', 'n'],
  ['z', 'n'],
  ['alpha', 'n'],
  ['mirror', 'n'],
  ['dupScaleMul', 'n'],
  ['dupRotation', 'n'],
  ['dupDX', 'n'],
  ['dupDY', 'n'],
  ['dupAlpha', 'n'],
  // The drop-box override: 0 means "derive one".
  ['boxW', 'n'],
  ['boxH', 'n'],
];

function renderMirrorParts(rows) {
  const blocks = rows.map((p) =>
    [
      '  {',
      field('id', `'${p.id}'`, '    '),
      field('round', p.round, '    '),
      ...PART_FIELDS.map(([key, kind]) => field(key, scalar(kind, p[key]), '    ')),
      '  },',
    ].join('\n')
  );
  return ['export const MIRROR_PARTS = [', blocks.join('\n'), '];'].join('\n');
}

// Scene 3's two tables. Same shape of output as the mirror ones: one block per
// portrait, one per prompt, so a tuned portrait pastes back readable.
const POSITION_SETTING_FIELDS = [
  ['bgFit', 's'], ['bgZoom', 'n'], ['bgOffsetX', 'n'], ['bgOffsetY', 'n'],
  ['objectAlpha', 'n'], ['showTargets', 'b'], ['targetRadius', 'n'],
  ['targetColor', 'h'], ['targetAlpha', 'n'],
  ['snapMs', 'n'], ['landPulseScale', 'n'], ['landPulseMs', 'n'],
  ['correctFlashColor', 'h'], ['correctFlashAlpha', 'n'],
  ['correctFlashMs', 'n'], ['correctFlashHoldMs', 'n'],
  ['wrongFlashColor', 'h'], ['wrongFlashAlpha', 'n'],
  ['wrongFlashMs', 'n'], ['wrongFlashHoldMs', 'n'],
  ['winHoldMs', 'n'],
  // The option circle.
  ['optionXFrac', 'n'], ['optionY', 'n'], ['optionRadius', 'n'],
  ['optionDiscAlpha', 'n'], ['optionDiscStrokeAlpha', 'n'],
  ['optionDiscStrokeWidth', 'n'], ['optionShadowAlpha', 'n'],
  ['optionShadowDy', 'n'], ['optionBoxInset', 'n'],
  ['optionBobPx', 'n'], ['optionBobMs', 'n'],
  // The drop areas.
  ['areaSizePx', 'n'], ['dropPad', 'n'],
  // The mistake.
  ['mistakeShakeDeg', 'n'], ['mistakeReturnMs', 'n'],
  ['wrongAreaPulseAlpha', 'n'], ['wrongAreaPulseMs', 'n'],
  // Round flow.
  ['successPopVolume', 'n'], ['successPopRate', 'n'], ['nextPromptMs', 'n'],
  // The emphasised word in the prompt.
  ['emphasisSizeMul', 'n'], ['emphasisColor', 's'],
  ['emphasisStrokeColor', 's'], ['emphasisStrokeThickness', 'n'],
];

const POSITION_ROUND_FIELDS = [
  ['bgKey', 's'], ['bgScale', 'n'], ['bgX', 'n'], ['bgY', 'n'],
  ['slotAX', 'n'], ['slotAY', 'n'], ['slotAScale', 'n'],
  ['slotABoxW', 'n'], ['slotABoxH', 'n'],
  ['slotBX', 'n'], ['slotBY', 'n'], ['slotBScale', 'n'],
  ['slotBBoxW', 'n'], ['slotBBoxH', 'n'],
];

const POSITION_PART_FIELDS = [
  ['slot', 's'], ['textureKey', 's'], ['prompt', 's'],
  // The word in `prompt` drawn bigger and in the emphasis colour. Printed with
  // the prompt so the two can never drift apart in a pasted file.
  ['emphasis', 's'],
  ['x', 'n'], ['y', 'n'], ['scale', 'n'], ['rotation', 'n'], ['flipX', 'n'],
  ['z', 'n'], ['alpha', 'n'], ['boxW', 'n'], ['boxH', 'n'],
];

function renderPositionSettings(v) {
  const lines = ['export const POSITIONS = {'];
  POSITION_SETTING_FIELDS.forEach(([key, kind]) => lines.push(field(key, scalar(kind, v[key]))));
  lines.push('};');
  return lines.join('\n');
}

function renderPositionRounds(rows) {
  const blocks = rows.map((r) =>
    [
      '  {',
      field('id', `'${r.id}'`, '    '),
      field('round', r.round, '    '),
      ...POSITION_ROUND_FIELDS.map(([key, kind]) => field(key, scalar(kind, r[key]), '    ')),
      '  },',
    ].join('\n')
  );
  return ['export const POSITION_ROUNDS = [', blocks.join('\n'), '];'].join('\n');
}

function renderPositionParts(rows) {
  const blocks = rows.map((p) =>
    [
      '  {',
      field('id', `'${p.id}'`, '    '),
      field('round', p.round, '    '),
      ...POSITION_PART_FIELDS.map(([key, kind]) => field(key, scalar(kind, p[key]), '    ')),
      '  },',
    ].join('\n')
  );
  return ['export const POSITION_PARTS = [', blocks.join('\n'), '];'].join('\n');
}

// Scene 4's two blocks.
const BUILDING_FIELDS = [
  ['wallWidth', 'n'], ['wallRightInset', 'n'],
  ['roomCentreXFrac', 'n'], ['roomRightInsetFrac', 'n'],
  ['roomWidth', 'n'], ['roomGap', 'n'], ['groundRoomBottomGapPx', 'n'],
  ['startScrollPx', 'n'], ['wallTopPadPx', 'n'],
  ['scrollSwipe', 'b'], ['scrollWheel', 'b'], ['scrollSensitivity', 'n'],
  ['momentum', 'n'], ['momentumMinPx', 'n'], ['clampScroll', 'b'],
  ['scrollTopInsetFrac', 'n'], ['scrollBottomInsetFrac', 'n'],
  ['scrollAccel', 'n'], ['scrollSmoothing', 'n'], ['scrollEaseOut', 'n'],
  ['scrollGain', 'n'],
  ['wallAlpha', 'n'], ['roomAlpha', 'n'],
  ['buildingShadowAlpha', 'n'], ['buildingShadowOffsetPx', 'n'],
  ['showFloorLines', 'b'], ['floorLineColor', 'h'], ['floorLineAlpha', 'n'],
  ['floorLineWidth', 'n'],
  // The brown band that fills the gap between floors.
  ['gapFill', 'b'], ['gapFillColor', 'h'], ['gapFillAlpha', 'n'],
  ['gapFillWidthFrac', 'n'], ['gapFillPadPx', 'n'],
  ['gapFillEdgeColor', 'h'], ['gapFillEdgeWidth', 'n'],
  // Floor numbers.
  ['showFloorNumbers', 'b'], ['floorNumberFontSize', 'n'],
  ['floorNumberColor', 's'], ['floorNumberStrokeColor', 's'],
  ['floorNumberStrokeThickness', 'n'], ['floorNumberAlpha', 'n'],
  ['shuffleRooms', 'b'],
  // The number's plate.
  ['floorNumberBox', 'b'], ['floorNumberBoxColor', 'h'],
  ['floorNumberBoxAlpha', 'n'], ['floorNumberBoxPadPx', 'n'],
  ['floorNumberBoxRadius', 'n'], ['floorNumberBoxBorderColor', 'h'],
  ['floorNumberBoxBorderWidth', 'n'], ['floorNumberBoxWidthPx', 'n'],
  // The question: how many rounds, and how many options per round.
  ['roundsPerRun', 'n'], ['optionCount', 'n'],
  // The option row along the bottom.
  ['optionYFrac', 'n'], ['optionStepFrac', 'n'], ['optionRadius', 'n'],
  ['optionDiscColor', 'h'], ['optionDiscAlpha', 'n'],
  ['optionDiscStrokeWidth', 'n'], ['optionDiscStrokeColor', 'h'],
  ['optionDiscStrokeAlpha', 'n'], ['optionSpriteFrac', 'n'],
  ['optionShadowDy', 'n'], ['optionShadowAlpha', 'n'],
  ['optionPressScale', 'n'], ['optionPressMs', 'n'],
  ['optionBobPx', 'n'], ['optionBobMs', 'n'], ['optionHitPad', 'n'],
  ['optionShelfHeight', 'n'], ['optionShelfColor', 'h'],
  ['optionShelfAlpha', 'n'], ['optionShelfEdgeColor', 'h'],
  ['optionShelfEdgeWidth', 'n'],
  // Feedback.
  ['highlightFloor', 'b'], ['floorHighlightColor', 'h'],
  ['floorHighlightAlpha', 'n'], ['floorHighlightWidth', 'n'],
  ['correctFlashColor', 'h'], ['correctFlashAlpha', 'n'],
  ['correctFlashMs', 'n'], ['correctFlashHoldMs', 'n'],
  ['correctPopScale', 'n'], ['correctPopMs', 'n'],
  ['successSound', 's'], ['successVolume', 'n'],
  ['nextPromptMs', 'n'],
  ['wrongFlashColor', 'h'], ['wrongFlashAlpha', 'n'],
  ['wrongFlashMs', 'n'], ['wrongFlashHoldMs', 'n'],
  ['wrongShakeDeg', 'n'], ['wrongWobbleMs', 'n'], ['wrongWobbleRepeats', 'n'],
  ['wrongSound', 's'], ['wrongVolume', 'n'], ['wrongLockMs', 'n'],
  ['winHoldMs', 'n'],
  // The emphasised ordinal in the prompt.
  ['emphasisSizeMul', 'n'], ['emphasisColor', 's'],
  ['emphasisStrokeColor', 's'], ['emphasisStrokeThickness', 'n'],
];

const BUILDING_ROOM_FIELDS = [['textureKey', 's'], ['optionKey', 's'], ['name', 's']];

function renderBuildingSettings(v) {
  const lines = ['export const BUILDING = {'];
  BUILDING_FIELDS.forEach(([key, kind]) => lines.push(field(key, scalar(kind, v[key]))));
  lines.push('};');
  return lines.join('\n');
}

/**
 * The per-scene prompt overrides, re-emitted from the live tables.
 *
 * This is a plain `const` block rather than a kit table (it is read by the hub
 * through `getSceneTuning`, not through `TUNING.get`), so it needs its own
 * renderer — but it is ALSO real tuning: a band height or a prompt y dragged in
 * the panel lives here. Without this, "Copy tuning code" would hand back a file
 * with the scene prompt layout silently reset to its defaults.
 *
 * Only scenes that actually override something are printed, and only the keys they
 * set, so the output stays as short as the source.
 */
// The keys this block is allowed to carry. Listed explicitly rather than
// discovered from the const literal, because a key that is SET but not yet IN
// the literal — which is exactly what happens when a scene gains a new prompt
// override in `sceneDefaults` — would otherwise be dropped by a paste.
const SCENE_PROMPT_KEYS = [
  'promptYFrac',
  'promptXFrac',
  'promptWrapFrac',
  'promptAlign',
  'promptBandHeight',
  'promptBandColor',
  'promptBandAlpha',
  'promptBandEdgeColor',
  'promptBandEdgeWidth',
  'promptTitleColor',
  'promptColor',
  'promptStrokeColor',
  'promptStrokeThickness',
];

function renderScenePrompt() {
  // LIVE values, not the const's: the panel writes into the SCENES table, so
  // reading the source const here would print the file's values and quietly
  // discard everything dragged in this session.
  const scenes = TUNING.get('SCENES') || {};
  const lines = ['const SCENE_PROMPT = {'];

  Object.keys(SCENE_PROMPT).forEach((id) => {
    const live = scenes[id] || {};
    lines.push(`  // ${id}`);
    lines.push(`  ${id}: {`);
    SCENE_PROMPT_KEYS.forEach((key) => {
      const value = live[key];
      // `null` means "no override" and is the default, so it is not printed:
      // writing it back would turn an optional key into a permanent one.
      if (value == null) return;
      // Colours are authored as 0xRRGGBB, so they must print that way — `fmt`
      // would hand back the decimal, which is a valid Phaser colour but leaves
      // the pasted file unreadable.
      if (typeof value === 'number') {
        lines.push(`    ${key}: ${key.endsWith('Color') ? hex(value) : fmt(value)},`);
      } else if (typeof value === 'boolean') {
        lines.push(`    ${key}: ${bool(value)},`);
      } else {
        lines.push(`    ${key}: '${value}',`);
      }
    });
    lines.push('  },');
  });

  lines.push('};');
  return lines.join('\n');
}

function renderBuildingRooms(rows) {
  const blocks = rows.map((r) =>
    [
      '  {',
      field('id', `'${r.id}'`, '    '),
      ...BUILDING_ROOM_FIELDS.map(([key, kind]) => field(key, scalar(kind, r[key]), '    ')),
      '  },',
    ].join('\n')
  );
  return ['export const BUILDING_ROOMS = [', blocks.join('\n'), '];'].join('\n');
}

/**
 * Swap one top-level `export const X = { … }` / `= [ … ]` block in `source`
 * for `replacement`.
 *
 * Anchored on the block's own header line and closed by the first `};`/`];` at
 * column 0, which is how these blocks are written throughout the file. If the
 * anchor or the terminator is missing, the SOURCE IS RETURNED UNCHANGED for that
 * block — a formatter that silently drops a table would hand back a file that
 * loses data, which is worse than handing back stale values.
 */
function replaceBlock(source, anchor, replacement) {
  const start = source.indexOf(anchor);
  if (start === -1) return source;

  const close = anchor.trimEnd().endsWith('[') ? '\n];' : '\n};';
  const end = source.indexOf(close, start);
  if (end === -1) return source;

  return source.slice(0, start) + replacement + source.slice(end + close.length);
}

/**
 * The copy-paste readout: THIS FILE, with the six value-bearing blocks replaced
 * by freshly rendered ones.
 *
 * Everything else is the real source, so the pasted file keeps its imports,
 * comments, accessors, schema and this formatter — nothing to re-type and
 * nothing to keep in sync.
 */
export function formatTuningCode() {
  const engine = getEngine();
  const hud = getHud();
  const s1 = getScene1();
  const s2 = getScene2();
  const rounds = getMirrorRounds();
  const parts = getMirrorParts();

  let out = ownSource;

  out = replaceBlock(out, 'export const ENGINE = {', renderEngine(engine));
  out = replaceBlock(out, 'export const HUD = {', renderHud(hud));
  out = replaceBlock(out, 'export const SCENE1 = {', renderScene1(s1));
  out = replaceBlock(out, 'export const SCENE2 = {', renderScene2(s2));
  out = replaceBlock(out, 'export const MIRROR_ROUNDS = [', renderMirrorRounds(rounds));
  out = replaceBlock(out, 'export const MIRROR_PARTS = [', renderMirrorParts(parts));

  // Scene 3. Positions are edited together, so all three blocks go in one go.
  out = replaceBlock(out, 'export const POSITIONS = {', renderPositionSettings(getPositions()));
  out = replaceBlock(
    out,
    'export const POSITION_ROUNDS = [',
    renderPositionRounds(getPositionRounds())
  );
  out = replaceBlock(
    out,
    'export const POSITION_PARTS = [',
    renderPositionParts(getPositionParts())
  );

  // Scene 4.
  out = replaceBlock(out, 'export const BUILDING = {', renderBuildingSettings(getBuilding()));
  out = replaceBlock(
    out,
    'export const BUILDING_ROOMS = [',
    renderBuildingRooms(getBuildingRooms())
  );

  // The per-scene prompt overrides. Its own renderer because it is a plain const
  // block, but it is just as much tuning as anything above — scene 4's prompt band
  // lives here.
  out = replaceBlock(out, 'const SCENE_PROMPT = {', renderScenePrompt());

  return out;
}

// ---------------------------------------------------------------------------
// SCHEMA — what the dev panel renders
// ---------------------------------------------------------------------------
// Group order is chosen for how the work actually goes: get to the round first
// (nav), then the parts, then the shared scene numbers.
export const TUNING_SCHEMA = {
  title: 'GAME 16 · 5 SCENES',
  help: '« » jump scenes · ◀ ▶ step rounds. Sliders apply live; edits hot-reload.',
  copyHint: 'paste over tuning.js — whole file',
  format: formatTuningCode,

  // Turns on the panel's scene/round nav bar. The hub registers the handlers.
  nav: true,

  groups: [
    {
      key: 'ENGINE',
      label: 'Engine (whole run)',
      fields: [
        { path: 'transitionMs', label: 'transition', min: 0, max: 1200, step: 10, suffix: 'ms' },
        { path: 'crossfade', label: 'crossfade', min: 0, max: 1, step: 0.05 },
        { path: 'devChrome', label: 'dev chrome', type: 'toggle' },
      ],
    },
    {
      key: 'HUD',
      label: 'Shared HUD',
      fields: [
        { path: 'promptYFrac', label: 'prompt y', min: 0, max: 1, step: 0.005 },
        { path: 'promptFontSize', label: 'prompt size', min: 12, max: 72, step: 1, suffix: 'px' },
        { path: 'promptStrokeThickness', label: 'prompt outline', min: 0, max: 12, step: 1, suffix: 'px' },
        { path: 'titleX', label: 'title x', min: 0, max: 720, step: 1 },
        { path: 'titleY', label: 'title y', min: 0, max: 1080, step: 1 },
        { path: 'titleFontSize', label: 'title size', min: 10, max: 48, step: 1, suffix: 'px' },
      ],
    },
    // Scene 2 first: while the portraits are being built, this is the table you
    // spend every session in.
    {
      type: 'array',
      key: 'MIRROR_PARTS',
      label: '2. Mirror — portrait parts (current round)',
      itemLabel: (row) => row.id,
      scope: inCurrentRound,
      fields: [
        { path: 'x', label: 'x', min: -400, max: 1120, step: 1 },
        { path: 'y', label: 'y', min: -400, max: 1480, step: 1 },
        { path: 'scale', label: 'scale', min: 0, max: 4, step: 0.01 },
        { path: 'rotation', label: 'rotation', min: -180, max: 180, step: 1, suffix: '°' },
        { path: 'flipX', label: 'flipX (0/1)', min: 0, max: 1, step: 1 },
        { path: 'z', label: 'z', min: 0, max: 20, step: 1 },
        { path: 'alpha', label: 'alpha', min: 0, max: 1, step: 0.02 },
        { path: 'mirror', label: 'mirror it (0/1)', min: 0, max: 1, step: 1 },
        { path: 'dupScaleMul', label: 'dup scale ×', min: 0.2, max: 3, step: 0.01 },
        { path: 'dupRotation', label: 'dup rotation', min: -180, max: 180, step: 1, suffix: '°' },
        { path: 'dupDX', label: 'dup dx', min: -200, max: 200, step: 1 },
        { path: 'dupDY', label: 'dup dy', min: -200, max: 200, step: 1 },
        { path: 'dupAlpha', label: 'dup alpha', min: 0, max: 1, step: 0.02 },
        // ---- the drop box ------------------------------------------------
        // 0 = derived (a square from the piece's longest side). Set these when
        // a piece's PNG has transparent padding that makes its derived box
        // overlap a neighbour — which reads as "right spot, marked wrong".
        { path: 'boxW', label: 'box w (0=auto)', min: 0, max: 600, step: 1, suffix: 'px' },
        { path: 'boxH', label: 'box h (0=auto)', min: 0, max: 600, step: 1, suffix: 'px' },
      ],
    },
    {
      key: 'SCENE2',
      label: '2. Mirror — halves & shared',
      fields: [
        // The halves ARE the divider, so these come first.
        { path: 'sourceFillColor', label: 'source half', min: 0, max: 0xffffff, step: 1 },
        { path: 'sourceFillAlpha', label: 'source alpha', min: 0, max: 1, step: 0.02 },
        { path: 'mirrorFillColor', label: 'mirror half', min: 0, max: 0xffffff, step: 1 },
        { path: 'mirrorFillAlpha', label: 'mirror alpha', min: 0, max: 1, step: 0.02 },
        { path: 'fillBehindPortrait', label: 'wash behind art', type: 'toggle' },
        // The optional line. 0 width = the colour change is the divider.
        { path: 'lineWidth', label: 'line width', min: 0, max: 24, step: 1, suffix: 'px' },
        { path: 'lineColor', label: 'line colour', min: 0, max: 0xffffff, step: 1 },
        { path: 'lineAlpha', label: 'line alpha', min: 0, max: 1, step: 0.02 },
        { path: 'portraitAlpha', label: 'portrait alpha', min: 0, max: 1, step: 0.02 },
        // Tray + drop boxes + feedback.
        { path: 'trayY', label: 'tray y', min: 600, max: 1080, step: 1 },
        { path: 'trayGapX', label: 'tray gap', min: 40, max: 260, step: 1 },
        { path: 'trayBoxPx', label: 'tray box', min: 40, max: 240, step: 1 },
        { path: 'trayBoxInset', label: 'tray inset', min: 0, max: 60, step: 1 },
        { path: 'trayBobPx', label: 'tray bob', min: 0, max: 30, step: 1 },
        { path: 'trayBobMs', label: 'bob time', min: 200, max: 3000, step: 25, suffix: 'ms' },
        { path: 'trayDiscAlpha', label: 'disc alpha', min: 0, max: 1, step: 0.02 },
        { path: 'trayShadowAlpha', label: 'disc shadow', min: 0, max: 1, step: 0.02 },
        { path: 'dropPad', label: 'drop pad', min: 0, max: 120, step: 1 },
        { path: 'boxPadding', label: 'box padding', min: 0, max: 120, step: 1 },
        { path: 'boxSizeFrac', label: 'box size ×', min: 0.2, max: 2, step: 0.05 },
        { path: 'showBoxes', label: 'show boxes', type: 'toggle' },
        { path: 'socketSizeMul', label: 'socket size', min: 0.4, max: 3, step: 0.05 },
        { path: 'socketAlpha', label: 'socket alpha', min: 0, max: 1, step: 0.02 },
        { path: 'snapMs', label: 'snap time', min: 0, max: 600, step: 10, suffix: 'ms' },
        { path: 'landPulseScale', label: 'land pulse', min: 1, max: 1.5, step: 0.02 },
        { path: 'landPulseMs', label: 'pulse time', min: 0, max: 600, step: 10, suffix: 'ms' },
        { path: 'wrongShakeDeg', label: 'wrong shake', min: 0, max: 30, step: 1, suffix: '°' },
        { path: 'winHoldMs', label: 'win pause', min: 0, max: 3000, step: 25, suffix: 'ms' },
        { path: 'allowReplacingPlaced', label: 're-grab placed', type: 'toggle' },
        { path: 'showMirrorHints', label: 'mirror hints', type: 'toggle' },
        { path: 'bgAlpha', label: 'bg alpha', min: 0, max: 1, step: 0.02 },
        { path: 'bgOffsetX', label: 'bg offset x', min: -400, max: 400, step: 1 },
        { path: 'bgOffsetY', label: 'bg offset y', min: -400, max: 400, step: 1 },
        { path: 'bgZoom', label: 'bg zoom', min: 0.5, max: 3, step: 0.01 },
      ],
    },
    ...MIRROR_ROUNDS.map((round) => ({
      key: 'MIRROR_ROUNDS',
      label: `2. Mirror — round ${round.round}: axis`,
      fields: [
        { path: `${round.id}.axisDeg`, label: 'axis deg', min: -180, max: 180, step: 1, suffix: '°' },
        { path: `${round.id}.axisX`, label: 'axis x', min: -400, max: 1120, step: 1 },
        { path: `${round.id}.axisY`, label: 'axis y', min: -400, max: 1480, step: 1 },
        { path: `${round.id}.lineWidth`, label: 'line width', min: 0, max: 24, step: 1, suffix: 'px' },
        { path: `${round.id}.lineAlpha`, label: 'line alpha', min: 0, max: 1, step: 0.02 },
        { path: `${round.id}.glowAlpha`, label: 'glow alpha', min: 0, max: 1, step: 0.02 },
        { path: `${round.id}.glowWidthMul`, label: 'glow width', min: 1, max: 8, step: 0.1 },
      ],
    })),
    // ---- SCENE 3 — POSITIONS ---------------------------------------------
    // The portrait placements first: this is the table you spend a tuning
    // session in, moving where each object lands.
    {
      type: 'array',
      key: 'POSITION_ROUNDS',
      label: '3. Positions — where objects land',
      itemLabel: (row) => row.id,
      // Every portrait is its own round, and all four are small, so they are all
      // shown — there is no per-round filtering to get lost in.
      fields: [
        { path: 'bgScale', label: 'bg scale', min: 0, max: 3, step: 0.01 },
        { path: 'bgX', label: 'bg x', min: -400, max: 1120, step: 1 },
        { path: 'bgY', label: 'bg y', min: -400, max: 1480, step: 1 },
        // Slot A = the FIRST prompt of the portrait, slot B = the second.
        { path: 'slotAX', label: 'A x', min: -400, max: 1120, step: 1 },
        { path: 'slotAY', label: 'A y', min: -400, max: 1480, step: 1 },
        { path: 'slotAScale', label: 'A scale', min: 0, max: 3, step: 0.01 },
        { path: 'slotABoxW', label: 'A box w', min: 0, max: 600, step: 1 },
        { path: 'slotABoxH', label: 'A box h', min: 0, max: 600, step: 1 },
        { path: 'slotBX', label: 'B x', min: -400, max: 1120, step: 1 },
        { path: 'slotBY', label: 'B y', min: -400, max: 1480, step: 1 },
        { path: 'slotBScale', label: 'B scale', min: 0, max: 3, step: 0.01 },
        { path: 'slotBBoxW', label: 'B box w', min: 0, max: 600, step: 1 },
        { path: 'slotBBoxH', label: 'B box h', min: 0, max: 600, step: 1 },
      ],
    },
    {
      type: 'array',
      key: 'POSITION_PARTS',
      label: '3. Positions — objects & prompts',
      itemLabel: (row) => row.id,
      fields: [
        { path: 'x', label: 'x', min: -400, max: 1120, step: 1 },
        { path: 'y', label: 'y', min: -400, max: 1480, step: 1 },
        { path: 'scale', label: 'scale', min: 0, max: 3, step: 0.01 },
        { path: 'rotation', label: 'rotation', min: -180, max: 180, step: 1, suffix: '°' },
        { path: 'flipX', label: 'flipX (0/1)', min: 0, max: 1, step: 1 },
        { path: 'z', label: 'z', min: 0, max: 20, step: 1 },
        { path: 'alpha', label: 'alpha', min: 0, max: 1, step: 0.02 },
        { path: 'boxW', label: 'box w (0=auto)', min: 0, max: 600, step: 1 },
        { path: 'boxH', label: 'box h (0=auto)', min: 0, max: 600, step: 1 },
      ],
    },
    {
      key: 'POSITIONS',
      label: '3. Positions — shared',
      fields: [
        { path: 'bgZoom', label: 'bg zoom', min: 0.5, max: 3, step: 0.01 },
        { path: 'bgOffsetX', label: 'bg offset x', min: -400, max: 400, step: 1 },
        { path: 'bgOffsetY', label: 'bg offset y', min: -400, max: 400, step: 1 },
        { path: 'objectAlpha', label: 'object alpha', min: 0, max: 1, step: 0.02 },
        // Areas. `show targets` outlines them so the size can be judged.
        { path: 'showTargets', label: 'show areas', type: 'toggle' },
        { path: 'areaSizePx', label: 'area size', min: 60, max: 600, step: 5, suffix: 'px' },
        { path: 'dropPad', label: 'drop pad', min: 0, max: 120, step: 1 },
        { path: 'targetColor', label: 'area colour', min: 0, max: 0xffffff, step: 1 },
        { path: 'targetAlpha', label: 'area alpha', min: 0, max: 1, step: 0.02 },
        // The option circle, which sits above the prompt.
        { path: 'optionXFrac', label: 'option x', min: 0, max: 1, step: 0.005 },
        { path: 'optionY', label: 'option y', min: 300, max: 1080, step: 1 },
        { path: 'optionRadius', label: 'option radius', min: 30, max: 200, step: 1 },
        { path: 'optionDiscAlpha', label: 'option disc', min: 0, max: 1, step: 0.02 },
        { path: 'optionBoxInset', label: 'option inset', min: 0, max: 80, step: 1 },
        { path: 'optionBobPx', label: 'option bob', min: 0, max: 30, step: 1 },
        { path: 'optionBobMs', label: 'bob time', min: 200, max: 3000, step: 25, suffix: 'ms' },
        // Placing + feedback.
        { path: 'snapMs', label: 'snap time', min: 0, max: 600, step: 10, suffix: 'ms' },
        { path: 'landPulseScale', label: 'land pulse', min: 1, max: 1.5, step: 0.02 },
        { path: 'landPulseMs', label: 'pulse time', min: 0, max: 600, step: 10, suffix: 'ms' },
        { path: 'mistakeShakeDeg', label: 'mistake shake', min: 0, max: 30, step: 1, suffix: '°' },
        { path: 'wrongAreaPulseAlpha', label: 'wrong area flash', min: 0, max: 1, step: 0.02 },
        { path: 'wrongAreaPulseMs', label: 'area flash time', min: 50, max: 1000, step: 10, suffix: 'ms' },
        { path: 'nextPromptMs', label: 'next prompt', min: 0, max: 2000, step: 10, suffix: 'ms' },
        { path: 'winHoldMs', label: 'win pause', min: 0, max: 3000, step: 25, suffix: 'ms' },
        { path: 'successPopVolume', label: 'success volume', min: 0, max: 1, step: 0.02 },
        // The emphasised word in the prompt.
        { path: 'emphasisSizeMul', label: 'emph size ×', min: 1, max: 2.5, step: 0.05 },
        { path: 'emphasisStrokeThickness', label: 'emph outline', min: 0, max: 12, step: 1, suffix: 'px' },
      ],
    },
    // ---- SCENE 4 — THE BUILDING ------------------------------------------
    {
      key: 'BUILDING',
      label: '4. Building — wall & rooms',
      fields: [
        // The wall.
        { path: 'wallWidth', label: 'wall width', min: 150, max: 720, step: 1, suffix: 'px' },
        { path: 'wallRightInset', label: 'wall inset', min: -200, max: 300, step: 1, suffix: 'px' },
        { path: 'wallAlpha', label: 'wall alpha', min: 0, max: 1, step: 0.02 },
        // The rooms.
        { path: 'roomCentreXFrac', label: 'rooms x', min: 0, max: 1, step: 0.002 },
        { path: 'roomWidth', label: 'room width', min: 100, max: 720, step: 1, suffix: 'px' },
        { path: 'roomGap', label: 'room gap', min: 0, max: 80, step: 1, suffix: 'px' },
        // The stack is anchored at the BOTTOM: this is the ground floor's height
        // above the wall's base.
        { path: 'groundRoomBottomGapPx', label: 'ground gap', min: 0, max: 400, step: 5, suffix: 'px' },
        { path: 'shuffleRooms', label: 'shuffle rooms', type: 'toggle' },
        { path: 'roomAlpha', label: 'room alpha', min: 0, max: 1, step: 0.02 },
        // The caps above the top room and below the ground floor.
        { path: 'wallTopPadPx', label: 'top pad', min: 0, max: 600, step: 5, suffix: 'px' },
        // Scrolling.
        { path: 'startScrollPx', label: 'start scroll', min: 0, max: 4000, step: 5, suffix: 'px' },
        { path: 'scrollSwipe', label: 'swipe', type: 'toggle' },
        { path: 'scrollWheel', label: 'wheel', type: 'toggle' },
        { path: 'scrollSensitivity', label: 'swipe ÷', min: 0.2, max: 3, step: 0.05 },
        { path: 'momentum', label: 'momentum', min: 0, max: 1, step: 0.01 },
        { path: 'clampScroll', label: 'clamp ends', type: 'toggle' },
        // 0 at the bottom keeps the end wall flush with the screen edge.
        { path: 'scrollTopInsetFrac', label: 'top inset', min: 0, max: 0.3, step: 0.005 },
        { path: 'scrollBottomInsetFrac', label: 'bottom inset', min: 0, max: 0.3, step: 0.005 },
        // Acceleration ramps the target toward the finger; 0 = snap, 1 = sluggish.
        { path: 'scrollAccel', label: 'acceleration', min: 0, max: 0.9, step: 0.02 },
        { path: 'scrollSmoothing', label: 'smoothing', min: 0, max: 0.9, step: 0.02 },
        { path: 'scrollEaseOut', label: 'ease out', min: 0, max: 0.5, step: 0.01 },
        // Distance multiplier: >1 makes the same swipe travel further.
        { path: 'scrollGain', label: 'speed ×', min: 0.5, max: 4, step: 0.05 },
        // Look.
        { path: 'buildingShadowAlpha', label: 'shadow alpha', min: 0, max: 1, step: 0.02 },
        { path: 'buildingShadowOffsetPx', label: 'shadow offset', min: 0, max: 40, step: 1 },
        // The gap between floors, filled with a brown band.
        { path: 'gapFill', label: 'gap band', type: 'toggle' },
        { path: 'gapFillAlpha', label: 'band alpha', min: 0, max: 1, step: 0.02 },
        { path: 'gapFillWidthFrac', label: 'band width ×', min: 0.2, max: 1.6, step: 0.02 },
        { path: 'gapFillPadPx', label: 'band pad', min: 0, max: 20, step: 1, suffix: 'px' },
        { path: 'gapFillEdgeWidth', label: 'band edge', min: 0, max: 12, step: 1, suffix: 'px' },
        { path: 'showFloorLines', label: 'floor lines', type: 'toggle' },
        { path: 'floorLineAlpha', label: 'line alpha', min: 0, max: 1, step: 0.02 },
        { path: 'floorLineWidth', label: 'line width', min: 1, max: 12, step: 1 },
        // Floor numbers.
        { path: 'showFloorNumbers', label: 'floor numbers', type: 'toggle' },
        { path: 'floorNumberFontSize', label: 'number size', min: 12, max: 160, step: 1, suffix: 'px' },
        { path: 'floorNumberStrokeThickness', label: 'number outline', min: 0, max: 20, step: 1, suffix: 'px' },
        { path: 'floorNumberAlpha', label: 'number alpha', min: 0, max: 1, step: 0.02 },
        // The plate behind each number.
        { path: 'floorNumberBox', label: 'number box', type: 'toggle' },
        { path: 'floorNumberBoxAlpha', label: 'box alpha', min: 0, max: 1, step: 0.02 },
        { path: 'floorNumberBoxPadPx', label: 'box pad', min: 0, max: 60, step: 1, suffix: 'px' },
        { path: 'floorNumberBoxRadius', label: 'box corner', min: 0, max: 60, step: 1 },
        { path: 'floorNumberBoxBorderWidth', label: 'box border', min: 0, max: 12, step: 1, suffix: 'px' },
        // 0 = every plate takes the width of the WIDEST digit, so they match.
        { path: 'floorNumberBoxWidthPx', label: 'box width (0=auto)', min: 0, max: 300, step: 1, suffix: 'px' },
      ],
    },
    // ---- SCENE 4 — THE QUESTION ------------------------------------------
    {
      key: 'BUILDING',
      label: '4. Building — question & options',
      fields: [
        { path: 'roundsPerRun', label: 'rounds', min: 1, max: 10, step: 1 },
        { path: 'optionCount', label: 'options', min: 2, max: 6, step: 1 },
        // The option row along the bottom.
        { path: 'optionYFrac', label: 'options y', min: 0.3, max: 1, step: 0.005 },
        { path: 'optionStepFrac', label: 'options gap', min: 0.1, max: 0.4, step: 0.005 },
        { path: 'optionRadius', label: 'disc radius', min: 30, max: 160, step: 1, suffix: 'px' },
        { path: 'optionDiscAlpha', label: 'disc alpha', min: 0, max: 1, step: 0.02 },
        { path: 'optionDiscStrokeWidth', label: 'disc outline', min: 0, max: 16, step: 1, suffix: 'px' },
        { path: 'optionSpriteFrac', label: 'animal size', min: 0.3, max: 1.1, step: 0.01 },
        { path: 'optionShadowAlpha', label: 'disc shadow', min: 0, max: 1, step: 0.02 },
        { path: 'optionPressScale', label: 'press scale', min: 1, max: 1.4, step: 0.01 },
        { path: 'optionBobPx', label: 'disc bob', min: 0, max: 30, step: 1, suffix: 'px' },
        { path: 'optionBobMs', label: 'bob time', min: 200, max: 4000, step: 25, suffix: 'ms' },
        { path: 'optionHitPad', label: 'tap pad ×', min: 1, max: 2, step: 0.05 },
        // Feedback.
        { path: 'highlightFloor', label: 'outline the floor', type: 'toggle' },
        { path: 'floorHighlightAlpha', label: 'floor outline', min: 0, max: 1, step: 0.02 },
        { path: 'floorHighlightWidth', label: 'outline width', min: 0, max: 24, step: 1, suffix: 'px' },
        { path: 'correctFlashAlpha', label: 'right flash', min: 0, max: 1, step: 0.02 },
        { path: 'correctFlashMs', label: 'right fade', min: 0, max: 800, step: 10, suffix: 'ms' },
        { path: 'correctPopMs', label: 'right pop', min: 0, max: 800, step: 10, suffix: 'ms' },
        { path: 'successVolume', label: 'right volume', min: 0, max: 1, step: 0.02 },
        { path: 'nextPromptMs', label: 'next question', min: 0, max: 3000, step: 10, suffix: 'ms' },
        { path: 'wrongFlashAlpha', label: 'wrong flash', min: 0, max: 1, step: 0.02 },
        { path: 'wrongFlashMs', label: 'wrong fade', min: 0, max: 800, step: 10, suffix: 'ms' },
        { path: 'wrongShakeDeg', label: 'wrong wobble', min: 0, max: 30, step: 1, suffix: '°' },
        { path: 'wrongVolume', label: 'wrong volume', min: 0, max: 1, step: 0.02 },
        { path: 'winHoldMs', label: 'win pause', min: 0, max: 4000, step: 25, suffix: 'ms' },
        // The emphasised ordinal.
        { path: 'emphasisSizeMul', label: 'emph size ×', min: 1, max: 2.5, step: 0.05 },
        { path: 'emphasisStrokeThickness', label: 'emph outline', min: 0, max: 12, step: 1, suffix: 'px' },
      ],
    },
    {
      type: 'array',
      key: 'BUILDING_ROOMS',
      label: '4. Building — rooms (top floor first)',
      itemLabel: (row) => row.id,
      // ONE ROW PER ROOM, in building order. `id` and `textureKey` are identity
      // and art, so they are shown for reference rather than as sliders.
      fields: [
        { path: 'name', label: 'name', min: 0, max: 0, step: 1 },
      ],
    },
    {
      key: 'SCENE1',
      label: '1. Shapes — factory & belt',
      fields: [
        { path: 'bgAlpha', label: 'bg alpha', min: 0, max: 1, step: 0.02 },
        { path: 'bgOffsetXFrac', label: 'bg x nudge', min: -0.3, max: 0.3, step: 0.005 },
        { path: 'bgOffsetYFrac', label: 'bg y nudge', min: -0.3, max: 0.3, step: 0.005 },
        { path: 'beltYFrac', label: 'belt y', min: 0, max: 1, step: 0.005 },
        { path: 'beltHeightFrac', label: 'belt height', min: 0.02, max: 0.5, step: 0.005 },
        { path: 'beltAlpha', label: 'belt alpha', min: 0, max: 1, step: 0.02 },
        { path: 'charHeightFrac', label: 'robot height', min: 0.05, max: 0.6, step: 0.005 },
        { path: 'charXFrac', label: 'robot x', min: 0, max: 1, step: 0.005 },
        { path: 'charBeltGapFrac', label: 'robot gap', min: -0.1, max: 0.15, step: 0.002 },
        { path: 'rollFps', label: 'roll fps', min: 5, max: 60, step: 1 },
        { path: 'slotSpinMs', label: 'spin time', min: 300, max: 8000, step: 50, suffix: 'ms' },
        { path: 'optionRowYFrac', label: 'options y', min: 0, max: 1, step: 0.005 },
        { path: 'optionSizeFrac', label: 'option size', min: 0.04, max: 0.24, step: 0.002 },
        { path: 'sendOffSpeed', label: 'send-off', min: 60, max: 1400, step: 10, suffix: 'px/s' },
      ],
    },
    // ONE GROUP PER SCENE. Generated from the registry, so five scenes means
    // five groups with no hand-written schema per scene.
    ...SCENES.map((scene) => ({
      key: 'SCENES',
      label: `${scene.number}. ${scene.title}`,
      fields: [
        { path: `${scene.id}.playTopFrac`, label: 'play top', min: 0, max: 1, step: 0.005 },
        { path: `${scene.id}.playBottomFrac`, label: 'play bottom', min: 0, max: 1, step: 0.005 },
        { path: `${scene.id}.objectHeightFrac`, label: 'obj height', min: 0.02, max: 0.6, step: 0.005 },
        { path: `${scene.id}.sideInsetFrac`, label: 'side inset', min: 0, max: 0.4, step: 0.005 },
        { path: `${scene.id}.slots`, label: 'slots', min: 2, max: 6, step: 1 },
        // Where THIS scene's prompt sits. -1 = the shared HUD position, which is
        // what every scene except 3 uses.
        { path: `${scene.id}.promptYFrac`, label: 'prompt y', min: -1, max: 1, step: 0.005 },
        // -1 x = centred on the canvas midline. Anything else pins the LEFT edge
        // of a text column, which is what scene 3 does to sit beside its disc.
        { path: `${scene.id}.promptXFrac`, label: 'prompt x', min: -1, max: 1, step: 0.005 },
        { path: `${scene.id}.promptWrapFrac`, label: 'prompt wrap', min: -1, max: 1, step: 0.005 },
        // The full-width band behind the prompt. 0 height = none.
        { path: `${scene.id}.promptBandHeight`, label: 'prompt band', min: 0, max: 400, step: 1, suffix: 'px' },
        { path: `${scene.id}.promptBandAlpha`, label: 'band alpha', min: 0, max: 1, step: 0.02 },
        { path: `${scene.id}.promptBandEdgeWidth`, label: 'band edge', min: 0, max: 16, step: 1, suffix: 'px' },
      ],
    })),
  ],
};

// Re-exported so the scene can read the canvas size from the tuning module
// rather than reaching into the geometry module for a layout constant.
export { CANVAS };
