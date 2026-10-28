// tuning.js
// Game 16 (in works) — THE TUNING FILE.
//
// This is a BOILERPLATE tuning file: it deliberately holds only the three
// things the scaffold actually paints (the sky/backdrop, the "not finished"
// notice, and the shared mute button). The mechanic's numbers get added here
// as each system is built, so nothing is ever tuned inline in GameScene.js.
//
// Coordinates are INTERNAL pixels on the 720x1080 canvas (see
// DEFAULT_BASE_RESOLUTION in @/phaser/config): x = 0 is the left edge, y = 0 the
// top, (360, 540) is screen centre. Anything named `...Frac` is a 0..1 fraction
// of the canvas width/height, so it survives a different base resolution.
//
// Nothing in this file is stateful and it imports nothing, so it is safe to
// edit and save; Vite hot-reloads it.

// Canvas clear colour (see Game.jsx), so the single frame before the sky draws
// is not a bare canvas. Also the backdrop's fallback fill.
export const BACKGROUND_COLOR = '#0b1220';

// The 3-stop sky the shared BasePreloadScene hands off from, so there is no
// visible seam between loading and the first gameplay frame.
//
// Deliberately neutral: a boilerplate must not imply a mechanic with its
// palette, and this is the same sky every scaffold starts from.
export const SKY_THEME = {
  bgColors: ['#3fb6ea', '#8fe0fa', '#ffe9a8'],
  groundColor: '#8ee06a',
};

// Drifting clouds from the shared BaseScene.addDriftingClouds(). Each entry:
// xr/yr = position as a fraction of the canvas, plus scale/alpha. Two puffs is
// enough to show the scene is live without giving it a "theme".
export const CLOUDS = [
  { xr: 0.18, yr: 0.16, scale: 1, alpha: 0.85 },
  { xr: 0.78, yr: 0.1, scale: 0.8, alpha: 0.7 },
];

// ---------------------------------------------------------------------------
// BACKDROP — the shared baked sky gradient. There is no painted art yet, so
// this IS the backdrop; when real art arrives it goes in assets.js IMAGES and
// this block gains a `key` to prefer it over the gradient.
// ---------------------------------------------------------------------------
export const BACKDROP = {
  // Texture key the gradient is baked under. Must be unique per game, because
  // textures live on the shared Phaser Game (so a scene restart, or a second
  // game mounted in the same page, would otherwise reuse another game's sky).
  key: 'g16-sky',

  // Depth of the gradient only; everything the mechanic adds sits above it.
  depth: -10,
};

// ---------------------------------------------------------------------------
// NOTICE — the on-screen "unfinished" heading.
//
// A boilerplate has no start screen and no HUD, so without this the game would
// open onto an empty sky and look broken rather than WIP. The copy is the same
// `(in works)` string the catalogue uses, so the two can never disagree.
// ---------------------------------------------------------------------------
export const NOTICE = {
  text: '(in works)',
  // Centre of the heading, in internal px.
  x: 360,
  y: 470,

  // Second line explaining why the screen is empty. Kept short — this is a
  // placeholder, not documentation for children.
  subtitle: 'This game is still being built.',
  subtitleGap: 58, // px below the heading's centre

  headingFontSize: '46px',
  subtitleFontSize: '22px',

  // Colours stay in the sky's dark ink so the copy reads on the pale gradient.
  headingColor: '#0f3d5c',
  subtitleColor: '#35617f',

  depth: 10,
};

// ---------------------------------------------------------------------------
// MUTE — placement of the SHARED mute toggle only.
//
// The button itself, its icon and the storage key all come from
// @/phaser/common/audioState (one `ezw-muted-v1` key for the whole app). Never
// add per-game mute state here; only these coordinates belong to this game.
// ---------------------------------------------------------------------------
export const MUTE = {
  x: 24,
  y: 20,
  anchor: 'topLeft',
  depth: 25,
};

// Aggregate, so a dev live-tuning panel (docs/DEV_TUNING.md) can be dropped over
// the whole file later with `import { TUNING }`. Purely a convenience export —
// the scene imports the named blocks above.
export const TUNING = {
  BACKGROUND_COLOR,
  SKY_THEME,
  CLOUDS,
  BACKDROP,
  NOTICE,
  MUTE,
};
