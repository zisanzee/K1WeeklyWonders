// CompareDiceScene.js
// Drives both levels (Dice and Domino) off the same code — everything
// level-specific (value range, allowed difference, round counts, image
// prefix, roll-button key, intro voice keys, tint) comes from levels.js,
// so this scene doesn't need a Dice/Domino branch anywhere.
import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { LEVELS, buildRounds, progress } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';

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
    this.rolling = false;
    this.locked = true;
  }

  create() {
    const { width, height } = this.scale;
    const level = this.level;

    this.startTime = this.time.now;
    this.stopSpeechOnShutdown();

    // Real background art, tinted per-level per the design note. Anchored
    // from the TOP (originY: 0) so a cover-fit crop only trims the bottom
    // of the art instead of equally trimming top and bottom — keeps the
    // room's framing (banner/chalkboard/windows) fully visible.
    const bg = this.add.image(width / 2, 0, 'background').setOrigin(0.5, 0).setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);
    bg.setTint(level.tint);

    this.add.text(width / 2, 44, `${level.icon} ${level.subtitle}`, {
      fontSize: '26px', fontFamily: 'Fredoka, sans-serif', fontStyle: 'bold', color: '#0f3d5c',
    }).setOrigin(0.5).setDepth(20);

    this.roundPill = this.createPillButton(width - 16, 16, `Round ${this.roundIndex + 1}/${this.rounds.length}`, {
      fontSize: '18px', paddingX: 14, paddingY: 8, anchor: 'topRight', interactive: false, depth: 25,
    });
    this.createPillButton(16, 16, `⭐ ${progress.totalStars()}/${LEVELS.length}`, {
      fontSize: '18px', paddingX: 14, paddingY: 8, anchor: 'topLeft', interactive: false, depth: 25,
    });
    addMuteButton(this, 16, 64, { anchor: 'topLeft' });

    this.promptText = this.add.text(width / 2, 104, 'Tap Roll to start!', {
      fontSize: '25px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#c2410c',
      align: 'center',
      wordWrap: { width: width - 60 },
    }).setOrigin(0.5).setDepth(20);

    const slotY = height * 0.42;
    const slotGap = width * 0.17;
    const slotSize = Math.min(width * 0.36, 230);

    this.leftSlot = this.buildSlot(width / 2 - slotGap, slotY, slotSize, level);
    this.rightSlot = this.buildSlot(width / 2 + slotGap, slotY, slotSize, level);

    this.rollBtn = this.add.image(width / 2, height * 0.73, level.rollButtonKey).setDepth(20);
    const targetW = Math.min(width * 0.46, 280);
    const baseScale = targetW / this.rollBtn.width;
    this.rollBtn.setScale(baseScale);
    this.rollBtn._baseScale = baseScale;
    this.rollBtn.setInteractive({ useHandCursor: true });
    this.rollBtn.on('pointerdown', () => this.onRollPressed());
    this.rollPulse = this.tweens.add({
      targets: this.rollBtn, scale: baseScale * 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // One shared, looping bgMusic Sound lives for the whole game session —
    // this reuses it (or starts it, respecting the unlock/mute state) so
    // it doesn't restart or cut out every time this scene is entered.
    ensureBgMusic(this);
  }

  buildSlot(x, y, size, level) {
    const card = this.add.graphics().setDepth(1);
    card.fillStyle(0xffffff, 0.85);
    card.fillRoundedRect(x - size / 2, y - size / 2, size, size, 26);
    card.lineStyle(5, level.accentColor, 1);
    card.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 26);

    const initialValue = level.minValue;
    const img = this.add.image(x, y, this.textureKeyFor(level, initialValue)).setDepth(2);
    const maxDim = size * 0.74;
    const s = Math.min(maxDim / img.width, maxDim / img.height);
    img.setScale(s);
    img._baseScale = s;

    // Local-space rectangle (origin at the zone's own center), NOT scene
    // coordinates — Phaser hit-tests a custom hitArea against the pointer
    // position translated into the game object's local space, so reusing
    // the absolute x/y here (as a previous version did) put the real
    // clickable region far from where the dice actually render.
    const hit = new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size);
    const zone = this.add.zone(x, y, size, size)
      .setInteractive({ hitArea: hit, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true })
      .setDepth(3);
    zone.disableInteractive();

    return {
      x, y, size, img, zone, value: initialValue,
    };
  }

  textureKeyFor(level, value) {
    return `${level.imagePrefix}${value}`;
  }

  onRollPressed() {
    if (this.rolling) return;
    this.rolling = true;
    this.locked = true;
    this.rollBtn.disableInteractive();
    this.promptText.setText('Rolling...');
    this.playSound('rollVoice');

    const level = this.level;
    const [a, b] = this.rollPair(level);
    this.leftSlot.value = a;
    this.rightSlot.value = b;

    Promise.all([
      this.rollItem(this.leftSlot, level, a),
      this.rollItem(this.rightSlot, level, b),
    ]).then(() => {
      this.rolling = false;
      this.beginRound();
    });
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
  // face textures while squashing scaleX toward 0 and back (reads like a
  // tumbling/flipping die) a handful of times, then settles on the real
  // final value.
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
        angle: 6,
        duration: stepDuration,
        yoyo: true,
        repeat: cycles - 1,
        ease: 'Sine.easeInOut',
      });

      this.time.delayedCall(stepDuration * 2 * cycles, () => {
        flipTimer.remove();
        slot.img.setAngle(0);
        slot.img.setTexture(this.textureKeyFor(level, finalValue));
        slot.img.setScale(slot.img._baseScale);
        resolve();
      });
    });
  }

  beginRound() {
    const prompt = this.rounds[this.roundIndex];
    this.currentPrompt = prompt;
    this.promptText.setText(prompt === 'bigger' ? 'Which one is BIGGER?' : 'Which one is SMALLER?');
    this.playSound(this.level.introVoice[prompt]);

    this.locked = false;
    this.leftSlot.zone.setInteractive();
    this.rightSlot.zone.setInteractive();
    // The zone that ISN'T tapped in a given round keeps its 'once'
    // listener from that round attached (it never fired to self-remove) —
    // clear both explicitly before attaching this round's, so they don't
    // pile up over a full playthrough.
    this.leftSlot.zone.off('pointerdown');
    this.rightSlot.zone.off('pointerdown');
    this.leftSlot.zone.once('pointerdown', () => this.onAnswer('left'));
    this.rightSlot.zone.once('pointerdown', () => this.onAnswer('right'));
  }

  onAnswer(side) {
    if (this.locked) return;
    this.locked = true;
    this.leftSlot.zone.disableInteractive();
    this.rightSlot.zone.disableInteractive();

    const chosenSlot = side === 'left' ? this.leftSlot : this.rightSlot;
    const otherSlot = side === 'left' ? this.rightSlot : this.leftSlot;

    // Show a "you picked this one" highlight the instant the tap lands,
    // before we even reveal whether it was right — so there's always
    // immediate visible confirmation the tap registered.
    this.highlightSelection(chosenSlot, otherSlot);

    const chosenValue = chosenSlot.value;
    const otherValue = otherSlot.value;
    const isCorrect = this.currentPrompt === 'bigger'
      ? chosenValue > otherValue
      : chosenValue < otherValue;

    this.time.delayedCall(280, () => {
      if (isCorrect) {
        this.correctCount += 1;
        this.playSound('correctVoice');
        this.flashSlot(chosenSlot, 0x51cf66);
      } else {
        this.mistakes += 1;
        this.playSound('wrongVoice');
        this.flashSlot(chosenSlot, 0xff6b6b);
        // Also show which one WAS correct, so the child sees the right answer.
        this.flashSlot(otherSlot, 0x51cf66);
      }
      this.time.delayedCall(950, () => this.advanceRound());
    });
  }

  highlightSelection(chosenSlot, otherSlot) {
    const ring = this.add.graphics().setDepth(6);
    ring.lineStyle(8, 0xffd93d, 1);
    ring.strokeRoundedRect(
      chosenSlot.x - chosenSlot.size / 2 - 6,
      chosenSlot.y - chosenSlot.size / 2 - 6,
      chosenSlot.size + 12,
      chosenSlot.size + 12,
      28,
    );
    chosenSlot._selectionRing = ring;
    this.tweens.add({ targets: chosenSlot.img, scale: chosenSlot.img._baseScale * 1.08, duration: 150, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: otherSlot.img, alpha: 0.55, duration: 150 });
  }

  // Code-drawn feedback ring + pop (Assets.json's correctGlow/wrongGlow
  // were blank, so this stands in for them) around whichever slot it's
  // called on.
  flashSlot(slot, color) {
    const ring = this.add.graphics().setDepth(5).setAlpha(0);
    ring.lineStyle(8, color, 1);
    ring.strokeRoundedRect(
      slot.x - slot.size / 2 - 6,
      slot.y - slot.size / 2 - 6,
      slot.size + 12,
      slot.size + 12,
      28,
    );
    this.tweens.add({
      targets: ring, alpha: { from: 0, to: 1 }, duration: 150, yoyo: true, repeat: 2, onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: slot.img, scale: slot.img._baseScale * 1.15, duration: 150, yoyo: true, ease: 'Sine.easeInOut',
    });
  }

  advanceRound() {
    [this.leftSlot, this.rightSlot].forEach((slot) => {
      slot._selectionRing?.destroy();
      slot._selectionRing = null;
      slot.img.setAlpha(1);
      slot.img.setScale(slot.img._baseScale);
    });

    this.roundIndex += 1;
    if (this.roundIndex >= this.rounds.length) {
      this.finishLevel();
      return;
    }
    this.roundPill.setText(`Round ${this.roundIndex + 1}/${this.rounds.length}`);
    this.promptText.setText('Tap Roll for the next round!');
    this.rollBtn.setInteractive({ useHandCursor: true });
  }

  finishLevel() {
    const level = this.level;
    const passed = this.correctCount >= level.passThreshold;
    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);

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
    const panel = this.add.graphics().setDepth(41);
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 30);

    const title = passed ? 'Great Job!' : 'Almost There!';
    const subtitle = passed
      ? `You got ${this.correctCount} out of ${this.rounds.length} correct!`
      : `You got ${this.correctCount} out of ${this.rounds.length}. Get ${this.level.passThreshold} or more to pass!`;

    this.add.text(width / 2, height / 2 - 90, passed ? '🎉' : '😊', { fontSize: '56px' }).setOrigin(0.5).setDepth(42);
    this.add.text(width / 2, height / 2 - 30, title, {
      fontSize: '32px', fontFamily: 'Fredoka, sans-serif', fontStyle: 'bold', color: '#0f3d5c',
    }).setOrigin(0.5).setDepth(42);
    this.add.text(width / 2, height / 2 + 12, subtitle, {
      fontSize: '19px', fontFamily: 'Fredoka, sans-serif', color: '#4a6478', align: 'center', wordWrap: { width: panelW - 50 },
    }).setOrigin(0.5).setDepth(42);

    const btnY = height / 2 + 90;
    if (passed) {
      const hasNext = this.levelIndex + 1 < LEVELS.length;
      this.createPillButton(width / 2, btnY, hasNext ? 'Next Level ➡️' : 'Back to Levels 🏠', {
        fontSize: '21px', paddingX: 26, paddingY: 14, depth: 42,
      }).on('pointerup', () => {
        if (hasNext) this.scene.start('CompareDiceScene', { levelIndex: this.levelIndex + 1 });
        else this.scene.start('LevelSelectScene');
      });
    } else {
      this.createPillButton(width / 2, btnY, 'Try Again 🔄', {
        fontSize: '21px', paddingX: 26, paddingY: 14, depth: 42,
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
