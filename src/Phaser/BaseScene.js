// Phaser/BaseScene.js
import * as Phaser from 'phaser';
import { createPillButton } from './common/uiHelpers';
import { makeBackgroundTexture, makeCloudTexture } from './common/sceneAssets';

// Optional common functionality for game scenes. Extending this instead of
// Phaser.Scene directly is purely a convenience — nothing else assumes a
// scene extends it — but it removes the sky-background + drifting-clouds +
// pill-button boilerplate that used to be duplicated between
// LevelSelectScene and NumberOrderScene in BonusGame1, so a new bonus
// game's scenes can pull the same look for free.
export default class BaseScene extends Phaser.Scene {
  // Thin wrapper so scenes can call this.createPillButton(...) instead of
  // importing createPillButton and passing `this` every time.
  createPillButton(x, y, initialLabel, opts = {}) {
    return createPillButton(this, x, y, initialLabel, opts);
  }

  // Bakes + adds the shared 3-stop sky gradient (with sun glow and rolling
  // ground strip) as a background image sized to the current scene.
  // `theme` needs `bgColors` (3 CSS color strings) and `groundColor`; `key`
  // should be unique per distinct theme so repeated calls (e.g.
  // scene.restart()) reuse the cached texture instead of redrawing it.
  addSkyBackground(theme, key) {
    const { width, height } = this.scale;
    const bgKey = makeBackgroundTexture(this, width, height, theme, key);
    return this.add.image(width / 2, height / 2, bgKey);
  }

  // Adds one or more slow-drifting cloud puffs. Each entry accepts xr/yr
  // (position as a fraction of scene width/height), scale, alpha, how far
  // it drifts (driftX, defaults to alternating +22/-18px by index) and how
  // long one drift takes (duration, defaults to a gentle stagger by index).
  addDriftingClouds(configs) {
    const { width, height } = this.scale;
    const cloudKey = makeCloudTexture(this);
    return configs.map((cfg, i) => {
      const {
        xr, yr, scale = 1, alpha = 0.8,
        driftX = i % 2 === 0 ? 22 : -18,
        duration = 6500 + i * 1200,
      } = cfg;
      const cloud = this.add.image(width * xr, height * yr, cloudKey).setScale(scale).setAlpha(alpha);
      this.tweens.add({
        targets: cloud,
        x: cloud.x + driftX,
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      return cloud;
    });
  }

  // Stops any in-flight speechSynthesis utterance (e.g. "Good job!" still
  // talking) the moment this scene shuts down — the player backed out to
  // another scene or restarted mid-speech. Call once from create().
  stopSpeechOnShutdown() {
    this.events.once('shutdown', () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    });
  }
}
