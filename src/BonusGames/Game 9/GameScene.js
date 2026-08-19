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
import { buildRoundSequence, TOTAL_ROUNDS, LEVELS } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';

// Layout constants (720x1080 base resolution — see Phaser/config.js).
const TITLE_Y = 50;
const POLLY_Y = 220; // Polly's feet (origin bottom-center)
const POLLY_HEIGHT = 140;
const PROMPT_Y = 280;
const CHEST_Y = 425; // level 2 chest
const SLOT_PANEL_Y = 610; // panel behind the mystery-key slots
const SLOT_PANEL_H = 150;
const SLOT_Y = 610; // level 2 chosen-key slots
const SLOT_FIRST_X = 250;
const SLOT_SECOND_X = 470;
const SLOT_RADIUS = 50;
const OPTIONS_LEFT_X = 220; // level 2 first-half column
const OPTIONS_RIGHT_X = 500; // level 2 second-half column
const OPTIONS_TOP_Y = 810;
const OPTIONS_BOTTOM_Y = 970;
const OPTIONS_GROUP_LABEL_Y = 730;
const OPTIONS_PANEL_Y = 880;
const OPTIONS_PANEL_H = 350;
const LEVEL1_PANEL_Y = 470; // level 1 question panel
const LEVEL1_LABEL_Y = 620;
const LEVEL1_CHESTS_Y = 800;
const LEVEL1_CHESTS_PANEL_H = 250;
const KEY_WIDTH = 180; // level 2 option keys
const QUESTION_KEY_WIDTH = 150; // level 1 question keys
const CHEST_HEIGHT = 180; // level 2 chest
const OPTION_CHEST_HEIGHT = 180; // level 1 chest options

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
    //    chest art shares 350x310.
    const keyTex = measureTexture(this, 'keyFirstHalf-1');
    this.keyScale = KEY_WIDTH / keyTex.w;
    this.questionKeyScale = QUESTION_KEY_WIDTH / keyTex.w;
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

    this.startPollyIdle();
    this.roundPill.setText(`Round\n${roundIndex + 1}/${TOTAL_ROUNDS}`);
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

  // -----------------------------------------------------------------------
  // Level 1 — "find the chest" (tap the chest that holds both keys)
  // -----------------------------------------------------------------------

  buildFindChestRound() {
    const round = this.round;

    // Question panel — light warm, behind the two side-by-side keys.
    this.addPanel(360, LEVEL1_PANEL_Y, 620, 170, 0xfff4cf, 0xf59e0b);

    const keyA = this.addKey(275, LEVEL1_PANEL_Y, round.firstKey, 'first', this.questionKeyScale);
    const keyB = this.addKey(445, LEVEL1_PANEL_Y, round.secondKey, 'second', this.questionKeyScale);
    this.roundLayer.add([keyA, keyB]);
    this.popIn(keyA, this.questionKeyScale, 60);
    this.popIn(keyB, this.questionKeyScale, 140);

    const label = this.add.text(360, LEVEL1_LABEL_Y, 'Tap the chest with the right number!', {
      fontSize: '28px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 8,
    }).setOrigin(0.5);
    this.roundLayer.add(label);

    // Chest options panel — light sky, behind the three tappable chests.
    this.addPanel(360, LEVEL1_CHESTS_Y, 680, LEVEL1_CHESTS_PANEL_H, 0xd6f0ff, 0x38bdf8);

    const chestXs = [140, 360, 580];
    round.chestOptions.forEach((value, i) => {
      const option = this.makeChestOption(chestXs[i], LEVEL1_CHESTS_Y, value, this.optionChestScale);
      this.roundLayer.add(option.container);
      this.chestOptions.push(option);
      this.popIn(option.container, 1, 200 + i * 90);

      const hitW = this.chestTex.w * this.optionChestScale;
      const hitH = this.chestTex.h * this.optionChestScale;
      option.container.setInteractive(
        new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
        Phaser.Geom.Rectangle.Contains
      );
      option.container.on('pointerup', () => this.onChestPicked(option));
    });
  }

  makeChestOption(x, y, value, scale) {
    const container = this.add.container(x, y);
    const img = this.add.image(0, 0, 'chest-locked').setScale(scale);
    const offset = this.chestNumberOffset(scale);
    const label = this.add.text(offset.x, offset.y, `${value}`, this.chestNumberStyle()).setOrigin(0.5);
    container.add([img, label]);
    container.baseX = x;
    return { container, img, value, open: () => img.setTexture('chest-unlocked') };
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

    // Main chest with its number overlaid low and slightly left.
    const chest = this.add.container(360, CHEST_Y);
    const chestImg = this.add.image(0, 0, 'chest-locked').setScale(this.chestScale);
    const offset = this.chestNumberOffset(this.chestScale);
    const chestNumber = this.add
      .text(offset.x, offset.y, `${round.whole}`, this.chestNumberStyle())
      .setOrigin(0.5);
    chest.add([chestImg, chestNumber]);
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

    // Mystery-slot panel — light, behind the two chosen-key slots.
    this.addPanel(360, SLOT_PANEL_Y, 500, SLOT_PANEL_H, 0xeaf4ff, 0x60a5fa);

    // Two chosen-key slots. The first-half key always lands left, the
    // second-half key always lands right.
    this.slotFirst = this.buildSlot(SLOT_FIRST_X);
    this.slotSecond = this.buildSlot(SLOT_SECOND_X);

    // Options panel — light mint, behind the four big tappable keys.
    this.addPanel(360, OPTIONS_PANEL_Y, 680, OPTIONS_PANEL_H, 0xcff5e7, 0x34d399);

    const firstLabel = this.add.text(OPTIONS_LEFT_X, OPTIONS_GROUP_LABEL_Y, '1st half', {
      fontSize: '26px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0b6e5c',
    }).setOrigin(0.5);
    const secondLabel = this.add.text(OPTIONS_RIGHT_X, OPTIONS_GROUP_LABEL_Y, '2nd half', {
      fontSize: '26px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0b6e5c',
    }).setOrigin(0.5);
    this.roundLayer.add([firstLabel, secondLabel]);

    // Two columns: first-half keys stacked on the left, second-half keys
    // stacked on the right.
    const optionDefs = [
      { value: round.firstHalfOptions[0], half: 'first', x: OPTIONS_LEFT_X, y: OPTIONS_TOP_Y },
      { value: round.firstHalfOptions[1], half: 'first', x: OPTIONS_LEFT_X, y: OPTIONS_BOTTOM_Y },
      { value: round.secondHalfOptions[0], half: 'second', x: OPTIONS_RIGHT_X, y: OPTIONS_TOP_Y },
      { value: round.secondHalfOptions[1], half: 'second', x: OPTIONS_RIGHT_X, y: OPTIONS_BOTTOM_Y },
    ];
    optionDefs.forEach((def, i) => {
      // Top-level sprite so it can tween over the panels to its slot.
      const img = this.addKey(def.x, def.y, def.value, def.half, this.keyScale);
      img.setInteractive({ useHandCursor: true });

      const option = { img, value: def.value, half: def.half, originX: def.x, originY: def.y };
      this.level1Options.push(option);
      img.on('pointerup', () => this.onLevel1KeyTapped(option));
      this.popIn(img, this.keyScale, 120 + i * 70);
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
      fontSize: '64px',
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
    this.celebratePolly();

    const isLast = this.roundIndex === TOTAL_ROUNDS - 1;
    this.time.delayedCall(1700, () => {
      if (this.phase !== 'success') return;
      if (isLast) this.finishGame();
      else this.setupRound(this.roundIndex + 1);
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

    const emoji = this.add.text(0, -80, '\uD83E\uDD9C', { fontSize: '64px' }).setOrigin(0.5);
    const title = this.add.text(0, -10, 'Treasure Hunter!', {
      fontSize: '42px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);
    panel.add([emoji, title]);

    this.createPillButton(width / 2, height / 2 + 105, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 92,
    }).on('pointerup', () => this.scene.restart());
  }
}
