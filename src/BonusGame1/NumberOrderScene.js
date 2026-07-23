// NumberOrderScene.js
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
const POP_SOUND_KEYS = ['pop1', 'pop2', 'pop3'];

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
  ctx.arc(c, c, BUBBLE_RADIUS - 1.5, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
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
  ctx.font = 'bold 32px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(String(value), c, c + 2);

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
function makeConfettiSquareTexture(scene) {
  const key = 'confetti-square';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 8, 8);
  g.generateTexture(key, 8, 8);
  g.destroy();
  return key;
}

export default class NumberOrderScene extends Phaser.Scene {
  constructor() {
    super('NumberOrderScene');
  }



  // ---------------------------------------------------------------------
  // Reusable rounded "pill" button/chip — Phaser's built-in Text
  // backgroundColor is always a flat, square-cornered rectangle, which is
  // why plain text-with-background looked out of place next to the rest of
  // the app's rounded, shadowed buttons. This draws a real rounded rect
  // with a drop "step" shadow and press feedback (the shadow ducks under
  // the button on press, same idea as the CSS active:shadow-none buttons
  // used everywhere else in the app), and works equally well as a static
  // status chip (interactive: false) or a tappable button.
  // ---------------------------------------------------------------------
  createPillButton(x, y, initialLabel, opts = {}) {
  const {
  fontSize = '20px',
  bgColor = 0xffffff,
  textColor = '#173b59',
  paddingX = 18,
  paddingY = 10,
  anchor = 'center',
  borderColor = null,
  depth = 20,
  interactive = true,
  minWidth = 0,
  simple = false,
} = opts;

  const text = this.add.text(0, 0, initialLabel, {
    fontSize,
    fontFamily: 'Fredoka, sans-serif',
    color: textColor,
    fontStyle: 'bold',
  }).setOrigin(0.5);

  let w = Math.max(text.width + paddingX * 2, minWidth);
  let h = text.height + paddingY * 2;
  const radius = h / 2;
  let currentBg = bgColor;

  // ox/oy = where the pill's CENTER sits, relative to the container's
  // origin (x,y), given which corner/edge that origin represents.
  const offsetFor = (ww) => {
    if (anchor === 'topLeft') return { ox: ww / 2, oy: h / 2 };
    if (anchor === 'topRight') return { ox: -ww / 2, oy: h / 2 };
    return { ox: 0, oy: 0 };
  };
  let { ox, oy } = offsetFor(w);
  text.setPosition(ox, oy);

  const shadow = this.add.graphics();
  const bgGfx = this.add.graphics();

  const redraw = () => {
    shadow.clear();
    shadow.fillStyle(0x000000, 0.18);
    shadow.fillRoundedRect(ox - w / 2, oy - h / 2 + 4, w, h, radius);

    bgGfx.clear();
    bgGfx.fillStyle(currentBg, 1);
    bgGfx.fillRoundedRect(ox - w / 2, oy - h / 2, w, h, radius);
    if (borderColor !== null) {
      bgGfx.lineStyle(3, borderColor, 1);
      bgGfx.strokeRoundedRect(ox - w / 2, oy - h / 2, w, h, radius);
    }
  };
  redraw();

  const container = this.add.container(x, y, [shadow, bgGfx, text]).setDepth(depth);

  const HIT_SLOP = 10;
  const applyHitArea = () => {
    const hitW = w + HIT_SLOP * 2;
    const hitH = h + 4 + HIT_SLOP * 2;
    // Same center (ox, oy) as the graphics, padded out by HIT_SLOP on every
    // side — this is the ONLY thing that determines the tappable area.
    // (Container.setSize() does NOT affect hit-testing once an explicit
    // hitArea + hitAreaCallback is supplied below, so it's deliberately not
    // called here — leaving it in previously implied it mattered, when it
    // was actually just dead weight.)
    const rect = new Phaser.Geom.Rectangle(ox - hitW / 2, oy - hitH / 2, hitW, hitH);
    if (interactive) {
      container.setInteractive({
        hitArea: rect,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    }
  };
  applyHitArea();

if (interactive && !simple) {
  container.on('pointerdown', () => {
    this.tweens.killTweensOf([bgGfx, text]);
    this.tweens.add({
      targets: [bgGfx, text],
      y: oy + 3,
      duration: 60,
    });
    shadow.setAlpha(0.4);
  });

  container.on('pointerup', () => {
    this.tweens.killTweensOf([bgGfx, text]);
    this.tweens.add({
      targets: [bgGfx, text],
      y: oy,
      duration: 90,
    });
    shadow.setAlpha(1);
  });

  container.on('pointerout', () => {
    this.tweens.killTweensOf([bgGfx, text]);
    this.tweens.add({
      targets: [bgGfx, text],
      y: oy,
      duration: 90,
    });
    shadow.setAlpha(1);
  });
}

  return {
    container,
    width: () => w,
    setText: (str) => {
      text.setText(str);
      w = Math.max(text.width + paddingX * 2, minWidth);
      ({ ox, oy } = offsetFor(w));
      text.setPosition(ox, oy);
      redraw();
      applyHitArea();
    },
    setBg: (colorHex) => {
      currentBg = colorHex;
      redraw();
    },
    on: (evt, cb) => container.on(evt, cb),
    destroy: () => container.destroy(),
  };
}

  create() {
    const { width, height } = this.scale;

    this.nextExpected = 1;
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

    this.nextChip = this.createPillButton(width / 2, 78, 'Next: 1', {
      fontSize: '22px',
      paddingX: 16,
      paddingY: 8,
      interactive: false,
      minWidth: 130,
      depth: 15,
    });

    this.timerChip = this.createPillButton(width - 16, 16, '0s', {
      fontSize: '18px',
      paddingX: 12,
      paddingY: 6,
      anchor: 'topRight',
      interactive: false,
      depth: 15,
    });

    // Restart + mute, available any time — during countdown, mid-game, or
    // after finishing — not just from the end screen. Fixed minWidth here
    // rather than relying on the emoji's measured text width, which some
    // browsers under-report for color emoji glyphs — that was causing
    // these two to crowd/overlap each other.
    const ICON_BTN_SIZE = 56;

this.restartBtn = this.createPillButton(16, 16, '🔁', {
  fontSize: '20px',
  paddingX: 10,
  paddingY: 8,
  minWidth: ICON_BTN_SIZE,
  anchor: 'topLeft',
  depth: 20,
  simple: true,
});
    this.restartBtn.on('pointerdown', () => this.scene.restart());

this.muteBtn = this.createPillButton(16 + ICON_BTN_SIZE + 12, 16, '🔊', {
  fontSize: '20px',
  paddingX: 10,
  paddingY: 8,
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

    this.physics.world.setBounds(0, 100, width, height - 110);

    this.bubbles = this.createBubbles(width, height);
    this.physics.add.collider(this.bubbles);

    this.physics.world.pause();

    // The game no longer starts itself — bubbles pop in and sit here,
    // gently breathing, behind a Play button until the player taps it.
    this.showPlayOverlay();
  }

  showPlayOverlay() {
    const { width, height } = this.scale;

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.35).setDepth(40);

    const title = this.add.text(width / 2, height / 2 - 70, 'Ready to pop\nsome bubbles?', {
      fontSize: '30px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(41);

    const playBtn = this.createPillButton(width / 2, height / 2 + 30, '▶️ Play', {
      fontSize: '30px',
      paddingX: 30,
      paddingY: 16,
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
    const order = Phaser.Utils.Array.NumberArray(1, TOTAL_NUMBERS);
    const placed = [];
    const bubbles = [];
    const hitCircle = new Phaser.Geom.Circle(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, BUBBLE_RADIUS);
    this.bubbleHitCircle = hitCircle;

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
      // NOT interactive yet — see enableBubbleInput(), called from startGame().
      // Bubbles are scattered across the whole play area, including right
      // where the Play button and countdown sit, so leaving them clickable
      // this whole time was stealing taps meant for those instead.

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
        this.nextChip.setText(`Next: ${this.nextExpected}`);
        this.tweens.add({
          targets: this.nextChip.container,
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
    this.popEmitter.explode(12, bubble.x, bubble.y);
    this.sound.play(Phaser.Utils.Array.GetRandom(POP_SOUND_KEYS), { volume: 0.6 });

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

    this.nextChip.setBg(0xff4d4f);
    this.time.delayedCall(200, () => {
      if (bubble.active) bubble.clearTint();
      this.nextChip.setBg(0xffffff);
    });
  }

  showComplete() {
    const { width, height } = this.scale;

    // Hand the finished run's numbers off to React — this scene doesn't
    // know the player's name or how to log a session, it just reports what
    // happened. `this.game.events` is the one event bus that's reachable
    // from both sides: Phaser exposes it on every Scene as `this.game`, and
    // PhaserGame.jsx holds the same Game instance in `gameRef.current`.
    this.game.events.emit('numberpop-complete', {
      elapsedSeconds: this.elapsedSeconds,
      mistakes: this.mistakes,
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
  tint: NUMBER_COLORS,
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
const leftPart = this.add.text(0, 0, 'You did it in ', {
  fontSize: '18px',
  fontFamily: 'Nunito, sans-serif',
  color: '#0f3d5c',
}).setOrigin(0, 0.5);

const scorePart = this.add.text(0, 0, `${this.elapsedSeconds}s`, {
  fontSize: '28px',
  fontFamily: 'Fredoka, sans-serif',
  fontStyle: 'bold',
  color: '#ff7a00',
}).setOrigin(0, 0.5);

const totalWidth = leftPart.width + scorePart.width;

leftPart.setPosition(-totalWidth / 2, 0);
scorePart.setPosition(-totalWidth / 2 + leftPart.width, 0);

const subtitle = this.add.container(0, -10, [leftPart, scorePart]);

    const restart = this.createPillButton(0, 55, '🔁 Play again', {
      fontSize: '20px',
      paddingX: 18,
      paddingY: 10,
      bgColor: 0x22b8cf,
      textColor: '#ffffff',
      depth: 0,
    });
    restart.on('pointerdown', () => this.scene.restart());

    panel.add([panelBg, title, subtitle, restart.container]);

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
          targets: restart.container,
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