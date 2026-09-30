// GameScene.js
// Game 13 — BOILERPLATE ONLY.
//
// A runnable placeholder: the shared shell (start card, header, audio, mute) is
// wired, and a single placeholder button fires the completion event so the
// logPlaySession path is proven end to end. There are no real mechanics yet —
// replace buildPlaceholderBoard()/setupRound() with the actual round once the
// gameplay brief lands.
import * as Phaser from 'phaser';
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import {
  makeConfettiTexture,
  makeConfettiSquareTexture,
} from '@/phaser/common/sceneAssets';
import { TOTAL_ROUNDS } from '@/games/game-13/levels';

// The clear colour behind everything, and the Phaser canvas clear colour (see
// Game.jsx) so the single frame before the backdrop draws is not a bare canvas.
export const BACKGROUND_COLOR = '#eef2ff';

// Layout (720x1080 base resolution — see Phaser/config.js).
const TITLE_Y = 54;
const PROMPT_Y = 108;
const START_BUTTON_Y = 952;

// Draw order bands.
const DEPTH_BACKDROP = 0;
const DEPTH_HUD = 20;
const DEPTH_DRAG = 60;
const DEPTH_START = 400; // the start screen covers everything

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.phase = 'start';
    this.stars = 0;
    this.mistakes = 0;
    this.peakStreak = 0;
  }

  create() {
    const { width, height } = this.scale;

    this.startTime = this.time.now;

    // Background music + first-tap unlock, plus the shared mute button.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Backdrop: cover-fit artwork if present, else a white-to-lilac gradient.
    if (this.textures.exists('background')) {
      const bg = this.add.image(width / 2, height / 2, 'background');
      bg.setScale(Math.max(width / bg.width, height / bg.height));
      bg.setDepth(DEPTH_BACKDROP);
    } else {
      const backdrop = this.add.graphics().setDepth(DEPTH_BACKDROP);
      backdrop.fillGradientStyle(0xffffff, 0xffffff, 0xeef2ff, 0xeef2ff, 1);
      backdrop.fillRect(0, 0, width, height);
    }

    // Fixed HUD.
    this.add
      .text(width / 2, TITLE_Y, 'Game 13', {
        fontSize: '42px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#3b2f1e',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_HUD);

    this.promptText = this.add
      .text(width / 2, PROMPT_Y, 'Coming soon', {
        fontSize: '26px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#8a7758',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_HUD);

    this.buildStartOverlay();
  }

  // ---------------------------------------------------------------------------
  // Start screen
  // ---------------------------------------------------------------------------

  // Covers the first round with the title card and a Start button. The board is
  // built underneath (beginPlay already ran) so pressing Start is a simple
  // fade-away into play rather than another setup pass.
  buildStartOverlay() {
    const { width, height } = this.scale;
    this.phase = 'start';

    this.startOverlay = this.add.container(0, 0).setDepth(DEPTH_START);

    // Optional title card: cover-fit if the game ships one, else a plain panel
    // so the skeleton still presents a deliberate start screen.
    if (this.textures.exists('startScreen')) {
      const card = this.add.image(width / 2, height / 2, 'startScreen');
      card.setScale(Math.max(width / card.width, height / card.height));
      this.startOverlay.add(card);
    } else {
      const panel = this.add.graphics();
      panel.fillStyle(0xffffff, 0.92);
      panel.fillRoundedRect(width / 2 - 260, height / 2 - 200, 520, 400, 28);
      panel.lineStyle(4, 0x3b2f1e, 0.15);
      panel.strokeRoundedRect(width / 2 - 260, height / 2 - 200, 520, 400, 28);
      this.startOverlay.add(panel);

      const card = this.add
        .text(width / 2, height / 2 - 40, 'Game 13', {
          fontSize: '56px',
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: '#3b2f1e',
        })
        .setOrigin(0.5);
      const sub = this.add
        .text(width / 2, height / 2 + 30, 'Coming soon', {
          fontSize: '28px',
          fontFamily: 'Fredoka, sans-serif',
          color: '#8a7758',
        })
        .setOrigin(0.5);
      this.startOverlay.add(card);
      this.startOverlay.add(sub);
    }

    const startBtn = this.createPillButton(width / 2, START_BUTTON_Y, 'Start \u25B6', {
      fontSize: '34px',
      paddingX: 48,
      paddingY: 20,
      depth: DEPTH_START + 1,
    });
    // createPillButton returns a wrapper ({ container, on, ... }), not a plain
    // GameObject — add its container to the overlay, and tween that same
    // container, or Phaser chokes putting a non-GameObject into a Container.
    this.startOverlay.add(startBtn.container);
    // A gentle pulse so the button reads as the thing to press.
    this.tweens.add({
      targets: startBtn.container,
      scale: 1.06,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    startBtn.on('pointerup', () => this.beginPlay());
  }

  // Fades the start screen out, then drops into the (placeholder) board.
  beginPlay() {
    if (this.phase !== 'start') return;
    this.phase = 'playing';

    const overlay = this.startOverlay;
    this.startOverlay = null;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => overlay.destroy(true),
    });

    this.buildPlaceholderBoard();
  }

  // ---------------------------------------------------------------------------
  // Placeholder board — no mechanics yet
  // ---------------------------------------------------------------------------

  buildPlaceholderBoard() {
    const { width, height } = this.scale;
    this.promptText.setText('Mechanics coming soon');

    this.add
      .text(width / 2, height / 2 - 60, 'This game is being built \uD83D\uDEA7', {
        fontSize: '30px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#3b2f1e',
        align: 'center',
        wordWrap: { width: width - 100 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_HUD);

    // Placeholder completion so logPlaySession is exercised end to end. Remove
    // this button when the real rounds are implemented.
    const finishBtn = this.createPillButton(
      width / 2,
      height / 2 + 80,
      'Finish (placeholder)',
      {
        fontSize: '24px',
        paddingX: 28,
        paddingY: 14,
        depth: DEPTH_DRAG + 1,
      }
    );
    finishBtn.on('pointerup', () => this.finishGame());
    this.finishBtn = finishBtn;
  }

  // ---------------------------------------------------------------------------
  // Finish
  // ---------------------------------------------------------------------------

  finishGame() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.finishBtn?.destroy();

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);
    this.spawnConfetti(24);

    // The single end-of-run log — matches Game.jsx's completeEventName.
    this.game.events.emit('game13-complete', {
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

    this.add.rectangle(width / 2, height / 2, width, height, 0x3b2f1e, 0.5).setDepth(300);

    const panel = this.add.container(width / 2, height / 2).setDepth(301).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-220, -150, 440, 300, 28);
    bg.lineStyle(6, 0xf59e0b, 1);
    bg.strokeRoundedRect(-220, -150, 440, 300, 28);
    panel.add(bg);

    const title = this.add
      .text(0, -60, 'Thanks for playing!', {
        fontSize: '40px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#3b2f1e',
      })
      .setOrigin(0.5);
    panel.add(title);

    const note = this.add
      .text(0, 10, 'More to come soon \u2728', {
        fontSize: '24px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#8a7758',
      })
      .setOrigin(0.5);
    panel.add(note);

    const btn = this.createPillButton(width / 2, height / 2 + 108, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 302,
    });
    btn.on('pointerup', () => this.scene.restart());
  }

  // Confetti — spawns small coloured pieces above the canvas and lets them
  // drift down with a tumble, destroying each as it leaves the screen.
  spawnConfetti(count = 24) {
    const { width, height } = this.scale;
    const texKeys = [makeConfettiTexture(this), makeConfettiSquareTexture(this)];
    const tints = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6];

    for (let i = 0; i < count; i += 1) {
      const key = texKeys[i % texKeys.length];
      const piece = this.add
        .image(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(-180, -60), key)
        .setDepth(DEPTH_DRAG + 4)
        .setTint(Phaser.Utils.Array.GetRandom(tints))
        .setScale(Phaser.Math.FloatBetween(1.1, 2.2))
        .setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: piece,
        x: piece.x + Phaser.Math.Between(-80, 80),
        y: height + 60,
        angle: piece.angle + Phaser.Math.Between(220, 620),
        duration: Phaser.Math.Between(1500, 2600),
        delay: i * 40,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }
}
