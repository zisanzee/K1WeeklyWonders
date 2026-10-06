import { createTuning } from '@/devTuning/core';

// roadTuning.js
// Game 13 — THE TUNING FILE.
//
// Every number the road mechanic reads lives here, so the whole thing can be
// re-centred by eye without touching any logic. Coordinates are INTERNAL pixels
// on the 720x1080 canvas (see DEFAULT_BASE_RESOLUTION in phaser/config.js):
// x = 0 is the left edge, y = 0 the top, (360, 540) is screen centre.
//
// ---------------------------------------------------------------------------
// HOT EDITING
// ---------------------------------------------------------------------------
// This file is a thin wrapper over the shared dev-tuning kit (@/devTuning). The
// tables below are handed to createTuning(); the exported get*() accessors read
// through it, so two things apply live with no page reload:
//   1. Edit a number below and save — Vite hot-reloads this module and the kit's
//      HMR hook re-applies it to the running scene.
//   2. In dev, drag the sliders in the shared DevTuningPanel (see Game.jsx).
// In a production build createTuning() returns a plain direct read — no globals,
// no bus, no merge, and the panel is never loaded.
//
// The lane GUIDE boxes are placeholders — highlighted translucent rectangles
// drawn over the road purely so you can SEE where each lane is. Move/resize them
// to line up with the painted lanes; the car and the obstacles are positioned
// from these same numbers, so fixing the boxes fixes everything at once.

// ---------------------------------------------------------------------------
// DEV EDITOR SWITCH
// ---------------------------------------------------------------------------
// Per-game master switch for the live-tuning editor. Kept separate from the
// shared kit's own TUNING_DEV_ENABLED so THIS game can ship player-facing while
// the editor stays wired for the others. With it false, the scene draws no lane
// guides, installs no canvas drag hooks, and Game.jsx mounts no sidebar — even
// in a dev build. Vite folds `import.meta.env.DEV && DEV_TUNING_ENABLED` to a
// plain false in production regardless, so a player never sees either path.
export const DEV_TUNING_ENABLED = false;

// ---------------------------------------------------------------------------
// ROAD (the looping backdrop)
// ---------------------------------------------------------------------------
// The road image is scroll-tiled top-to-bottom to fake an endless road. It is
// scaled so it is at least as wide as the canvas (`fitWidth`), then the scroll
// runs its own height, so tuning SCROLL_SPEED just changes how fast the world
// moves past. Scaling to fit the WIDTH (not the height) means the painted lane
// markings keep their proportions on any device.
export const ROAD = { fitWidth: true, scrollSpeed: 165 };

export const LANES = [
  { id: 0, x: 272.014, y: 560.72, w: 175, h: 1400 },
  { id: 1, x: 448.09, y: 474.584, w: 175, h: 1400 },
];

export const CAR = {
  y: 962, scale: 1.02, lanePadding: 14,
  // Lane change: a slower, eased slide plus a lean INTO the direction of travel
  // (and a squash), so the car reads as steering rather than teleporting.
  switchDuration: 420, switchEase: 'Sine.easeInOut',
  switch: { tiltDeg: 9, squash: 0.86 },
  shake: { amplitude: 5.5, rotation: 2.5, speed: 26 },
  // Collision box, as a fraction of the sprite's half-height trimmed off the
  // nose/tail. The art has transparent padding, so using the full sprite height
  // made the car crash on empty pixels before the obstacle visually touched it.
  collision: { frontInset: 0.22, rearInset: 0.22 },
  // Crash: a BURST of violent shake for `burstMs`, then the car goes limp and
  // `holdMs` passes before the round restarts. Nothing touches the car during
  // the hold — the shake plays out fully before the world resets.
  crash: {
    durationMs: 1700,
    holdMs: 700,
    reactionMs: 70, // grace after contact before the crash fires
    shake: { amplitude: 30, rotation: 15, speed: 65 },
    lurchX: 22, // px the car is thrown sideways
    lurchBack: 26, // px backward (up-screen)
    reboundMs: 700, // how long the rebound/limp settles for
  },
  // Exhaust: translucent grey puffs leaking from the BACK of the car (the car
  // art faces up-screen, so the back is the bottom of the sprite) and drifting
  // further DOWN-screen, i.e. out behind it.
  dust: {
    enabled: true,
    key: null, // texture key of the puff; null → the scene bakes one on first use
    tint: 0xcbd5e1,
    everyMs: 80, // spawn cadence
    driftY: 90, // how far DOWN-screen a puff drifts (out the back)
    driftX: 12, // slight sideways wander as it drifts
    riseMinMs: 420, // a puff's lifetime range
    riseMaxMs: 820,
    scaleMin: 0.2, // puff start scale
    scaleMax: 0.4,
    spreadX: 18, // horizontal scatter around the exhaust point
    startAlpha: 0.45,
    endAlpha: 0, // fade target
    crashEveryMs: 40, // faster cadence while crashing
    crashBurst: 3, // puffs per tick while crashing
    crashScaleMult: 1.5, // bigger puffs while crashing
  },
};

export const LANE_GUIDE = {
  // Player-facing build: the lanes are exactly where they were tuned, just not
  // drawn. Flip to true (or turn the dev editor on) to see the boxes again.
  show: false,
  fill: 0x22d3ee, // cyan
  fillAlpha: 0.16,
  stroke: 0x0891b2,
  strokeAlpha: 0.85,
  strokeWidth: 4,
  radius: 22, // rounded corners
};


// ---------------------------------------------------------------------------
// ROUNDS (timing + difficulty)
// ---------------------------------------------------------------------------
// The car starts moving as soon as the round begins, the prompt shows for
// `promptHoldMs` ALONE, then the obstacle spawns above the play area. The
// obstacle becomes a hazard `obstacleWarnMs` later (rAF-pausable grace, so a
// backgrounded tab can never sneak a hit in). Difficulty per round lives in
// rounds.js (speed + the shrinking prompt→obstacle gap).
export const ROUNDS = {
  startDelayMs: 2000, // quiet beat after Start before the first prompt appears
  promptHoldMs: 2000, // prompt on its own before the obstacle appears
  obstacleWarnMs: 250, // grace after the obstacle appears before it can hit
  passMargin: 150, // px below the car centre that counts as "cleared"
  fillPerRound: 0.1, // progress bar gain per round cleared (10%)
};

// ---------------------------------------------------------------------------
// OBSTACLE
// ---------------------------------------------------------------------------
// One obstacle at a time. It is hidden until its round spawns it, then travels
// down at the current road speed. Sized from the lane width plus `growPct`.
export const OBSTACLE = {
  scale: 0.89, // extra multiplier on top of the lane-fit scale (tuned)
  lanePadding: 18, // px kept clear on each side of the lane box (tuned)
  growPct: 1.15, // grown vs the lane width (1.15 = 15% wider)
  // Collision box trim, as a fraction of the sprite's half-height off each end,
  // so transparent padding in the art does not register as a hit.
  collision: { frontInset: 0.18, rearInset: 0.12 },
  // Per-kind idle animation, so obstacles do not all look dead while they ride
  // down. Anything not listed here (e.g. the puddle) stays STATIC.
  motion: {
    obstacleCar1: 'shake', // thrum like the player car
    obstacleCar2: 'shake',
    obstacleTires: 'bounce', // slight bounce
    obstacleCone: 'bounce',
    obstacleBox: 'bounce',
    obstaclePuddle: 'static',
  },
  bounce: { amplitude: 7, speed: 3.4 },
};

// ---------------------------------------------------------------------------
// PROGRESS BAR (distance — right edge)
// ---------------------------------------------------------------------------
// A slightly transparent vertical bar down the right edge; it fills 10% per
// round cleared and drains back down when a round is lost.
export const PROGRESS_BAR = {
  x: 690, // centre x
  y: 540, // centre y
  width: 26,
  height: 900,
  radius: 13,
  trackFill: 0x000000,
  trackAlpha: 0.22,
  fillColor: 0xf97316, // orange
  fillAlpha: 0.7,
  border: 0xffffff,
  borderAlpha: 0.35,
  borderWidth: 3,
  animateMs: 320, // how long a fill step takes
};

// ---------------------------------------------------------------------------
// PROMPT (the big Left / Right instruction)
// ---------------------------------------------------------------------------
// A large word at the top, tinted per direction, bobbing so it reads as the
// thing to react to. No arrow — the word alone is the instruction.
export const PROMPT = {
  y: 150,
  fontSize: 92,
  bobAmount: 10,
  bobMs: 420,
  leftColor: '#2563eb',
  rightColor: '#dc2626',
  stroke: '#ffffff',
  strokeWidth: 12,
  // The prompt slides in from its side and pops (Back) as it arrives; when the
  // round clears it shrinks/fades out on the way to the next one.
  inDurationMs: 320,
  inSlideX: 90, // px it starts off-centre on the side it points toward
  outDurationMs: 220,
};

// ---------------------------------------------------------------------------
// AUDIO (volumes + timing)
// ---------------------------------------------------------------------------
// Game 13's driving SFX. `engineVolume` is the loop that runs for the whole
// game; the skid plays on a lane change; the honk sounds `honkLeadMs` BEFORE the
// obstacle appears; the direction voices play with the prompt.
export const AUDIO_MIX = {
  engineVolume: 0.42, engineCrossfadeSec: 0.35,
  skidVolume: 0.34,
  honkVolume: 0.26, voiceVolume: 1, crashVolume: 0.8,
  honkLeadMs: 600,
};

// Background music level for THIS game only (see ensureBgMusic in
// @/phaser/common/audioState). Start values here; the engine loop sits on top.
export const BG_MUSIC = {
  volume: 0.2,
};

// ---------------------------------------------------------------------------
// START SCREEN (fullscreen title art + Start button)
// ---------------------------------------------------------------------------
// The title art is drawn scaled-to-cover; only the button position and the
// welcome voice volume are tuned, since the artwork carries its own text.
export const START_SCREEN = {
  buttonY: 944, // y of the Start button (near the bottom of the 720x1080 base)
  buttonLabel: 'Start \u25B6',
  voiceVolume: 1.9, // start-voice line playing under the title screen
  fadeMs: 420, // title-screen fade-out when Start is tapped
};

// ---------------------------------------------------------------------------
// Draw order bands (lower = further back).
// ---------------------------------------------------------------------------
export const DEPTH = {
  road: 0,
  guide: 2, // lane scaffolding sits over the road, under everything else
  obstacle: 6, // the obstacle rides on the road, behind the car
  dust: 9, // exhaust puffs emerge from UNDER the car, so just below it
  car: 10,
  bar: 20, // the distance bar sits over the road, under the HUD text
  hud: 30,
  prompt: 40, // the big Left/Right instruction is the topmost in-play element
  flash: 90, // the red hit flash covers the play area but not the start card
  start: 400, // the start screen covers everything
};

// ===========================================================================
// LIVE TUNING (shared kit)
// ===========================================================================
// The tables above are published to the shared dev-tuning kit, which overlays
// any live dev override on top and exposes them through ROAD_TUNING.get(). The
// exported accessors below are thin wrappers so the scene keeps reading
// naturally. In production ROAD_TUNING.get() is a plain direct read.
const TABLES = {
  ROAD,
  LANES,
  LANE_GUIDE,
  CAR,
  ROUNDS,
  OBSTACLE,
  PROGRESS_BAR,
  PROMPT,
  AUDIO_MIX,
  BG_MUSIC,
  START_SCREEN,
  DEPTH,
};

export const ROAD_TUNING = createTuning({ id: 'G13', tables: TABLES });

// Escape a value for a single-quoted JS string in the copy-paste output.
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// --- read API: one wrapper per section the scene consumes. ---
export const getRoad = () => ROAD_TUNING.get('ROAD');
export const getLanes = () => ROAD_TUNING.get('LANES');
export const getLaneGuide = () => ROAD_TUNING.get('LANE_GUIDE');
export const getCar = () => ROAD_TUNING.get('CAR');
export const getRounds = () => ROAD_TUNING.get('ROUNDS');
export const getObstacle = () => ROAD_TUNING.get('OBSTACLE');
export const getProgressBar = () => ROAD_TUNING.get('PROGRESS_BAR');
export const getPrompt = () => ROAD_TUNING.get('PROMPT');
export const getAudioMix = () => ROAD_TUNING.get('AUDIO_MIX');
export const getBgMusic = () => ROAD_TUNING.get('BG_MUSIC');
export const getStartScreen = () => ROAD_TUNING.get('START_SCREEN');
export const getDepth = () => ROAD_TUNING.get('DEPTH');

// A copy-pasteable snapshot, so a good live session can be pasted straight back
// into the constants above. Fed to the panel through the schema's `format`.
function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatTuningCode() {
  const road = getRoad();
  const lanes = getLanes();
  const car = getCar();
  const rounds = getRounds();
  const obstacle = getObstacle();
  const bar = getProgressBar();
  const prompt = getPrompt();
  const audio = getAudioMix();
  const laneLines = lanes
    .map((l) => `  { id: ${l.id}, x: ${fmt(l.x)}, y: ${fmt(l.y)}, w: ${fmt(l.w)}, h: ${fmt(l.h)} },`)
    .join('\n');
  return [
    `export const ROAD = { fitWidth: true, scrollSpeed: ${fmt(road.scrollSpeed)} };`,
    '',
    'export const LANES = [',
    laneLines,
    '];',
    '',
    'export const CAR = {',
    `  y: ${fmt(car.y)}, scale: ${fmt(car.scale)}, lanePadding: ${fmt(car.lanePadding)},`,
    `  switchDuration: ${fmt(car.switchDuration)}, switchEase: ${q(car.switchEase)},`,
    `  switch: { tiltDeg: ${fmt(car.switch.tiltDeg)}, squash: ${fmt(car.switch.squash)} },`,
    `  shake: { amplitude: ${fmt(car.shake.amplitude)}, rotation: ${fmt(car.shake.rotation)}, speed: ${fmt(car.shake.speed)} },`,
    `  collision: { frontInset: ${fmt(car.collision.frontInset)}, rearInset: ${fmt(car.collision.rearInset)} },`,
    `  crash: { durationMs: ${fmt(car.crash.durationMs)}, holdMs: ${fmt(car.crash.holdMs)}, reactionMs: ${fmt(car.crash.reactionMs)}, lurchX: ${fmt(car.crash.lurchX)}, lurchBack: ${fmt(car.crash.lurchBack)}, reboundMs: ${fmt(car.crash.reboundMs)}, shake: { amplitude: ${fmt(car.crash.shake.amplitude)}, rotation: ${fmt(car.crash.shake.rotation)}, speed: ${fmt(car.crash.shake.speed)} } },`,
    `  dust: { enabled: ${car.dust.enabled}, everyMs: ${fmt(car.dust.everyMs)}, driftY: ${fmt(car.dust.driftY)}, driftX: ${fmt(car.dust.driftX)}, riseMinMs: ${fmt(car.dust.riseMinMs)}, riseMaxMs: ${fmt(car.dust.riseMaxMs)}, scaleMin: ${fmt(car.dust.scaleMin)}, scaleMax: ${fmt(car.dust.scaleMax)}, spreadX: ${fmt(car.dust.spreadX)}, startAlpha: ${fmt(car.dust.startAlpha)}, crashEveryMs: ${fmt(car.dust.crashEveryMs)}, crashBurst: ${fmt(car.dust.crashBurst)} },`,
    '};',
    '',
    'export const ROUNDS = {',
    `  startDelayMs: ${fmt(rounds.startDelayMs)}, promptHoldMs: ${fmt(rounds.promptHoldMs)}, obstacleWarnMs: ${fmt(rounds.obstacleWarnMs)},`,
    `  passMargin: ${fmt(rounds.passMargin)}, fillPerRound: ${fmt(rounds.fillPerRound)},`,
    '};',
    '',
    'export const OBSTACLE = {',
    `  scale: ${fmt(obstacle.scale)}, lanePadding: ${fmt(obstacle.lanePadding)}, growPct: ${fmt(obstacle.growPct)},`,
    `  collision: { frontInset: ${fmt(obstacle.collision.frontInset)}, rearInset: ${fmt(obstacle.collision.rearInset)} },`,
    `  bounce: { amplitude: ${fmt(obstacle.bounce.amplitude)}, speed: ${fmt(obstacle.bounce.speed)} },`,
    '};',
    '',
    'export const PROGRESS_BAR = {',
    `  x: ${fmt(bar.x)}, y: ${fmt(bar.y)}, width: ${fmt(bar.width)}, height: ${fmt(bar.height)},`,
    `  radius: ${fmt(bar.radius)}, fillAlpha: ${fmt(bar.fillAlpha)}, animateMs: ${fmt(bar.animateMs)},`,
    '};',
    '',
    'export const PROMPT = {',
    `  y: ${fmt(prompt.y)}, fontSize: ${fmt(prompt.fontSize)}, bobAmount: ${fmt(prompt.bobAmount)}, bobMs: ${fmt(prompt.bobMs)},`,
    `  inDurationMs: ${fmt(prompt.inDurationMs)}, inSlideX: ${fmt(prompt.inSlideX)}, outDurationMs: ${fmt(prompt.outDurationMs)},`,
    '};',
    '',
    'export const AUDIO_MIX = {',
    `  engineVolume: ${fmt(audio.engineVolume)}, engineCrossfadeSec: ${fmt(audio.engineCrossfadeSec)},`,
    `  skidVolume: ${fmt(audio.skidVolume)},`,
    `  honkVolume: ${fmt(audio.honkVolume)}, voiceVolume: ${fmt(audio.voiceVolume)}, crashVolume: ${fmt(audio.crashVolume)},`,
    `  honkLeadMs: ${fmt(audio.honkLeadMs)},`,
    '};',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// DEV PANEL SCHEMA — describes every tunable as a slider (or toggle). The shared
// DevTuningPanel renders this; `format` prints the copy-paste source above.
// ---------------------------------------------------------------------------
export const TUNING_SCHEMA = {
  title: 'GAME 13 · LIVE TUNING',
  help: 'Drag sliders for live updates, or drag a lane box on the canvas. Edit roadTuning.js and save to hot-reload too.',
  copyHint: 'paste into roadTuning.js',
  format: formatTuningCode,
  groups: [
    {
      key: 'ROAD',
      label: 'Road',
      fields: [{ path: 'scrollSpeed', label: 'scrollSpeed', min: 0, max: 1200, step: 10, suffix: 'px/s' }],
    },
    {
      type: 'array',
      key: 'LANES',
      label: 'Lanes',
      itemLabel: (r) => `Lane ${r.id}`,
      fields: [
        { path: 'x', label: 'x', min: -200, max: 920, step: 1 },
        { path: 'y', label: 'y', min: -200, max: 1280, step: 1 },
        { path: 'w', label: 'w', min: 40, max: 720, step: 1 },
        { path: 'h', label: 'h', min: 40, max: 1400, step: 1 },
      ],
    },
    {
      key: 'CAR',
      label: 'Car',
      fields: [
        { path: 'y', label: 'y', min: 0, max: 1080, step: 1 },
        { path: 'scale', label: 'scale', min: 0, max: 3, step: 0.01 },
        { path: 'switchDuration', label: 'switch ms', min: 100, max: 1200, step: 10, suffix: 'ms' },
        { path: 'switch.tiltDeg', label: 'switch tilt', min: 0, max: 30, step: 1, suffix: '°' },
        { path: 'switch.squash', label: 'switch squash', min: 0.5, max: 1, step: 0.02 },
        { path: 'collision.frontInset', label: 'hit front Inset', min: 0, max: 0.6, step: 0.01 },
        { path: 'collision.rearInset', label: 'hit rear inset', min: 0, max: 0.6, step: 0.01 },
        { path: 'shake.amplitude', label: 'shake amp', min: 0, max: 30, step: 0.5 },
        { path: 'shake.rotation', label: 'shake rot', min: 0, max: 10, step: 0.1, suffix: '°' },
        { path: 'shake.speed', label: 'shake speed', min: 0, max: 80, step: 1 },
        { path: 'crash.durationMs', label: 'crash ms', min: 0, max: 4000, step: 100, suffix: 'ms' },
        { path: 'crash.holdMs', label: 'crash hold', min: 0, max: 3000, step: 50, suffix: 'ms' },
        { path: 'crash.shake.amplitude', label: 'crash amp', min: 0, max: 60, step: 1 },
        { path: 'crash.shake.rotation', label: 'crash rot', min: 0, max: 40, step: 0.5, suffix: '°' },
        { path: 'crash.shake.speed', label: 'crash speed', min: 0, max: 140, step: 1 },
        { path: 'crash.lurchX', label: 'lurch x', min: 0, max: 120, step: 1 },
        { path: 'crash.lurchBack', label: 'lurch back', min: 0, max: 120, step: 1 },
        { path: 'dust.everyMs', label: 'dust every', min: 30, max: 400, step: 10, suffix: 'ms' },
        { path: 'dust.driftY', label: 'dust driftY', min: 0, max: 300, step: 5 },
        { path: 'dust.startAlpha', label: 'dust alpha', min: 0, max: 1, step: 0.05 },
        { path: 'dust.enabled', label: 'dust', type: 'toggle' },
      ],
    },
    {
      key: 'ROUNDS',
      label: 'Rounds (timing)',
      fields: [
        { path: 'startDelayMs', label: 'start delay', min: 0, max: 6000, step: 100, suffix: 'ms' },
        { path: 'promptHoldMs', label: 'prompt hold', min: 0, max: 8000, step: 100, suffix: 'ms' },
        { path: 'obstacleWarnMs', label: 'warn grace', min: 0, max: 2000, step: 50, suffix: 'ms' },
        { path: 'passMargin', label: 'pass margin', min: 0, max: 400, step: 5 },
        { path: 'fillPerRound', label: 'bar per round', min: 0.02, max: 0.5, step: 0.01 },
      ],
    },
    {
      key: 'OBSTACLE',
      label: 'Obstacle',
      fields: [
        { path: 'scale', label: 'scale', min: 0, max: 3, step: 0.01 },
        { path: 'lanePadding', label: 'lane pad', min: 0, max: 120, step: 1 },
        { path: 'growPct', label: 'grow pct', min: 0.5, max: 2, step: 0.05 },
        { path: 'collision.frontInset', label: 'hit front inset', min: 0, max: 0.6, step: 0.01 },
        { path: 'collision.rearInset', label: 'hit rear inset', min: 0, max: 0.6, step: 0.01 },
        { path: 'bounce.amplitude', label: 'bounce amp', min: 0, max: 40, step: 1 },
        { path: 'bounce.speed', label: 'bounce speed', min: 0, max: 12, step: 0.1 },
      ],
    },
    {
      key: 'PROGRESS_BAR',
      label: 'Progress bar',
      fields: [
        { path: 'x', label: 'x', min: 0, max: 720, step: 1 },
        { path: 'y', label: 'y', min: 0, max: 1080, step: 1 },
        { path: 'width', label: 'width', min: 6, max: 80, step: 1 },
        { path: 'height', label: 'height', min: 100, max: 1080, step: 10 },
        { path: 'fillAlpha', label: 'fill alpha', min: 0, max: 1, step: 0.05 },
      ],
    },
    {
      key: 'PROMPT',
      label: 'Prompt',
      fields: [
        { path: 'y', label: 'y', min: 60, max: 600, step: 1 },
        { path: 'fontSize', label: 'font size', min: 40, max: 160, step: 2 },
        { path: 'bobAmount', label: 'bob', min: 0, max: 40, step: 1 },
      ],
    },
    {
      key: 'BG_MUSIC',
      label: 'Background music',
      fields: [{ path: 'volume', label: 'music vol', min: 0, max: 1, step: 0.02 }],
    },
    {
      key: 'START_SCREEN',
      label: 'Start screen',
      fields: [
        { path: 'buttonY', label: 'button y', min: 600, max: 1060, step: 1 },
        { path: 'voiceVolume', label: 'voice vol', min: 0, max: 1, step: 0.02 },
        { path: 'fadeMs', label: 'fade', min: 0, max: 1500, step: 20, suffix: 'ms' },
      ],
    },
    {
      key: 'AUDIO_MIX',
      label: 'Audio',
      fields: [
        { path: 'engineVolume', label: 'engine vol', min: 0, max: 1, step: 0.02 },
        { path: 'engineCrossfadeSec', label: 'engine xfade', min: 0.05, max: 1.5, step: 0.05, suffix: 's' },
        { path: 'skidVolume', label: 'skid vol', min: 0, max: 1, step: 0.02 },
        { path: 'honkVolume', label: 'honk vol', min: 0, max: 1, step: 0.02 },
        { path: 'voiceVolume', label: 'voice vol', min: 0, max: 1, step: 0.02 },
        { path: 'crashVolume', label: 'crash vol', min: 0, max: 1, step: 0.02 },
        { path: 'honkLeadMs', label: 'honk lead', min: 0, max: 2000, step: 50, suffix: 'ms' },
      ],
    },
  ],
};

// --- geometry helpers, now fed by the live lanes. ---
export function laneById(id) {
  const lanes = getLanes();
  return lanes.find((l) => l.id === id) || lanes[0];
}

// The widest a sprite may be while staying `padding` px clear of the lane edges.
export function laneUsableWidth(lane, padding) {
  return Math.max(1, lane.w - padding * 2);
}

// Scale a sprite to fit its lane width without distorting it, multiplied by the
// caller's own `fixedScale` (1 = "just fit the lane"). Returns 1 when the lane
// width cannot be derived, so a missing texture never collapses to zero.
export function fitScaleToLane(lane, textureWidth, padding, fixedScale = 1) {
  if (!textureWidth) return fixedScale;
  return (laneUsableWidth(lane, padding) / textureWidth) * fixedScale;
}

// Dev-only: when this file is saved, the kit has already published the new
// tables, so a relayout poke re-applies them to the running scene. accept()
// makes Vite treat this as a self-accepting update rather than reloading.
if (import.meta.hot) {
  import.meta.hot.accept(() => ROAD_TUNING.requestRelayout());
}
