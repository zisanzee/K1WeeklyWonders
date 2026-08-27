// GameScene.js
// Game 9 — "Polly's Treasure Quest" (Number Bonds via Keys & Chests).
//
// One continuous 10-round run in a single scene. Rounds 1-5 are "find the
// chest" (the question shows one key of each half and the child taps the
// chest that holds them both); rounds 6-10 are "find the keys" (the chest
// shows a total and the child picks one first-half key + one second-half key
// that add up to it). Polly the pirate parrot asks the questions and
// celebrates correct answers.

import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { buildRoundSequence, TOTAL_ROUNDS, LEVELS, ROUNDS_PER_LEVEL } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';

// Layout constants (720x1080 base resolution — see Phaser/config.js).
//
// Pearl strips sit next to the number they label — keys get their pearl
// BESIDE them (left for first-half keys, right for second-half keys, and the
// right-side strips are flipped to face inward), while chests get their pearl
// directly below. No per-item background cards — just section panels.
const TITLE_Y = 36;
const POLLY_Y = 195; // Polly's feet (origin bottom-center)
const POLLY_HEIGHT = 135;
const PROMPT_Y = 232;

// Shared pearl spacing.
const PEARL_GAP_SIDE = 10; // horizontal gap between a key and its side pearl
const PEARL_GAP_BELOW = 8; // vertical gap between a chest and its below pearl

// Level 2 — main chest (with its pearl strip below).
const CHEST_Y = 350;
const CHEST_HEIGHT = 165;
const CHEST_PEARL_WIDTH = 150;

// Level 2 — mystery-key slots with an "and" between them.
const SLOT_PANEL_Y = 585;
const SLOT_PANEL_H = 95;
const SLOT_Y = 585;
const SLOT_FIRST_X = 250;
const SLOT_SECOND_X = 470;
const SLOT_RADIUS = 46;

// Level 2 — first/second-half option keys (2 rows x 2 columns).
const OPTIONS_LEFT_X = 255; // first-half key center
const OPTIONS_RIGHT_X = 465; // second-half key center
const OPTIONS_TOP_Y = 790;
const OPTIONS_BOTTOM_Y = 965;
const OPTIONS_GROUP_LABEL_Y = 700;
const OPTIONS_PANEL_Y = 862;
const OPTIONS_PANEL_H = 350;
const KEY_WIDTH = 170; // level 2 option keys
const PEARL_KEY_WIDTH = 130; // side pearl for keys

// Level 1 — find the chest (two question keys + three chest options).
const LEVEL1_PANEL_Y = 425; // question keys center
const LEVEL1_PANEL_H = 170;
const LEVEL1_LABEL_Y = 555;
const QUESTION_KEY_WIDTH = 185;
const QUESTION_KEY_LEFT_X = 255; // first-half question key center
const QUESTION_KEY_RIGHT_X = 465; // second-half question key center
const LEVEL1_CHESTS_Y = 745; // chests center
const LEVEL1_CHESTS_PANEL_H = 275;
const OPTION_CHEST_HEIGHT = 185;
const PEARL_CHEST_WIDTH = 165;

// Safe voice playback — skips gracefully if a clip failed to load, and stops
// any previous voice so lines never overlap.
function playVoice(scene, key, onComplete) {
  if (!scene.cache.audio.exists(key)) {
    console.warn(`playVoice(): "${key}" not loaded, skipping.`);
    if (onComplete) onComplete();
    return null;
  }
  if (scene.currentVoice) {
    scene.currentVoice.stop();
    scene.currentVoice.destroy();
    scene.currentVoice = null;
  }
  const sound = scene.sound.add(key);
  sound.once('complete', () => {
    sound.destroy();
    scene.currentVoice = null;
    if (onComplete) onComplete();
  });
  sound.play();
  scene.currentVoice = sound;
  return sound;
}

// Measures a texture's native pixel size without leaving it on screen.
function measureTexture(scene, key) {
  const probe = scene.add.image(-1000, -1000, key);
  const w = probe.width;
  const h = probe.height;
  probe.destroy();
  return { w, h };
}

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.startTime = this.time.now;
    this.mistakes = 0;
    this.stars = 0;
    this.streak = 0;
    this.peakStreak = 0;
    this.rounds = buildRoundSequence();
    this.roundIndex = 0;
    this.phase = 'playing';
    this.currentVoice = null;
    this.roundLayer = null;
    this.level1Options = [];
    this.level1First = null;
    this.level1Second = null;
    this.chestOptions = [];
    this.mainChest = null;
    this.pollyIdleTween = null;

    // Background music + first-tap unlock, same pattern as the other games.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Stop any in-flight voice when leaving/restarting this scene.
    this.events.once('shutdown', () => {
      if (this.currentVoice) {
        this.currentVoice.stop();
        this.currentVoice.destroy();
        this.currentVoice = null;
      }
    });

    // 1. Background (cover-fit). Kept as a reference so each level can tint
    //    it, plus a wash overlay for the lighter level.
    this.bg = this.add.image(width / 2, height / 2, 'background').setDepth(0);
    const cover = Math.max(width / this.bg.width, height / this.bg.height);
    this.bg.setScale(cover);
    this.levelWash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xffffff, 0)
      .setDepth(1);

    // 2. Title.
    this.add.text(width / 2, TITLE_Y, "Polly's Treasure Quest", {
      fontSize: '38px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(20);

    // 3. Round pill (top-right) — "Round" on one line, "N/10" below it.
    this.roundPill = this.createPillButton(width - 16, 16, '', {
      fontSize: '22px',
      paddingX: 18,
      paddingY: 10,
      anchor: 'topRight',
      interactive: false,
      depth: 25,
    });

    // 4. Polly the parrot (top-center mascot) with a gentle idle bob.
    const pollyTex = measureTexture(this, 'Polly');
    this.pollyScale = POLLY_HEIGHT / pollyTex.h;
    this.pollyY = POLLY_Y;
    this.polly = this.add.image(width / 2, POLLY_Y, 'Polly')
      .setOrigin(0.5, 1)
      .setScale(this.pollyScale)
      .setDepth(20);

    // 5. Prompt bubble (updated every round). Light warm panel so the
    //    question reads as a colorful speech bubble, not a flat label.
    this.promptPill = this.createPillButton(width / 2, PROMPT_Y, '', {
      fontSize: '34px',
      paddingX: 26,
      paddingY: 14,
      interactive: false,
      depth: 20,
      bgColor: 0xfff4cf,
      textColor: '#7c4a03',
      borderColor: 0xf59e0b,
    });

    // 6. Full-screen red flash overlay — sits invisible until a wrong answer
    //    fires, then blinks red and fades out.
    this.redFlash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff2b2b, 1)
      .setDepth(85)
      .setAlpha(0);

    // 7. Scale values for keys + chests. All key art shares 300x250; all
    //    chest art shares 360x350.
    this.keyTex = measureTexture(this, 'keyFirstHalf-1');
    this.keyScale = KEY_WIDTH / this.keyTex.w;
    this.questionKeyScale = QUESTION_KEY_WIDTH / this.keyTex.w;
    this.chestTex = measureTexture(this, 'chest-locked');
    this.chestScale = CHEST_HEIGHT / this.chestTex.h;
    this.optionChestScale = OPTION_CHEST_HEIGHT / this.chestTex.h;

    this.startPollyIdle();
    this.setupRound(0);
  }

  // -----------------------------------------------------------------------
  // Polly + shared animation helpers
  // -----------------------------------------------------------------------

  startPollyIdle() {
    if (this.pollyIdleTween) this.pollyIdleTween.stop();
    // Cancel any leftover dance/celebration tweens so Polly snaps back to idle.
    this.tweens.killTweensOf(this.polly);
    this.polly.setAngle(0);
    this.polly.setTexture('Polly');
    this.polly.setY(this.pollyY);
    this.polly.setScale(this.pollyScale);
    this.pollyIdleTween = this.tweens.add({
      targets: this.polly,
      y: this.pollyY - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  celebratePolly() {
    if (this.pollyIdleTween) this.pollyIdleTween.stop();
    this.polly.setY(this.pollyY);
    this.polly.setTexture('PollyHappy');
    this.polly.setScale(this.pollyScale);
    this.tweens.add({
      targets: this.polly,
      scale: this.pollyScale * 1.12,
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => this.polly.setScale(this.pollyScale),
    });
  }

  // Longer celebration for a correct answer — Polly bobs and wobbles while
  // feathers rain down, and the next round waits for it to finish.
  dancePolly() {
    if (this.pollyIdleTween) this.pollyIdleTween.stop();
    this.tweens.killTweensOf(this.polly);
    this.polly.setTexture('PollyHappy');
    this.polly.setScale(this.pollyScale);
    this.polly.setY(this.pollyY);
    this.polly.setAngle(0);
    this.tweens.add({
      targets: this.polly,
      y: this.pollyY - 20,
      duration: 240,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.polly,
      angle: 8,
      duration: 240,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => this.polly.setAngle(0),
    });
  }

  // Feather confetti — spawns feathers above the visible area and lets them
  // drift down with a tumble, destroying each one when it leaves the screen.
  spawnConfetti(count = 26) {
    const { width, height } = this.scale;
    const tex = measureTexture(this, 'feather');
    const baseScale = 64 / tex.w;
    for (let i = 0; i < count; i += 1) {
      // Start fully off-screen (above) so feathers drift in naturally instead
      // of popping into view while waiting on the stagger.
      const f = this.add
        .image(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(-180, -70), 'feather')
        .setScale(baseScale * Phaser.Math.FloatBetween(0.7, 1.4))
        .setDepth(80)
        .setAlpha(Phaser.Math.FloatBetween(0.85, 1));
      f.setAngle(Phaser.Math.Between(0, 360));
      f.setFlipX(Math.random() < 0.5);
      const duration = Phaser.Math.Between(1200, 2000);
      const driftX = Phaser.Math.Between(-70, 70);
      this.tweens.add({
        targets: f,
        x: f.x + driftX,
        y: Phaser.Math.Between(height - 60, height + 60),
        angle: f.angle + Phaser.Math.Between(200, 560),
        duration,
        delay: i * 45,
        ease: 'Sine.easeIn',
        onComplete: () => f.destroy(),
      });
    }
  }

  // Scale-in "pop" for freshly built round elements.
  popIn(target, toScale, delay = 0) {
    target.setScale(toScale * 0.6);
    this.tweens.add({
      targets: target,
      scale: toScale,
      delay,
      duration: 320,
      ease: 'Back.easeOut',
    });
  }

  flashRed() {
    this.redFlash.setAlpha(0.38);
    this.tweens.killTweensOf(this.redFlash);
    this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 350, ease: 'Sine.easeOut' });
  }

  playSound(key, volume = 1) {
    if (key && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  keyImageKey(half, n) {
    return half === 'first' ? `keyFirstHalf-${n}` : `keySecondHalf-${n}`;
  }

  // The chest art has no number baked in; the number is a text overlay that
  // sits low and slightly left so it lands on the chest's face, not the lid.
  chestNumberOffset(scale) {
    const halfW = (this.chestTex.w * scale) / 2;
    const halfH = (this.chestTex.h * scale) / 2;
    return { x: -halfW * 0.25, y: halfH * 0.42 };
  }

  chestNumberStyle() {
    return {
      fontSize: '68px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#7c2d12',
      strokeThickness: 8,
    };
  }

  // Rounded, light-but-colorful panel drawn behind a question or options row.
  addPanel(x, y, w, h, fillColor, borderColor = 0xffffff) {
    const panel = this.add.graphics();
    panel.fillStyle(fillColor, 0.9);
    panel.fillRoundedRect(x - w / 2, y - h / 2, w, h, 26);
    panel.lineStyle(6, borderColor, 0.95);
    panel.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 26);
    this.roundLayer.add(panel);
    return panel;
  }

  // -----------------------------------------------------------------------
  // Pearl placement — strips are 200x80 art, scaled to a target width.
  // -----------------------------------------------------------------------

  pearlScaleForWidth(width) {
    return width / 200;
  }

  // Adds a pearl strip just below a chest's bottom edge (holder-local coords).
  addPearlBelow(holder, value, chestH, pearlW) {
    const scale = this.pearlScaleForWidth(pearlW);
    const pearlH = 80 * scale;
    const pearl = this.add
      .image(0, chestH / 2 + PEARL_GAP_BELOW + pearlH / 2, `pearl${value}`)
      .setScale(scale);
    holder.add(pearl);
    return pearl;
  }

  // Static key + side pearl (used by the level-1 question keys). First-half
  // pearls go left, second-half pearls go right and are flipped inward.
  buildQuestionKey(x, y, value, half, scale) {
    const container = this.add.container(x, y);
    const keyW = this.keyTex.w * scale;
    const pearlW = PEARL_KEY_WIDTH;
    const pearlScale = this.pearlScaleForWidth(pearlW);
    const dir = half === 'first' ? -1 : 1;
    const pearlX = dir * (keyW / 2 + PEARL_GAP_SIDE + pearlW / 2);

    const key = this.add.image(0, 0, this.keyImageKey(half, value)).setScale(scale);
    const pearl = this.add.image(pearlX, 0, `pearl${value}`).setScale(pearlScale);
    if (half === 'second') pearl.setFlipX(true);
    container.add([key, pearl]);
    return container;
  }

  // Level-1 chest option: tappable chest with its pearl strip below.
  makeChestOption(x, y, value, scale) {
    const chestW = this.chestTex.w * scale;
    const chestH = this.chestTex.h * scale;
    const pearlW = PEARL_CHEST_WIDTH;
    const pearlScale = this.pearlScaleForWidth(pearlW);
    const pearlH = 80 * pearlScale;

    const container = this.add.container(x, y);
    const img = this.add.image(0, 0, 'chest-locked').setScale(scale);
    container.add(img);
    const offset = this.chestNumberOffset(scale);
    const label = this.add
      .text(offset.x, offset.y, `${value}`, this.chestNumberStyle())
      .setOrigin(0.5);
    container.add(label);
    this.addPearlBelow(container, value, chestH, pearlW);

    container.baseX = x;
    // Hit area covers chest + pearl so the whole option is easy to tap.
    const hitW = Math.max(chestW, pearlW);
    const hitH = chestH + PEARL_GAP_BELOW + pearlH;
    return {
      container,
      img,
      value,
      hitW,
      hitH,
      hitTop: -chestH / 2,
      open: () => img.setTexture('chest-unlocked'),
    };
  }

  // Level-2 main chest: the whole to make, with its pearl strip below.
  buildMainChest() {
    const round = this.round;
    const scale = this.chestScale;
    const chestH = this.chestTex.h * scale;

    const chest = this.add.container(360, CHEST_Y);
    const chestImg = this.add.image(0, 0, 'chest-locked').setScale(scale);
    chest.add(chestImg);
    const offset = this.chestNumberOffset(scale);
    const chestNumber = this.add
      .text(offset.x, offset.y, `${round.whole}`, this.chestNumberStyle())
      .setOrigin(0.5);
    chest.add(chestNumber);
    this.addPearlBelow(chest, round.whole, chestH, CHEST_PEARL_WIDTH);

    this.roundLayer.add(chest);
    this.mainChest = { img: chestImg };
    this.popIn(chest, 1);
    this.tweens.add({
      targets: chest,
      y: CHEST_Y - 7,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Level-2 option: the pearl stays in the tray while the key (top-level, so
  // it can tween over the panels) flies to the slot. Side pearls are on the
  // outer edge of each column; second-half ones are flipped inward.
  addOptionTray(x, keyY, value, half, keyScale) {
    const keyW = this.keyTex.w * keyScale;
    const pearlW = PEARL_KEY_WIDTH;
    const pearlScale = this.pearlScaleForWidth(pearlW);
    const dir = half === 'first' ? -1 : 1;
    const pearlX = x + dir * (keyW / 2 + PEARL_GAP_SIDE + pearlW / 2);

    const pearl = this.add.image(pearlX, keyY, `pearl${value}`).setScale(pearlScale);
    if (half === 'second') pearl.setFlipX(true);
    this.roundLayer.add(pearl);

    const key = this.addKey(x, keyY, value, half, keyScale);
    return { key, pearl, pearlScale };
  }

  // Dotted vertical divider (drawn before the option keys so it sits behind
  // them) — marks the boundary between the two halves.
  drawDottedLine(x, y1, y2, color = 0xffffff, alpha = 1) {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    const step = 18;
    const r = 4;
    for (let y = y1; y <= y2; y += step) {
      g.fillCircle(x, y, r);
    }
    this.roundLayer.add(g);
    return g;
  }

  // -----------------------------------------------------------------------
  // Round / phase state machine
  // -----------------------------------------------------------------------

  setupRound(roundIndex) {
    this.roundIndex = roundIndex;
    this.round = this.rounds[roundIndex];
    this.phase = 'playing';

    // Clear the previous round's UI. Level-2 option keys are top-level
    // sprites (not inside roundLayer) so they render above the panels while
    // animating, so they get destroyed explicitly here.
    this.level1Options.forEach((option) => option.img?.destroy());
    if (this.roundLayer) {
      this.roundLayer.destroy(true);
    }
    this.roundLayer = this.add.container(0, 0).setDepth(10);
    this.level1Options = [];
    this.level1First = null;
    this.level1Second = null;
    this.chestOptions = [];
    this.mainChest = null;

    // The first round of each level opens on that level's start screen.
    if (roundIndex === 0 || roundIndex === ROUNDS_PER_LEVEL) {
      this.showLevelStart(roundIndex === 0 ? 1 : 2);
      return;
    }

    this.startRound();
  }

  startRound() {
    this.phase = 'playing';
    this.startPollyIdle();
    this.roundPill.setText(`Round\n${this.roundIndex + 1}/${TOTAL_ROUNDS}`);
    this.popIn(this.promptPill.container, 1);

    if (this.round.level === LEVELS.FIND_CHEST) {
      // Level 1 — prominent white-tan wash over the background.
      this.bg.setTint(0xfff2d2);
      this.levelWash.setFillStyle(0xffffff, 0.32);
      this.promptPill.setText('Which chest holds both keys?');
      playVoice(this, 'ahoyChest');
      this.buildFindChestRound();
    } else {
      // Level 2 — dark, reddish moody tint on the background.
      this.bg.setTint(0x8a4a55);
      this.levelWash.setFillStyle(0xffffff, 0);
      this.promptPill.setText(`Find two keys that make ${this.round.whole}!`);
      playVoice(this, 'ahoyKey');
      this.buildFindKeysRound();
    }
  }

  // Shows a level's full-screen start image with a Start button at the bottom
  // center. The round is held in 'levelStart' phase until the child taps it.
  showLevelStart(level) {
    this.phase = 'levelStart';
    const { width, height } = this.scale;
    const key = level === 1 ? 'Level-1-start' : 'Level-2-start';

    // Fade the start screen in with a slight zoom for a smooth entry.
    const img = this.add.image(width / 2, height / 2, key).setDepth(60).setAlpha(0);
    const cover = Math.max(width / img.width, height / img.height);
    img.setScale(cover * 0.96);
    this.tweens.add({
      targets: img,
      alpha: 1,
      scale: cover,
      duration: 450,
      ease: 'Sine.easeOut',
    });

    const button = this.createPillButton(width / 2, height - 90, 'Start ▶', {
      fontSize: '30px',
      paddingX: 42,
      paddingY: 18,
      depth: 70,
      bgColor: 0xffd23f,
      textColor: '#173b59',
      borderColor: 0xf59e0b,
    });
    button.container.setScale(0);
    this.tweens.add({
      targets: button.container,
      scale: 1,
      duration: 380,
      delay: 200,
      ease: 'Back.easeOut',
    });

    button.on('pointerup', () => {
      // Fade the start screen out, then launch the round.
      this.tweens.add({
        targets: [img, button.container],
        alpha: 0,
        duration: 260,
        ease: 'Sine.easeIn',
        onComplete: () => {
          img.destroy();
          button.destroy();
          this.startRound();
        },
      });
    });
  }

  // Smoothly fades a veil over the screen, swaps to the next round (or that
  // level's start screen), then fades back out — used for level changes and
  // round-to-round continuity.
  transitionToRound(nextIndex) {
    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 1)
      .setDepth(100)
      .setAlpha(0);
    this.tweens.add({
      targets: veil,
      alpha: 0.8,
      duration: 220,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.setupRound(nextIndex);
        this.tweens.add({
          targets: veil,
          alpha: 0,
          duration: 320,
          ease: 'Sine.easeOut',
          onComplete: () => veil.destroy(),
        });
      },
    });
  }

  // -----------------------------------------------------------------------
  // Level 1 — "find the chest" (tap the chest that holds both keys)
  // -----------------------------------------------------------------------

  buildFindChestRound() {
    const round = this.round;

    // Question panel — warm, behind the two side-by-side keys (with side
    // pearls: first-half on the left, second-half on the right).
    this.addPanel(360, LEVEL1_PANEL_Y, 700, LEVEL1_PANEL_H, 0xfff4cf, 0xf59e0b);

    const keyA = this.buildQuestionKey(QUESTION_KEY_LEFT_X, LEVEL1_PANEL_Y, round.firstKey, 'first', this.questionKeyScale);
    const keyB = this.buildQuestionKey(QUESTION_KEY_RIGHT_X, LEVEL1_PANEL_Y, round.secondKey, 'second', this.questionKeyScale);
    this.roundLayer.add([keyA, keyB]);
    this.popIn(keyA, 1, 60);
    this.popIn(keyB, 1, 140);

    const label = this.add.text(360, LEVEL1_LABEL_Y, 'Tap the chest with the right number!', {
      fontSize: '28px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 8,
    }).setOrigin(0.5);
    this.roundLayer.add(label);

    // Chest options panel — sky, behind the three tappable chests (each with
    // its pearl strip below). Centered on the chest+pearl group so the panel
    // wraps both, not just the chests.
    const chestH = this.chestTex.h * this.optionChestScale;
    const chestPearlH = 80 * this.pearlScaleForWidth(PEARL_CHEST_WIDTH);
    const chestPanelCenterY = LEVEL1_CHESTS_Y + (PEARL_GAP_BELOW + chestPearlH) / 2;
    this.addPanel(360, chestPanelCenterY, 700, LEVEL1_CHESTS_PANEL_H, 0xd6f0ff, 0x38bdf8);

    // Dotted dividers between the three chest columns, spanning the chests
    // and their pearl strips, so each option reads as its own slot.
    const chestDivY1 = LEVEL1_CHESTS_Y - chestH / 2 - 6;
    const chestDivY2 = LEVEL1_CHESTS_Y + chestH / 2 + PEARL_GAP_BELOW + chestPearlH + 6;
    this.drawDottedLine(250, chestDivY1, chestDivY2);
    this.drawDottedLine(470, chestDivY1, chestDivY2);

    const chestXs = [140, 360, 580];
    round.chestOptions.forEach((value, i) => {
      const option = this.makeChestOption(chestXs[i], LEVEL1_CHESTS_Y, value, this.optionChestScale);
      this.roundLayer.add(option.container);
      this.chestOptions.push(option);
      this.popIn(option.container, 1, 200 + i * 90);

      option.container.setInteractive(
        new Phaser.Geom.Rectangle(-option.hitW / 2, option.hitTop, option.hitW, option.hitH),
        Phaser.Geom.Rectangle.Contains
      );
      option.container.on('pointerup', () => this.onChestPicked(option));
    });
  }

  onChestPicked(option) {
    if (this.phase !== 'playing') return;

    if (option.value === this.round.whole) {
      option.open();
      this.onCorrectAnswer();
    } else {
      this.onWrongAnswer('wrongChest');
      this.shakeContainer(option.container, option.container.baseX);
    }
  }

  shakeContainer(container, baseX) {
    this.tweens.add({
      targets: container,
      x: baseX + 8,
      duration: 55,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => container.setX(baseX),
    });
  }

  // -----------------------------------------------------------------------
  // Level 2 — "find the keys" (pick one key of each half)
  // -----------------------------------------------------------------------

  buildFindKeysRound() {
    const round = this.round;

    // Main chest (with its pearl below) — the whole to make.
    this.buildMainChest();

    // Mystery-slot panel with the two chosen-key slots and an "and" between.
    this.addPanel(360, SLOT_PANEL_Y, 540, SLOT_PANEL_H, 0xeaf4ff, 0x60a5fa);
    this.slotFirst = this.buildSlot(SLOT_FIRST_X);
    this.slotSecond = this.buildSlot(SLOT_SECOND_X);

    const andX = (SLOT_FIRST_X + SLOT_SECOND_X) / 2;
    const andBg = this.add.circle(andX, SLOT_Y, 34, 0xffffff, 0.9);
    const andLabel = this.add.text(andX, SLOT_Y, 'and', {
      fontSize: '36px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);
    this.roundLayer.add([andBg, andLabel]);

    // Options panel — mint, with half labels + a dotted divider between them.
    this.addPanel(360, OPTIONS_PANEL_Y, 680, OPTIONS_PANEL_H, 0xcff5e7, 0x34d399);

    // Center each half label over its full key+pearl group (pearls sit on the
    // outer edges, so the group's center is offset toward them).
    const labelOffset = (PEARL_GAP_SIDE + PEARL_KEY_WIDTH) / 2;
    const firstLabel = this.add.text(OPTIONS_LEFT_X - labelOffset, OPTIONS_GROUP_LABEL_Y, '1st half', {
      fontSize: '26px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0b6e5c',
    }).setOrigin(0.5);
    const secondLabel = this.add.text(OPTIONS_RIGHT_X + labelOffset, OPTIONS_GROUP_LABEL_Y, '2nd half', {
      fontSize: '26px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0b6e5c',
    }).setOrigin(0.5);
    this.roundLayer.add([firstLabel, secondLabel]);

    // Vertical dotted divider splitting first half from second half.
    this.drawDottedLine(360, OPTIONS_GROUP_LABEL_Y + 12, OPTIONS_BOTTOM_Y + 68);

    const optionDefs = [
      { value: round.firstHalfOptions[0], half: 'first', x: OPTIONS_LEFT_X, y: OPTIONS_TOP_Y },
      { value: round.firstHalfOptions[1], half: 'first', x: OPTIONS_LEFT_X, y: OPTIONS_BOTTOM_Y },
      { value: round.secondHalfOptions[0], half: 'second', x: OPTIONS_RIGHT_X, y: OPTIONS_TOP_Y },
      { value: round.secondHalfOptions[1], half: 'second', x: OPTIONS_RIGHT_X, y: OPTIONS_BOTTOM_Y },
    ];
    optionDefs.forEach((def, i) => {
      const tray = this.addOptionTray(def.x, def.y, def.value, def.half, this.keyScale);

      const option = { img: tray.key, value: def.value, half: def.half, originX: def.x, originY: def.y };
      this.level1Options.push(option);

      // Tapping the key OR its side pearl picks the key.
      tray.key.setInteractive({ useHandCursor: true });
      tray.key.on('pointerup', () => this.onLevel1KeyTapped(option));
      tray.pearl.setInteractive({ useHandCursor: true });
      tray.pearl.on('pointerup', () => this.onLevel1KeyTapped(option));

      this.popIn(tray.key, this.keyScale, 120 + i * 70);
      this.popIn(tray.pearl, tray.pearlScale, 160 + i * 70);
    });
  }

  buildSlot(x) {
    const slot = this.add.graphics();
    slot.fillStyle(0x000000, 0.06);
    slot.fillCircle(x, SLOT_Y, SLOT_RADIUS);
    slot.lineStyle(4, 0xffffff, 0.9);
    slot.strokeCircle(x, SLOT_Y, SLOT_RADIUS);
    this.roundLayer.add(slot);
    const questionText = this.add.text(x, SLOT_Y, '?', {
      fontSize: '56px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5).setDepth(12);
    this.roundLayer.add(questionText);
    return { x, y: SLOT_Y, radius: SLOT_RADIUS, questionText };
  }

  addKey(x, y, value, half, scale) {
    const key = this.keyImageKey(half, value);
    return this.add.image(x, y, key).setScale(scale).setDepth(30);
  }

  tweenKeyTo(option, x, y) {
    this.tweens.killTweensOf(option.img);
    this.tweens.add({ targets: option.img, x, y, duration: 160, ease: 'Sine.easeOut' });
  }

  returnLevel1Key(option) {
    if (option.half === 'first') this.slotFirst.questionText.setVisible(true);
    else this.slotSecond.questionText.setVisible(true);
    this.tweenKeyTo(option, option.originX, option.originY);
  }

  onLevel1KeyTapped(option) {
    if (this.phase !== 'playing') return;

    if (option.half === 'first') {
      if (this.level1First === option) {
        // Tap the placed key to send it back.
        this.level1First = null;
        this.slotFirst.questionText.setVisible(true);
        this.tweenKeyTo(option, option.originX, option.originY);
        return;
      }
      if (this.level1First) {
        this.slotFirst.questionText.setVisible(true);
        this.tweenKeyTo(this.level1First, this.level1First.originX, this.level1First.originY);
      }
      this.level1First = option;
      this.slotFirst.questionText.setVisible(false);
      this.tweenKeyTo(option, SLOT_FIRST_X, SLOT_Y);
    } else {
      if (this.level1Second === option) {
        this.level1Second = null;
        this.slotSecond.questionText.setVisible(true);
        this.tweenKeyTo(option, option.originX, option.originY);
        return;
      }
      if (this.level1Second) {
        this.slotSecond.questionText.setVisible(true);
        this.tweenKeyTo(this.level1Second, this.level1Second.originX, this.level1Second.originY);
      }
      this.level1Second = option;
      this.slotSecond.questionText.setVisible(false);
      this.tweenKeyTo(option, SLOT_SECOND_X, SLOT_Y);
    }

    this.maybeCheckLevel1();
  }

  maybeCheckLevel1() {
    if (!this.level1First || !this.level1Second) return;

    const sum = this.level1First.value + this.level1Second.value;
    if (sum === this.round.whole) {
      this.openMainChest();
      this.onCorrectAnswer();
    } else {
      this.onWrongAnswer('wrongKey');
      const first = this.level1First;
      const second = this.level1Second;
      this.level1First = null;
      this.level1Second = null;
      // Keys shake in the slots, then (after the shake tween finishes) return
      // to their tray spots so the child can try again. Returning inside the
      // shake's onComplete keeps the two tweens from fighting over the key.
      this.shakeAt(first.img, SLOT_FIRST_X, SLOT_Y, () => this.returnLevel1Key(first));
      this.shakeAt(second.img, SLOT_SECOND_X, SLOT_Y, () => this.returnLevel1Key(second));
    }
  }

  openMainChest() {
    if (this.mainChest) this.mainChest.img.setTexture('chest-unlocked');
  }

  shakeAt(target, baseX, baseY, onDone) {
    this.tweens.add({
      targets: target,
      x: baseX + 8,
      duration: 55,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        target.setX(baseX);
        target.setY(baseY);
        if (onDone) onDone();
      },
    });
  }

  // -----------------------------------------------------------------------
  // Feedback + progression
  // -----------------------------------------------------------------------

  onCorrectAnswer() {
    if (this.phase !== 'playing') return;
    this.phase = 'success';

    this.stars += 1;
    this.streak += 1;
    this.peakStreak = Math.max(this.peakStreak, this.streak);

    this.playSound('chestOpening', 0.9);
    playVoice(this, this.round.level === LEVELS.FIND_CHEST ? 'correct' : 'treasureFound');

    // Celebrate the round: feathers rain down while Polly dances, then we wait
    // long enough for both to play before moving to the next round.
    this.spawnConfetti();
    this.dancePolly();

    const isLast = this.roundIndex === TOTAL_ROUNDS - 1;
    this.time.delayedCall(2600, () => {
      if (this.phase !== 'success') return;
      if (isLast) this.finishGame();
      else this.transitionToRound(this.roundIndex + 1);
    });
  }

  onWrongAnswer(voiceKey) {
    this.mistakes += 1;
    this.streak = 0;
    this.flashRed();
    playVoice(this, voiceKey);
  }

  finishGame() {
    this.phase = 'finished';
    playVoice(this, 'treasureHunter');
    this.celebratePolly();

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);

    // The single end-of-run log — matches Game.jsx's completeEventName.
    this.game.events.emit('game9-complete', {
      stars: this.stars,
      totalRounds: TOTAL_ROUNDS,
      peakStreak: this.peakStreak,
      mistakes: this.mistakes,
      elapsedSeconds,
    });

    this.showEndOverlay();
  }

  showEndOverlay() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55).setDepth(90);

    const panel = this.add.container(width / 2, height / 2).setDepth(91).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-220, -150, 440, 300, 28);
    panel.add(bg);

    // Polly takes the emoji's spot, with a gentle idle bob for some life.
    const pollyImg = this.add
      .image(0, -75, 'PollyHappy')
      .setOrigin(0.5)
      .setScale(100 / 600);
    panel.add(pollyImg);
    this.tweens.add({
      targets: pollyImg,
      y: -83,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const title = this.add.text(0, 6, 'Treasure Hunter!', {
      fontSize: '42px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);
    panel.add(title);

    this.createPillButton(width / 2, height / 2 + 105, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 92,
    }).on('pointerup', () => this.scene.restart());
  }
}
