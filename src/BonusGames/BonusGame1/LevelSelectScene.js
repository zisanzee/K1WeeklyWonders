// LevelSelectScene.js
import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { LEVELS, progress } from './levels';

// A neutral sky theme for the menu itself, independent of any one level.
const MENU_THEME = {
  bgColors: ['#3fb6ea', '#8fe0fa', '#ffe9a8'],
  groundColor: 'rgba(111, 207, 87, 0.85)',
};

export default class LevelSelectScene extends BaseScene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    const { width, height } = this.scale;

    // Background music starts here, at the menu, so it's the very first
    // thing a player hears rather than staying silent until they've
    // already picked a level. this.sound is the Phaser SoundManager for
    // the whole Game instance (shared across every scene), so if
    // NumberOrderScene already created/started this same 'bgMusic'
    // instance — e.g. the player tapped "Level Select" mid-song — reuse
    // it and leave it playing instead of restarting it from the top.
    this.bgMusic = this.sound.get('bgMusic') || this.sound.add('bgMusic', { loop: true, volume: 0.62 });
    if (!this.bgMusic.isPlaying) this.bgMusic.play();

    this.addSkyBackground(MENU_THEME, 'bg-menu');
    this.addDriftingClouds([
      { xr: 0.22, yr: 0.055, scale: 0.8, alpha: 0.8, driftX: 22, duration: 6500 },
      { xr: 0.72, yr: 0.09, scale: 1.05, alpha: 0.8, driftX: -18, duration: 7700 },
    ]);

const title = this.add.text(width / 2, 56, 'NUMBER POP!', {
  fontSize: '44px',
  fontFamily: 'Fredoka',
  fontStyle: '900',
  color: '#FFE14A',          // Bright golden yellow
  stroke: '#1E4F8A',         // Deep blue outline
  strokeThickness: 8,
  letterSpacing: 3,
  align: 'center',
}).setOrigin(0.5);
title.setOrigin(0.5, 0.5);
title.updateDisplayOrigin();

title.setShadow(
  0,
  6,
  '#18406f',
  0,
  false,
  true
);
this.tweens.add({
  targets: title,
 
  angle: 2.5,          // Rotate slightly clockwise
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

    // Mute toggle, mirroring the one on NumberOrderScene — both just flip
    // this.sound.mute directly (rather than a separate scene-local flag),
    // so muting here or mid-level always stays in sync everywhere.
    const muteBtn = this.createPillButton(16, 16, this.sound.mute ? '🔇' : '🔊', {
      fontSize: '28px',
      paddingX: 4,
      paddingY: 4,
      minWidth: 96,
      anchor: 'topLeft',
      depth: 20,
      simple: true,
    });
    muteBtn.on('pointerdown', () => {
      this.sound.mute = !this.sound.mute;
      muteBtn.setText(this.sound.mute ? '🔇' : '🔊');
    });

    const stars = progress.getAllStars();
    const cardW = Math.min(290, (width - 60) / 2);
    const cardH = 230;
    const gapX = 20;
    const gapY = 22;
    const gridWidth = cardW * 2 + gapX;
    const startX = width / 2 - gridWidth / 2;
    const startY = 130;

    LEVELS.forEach((level, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      const unlocked = progress.isLevelUnlocked(i);
      this.buildLevelCard(cx, cy, cardW, cardH, level, i, unlocked, stars[i]);
    });
  }

  buildLevelCard(cx, cy, w, h, level, index, unlocked, starEarned) {
    const container = this.add.container(cx, cy).setDepth(10).setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      delay: 150 + index * 90,
      duration: 380,
      ease: 'Back.Out',
    });

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 24);

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, unlocked ? 1 : 0.75);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.lineStyle(4, unlocked ? level.accentColor : 0xb9c4cc, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);

    const emoji = this.add.text(0, -h / 2 + 54, level.icon, { fontSize: '50px' }).setOrigin(0.5);
    const name = this.add.text(0, -h / 2 + 108, level.name, {
      fontSize: '32px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#0f3d5c',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    const sub = this.add.text(0, -h / 2 + 140, level.subtitle, {
      fontSize: '18px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#4a6478',
      align: 'center',
      wordWrap: { width: w - 30 },
    }).setOrigin(0.5);

    const starIcon = this.add.text(0, h / 2 - 34, starEarned ? '⭐' : '☆', { fontSize: '32px' }).setOrigin(0.5);

    container.add([shadow, bg, emoji, name, sub, starIcon]);

    if (!unlocked) {
      const lockOverlay = this.add.rectangle(0, 0, w, h, 0x0f3d5c, 0.38).setOrigin(0.5);
      const lock = this.add.text(0, -6, '🔒', { fontSize: '42px' }).setOrigin(0.5);
      container.add([lockOverlay, lock]);
      return;
    }

    const hitRect = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    container.setInteractive({
      hitArea: hitRect,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    // Gentle idle pulse on unlocked cards so it's clear they're tappable.
    this.tweens.add({
      targets: container,
      scale: { from: 1, to: 1.03 },
      duration: 900 + index * 80,
      delay: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    container.on('pointerdown', () => {
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scale: 0.94, duration: 80 });
    });
    container.on('pointerup', () => {
      this.scene.start('NumberOrderScene', { levelIndex: index });
    });
  }
}
