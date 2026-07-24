// sceneAssets.js
// Canvas-drawn texture generators shared between LevelSelectScene and
// NumberOrderScene. Each function caches its texture under a key so
// repeated calls (e.g. scene.restart()) are cheap no-ops.

import { labelForValue } from './levels';

const TEXTURE_PADDING = 4;

function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------
// Background — a vertical 3-stop sky gradient (colors come from the
// level config) with a sun glow, a couple of baked-in clouds, and a
// rolling "ground" shape along the bottom whose color also comes from
// the level config. One texture per level, cached by `key` so switching
// levels/restarting doesn't regenerate it.
// ---------------------------------------------------------------------
export function makeBackgroundTexture(scene, width, height, level, key) {
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, level.bgColors[0]);
  sky.addColorStop(0.55, level.bgColors[1]);
  sky.addColorStop(1, level.bgColors[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun glow tucked in a back corner, well clear of the play area — kept
  // consistent across every level/theme.
  const sunX = width * 0.86;
  const sunY = height * 0.07;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 80);
  sunGlow.addColorStop(0, 'rgba(255,217,61,0.9)');
  sunGlow.addColorStop(1, 'rgba(255,217,61,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const clouds = [
    [width * 0.16, height * 0.12, 22],
    [width * 0.16 + 20, height * 0.12 + 5, 16],
  ];
  clouds.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rolling "ground" strip along the bottom — its color changes per level
  // (green hill, orchard soil, garden grass, sandy beach) so each level
  // reads as visually distinct even though the shape is shared.
  ctx.fillStyle = level.groundColor;
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

// ---------------------------------------------------------------------
// "smallest to biggest" / "biggest to smallest" title line — baked into
// a single canvas texture instead of three separate Phaser Text objects.
// Three separate Text objects, each positioned by reading .width off the
// *other* objects, can drift out of alignment: the very first time a
// given font/size/weight combo is requested, the browser may still be
// finishing loading that specific font, so Phaser's layout math and the
// eventual painted glyphs can end up using different metrics (this is
// what caused "biggest" and "to" to visually collide). Measuring and
// drawing on the very same canvas 2D context sidesteps that entirely —
// whatever font ctx.measureText() sees is exactly what ctx.fillText()
// paints, so the gaps can never disagree with the render.
// ---------------------------------------------------------------------
const ORDER_WORD_STYLE = {
  smallest: { fontSize: 42, color: '#4CAF50' },
  biggest: { fontSize: 58, color: '#FF7043' },
};
const ORDER_TO_STYLE = { fontSize: 48, color: '#1f4f7a' };
const ORDER_WORD_GAP = 22;
const ORDER_STROKE_WIDTH = 6;
const ORDER_STROKE_COLOR = '#ffffff';

export function makeOrderTitleTexture(scene, minWidth, direction, key) {
  if (scene.textures.exists(key)) return key;

  const isDesc = direction === 'desc';
  const firstWord = isDesc ? 'biggest' : 'smallest';
  const secondWord = isDesc ? 'smallest' : 'biggest';
  const fontFor = (size) => `bold ${size}px Fredoka, sans-serif`;

  // Measure first, on a throwaway context, before committing to a canvas
  // size — same font strings we draw with below, so widths are exact.
  const measureCtx = document.createElement('canvas').getContext('2d');
  const widthOf = (text, size) => {
    measureCtx.font = fontFor(size);
    return measureCtx.measureText(text).width;
  };
  const firstWidth = widthOf(firstWord, ORDER_WORD_STYLE[firstWord].fontSize);
  const toWidth = widthOf('to', ORDER_TO_STYLE.fontSize);
  const secondWidth = widthOf(secondWord, ORDER_WORD_STYLE[secondWord].fontSize);
  const totalWidth = firstWidth + ORDER_WORD_GAP + toWidth + ORDER_WORD_GAP + secondWidth;

  const sidePadding = 24;
  const canvasWidth = Math.max(minWidth, Math.ceil(totalWidth) + sidePadding * 2);
  const canvasHeight = 110;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';

  let x = (canvasWidth - totalWidth) / 2;
  const y = canvasHeight / 2;

  const drawWord = (text, size, color) => {
    ctx.font = fontFor(size);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
    ctx.lineWidth = ORDER_STROKE_WIDTH;
    ctx.strokeStyle = ORDER_STROKE_COLOR;
    ctx.strokeText(text, x, y);
    ctx.restore();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    x += ctx.measureText(text).width;
  };

  drawWord(firstWord, ORDER_WORD_STYLE[firstWord].fontSize, ORDER_WORD_STYLE[firstWord].color);
  x += ORDER_WORD_GAP;
  drawWord('to', ORDER_TO_STYLE.fontSize, ORDER_TO_STYLE.color);
  x += ORDER_WORD_GAP;
  drawWord(secondWord, ORDER_WORD_STYLE[secondWord].fontSize, ORDER_WORD_STYLE[secondWord].color);

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

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
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

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------
// Bubble/item texture — two looks depending on the level:
//  - Levels with no objectEmojis (Level 1) keep the original plain
//    colored bubble: drop shadow, radial lighting, white border, gloss,
//    sparkle, digit centered.
//  - Levels with objectEmojis (apples, flowers, sea creatures) draw the
//    themed emoji itself AS the item — full size, no separate bubble
//    shape underneath — with a small rounded label badge overlaid near
//    its base showing the digit or spelled word. This is what makes the
//    number/word read as "printed on the object" rather than tacked on
//    as a decoration.
// Cached per (levelIndex, value) since color/label/theme all vary by level.
// ---------------------------------------------------------------------
export function makeItemTexture(scene, level, levelIndex, value) {
  const key = `item-${levelIndex}-${value}`;
  if (scene.textures.exists(key)) return key;

  const radius = level.itemRadius;
  const size = (radius + TEXTURE_PADDING) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const colorHex = level.palette[(value - 1) % level.palette.length];
  const label = labelForValue(level, value);

  if (level.objectEmojis) {
    // ---------- The object itself is the bubble ----------
    const emoji = level.objectEmojis[(value - 1) % level.objectEmojis.length];

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 3;
    // Emoji scale is intentionally decoupled from radius growth (1.55x
    // instead of scaling 1:1 with the bubble) so bumping itemRadius up in
    // levels.js — to make bubbles and the label text bigger — doesn't also
    // balloon the emoji itself.
    ctx.font = `${Math.round(radius * 1.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, c, c - radius * 0.05);
    ctx.restore();

    // ---------- Label badge, overlaid on the lower part of the object ----------
    const badgeFont = level.labelType === 'word' ? 'bold 34px Fredoka, sans-serif' : 'bold 36px Fredoka, sans-serif';
    ctx.font = badgeFont;
    const textW = ctx.measureText(label).width;
    const badgeH = level.labelType === 'word' ? 44 : 48;
    const badgeW = Math.max(textW + 10, badgeH );
    const badgeY = c + radius * 0.62 + (level.badgeOffsetY ?? 0);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    drawRoundedRectPath(ctx, c - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.restore();

    drawRoundedRectPath(ctx, c - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH / 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToCss(colorHex);
    ctx.stroke();

    ctx.font = badgeFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#173b59';
    ctx.fillText(label, c, badgeY + 1);
  } else {
    // ---------- Plain colored bubble (Level 1) ----------
    // ---------- Drop shadow ----------
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fillStyle = hexToCss(colorHex);
    ctx.fill();
    ctx.restore();

    // ---------- Radial lighting ----------
    const grad = ctx.createRadialGradient(c - radius * 0.35, c - radius * 0.4, radius * 0.18, c, c, radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0.12)');

    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // ---------- White border ----------
    ctx.beginPath();
    ctx.arc(c, c, radius - 1.5, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();

    // ---------- Small glossy highlight ----------
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(c - radius * 0.35, c - radius * 0.38, radius * 0.32, radius * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // ---------- Tiny sparkle ----------
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(c - radius * 0.12, c - radius * 0.6, 2, 0, Math.PI * 2);
    ctx.fill();

    // ---------- Digit, large and centered ----------
    ctx.font = 'bold 52px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(label, c, c + 2);
    ctx.fillStyle = '#173b59';
    ctx.fillText(label, c, c + 2);
  }

  scene.textures.addCanvas(key, canvas);
  return key;
}