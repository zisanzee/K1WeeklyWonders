// BubbleShooterScene.js — TODO: implement Bubble Shooter's gameplay here,
// the same way BonusGame1/NumberOrderScene.js builds Number Pop's gameplay
// on top of the shared Phaser/BaseScene helpers (addSkyBackground,
// addDriftingClouds, createPillButton, stopSpeechOnShutdown).
import BaseScene from '../../Phaser/BaseScene';
import { LEVELS, progress } from './levels';

export default class BubbleShooterScene extends BaseScene {
  constructor() {
    super('BubbleShooterScene');
  }

  init(data) {
    this.levelIndex = data?.levelIndex ?? 0;
    this.level = LEVELS[this.levelIndex];
  }

  create() {
    // TODO: gameplay goes here. When a round finishes, emit an event on
    // this.game.events (e.g. 'bubbleshooter-complete') the same way
    // NumberOrderScene emits 'numberpop-complete' — Game.jsx already
    // listens for it and logs the session.
  }
}
