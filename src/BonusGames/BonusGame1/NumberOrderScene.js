// NumberOrderScene.js
import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import {
  makeBackgroundTexture,
  makeCloudTexture,
  makeSplatTexture,
  makeConfettiTexture,
  makeConfettiSquareTexture,
} from '../../Phaser/common/sceneAssets';
import { LEVELS, NUMBER_WORDS, labelForValue, progress } from './levels';
import { AUDIO } from './assets';

// ---------------------------------------------------------------------
// Audio-file based replacement for the old speechSynthesis `speak()`.
// Looks the given line up in the AUDIO manifest (assets.js) and plays
// the matching mp3 via a plain HTML5 Audio element. Elements are cached
// per line so repeat calls (e.g. "Good job!" on every correct tap)
// don't recreate a new Audio object each time.
// ---------------------------------------------------------------------
const speakAudioCache = {};

function speak(text, muted = false) {
  if (muted) return;

  const src = AUDIO[text];
  if (!src) {
    console.warn(`[speak] No audio mapped for line: "${text}"`);
    return;
  }

  let audio = speakAudioCache[text];
  if (!audio) {
    audio = new Audio(src);
    speakAudioCache[text] = audio;
  }

  audio.volume = 0.55; // was defaulting to 1.0 (full volume)
  audio.currentTime = 0;
  audio.play().catch((err) => {
    console.warn('[speak] playback failed:', err);
  });
}

const TEXTURE_PADDING = 4;
const SPLAT_HOLD_MS = 3000; // how long a splat sits at full strength before fading
const SPLAT_FADE_MS = 500;
const POP_SOUND_KEYS = ['pop1', 'pop2', 'pop3'];

function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
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
//
// This (and makeOrderTitleTexture below) is specific to Number Pop's
// idea of a "level" — numbered/labeled item bubbles and a "smallest to
// biggest" title aren't a shape every future bonus game will share — so
// unlike the generic generators in Phaser/common/sceneAssets.js, these
// stay local to the one scene that uses them.
// ---------------------------------------------------------------------
function makeItemTexture(scene, level, levelIndex, value) {
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
    const badgeW = Math.max(textW + 10, badgeH);
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

function makeOrderTitleTexture(scene, minWidth, direction, key) {
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

export default class NumberOrderScene extends BaseScene {
  constructor() {
    super('NumberOrderScene');
  }

  init(data) {
    this.levelIndex = Phaser.Math.Clamp(data?.levelIndex ?? 0, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
  }

  labelFor(value) {
    return labelForValue(this.level, value);
  }

  // A pill showing whatever the player just correctly tapped — always as
  // BOTH the numeral and the spelled-out word side by side (e.g. "7 Seven"),
  // regardless of whether the current level's own bubbles are labeled with
  // numerals or words. Built by hand (rather than createPillButton) so it
  // can resize itself around each new value, including the longest spelled
  // words ("Seven", "Eight").
  createLastTappedChip(x, y) {
    const paddingX = 26;
    const innerGap = 14;
    const height = 74;
    const minWidth = 90;

    const numeralText = this.add.text(0, 2, '–', {
      fontSize: '40px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0, 0.5);

    const wordText = this.add.text(0, 3, '', {
      fontSize: '34px',
      fontFamily: 'Nunito, sans-serif',
      fontStyle: 'bold',
      color: '#4a6478',
    }).setOrigin(0, 0.5);

    const shadow = this.add.graphics();
    const bg = this.add.graphics();
    let currentBg = 0xffd93d; // bright gold, matches the rest of the UI's accent color

    const redraw = () => {
      const contentW = numeralText.width + (wordText.text ? innerGap + wordText.width : 0);
      const w = Math.max(contentW + paddingX * 2, minWidth);

      // Lay the two labels out left-to-right, then center that whole group
      // inside the pill — origin(0, 0.5) on each Text lets us position by
      // left edge without fighting each other's width as they change.
      numeralText.x = -contentW / 2;
      wordText.x = numeralText.x + numeralText.width + innerGap;

      shadow.clear();
      bg.clear();
      shadow.fillStyle(0x000000, 0.18);
      shadow.fillRoundedRect(-w / 2, -height / 2 + 4, w, height, 26);
      bg.fillStyle(currentBg, 1);
      bg.fillRoundedRect(-w / 2, -height / 2, w, height, 26);
      bg.lineStyle(3, 0xffffff, 1);
      bg.strokeRoundedRect(-w / 2, -height / 2, w, height, 26);
    };
    redraw();

    const container = this.add.container(x, y, [shadow, bg, numeralText, wordText]).setDepth(20);

    return {
      container,
      // Takes the raw numeric value (1-10), not a pre-formatted label —
      // the chip derives both the numeral and word forms itself so it
      // never depends on the current level's labelType.
      setValue: (numericValue) => {
        numeralText.setText(String(numericValue));
        const word = NUMBER_WORDS[numericValue - 1];
        wordText.setText(word.charAt(0).toUpperCase() + word.slice(1));
        redraw();
      },
      setBg: (colorHex) => {
        currentBg = colorHex;
        redraw();
      },
    };
  }

  create() {
    const { width, height } = this.scale;
    const level = this.level;

    this.itemRadius = level.itemRadius;
    this.textureSize = (this.itemRadius + TEXTURE_PADDING) * 2;

    // 'asc' levels count 1 -> totalNumbers; 'desc' levels count the other
    // way, totalNumbers -> 1. Falls back to 'asc' if a level config is
    // ever missing the field.
    this.direction = level.direction === 'desc' ? 'desc' : 'asc';
    this.nextExpected = this.direction === 'asc' ? 1 : level.totalNumbers;
    this.elapsedSeconds = 0;
    this.mistakes = 0;
    this.finished = false;
    this.locked = true;

    // Mute state now lives on the (game-wide) sound manager instead of a
    // local `this.muted` flag — this.sound is shared by every scene in
    // this Game instance, so a mute toggled here or back on
    // LevelSelectScene always reads the same value, and a re-entrant
    // create() (scene.restart()/scene.start() for "Play again"/"Next
    // Level") never silently resets it back to unmuted.

    // Background music is started once, at LevelSelectScene, and kept
    // alive from there — reuse that same Sound instance if it's still
    // around (arriving from the menu, or from "Next Level"/"Play Again")
    // instead of tearing it down and rebuilding it every time.
    this.bgMusic = this.sound.get('bgMusic') || this.sound.add('bgMusic', { loop: true, volume: 0.62 });

    this.addSkyBackground(level, `bg-${level.key}`);
    this.addDriftingClouds([
      { xr: 0.24, yr: 0.055, scale: 0.85, alpha: 0.85, driftX: 24, duration: 6500 },
      { xr: 0.74, yr: 0.1, scale: 1.1, alpha: 0.7, driftX: -20, duration: 8000 },
    ]);

    makeSplatTexture(this);

    // Small "Level N" chip + back-to-menu affordance up top, so it's always
    // clear which level is active without cluttering the main title.
const titleStyle = {
  fontFamily: 'Fredoka, sans-serif',
  fontStyle: 'bold',
  stroke: '#ffffff',
  strokeThickness: 6,
  shadow: {
    offsetX: 0,
    offsetY: 3,
    color: '#00000055',
    blur: 4,
    fill: true,
  },
};

this.add.text(width / 2, 30, 'Tap the numbers from', {
  ...titleStyle,
  fontSize: '48px',
  color: '#1f4f7a',
}).setOrigin(0.5);

// 'smallest' always renders green/smaller, 'biggest' always renders
// orange/bigger, and which one comes first flips with the level's
// direction — but rather than lay the three pieces out as separate
// Phaser Text objects (which can drift out of alignment, see
// makeOrderTitleTexture's comment for why), the whole "X to Y" line is
// baked into one canvas texture with the gaps measured and drawn in the
// same pass, so they can never disagree with what's on screen.
const orderTitleKey = makeOrderTitleTexture(this, width, this.direction, `order-title-${this.direction}`);
const orderTitle = this.add.image(width / 2, 82, orderTitleKey).setOrigin(0.5);

// Gentle idle animation — the whole line breathes together now that it's
// one image, rather than just the two colored words independently.
this.tweens.add({
  targets: orderTitle,
  scale: { from: 1, to: 1.06 },
  duration: 700,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.InOut',
});

// Centered under the title rather than tucked in the top-left corner —
// that spot used to collide with the mute button (both were fighting
// over the same top-left corner), and centering also gives it room to
// grow for the longest spelled-out words ("Seven", "Eight") without
// running off the left edge of the canvas.
this.nextChip = this.createLastTappedChip(width / 2, 152);

    this.timerChip = this.createPillButton(width - 22, 16, '0s', {
      fontSize: '24px',
      paddingX: 24,
      paddingY: 13,
      anchor: 'topRight',
      interactive: false,
      depth: 15,
    });

    // Restart + mute + home, available any time — during countdown,
    // mid-game, or after finishing — not just from the end screen. Fixed
    // minWidth here rather than relying on the emoji's measured text
    // width, which some browsers under-report for color emoji glyphs —
    // that was causing these to crowd/overlap each other.
    const ICON_BTN_SIZE = 96;
    const ICON_BTN_GAP = 12;

    this.muteBtn = this.createPillButton(16, 16, this.sound.mute ? '🔇' : '🔊', {
      fontSize: '28px',
      paddingX: 4,
      paddingY: 4,
      minWidth: ICON_BTN_SIZE,
      anchor: 'topLeft',
      depth: 20,
      simple: true,
    });
    this.muteBtn.on('pointerdown', () => {
      this.sound.mute = !this.sound.mute;
      this.muteBtn.setText(this.sound.mute ? '🔇' : '🔊');
    });

    const dotG = this.make.graphics({ x: 0, y: 0, add: false });
    dotG.fillStyle(0xffffff, 1);
    dotG.fillCircle(7, 7, 7);
    dotG.generateTexture('dot', 14, 14);
    dotG.destroy();

    this.popEmitter = this.add.particles(0, 0, 'dot', {
      speed: { min: 100, max: 240 },
      lifespan: 420,
      scale: { start: 1.6, end: 0 },
      quantity: 12,
      tint: [0xffd93d, 0xffffff, 0xff9f45],
      emitting: false,
    }).setDepth(15);

    // The next-up chip now sits at y=152 (bottom edge ~183) with the title
    // above it, so the safe top boundary for bubbles is a bit lower than
    // before (was 160) — this trims a little height off the top of the
    // play area rather than let bubbles spawn or drift up underneath it.
    this.playAreaTop = 191;
    this.physics.world.setBounds(0, this.playAreaTop, width, height - this.playAreaTop - 10);

    this.bubbles = this.createBubbles(width, height);
    this.physics.add.collider(this.bubbles);

    this.physics.world.pause();

    // The game no longer starts itself — bubbles pop in and sit here,
    // gently breathing, behind a Play button until the player taps it.
    this.showPlayOverlay();

    // Stop any in-flight utterance (e.g. "Good job!" still talking) if the
    // player backs out to the level select screen or restarts mid-speech.
    this.stopSpeechOnShutdown();
  }

  showPlayOverlay() {
    const { width, height } = this.scale;

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.35).setDepth(40);

    const title = this.add.text(width / 2, height / 2 - 80, `${this.level.icon} ${this.level.name}\n  Ready?`, {
      fontSize: '40px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(41);

    const playBtn = this.createPillButton(width / 2, height / 2 + 30, '▶️ Play', {
      fontSize: '40px',
      paddingX: 42,
      paddingY: 24,
      bgColor: 0xffd93d,
      textColor: '#0f3d5c',
      depth: 41,
    });

    // A gentle, ongoing invite-to-tap pulse — keeps going even before
    // anyone has touched the button, so it reads as tappable immediately.
    this.tweens.add({
      targets: playBtn.container,
      scale: { from: 1, to: 1.06 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    playBtn.on('pointerdown', () => {
      // Previously gated on `!this.muted`, which meant muting *before*
      // hitting Play skipped this .play() call entirely — and since
      // nothing else ever called it, unmuting afterwards had no playing
      // Sound to un-silence, so the music stayed off for the rest of the
      // session. this.sound.mute already controls actual audibility on
      // its own, so play() should always fire here regardless of mute
      // state. In practice the music is usually already playing by the
      // time a player reaches this screen (it starts back on
      // LevelSelectScene), so this is mostly a safety net.
      if (!this.bgMusic.isPlaying) this.bgMusic.play();

      dim.destroy();
      title.destroy();
      playBtn.destroy();

      this.runCountdown(['3', '2', '1', 'GO!'], () => this.startGame());
    });
  }

  runCountdown(steps, onComplete) {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.25).setDepth(50);
    const label = this.add.text(width / 2, height / 2, '', {
      fontSize: '96px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);

    let i = 0;
    const showNext = () => {
      if (i >= steps.length) {
        dim.destroy();
        label.destroy();
        onComplete();
        return;
      }
      label.setText(steps[i]).setScale(0.4).setAlpha(1);
      this.tweens.add({
        targets: label,
        scale: 1.15,
        duration: 280,
        ease: 'Back.Out',
        onComplete: () => this.tweens.add({ targets: label, scale: 1, duration: 120 }),
      });
      this.time.delayedCall(650, () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          scale: 1.4,
          duration: 200,
          onComplete: () => {
            i += 1;
            showNext();
          },
        });
      });
    };
    showNext();
  }

  startGame() {
    this.locked = false;
    this.physics.world.resume();
    this.enableBubbleInput();

    speak(this.direction === 'desc' ? 'Tap the numbers from biggest to smallest!' : 'Tap the numbers from smallest to biggest!', this.sound.mute);

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.finished) return;
        this.elapsedSeconds += 1;
        this.timerChip.setText(`${this.elapsedSeconds}s`);
      },
    });
  }

  enableBubbleInput() {
    this.bubbles.forEach((bubble) => {
      if (!bubble.active) return;
      bubble.setInteractive(this.bubbleHitCircle, Phaser.Geom.Circle.Contains);
      bubble.on('pointerdown', () => this.handleTap(bubble));
    });
  }

  createBubbles(width, height) {
    const level = this.level;
    const total = level.totalNumbers;
    const order = Phaser.Utils.Array.NumberArray(1, total);
    const placed = [];
    const bubbles = [];
    const hitCircle = new Phaser.Geom.Circle(this.textureSize / 2, this.textureSize / 2, this.itemRadius);
    this.bubbleHitCircle = hitCircle;

    order.forEach((value) => {
      let x, y, tries = 0;
      do {
        x = Phaser.Math.Between(this.itemRadius + 10, width - this.itemRadius - 10);
        y = Phaser.Math.Between(this.itemRadius + this.playAreaTop + 5, height - this.itemRadius - 10);
        tries += 1;
      } while (
        tries < 30 &&
        placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < this.itemRadius * 2.3)
      );
      placed.push({ x, y });

      const key = makeItemTexture(this, level, this.levelIndex, value);
      const bubble = this.physics.add.image(x, y, key);
      bubble.value = value;
      bubble.setDepth(10); // stays above splats (depth 1) regardless of add order
      // NOT interactive yet — see enableBubbleInput(), called from startGame().
      // Bubbles are scattered across the whole play area, including right
      // where the Play button and countdown sit, so leaving them clickable
      // this whole time was stealing taps meant for those instead.

      bubble.body.setCircle(this.itemRadius, TEXTURE_PADDING, TEXTURE_PADDING);
      bubble.body.setCollideWorldBounds(true);
      bubble.body.setBounce(1, 1);

      const speed = Phaser.Math.Between(50, 100);
      bubble.body.setMaxVelocity(120, 120);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      bubble.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

      // Staggered pop-in entrance (this happens while physics is still
      // paused for the countdown, so there's no visual conflict with
      // movement) followed by the ongoing idle "breathing" loop.
      bubble.setScale(0);
      this.tweens.add({
        targets: bubble,
        scale: 1,
        delay: 250 + value * 60,
        duration: 380,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: bubble,
            scale: { from: 0.94, to: 1.06 },
            duration: Phaser.Math.Between(700, 1000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });

      bubbles.push(bubble);
    });

    return bubbles;
  }

  handleTap(bubble) {
    if (this.locked || this.finished || !bubble.active) return;

    if (bubble.value === this.nextExpected) {
      const justTapped = this.nextExpected;
      this.popBubble(bubble);

      this.nextChip.setValue(justTapped);
      this.tweens.add({
        targets: this.nextChip.container,
        scale: { from: 1.3, to: 1 },
        duration: 240,
        ease: 'Back.Out',
      });

      this.nextExpected += this.direction === 'asc' ? 1 : -1;

      const isDone = this.direction === 'asc'
        ? this.nextExpected > this.level.totalNumbers
        : this.nextExpected < 1;

      if (isDone) {
        this.finished = true;
        this.timerEvent.remove();
        this.time.delayedCall(300, () => this.showComplete());
      }
    } else {
      this.wrongTap(bubble);
    }
  }

  popBubble(bubble) {
    this.popEmitter.explode(12, bubble.x, bubble.y);
    this.sound.play(Phaser.Utils.Array.GetRandom(POP_SOUND_KEYS), { volume: 0.6 });

    // A standalone splat image, same color as the bubble that popped,
    // sitting behind the remaining bubbles (depth 1 vs their depth 10).
    // It holds at full strength for a couple of seconds, then fades and
    // removes itself -- nothing persists indefinitely.
    const splat = this.add.image(bubble.x, bubble.y, 'splat');
    splat.setTint(this.level.palette[(bubble.value - 1) % this.level.palette.length]);
    splat.setAlpha(0.55);
    splat.setScale(Phaser.Math.FloatBetween(0.6, 0.95));
    splat.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    splat.setDepth(1);

    this.tweens.add({
      targets: splat,
      alpha: 0,
      delay: SPLAT_HOLD_MS,
      duration: SPLAT_FADE_MS,
      onComplete: () => splat.destroy(),
    });

    bubble.body.setVelocity(0, 0);
    bubble.disableInteractive();

    this.tweens.add({
      targets: bubble,
      scale: 0,
      alpha: 0,
      duration: 250,
      ease: 'Back.In',
      onComplete: () => bubble.destroy(),
    });
  }

  wrongTap(bubble) {
    this.mistakes += 1;
    this.sound.play('wrong', { volume: 0.55 });
    this.cameras.main.shake(180, 0.006);
    this.cameras.main.flash(120, 255, 60, 60);

    bubble.setTintFill(0xff4d4f);
    this.tweens.add({
      targets: bubble,
      x: bubble.x + Phaser.Math.Between(-8, 8),
      duration: 55,
      yoyo: true,
      repeat: 4,
    });

    const xMark = this.add.text(bubble.x, bubble.y - 50, '✗', {
      fontSize: '40px',
      color: '#ff4d4f',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScale(0).setDepth(20);

    this.tweens.add({
      targets: xMark,
      scale: 1.2,
      y: bubble.y - 85,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.Out',
      onComplete: () => xMark.destroy(),
    });

    this.nextChip.setBg(0xff4d4f);
    this.time.delayedCall(200, () => {
      if (bubble.active) bubble.clearTint();
      this.nextChip.setBg(0xffd93d);
    });
  }

  showComplete() {
    const { width, height } = this.scale;
    const level = this.level;

    speak('Good job!', this.sound.mute);

    // Award the star + unlock the next level before anything below reads
    // progress back out (the total-stars chip, the "Next Level" button's
    // availability, etc. all depend on this having already happened).
    progress.completeLevel(this.levelIndex);
    const isLastLevel = this.levelIndex === LEVELS.length - 1;
    const nextIndex = this.levelIndex + 1;
    const nextUnlocked = !isLastLevel && progress.isLevelUnlocked(nextIndex);

    // Hand the finished run's numbers off to React — this scene doesn't
    // know the player's name or how to log a session, it just reports what
    // happened. `this.game.events` is the one event bus that's reachable
    // from both sides: Phaser exposes it on every Scene as `this.game`, and
    // BonusGame1/Game.jsx (via the shared Phaser/BaseGame.jsx) holds the
    // same Game instance. `stars` scales with the level itself (Level 1 →
    // 1 star, Level 2 → 2 stars, etc.) rather than always being a flat 1.
    // `totalRounds` has to scale right alongside it — the server clamps
    // `stars = min(stars, totalRounds)`, so leaving totalRounds at a flat 1
    // would silently cap every level's stars back down to 1 regardless of
    // what's sent here.
    this.game.events.emit('numberpop-complete', {
      elapsedSeconds: this.elapsedSeconds,
      mistakes: this.mistakes,
      level: this.levelIndex + 1,
      levelKey: level.key,
      stars: this.levelIndex + 1,
      totalRounds: this.levelIndex + 1,
    });

    this.bgMusic?.stop();

    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1).setDepth(60);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });

    const confettiRectKey = makeConfettiTexture(this);
    const confettiSquareKey = makeConfettiSquareTexture(this);

    // Shared between both shapes so they fall in sync as one cohesive shower
    // rather than two visually-different effects layered on top of each other.
    const confettiConfig = {
      x: { min: 0, max: width },       // full width, not a 40px band
      y: -20,
      quantity: 2,
      frequency: 35,
      lifespan: { min: 1600, max: 2400 },  // slight variance so pieces don't
                                            // all vanish in the same instant
      speedY: { min: 60, max: 140 },   // gentler initial speed -- gravity
      speedX: { min: -70, max: 70 },   // below does the rest of the work
      gravityY: 240,                   // real acceleration, not constant fall
      rotate: { start: 0, end: 360 },  // actually spins over its lifetime,
                                        // rather than freezing at one angle
      scale: { start: 1.3, end: 0.7 },
      alpha: { start: 1, end: 0 },
      tint: level.palette,
      duration: 1400,                  // stops spawning after 1.4s; particles
                                        // already in flight keep falling
    };

    const confettiRects = this.add.particles(0, 0, confettiRectKey, confettiConfig).setDepth(61);
    const confettiSquares = this.add.particles(0, 0, confettiSquareKey, confettiConfig).setDepth(61);

    // Fires once every already-emitted particle has actually finished falling
    // and faded out -- not a guessed timeout, so it can't clip particles that
    // happen to be near the end of a longer lifespan roll.
    confettiRects.once('complete', () => confettiRects.destroy());
    confettiSquares.once('complete', () => confettiSquares.destroy());

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55)
      .setDepth(55).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 250 });

    // Panel is sized relative to the scene so it scales sensibly across
    // different canvas sizes, but with a floor so it still reads as a
    // proper "complete" screen on small canvases, and a cap so it doesn't
    // swallow the whole scene on big ones.
    const panelW = Phaser.Math.Clamp(width * 0.85, 380, 480);
    const panelH = Phaser.Math.Clamp(height * 0.74, 560, 660);
    const panel = this.add.container(width / 2, height / 2).setDepth(56).setScale(0.3).setAlpha(0);
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0xffffff, 1);
    panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    panelBg.lineStyle(7, 0xffd93d, 1);
    panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);

    const title = this.add.text(0, -panelH / 2 + 60, `${level.icon} ${level.name} complete!`, {
      fontSize: '36px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);

    const leftPart = this.add.text(0, 0, 'You did it in ', {
      fontSize: '24px',
      fontFamily: 'Nunito, sans-serif',
      color: '#0f3d5c',
    }).setOrigin(0, 0.5);

    const scorePart = this.add.text(0, 0, `${this.elapsedSeconds} seconds`, {
      fontSize: '38px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ff7a00',
    }).setOrigin(0, 0.5);

    const totalWidth = leftPart.width + scorePart.width;
    leftPart.setPosition(-totalWidth / 2, 0);
    scorePart.setPosition(-totalWidth / 2 + leftPart.width, 0);

    const subtitle = this.add.container(0, -panelH / 2 + 134, [leftPart, scorePart]);

    const star = this.add.text(0, -panelH / 2 + 186, '⭐', { fontSize: '52px' }).setOrigin(0.5).setScale(0);
    const starLabel = this.add.text(0, -panelH / 2 + 232, `⭐ ${progress.totalStars()}/${LEVELS.length} stars total`, {
      fontSize: '22px',
      fontFamily: 'Nunito, sans-serif',
      fontStyle: 'bold',
      color: '#4a6478',
    }).setOrigin(0.5);

    // Three stacked buttons: primary progression action, restart-this-level,
    // and back-to-menu — in that priority order top to bottom.
    const BTN_MIN_W = Math.min(panelW - 60, 340);
    let primary;
    let restartBtn;
    let secondary;

    if (nextUnlocked) {
      primary = this.createPillButton(0, panelH / 2 - 222, `▶️ Next: ${LEVELS[nextIndex].name}`, {
        fontSize: '27px',
        paddingX: 24,
        paddingY: 18,
        bgColor: 0x51cf66,
        textColor: '#ffffff',
        minWidth: BTN_MIN_W,
        depth: 0,
      });
      primary.on('pointerdown', () => this.scene.start('NumberOrderScene', { levelIndex: nextIndex }));
    } else {
      primary = this.createPillButton(0, panelH / 2 - 222, '🏆 All levels complete!', {
        fontSize: '23px',
        paddingX: 24,
        paddingY: 18,
        bgColor: 0xffd93d,
        textColor: '#173b59',
        minWidth: BTN_MIN_W,
        depth: 0,
        interactive: false,
      });
    }

    restartBtn = this.createPillButton(0, panelH / 2 - 148, '🔄 Play Again', {
      fontSize: '25px',
      paddingX: 24,
      paddingY: 16,
      bgColor: 0x22b8cf,
      textColor: '#ffffff',
      minWidth: BTN_MIN_W,
      depth: 0,
    });
    restartBtn.on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));

    secondary = this.createPillButton(0, panelH / 2 - 78, '🏠 Level Select', {
      fontSize: '25px',
      paddingX: 24,
      paddingY: 16,
      bgColor: 0xffffff,
      textColor: '#173b59',
      borderColor: 0x173b59,
      minWidth: BTN_MIN_W,
      depth: 0,
    });
    secondary.on('pointerdown', () => this.scene.start('LevelSelectScene'));

    panel.add([panelBg, title, subtitle, star, starLabel, primary.container, restartBtn.container, secondary.container]);

    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 450,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: star,
          scale: 1,
          angle: 360,
          duration: 400,
          ease: 'Back.Out',
        });
        if (nextUnlocked) {
          this.tweens.add({
            targets: primary.container,
            scale: { from: 1, to: 1.06 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    });
  }
}