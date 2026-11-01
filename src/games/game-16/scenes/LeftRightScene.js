// scenes/LeftRightScene.js
// Scene 4 of 5 — "Left - Right". PLACEHOLDER.
//
// PLAN (reference sheet: two birds flanking a palm tree): characters sit either
// side of a landmark and the child picks the one on the left or the right.
//
// Scaffold only: dev frame, prompt, a centre landmark and one placeholder slot
// on each side, so the left/right layout is visible.
//
// BUILDING THE REAL THING: the only correctness trap here is that "left" and
// "right" must be the CHILD's left and right, not the art's. Once characters can
// face either way, deriving the answer from the sprite's facing is the bug. Keep
// the side-to-slot mapping in a pure function and test it.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';

const CONFIG = SCENES.find((s) => s.id === 'left-right');

const PROMPTS = [
  'Which one is on the left?',
  'Which one is on the right?',
  'Who is beside the tree on the left?',
];

export default class LeftRightScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });
  }

  createRound(ctx, round) {
    this.drawDevChrome(ctx);
    ctx.setPrompt(PROMPTS[round % PROMPTS.length]);

    const band = this.playBand();
    const { left, right } = this.playSpanX();
    const midY = (band.top + band.bottom) / 2;
    const midX = (left + right) / 2;
    const size = this.objectHeight();

    // The landmark the two answers flank.
    const tree = ctx.scene.add
      .rectangle(midX, midY, size * 0.5, size * 1.2, this.accent, 0.45)
      .setStrokeStyle(3, this.accent, 0.9);
    ctx.layer.add(tree);

    // One answer on each side. Explicit left/right rather than slotPositions(),
    // because the whole point of the scene is that the sides are the answers.
    [
      { x: midX - size * 1.4, word: 'left' },
      { x: midX + size * 1.4, word: 'right' },
    ].forEach(({ x, word }) => {
      const box = ctx.scene.add
        .rectangle(x, midY, size, size, this.accent, 0.25)
        .setStrokeStyle(3, this.accent, 0.8);
      ctx.layer.add(box);

      const label = ctx.scene.add
        .text(x, midY - size * 0.75, word, {
          fontSize: '16px',
          fontFamily: 'Fredoka, sans-serif',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      ctx.layer.add(label);
    });
  }

  applyTuning(ctx) {
    this.tuningSnapshot = ctx.sceneTuning;
  }
}
