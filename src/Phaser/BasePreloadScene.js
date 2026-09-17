// Phaser/BasePreloadScene.js
import * as Phaser from 'phaser';

// Generic loading scene shared by every bonus game: draws the same
// 3-stop sky gradient + bouncing emoji + real (loader-driven) progress
// bar as BonusGame1's original PreloadScene, but takes what to load and
// where to go next as constructor config instead of hard-coding them —
// so a new game only needs to hand it its own asset manifest and theme,
// e.g.:
//
//   new BasePreloadScene({
//     key: 'PreloadScene',
//     assets: [{ type: 'audio', key: 'pop1', url: '/PhaserAssets/pop_fx/pop-1.mp3' }],
//     nextSceneKey: 'LevelSelectScene',
//   })
//
// Phaser.Game accepts scene *instances* (not just classes) in its scene
// array, which is what makes per-game config like this possible without
// every game needing its own PreloadScene.js file.
export default class BasePreloadScene extends Phaser.Scene {
  constructor({
    key = 'PreloadScene',
    assets = [],
    nextSceneKey,
    // Numeric hex colors (not CSS strings) — fillGradientStyle wants
    // 0xRRGGBB, and this defaults to the same 3-stop sky BonusGame1 uses
    // so there's no visible seam handing off to a level-select menu that
    // bakes the same gradient into its own background texture.
    bgColors = [0x3fb6ea, 0x8fe0fa, 0xffe9a8],
    midStop = 0.55,
    loadingEmoji = '🎈',
    loadingText = 'Getting the game ready...',
  } = {}) {
    super(key);
    this.assetManifest = assets;
    this.nextSceneKey = nextSceneKey;
    this.bgColors = bgColors;
    this.midStop = midStop;
    this.loadingEmoji = loadingEmoji;
    this.loadingText = loadingText;
  }

  preload() {
    const { width, height } = this.scale;
    const [top, mid, bottom] = this.bgColors;
    const midY = height * this.midStop;

    // Two stacked gradient rects (rather than one 3-stop CanvasGradient)
    // — fillGradientStyle only takes a start/end color pair, so a real
    // 3-stop blend is two of these back to back.
    const bg = this.add.graphics();
    bg.fillGradientStyle(top, top, mid, mid, 1);
    bg.fillRect(0, 0, width, midY);
    bg.fillGradientStyle(mid, mid, bottom, bottom, 1);
    bg.fillRect(0, midY, width, height - midY);

    const emoji = this.add.text(width / 2, height / 2 - 130, this.loadingEmoji, { fontSize: '64px' }).setOrigin(0.5);
    emoji.setPadding({ top: 24, bottom: 8 });
    this.tweens.add({
      targets: emoji,
      y: emoji.y - 14,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(width / 2, height / 2 - 60, this.loadingText, {
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

    this.assetManifest.forEach(({ type, key, url, config }) => {
      if (type === 'audio') this.load.audio(key, url);
      else if (type === 'image') this.load.image(key, url);
      else if (type === 'spritesheet') this.load.spritesheet(key, url, config);
      else if (type === 'atlas') this.load.atlas(key, url, config);
    });
  }

  create() {
    if (this.nextSceneKey) this.scene.start(this.nextSceneKey);
  }
}
