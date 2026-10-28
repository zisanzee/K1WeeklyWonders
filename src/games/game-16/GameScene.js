// GameScene.js
// Game 16 (in works) — BOILERPLATE scene.
//
// Everything this scene does is shared plumbing:
//   • paint the shared baked sky gradient (BaseScene.addSkyBackground)
//   • add the drifting clouds that prove the scene is running
//   • mount the shared mute button and the shared bg-music helper
//   • draw the "(in works)" heading, so the empty screen reads as WIP
//
// There is deliberately NO mechanic here: no rounds, no input handling, no
// scoring, no start or end screen. Those get added one system at a time once
// the game is designed. Adding gameplay means adding files (levels.js, etc.)
// and tuning blocks, not growing this file's scaffolding.
//
// EVERY adjustable number lives in `tuning.js`, so this file stays logic and
// assembly only.
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import { BACKGROUND_COLOR, SKY_THEME, CLOUDS, BACKDROP, NOTICE, MUTE } from '@/games/game-16/tuning';

// Re-exported so `import GameScene, { BACKGROUND_COLOR }` works in Game.jsx —
// the value itself lives in tuning.js, which must stay importable without
// pulling a scene (and Phaser) into anything that only wants the colour.
export { BACKGROUND_COLOR };

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.buildBackdrop();

    // Shared bg music. `ensureBgMusic` owns creating/reusing the Sound and
    // applying the global mute preference; the extra first-tap call is the
    // retry for browsers that block autoplay until the child touches the
    // screen. The music starting is not part of the mechanic, so it is safe to
    // have here even with no gameplay.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));

    // Shared mute toggle. Mute is a property of the PLAYER, stored under one
    // app-wide localStorage key — never a per-game one, and never reimplemented
    // per game.
    addMuteButton(this, MUTE.x, MUTE.y, {
      anchor: MUTE.anchor,
      depth: MUTE.depth,
    });

    this.buildNotice();
  }

  // The baked sky gradient. It is drawn from the shared theme in tuning.js, so
  // the loading screen (BasePreloadScene, same colours) hands over with no
  // visible seam.
  buildBackdrop() {
    this.addSkyBackground(SKY_THEME, BACKDROP.key).setDepth(BACKDROP.depth);
    this.addDriftingClouds(CLOUDS);
  }

  // The "(in works)" heading. It exists ONLY because a boilerplate has no start
  // screen: without it the game opens on an empty sky, which looks broken
  // rather than unfinished. Delete this whole method when real gameplay lands.
  buildNotice() {
    this.add
      .text(NOTICE.x, NOTICE.y, NOTICE.text, {
        fontSize: NOTICE.headingFontSize,
        fontFamily: 'Fredoka, sans-serif',
        color: NOTICE.headingColor,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(NOTICE.depth);

    this.add
      .text(NOTICE.x, NOTICE.y + NOTICE.subtitleGap, NOTICE.subtitle, {
        fontSize: NOTICE.subtitleFontSize,
        fontFamily: 'Fredoka, sans-serif',
        color: NOTICE.subtitleColor,
        align: 'center',
        // Word-wrap to the canvas width minus a margin, so the line stays
        // readable on a narrow phone without a second tuning number per break.
        wordWrap: { width: this.scale.width - 80 },
      })
      .setOrigin(0.5)
      .setDepth(NOTICE.depth);
  }
}
