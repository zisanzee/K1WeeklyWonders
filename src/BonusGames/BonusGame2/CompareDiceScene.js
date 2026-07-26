// CompareDiceScene.js
// Drives both levels (Dice and Domino) off the same code — everything
// level-specific (value range, allowed difference, round counts, box
// dimensions, image prefix, roll-button key, intro voice keys, tint)
// comes from levels.js, so this scene doesn't need a Dice/Domino branch
// anywhere.
import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { LEVELS, buildRounds, progress } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';

// Shared look for the big "on top" texts (title + prompt): bold, large,
// with a white outline so they stay readable over the busy background art.
const HEADLINE_STYLE = {
  fontFamily: 'Fredoka, sans-serif',
  fontStyle: '900',
  stroke: '#ffffff',
  strokeThickness: 7,
};

export default class CompareDiceScene extends BaseScene {
  constructor() {
    super('CompareDiceScene');
  }

  init(data) {
    this.levelIndex = data?.levelIndex ?? 0;
    this.level = LEVELS[this.levelIndex];
    this.rounds = buildRounds(this.level);
    this.roundIndex = 0;
    this.correctCount = 0;
    this.mistakes = 0;
    // idle -> rolling -> selecting -> revealing -> (next round: idle)
    this.phase = 'idle';
    this.selectedSide = null;
    this.hasRolledEver = false;
  }

  create() {
    const { width, height } = this.scale;
    const level = this.level;

    this.startTime = this.time.now;
    this.stopSpeechOnShutdown();

    // Real background art, tinted per-level. Anchored from the TOP
    // (originY: 0) so a cover-fit crop only trims the bottom of the art
    // instead of equally trimming top and bottom — keeps the room's
    // framing (banner/chalkboard/windows) fully visible.
    const bg = this.add.image(width / 2, 0, 'background').setOrigin(0.5, 0).setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);
    bg.setTint(level.tint);

    this.add.text(width / 2, 146, `${level.subtitle}`, {
      ...HEADLINE_STYLE,
      fontSize: '54px',
      color: '#0f3d5c',
    }).setOrigin(0.5).setDepth(20);

    this.roundPill = this.createPillButton(width - 16, 16, `Round ${this.roundIndex + 1}/${this.rounds.length}`, {
      fontSize: '20px', paddingX: 16, paddingY: 10, anchor: 'topRight', interactive: false, depth: 25,
    });
    this.createPillButton(16, 16, `⭐ ${progress.totalStars()}/${LEVELS.length}`, {
      fontSize: '20px', paddingX: 16, paddingY: 10, anchor: 'topLeft', interactive: false, depth: 25,
    });
    addMuteButton(this, 16, 68, { anchor: 'topLeft' });

    this.promptText = this.add.text(width / 2, 212, 'Tap Roll to start!', {
      ...HEADLINE_STYLE,
      fontSize: '50px',
      color: '#c2410c',
      align: 'center',
      wordWrap: { width: width - 50 },
    }).setOrigin(0.5).setDepth(20);

    // Box size comes straight from the level config (dice stays compact +
    // square; domino is noticeably bigger and taller/rectangular to match
    // its artwork), with a small fixed gap between the two boxes.
    const { boxWidth, boxHeight } = level;
    const slotY = height * 0.46;
    const slotGap = boxWidth / 2 + 14;

    this.leftSlot = this.buildSlot(width / 2 - slotGap, slotY, boxWidth, boxHeight, level, 'left');
    this.rightSlot = this.buildSlot(width / 2 + slotGap, slotY, boxWidth, boxHeight, level, 'right');

    // Roll button.
    this.rollBtn = this.add.image(width / 2, height * 0.86, level.rollButtonKey).setDepth(20);
    const targetW = Math.min(width * 0.46, 280);
    const baseScale = targetW / this.rollBtn.width;
    this.rollBtn.setScale(baseScale);
    this.rollBtn._baseScale = baseScale;
    this.rollBtn.setInteractive({ useHandCursor: true });
    this.rollBtn.on('pointerdown', () => this.onRollButtonPressed());
    this.rollIdleTween = this.tweens.add({
      targets: this.rollBtn, scale: baseScale * 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // "Check Answer" button — sits in the exact same spot as the roll
    // button and swaps in once dice have settled, so there's only ever
    // one primary action visible at the bottom at a time.
    this.checkBtn = this.createPillButton(width / 2, height * 0.86, 'Check Answer ✅', {
      fontSize: '24px',
      paddingX: 28,
      paddingY: 16,
      minWidth: targetW,
      depth: 21,
      bgColor: 0xd8dee2,
      textColor: '#5c6b78',
    });
    this.checkBtn.container.setVisible(false);
    this.checkBtn.container.disableInteractive();
    this.checkBtn.on('pointerup', () => this.onCheckAnswer());

    ensureBgMusic(this);
    // Extra safety net: browsers that blocked autoplay before any touch
    // will unlock on the very first tap anywhere — try again right then.
    this.input.once('pointerdown', () => ensureBgMusic(this));
  }

  buildSlot(x, y, w, h, level, sideLabel) {
    const card = this.add.graphics().setDepth(1);
    card.fillStyle(0xffffff, 0.85);
    card.fillRoundedRect(x - w / 2, y - h / 2, w, h, 26);
    card.lineStyle(5, level.accentColor, 1);
    card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 26);

    const initialValue = level.minValue;
    const img = this.add.image(x, y, this.textureKeyFor(level, initialValue)).setDepth(2);
const maxW = w * 0.8;
const maxH = h * 0.86;

const fitScale = Math.min(maxW / img.width, maxH / img.height);
const sizeBoost = level.key === 'domino' ? 1.5 : 1;

const s = fitScale * sizeBoost;
img.setScale(s);
img._baseScale = s;
    // Dimmed + a big "not rolled yet" question mark overlay until the
    // first roll of the level, so the starting face never reads as an
    // already-rolled result.
    img.setAlpha(0.3);

    // Emoji glyphs commonly get clipped at the top by Phaser's canvas text
    // bounding-box calc (BasePreloadScene's own loading emoji has the same
    // fix) — setPadding compensates for the extra ascent so it renders in
    // full instead of looking cut off.
    const markFontSize = Math.round(Math.min(w, h) * 0.3);
    const notRolledMark = this.add.text(x, y, '❓', {
      fontSize: `${markFontSize}px`,
      stroke: '#ffffff',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(4);
    notRolledMark.setPadding({ top: Math.round(markFontSize * 0.35), bottom: Math.round(markFontSize * 0.15) });
    this.tweens.add({
      targets: notRolledMark, scale: { from: 0.92, to: 1.05 }, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Uses Phaser's OWN default hit area (auto-derived from the zone's
    // width/height + origin) instead of a hand-rolled Rectangle — a
    // previous version passed a custom Rectangle in the wrong coordinate
    // space, which silently mis-mapped taps to the wrong logical slot.
    const zone = this.add.zone(x, y, w, h).setDepth(3);
    zone.setInteractive({ useHandCursor: true });
    zone.disableInteractive();
    zone.on('pointerdown', () => this.onSlotTapped(sideLabel));

    return {
      x, y, w, h, img, zone, notRolledMark, value: initialValue, side: sideLabel, selectionRing: null,
    };
  }

  textureKeyFor(level, value) {
    return `${level.imagePrefix}${value}`;
  }

  onRollButtonPressed() {
    ensureBgMusic(this);
    if (this.phase !== 'idle') return;
    this.phase = 'rolling';
    this.rollBtn.disableInteractive();
    this.promptText.setText('Rolling...');
    this.playSound('rollVoice');

    // Punchy press feedback on the button itself before the dice start.
    this.tweens.add({
      targets: this.rollBtn, scale: this.rollBtn._baseScale * 0.86, duration: 90, yoyo: true, ease: 'Sine.easeOut',
    });

    // First-ever roll of the level: clear the "not rolled yet" markers and
    // bring the dice/domino up to full opacity.
    if (!this.hasRolledEver) {
      this.hasRolledEver = true;
      [this.leftSlot, this.rightSlot].forEach((slot) => {
        this.tweens.add({
          targets: slot.notRolledMark, alpha: 0, scale: 0.5, duration: 200, ease: 'Sine.easeIn', onComplete: () => slot.notRolledMark.destroy(),
        });
        this.tweens.add({ targets: slot.img, alpha: 1, duration: 200 });
      });
    }

    const level = this.level;
    const [a, b] = this.rollPair(level);
    this.leftSlot.value = a;
    this.rightSlot.value = b;

    Promise.all([
      this.rollItem(this.leftSlot, level, a),
      this.rollItem(this.rightSlot, level, b),
    ]).then(() => this.beginRound());
  }

  // Picks two values within [minValue, maxValue] whose absolute difference
  // is one of level.diffOptions, in a random order (which slot is bigger
  // is randomized independently of the round's bigger/smaller prompt).
  rollPair(level) {
    const { minValue, maxValue, diffOptions } = level;
    for (let i = 0; i < 50; i += 1) {
      const diff = diffOptions[Phaser.Math.Between(0, diffOptions.length - 1)];
      const a = Phaser.Math.Between(minValue, maxValue);
      const options = [];
      if (a + diff <= maxValue) options.push(a + diff);
      if (a - diff >= minValue) options.push(a - diff);
      if (options.length) {
        const b = options[Phaser.Math.Between(0, options.length - 1)];
        return Phaser.Math.Between(0, 1) === 0 ? [a, b] : [b, a];
      }
    }
    return [minValue, Math.min(maxValue, minValue + diffOptions[0])];
  }

  // Fakes a "3D roll" out of flat 2D art: rapidly flickers through random
  // face textures while squashing scaleX toward 0 and bobbing vertically
  // (reads like a tumbling/flipping die), then lands with a little
  // overshoot-and-settle bounce instead of snapping straight to size.
  rollItem(slot, level, finalValue) {
    return new Promise((resolve) => {
      const flipTimer = this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          const randVal = Phaser.Math.Between(level.minValue, level.maxValue);
          slot.img.setTexture(this.textureKeyFor(level, randVal));
        },
      });

      const cycles = 5;
      const stepDuration = 130;
      this.tweens.add({
        targets: slot.img,
        scaleX: 0,
        y: slot.y - 12,
        duration: stepDuration,
        yoyo: true,
        repeat: cycles - 1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: slot.img,
        angle: { from: -8, to: 8 },
        duration: stepDuration * 2,
        yoyo: true,
        repeat: Math.ceil(cycles / 2),
        ease: 'Sine.easeInOut',
      });

      this.time.delayedCall(stepDuration * 2 * cycles, () => {
        flipTimer.remove();
        this.tweens.killTweensOf(slot.img);
        slot.img.setAngle(0);
        slot.img.setY(slot.y);
        slot.img.setTexture(this.textureKeyFor(level, finalValue));
        slot.img.setScale(slot.img._baseScale * 1.22);
        this.tweens.add({
          targets: slot.img,
          scale: slot.img._baseScale,
          duration: 220,
          ease: 'Back.easeOut',
          onComplete: resolve,
        });
      });
    });
  }

  beginRound() {
    this.phase = 'selecting';
    this.selectedSide = null;

    const prompt = this.rounds[this.roundIndex];
    this.currentPrompt = prompt;
    this.promptText.setText(prompt === 'bigger' ? 'Tap the Bigger one!' : 'Tap the Smaller one!');
    this.playSound(this.level.introVoice[prompt]);

    this.leftSlot.zone.setInteractive();
    this.rightSlot.zone.setInteractive();

    this.rollBtn.setVisible(false);
    this.rollBtn.disableInteractive();
    this.checkBtn.container.setVisible(true);
    this.setCheckButtonReady(false);
  }

  onSlotTapped(side) {
    if (this.phase !== 'selecting' || this.selectedSide === side) return;
    this.selectedSide = side;
    this.updateSelectionVisual();
    this.setCheckButtonReady(true);
  }

  // Redraws the "you picked this one" state on both slots — a pulsing gold
  // ring + gentle pop on whichever is selected, a slight dim on the other,
  // so switching your pick before checking reads clearly.
  updateSelectionVisual() {
    [this.leftSlot, this.rightSlot].forEach((slot) => {
      this.tweens.killTweensOf(slot.img);
      if (slot.side === this.selectedSide) {
        if (!slot.selectionRing) slot.selectionRing = this.add.graphics().setDepth(6);
        const ring = slot.selectionRing;
        ring.clear();
        ring.lineStyle(8, 0xffd93d, 1);
        ring.strokeRoundedRect(slot.x - slot.w / 2 - 6, slot.y - slot.h / 2 - 6, slot.w + 12, slot.h + 12, 28);
        this.tweens.killTweensOf(ring);
        ring.setAlpha(1);
        this.tweens.add({ targets: ring, alpha: 0.45, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: slot.img, scale: slot.img._baseScale * 1.1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
      } else {
        slot.selectionRing?.destroy();
        slot.selectionRing = null;
        this.tweens.add({ targets: slot.img, scale: slot.img._baseScale, alpha: 0.55, duration: 150 });
      }
    });
  }

  setCheckButtonReady(ready) {
    this.tweens.killTweensOf(this.checkBtn.container);
    if (ready) {
      this.checkBtn.setBg(0xffd93d);
      this.checkBtn.container.setInteractive({ useHandCursor: true });
      this.checkBtn.container.setScale(1);
      this.tweens.add({
        targets: this.checkBtn.container, scale: 1.05, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      this.checkBtn.setBg(0xd8dee2);
      this.checkBtn.container.disableInteractive();
      this.checkBtn.container.setScale(1);
    }
  }

  onCheckAnswer() {
    if (this.phase !== 'selecting' || !this.selectedSide) return;
    this.phase = 'revealing';

    this.leftSlot.zone.disableInteractive();
    this.rightSlot.zone.disableInteractive();
    this.tweens.killTweensOf(this.checkBtn.container);
    this.checkBtn.container.setVisible(false);
    this.checkBtn.container.disableInteractive();

    [this.leftSlot, this.rightSlot].forEach((slot) => {
      slot.selectionRing?.destroy();
      slot.selectionRing = null;
    });

    const chosenSlot = this.selectedSide === 'left' ? this.leftSlot : this.rightSlot;
    const otherSlot = this.selectedSide === 'left' ? this.rightSlot : this.leftSlot;
    const isCorrect = this.currentPrompt === 'bigger'
      ? chosenSlot.value > otherSlot.value
      : chosenSlot.value < otherSlot.value;

    if (isCorrect) {
      this.correctCount += 1;
      this.playSound('correctVoice');
      this.celebrateSlot(chosenSlot);
    } else {
      this.mistakes += 1;
      this.playSound('wrongVoice');
      this.shakeSlot(chosenSlot, 0xff6b6b);
      this.celebrateSlot(otherSlot, { muteConfetti: true });
    }

    this.time.delayedCall(1150, () => this.advanceRound());
  }

  // Green ring + happy pop + a little confetti burst (Assets.json's
  // correctGlow/particles were blank, so this stands in for them).
  celebrateSlot(slot, { muteConfetti = false } = {}) {
    const ring = this.add.graphics().setDepth(5).setAlpha(0);
    ring.lineStyle(8, 0x51cf66, 1);
    ring.strokeRoundedRect(slot.x - slot.w / 2 - 6, slot.y - slot.h / 2 - 6, slot.w + 12, slot.h + 12, 28);
    this.tweens.add({
      targets: ring, alpha: { from: 0, to: 1 }, duration: 150, yoyo: true, repeat: 2, onComplete: () => ring.destroy(),
    });

    slot.img.setAlpha(1);
    this.tweens.add({
      targets: slot.img,
      scale: slot.img._baseScale * 1.22,
      angle: { from: -4, to: 4 },
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        slot.img.setAngle(0);
        slot.img.setScale(slot.img._baseScale);
      },
    });

    if (!muteConfetti) this.spawnConfetti(slot.x, slot.y - slot.h / 2);
  }

  // Red ring + a quick side-to-side shake.
  shakeSlot(slot, color) {
    const ring = this.add.graphics().setDepth(5).setAlpha(0);
    ring.lineStyle(8, color, 1);
    ring.strokeRoundedRect(slot.x - slot.w / 2 - 6, slot.y - slot.h / 2 - 6, slot.w + 12, slot.h + 12, 28);
    this.tweens.add({
      targets: ring, alpha: { from: 0, to: 1 }, duration: 150, yoyo: true, repeat: 2, onComplete: () => ring.destroy(),
    });

    slot.img.setAlpha(1);
    this.tweens.add({
      targets: slot.img, x: slot.x + 10, duration: 60, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
      onComplete: () => slot.img.setX(slot.x),
    });
  }

  // Small code-drawn confetti burst — a handful of colored squares flung
  // outward and up, fading as they fall. No particle-manager dependency,
  // just simple tweened rectangles.
  spawnConfetti(x, y) {
    const colors = [0xffd93d, 0xff6b6b, 0x51cf66, 0x4dabf7, 0xb96bf0];
    for (let i = 0; i < 10; i += 1) {
      const dot = this.add.rectangle(x, y, 8, 12, colors[i % colors.length]).setDepth(8);
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.85, -Math.PI * 0.15);
      const dist = Phaser.Math.Between(60, 130);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 40,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(500, 750),
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  advanceRound() {
    [this.leftSlot, this.rightSlot].forEach((slot) => {
      slot.selectionRing?.destroy();
      slot.selectionRing = null;
      slot.img.setAlpha(1);
      slot.img.setAngle(0);
      slot.img.setScale(slot.img._baseScale);
      slot.img.setX(slot.x);
    });

    this.roundIndex += 1;
    if (this.roundIndex >= this.rounds.length) {
      this.finishLevel();
      return;
    }

    this.roundPill.setText(`Round ${this.roundIndex + 1}/${this.rounds.length}`);
    this.tweens.add({ targets: this.roundPill.container, scale: 1.15, duration: 150, yoyo: true, ease: 'Sine.easeInOut' });

    this.phase = 'idle';
    this.promptText.setText('Tap Roll for the next round!');
    this.checkBtn.container.setVisible(false);
    this.rollBtn.setVisible(true);
    this.rollBtn.setInteractive({ useHandCursor: true });
  }

  finishLevel() {
    const level = this.level;
    const passed = this.correctCount >= level.passThreshold;
    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);

    this.tweens.killTweensOf(this.rollBtn);
    this.rollBtn.setVisible(false);
    this.checkBtn.container.setVisible(false);

    if (passed) {
      progress.completeLevel(this.levelIndex);
      this.playSound('winGoodJob');
    }

    // Mirrors BonusGame1's convention: stars/totalRounds scale together
    // with level progress (Level 1 -> 1/1, Level 2 -> 2/2) rather than
    // reporting raw round counts, so the server's stars<=totalRounds clamp
    // never silently caps anything.
    this.game.events.emit('comparedice-complete', {
      elapsedSeconds,
      mistakes: this.mistakes,
      level: this.levelIndex + 1,
      levelKey: level.key,
      stars: passed ? this.levelIndex + 1 : this.levelIndex,
      totalRounds: this.levelIndex + 1,
    });

    this.showEndOverlay(passed);
  }

  showEndOverlay(passed) {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55).setDepth(40);

    const panelW = Math.min(440, width - 60);
    const panelH = 280;

    // Bouncy pop-in entrance for the whole card, instead of it just
    // appearing instantly.
    const panelGroup = this.add.container(width / 2, height / 2).setDepth(41).setScale(0);
    this.tweens.add({ targets: panelGroup, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 30);

    const title = passed ? 'Great Job!' : 'Almost There!';
    const subtitle = passed
      ? `You got ${this.correctCount} out of ${this.rounds.length} correct!`
      : `You got ${this.correctCount} out of ${this.rounds.length}. Get ${this.level.passThreshold} or more to pass!`;

    const emoji = this.add.text(0, -90, passed ? '🎉' : '😊', { fontSize: '56px' }).setOrigin(0.5);
    const titleText = this.add.text(0, -30, title, {
      fontSize: '36px', fontFamily: 'Fredoka, sans-serif', fontStyle: 'bold', color: '#0f3d5c',
    }).setOrigin(0.5);
    const subtitleText = this.add.text(0, 14, subtitle, {
      fontSize: '22px', fontFamily: 'Fredoka, sans-serif', color: '#4a6478', align: 'center', wordWrap: { width: panelW - 50 },
    }).setOrigin(0.5);

    panelGroup.add([panel, emoji, titleText, subtitleText]);

    if (passed) {
      this.tweens.add({
        targets: emoji, angle: { from: -12, to: 12 }, duration: 260, yoyo: true, repeat: 2, delay: 380, ease: 'Sine.easeInOut',
      });
      this.spawnConfetti(width / 2, height / 2 - 90);
    }

    const btnY = height / 2 + 90;
    if (passed) {
      const hasNext = this.levelIndex + 1 < LEVELS.length;
      this.createPillButton(width / 2, btnY, hasNext ? 'Next Level ➡️' : 'Back to Levels 🏠', {
        fontSize: '22px', paddingX: 26, paddingY: 14, depth: 42,
      }).on('pointerup', () => {
        if (hasNext) this.scene.start('CompareDiceScene', { levelIndex: this.levelIndex + 1 });
        else this.scene.start('LevelSelectScene');
      });
    } else {
      this.createPillButton(width / 2, btnY, 'Try Again 🔄', {
        fontSize: '22px', paddingX: 26, paddingY: 14, depth: 42,
      }).on('pointerup', () => {
        this.scene.start('CompareDiceScene', { levelIndex: this.levelIndex });
      });
    }
  }

  playSound(key) {
    if (key && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: 0.9 });
    }
  }
}