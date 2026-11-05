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

// ---------------------------------------------------------------------------
// VOICE — the prompt read-aloud and its "say it again" button
// ---------------------------------------------------------------------------
// The WORDS and the audio URLs live in prompts.js, because that is the file a
// human edits. Everything adjustable about how they are PRESENTED lives here.
export const VOICE = {
  promptVolume: 0.9,
  buttonIcon: '🔊',
  buttonFontSize: 22,
  buttonMinSize: 46,
  buttonDepth: 26,
  buttonInsetX: 18,
  buttonInsetY: 18,
  glowScale: 1.12,
  glowMs: 460,
};

// Per-game local-dev switch for the tuning editor. Production folds it away
// regardless, via import.meta.env.DEV in @/devTuning/panel.js.
export const DEV_TUNING_ENABLED = true;

// ---------------------------------------------------------------------------
// ENGINE — run-wide numbers
// ---------------------------------------------------------------------------
export const ENGINE = {
  transitionMs: 320,
  crossfade: 0.5,
  devChrome: true,
  wipeMs: 520,
  wipeHoldMs: 900,
  // THE WIPE'S COLOUR.
  //
  // It has been two wrong things already: 0x000000 (pure black, a dead screen
  // between two brightly coloured mini-games) and then a deep backdrop blue,
  // which was merely less wrong — still a dark flash against the pastel scenes.
  //
  // BRIGHT PASTEL AQUA-MINT now. It matches the world the scenes actually are
  // (soft pastel art, saturated accents), and it is a LIFT rather than a cut, so
  // the handover reads as a page turning. Deliberately cooler than scene 4's
  // warm cream prompt band and lighter than every scene's saturated accent, so
  // the panel never looks like a piece of either.
  //
  // `null` would fall back to the outgoing scene's registry accent, which is also
  // reasonable (each handover takes the colour of the scene it is leaving). A
  // colour here wins over that.
  wipeColor: 0xc8f0e4,
  // FALLBACKS, for a direct `runWipe` call that passes neither a colour nor a
  // title colour. Kept in step with the two values above so that path can never
  // produce a dark panel with an invisible title on it.
  wipeFallbackColor: 0xc8f0e4,
  wipeTitleFallbackColor: '#14503f',
  wipeOverscanPx: 40,
  wipeTitle: true,
  wipeTitleFontSize: 52,
  // DARK TEAL, not near-white.
  //
  // The title colour is not a free choice: it is fixed by the panel it sits on.
  // On the pastel it needs to be DARK — this pair measures ~7.6:1 contrast,
  // comfortably past the 4.5:1 body-text threshold, so the scene name stays
  // readable at a glance from across a classroom.
  wipeTitleColor: '#14503f',
  wipeTitleHoldScale: 1.06,
  // THE WHOOSH UNDER THE WIPE.
  //
  // Two clips, because a whoosh that runs the same way twice reads as two
  // separate sounds rather than one movement: the in-sweep gets the recording
  // forward, the out-sweep gets a pre-reversed copy. See assets.js for why this
  // cannot be done with a negative playback rate.
  //
  // `wipeWhooshVolume: 0` mutes the transition without touching the game's sfx,
  // and `wipeWhoosh` false skips the clips entirely (useful when tuning the
  // visual timing in silence).
  wipeWhoosh: true,
  wipeWhooshVolume: 0.55,
  // Playback rates. The clip is 0.67 s and the sweeps are `wipeMs` (520 ms) each,
  // so 1.0 is already close to a match. Slightly slower on the way in (0.92) so
  // the sound does not finish before the panel has crossed, and slightly faster
  // on the way out (1.05) so the reverse does not lag behind the reveal.
  wipeWhooshRateIn: 0.92,
  wipeWhooshRateOut: 1.05,
  sceneConfetti: 30,
  finishConfetti: 52,
  confettiMs: 1900,
  confettiGravityY: 330,
  confettiSpeedMin: 240,
  confettiSpeedMax: 620,
  confettiSpreadDeg: 78,
  confettiMaxLive: 90,
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
  wrongParkAlpha: 0.65,
  dropZoneColor: 0xffffff,
  dropZoneAlpha: 0.18,
  dropZoneRadiusFrac: 0.1,
  dropZonePulseAlpha: 0.25,
  dropZonePulseMs: 900,
  dropZoneOccupiedAlpha: 0.4,
  dropZoneRingWidth: 3,
  dropZoneFitMul: 1.5,
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
  emphasisSizeMul: 1.45,
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
  wallWidth: 720,
  wallRightInset: 0,
  roomCentreXFrac: 0.631,
  roomRightInsetFrac: 0.022,
  roomWidth: 500,
  roomGap: 10,
  groundRoomBottomGapPx: 80,
  startScrollPx: 0,
  wallTopPadPx: 120,
  scrollSwipe: true,
  scrollWheel: true,
  scrollSensitivity: 1,
  momentum: 0.92,
  momentumMinPx: 12,
  clampScroll: true,
  scrollTopInsetFrac: 0.1,
  scrollBottomInsetFrac: 0,
  scrollFriction: 2.6,
  scrollMaxVelocity: 4200,
  scrollStopSpeed: 14,
  scrollGain: 1.6,
  scrollDragThresholdPx: 10,
  scrollVelocitySamples: 5,
  scrollReleaseIdleMs: 60,
  wallAlpha: 1,
  roomAlpha: 1,
  buildingShadowAlpha: 0.22,
  buildingShadowOffsetPx: 10,
  showFloorLines: false,
  floorLineColor: 0xffffff,
  floorLineAlpha: 0.25,
  floorLineWidth: 3,
  gapFill: true,
  gapFillColor: 0x6b4423,
  gapFillAlpha: 1,
  gapFillWidthFrac: 1,
  gapFillPadPx: 2,
  gapFillEdgeColor: 0x4a2f18,
  gapFillEdgeWidth: 2,
  showFloorNumbers: true,
  floorNumberFontSize: 76,
  floorNumberColor: '#fde68a',
  floorNumberStrokeColor: '#7c2d12',
  floorNumberStrokeThickness: 8,
  floorNumberAlpha: 1,
  shuffleRooms: false,
  floorNumberBox: true,
  floorNumberBoxColor: 0xffffff,
  floorNumberBoxAlpha: 0.92,
  floorNumberBoxPadPx: 14,
  floorNumberBoxRadius: 14,
  floorNumberBoxBorderColor: 0x8b5e34,
  floorNumberBoxBorderWidth: 3,
  floorNumberBoxWidthPx: 0,
  roundsPerRun: 5,
  optionCount: 3,
  optionYFrac: 0.885,
  optionStepFrac: 0.285,
  optionRadius: 86,
  optionDiscColor: 0xffffff,
  optionDiscAlpha: 0.9,
  optionDiscStrokeWidth: 6,
  optionDiscStrokeColor: 0xfbbf24,
  optionDiscStrokeAlpha: 1,
  optionSpriteFrac: 0.78,
  optionShadowDy: 6,
  optionShadowAlpha: 0.54,
  optionPressScale: 1.08,
  optionPressMs: 90,
  optionBobPx: 5,
  optionBobMs: 1400,
  optionHitPad: 1.25,
  optionShelfHeight: 0,
  optionShelfColor: 0x6b4423,
  optionShelfAlpha: 0.94,
  optionShelfEdgeColor: 0xd2b48c,
  optionShelfEdgeWidth: 5,
  tapMaxMs: 700,
  highlightFloor: true,
  floorHighlightColor: 0xfbbf24,
  floorHighlightAlpha: 0.4,
  floorHighlightWidth: 6,
  correctFlashColor: 0x22c55e,
  correctFlashAlpha: 0.22,
  correctFlashMs: 160,
  correctFlashHoldMs: 120,
  correctPopScale: 1.16,
  correctPopMs: 180,
  successSound: 'pop2',
  successVolume: 0.85,
  nextPromptMs: 620,
  wrongFlashColor: 0xef4444,
  wrongFlashAlpha: 0.34,
  wrongFlashMs: 150,
  wrongFlashHoldMs: 190,
  wrongShakeDeg: 8,
  wrongWobbleMs: 70,
  wrongWobbleRepeats: 2,
  wrongSound: 'wrong',
  wrongVolume: 0.6,
  wrongLockMs: 420,
  winHoldMs: 1000,
  emphasisSizeMul: 1.45,
  emphasisColor: '#b45309',
  emphasisStrokeColor: '#fff7ed',
  emphasisStrokeThickness: 0,
};

// ---------------------------------------------------------------------------
// THE END SCREEN
// ---------------------------------------------------------------------------
// Shown once the whole run is over. A replay button is the one thing a finished
// run genuinely needs: a child who has just completed a game wants to play it
// again, and the alternative is backing out and finding it in the catalogue.
export const END_SCREEN = {
  scrimColor: 0x0b1220,
  scrimAlpha: 0.62,
  panelWidthFrac: 0.82,
  panelMaxWidth: 560,
  panelHeightFrac: 0.46,
  panelColor: 0xffffff,
  panelBorderColor: 0xf59e0b,
  panelBorderWidth: 6,
  panelRadius: 32,
  popMs: 380,
  titleText: 'Mission Complete!',
  titleColor: '#3b2f1e',
  titleFontSize: 44,
  titleYOffsetFrac: -0.26,
  starSize: 54,
  starGapPx: 18,
  starColor: 0xfbbf24,
  starEmptyColor: 0xe5e7eb,
  starYOffsetFrac: -0.04,
  starPopMs: 240,
  starStaggerMs: 110,
  summaryFontSize: 26,
  summaryColor: '#6b4423',
  summaryYOffsetFrac: 0.13,
  buttonLabel: 'Play Again',
  buttonFontSize: 28,
  buttonYOffsetFrac: 0.31,
  buttonBgColor: 0xf59e0b,
  buttonTextColor: '#ffffff',
  buttonPaddingX: 36,
  buttonPaddingY: 16,
  confettiCount: 40,
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
  {
    id: 'cat',
    textureKey: 'roomCat',
    optionKey: 'optionCat',
    name: '0',
  },
  {
    id: 'elephant',
    textureKey: 'roomElephant',
    optionKey: 'optionElephant',
    name: 'elephant',
  },
  {
    id: 'cow',
    textureKey: 'roomCow',
    optionKey: 'optionCow',
    name: 'cow',
  },
  {
    id: 'lion',
    textureKey: 'roomLion',
    optionKey: 'optionLion',
    name: 'lion',
  },
  {
    id: 'fish',
    textureKey: 'roomFish',
    optionKey: 'optionFish',
    name: 'fish',
  },
  {
    id: 'dog',
    textureKey: 'roomDog',
    optionKey: 'optionDog',
    name: 'dog',
  },
  {
    id: 'penguin',
    textureKey: 'roomPenguin',
    optionKey: 'optionPenguin',
    name: 'penguin',
  },
  {
    id: 'giraffe',
    textureKey: 'roomGirrafe',
    optionKey: 'optionGirrafe',
    name: 'giraffe',
  },
  {
    id: 'sheep',
    textureKey: 'roomSheep',
    optionKey: 'optionSheep',
    name: 'sheep',
  },
  {
    id: 'frog',
    textureKey: 'roomFrog',
    optionKey: 'optionFrog',
    name: 'frog',
  },
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
  // PALE SAND. The band sits against brickwork of a similar tone, so the darker
  // tan blended into the wall and the panel did not read as its own surface.
  promptBandColor: 0xe8d5b7,
  promptBandAlpha: 0.97,
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
  // positions
  positions: {
    promptYFrac: 0.87,
    promptXFrac: 0.38,
    promptWrapFrac: 0.58,
    promptAlign: 'center',
    promptBandHeight: 0,
    promptBandColor: 0xe8d5b7,
    promptBandAlpha: 0.97,
    promptBandEdgeColor: 0x8b5e34,
    promptBandEdgeWidth: 0,
    promptStrokeThickness: -1,
  },
  // building
  building: {
    promptYFrac: 0.089,
    promptXFrac: -1,
    promptWrapFrac: 0.94,
    promptAlign: 'center',
    promptBandHeight: 150,
    // LIGHTER than the shared default, on purpose: at 0xd2b48c the band sat only a
    // shade off the brickwork behind it, so it read as part of the wall rather than
    // as a panel. A pale sand separates cleanly while keeping the dark brown type
    // legible on it.
    promptBandColor: 0xe8d5b7,
    promptBandAlpha: 0.97,
    promptBandEdgeColor: 0x8b5e34,
    promptBandEdgeWidth: 4,
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
  VOICE,
  END_SCREEN,
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
export const getVoice = () => TUNING.get('VOICE');
export const getEndScreen = () => TUNING.get('END_SCREEN');
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

// ENGINE is emitted from ONE ordered key list, not hand-written lines.
//
// It was hand-written until the celebration and transition values landed in it —
// at which point a paste silently dropped twelve tunables back to whatever the
// source file happened to say. A key list cannot do that: a key that is not
// listed is a visible omission here rather than an invisible default at runtime.
const VOICE_FIELDS = [
  ['promptVolume', 'n'],
  ['buttonIcon', 's'], ['buttonFontSize', 'n'], ['buttonMinSize', 'n'],
  ['buttonDepth', 'n'], ['buttonInsetX', 'n'], ['buttonInsetY', 'n'],
  ['glowScale', 'n'], ['glowMs', 'n'],
];

function renderVoice(v) {
  const lines = ['export const VOICE = {'];
  VOICE_FIELDS.forEach(([key, kind]) => lines.push(field(key, scalar(kind, v[key]))));
  lines.push('};');
  return lines.join('\n');
}

const ENGINE_FIELDS = [
  ['transitionMs', 'n'], ['crossfade', 'n'], ['devChrome', 'b'],
  // The scene-change wipe.
  ['wipeMs', 'n'], ['wipeHoldMs', 'n'], ['wipeColor', 'h'],
  ['wipeFallbackColor', 'h'], ['wipeOverscanPx', 'n'],
  ['wipeTitle', 'b'], ['wipeTitleFontSize', 'n'], ['wipeTitleColor', 's'],
  ['wipeTitleFallbackColor', 's'], ['wipeTitleHoldScale', 'n'],
  // The whoosh under it.
  ['wipeWhoosh', 'b'], ['wipeWhooshVolume', 'n'],
  ['wipeWhooshRateIn', 'n'], ['wipeWhooshRateOut', 'n'],
  // Celebration.
  ['sceneConfetti', 'n'], ['finishConfetti', 'n'], ['confettiMs', 'n'],
  ['confettiGravityY', 'n'], ['confettiSpeedMin', 'n'], ['confettiSpeedMax', 'n'],
  ['confettiSpreadDeg', 'n'], ['confettiMaxLive', 'n'],
];

function renderEngine(v) {
  const lines = ['export const ENGINE = {'];
  ENGINE_FIELDS.forEach(([key, kind]) => lines.push(field(key, scalar(kind, v[key]))));
  lines.push('};');
  return lines.join('\n');
}

// The end screen is a long but flat block, emitted from one ordered key list for
// the same reason SCENE1 is — every field is either a number, a colour or a
// string, so a hand-written line per field would only drift.
const END_SCREEN_FIELDS = [
  ['scrimColor', 'h'], ['scrimAlpha', 'n'],
  ['panelWidthFrac', 'n'], ['panelMaxWidth', 'n'], ['panelHeightFrac', 'n'],
  ['panelColor', 'h'], ['panelBorderColor', 'h'], ['panelBorderWidth', 'n'],
  ['panelRadius', 'n'], ['popMs', 'n'],
  ['titleText', 's'], ['titleColor', 's'], ['titleFontSize', 'n'],
  ['titleYOffsetFrac', 'n'],
  ['starSize', 'n'], ['starGapPx', 'n'], ['starColor', 'h'],
  ['starEmptyColor', 'h'], ['starYOffsetFrac', 'n'],
  ['starPopMs', 'n'], ['starStaggerMs', 'n'],
  ['summaryFontSize', 'n'], ['summaryColor', 's'], ['summaryYOffsetFrac', 'n'],
  ['buttonLabel', 's'], ['buttonFontSize', 'n'], ['buttonYOffsetFrac', 'n'],
  ['buttonBgColor', 'h'], ['buttonTextColor', 's'],
  ['buttonPaddingX', 'n'], ['buttonPaddingY', 'n'],
  ['confettiCount', 'n'],
];

function renderEndScreen(v) {
  const lines = ['export const END_SCREEN = {'];
  END_SCREEN_FIELDS.forEach(([key, kind]) => lines.push(field(key, scalar(kind, v[key]))));
  lines.push('};');
  return lines.join('\n');
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
  ['dropXFrac', 'n'], ['parkSpreadFrac', 'n'], ['wrongParkAlpha', 'n'],
  ['dropZoneColor', 'h'], ['dropZoneAlpha', 'n'], ['dropZoneRadiusFrac', 'n'],
  ['dropZonePulseAlpha', 'n'], ['dropZonePulseMs', 'n'],
  ['dropZoneOccupiedAlpha', 'n'], ['dropZoneRingWidth', 'n'],
  ['dropZoneFitMul', 'n'],
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
  ['scrollFriction', 'n'], ['scrollMaxVelocity', 'n'], ['scrollStopSpeed', 'n'],
  ['scrollGain', 'n'], ['scrollDragThresholdPx', 'n'], ['scrollVelocitySamples', 'n'],
  ['scrollReleaseIdleMs', 'n'],
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
  ['optionShelfEdgeWidth', 'n'], ['tapMaxMs', 'n'],
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
  out = replaceBlock(out, 'export const VOICE = {', renderVoice(getVoice()));
  out = replaceBlock(out, 'export const END_SCREEN = {', renderEndScreen(getEndScreen()));
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
      label: 'Engine · transition & celebration',
      fields: [
        // THE SCENE CHANGE. 0 on `wipe` turns it off and falls back to a cut.
        { path: 'wipeMs', label: 'wipe sweep', min: 0, max: 900, step: 10, suffix: 'ms' },
        // The beat where the screen STOPS — this is the one that makes the scene
        // name readable. 0 sweeps straight back out.
        { path: 'wipeHoldMs', label: 'wipe hold', min: 0, max: 3000, step: 25, suffix: 'ms' },
        { path: 'wipeTitle', label: 'wipe title', type: 'toggle' },
        { path: 'wipeTitleFontSize', label: 'wipe title size', min: 16, max: 96, step: 1, suffix: 'px' },
        { path: 'wipeTitleHoldScale', label: 'title settle ×', min: 1, max: 1.4, step: 0.01 },
        // THE WHOOSH. `rate in` / `rate out` retime the clip against the sweeps:
        // lower is slower and deeper, higher is quicker and tighter.
        { path: 'wipeWhoosh', label: 'wipe whoosh', type: 'toggle' },
        { path: 'wipeWhooshVolume', label: 'whoosh volume', min: 0, max: 1, step: 0.01 },
        { path: 'wipeWhooshRateIn', label: 'whoosh in ×', min: 0.5, max: 2, step: 0.01 },
        { path: 'wipeWhooshRateOut', label: 'whoosh out ×', min: 0.5, max: 2, step: 0.01 },
        // CONFETTI. `max live` is the hard population cap, so a burst cannot grow
        // the particle count past it however fast the scenes go by.
        { path: 'sceneConfetti', label: 'scene confetti', min: 0, max: 120, step: 1 },
        { path: 'finishConfetti', label: 'finish confetti', min: 0, max: 200, step: 1 },
        { path: 'confettiMaxLive', label: 'confetti cap', min: 10, max: 400, step: 5 },
        { path: 'confettiMs', label: 'confetti life', min: 300, max: 4000, step: 50, suffix: 'ms' },
        { path: 'confettiSpreadDeg', label: 'confetti spread', min: 5, max: 89, step: 1, suffix: '°' },
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
        // THE FLING, as real physics: `friction` is how fast a released flick
        // slows down (higher stops sooner), and `max speed` caps a violent swipe.
        { path: 'scrollFriction', label: 'friction', min: 0.5, max: 10, step: 0.1 },
        { path: 'scrollMaxVelocity', label: 'max speed', min: 500, max: 9000, step: 100, suffix: 'px/s' },
        { path: 'scrollStopSpeed', label: 'stop below', min: 0, max: 200, step: 2, suffix: 'px/s' },
        // Distance multiplier: >1 makes the same swipe travel further.
        { path: 'scrollGain', label: 'speed ×', min: 0.5, max: 4, step: 0.05 },
        // A gesture must travel this far before it counts as a SCROLL. Below it
        // the touch stays a TAP, which is what keeps the options from firing.
        { path: 'scrollDragThresholdPx', label: 'drag starts', min: 2, max: 60, step: 1, suffix: 'px' },
        { path: 'scrollReleaseIdleMs', label: 'fling idle', min: 0, max: 300, step: 5, suffix: 'ms' },
        { path: 'tapMaxMs', label: 'tap max hold', min: 100, max: 3000, step: 25, suffix: 'ms' },
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
    // THE PROMPT VOICE. The WORDS and the audio URLs live in prompts.js — this
    // group only shapes how they are PRESENTED.
    {
      key: 'VOICE',
      label: 'Prompt voice & replay button',
      fields: [
        { path: 'promptVolume', label: 'voice volume', min: 0, max: 1, step: 0.02 },
        { path: 'buttonFontSize', label: 'button icon size', min: 10, max: 48, step: 1, suffix: 'px' },
        { path: 'buttonMinSize', label: 'button size', min: 24, max: 96, step: 1, suffix: 'px' },
        { path: 'buttonInsetX', label: 'button x', min: 0, max: 200, step: 1, suffix: 'px' },
        { path: 'buttonInsetY', label: 'button y', min: 0, max: 200, step: 1, suffix: 'px' },
        // The glow while a line is playing: a scale pulse on the button alone.
        { path: 'glowScale', label: 'glow scale', min: 1, max: 1.5, step: 0.01 },
        { path: 'glowMs', label: 'glow speed', min: 100, max: 2000, step: 20, suffix: 'ms' },
      ],
    },
    // THE END SCREEN. Only the things worth adjusting by eye — the panel's shape
    // and the button it has to hold.
    {
      key: 'END_SCREEN',
      label: 'End screen',
      fields: [
        { path: 'panelWidthFrac', label: 'panel width', min: 0.4, max: 1, step: 0.01 },
        { path: 'panelHeightFrac', label: 'panel height', min: 0.2, max: 0.9, step: 0.01 },
        { path: 'panelRadius', label: 'corner', min: 0, max: 80, step: 1 },
        { path: 'titleFontSize', label: 'title size', min: 16, max: 80, step: 1, suffix: 'px' },
        { path: 'starSize', label: 'star size', min: 16, max: 120, step: 1, suffix: 'px' },
        { path: 'starGapPx', label: 'star gap', min: 0, max: 80, step: 1, suffix: 'px' },
        { path: 'starStaggerMs', label: 'star stagger', min: 0, max: 600, step: 10, suffix: 'ms' },
        { path: 'summaryFontSize', label: 'summary size', min: 12, max: 60, step: 1, suffix: 'px' },
        { path: 'buttonFontSize', label: 'button size', min: 12, max: 60, step: 1, suffix: 'px' },
        { path: 'scrimAlpha', label: 'scrim alpha', min: 0, max: 1, step: 0.02 },
        { path: 'confettiCount', label: 'confetti', min: 0, max: 120, step: 1 },
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
