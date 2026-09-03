// LevelSelectScene.js
import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { LEVELS, progress } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';


export default class LevelSelectScene extends BaseScene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    const { width, height } = this.scale;

    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));

    const bg = this.add.image(width / 2, 0, 'background').setOrigin(0.5, 0).setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);

const title = this.add.text(width / 2, 164, 'Bigger or Smaller?', {
  fontSize: '64px',
  fontFamily: 'Fredoka, sans-serif',
  fontStyle: 'bold',
  color: '#f8fafc',
  stroke: '#6d28d9',
  strokeThickness: 10,
  align: 'center',
  wordWrap: { width: width - 60 },
  shadow: {
    offsetX: 0,
    offsetY: 5,
    color: '#4c1d95',
    blur: 0,
    stroke: true,
    fill: true,
  },
  padding: { top: 6, bottom: 6, left: 10, right: 10 },
}).setOrigin(0.5).setDepth(20);



    this.tweens.add({
      targets: title,
      angle: 2,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.createPillButton(width - 16, 16, `⭐ ${progress.totalStars()}/${LEVELS.length}`, {
      fontSize: '20px',
      paddingX: 16,
      paddingY: 10,
      anchor: 'topRight',
      interactive: false,
      depth: 15,
    });

    addMuteButton(this, 16, 16, { anchor: 'topLeft' });

    const stars = progress.getAllStars();
    const cardW = Math.min(520, width - 10);
    const cardH = 300;
    const gapY = 50;
    const startY = 200;

    LEVELS.forEach((level, i) => {
      const cy = startY + i * (cardH + gapY) + cardH / 1.5;
      const unlocked = progress.isLevelUnlocked(i);
      this.buildLevelCard(width / 2, cy, cardW, cardH, level, i, unlocked, stars[i]);
    });
  }

  buildLevelCard(cx, cy, w, h, level, index, unlocked, starEarned) {
    const container = this.add.container(cx, cy).setDepth(10).setScale(0).setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      delay: 150 + index * 120,
      duration: 380,
      ease: 'Back.Out',
    });

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 28);

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, unlocked ? 1 : 0.75);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    bg.lineStyle(5, unlocked ? level.accentColor : 0xb9c4cc, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 28);

    // Image icon instead of emoji text.
    // IMPORTANT: level.icon must already be loaded as a Phaser texture key,
    // or you should load it in your preload scene using the same key.
   
const icon = this.add.image(-w / 2 + 70, 0, level.icon)
  .setOrigin(0.5);

const maxSize = level.iconSize ?? 82;
const scale = Math.min(maxSize / icon.width, maxSize / icon.height);
icon.setScale(scale);

    const name = this.add.text(-w / 2 + 150, -34, level.name, {
      fontSize: '40px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const sub = this.add.text(-w / 2 + 150, 4, level.subtitle, {
      fontSize: '30px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#4a6478',
      wordWrap: { width: w - 120 },
    }).setOrigin(0, 0.5);

    const starIcon = this.add.text(-w / 2 + 150, 42, starEarned ? '⭐ Complete!' : '☆ Not started', {
      fontSize: '18px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#8a97a3',
    }).setOrigin(0, 0.5);

    container.add([shadow, bg, icon, name, sub, starIcon]);

    if (!unlocked) {
      const lockOverlay = this.add.rectangle(0, 0, w, h, 0x0f3d5c, 0.38).setOrigin(0.5);
      const lock = this.add.text(w / 2 - 46, 0, '🔒', { fontSize: '40px' }).setOrigin(0.5);
      container.add([lockOverlay, lock]);
      return;
    }

    const hitRect = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    container.setInteractive({
      hitArea: hitRect,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.tweens.add({
      targets: container,
      scale: { from: 1, to: 1.02 },
      duration: 950 + index * 100,
      delay: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    container.on('pointerdown', () => {
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scale: 0.96, duration: 80 });
    });

    container.on('pointerup', () => {
      this.scene.start('CompareDiceScene', { levelIndex: index });
    });
  }
}