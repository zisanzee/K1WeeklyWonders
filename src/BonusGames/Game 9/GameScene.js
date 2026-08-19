// GameScene.js
// Placeholder scene for Game 9. Replace this body with the real game logic
// once the design is decided (see Game 7's / Game 8's GameScene.js for the
// established scene structure). It renders so the PreloadScene → GameScene
// handoff and the NameGate/GameAccessGate shell can be verified end to end.

import BaseScene from '../../Phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from './audioState';

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0x3fb6ea);

    this.add.text(width / 2, height / 2 - 40, 'Game 9', {
      fontSize: '72px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 9,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 40, 'Coming soon!', {
      fontSize: '28px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);

    addMuteButton(this, 16, 16, { anchor: 'topLeft' });
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
  }
}
