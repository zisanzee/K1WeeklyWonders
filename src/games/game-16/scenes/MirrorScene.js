// scenes/MirrorScene.js
// Scene 2 of 5 — "Mirror". PLACEHOLDER.
//
// PLAN (reference sheet: the bird-and-reflection card): show a picture beside its
// reflection and have the child rebuild the mirrored half by dragging pieces
// into the matching spots.
//
// Scaffold only for now: dev frame, prompt, and a two-column placeholder that
// hints at the split (source | mirror) so the layout intent is visible.
//
// BUILDING THE REAL THING: this is the game-11 shape (drag to a mirrored
// position). Two columns of drop targets, mirrored coordinates for the right
// half, pieces reparented on drop. Put the pair/mirror maths in a pure module
// and unit test it — mirrored coordinate bugs are invisible until the picture is
// asymmetric.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';

const CONFIG = SCENES.find((s) => s.id === 'mirror');

const PROMPTS = [
  'Match the mirrored half.',
  'Drag each piece to its mirror spot.',
  'Build the other side.',
];

export default class MirrorScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });
  }

  createRound(ctx, round) {
    this.drawDevChrome(ctx);
    ctx.setPrompt(PROMPTS[round % PROMPTS.length]);

    // Placeholder for the split: two halves either side of centre, the right one
    // dimmer, which is the one the child will fill.
    const band = this.playBand();
    const { left, right } = this.playSpanX();
    const midX = (left + right) / 2;
    const h = this.objectHeight();
    const midY = (band.top + band.bottom) / 2;

    const source = ctx.scene.add
      .rectangle(midX - h * 0.6, midY, h, h, this.accent, 0.3)
      .setStrokeStyle(3, this.accent, 0.9);
    ctx.layer.add(source);

    const mirror = ctx.scene.add
      .rectangle(midX + h * 0.6, midY, h, h, this.accent, 0.12)
      .setStrokeStyle(3, this.accent, 0.5);
    ctx.layer.add(mirror);

    // The axis of symmetry, so the concept is unmistakable even as a placeholder.
    const axis = ctx.scene.add
      .line(0, 0, midX, band.top, midX, band.bottom, 0xffffff)
      .setLineWidth(2)
      .setAlpha(0.35);
    ctx.layer.add(axis);
  }

  applyTuning(ctx) {
    this.tuningSnapshot = ctx.sceneTuning;
  }
}
