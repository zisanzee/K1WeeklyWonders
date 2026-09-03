// StartScene.js
// Game 7 title screen. Shows the full-bleed 'gameStart' artwork with a
// big Play button pinned to the bottom. Tapping Play runs a quick
// "zoom into the nest" camera transition before handing off to GameScene
// — a gentle cue that the game is starting, rather than a hard cut.

import BaseScene from '../../Phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from './audioState';

export default class StartScene extends BaseScene {
  constructor() {
    super('StartScene');
  }

  create() {
    const { width, height } = this.scale;

    // 1. Full-bleed title art — cover-fit the artwork to the 720x1080 base
    // resolution the same way GameScene cover-fits its background.
    const art = this.add.image(width / 2, height / 2, 'gameStart');
    const cover = Math.max(width / art.width, height / art.height);
    art.setScale(cover).setDepth(0);

    // Gentle entrance: the art fades in as the camera clears the navy that
    // BasePreloadScene's create() leaves behind.
    // Aurora night indigo (was navy) — backdrop revealed during transitions.
    this.cameras.main.fadeIn(400, 30, 27, 90);
    art.setAlpha(0);
    this.tweens.add({
      targets: art,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeOut',
    });

    // 2. Play button — big, sunny, pinned near the bottom center. Uses the
    // same rounded pill button as the rest of the game so it inherits the
    // press-bounce + drop-shadow feedback kids already know.
    const playBtn = this.createPillButton(width / 2, height - 76, '▶  Play', {
      fontSize: '32px',
      bgColor: 0x9333ea,
      textColor: '#ffffff',
      paddingX: 44,
      paddingY: 16,
      depth: 20,
      borderColor: 0x5b21b6,
    });

    // A soft "come play" bob on the button so it reads as the interactive
    // element even before the child has touched the screen.
    this.tweens.add({
      targets: playBtn.container,
      y: playBtn.container.y - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 3. Start music + mute toggle on the title screen too, so there's no
    // dead-air while the child reads the art before tapping Play.
    ensureBgMusic(this);
    addMuteButton(this, 16, 16, { anchor: 'topLeft' });
    this.input.once('pointerdown', () => ensureBgMusic(this));

    // 4. Tap Play -> animate into the game. A quick zoom-in on the artwork
    // plus a camera fade sells "we're going somewhere", then GameScene takes
    // over with its own fadeIn — the two fades chain smoothly since both use
    // the same navy.
    playBtn.on('pointerup', () => {
      this.input.enabled = false; // ignore further taps mid-transition
      this.cameras.main.fadeOut(400, 30, 27, 90);
      this.tweens.add({
        targets: art,
        scale: cover * 1.12,
        alpha: 0.9,
        duration: 400,
        ease: 'Sine.easeIn',
      });
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }
}
