// scenes/OrdinalScene.js
// Scene 5 of 5 — "Ordinal (first - tenth)". PLACEHOLDER.
//
// PLAN (reference sheet: a building with numbered floors and animals in them,
// "which animal is on the third floor?"): the child finds the character at a
// given ordinal position.
//
// Scaffold only: dev frame, prompt, and a column of numbered floors with a
// placeholder animal per floor, which is the layout the real scene needs.
//
// BUILDING THE REAL THING: ordinals have their own vocabulary (first…tenth) and
// their own spoken clips, and both must agree with the floor numbering — the
// jump-the-gap risk here is floor labels being 1-based while the array is
// 0-based. Derive the label from the index in one function and test it.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';

const CONFIG = SCENES.find((s) => s.id === 'ordinal');

const PROMPTS = [
  'Which animal is on the third floor?',
  'Who is on the first floor?',
  'Find the animal on the fifth floor.',
];

// 1 → "1st" … 11..13 → "th", otherwise the last digit (the classic exceptions).
function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export default class OrdinalScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });
  }

  createRound(ctx, round) {
    this.drawDevChrome(ctx);
    ctx.setPrompt(PROMPTS[round % PROMPTS.length]);

    // Floors stacked bottom-up, the way the reference art reads. Numbered from 1
    // at the bottom, which is how a child counts floors.
    const band = this.playBand();
    const { left, right } = this.playSpanX();
    const floors = Math.max(3, ctx.tuning?.slots ?? 4);
    const floorH = (band.bottom - band.top) / floors;

    for (let i = 0; i < floors; i += 1) {
      const y = band.bottom - floorH * (i + 0.5);
      const box = ctx.scene.add
        .rectangle((left + right) / 2, y, right - left, floorH - 10, this.accent, 0.16)
        .setStrokeStyle(2, this.accent, 0.5);
      ctx.layer.add(box);

      const label = ctx.scene.add
        .text(left + 14, y, ordinal(i + 1), {
          fontSize: '18px',
          fontFamily: 'Fredoka, sans-serif',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5);
      ctx.layer.add(label);

      // Placeholder for the animal that will live on this floor.
      const occupant = ctx.scene.add
        .circle((left + right) / 2 + 60, y, floorH * 0.24, this.accent, 0.35)
        .setStrokeStyle(2, this.accent, 0.8);
      ctx.layer.add(occupant);
    }
  }

  applyTuning(ctx) {
    this.tuningSnapshot = ctx.sceneTuning;
  }
}
