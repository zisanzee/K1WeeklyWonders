import * as Phaser from 'phaser';

const NUMBER_COLORS = [
  0xff6b6b, 0xffa94d, 0xffd43b, 0x94d82d, 0x51cf66,
  0x20c997, 0x22b8cf, 0x4dabf7, 0x845ef7, 0xf783ac,
];

const BUBBLE_RADIUS = 34;
const TEXTURE_PADDING = 4;
const TEXTURE_SIZE = (BUBBLE_RADIUS + TEXTURE_PADDING) * 2;
const TOTAL_NUMBERS = 10;
const SPLAT_HOLD_MS = 3000; // how long a splat sits at full strength before fading
const SPLAT_FADE_MS = 500;

function makeBubbleTexture(scene, value, colorHex) {
  const key = `bubble-${value}`;
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');

  const c = TEXTURE_SIZE / 2;

  // ---------- Drop shadow ----------
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.beginPath();
  ctx.arc(c, c, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.fill();

  ctx.restore();

  // ---------- Radial lighting ----------
  const grad = ctx.createRadialGradient(
    c - 12,
    c - 14,
    6,
    c,
    c,
    BUBBLE_RADIUS
  );

  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');

  ctx.beginPath();
  ctx.arc(c, c, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // ---------- White border ----------
  ctx.beginPath();
  ctx.arc(c, c, BUBBLE_RADIUS - 1, 0, Math.PI * 2);


  // ---------- Small glossy highlight ----------
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(
    c - 12,
    c - 13,
    11,
    7,
    -0.4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // ---------- Tiny sparkle ----------
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(c - 4, c - 20, 2, 0, Math.PI * 2);
  ctx.fill();

  // ---------- Number ----------
  ctx.font = ' 32px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(String(value), c, c +2 );

  ctx.fillStyle = '#173b59';
  ctx.fillText(String(value), c, c + 2);

  scene.textures.addCanvas(key, canvas);

  return key;
}

function makeBackgroundTexture(scene, width, height) {
  const key = 'bg-sky';
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Sky gradient — matches the rest of the app instead of a flat fill.
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#3fb6ea');
  sky.addColorStop(0.55, '#8fe0fa');
  sky.addColorStop(1, '#ffe9a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun glow tucked in a back corner, well clear of the bubble play area.
  const sunX = width * 0.86;
  const sunY = height * 0.07;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 80);
  sunGlow.addColorStop(0, 'rgba(255,217,61,0.9)');
  sunGlow.addColorStop(1, 'rgba(255,217,61,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
  ctx.fill();

  // A couple of baked-in clouds for backdrop texture — two more, independent
  // sprites drift gently on top of this at runtime for a bit of parallax.
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

  // Soft rolling hill along the bottom, echoing the ground from the
  // homepage — purely decorative, sits behind every bubble.
  ctx.fillStyle = 'rgba(111, 207, 87, 0.85)';
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

function makeCloudTexture(scene) {
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

function makeSplatTexture(scene) {
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

function makeConfettiTexture(scene) {
  const key = 'confetti-dot';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 6, 10);
  g.generateTexture(key, 6, 10);
  g.destroy();
  return key;
}

export default class NumberOrderScene extends Phaser.Scene {
  constructor() {
    super('NumberOrderScene');
  }

  create() {
    const { width, height } = this.scale;

    this.nextExpected = 1;
    this.elapsedSeconds = 0;
    this.finished = false;
    this.locked = true;

    const bgKey = makeBackgroundTexture(this, width, height);
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

    this.add.text(width / 2, 34, 'Tap in order! 🔢', {
      fontSize: '26px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
    }).setOrigin(0.5);

this.nextText = this.add.text(width / 2, 74, 'Next: 1', {
  fontSize: '22px',
  fontFamily: 'Nunito, sans-serif',
  color: '#0f3d5c',
  fontStyle: 'bold',
  backgroundColor: '#ffffffdd',
  padding: { x: 14, y: 6 },
}).setOrigin(0.5);

this.nextText.setStroke('#ffffff', 3);

this.nextText.setShadow(
  2,
  2,
  '#00000033',
  3,
  false,
  true
);

    this.timerText = this.add.text(width - 16, 16, '0s', {
      fontSize: '20px',
      fontFamily: 'Nunito, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    // Restart button, available any time -- during countdown, mid-game, or
    // after finishing -- not just from the end screen.
    const restartButton = this.add.text(16, 16, '🔁', {
      fontSize: '20px',
      backgroundColor: '#ffffffaa',
      padding: { x: 8, y: 4 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(20);
    restartButton.on('pointerdown', () => this.scene.restart());
    this.addHoverFeedback(restartButton);

    const dotG = this.make.graphics({ x: 0, y: 0, add: false });
    dotG.fillStyle(0xffffff, 1);
    dotG.fillCircle(7, 7, 7);
    dotG.generateTexture('dot', 14, 14);
    dotG.destroy();

    this.popEmitter = this.add.particles(0, 0, 'dot', {
      speed: { min: 100, max: 260 },
      lifespan: 550,
      scale: { start: 1.8, end: 0 },
      quantity: 20,
      tint: [0xffd93d, 0xffffff, 0xff9f45],
      emitting: false,
    }).setDepth(15);

    this.physics.world.setBounds(0, 100, width, height - 110);

    this.bubbles = this.createBubbles(width, height);
    this.physics.add.collider(this.bubbles);

    this.physics.world.pause();

    this.runCountdown(['3', '2', '1', 'GO!'], () => this.startGame());
  }

  // A small scale bump on hover/press so buttons feel tappable rather than
  // flat text — cheap (one tween per event, no continuous cost when idle).
  addHoverFeedback(obj) {
    obj.on('pointerover', () => {
      this.tweens.add({ targets: obj, scale: 1.08, duration: 120, ease: 'Sine.easeOut' });
    });
    obj.on('pointerout', () => {
      this.tweens.add({ targets: obj, scale: 1, duration: 120, ease: 'Sine.easeOut' });
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

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.finished) return;
        this.elapsedSeconds += 1;
        this.timerText.setText(`${this.elapsedSeconds}s`);
      },
    });
  }

  createBubbles(width, height) {
    const order = Phaser.Utils.Array.NumberArray(1, TOTAL_NUMBERS);
    const placed = [];
    const bubbles = [];
    const hitCircle = new Phaser.Geom.Circle(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, BUBBLE_RADIUS);

    order.forEach((value) => {
      let x, y, tries = 0;
      do {
        x = Phaser.Math.Between(BUBBLE_RADIUS + 10, width - BUBBLE_RADIUS - 10);
        y = Phaser.Math.Between(BUBBLE_RADIUS + 110, height - BUBBLE_RADIUS - 10);
        tries += 1;
      } while (
        tries < 30 &&
        placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < BUBBLE_RADIUS * 2.3)
      );
      placed.push({ x, y });

      const key = makeBubbleTexture(this, value, NUMBER_COLORS[value - 1]);
      const bubble = this.physics.add.image(x, y, key);
      bubble.value = value;
      bubble.setDepth(10); // stays above splats (depth 1) regardless of add order
      bubble.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);

      bubble.body.setCircle(BUBBLE_RADIUS, TEXTURE_PADDING, TEXTURE_PADDING);
      bubble.body.setCollideWorldBounds(true);
      bubble.body.setBounce(1, 1);

      const speed = Phaser.Math.Between(70, 130);
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

      bubble.on('pointerdown', () => this.handleTap(bubble));

      bubbles.push(bubble);
    });

    return bubbles;
  }

  handleTap(bubble) {
    if (this.locked || this.finished || !bubble.active) return;

    if (bubble.value === this.nextExpected) {
      this.popBubble(bubble);
      this.nextExpected += 1;

      if (this.nextExpected > TOTAL_NUMBERS) {
        this.finished = true;
        this.timerEvent.remove();
        this.time.delayedCall(300, () => this.showComplete());
      } else {
        this.nextText.setText(`Next: ${this.nextExpected}`);
        this.tweens.add({
          targets: this.nextText,
          scale: { from: 1.3, to: 1 },
          duration: 240,
          ease: 'Back.Out',
        });
      }
    } else {
      this.wrongTap(bubble);
    }
  }

  popBubble(bubble) {
    this.popEmitter.explode(20, bubble.x, bubble.y);

    // A standalone splat image, same color as the bubble that popped,
    // sitting behind the remaining bubbles (depth 1 vs their depth 10).
    // It holds at full strength for a couple of seconds, then fades and
    // removes itself -- nothing persists indefinitely.
    const splat = this.add.image(bubble.x, bubble.y, 'splat');
    splat.setTint(NUMBER_COLORS[bubble.value - 1]);
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
      fontSize: '34px',
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

    this.nextText.setBackgroundColor('#ff4d4f');
    this.time.delayedCall(200, () => {
      if (bubble.active) bubble.clearTint();
      this.nextText.setBackgroundColor('#ffffffaa');
    });
  }

  showComplete() {
    const { width, height } = this.scale;

    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1).setDepth(60);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });

    const confettiKey = makeConfettiTexture(this);
    const confetti = this.add.particles(width / 2, -20, confettiKey, {
      x: { min: 0, max: width },
      y: -20,
      quantity: 4,
      frequency: 40,
      lifespan: 2200,
      speedY: { min: 150, max: 260 },
      speedX: { min: -60, max: 60 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.8 },
      tint: NUMBER_COLORS,
    }).setDepth(61);
    this.time.delayedCall(2600, () => confetti.destroy());

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55)
      .setDepth(55).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 250 });

    const panel = this.add.container(width / 2, height / 2).setDepth(56).setScale(0.3).setAlpha(0);
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0xffffff, 1);
    panelBg.fillRoundedRect(-140, -100, 280, 200, 28);
    panelBg.lineStyle(6, 0xffd93d, 1);
    panelBg.strokeRoundedRect(-140, -100, 280, 200, 28);
    const title = this.add.text(0, -60, '🎉 Great counting!', {
      fontSize: '24px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 250 },
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, -10, `You did it in ${this.elapsedSeconds}s`, {
      fontSize: '18px',
      fontFamily: 'Nunito, sans-serif',
      color: '#0f3d5c',
    }).setOrigin(0.5);
    const restart = this.add.text(0, 55, '🔁 Play again', {
      fontSize: '20px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#ffffff',
      backgroundColor: '#22b8cf',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    restart.on('pointerdown', () => this.scene.restart());

    panel.add([panelBg, title, subtitle, restart]);

    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 450,
      ease: 'Back.Out',
      onComplete: () => {
        // A gentle, ongoing invite-to-tap pulse — separate from hover
        // feedback, since this one needs to keep going even before anyone
        // has touched the button.
        this.tweens.add({
          targets: restart,
          scale: { from: 1, to: 1.06 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    const starPositions = [[-110, -90], [110, -90], [-110, 90], [110, 90]];
    starPositions.forEach(([sx, sy], idx) => {
      const star = this.add.text(sx, sy, '⭐', { fontSize: '26px' }).setOrigin(0.5).setScale(0);
      panel.add(star);
      this.tweens.add({
        targets: star,
        scale: 1,
        angle: 360,
        delay: 500 + idx * 120,
        duration: 400,
        ease: 'Back.Out',
      });
    });
  }
}