// tuning.js
// Game 16 — THE TUNING FILE, wired to the shared live-tuning kit.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS SHAPED LIKE THIS
// ---------------------------------------------------------------------------
// Game 16 is FIVE mini-games in one run (see scenes.js). That makes tuning
// harder than for a single-mechanic game in three specific ways, and each is
// handled here:
//
//   1. NUMBERS COLLIDE. Five scenes all want a "promptY" and an "objectScale".
//      Flat tables would force names like SHAPES_PROMPT_Y. Instead there is one
//      nested block PER SCENE under SCENES, keyed by scene id, and the panel
//      shows each as its own group. A slider is never ambiguous.
//
//   2. GETTING TO A SCENE IS THE BOTTLENECK. Tuning scene 5 by playing to round
//      13 is unusable. `TUNING_SCHEMA.nav = true` plus the hub's setNav() gives
//      the panel «  ◀  2/5 mirror · round 2/3  ▶  » to jump straight there.
//
//   3. ONE MECHANIC MUST NOT LOSE THE OTHERS. Because the panel can relayout the
//      live scene (setRelayout), dragging a slider moves what is on screen
//      instead of rebuilding it — so tuning does not reset the round.
//
// Coordinates are INTERNAL pixels on the 720x1080 canvas (DEFAULT_BASE_RESOLUTION
// in @/phaser/config). Anything named `...Frac` is 0..1 of the canvas, which is
// what the scene helpers use so a layout survives a different resolution.
//
// Nothing here is stateful. Edit a number and save: Vite hot-reloads this module,
// the kit re-publishes the tables, and the running scene picks them up.

import { createTuning } from '@/devTuning/core';
import { SCENES } from '@/games/game-16/scenes';

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

// Per-game local-dev switch for the tuning editor. Separate from the kit's own
// TUNING_DEV_ENABLED so this game can go player-facing while the editor stays
// wired for others. Production folds it away regardless.
export const DEV_TUNING_ENABLED = true;

// ---------------------------------------------------------------------------
// ENGINE — run-wide numbers
// ---------------------------------------------------------------------------
export const ENGINE = {
  // How long the scene-to-scene handover takes. A short dip keeps the run
  // feeling continuous; 0 makes it a hard cut.
  transitionMs: 320,

  // Fade the outgoing scene out and the incoming one in over this fraction of
  // transitionMs, so the two overlap in the middle instead of one following the
  // other. 0.5 = crossfade.
  crossfade: 0.5,

  // Dev-only: draw the placeholder frame, ids and per-scene accent. Folded away
  // in production by import.meta.env.DEV in the scene, not by this flag alone.
  devChrome: true,
};

// ---------------------------------------------------------------------------
// HUD — the chrome the hub draws around every scene
// ---------------------------------------------------------------------------
// Fractions of the canvas, because the hub is the one part that must not move
// when a scene changes: a prompt that shifts a few pixels between mini-games
// reads as a bug.
export const HUD = {
  // Scene progress row (dots) sits just under the top edge.
  dotsYFrac: 0.055,
  dotRadius: 7,
  dotGap: 22,
  dotActiveColor: 0xffffff,
  dotDoneColor: 0x86efac,
  dotIdleAlpha: 0.3,

  // The prompt line: the spoken/text question for the current round.
  //
  // WHITE WITH A THIN BLACK OUTLINE, not dark-on-light: scene 1 puts the prompt
  // over a busy painted factory, and a dark fill disappears into the art. The
  // stroke is what keeps it legible over any background the five scenes bring.
  promptYFrac: 0.16,
  promptFontSize: 34,
  promptColor: '#ffffff',
  promptStrokeColor: '#000000',
  promptStrokeThickness: 3,
  promptWrapFrac: 0.86,

  // Scene title chip, top-left, so it is obvious which mini-game is running.
  titleX: 24,
  titleY: 24,
  titleFontSize: 18,
  titleColor: '#0f172a',
}

// ---------------------------------------------------------------------------
// SCENE 1 — SHAPES (the factory)
// ---------------------------------------------------------------------------
// The conveyor is the one piece of scene 1 that MUST be tuned by eye: where the
// belt sits on the painted factory background and how fast it moves are both art
// decisions, and neither is guessable from the image's dimensions.
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
  // The reel shows CLUES — "3 corners", "no corners", "4 equal sides",
  // "4 corners" — in ONE colour, ringed in the outline colour.
  //
  // One colour for every clue, not four: the clue text IS the content now, so
  // varying its colour made the colours look meaningful when only the words are.
  // `slotWordFitOfWindow` is a hard ceiling on rendered width as a fraction of the
  // BOX, and the text is scaled DOWN to meet it, so the longest clue can never
  // overflow the sides at any box width.
  slotWordColor: 0xffffff,
  slotWordSizeOfCard: 0.42,
  slotWordFitOfWindow: 0.9,
  slotWordStroke: 6,
  slotCycles: 3,
  slotSpinMs: 2600,
  // ---- the whirr -----------------------------------------------------------
  // The clip is played at a rate solved from its OWN length, so it ends exactly
  // when the slot sequence does:
  //
  //     rate = clipDuration / (spin + land pulse + settle)
  //
  // Nothing here needs to know the clip's duration, so swapping the asset keeps
  // the sync. These three are the only knobs.
  //
  // The band keeps a badly-mismatched asset listenable: below the minimum the
  // whirr drones, above the maximum it chirps. When the solved rate is clamped,
  // the sound is instead cut off at the end of the sequence.
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
  // A drop within this fraction of the belt's height ABOVE/BELOW the belt still
  // counts as landing on it, so a child releasing slightly short is not punished.
  // It is a forgiving band, not a precision test.
  dropToleranceFrac: 0.18,
  // Where a shape SNAPS to horizontally when it lands: 0.5 is the middle of the
  // belt. Snapping is what makes the belt look like it takes the shape rather
  // than the child having to aim. The move uses `dropSnapMs` above, so both axes
  // settle together.
  dropXFrac: 0.5,
  // How far apart the CENTRES of the two shapes in a two-shape round sit, as a
  // fraction of canvas width.
  //
  // This must exceed the shape width or the pair visually overlaps: a shape is
  // `optionSizeFrac` wide (0.17), so 0.42 leaves a clear gap between them and
  // keeps both on the belt. The drop-zone hints use the same number, so the two
  // circles always sit exactly where the shapes will.
  parkSpreadFrac: 0.42,

  // ---- drop-zone hints -----------------------------------------------------
  // A faint disc (or two) on the belt showing where a shape should go. Keep the
  // alpha LOW: it is a hint, not a target to stare at, and anything stronger
  // fights the painted background.
  dropZoneColor: 0xffffff,
  dropZoneAlpha: 0.18,
  dropZoneRadiusFrac: 0.1, // of canvas width
  // A slow breathe, so the discs read as interactive rather than painted. 0 turns
  // the pulse off entirely.
  dropZonePulseAlpha: 0.25,
  dropZonePulseMs: 900,

  // ---- answer feedback flashes ----------------------------------------------
  // Both outcomes flush the whole screen through the SAME helper, so they read as
  // one piece of feedback with opposite meanings. Green = won, red = try again.
  //
  // They are deliberately separate values rather than one colour plus a "which
  // one" flag: the timings want to differ in practice (a win can linger slightly
  // longer than a miss).
  correctFlashColor: 0x22c55e,
  correctFlashAlpha: 0.4,
  correctFlashMs: 130,
  correctFlashHoldMs: 240,
  // How long the won round STAYS on screen before the next one mounts.
  //
  // This cannot be `sendOffHoldMs` (120ms): the next round re-mounts the scene,
  // which destroys it and stops the chime mid-play. The effective hold is the
  // LARGER of this value and (flash fade-in + hold + fade-out + winHoldPadMs), so
  // retuning the flash can never outrun the hold and cut itself off.
  winHoldMs: 900,
  winHoldPadMs: 250,

  wrongFlashColor: 0xef4444,
  wrongFlashAlpha: 0.4,
  wrongFlashMs: 130,
  wrongFlashHoldMs: 240,
  // Beat AFTER the buzzer before the next round, so the child sees the red and
  // hears the buzz before the screen changes. The correct path does not need one:
  // the round simply advances via sendOffHoldMs.
  wrongRestartMs: 520,

  sendOffSpeed: 420,
};
// ---------------------------------------------------------------------------
// SCENES — one nested block per scene id
// ---------------------------------------------------------------------------
// These are PLACEHOLDER numbers: enough for the scaffold to lay something out
// and for the panel to have real sliders, but the mechanics will replace them.
// Every key here is safe to change; nothing outside the scene reads it.
const sceneDefaults = (index) => ({
  // Vertical band the round's interactive objects occupy, as canvas fractions.
  playTopFrac: 0.26,
  playBottomFrac: 0.82,

  // How tall the main objects are drawn, as a fraction of the play band.
  objectHeightFrac: 0.22,

  // Horizontal inset, so a row of objects never touches the screen edge.
  sideInsetFrac: 0.1,

  // Number of answer slots on screen for this round. The mechanics will refine
  // this per round; the scaffold just spaces them.
  slots: 3,

  // Dev accent, matching scenes.js so the frame and the chrome agree.
  accentIndex: index,
})

// Built from the registry so adding a scene to scenes.js adds its tuning block
// automatically — there is no second list to forget.
export const SCENES_TUNING = Object.fromEntries(
  SCENES.map((scene, index) => [scene.id, sceneDefaults(index)])
)

// Distance correction: the panel's slider ranges need to be in ABSOLUTE pixels
// for x/y, but the blocks above are fractions. Rather than duplicate every field
// as a pixel twin, the panel gets fraction sliders (0..1) and the schema labels
// them as such. Simple and unambiguous.

// ---------------------------------------------------------------------------
// KIT INSTANCE
// ---------------------------------------------------------------------------
const TABLES = {
  ENGINE,
  HUD,
  SCENE1,
  SCENES: SCENES_TUNING,
}

// `id` namespaces the kit's globals. Must be unique; 'G16' is this game's.
export const TUNING = createTuning({ id: 'G16', tables: TABLES });

// ---------------------------------------------------------------------------
// ACCESSORS — the hub and the scenes read through these, never the constants.
// ---------------------------------------------------------------------------
export const getEngine = () => TUNING.get('ENGINE');
export const getHud = () => TUNING.get('HUD');

// Scene 1's own block (the factory background + the conveyor). Kept separate
// from the generic per-scene defaults because the belt is real art with real
// layout decisions, not placeholder spacing.
export const getScene1 = () => TUNING.get('SCENE1');

// One scene's block, resolved with any live override applied. Falls back to the
// first block so a scene added to scenes.js before its tuning exists still runs.
export const getSceneTuning = (sceneId) =>
  TUNING.get('SCENES')?.[sceneId] ?? TUNING.get('SCENES')?.[SCENES[0].id];

// ---------------------------------------------------------------------------
// COPY-PASTE FORMATTER
// ---------------------------------------------------------------------------
function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatTuningCode() {
  const engine = getEngine();
  const hud = getHud();
  const s1 = getScene1();
  const scenes = TUNING.get('SCENES') || {};

  const sceneBlocks = Object.entries(scenes).map(([id, block]) =>
    [
      `  ${id}: {`,
      `    playTopFrac: ${fmt(block.playTopFrac)},`,
      `    playBottomFrac: ${fmt(block.playBottomFrac)},`,
      `    objectHeightFrac: ${fmt(block.objectHeightFrac)},`,
      `    sideInsetFrac: ${fmt(block.sideInsetFrac)},`,
      `    slots: ${block.slots},`,
      `  },`,
    ].join('\n')
  );

  return [
    'export const ENGINE = {',
    `  transitionMs: ${fmt(engine.transitionMs)},`,
    `  crossfade: ${fmt(engine.crossfade)},`,
    `  devChrome: ${engine.devChrome},`,
    '};',
    '',
    'export const HUD = {',
    `  dotsYFrac: ${fmt(hud.dotsYFrac)},`,
    `  promptYFrac: ${fmt(hud.promptYFrac)},`,
    `  promptFontSize: ${fmt(hud.promptFontSize)},`,
    `  promptColor: '${hud.promptColor}',`,
    `  promptStrokeColor: '${hud.promptStrokeColor}',`,
    `  promptStrokeThickness: ${fmt(hud.promptStrokeThickness)},`,
    '};',
    '',
    '// paste into SCENE1 in tuning.js',
    'export const SCENE1 = {',
    `  bgAlpha: ${fmt(s1.bgAlpha)},`,
    `  bgOffsetXFrac: ${fmt(s1.bgOffsetXFrac)},`,
    `  bgOffsetYFrac: ${fmt(s1.bgOffsetYFrac)},`,
    `  beltYFrac: ${fmt(s1.beltYFrac)},`,
    `  beltHeightFrac: ${fmt(s1.beltHeightFrac)},`,
    `  beltAlpha: ${fmt(s1.beltAlpha)},`,
    `  beltOverlap: ${fmt(s1.beltOverlap)},`,
    `  charHeightFrac: ${fmt(s1.charHeightFrac)},`,
    `  charXFrac: ${fmt(s1.charXFrac)},`,
    `  charBeltGapFrac: ${fmt(s1.charBeltGapFrac)},`,
    `  charAlpha: ${fmt(s1.charAlpha)},`,
    `  charDepth: ${fmt(s1.charDepth)},`,
    '',
    `  rollAnimKey: '${s1.rollAnimKey}',`,
    `  rollFps: ${fmt(s1.rollFps)},`,
    `  rollHoldMs: ${fmt(s1.rollHoldMs)},`,
    `  shapesFadeInMs: ${fmt(s1.shapesFadeInMs)},`,
    '',
    `  slotFollowRobot: ${s1.slotFollowRobot},`,
    `  slotOffsetXFrac: ${fmt(s1.slotOffsetXFrac)},`,
    `  slotOffsetYFrac: ${fmt(s1.slotOffsetYFrac)},`,
    `  slotXFrac: ${fmt(s1.slotXFrac)},`,
    `  slotYFrac: ${fmt(s1.slotYFrac)},`,
    `  slotWidthFrac: ${fmt(s1.slotWidthFrac)},`,
    `  slotAspect: ${fmt(s1.slotAspect)},`,
    '',
    `  slotBoxFillColor: 0x${Number(s1.slotBoxFillColor).toString(16).padStart(6, '0')},`,
    `  slotBoxFillAlpha: ${fmt(s1.slotBoxFillAlpha)},`,
    `  slotBoxBorderColor: 0x${Number(s1.slotBoxBorderColor).toString(16).padStart(6, '0')},`,
    `  slotBoxBorderWidth: ${fmt(s1.slotBoxBorderWidth)},`,
    `  slotBoxRadius: ${fmt(s1.slotBoxRadius)},`,
    '',
    `  slotCardSizeOfWindow: ${fmt(s1.slotCardSizeOfWindow)},`,
    `  slotCardGapFrac: ${fmt(s1.slotCardGapFrac)},`,
    `  slotWordColor: 0x${Number(s1.slotWordColor).toString(16).padStart(6, '0')},`,
    `  slotWordSizeOfCard: ${fmt(s1.slotWordSizeOfCard)},`,
    `  slotWordFitOfWindow: ${fmt(s1.slotWordFitOfWindow)},`,
    `  slotWordStroke: ${fmt(s1.slotWordStroke)},`,
    `  slotCycles: ${fmt(s1.slotCycles)},`,
    `  slotSpinMs: ${fmt(s1.slotSpinMs)},`,
    `  slotSpinVolume: ${fmt(s1.slotSpinVolume)},`,
    `  slotSpinRateMin: ${fmt(s1.slotSpinRateMin)},`,
    `  slotSpinRateMax: ${fmt(s1.slotSpinRateMax)},`,
    `  slotSettleMs: ${fmt(s1.slotSettleMs)},`,
    `  slotEase: '${s1.slotEase}',`,
    `  slotLandPulseScale: ${fmt(s1.slotLandPulseScale)},`,
    `  slotLandPulseMs: ${fmt(s1.slotLandPulseMs)},`,
    `  slotHighlightColor: 0x${Number(s1.slotHighlightColor).toString(16).padStart(6, '0')},`,
    `  slotHighlightAlpha: ${fmt(s1.slotHighlightAlpha)},`,
    `  slotHighlightSizeOfBox: ${fmt(s1.slotHighlightSizeOfBox)},`,
    `  slotHighlightGrow: ${fmt(s1.slotHighlightGrow)},`,
    `  slotHighlightMs: ${fmt(s1.slotHighlightMs)},`,
    `  slotDepth: ${fmt(s1.slotDepth)},`,
    '',
    `  optionRowXFrac: ${fmt(s1.optionRowXFrac)},`,
    `  optionRowYFrac: ${fmt(s1.optionRowYFrac)},`,
    `  optionSizeFrac: ${fmt(s1.optionSizeFrac)},`,
    `  optionGapPx: ${fmt(s1.optionGapPx)},`,
    '',
    `  shapeStrokeWidth: ${fmt(s1.shapeStrokeWidth)},`,
    `  shapeStrokeColor: 0x${Number(s1.shapeStrokeColor).toString(16).padStart(6, '0')},`,
    `  shapeIdleAlpha: ${fmt(s1.shapeIdleAlpha)},`,
    `  shapeDragScale: ${fmt(s1.shapeDragScale)},`,
    `  rectangleAspect: ${fmt(s1.rectangleAspect)},`,
    '',
    `  dropYOffsetFrac: ${fmt(s1.dropYOffsetFrac)},`,
    `  dropSnapMs: ${fmt(s1.dropSnapMs)},`,
    `  dropToleranceFrac: ${fmt(s1.dropToleranceFrac)},`,
    `  dropXFrac: ${fmt(s1.dropXFrac)},`,
    `  parkSpreadFrac: ${fmt(s1.parkSpreadFrac)},`,
    '',
    `  dropZoneColor: 0x${Number(s1.dropZoneColor).toString(16).padStart(6, '0')},`,
    `  dropZoneAlpha: ${fmt(s1.dropZoneAlpha)},`,
    `  dropZoneRadiusFrac: ${fmt(s1.dropZoneRadiusFrac)},`,
    `  dropZonePulseAlpha: ${fmt(s1.dropZonePulseAlpha)},`,
    `  dropZonePulseMs: ${fmt(s1.dropZonePulseMs)},`,
    '',
    `  correctFlashColor: 0x${Number(s1.correctFlashColor).toString(16).padStart(6, '0')},`,
    `  correctFlashAlpha: ${fmt(s1.correctFlashAlpha)},`,
    `  correctFlashMs: ${fmt(s1.correctFlashMs)},`,
    `  correctFlashHoldMs: ${fmt(s1.correctFlashHoldMs)},`,
    `  winHoldMs: ${fmt(s1.winHoldMs)},`,
    `  winHoldPadMs: ${fmt(s1.winHoldPadMs)},`,
    '',
    `  wrongFlashColor: 0x${Number(s1.wrongFlashColor).toString(16).padStart(6, '0')},`,
    `  wrongFlashAlpha: ${fmt(s1.wrongFlashAlpha)},`,
    `  wrongFlashMs: ${fmt(s1.wrongFlashMs)},`,
    `  wrongFlashHoldMs: ${fmt(s1.wrongFlashHoldMs)},`,
    `  wrongRestartMs: ${fmt(s1.wrongRestartMs)},`,
    '',
    `  sendOffSpeed: ${fmt(s1.sendOffSpeed)},`,
    '};',
    '',
    '// paste into sceneDefaults() in tuning.js',
    'const SCENE_DEFAULTS = {',
    sceneBlocks.join('\n'),
    '};',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// SCHEMA — what the dev panel renders
// ---------------------------------------------------------------------------
// Group order is chosen for how the work actually goes: get to the scene first
// (nav), then lay out the shared chrome, then tune the one scene you are in.
export const TUNING_SCHEMA = {
  title: 'GAME 16 · 5 SCENES',
  help: '« » jump scenes · ◀ ▶ step rounds. Sliders apply live; edits to tuning.js hot-reload.',
  copyHint: 'paste into tuning.js',
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
        { path: 'dotsYFrac', label: 'dots y', min: 0, max: 1, step: 0.005 },
        { path: 'dotRadius', label: 'dot r', min: 2, max: 16, step: 1 },
        { path: 'dotGap', label: 'dot gap', min: 8, max: 60, step: 1 },
        { path: 'promptYFrac', label: 'prompt y', min: 0, max: 1, step: 0.005 },
        { path: 'promptFontSize', label: 'prompt size', min: 12, max: 72, step: 1, suffix: 'px' },
        { path: 'promptStrokeThickness', label: 'prompt outline', min: 0, max: 12, step: 1, suffix: 'px' },
        { path: 'titleX', label: 'title x', min: 0, max: 720, step: 1 },
        { path: 'titleY', label: 'title y', min: 0, max: 1080, step: 1 },
        { path: 'titleFontSize', label: 'title size', min: 10, max: 48, step: 1, suffix: 'px' },
      ],
    },
    // Scene 1's REAL art, tuned separately from the generic placeholder block
    // below: the conveyor's position and speed are art decisions.
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
        // Raise this if a hairline seam is still visible; 0 shows the seam so
        // you can judge the art's own edges.
        { path: 'beltOverlap', label: 'seam overlap', min: 0, max: 0.06, step: 0.001 },
        // The robot, anchored by its feet to the belt's top edge.
        { path: 'charHeightFrac', label: 'robot height', min: 0.05, max: 0.6, step: 0.005 },
        { path: 'charXFrac', label: 'robot x', min: 0, max: 1, step: 0.005 },
        { path: 'charBeltGapFrac', label: 'robot gap', min: -0.1, max: 0.15, step: 0.002 },
        { path: 'charAlpha', label: 'robot alpha', min: 0, max: 1, step: 0.02 },
        { path: 'charDepth', label: 'robot depth', min: -5, max: 15, step: 1 },
        // Roll-in animation.
        { path: 'rollFps', label: 'roll fps', min: 5, max: 60, step: 1 },
        { path: 'rollHoldMs', label: 'roll hold', min: 0, max: 1500, step: 10, suffix: 'ms' },
        { path: 'shapesFadeInMs', label: 'shapes fade', min: 0, max: 1200, step: 10, suffix: 'ms' },
        // The slot BOX: position, size and look.
        { path: 'slotFollowRobot', label: 'box on robot', type: 'toggle' },
        { path: 'slotXFrac', label: 'box x', min: 0, max: 1, step: 0.005 },
        { path: 'slotYFrac', label: 'box y', min: 0, max: 1, step: 0.005 },
        { path: 'slotOffsetXFrac', label: 'box nudge x', min: -0.3, max: 0.3, step: 0.005 },
        { path: 'slotOffsetYFrac', label: 'box nudge y', min: -0.3, max: 0.3, step: 0.005 },
        { path: 'slotWidthFrac', label: 'box width', min: 0.08, max: 0.6, step: 0.005 },
        { path: 'slotAspect', label: 'box height', min: 0.5, max: 2.4, step: 0.05 },
        { path: 'slotBoxFillAlpha', label: 'box fill alpha', min: 0, max: 1, step: 0.02 },
        { path: 'slotBoxBorderWidth', label: 'box border', min: 0, max: 16, step: 1, suffix: 'px' },
        { path: 'slotBoxRadius', label: 'box corner', min: 0, max: 40, step: 1 },
        { path: 'slotDepth', label: 'box depth', min: -5, max: 19, step: 1 },
        // The reel inside the box.
        { path: 'slotCardSizeOfWindow', label: 'word spacing', min: 0.2, max: 1, step: 0.02 },
        { path: 'slotCardGapFrac', label: 'gap', min: 0, max: 1, step: 0.02 },
        { path: 'slotWordSizeOfCard', label: 'clue size', min: 0.1, max: 1.2, step: 0.01 },
        { path: 'slotWordFitOfWindow', label: 'word max width', min: 0.4, max: 1, step: 0.02 },
        { path: 'slotWordStroke', label: 'word outline', min: 0, max: 20, step: 1, suffix: 'px' },
        { path: 'slotCycles', label: 'word repeats', min: 2, max: 6, step: 1 },
        { path: 'slotSpinMs', label: 'spin time', min: 300, max: 8000, step: 50, suffix: 'ms' },
        { path: 'slotSpinVolume', label: 'whirr volume', min: 0, max: 1, step: 0.02 },
        { path: 'slotSpinRateMax', label: 'whirr max rate', min: 1, max: 6, step: 0.1 },
        { path: 'slotSettleMs', label: 'settle hold', min: 0, max: 1500, step: 10, suffix: 'ms' },
        { path: 'slotLandPulseScale', label: 'land pulse', min: 1, max: 1.6, step: 0.02 },
        { path: 'slotLandPulseMs', label: 'pulse time', min: 0, max: 800, step: 10, suffix: 'ms' },
        { path: 'slotHighlightAlpha', label: 'glow alpha', min: 0, max: 1, step: 0.02 },
        { path: 'slotHighlightSizeOfBox', label: 'glow size', min: 0.1, max: 1.2, step: 0.02 },
        { path: 'slotHighlightGrow', label: 'glow grow', min: 1, max: 3, step: 0.05 },
        { path: 'slotHighlightMs', label: 'glow time', min: 100, max: 1500, step: 10, suffix: 'ms' },
        // The options row: where it sits, how big each option is.
        { path: 'optionRowXFrac', label: 'options x', min: 0, max: 1, step: 0.005 },
        { path: 'optionRowYFrac', label: 'options y', min: 0, max: 1, step: 0.005 },
        { path: 'optionSizeFrac', label: 'option size', min: 0.04, max: 0.24, step: 0.002 },
        { path: 'optionGapPx', label: 'option gap', min: 0, max: 80, step: 1, suffix: 'px' },
        // Shape look.
        { path: 'shapeStrokeWidth', label: 'outline', min: 0, max: 16, step: 1, suffix: 'px' },
        { path: 'shapeIdleAlpha', label: 'shape alpha', min: 0.2, max: 1, step: 0.02 },
        { path: 'shapeDragScale', label: 'drag scale', min: 1, max: 1.5, step: 0.01 },
        { path: 'rectangleAspect', label: 'rect height', min: 0.2, max: 1, step: 0.02 },
        // Where a dragged shape sticks on the belt.
        { path: 'dropYOffsetFrac', label: 'stick y', min: -0.3, max: 0.3, step: 0.002 },
        { path: 'dropSnapMs', label: 'stick time', min: 0, max: 600, step: 10, suffix: 'ms' },
        { path: 'dropToleranceFrac', label: 'drop tolerance', min: 0, max: 0.5, step: 0.01 },
        { path: 'dropXFrac', label: 'snap x', min: 0, max: 1, step: 0.005 },
        { path: 'parkSpreadFrac', label: 'pair gap', min: 0.02, max: 0.7, step: 0.005 },
        // Drop-zone hints.
        { path: 'dropZoneAlpha', label: 'zone alpha', min: 0, max: 0.6, step: 0.01 },
        { path: 'dropZoneRadiusFrac', label: 'zone radius', min: 0.02, max: 0.25, step: 0.005 },
        { path: 'dropZonePulseAlpha', label: 'zone pulse', min: 0, max: 0.6, step: 0.02 },
        { path: 'dropZonePulseMs', label: 'pulse time', min: 200, max: 3000, step: 25, suffix: 'ms' },
        // Answer feedback flashes.
        { path: 'correctFlashAlpha', label: 'green flash', min: 0, max: 1, step: 0.02 },
        { path: 'correctFlashMs', label: 'green fade in', min: 20, max: 600, step: 10, suffix: 'ms' },
        { path: 'correctFlashHoldMs', label: 'green hold', min: 0, max: 1200, step: 10, suffix: 'ms' },
        { path: 'winHoldMs', label: 'win pause', min: 0, max: 3000, step: 25, suffix: 'ms' },
        { path: 'wrongFlashAlpha', label: 'red flash', min: 0, max: 1, step: 0.02 },
        { path: 'wrongFlashMs', label: 'red fade in', min: 20, max: 600, step: 10, suffix: 'ms' },
        { path: 'wrongFlashHoldMs', label: 'red hold', min: 0, max: 1200, step: 10, suffix: 'ms' },
        { path: 'wrongRestartMs', label: 'restart delay', min: 0, max: 2000, step: 10, suffix: 'ms' },
        // Sending it away.
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
      ],
    })),
  ],
};
