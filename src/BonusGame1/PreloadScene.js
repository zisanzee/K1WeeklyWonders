import * as Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const { width, height } = this.scale;

// A real vertical gradient, not flat bands -- matches the 3-stop sky
    // gradient the main scene bakes into its background canvas texture
    // (#3fb6ea -> #8fe0fa -> #ffe9a8), so there's no visible seam or color
    // jump when this hands off to the real game. fillGradientStyle takes
    // 4 corner colors; using the same color for both top corners and both
    // bottom corners of each rect gives a smooth top-to-bottom blend.
    const bg = this.add.graphics();
    const midY = height * 0.55;
    bg.fillGradientStyle(0x3fb6ea, 0x3fb6ea, 0x8fe0fa, 0x8fe0fa, 1);
    bg.fillRect(0, 0, width, midY);
    bg.fillGradientStyle(0x8fe0fa, 0x8fe0fa, 0xffe9a8, 0xffe9a8, 1);
    bg.fillRect(0, midY, width, height - midY);

const emoji = this.add.text(width / 2, height / 2 - 130, '🎈', { fontSize: '64px' }).setOrigin(0.5);
emoji.setPadding({ top: 24, bottom: 8 });
    this.tweens.add({
      targets: emoji,
      y: emoji.y - 14,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(width / 2, height / 2 - 60, 'Getting the game ready...', {
      fontSize: '22px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 60 },
    }).setOrigin(0.5);

    // Real progress bar, driven by the loader's own 'progress' event --
    // this reflects the actual bytes downloaded, not a fake timer.
    const barWidth = Math.min(280, width - 80);
    const barHeight = 20;
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 + 20;

    const track = this.add.graphics();
    track.fillStyle(0xffffff, 0.35);
    track.fillRoundedRect(barX, barY, barWidth, barHeight, barHeight / 2);

    const fill = this.add.graphics();
    this.load.on('progress', (value) => {
      fill.clear();
      fill.fillStyle(0xffd93d, 1);
const fillWidth = barWidth * value;
      const radius = Math.min(barHeight / 2, fillWidth / 2);
       if (fillWidth > 0) {
        fill.fillRoundedRect(barX, barY, fillWidth, barHeight, radius);
     }
    });

    this.load.audio('pop1', '/PhaserAssets/pop_fx/pop-1.mp3');
    this.load.audio('pop2', '/PhaserAssets/pop_fx/pop-2.mp3');
    this.load.audio('pop3', '/PhaserAssets/pop_fx/pop-3.mp3');
    this.load.audio('wrong', '/PhaserAssets/wrong.wav');
    this.load.audio('bgMusic', '/PhaserAssets/bg_music.m4a');
  }

  create() {
    this.scene.start('NumberOrderScene');
  }
}