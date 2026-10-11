// GameScene.js
// Game 14 — BOILERPLATE Phaser scene.
//
// A minimal, fully-playable round loop you can build the real mechanic on top of:
// each round shows a target number and a few answer buttons; tapping the right
// one clears the round and advances, tapping a wrong one counts a miss and
// retries the same round. After TOTAL_ROUNDS the scene emits 'game14-complete'
// with { stars, totalRounds, peakStreak, mistakes, elapsedSeconds }.
//
// Everything here reads through the shared helpers (@/phaser/common) — audio
// state, the sky background, the pill button — never a per-game copy. Coordinates
// are INTERNAL pixels on the 720x1080 canvas; this scene uses this.scale so it
// also survives a different base resolution.
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import { TOTAL_ROUNDS, buildRoundPlan, starsForMistakes } from '@/games/game-14/rounds';

// The canvas clear colour (see Game.jsx) so the one frame before the sky draws
// is not a bare canvas.
export const BACKGROUND_COLOR = '#0f3d5c';

// The 3-stop sky this game's loading scene hands off from, so there is no seam.
const SKY_THEME = {
  bgColors: ['#3fb6ea', '#8fe0fa', '#ffe9a8'],
  groundColor: '#8ee06a',
};

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.resetRun();
  }

  // All per-RUN state. Called from the constructor AND at the top of create(),
  // because scene.restart() re-runs create() on the SAME instance (the
  // constructor does not run again) — anything initialised only there would
  // carry over into a replay.
  resetRun() {
    this.phase = 'idle'; // 'idle' | 'playing' | 'complete'
    this.stars = 0;
    this.mistakes = 0;
    this.streak = 0;
    this.peakStreak = 0;
    this.startTime = 0;
    this.plan = [];
    this.roundIndex = 0;

    this.targetText = null;
    this.progressFill = null;
    this.optionButtons = [];
    this.locked = false; // ignore taps while a choice resolves
  }

  create() {
    this.resetRun();
    this.startTime = this.time.now;

    // Shared sky background + drifting clouds, so the scene matches every other
    // game's look for free.
    this.addSkyBackground(SKY_THEME, 'g14-sky');
    this.addDriftingClouds([
      { xr: 0.18, yr: 0.16, scale: 1, alpha: 0.85 },
      { xr: 0.78, yr: 0.1, scale: 0.8, alpha: 0.7 },
    ]);

    // Shared bg music + first-tap unlock, plus the shared mute button. Mute is a
    // property of the player (one localStorage key) — never per-game.
    this.bgMusic = ensureBgMusic(this);
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    this.buildHud();
    this.buildBoard();

    // Fixed per-run plan so a replayed round keeps the same choices.
    this.plan = buildRoundPlan();

    // Start on the first tap (also unlocks audio on mobile).
    this.input.once('pointerdown', () => this.startRun());
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Tap to start', {
        fontSize: '34px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#0f3d5c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setName('startHint');

    this.stopSpeechOnShutdown();
    this.events.once('shutdown', () => this.stopSpeech());
  }

  // ---------------------------------------------------------------------------
  // HUD — target prompt + progress bar
  // ---------------------------------------------------------------------------

  buildHud() {
    const { width } = this.scale;

    this.targetText = this.add
      .text(width / 2, 210, '', {
        fontSize: '56px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#0f3d5c',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 80 },
      })
      .setOrigin(0.5);

    const barW = Math.min(320, width - 100);
    const barH = 18;
    const barX = width / 2 - barW / 2;
    const barY = 300;
    const track = this.add.graphics();
    track.fillStyle(0xffffff, 0.4);
    track.fillRoundedRect(barX, barY, barW, barH, barH / 2);
    this.progressBar = { x: barX, y: barY, w: barW, h: barH };
    this.progressFill = this.add.graphics();
  }

  drawProgress() {
    const { x, y, w, h } = this.progressBar;
    this.progressFill.clear();
    this.progressFill.fillStyle(0xffd93d, 1);
    const frac = this.roundIndex / TOTAL_ROUNDS;
    const fw = w * frac;
    if (fw > 0) this.progressFill.fillRoundedRect(x, y, fw, h, Math.min(h / 2, fw / 2));
  }

  // ---------------------------------------------------------------------------
  // Board — one pill button per answer option
  // ---------------------------------------------------------------------------

  buildBoard() {
    this.board = this.add.container(this.scale.width / 2, this.scale.height / 2 + 40);
  }

  renderRound() {
    const step = this.plan[this.roundIndex];
    if (!step) return;

    // Clear the previous round's buttons.
    this.optionButtons.forEach((b) => b?.destroy?.());
    this.optionButtons = [];
    this.locked = false;

    this.targetText.setText(`Which is ${step.target}?`);
    this.drawProgress();

    const gap = 26;
    const btnW = (this.scale.width - 120 - gap * (step.options.length - 1)) / step.options.length;

    step.options.forEach((value, i) => {
      const x = (i - (step.options.length - 1) / 2) * (btnW + gap);
      // createPillButton sizes itself from the label; minWidth/minHeight force
      // the equal-width tiles this grid needs.
      const button = this.createPillButton(x, 0, String(value), {
        fontSize: '40px',
        minWidth: btnW,
        minHeight: 96,
        onClick: undefined,
      });
      button.on('pointerup', () => this.choose(i));
      // The board container owns the layout; move the pill's inner container in.
      this.board.add(button.container);
      this.optionButtons.push(button);
    });
  }

  // ---------------------------------------------------------------------------
  // Round flow
  // ---------------------------------------------------------------------------

  startRun() {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    this.getByName('startHint')?.destroy();
    this.renderRound();
  }

  choose(index) {
    if (this.phase !== 'playing' || this.locked) return;
    const step = this.plan[this.roundIndex];
    if (index === step.answerIndex) {
      this.locked = true;
      this.streak += 1;
      this.peakStreak = Math.max(this.peakStreak, this.streak);
      this.sound.play('pop1', { volume: 0.6 });
      this.roundIndex += 1;
      this.drawProgress();
      if (this.roundIndex >= TOTAL_ROUNDS) {
        this.time.delayedCall(320, () => this.finish());
      } else {
        this.time.delayedCall(320, () => this.renderRound());
      }
    } else {
      this.streak = 0;
      this.mistakes += 1;
      this.sound.play('wrong', { volume: 0.6 });
      // Flash the board so a miss reads clearly, then allow another try.
      this.cameras.main.flash(180, 255, 90, 90);
    }
  }

  finish() {
    this.phase = 'complete';
    this.stars = starsForMistakes(this.mistakes);
    this.drawProgress();

    const payload = {
      stars: this.stars,
      totalRounds: TOTAL_ROUNDS,
      peakStreak: this.peakStreak,
      mistakes: this.mistakes,
      elapsedSeconds: Math.round((this.time.now - this.startTime) / 1000),
    };
    // The shared shell (Game.jsx) listens for this and logs the play session.
    this.game.events.emit('game14-complete', payload);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2, '🎉 All done!', {
        fontSize: '48px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#0f3d5c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
