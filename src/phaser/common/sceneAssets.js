// Phaser/common/sceneAssets.js
// Canvas-drawn texture generators shared by every bonus game's scenes.
// Each function caches its texture under a key so repeated calls (e.g.
// scene.restart()) are cheap no-ops.
//
// This is the generic subset of BonusGame1's original sceneAssets.js —
// everything here is level-shape agnostic (backgrounds/clouds/splats/
// confetti work the same regardless of what a given game's "levels" look
// like). Texture generators that DO depend on a specific game's level
// shape (BonusGame1's numbered/labeled item bubbles and "smallest to
// biggest" title, for example) live next to the scene that uses them
// instead — see BonusGame1/NumberOrderScene.js.

// ---------------------------------------------------------------------
// Background — a vertical 3-stop sky gradient (colors come from the
// level/theme config) with a sun glow, a couple of baked-in clouds, and a
// rolling "ground" shape along the bottom whose color also comes from the
// config. One texture per theme, cached by `key` so switching
// levels/restarting doesn't regenerate it.
// ---------------------------------------------------------------------
export function makeBackgroundTexture(scene, width, height, theme, key) {
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, theme.bgColors[0]);
  sky.addColorStop(0.55, theme.bgColors[1]);
  sky.addColorStop(1, theme.bgColors[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Aurora glow tucked in a back corner, well clear of the play area —
  // kept consistent across every level/theme. Tinted fuchsia/violet so it
  // reads as a night-sky bloom over the dark backgrounds rather than a
  // bright day sun.
  const sunX = width * 0.86;
  const sunY = height * 0.07;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 80);
  sunGlow.addColorStop(0, 'rgba(232,121,249,0.85)');
  sunGlow.addColorStop(1, 'rgba(192,132,252,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
  ctx.fill();

  // Soft translucent violet-white clouds so puffs stay visible against the
  // now-dark skies.
  ctx.fillStyle = 'rgba(199,210,254,0.55)';
  const clouds = [
    [width * 0.16, height * 0.12, 22],
    [width * 0.16 + 20, height * 0.12 + 5, 16],
  ];
  clouds.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rolling "ground" strip along the bottom — its color changes per
  // theme (green hill, orchard soil, garden grass, sandy beach, ...) so
  // each level reads as visually distinct even though the shape is
  // shared.
  ctx.fillStyle = theme.groundColor;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height - 24);
  ctx.quadraticCurveTo(width * 0.25, height - 48, width * 0.5, height - 26);
  ctx.quadraticCurveTo(width * 0.75, height - 4, width, height - 28);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  scene.textures.addCanvas(key, canvas);
  return key;
}

export function makeCloudTexture(scene) {
  const key = 'cloud-puff';
  if (scene.textures.exists(key)) return key;

  const w = 100;
  const h = 50;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(199,210,254,0.7)';
  [
    [30, 30, 20],
    [55, 22, 17],
    [74, 30, 14],
    [45, 34, 16],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  scene.textures.addCanvas(key, canvas);
  return key;
}

export function makeSplatTexture(scene) {
  const key = 'splat';
  if (scene.textures.exists(key)) return key;

  const size = 140;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();

  const drops = 9;
  for (let i = 0; i < drops; i += 1) {
    const angle = (i / drops) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 28 + Math.random() * 24;
    const r = 6 + Math.random() * 11;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r, 0, Math.PI * 2);
    ctx.fill();
  }

  scene.textures.addCanvas(key, canvas);
  return key;
}

export function makeConfettiTexture(scene) {
  const key = 'confetti-dot';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 6, 10);
  g.generateTexture(key, 6, 10);
  g.destroy();
  return key;
}

export function makeConfettiSquareTexture(scene) {
  const key = 'confetti-square';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 8, 8);
  g.generateTexture(key, 8, 8);
  g.destroy();
  return key;
}
