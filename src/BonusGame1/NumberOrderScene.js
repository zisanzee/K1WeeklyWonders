// NumberOrderScene.js
import * as Phaser from 'phaser';
import { LEVELS, labelForValue } from './levels';
import { createPillButton } from './uiHelpers';
import {
  makeBackgroundTexture,
  makeCloudTexture,
  makeSplatTexture,
  makeConfettiTexture,
  makeConfettiSquareTexture,
  makeItemTexture,
  makeOrderTitleTexture,
} from './sceneAssets';
import { completeLevel, isLevelUnlocked, totalStars } from './starProgress';
import { speak } from './speech';

const TEXTURE_PADDING = 4;
const SPLAT_HOLD_MS = 3000; // how long a splat sits at full strength before fading
const SPLAT_FADE_MS = 500;
const POP_SOUND_KEYS = ['pop1', 'pop2', 'pop3'];

export default class NumberOrderScene extends Phaser.Scene {
  constructor() {
    super('NumberOrderScene');
  }

  init(data) {
    this.levelIndex = Phaser.Math.Clamp(data?.levelIndex ?? 0, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
  }

  // Thin wrapper so the rest of the class can keep calling
  // this.createPillButton(...) like before.
  createPillButton(x, y, initialLabel, opts = {}) {
    return createPillButton(this, x, y, initialLabel, opts);
  }

  labelFor(value) {
    return labelForValue(this.level, value);
  }

  // A single big number/word — no caption, no label — showing whatever the
  // player just correctly tapped. Built by hand (rather than
  // createPillButton) purely so the value text can run large and the chip
  // can resize itself around each new value, including the longest spelled
  // words in the word-based levels.
  createLastTappedChip(x, y) {
    const paddingX = 26;
    const height = 74;
    const minWidth = 90;

    const value = this.add.text(0, 1, '–', {
      fontSize: '40px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);

    const shadow = this.add.graphics();
    const bg = this.add.graphics();
    let currentBg = 0xffd93d; // bright gold, matches the rest of the UI's accent color

    const redraw = () => {
      const w = Math.max(value.width + paddingX * 2, minWidth);
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

    const container = this.add.container(x, y, [shadow, bg, value]).setDepth(20);

    return {
      container,
      setValue: (label) => {
        value.setText(label);
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
    this.muted = false;

    // Guard against a leftover instance from a previous "Play again" —
    // scene.restart() re-runs create(), and without this a second overlap
    // would start playing alongside the new one.
    this.sound.removeByKey('bgMusic');
    this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.32 });

    const bgKey = makeBackgroundTexture(this, width, height, level, `bg-${level.key}`);
    this.add.image(width / 2, height / 2, bgKey);

    const cloudKey = makeCloudTexture(this);
    const driftClouds = [
      this.add.image(width * 0.24, height * 0.055, cloudKey).setScale(0.85).setAlpha(0.85),
      this.add.image(width * 0.74, height * 0.1, cloudKey).setScale(1.1).setAlpha(0.7),
    ];
    driftClouds.forEach((cloud, i) => {
      this.tweens.add({
        targets: cloud,
        x: cloud.x + (i % 2 === 0 ? 24 : -20),
        duration: 6500 + i * 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

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




    
    this.muteBtn = this.createPillButton(16, 16, '🔊', {
      fontSize: '28px',
      paddingX: 4,
      paddingY: 4,
      minWidth: ICON_BTN_SIZE,
      anchor: 'topLeft',
      depth: 20,
      simple: true,
    });
    this.muteBtn.on('pointerdown', () => {
      this.muted = !this.muted;
      this.sound.mute = this.muted;
      this.muteBtn.setText(this.muted ? '🔇' : '🔊');
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
    this.events.once('shutdown', () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    });
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
      if (!this.muted) this.bgMusic.play();

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

    speak(this.direction === 'desc' ? 'Tap the numbers from biggest to smallest!' : 'Tap the numbers from smallest to biggest!', this.muted);

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

      this.nextChip.setValue(this.labelFor(justTapped));
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

    speak('Good job!', this.muted);

    // Award the star + unlock the next level before anything below reads
    // progress back out (the total-stars chip, the "Next Level" button's
    // availability, etc. all depend on this having already happened).
    completeLevel(this.levelIndex);
    const isLastLevel = this.levelIndex === LEVELS.length - 1;
    const nextIndex = this.levelIndex + 1;
    const nextUnlocked = !isLastLevel && isLevelUnlocked(nextIndex);

    // Hand the finished run's numbers off to React — this scene doesn't
    // know the player's name or how to log a session, it just reports what
    // happened. `this.game.events` is the one event bus that's reachable
    // from both sides: Phaser exposes it on every Scene as `this.game`, and
    // PhaserGame.jsx holds the same Game instance in `gameRef.current`.
    // `stars` scales with the level itself (Level 1 → 1 star, Level 2 → 2
    // stars, etc.) rather than always being a flat 1. `totalRounds` has to
    // scale right alongside it — the server clamps
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
    const starLabel = this.add.text(0, -panelH / 2 + 232, `⭐ ${totalStars()}/${LEVELS.length} stars total`, {
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