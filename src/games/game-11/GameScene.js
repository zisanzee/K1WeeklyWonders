// GameScene.js
// Game 11 — BOILERPLATE ONLY / PLACEHOLDER.
//
// This is the one file you replace wholesale when the game is built. It is a
// minimal, self-contained scene so the route, gates, asset manifest and
// completion logging are all exercisable end-to-end BEFORE any mechanics exist.
//
// It deliberately:
//   - extends BaseScene (shared pill-button / sky-background helpers);
//   - paints a cover-fit 'background' texture when one has been added to the
//     manifest, and falls back to the exported solid BACKGROUND_COLOR when it
//     has not — so the canvas is never a bare gap while assets are pending;
//   - ticks a "0 / TOTAL_ROUNDS" progress readout using the shared constants,
//     proving levels.js is wired in;
//   - fires the 'game11-complete' event through finishGame(), so Game.jsx's
//     onComplete -> logPlaySession path is proven without a real win state.
//
// Keep the exported BACKGROUND_COLOR and the completion event shape — Game.jsx
// imports the first and listens for the second.
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import { TOTAL_ROUNDS } from '@/games/game-11/levels';

// The clear colour behind everything. Replace with a value sampled from the
// final background artwork so the single frame before it draws is not a bare
// canvas as the scene fades in.
export const BACKGROUND_COLOR = '#1e1b5a';

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    // Matches the other games: bg music with a first-tap unlock, plus the
    // shared mute button. Mute is a property of the player, not the game.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Background: cover-fit the artwork if it is in the manifest, otherwise
    // fill with the solid clear colour so the placeholder still looks intended.
    if (this.textures.exists('background')) {
      const bg = this.add.image(width / 2, height / 2, 'background');
      const cover = Math.max(width / bg.width, height / bg.height);
      bg.setScale(cover);
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, BACKGROUND_COLOR);
    }

    // Placeholder title card + a Play button that proves the completion path.
    this.add
      .text(width / 2, height / 2 - 120, 'Game 11', {
        fontSize: '64px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 40, `Ready — ${TOTAL_ROUNDS} rounds to build`, {
        fontSize: '26px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);

    this.createPillButton(width / 2, height / 2 + 70, 'Finish \u25B6', {
      fontSize: '34px',
      paddingX: 48,
      paddingY: 18,
      depth: 10,
    }).on('pointerup', () => this.finishGame());
  }

  // Placeholder completion: emits the same payload shape Game.jsx logs. When
  // the real game exists, replace the hardcoded zeroes with the live counters
  // (mirroring Game 10's finishGame).
  finishGame() {
    const elapsedSeconds = Math.round((this.time.now - (this.startTime || this.time.now)) / 1000);
    this.game.events.emit('game11-complete', {
      stars: 0,
      totalRounds: TOTAL_ROUNDS,
      peakStreak: 0,
      mistakes: 0,
      elapsedSeconds,
    });
  }
}
