import * as Phaser from 'phaser';

const NUMBER_COLORS = [
  0xff6b6b, // 1
  0xffa94d, // 2
  0xffd43b, // 3
  0x94d82d, // 4
  0x51cf66, // 5
  0x20c997, // 6
  0x22b8cf, // 7
  0x4dabf7, // 8
  0x845ef7, // 9
  0xf783ac, // 10
];

const BUBBLE_RADIUS = 34;
const TOTAL_NUMBERS = 10;

export default class NumberOrderScene extends Phaser.Scene {
  constructor() {
    super('NumberOrderScene');
  }

  create() {
    const { width, height } = this.scale;

    this.nextExpected = 1;
    this.elapsedSeconds = 0;
    this.finished = false;

    // Sky background + a couple of soft cloud puffs, matching the site's theme
    this.add.rectangle(width / 2, height / 2, width, height, 0x8fe0fa);
    this.add.circle(width * 0.15, height * 0.1, 26, 0xffffff, 0.85);
    this.add.circle(width * 0.15 + 22, height * 0.1 + 6, 20, 0xffffff, 0.85);
    this.add.circle(width * 0.85, height * 0.16, 22, 0xffffff, 0.8);
    this.add.circle(width * 0.85 + 18, height * 0.16 + 5, 16, 0xffffff, 0.8);

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
      backgroundColor: '#ffffffaa',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5);

    this.timerText = this.add.text(width - 16, 16, '0s', {
      fontSize: '20px',
      fontFamily: 'Nunito, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    // A tiny generated dot texture, reused for the "pop" particle burst
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();

    // Keep the play area below the HUD text
    this.physics.world.setBounds(0, 100, width, height - 110);

    this.bubbles = this.createBubbles(width, height);
    this.physics.add.collider(this.bubbles);

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

      const circle = this.add.circle(x, y, BUBBLE_RADIUS, NUMBER_COLORS[value - 1]);
      circle.setStrokeStyle(4, 0xffffff, 0.9);
      circle.value = value;
      circle.setInteractive({ useHandCursor: true });

      this.physics.add.existing(circle);
      circle.body.setCircle(BUBBLE_RADIUS);
      circle.body.setCollideWorldBounds(true);
      circle.body.setBounce(1, 1);

      const speed = Phaser.Math.Between(70, 130);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      circle.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

      const label = this.add.text(x, y, String(value), {
        fontSize: '30px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      circle.label = label;

      // Gentle idle "breathing" bounce, layered on top of the physics motion
      this.tweens.add({
        targets: circle,
        scale: { from: 0.94, to: 1.06 },
        duration: Phaser.Math.Between(700, 1000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      circle.on('pointerdown', () => this.handleTap(circle));

      bubbles.push(circle);
    });

    return bubbles;
  }

  handleTap(circle) {
    if (this.finished || !circle.active) return;

    if (circle.value === this.nextExpected) {
      this.popBubble(circle);
      this.nextExpected += 1;

      if (this.nextExpected > TOTAL_NUMBERS) {
        this.finished = true;
        this.timerEvent.remove();
        this.time.delayedCall(300, () => this.showComplete());
      } else {
        this.nextText.setText(`Next: ${this.nextExpected}`);
      }
    } else {
      this.wrongTap(circle);
    }
  }

  popBubble(circle) {
    const emitter = this.add.particles(circle.x, circle.y, 'dot', {
      speed: { min: 60, max: 160 },
      lifespan: 400,
      scale: { start: 1.4, end: 0 },
      quantity: 14,
      tint: NUMBER_COLORS[circle.value - 1],
    });
    emitter.explode(14);
    this.time.delayedCall(450, () => emitter.destroy());

    circle.body.setVelocity(0, 0);
    circle.disableInteractive();

    this.tweens.add({
      targets: [circle, circle.label],
      scale: 0,
      alpha: 0,
      duration: 250,
      ease: 'Back.In',
      onComplete: () => {
        circle.label.destroy();
        circle.destroy();
      },
    });
  }

  wrongTap(circle) {
    this.cameras.main.shake(150, 0.004);
    const originalColor = circle.fillColor;
    circle.setFillStyle(0xff4d4f);
    this.nextText.setBackgroundColor('#ff4d4f');

    this.time.delayedCall(180, () => {
      if (circle.active) circle.setFillStyle(originalColor);
      this.nextText.setBackgroundColor('#ffffffaa');
    });
  }

  showComplete() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55);

    this.add.text(width / 2, height / 2 - 60, '🎉 Great counting!', {
      fontSize: '32px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 15, `You did it in ${this.elapsedSeconds}s`, {
      fontSize: '22px',
      fontFamily: 'Nunito, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5);

    const restart = this.add.text(width / 2, height / 2 + 50, '🔁 Play again', {
      fontSize: '24px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      backgroundColor: '#ffffff',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restart.on('pointerdown', () => this.scene.restart());
  }

  update() {
    if (!this.bubbles) return;
    this.bubbles.forEach((circle) => {
      if (circle.active && circle.label) {
        circle.label.setPosition(circle.x, circle.y);
      }
    });
  }
}