import * as Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  create() {
    const { width, height } = this.scale;

    this.score = 0;
    this.timeLeft = 15;

    this.add.rectangle(width / 2, height / 2, width, height, 0x8fe0fa);

    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '28px',
      fontFamily: 'sans-serif',
      color: '#0f172a',
    });

    this.timerText = this.add.text(width - 16, 16, '15s', {
      fontSize: '28px',
      fontFamily: 'sans-serif',
      color: '#0f172a',
    }).setOrigin(1, 0);

    this.star = this.add.text(width / 2, height / 2,  '⭐', {
      fontSize: '64px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.star.on('pointerdown', () => this.handleTap());

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.tickTimer(),
    });
  }

  handleTap() {
    this.score += 1;
    this.scoreText.setText(`Score: ${this.score}`);

    // Bounce + move to a new random spot, staying clear of the edges
    const { width, height } = this.scale;
    const margin = 60;
    const x = Phaser.Math.Between(margin, width - margin);
    const y = Phaser.Math.Between(margin + 60, height - margin);

    this.tweens.add({
      targets: this.star,
      scale: { from: 1.3, to: 1 },
      duration: 200,
      ease: 'Back.Out',
    });
    this.star.setPosition(x, y);
  }

  tickTimer() {
    this.timeLeft -= 1;
    this.timerText.setText(`${this.timeLeft}s`);

    if (this.timeLeft <= 0) {
      this.timerEvent.remove();
      this.star.disableInteractive();
      this.showGameOver();
    }
  }

  showGameOver() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5);

    this.add.text(width / 2, height / 2 - 30, `Time's up!\nFinal score: ${this.score}`, {
      fontSize: '32px',
      fontFamily: 'sans-serif',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    const restart = this.add.text(width / 2, height / 2 + 60, '🔁 Tap to play again', {
      fontSize: '24px',
      fontFamily: 'sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restart.on('pointerdown', () => this.scene.restart());
  }
}