// LevelSelectScene.js
// Level-select scene for Game 7. Lays out 4 level cards as a compact
// vertical list that fits common mobile viewport heights (~700-850px).
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

    // Full-screen background.
    const bg = this.add.image(width / 2, 0, 'background').setOrigin(0.5, 0).setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);

    // Title.
    this.add.text(width / 2, 56, 'Mama Bird\u2019s Eggs', {
      fontSize: '52px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 8,
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5).setDepth(10);

    this.createPillButton(width - 16, 16, `\u2B50 ${progress.totalStars()}/${LEVELS.length}`, {
      fontSize: '20px',
      paddingX: 16,
      paddingY: 10,
      anchor: 'topRight',
      interactive: false,
      depth: 15,
    });

    addMuteButton(this, 16, 16, { anchor: 'topLeft' });

    // 4 level cards laid out as a tight vertical stack.
    const cardW = Math.min(380, width - 40);
    const cardH = 110;
    const gapY = 14;
    const startY = Math.max(130, height * 0.16);
    const totalH = LEVELS.length * (cardH + gapY) - gapY;
    const maxStartY = height - totalH - 60;
    const adjustedStartY = startY > maxStartY ? maxStartY : startY;

    LEVELS.forEach((level, i) => {
      const cy = adjustedStartY + i * (cardH + gapY) + cardH / 2;
      const unlocked = progress.isLevelUnlocked(i);
      const starEarned = progress.getAllStars()[i];
      this.buildLevelCard(width / 2, cy, cardW, cardH, level, i, unlocked, starEarned);
    });
  }

  buildLevelCard(cx, cy, w, h, level, index, unlocked, starEarned) {
    const container = this.add.container(cx, cy).setDepth(10).setScale(0).setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      delay: 120 + index * 100,
      duration: 350,
      ease: 'Back.Out',
    });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, unlocked ? 1 : 0.75);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.lineStyle(4, unlocked ? 0x3fb6ea : 0xb9c4cc, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);

    const name = this.add.text(-w / 2 + 24, -22, level.name, {
      fontSize: '28px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const sub = this.add.text(-w / 2 + 24, 10, level.subtitle, {
      fontSize: '18px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#4a6478',
    }).setOrigin(0, 0.5);

    const starIcon = this.add.text(w / 2 - 16, 0, starEarned ? '\u2B50' : '\u2606', {
      fontSize: '28px',
    }).setOrigin(0.5, 0.5);

    container.add([bg, name, sub, starIcon]);

    if (!unlocked) {
      const lockOverlay = this.add.rectangle(0, 0, w, h, 0x0f3d5c, 0.38).setOrigin(0.5);
      const lock = this.add.text(w / 2 - 40, 0, '\uD83D\uDD12', { fontSize: '30px' }).setOrigin(0.5);
      container.add([lockOverlay, lock]);
      return;
    }

    // Matching Game4's pattern: pointerdown for press-bounce, pointerup for transition.
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
      this.scene.start('GameScene', { levelIndex: index });
    });
  }
}
