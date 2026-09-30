// GameScene.js
// Position Mission! — positional language ("Put it in the right place").
//
// Each scene is a full-bleed background with a few character cut-outs. Some
// characters are PERMANENT (always drawn — the person a round is "in front of /
// behind" relative to); the rest start OFF-scene and are placed by the player.
//
// Two rounds per scene (see levels.js). Each round:
//   1. The prompt names ONE character to place (e.g. "Put the dog in *front* of
//      the man."). The relation word is emphasised.
//   2. That character appears as a single draggable option in the tray along the
//      bottom, shown at its real rotation/flip and scaled to fit its box.
//   3. Dragging it grows it to its true placed size. Let go inside ITS OWN tuned
//      drop box (sceneTuning.js) and it snaps in and stays; let go inside ANY
//      OTHER character's box and that counts as a wrong area (red flash,
//      mistake); anywhere else it simply rests — no penalty, still grabbable.
//   4. On a correct placement the character is revealed in the scene and the
//      round advances; the placed character stays for later rounds.
//
// Boxes and positions are never read from image pixels: they come straight from
// sceneTuning.js, so what the tuning pass placed is exactly what the game checks.
//
//   assets.js        what to load (URLs) + the flat key grammar
//   scenes.js        scene order, permanent vs movable characters
//   sceneTuning.js   where each character sits (the file you tune)
//   levels.js        the round script (prompt + which character)
import * as Phaser from 'phaser';
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import {
  makeConfettiTexture,
  makeConfettiSquareTexture,
} from '@/phaser/common/sceneAssets';
import { sceneBackgroundKey } from '@/games/game-12/assets';
import {
  charactersForScene,
  permanentCharactersForScene,
  movableCharactersForScene,
  isPromptAtBottom,
} from '@/games/game-12/scenes';
import { partTransform, backgroundFit, boxOverride, boxPadding } from '@/games/game-12/sceneTuning';
import { ROUNDS, TOTAL_ROUNDS, splitPrompt } from '@/games/game-12/levels';

// The clear colour behind everything, and the Phaser canvas clear colour (see
// Game.jsx) so the single frame before a backdrop draws is not a bare canvas.
export const BACKGROUND_COLOR = '#eef2ff';

// Layout (720x1080 base resolution — see Phaser/config.js). The prompt is the
// only HUD text — no scene title, no header card — so it sits high and large.
// A scene may opt to put it at the BOTTOM instead (see isPromptAtBottom).
const PROMPT_Y = 96;
// A bottom-flagged scene (scene 6) puts the prompt BESIDE the option instead of
// above it: the circle sits bottom-left, the card to its right, wrapping onto a
// couple of lines so it stays narrow enough to fit the space.
const PROMPT_SIDE_Y = 946; // vertical centre shared by the side prompt + circle
const PROMPT_SIDE_LEFT = 330; // left edge of the prompt CONTENT in side mode
const PROMPT_SIDE_MAXW = 340; // widest a wrapped prompt line may be
const PROMPT_LINE_GAP = 14; // vertical gap between wrapped lines
// Inline prompt pictures are given a COMMON WIDTH (so a skinny cut-out is not
// left looking small next to a chunky one), then their height is clamped into a
// band: a very wide picture (the slide) is not left flat, and a very tall one
// (the tree) is not left towering. That keeps every picture at a similar visual
// scale — a touch bigger than an emphasis word (32px at 1.5× ≈ 60px tall).
const PROMPT_IMG_W = 124;
const PROMPT_IMG_MIN_H = 60;
const PROMPT_IMG_MAX_H = 104;

// Prompt text styling. The relation word ("front"/"behind"/"top"/"bottom") is
// drawn BIGGER and in a warm accent, as the key word of the instruction.
const PROMPT_FONT = 'Fredoka, sans-serif';
const PROMPT_SIZE = 32;
const PROMPT_EMPHASIS_SCALE = 1.5; // extra size on the relation word
const PROMPT_COLOR = '#3b2f1e';
const PROMPT_EMPHASIS_COLOR = '#c2410c';
const PROMPT_STROKE = '#fffdf5'; // light outline keeps text legible on any art
const PROMPT_GAP = 12;

// Prompt card — a soft rounded panel the whole line sits on, so the instruction
// reads as a deliberate element over any background.
const CARD_FILL = 0xfff7e6;
const CARD_FILL_ALPHA = 0.94;
const CARD_STROKE = 0x5b4a2f;
const CARD_STROKE_ALPHA = 0.28;
const CARD_STROKE_WIDTH = 4;
const CARD_RADIUS = 26;
const CARD_PAD_X = 30;
const CARD_PAD_Y = 20;
const CARD_SHADOW_ALPHA = 0.16;
const CARD_SHADOW_DY = 7;

// Option tray, along the bottom. The option floats on a soft translucent disc
// — no opaque card.
// Start screen — where the button image sits (as a fraction of canvas height)
// and how wide it should read on the 720px canvas.
const START_BTN_Y_RATIO = 0.83;
const START_BTN_W = 320;

// A mid-scene round change just needs a short beat for the snap to read.
const ROUND_ADVANCE_MS = 520;
// Finishing a scene holds longer: the success jingle is ~1.69s, so this lets it
// finish and the confetti play out before the scene transition.
const SUCCESS_HOLD_MS = 1690;

const TRAY_TOP = 856;
const TRAY_TOP_RAISED = 812; // side-by-side scene: circle centred on PROMPT_SIDE_Y
const TRAY_SIDE_X = 168; // circle centre x in the side-by-side layout
const TRAY_BOX = 196;
const TRAY_BOX_INSET = 8; // gap between a piece and its disc's inner edge
const TRAY_BOB = 6; // px the idle bob lifts a piece; reserved so it cannot clip
const HIT_PAD = 10; // slack around the art when grabbing a piece

// Drop boxes decide accept/reject but are NEVER drawn — they are a design aid,
// not something a player sees. A character is accepted only when dropped inside
// its OWN box; inside any other box is wrong.
// How many px outside a box a piece still counts as "inside" it, so a child
// does not have to drop dead-centre.
const BOX_DROP_PAD = 24;
const BOX_MIN_SIZE = 40; // a box can never collapse to nothing

// Draw order bands.
const DEPTH_BACKDROP = 0;
const DEPTH_CHARS = 5;
// The prompt sits ABOVE the tray band (33 > 30) so a bottom-prompt scene's band
// gradient cannot paint over it; the round pill (25) stays under the tray.
const DEPTH_HUD = 33;
const DEPTH_TRAY = 30;
const DEPTH_DRAG = 60;
const DEPTH_START = 400; // the start screen covers everything

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.resetRun();
  }

  // All the per-RUN state. Called from the constructor AND at the top of
  // create(): `scene.restart()` re-runs create() on the SAME instance (the
  // constructor does not run again), so anything initialised only there would
  // carry over — which is why a replay showed the second character already
  // placed on the first prompt (its key was still in placedKeys).
  resetRun() {
    this.roundIndex = 0;
    this.phase = 'playing';
    this.stars = 0;
    this.mistakes = 0;
    this.roundMistakes = 0;
    this.streak = 0;
    this.peakStreak = 0;
    this.charObjects = new Map(); // texture key -> { image, z }
    this.placedKeys = new Set();
    this.trayItem = null;
    this.drag = null;
    this.promptParts = [];
    this.voice = null; // the currently-playing voice line (start / round prompt)
  }

  create() {
    const { width, height } = this.scale;

    // Fresh run state — see resetRun() for why this is not constructor-only.
    this.resetRun();

    // Stop any voice still playing from a previous run (e.g. Play Again pressed
    // mid-line) and again whenever this scene shuts down.
    this.stopVoice();
    this.events.once('shutdown', () => this.stopVoice());

    this.startTime = this.time.now;

    // Background music + first-tap unlock, plus the shared mute button.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Round counter pill (top-right), matching the other bonus games.
    this.roundPill = this.createPillButton(width - 14, 14, '', {
      fontSize: '20px',
      paddingX: 16,
      paddingY: 9,
      anchor: 'topRight',
      interactive: false,
      depth: 25,
    });

    // Scene layers (rebuilt per round).
    this.bgLayer = this.add.container(0, 0).setDepth(DEPTH_BACKDROP);
    this.charLayer = this.add.container(0, 0).setDepth(DEPTH_CHARS);
    this.trayLayer = this.add.container(0, 0).setDepth(DEPTH_TRAY);
    this.dragLayer = this.add.container(0, 0).setDepth(DEPTH_DRAG);
    this.boxes = new Map(); // texture key -> { x, y, w, h }
    this.trayTop = TRAY_TOP; // per-scene; raised for a bottom-prompt scene

    // Transparent tray band: a soft white gradient (fully clear at its top edge,
    // faint at the bottom) so the option reads as floating on the scene rather
    // than sitting on an opaque shelf. Redrawn per round (the top can move).
    this.trayBand = this.add.graphics().setDepth(DEPTH_TRAY - 1);
    this.drawTrayBand();

    this.redFlash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff2b2b, 1)
      .setDepth(95)
      .setAlpha(0);

    // Pointer input is resolved on the scene so a piece can be dragged past the
    // tray edge without its hit area cutting the gesture off.
    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', () => this.onPointerUp());

    this.setupRound(0);
    // The tray is built with the round but must stay hidden until Start.
    this.trayLayer.setVisible(false);
    this.buildStartOverlay();
  }

  // ---------------------------------------------------------------------------
  // Shared builders
  // ---------------------------------------------------------------------------

  clearLayers() {
    if (this.bgLayer) this.bgLayer.destroy(true);
    if (this.charLayer) this.charLayer.destroy(true);
    if (this.trayLayer) this.trayLayer.destroy(true);
    this.bgLayer = this.add.container(0, 0).setDepth(DEPTH_BACKDROP);
    this.charLayer = this.add.container(0, 0).setDepth(DEPTH_CHARS);
    this.trayLayer = this.add.container(0, 0).setDepth(DEPTH_TRAY);
    this.charObjects = new Map();
    this.boxes = new Map();
  }

  // A character's drop box: an explicit CHARACTER_BOXES entry (its x/y define the
  // centre; w/h the size) if present, else one auto-sized to the character's
  // in-scene bounds plus padding, centred on it. Computed at build time from the
  // live image, so it always tracks the tuned transform.
  computeBox(key) {
    const explicit = boxOverride(key);
    if (explicit && explicit.x != null && explicit.y != null && explicit.w != null && explicit.h != null) {
      return { x: explicit.x, y: explicit.y, w: explicit.w, h: explicit.h };
    }
    const obj = this.charObjects.get(key);
    const pad = boxPadding();
    if (obj) {
      const b = obj.image.getBounds();
      return {
        x: b.centerX,
        y: b.centerY,
        w: explicit?.w ?? Math.max(BOX_MIN_SIZE, b.width + pad * 2),
        h: explicit?.h ?? Math.max(BOX_MIN_SIZE, b.height + pad * 2),
      };
    }
    // Not on the scene (e.g. the round's target still in the tray): size the box
    // from the texture and the tuned scale so it matches what the art will be.
    const t = partTransform(key);
    const src = this.textures.get(key)?.getSourceImage?.();
    return {
      x: t.x,
      y: t.y,
      w: explicit?.w ?? Math.max(BOX_MIN_SIZE, (src?.width || 100) * t.scale + pad * 2),
      h: explicit?.h ?? Math.max(BOX_MIN_SIZE, (src?.height || 100) * t.scale + pad * 2),
    };
  }

  // Recompute a box from the live character.
  refreshBox(key) {
    this.boxes.set(key, this.computeBox(key));
  }

  // The box a point falls inside, or null. `pad` inflates every box so a near
  // miss still counts.
  boxAt(x, y, pad = 0) {
    for (const [key, box] of this.boxes.entries()) {
      if (
        x >= box.x - box.w / 2 - pad &&
        x <= box.x + box.w / 2 + pad &&
        y >= box.y - box.h / 2 - pad &&
        y <= box.y + box.h / 2 + pad
      ) {
        return key;
      }
    }
    return null;
  }

  // The scene's full-screen background, COVER-fit: scaled to fill the whole
  // canvas with no letterboxing, centred, then nudged/zoomed/flipped by the
  // per-scene tuning values.
  buildBackground(scene) {
    const { width, height } = this.scale;
    const key = sceneBackgroundKey(scene);

    if (this.textures.exists(key)) {
      const fit = backgroundFit(scene);
      const img = this.add.image(width / 2 + fit.offsetX, height / 2 + fit.offsetY, key);
      const cover = Math.max(width / img.width, height / img.height) * fit.zoom;
      img.setScale(cover);
      if (fit.flipX) img.setFlipX(true);
      this.bgLayer.add(img);
      return;
    }

    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0xffffff, 0xffffff, 0xeef2ff, 0xeef2ff, 1);
    backdrop.fillRect(0, 0, width, height);
    this.bgLayer.add(backdrop);
  }

  // Adds one character image at its tuned transform, into the scene layer.
  addSceneCharacter(key) {
    const t = partTransform(key);
    const image = this.add.image(t.x, t.y, key);
    image.setScale(t.scale);
    image.setAngle(t.rotation);
    if (t.flipX) image.setFlipX(true);
    image.setDepth(t.z);
    this.charLayer.add(image);
    this.charObjects.set(key, { image, z: t.z });
    return image;
  }

  // ---------------------------------------------------------------------------
  // Round setup
  // ---------------------------------------------------------------------------

  setupRound(index) {
    this.roundIndex = index;
    this.round = ROUNDS[index];
    this.phase = 'playing';
    this.roundMistakes = 0;
    this.drag = null;

    // Stop the previous piece's idle bob; the piece image itself is torn down
    // with its layer in clearLayers() (it may have been folded into the scene
    // layer already if it was placed).
    if (this.trayItem) {
      this.trayItem.bobTween?.remove();
      this.trayItem = null;
    }
    this.clearLayers();

    const scene = this.round.scene;
    // The option tray floats where the prompt is not: a bottom-prompt scene
    // (scene 6) lifts the tray so the line has clear room beneath it.
    this.trayTop = isPromptAtBottom(scene) ? TRAY_TOP_RAISED : TRAY_TOP;
    this.drawTrayBand();
    this.buildBackground(scene);

    // Permanent cast + anything already placed this scene.
    const permanent = permanentCharactersForScene(scene);
    const placed = movableCharactersForScene(scene).filter((k) => this.placedKeys.has(k));
    [...permanent, ...placed]
      .filter((k) => k !== this.round.key && this.textures.exists(k))
      .forEach((k) => this.addSceneCharacter(k));
    this.charLayer.sort('depth');

    // Every character in the scene gets a box (even the one still in the tray,
    // and the ones not placed yet) — these are the ONLY accept zones, and the
    // target for this round is its own box.
    charactersForScene(scene)
      .filter((k) => this.textures.exists(k))
      .forEach((k) => this.refreshBox(k));

    // Prompt first so it paints above the tray band when it sits at the bottom.
    this.renderPrompt(this.round.prompt);
    this.buildTray();

    this.roundPill?.setText(`Round\n${index + 1}/${TOTAL_ROUNDS}`);
  }

  // Redraws the transl/white tray band at the current tray top.
  drawTrayBand() {
    if (!this.trayBand) return;
    const { width, height } = this.scale;
    this.trayBand.clear();
    this.trayBand.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0, 0.4, 0.4);
    this.trayBand.fillRect(0, this.trayTop, width, height - this.trayTop);
  }

  // Where the prompt sits on the canvas: high at the top by default, or (for a
  // scene that opts in, e.g. scene 6) beside the option near the bottom.
  promptY(scene) {
    return isPromptAtBottom(scene) ? PROMPT_SIDE_Y : PROMPT_Y;
  }

  // One prompt piece (a word or an inline image), built at its BASE size and
  // measured. The final scale is applied by the layout, never here. A picture's
  // base scale is chosen so it reads at a similar size to the words; a word's is
  // the emphasis factor.
  makePromptPiece(tok, y) {
    if (tok.kind === 'image') {
      // Origin (0, 0.5) anchors the LEFT edge at x — the same anchor words use,
      // so every piece advances by its full width with one consistent gap.
      const img = this.add.image(0, y, tok.key).setOrigin(0, 0.5).setDepth(DEPTH_HUD);
      if (tok.flip) img.setFlipX(true); // flip the IMAGE, never the text
      const natH = Math.max(img.height, 1);
      let scale = PROMPT_IMG_W / Math.max(img.width, 1);
      const hAtWidth = natH * scale;
      if (hAtWidth > PROMPT_IMG_MAX_H) scale = PROMPT_IMG_MAX_H / natH;
      else if (hAtWidth < PROMPT_IMG_MIN_H) scale = PROMPT_IMG_MIN_H / natH;
      return { kind: 'image', obj: img, baseW: img.width, baseH: natH, targetH: natH * scale };
    }
    const obj = this.add
      .text(0, y, tok.text, {
        fontSize: `${PROMPT_SIZE}px`,
        fontFamily: PROMPT_FONT,
        fontStyle: 'bold',
        color: tok.emphasis ? PROMPT_EMPHASIS_COLOR : PROMPT_COLOR,
      })
      .setStroke(PROMPT_STROKE, tok.emphasis ? 8 : 6)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_HUD);
    return {
      kind: 'text',
      obj,
      baseW: obj.width,
      targetH: obj.height * (tok.emphasis ? PROMPT_EMPHASIS_SCALE : 1),
    };
  }

  // The prompt, laid out piece by piece, on one or more lines (`|` breaks a
  // line, and a side-by-side scene wraps to fit the space beside the option).
  // Replaces any previous prompt.
  renderPrompt(prompt) {
    // Tear down the previous prompt's pieces (and their entrance tweens).
    this.promptParts.forEach((t) => {
      this.tweens.killTweensOf(t);
      t.destroy();
    });
    this.promptParts = [];
    if (!prompt) return;

    const { width } = this.scale;
    const scene = this.round?.scene;
    const side = isPromptAtBottom(scene);
    const y = this.promptY(scene);

    // Split the tokens into lines on `|`, drop empty lines, build every piece.
    const lines = [[]];
    for (const tok of splitPrompt(prompt)) {
      if (tok.kind === 'break') lines.push([]);
      else lines[lines.length - 1].push(tok);
    }
    const builtLines = lines.filter((l) => l.length > 0).map((toks) => toks.map((t) => this.makePromptPiece(t, y)));
    if (builtLines.length === 0) return;

    const heightScale = (p) =>
      p.kind === 'image' ? p.targetH / Math.max(p.baseH, 1) : p.targetH / Math.max(p.obj.height, 1);
    const lineW = (pieces) =>
      pieces.reduce((s, p) => s + p.baseW * heightScale(p), 0) + PROMPT_GAP * (pieces.length - 1);
    const lineH = (pieces) =>
      Math.max(...pieces.map((p) => (p.kind === 'image' ? p.baseH : p.obj.height) * heightScale(p)));

    const widest = Math.max(...builtLines.map(lineW));
    // A side-by-side prompt is fitted to its narrow column; a top/bottom one to
    // the full canvas. Either way, one shared `fit` scales every line together.
    const maxW = side ? PROMPT_SIDE_MAXW : width - 2 * (CARD_PAD_X + 16);
    const fit = Math.min(1, maxW / Math.max(widest, 1));

    const lineHeights = builtLines.map((p) => lineH(p) * fit);
    const totalH = lineHeights.reduce((a, b) => a + b, 0) + PROMPT_LINE_GAP * (builtLines.length - 1);

    // Stack the lines around the centre y.
    const lineYs = [];
    let cursor = y - totalH / 2;
    for (const h of lineHeights) {
      lineYs.push(cursor + h / 2);
      cursor += h + PROMPT_LINE_GAP;
    }

    builtLines.forEach((pieces, li) => {
      const ly = lineYs[li];
      const w = lineW(pieces) * fit;
      // Every line is centred: on the canvas for a top/bottom prompt, or within
      // the card's (widest-line) content column for a side-by-side prompt.
      let x = side ? PROMPT_SIDE_LEFT + (widest * fit - w) / 2 : width / 2 - w / 2;
      for (const p of pieces) {
        const scale = fit * heightScale(p);
        p.obj.x = x;
        p.obj.y = ly;
        x += p.baseW * scale + PROMPT_GAP * fit;
        // Stylised entrance so a new prompt reads clearly.
        p.obj.setScale(0.8 * scale).setAlpha(0);
        this.tweens.add({ targets: p.obj, scale, alpha: 1, duration: 260, ease: 'Back.easeOut' });
        this.promptParts.push(p.obj);
      }
    });

    // A soft rounded card behind the whole block, sized to the content.
    const cardW = widest * fit + CARD_PAD_X * 2;
    const cardH = totalH + CARD_PAD_Y * 2;
    const cardX = (side ? PROMPT_SIDE_LEFT : width / 2 - (widest * fit) / 2) - CARD_PAD_X;
    const cardY = y - cardH / 2;
    const card = this.add.graphics().setDepth(DEPTH_HUD - 2);
    card.fillStyle(0x000000, CARD_SHADOW_ALPHA);
    card.fillRoundedRect(cardX, cardY + CARD_SHADOW_DY, cardW, cardH, CARD_RADIUS);
    card.fillStyle(CARD_FILL, CARD_FILL_ALPHA);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, CARD_RADIUS);
    card.lineStyle(CARD_STROKE_WIDTH, CARD_STROKE, CARD_STROKE_ALPHA);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, CARD_RADIUS);
    this.promptParts.push(card);
  }

  // The single draggable option in the tray, shown at its real rotation/flip and
  // scaled to fit the box.
  buildTray() {
    const { width } = this.scale;
    const key = this.round.key;
    if (!this.textures.exists(key)) return;

    const t = partTransform(key);
    // Side-by-side scene: the circle sits bottom-left and shares a centre line
    // with the prompt card beside it. Otherwise it is centred in the tray band.
    const side = isPromptAtBottom(this.round?.scene);
    const boxCentreX = side ? TRAY_SIDE_X : width / 2;
    const boxCentreY = side ? PROMPT_SIDE_Y : this.trayTop + (this.scale.height - this.trayTop) / 2;

    const box = {
      left: boxCentreX - TRAY_BOX / 2,
      right: boxCentreX + TRAY_BOX / 2,
      top: boxCentreY - TRAY_BOX / 2,
      bottom: boxCentreY + TRAY_BOX / 2,
    };
    // A soft translucent disc (not an opaque card) so the option reads as
    // floating on the scene. A soft shadow lifts it off the backdrop.
    const shadow = this.add.circle(boxCentreX, boxCentreY + 6, TRAY_BOX / 2, 0x000000, 0.12);
    this.trayLayer.add(shadow);
    const disc = this.add.circle(boxCentreX, boxCentreY, TRAY_BOX / 2, 0xffffff, 0.22);
    disc.setStrokeStyle(4, 0xffffff, 0.6);
    this.trayLayer.add(disc);

    // Build the piece at its TRUE transform, measure it, then derive the preview
    // factor that fits it inside the box (rotation/flip are baked into bounds).
    const image = this.add.image(boxCentreX, boxCentreY, key);
    image.setScale(t.scale);
    image.setAngle(t.rotation);
    if (t.flipX) image.setFlipX(true);
    this.trayLayer.add(image);

    const b = image.getBounds();
    const inner = TRAY_BOX - 2 * TRAY_BOX_INSET - TRAY_BOB;
    const previewFactor = Math.min(inner / Math.max(b.width, 1), inner / Math.max(b.height, 1));
    const previewScale = t.scale * previewFactor;

    const item = {
      key,
      image,
      target: t,
      fullScale: t.scale,
      previewScale,
      baseX: boxCentreX,
      baseY: boxCentreY,
      box,
      placed: false,
    };
    this.trayItem = item;
    this.applyPreview(item);

    item.bobTween = this.tweens.add({
      targets: image,
      y: boxCentreY - TRAY_BOB,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Shrinks the piece back to its tray preview size/position.
  applyPreview(item) {
    item.image.setScale(item.previewScale);
    item.image.setPosition(item.baseX, item.baseY);
    item.image.setAngle(item.target.rotation);
    item.image.setFlipX(!!item.target.flipX);
  }

  // Grows the piece to its true placed size.
  applyFull(item) {
    item.image.setScale(item.fullScale);
    item.image.setAngle(item.target.rotation);
    item.image.setFlipX(!!item.target.flipX);
  }

  // ---------------------------------------------------------------------------
  // Start screen (production only)
  // ---------------------------------------------------------------------------

  buildStartOverlay() {
    const { width, height } = this.scale;
    this.phase = 'start';

    this.startOverlay = this.add.container(0, 0).setDepth(DEPTH_START);

    // Full-bleed title art, cover-fit so it fills the canvas on any aspect.
    const bg = this.add.image(width / 2, height / 2, 'startScreen');
    bg.setScale(Math.max(width / bg.width, height / bg.height));
    this.startOverlay.add(bg);

    // The "play" button image, fit to a comfortable width (whatever its native
    // size), centred low on the art, gently pulsing.
    const btn = this.add.image(width / 2, height * START_BTN_Y_RATIO, 'startButton');
    const bScale = START_BTN_W / Math.max(btn.width, 1);
    this.startOverlay.add(btn);
    btn.setScale(bScale);
    this.startBtn = btn;

    this.tweens.add({
      targets: btn,
      scale: bScale * 1.05,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerup', () => this.beginPlay());

    // Start-screen voice-over. Cut the instant the player presses Start (see
    // beginPlay) so it never talks over the first round.
    this.playVoice('instructions');
  }

  // Animated hand-off from the start screen into round 1: the title zooms in and
  // fades while the first round settles, then the option drops into the tray.
  beginPlay() {
    if (this.phase !== 'start') return;
    this.phase = 'playing';
    this.startBtn?.disableInteractive();

    // Stop the start-screen instructions immediately, then hand over to the
    // first round's voice line as the round settles in.
    this.stopVoice();

    const overlay = this.startOverlay;
    this.startOverlay = null;

    // The round is already built underneath; ease it up into place as the title
    // pulls away, so the reveal reads as one motion.
    this.charLayer.setScale(1.06);
    this.tweens.add({ targets: this.charLayer, scale: 1, duration: 620, ease: 'Sine.easeOut' });
    this.bgLayer.setScale(1.06);
    this.tweens.add({ targets: this.bgLayer, scale: 1, duration: 620, ease: 'Sine.easeOut' });

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      scale: 1.08,
      duration: 520,
      ease: 'Sine.easeIn',
      onComplete: () => overlay.destroy(true),
    });

    this.trayLayer.setVisible(true);
    if (this.trayItem) this.dropInTray(this.trayItem);

    // Speak round 1's prompt once the title has mostly faded away.
    this.time.delayedCall(280, () => {
      if (this.phase === 'playing') this.playRoundVoice();
    });
  }

  // ---------------------------------------------------------------------------
  // Dragging + drop
  // ---------------------------------------------------------------------------

  onPointerDown(pointer) {
    if (this.phase !== 'playing' || this.drag) return;
    const item = this.trayItem;
    if (!item || item.placed) return;

    const box = item.box;
    const inBox =
      pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
    let onArt = false;
    if (!inBox) {
      const b = item.image.getBounds();
      onArt =
        pointer.x >= b.left - HIT_PAD &&
        pointer.x <= b.right + HIT_PAD &&
        pointer.y >= b.top - HIT_PAD &&
        pointer.y <= b.bottom + HIT_PAD;
    }
    if (!inBox && !onArt) return;

    item.bobTween?.remove();
    item.bobTween = null;
    this.tweens.killTweensOf(item.image);

    const centre = { x: item.image.x, y: item.image.y };
    this.drag = { item, gripX: centre.x - pointer.x, gripY: centre.y - pointer.y, moved: false };

    // Grow to true size and lift above everything.
    this.trayLayer.remove(item.image);
    this.dragLayer.add(item.image);
    item.image.setDepth(DEPTH_DRAG);
    this.applyFull(item);

    if (onArt) {
      item.image.setPosition(pointer.x + this.drag.gripX, pointer.y + this.drag.gripY);
    } else {
      item.image.setPosition(pointer.x, pointer.y);
      this.drag.gripX = 0;
      this.drag.gripY = 0;
    }
  }

  onPointerMove(pointer) {
    if (!this.drag) return;
    const { item, gripX, gripY } = this.drag;
    item.image.setPosition(pointer.x + gripX, pointer.y + gripY);
    this.drag.moved = true;
  }

  onPointerUp() {
    if (!this.drag) return;
    const { item, moved } = this.drag;
    this.drag = null;

    // A tap that never moved is just a tap — settle back into the tray.
    if (!moved) return this.returnToTray(item);

    // Accept/reject is decided by the BOXES. A small pad lets a near miss on the
    // edge still count; the box the piece's centre lands in decides the outcome.
    const landedIn = this.boxAt(item.image.x, item.image.y, BOX_DROP_PAD);

    if (landedIn === item.key) return this.placePiece(item);

    if (landedIn && landedIn !== item.key) {
      // Wrong box → mistake, snap back to the tray.
      this.roundMistakes += 1;
      this.mistakes += 1;
      this.streak = 0;
      this.flashRed();
      this.playSound('wrong', 0.5);
      this.returnToTray(item);
      return;
    }

    // Not in any box — it simply rests where it fell, still grabbable, no penalty.
  }

  // Puts the piece back in the tray at its preview size.
  returnToTray(item) {
    this.dragLayer.remove(item.image);
    this.trayLayer.add(item.image);
    item.image.setDepth(DEPTH_TRAY);
    this.applyPreview(item);
    this.restartBob(item);
  }

  restartBob(item) {
    item.bobTween?.remove();
    item.bobTween = this.tweens.add({
      targets: item.image,
      y: item.baseY - TRAY_BOB,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Correct drop: the character is revealed in the scene at its true transform,
  // and the round advances.
  placePiece(item) {
    if (this.phase !== 'playing') return;
    this.phase = 'success';

    // The round is done the instant the piece lands — cut its voice line right
    // away rather than letting it finish over the snap / next round.
    this.stopVoice();

    item.placed = true;
    item.bobTween?.remove();
    this.tweens.killTweensOf(item.image);

    const t = item.target;
    const image = item.image;
    image.setScale(t.scale);
    image.setAngle(t.rotation);
    image.setFlipX(!!t.flipX);
    this.tweens.add({
      targets: image,
      x: t.x,
      y: t.y,
      duration: 140,
      ease: 'Back.easeOut',
    });

    this.playSound(`pop${Phaser.Math.Between(1, 3)}`, 0.9);
    this.spawnSnapBurst(t.x, t.y);

    // Fold the piece into the scene layer so it stays for later rounds.
    this.placedKeys.add(item.key);
    this.dragLayer.remove(image);
    this.charLayer.add(image);
    image.setDepth(t.z);
    this.charObjects.set(item.key, { image, z: t.z });

    this.stars += 1;
    if (this.roundMistakes === 0) {
      this.streak += 1;
      this.peakStreak = Math.max(this.peakStreak, this.streak);
    } else {
      this.streak = 0;
    }

    // Finishing the SCENE (its second placement) earns the success jingle and
    // confetti, and a hold long enough for both to play out before the scene
    // transition. A mid-scene round change keeps the old quick beat.
    const sceneDone = this.isSceneChange() || this.roundIndex >= TOTAL_ROUNDS - 1;
    if (sceneDone) {
      this.playSound('success', 0.25);
      this.spawnConfetti(30);
    }

    this.time.delayedCall(sceneDone ? SUCCESS_HOLD_MS : ROUND_ADVANCE_MS, () => {
      if (this.phase !== 'success') return;
      this.advanceRound();
    });
  }

  // Whether the next round starts a different scene.
  isSceneChange() {
    const next = ROUNDS[this.roundIndex + 1];
    return !!next && next.scene !== this.round.scene;
  }

  advanceRound() {
    if (this.roundIndex >= TOTAL_ROUNDS - 1) return this.finishGame();
    if (this.isSceneChange()) this.transitionToScene(this.roundIndex + 1);
    else this.startNextRound(this.roundIndex + 1);
  }

  // Same scene: rebuild the round in place and drop the next option straight
  // into the tray — no veil, no scene reload animation.
  startNextRound(nextIndex) {
    this.setupRound(nextIndex);
    this.trayLayer.setVisible(true);
    if (this.trayItem) this.dropInTray(this.trayItem);
    this.playRoundVoice();
  }

  // The option drops into the tray from just above it.
  dropInTray(item) {
    item.bobTween?.remove();
    item.bobTween = null;
    this.tweens.killTweensOf(item.image);
    item.image.setAlpha(0);
    item.image.y = this.trayTop - 80;
    this.tweens.add({
      targets: item.image,
      y: item.baseY,
      alpha: 1,
      duration: 440,
      ease: 'Back.easeOut',
      onComplete: () => this.restartBob(item),
    });
  }

  spawnSnapBurst(x, y) {
    const ring = this.add.circle(x, y, 30, 0xffffff, 0).setDepth(DEPTH_CHARS + 2);
    ring.setStrokeStyle(5, 0xf59e0b, 0.9);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 380,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  flashRed() {
    this.tweens.killTweensOf(this.redFlash);
    this.redFlash.setAlpha(0.28);
    this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 320, ease: 'Sine.easeOut' });
  }

  playSound(key, volume = 1) {
    if (key && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  // Stops the current voice line (start-screen instructions or a round prompt)
  // the moment it is no longer wanted. `remove` both stops playback and frees
  // the Sound, rather than just silencing it.
  stopVoice() {
    const v = this.voice;
    this.voice = null;
    if (v) this.sound.remove(v);
  }

  // Plays a one-shot voice line, replacing whatever was playing so two lines
  // never overlap. Retries once on Phaser's audio-unlock if the browser blocked
  // autoplay — guarded on `this.voice === v` so a line cancelled in the meantime
  // does not start up after the fact.
  playVoice(key, volume = 0.95) {
    this.stopVoice();
    if (!key || !this.cache.audio.exists(key)) return;
    const v = this.sound.add(key, { volume });
    this.voice = v;
    const tryPlay = () => {
      if (this.voice === v && !v.isPlaying) v.play();
    };
    tryPlay();
    this.sound.once('unlocked', tryPlay);
  }

  // The voice line for the round now on screen (audio keys are '1'..'12').
  playRoundVoice() {
    this.playVoice(String(this.roundIndex + 1));
  }

  // Scene change: a dark veil wipes in, the new scene eases in from a slight
  // zoom, then the veil wipes away and the new option drops into the tray.
  transitionToScene(nextIndex) {
    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x2b2114, 1)
      .setDepth(200)
      .setAlpha(0);
    this.tweens.add({
      targets: veil,
      alpha: 0.94,
      duration: 320,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.setupRound(nextIndex);
        this.trayLayer.setVisible(true);

        // Ease the new scene in from a slightly larger scale.
        this.bgLayer.setScale(1.06);
        this.tweens.add({ targets: this.bgLayer, scale: 1, duration: 560, ease: 'Sine.easeOut' });

        this.tweens.add({
          targets: veil,
          alpha: 0,
          duration: 460,
          ease: 'Sine.easeOut',
          onComplete: () => veil.destroy(),
        });
        if (this.trayItem) this.dropInTray(this.trayItem);
        this.playRoundVoice();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Finish
  // ---------------------------------------------------------------------------

  finishGame() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.stopVoice();

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);
    // Confetti for the final round is spawned in placePiece() alongside the
    // success jingle, so it is not repeated here.

    this.game.events.emit('game12-complete', {
      stars: this.stars,
      totalRounds: TOTAL_ROUNDS,
      peakStreak: this.peakStreak,
      mistakes: this.mistakes,
      elapsedSeconds,
    });

    this.showEndOverlay();
  }

  showEndOverlay() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x3b2f1e, 0.5).setDepth(300);

    const panel = this.add.container(width / 2, height / 2).setDepth(301).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-220, -150, 440, 300, 28);
    bg.lineStyle(6, 0xf59e0b, 1);
    bg.strokeRoundedRect(-220, -150, 440, 300, 28);
    panel.add(bg);

    const title = this.add
      .text(0, -78, 'Mission Complete!', {
        fontSize: '48px',
        fontFamily: PROMPT_FONT,
        fontStyle: 'bold',
        color: '#3b2f1e',
      })
      .setOrigin(0.5);
    panel.add(title);

    const starLine = this.add
      .text(0, -6, `\u2B50 ${this.stars} / ${TOTAL_ROUNDS}`, {
        fontSize: '40px',
        fontFamily: PROMPT_FONT,
        fontStyle: 'bold',
        color: '#f59e0b',
      })
      .setOrigin(0.5);
    panel.add(starLine);

    const btn = this.createPillButton(width / 2, height / 2 + 108, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 302,
    });
    btn.on('pointerup', () => this.scene.restart());
  }

  spawnConfetti(count = 30) {
    const { width, height } = this.scale;
    const texKeys = [makeConfettiTexture(this), makeConfettiSquareTexture(this)];
    const tints = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6];

    for (let i = 0; i < count; i += 1) {
      const key = texKeys[i % texKeys.length];
      const piece = this.add
        .image(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(-180, -60), key)
        .setDepth(DEPTH_DRAG + 4)
        .setTint(Phaser.Utils.Array.GetRandom(tints))
        .setScale(Phaser.Math.FloatBetween(1.1, 2.2))
        .setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: piece,
        x: piece.x + Phaser.Math.Between(-80, 80),
        y: height + 60,
        angle: piece.angle + Phaser.Math.Between(220, 620),
        duration: Phaser.Math.Between(1500, 2600),
        delay: i * 40,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

}
