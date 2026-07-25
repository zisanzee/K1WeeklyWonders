// Phaser/config.js
import * as Phaser from 'phaser';

// Single source of truth for the settings every bonus game's Phaser.Game
// instance shares (renderer type, scale mode, default physics). A game
// only needs to hand createGameConfig() its scenes and whatever it wants
// to override (base resolution, background color, physics) — see
// Phaser/BaseGame.jsx, which is the only caller of this in normal use.
export const DEFAULT_ASPECT = { width: 2, height: 3 };
export const DEFAULT_BASE_RESOLUTION = { width: 720, height: 1080 };
export const DEFAULT_PHYSICS = {
  default: 'arcade',
  arcade: { gravity: { y: 0 }, debug: false },
};

export function createGameConfig({
  parent,
  scenes,
  width = DEFAULT_BASE_RESOLUTION.width,
  height = DEFAULT_BASE_RESOLUTION.height,
  backgroundColor = '#8fe0fa',
  physics = DEFAULT_PHYSICS,
}) {
  return {
    type: Phaser.AUTO,
    parent,
    // Base internal resolution. Phaser.Scale.FIT scales this to whatever
    // size the CSS container around the canvas ends up at (see
    // BaseGame.jsx), so the actual on-screen size is driven by that
    // container, not this number — but a bigger base resolution means
    // Phaser is scaling *down* into most containers instead of stretching
    // a small canvas up, which is why things look noticeably crisper.
    width,
    height,
    backgroundColor,
    physics,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: scenes,
  };
}
