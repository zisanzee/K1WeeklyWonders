// scenes/PositionsScene.js
// Scene 3 of 5 — "Positions". PLACEHOLDER.
//
// PLAN (reference sheet: the bird in the palm tree, answer "Top"): one character
// sits at a named position in a scene — top / middle / bottom, or on / under —
// and the child answers with the position word.
//
// Scaffold only: dev frame, prompt, and three stacked placeholder bands so the
// vertical layout intent is visible.
//
// BUILDING THE REAL THING: this is positional language, so the answer set is a
// small fixed vocabulary and belongs in levels.js with a pure generator. The
// character's y position must be DERIVED from the chosen position word, never
// hand-placed, or the picture and the correct answer can disagree.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';

const CONFIG = SCENES.find((s) => s.id === 'positions');

const POSITIONS = ['Top', 'Middle', 'Bottom'];
const PROMPTS = [
  'Where is the bird?',
  'Is the bird at the top or the bottom?',
  'Which word says where it is?',
];

export default class PositionsScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });
  }

  createRound(ctx, round) {
    this.drawDevChrome(ctx);
    ctx.setPrompt(PROMPTS[round % PROMPTS.length]);

    // Three horizontal bands, labelled with the answer vocabulary. A real build
    // replaces these with one character plus three answer buttons.
    const band = this.playBand();
    const { left, right } = this.playSpanX();
    const slotH = (band.bottom - band.top) / POSITIONS.length;

    POSITIONS.forEach((word, i) => {
      const y = band.top + slotH * (i + 0.5);
      const box = ctx.scene.add
        .rectangle((left + right) / 2, y, right - left, slotH - 12, this.accent, 0.18)
        .setStrokeStyle(2, this.accent, 0.55);
      ctx.layer.add(box);

      const label = ctx.scene.add
        .text(left + 12, y, word, {
          fontSize: '20px',
          fontFamily: 'Fredoka, sans-serif',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5);
      ctx.layer.add(label);
    });
  }

  applyTuning(ctx) {
    this.tuningSnapshot = ctx.sceneTuning;
  }
}
