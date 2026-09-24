// GameScene.js
// Game 11 — "Mirror Me!".
//
// One round per portrait (8 total). Each round:
//   1. The finished ORIGINAL portrait is shown, assembled, as the reference.
//   2. The MIRRORED DUPLICATE is NOT drawn — there is no marker at all. Each
//      part's snap target is simply the position it occupies in the tuned
//      duplicate (see portraitPositions.js).
//   3. The duplicate's pieces sit in a row along the bottom, each shown in its
//      real duplicate transform (same rotation/relative size), scaled by the
//      row's shared factor and nudged by OPTION_TRANSFORM.
//   4. Dragging a piece grows it to its true placed size. Let go near its own
//      tuned position it SNAPS in and locks; let go on another part's position
//      it counts as a mistake and stays put; anywhere else it simply rests
//      where it fell — no penalty, still grabbable.
//   5. When every piece is placed the original and duplicate animate TOGETHER
//      (as one rigid group) with confetti, then the next round begins.
//
// Pieces are assumed to be pre-cropped to their artwork, so nothing here reads
// image pixels: a part's size is its texture size, and its placement comes
// entirely from portraitPositions.js.
//
//   assets.js             what to load (URLs)
//   portraitPositions.js  where each part sits / duplicate / option transforms
//   portraits.js          page order + layer order (pure helpers)
import * as Phaser from 'phaser';
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton, isMuted } from '@/phaser/common/audioState';
import {
  makeConfettiTexture,
  makeConfettiSquareTexture,
  makeDividerGlowTexture,
} from '@/phaser/common/sceneAssets';
import { partsForPortrait, orderPartsByZ } from '@/games/game-11/portraits';
import {
  partTransform,
  portraitScale,
  portraitPivot,
  portraitPosition,
  portraitMirror,
  optionTransform,
  dividerFor,
} from '@/games/game-11/portraitPositions';
import { ROUND_SCRIPT, TOTAL_ROUNDS } from '@/games/game-11/levels';

// The clear colour behind everything. A warm tan so the bright, cut-out
// portrait art reads cleanly against it, and so the single frame before the
// backdrop draws is not a bare canvas as the scene fades in.
export const BACKGROUND_COLOR = '#f3e8d0';

// The mirrored duplicate is never drawn in the real game: each part is built so
// a placed piece can be revealed into exactly the right transform, but stays
// invisible, and the snap target is simply where that part sits in the tuned
// duplicate. (The tuning pass — which drew it as a ghost, along with guide lines
// and arrow-key round skipping — is parked in ./dev-backup; see its README.)
const SHOW_DUPLICATE_ALPHA = 0;

// Layout (720x1080 base resolution — see Phaser/config.js).
const TITLE_Y = 54;
const PROMPT_Y = 108;
const TRAY_TOP = 892; // top edge of the option area

// Header panel — a soft rounded card behind the title + instruction so they stay
// legible over the portraits and the divider gradient that now reach the top of
// the canvas. Sized to sit above both text baselines with even breathing room.
const HEADER_MARGIN = 16;
const HEADER_TOP = 14;
const HEADER_HEIGHT = 132;
const HEADER_RADIUS = 28;
const HEADER_FILL = 0xfff7e6;
const HEADER_FILL_ALPHA = 0.9;
const HEADER_STROKE = 0x5b4a2f;
const HEADER_STROKE_ALPHA = 0.16;
const HEADER_STROKE_WIDTH = 3;

// Option area. One BOX per part — 4 boxes when the portrait has 4 parts, 3 when
// it has 3 — laid out in a row and evenly filling the width. A piece is centred
// in its box, and the whole box is the grab zone: tap anywhere in the box to
// grab its piece.
//
// Each piece is scaled to fill its box as much as possible while staying fully
// inside it: its ROTATED width and height (the piece is drawn rotated, e.g. the
// kite/plane at ~45-80°) are measured and the smaller of the two fit ratios is
// used, then TRAY_FILL trims a little for breathing room. TRAY_BOB reserves the
// pixels the idle bob raises the piece by, so it cannot clip the top either.
const TRAY_MARGIN = 12;
const TRAY_GAP = 8; // space between boxes
const TRAY_PAD = 12; // gap between a piece and its box's inner edge
const TRAY_BOB = 6; // px the idle bob lifts a piece; reserved so it can't clip
const TRAY_FILL = 0.94; // final size trim (1 = touch the padding)
const TRAY_BOX_INSET = 14; // gap between the option area's top edge and the boxes
const OPTION_HIT_PAD = 10; // slack around a piece's own bounds when grabbing
const TRAY_AREA_BOTTOM = 1080;
const DRAW_TRAY_BOXES = true;

// Option-box styling. A warm cream fill that separates the cell from the tan
// backdrop without competing with the artwork, plus a soft brown outline so the
// cell reads as a tray slot rather than a floating white patch.
const TRAY_BOX_FILL = 0xfff7e6;
const TRAY_BOX_FILL_ALPHA = 0.92;
const TRAY_BOX_STROKE = 0x5b4a2f;
const TRAY_BOX_STROKE_ALPHA = 0.32;
const TRAY_BOX_STROKE_WIDTH = 3;

// Draw order bands.
const DEPTH_BACKDROP = 0;
const DEPTH_DIVIDER = 2; // the round divider sits behind the portraits
const DEPTH_REFERENCE = 5;
const DEPTH_HUD = 20;
const DEPTH_TRAY = 30;
const DEPTH_DRAG = 60;
const DEPTH_START = 400; // the start screen covers everything, even the end panel

// Start screen — the title card fills the canvas and a Start button sits low.
const START_BUTTON_Y = 952;

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.roundIndex = 0;
    this.phase = 'playing';
    this.mistakes = 0;
    this.stars = 0;
    this.streak = 0;
    this.peakStreak = 0;
    this.roundMistakes = 0;
    this.drag = null;
    this.trayItems = [];
    this.slots = [];
  }

  create() {
    const { width, height } = this.scale;

    this.startTime = this.time.now;

    // Background music + first-tap unlock, plus the shared mute button.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Backdrop: cover-fit artwork if present, else a white-to-tan gradient.
    if (this.textures.exists('background')) {
      const bg = this.add.image(width / 2, height / 2, 'background');
      bg.setScale(Math.max(width / bg.width, height / bg.height));
      bg.setDepth(DEPTH_BACKDROP);
    } else {
      const backdrop = this.add.graphics().setDepth(DEPTH_BACKDROP);
      backdrop.fillGradientStyle(0xffffff, 0xffffff, 0xf3e8d0, 0xf3e8d0, 1);
      backdrop.fillRect(0, 0, width, height);
    }

    // Header card behind the fixed HUD text (drawn one below the text so the
    // words sit on top, but above the portraits so the top stays readable).
    const header = this.add.graphics().setDepth(DEPTH_HUD - 1);
    header.fillStyle(HEADER_FILL, HEADER_FILL_ALPHA);
    header.lineStyle(HEADER_STROKE_WIDTH, HEADER_STROKE, HEADER_STROKE_ALPHA);
    header.fillRoundedRect(
      HEADER_MARGIN,
      HEADER_TOP,
      width - HEADER_MARGIN * 2,
      HEADER_HEIGHT,
      HEADER_RADIUS
    );
    header.strokeRoundedRect(
      HEADER_MARGIN,
      HEADER_TOP,
      width - HEADER_MARGIN * 2,
      HEADER_HEIGHT,
      HEADER_RADIUS
    );

    // Fixed HUD.
    this.titleText = this.add
      .text(width / 2, TITLE_Y, '', {
        fontSize: '42px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#5b4a2f',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_HUD);

    this.promptText = this.add
      .text(width / 2, PROMPT_Y, '', {
        fontSize: '26px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#8a7758',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_HUD);

    this.roundPill = this.createPillButton(width - 14, 14, '', {
      fontSize: '20px',
      paddingX: 16,
      paddingY: 9,
      anchor: 'topRight',
      interactive: false,
      depth: 25,
    });

    // Option band backdrop — a soft panel so the pieces read as a shelf.
    this.add
      .rectangle(width / 2, (TRAY_TOP + height) / 2, width, height - TRAY_TOP, 0x5b4a2f, 0.08)
      .setDepth(DEPTH_TRAY - 1);
    this.add
      .rectangle(width / 2, TRAY_TOP, width, 3, 0x5b4a2f, 0.18)
      .setDepth(DEPTH_TRAY - 1);

    // Drag input is resolved on the scene (not per-object) so a piece can be
    // dragged past the row's edge without the hit area cutting the gesture off.
    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', () => this.onPointerUp());

    this.redFlash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff2b2b, 1)
      .setDepth(95)
      .setAlpha(0);

    // DEV: expose this game so portraitPositions.js can ask it to re-lay-out
    // when a tuning value is saved — instant preview, no page refresh.
    if (typeof globalThis !== 'undefined') globalThis.__G11_GAME__ = this.game;
    this.game.events.on('g11:tuning', this.onTuning, this);
    this.events.once('shutdown', () => {
      this.game.events.off('g11:tuning', this.onTuning, this);
      // Don't let the start-screen voice keep playing if the player backs out
      // before pressing Start.
      this.stopWelcome();
    });

    this.setupRound(0);
    this.buildStartOverlay();
  }

  // DEV: rebuild the current round in place so a saved tuning edit is visible
  // immediately. Skips while a piece is mid-drag so the gesture isn't yanked.
  onTuning() {
    if (this.drag) return;
    this.setupRound(this.roundIndex);
  }

  // ---------------------------------------------------------------------------
  // Start screen
  // ---------------------------------------------------------------------------

  // Covers the first round with the title card and a Start button. The board is
  // built underneath (setupRound already ran) so pressing Start is a simple
  // fade-away into play rather than another setup pass.
  buildStartOverlay() {
    const { width, height } = this.scale;
    this.phase = 'start';

    this.startOverlay = this.add.container(0, 0).setDepth(DEPTH_START);

    // The title card covers the canvas (cover-fit, never letterboxed).
    const card = this.add.image(width / 2, height / 2, 'startScreen');
    card.setScale(Math.max(width / card.width, height / card.height));
    this.startOverlay.add(card);

    const startBtn = this.createPillButton(width / 2, START_BUTTON_Y, 'Start \u25B6', {
      fontSize: '34px',
      paddingX: 48,
      paddingY: 20,
      depth: DEPTH_START + 1,
    });
    // createPillButton returns a wrapper ({ container, on, ... }), not a plain
    // GameObject — add its container to the overlay, and tween that same
    // container, or Phaser chokes putting a non-GameObject into a Container.
    this.startOverlay.add(startBtn.container);
    // A gentle pulse so the button reads as the thing to press.
    this.tweens.add({
      targets: startBtn.container,
      scale: 1.06,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    startBtn.on('pointerup', () => this.beginPlay());

    this.playWelcome();
  }

  // Plays the start-screen voice-over, deferring to the audio unlock if the
  // browser blocks autoplay before any tap. Not looped: if it finishes on its
  // own the screen simply goes quiet, waiting for Start.
  playWelcome() {
    this.sound.mute = isMuted();
    const voice = this.sound.add('welcome', { volume: 0.9 });
    this.welcomeVoice = voice;

    const tryPlay = () => {
      if (voice.isPlaying) return;
      voice.play();
    };
    tryPlay();
    this.sound.once('unlocked', tryPlay);
  }

  // Stops the start-screen voice the moment play begins. Goes through the
  // SoundManager's remove so the sound is torn down, not just silenced.
  stopWelcome() {
    const voice = this.welcomeVoice;
    this.welcomeVoice = null;
    if (voice) this.sound.remove(voice);
  }

  // Fades the start screen out, then drops into the first round.
  beginPlay() {
    if (this.phase !== 'start') return;
    this.phase = 'playing';
    this.stopWelcome();
    ensureBgMusic(this);

    const overlay = this.startOverlay;
    this.startOverlay = null;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => overlay.destroy(true),
    });
  }

  // ---------------------------------------------------------------------------
  // Round setup
  // ---------------------------------------------------------------------------

  setupRound(index) {
    this.roundIndex = index;
    this.round = ROUND_SCRIPT[index];
    this.phase = 'playing';
    this.roundMistakes = 0;
    this.drag = null;
    // Stop the previous round's idle-bob tweens BEFORE their containers are
    // destroyed. Without this they keep ticking against a destroyed target
    // until the scene ends, which is both wasted work and a slow leak across
    // eight rounds.
    if (this.trayItems) {
      for (const item of this.trayItems) item.bobTween?.remove();
    }
    this.slots = [];
    this.trayItems = [];

    // Tear down the previous round's divider, board and row.
    if (this.dividerLayer) this.dividerLayer.destroy(true);
    if (this.boardLayer) this.boardLayer.destroy(true);
    if (this.trayLayer) this.trayLayer.destroy(true);
    this.dividerLayer = this.add.container(0, 0).setDepth(DEPTH_DIVIDER);
    this.boardLayer = this.add.container(0, 0).setDepth(DEPTH_REFERENCE);
    this.trayLayer = this.add.container(0, 0).setDepth(DEPTH_TRAY);
    // The original and its duplicate both live inside this one group, so the
    // celebration can animate them as a single rigid object (see celebrate()).
    this.danceGroup = this.add.container(0, 0);
    this.boardLayer.add(this.danceGroup);

    this.titleText.setText(`Build the ${this.round.name}!`);
    this.promptText.setText('Drag each piece onto its spot');
    this.roundPill.setText(`Round\n${index + 1}/${TOTAL_ROUNDS}`);

    this.buildDivider();
    this.buildBoard();
    this.buildTray();
  }

  // ---------------------------------------------------------------------------
  // Divider — a thin tuned line with a soft two-colour glow bleeding off each side
  // ---------------------------------------------------------------------------

  buildDivider() {
    const cfg = dividerFor(this.round.portrait);
    if (!cfg) return;

    const half = cfg.length / 2;

    // One stretched gradient image per side, each tinted to that side's colour.
    // The baked strip is opaque at its top and clear at its bottom, so placing
    // the opaque edge on the line makes both sides fade AWAY from it. This
    // replaces the old live stack of ~48 fill bands per side (≈100 overlapping
    // full-canvas quads re-rasterised every frame) with two ordinary image
    // draws — the single biggest per-frame saving in this scene.
    const tex = makeDividerGlowTexture(this);
    for (const side of [-1, 1]) {
      const glow = this.add.image(0, 0, tex);
      // Stretch the strip to the divider's length and falloff depth. Display
      // size is independent of origin, so this fits whatever the round asks for.
      glow.setDisplaySize(cfg.length, cfg.depth);
      // The strip is opaque at its TOP; for the +1 side flip it so the opaque
      // edge still lands on the line. Origin sits on the line (the container's
      // centre), so the image extends only outward.
      if (side > 0) glow.setFlipY(true);
      glow.setOrigin(0.5, side > 0 ? 1 : 0);
      glow.setAlpha(cfg.alpha * 0.6);
      glow.setTint(side < 0 ? cfg.colorA : cfg.colorB);
      const wrap = this.add.container(cfg.x, cfg.y, [glow]);
      wrap.setRotation((cfg.rotation * Math.PI) / 180);
      this.dividerLayer.add(wrap);
    }

    // The crisp line itself, on top of both glows.
    const line = this.add.graphics();
    line.fillStyle(cfg.lineColor, cfg.lineAlpha);
    line.fillRect(-half, -cfg.thickness / 2, cfg.length, cfg.thickness);
    line.setRotation((cfg.rotation * Math.PI) / 180);
    this.dividerLayer.add(this.add.container(cfg.x, cfg.y, [line]));
  }

  // ---------------------------------------------------------------------------
  // Board — the assembled original + the duplicate's snap targets
  // ---------------------------------------------------------------------------

  buildBoard() {
    const portrait = this.round.portrait;

    // Compute the back-to-front order ONCE and hand the SAME array to both
    // copies. They can never stack differently, because they are not each
    // sorting their own list — they are both drawing this one.
    const partOrder = orderPartsByZ(
      partsForPortrait(portrait).filter((key) => this.textures.exists(key)),
      (key) => partTransform(key).z
    );

    // The finished original, shown assembled. This is what the child matches.
    // Added to the shared dance group, not the board layer directly.
    const originalPos = portraitPosition(portrait);
    const original = this.buildPortrait(
      portrait,
      { ...originalPos, flipX: false },
      null,
      partOrder
    );
    this.danceGroup.add(original.container);

    // The duplicate is NOT drawn: each part image is still built (so a placed
    // piece can be revealed into exactly the right transform) but stays
    // invisible, and the snap target is simply where that part sits in the
    // tuned duplicate. SHOW_DUPLICATE_ALPHA is 0 in the shipped game.
    const mirror = portraitMirror(portrait);
    if (mirror) {
      const duplicate = this.buildPortrait(portrait, mirror, null, partOrder);
      this.danceGroup.add(duplicate.container);
      this.duplicateContainer = duplicate.container;

      duplicate.partImages.forEach((image, partKey) => {
        image.setAlpha(SHOW_DUPLICATE_ALPHA);
        // Ship the duplicate parts hidden rather than merely transparent: an
        // alpha-0 sprite still costs a draw call and a batch slot every frame,
        // while a non-visible one is skipped outright. Each is switched back on
        // the moment its piece is placed (see placePiece).
        image.setVisible(SHOW_DUPLICATE_ALPHA > 0);
        this.slots.push({ partKey, x: 0, y: 0, image, filled: false });
      });
      // Each part's world centre comes straight off the live duplicate
      // container transform, so the snap targets always match what is on screen
      // whatever the duplicate's flip, rotation or scale.
      const c = duplicate.container;
      const cos = Math.cos(c.rotation);
      const sin = Math.sin(c.rotation);
      for (const slot of this.slots) {
        // image.x/y is the part's centre in container-local space; the container
        // scale already carries the flip sign, so multiplying by it mirrors too.
        const sx = slot.image.x * c.scaleX;
        const sy = slot.image.y * c.scaleY;
        slot.x = c.x + (sx * cos - sy * sin);
        slot.y = c.y + (sx * sin + sy * cos);
      }
    } else {
      this.duplicateContainer = null;
    }
  }

  // Builds a full portrait (or a single part when `onlyKey` is given) as a
  // container using the tuning transform. Returns the container plus a map of
  // partKey -> image.
  //
  // `partOrder` is the pre-sorted key list to draw back-to-front, shared by both
  // copies so they cannot stack differently. When omitted (e.g. a single tray
  // piece) the order is derived here from `z`.
  buildPortrait(
    portrait,
    { x, y, rotation = 0, flipX = false, flipY = false },
    onlyKey = null,
    partOrder = null
  ) {
    const pivot = portraitPivot(portrait);
    const scale = portraitScale(portrait);

    const container = this.add.container(x, y);
    container.setScale(flipX ? -scale : scale, flipY ? -scale : scale);
    container.setRotation((rotation * Math.PI) / 180);

    const keys = (partOrder || orderPartsByZ(
      partsForPortrait(portrait),
      (key) => partTransform(key).z
    )).filter((key) => (!onlyKey || key === onlyKey) && this.textures.exists(key));

    const partImages = new Map();
    // `i` is the key's index in the back-to-front order; using it as the child's
    // depth makes the stacking explicit and independent of how the parts within
    // one key are emitted, so the original and mirror always paint identically.
    keys.forEach((key, i) => {
      const { x: px, y: py, scale: ps, rotation: pr } = partTransform(key);
      const part = this.add
        .image(px - pivot.x, py - pivot.y, key)
        .setScale(ps)
        .setRotation((pr * Math.PI) / 180)
        .setDepth(i);
      container.add(part);
      partImages.set(key, part);
    });
    // Keep the container's render order locked to the depth just assigned.
    container.sort('depth');

    return { container, partImages };
  }

  // ---------------------------------------------------------------------------
  // Option row — draggable pieces
  // ---------------------------------------------------------------------------

  buildTray() {
    const { width } = this.scale;
    const portrait = this.round.portrait;
    const keys = partsForPortrait(portrait).filter((k) => this.textures.exists(k));
    // Shuffled so the row isn't laid out in the same layer order every time.
    const shuffled = Phaser.Utils.Array.Shuffle([...keys]);

    const n = shuffled.length;
    if (n === 0) return;

    const mirror = portraitMirror(portrait) || {};
    const S = portraitScale(portrait);

    // One box per part, evenly filling (width - 2*TRAY_MARGIN) with TRAY_GAP
    // between them. The row is vertically centred in the strip below TRAY_TOP.
    const boxesW = width - 2 * TRAY_MARGIN;
    const boxW = (boxesW - (n - 1) * TRAY_GAP) / n;
    const areaTop = TRAY_TOP + TRAY_BOX_INSET;
    const areaH = TRAY_AREA_BOTTOM - areaTop - TRAY_BOX_INSET;
    const boxH = areaH;
    const boxTop = areaTop;
    const boxCentreY = boxTop + boxH / 2;

    // Helper: re-centre each piece horizontally on its box's centre, keeping the
    // per-piece OPTION_TRANSFORM offsets as extra nudges.
    const boxCentreX = (i) => TRAY_MARGIN + i * (boxW + TRAY_GAP) + boxW / 2;

    // The inner area a piece must fit inside, in box-local terms. Height is
    // reduced by TRAY_BOB because the idle tween lifts the piece after layout.
    const innerW = boxW - 2 * TRAY_PAD;
    const innerH = boxH - 2 * TRAY_PAD - TRAY_BOB;

    // Box fillers so each slot reads as a drop-in tray cell.
    if (DRAW_TRAY_BOXES) {
      for (let i = 0; i < n; i += 1) {
        const cx = boxCentreX(i);
        const r = this.add
          .rectangle(
            cx,
            boxTop + boxH / 2,
            boxW,
            boxH,
            TRAY_BOX_FILL,
            TRAY_BOX_FILL_ALPHA
          )
          .setStrokeStyle(
            TRAY_BOX_STROKE_WIDTH,
            TRAY_BOX_STROKE,
            TRAY_BOX_STROKE_ALPHA
          )
          .setDepth(DEPTH_TRAY);
        this.trayLayer.add(r);
        r.setData('box', true);
      }
    }

    shuffled.forEach((key, i) => {
      const opt = optionTransform(key);

      // Build the piece in the DUPLICATE's transform (flip + rotation). Its image
      // sits at (partX - pivotX, partY - pivotY) inside the container, so the
      // container origin is the portrait pivot, NOT the artwork. Every layout
      // below undoes that offset, which is what makes the hit area, the drag and
      // the drop all track the visible art.
      const { container, partImages } = this.buildPortrait(
        portrait,
        { x: 0, y: 0, rotation: mirror.rotation || 0, flipX: mirror.flipX, flipY: mirror.flipY },
        key
      );
      const image = partImages.get(key);

      const previewFactor = this.fitPieceToBox(container, key, opt, S, innerW, innerH);

      const item = {
        partKey: key,
        piece: container,
        signX: container.scaleX < 0 ? -1 : 1,
        signY: container.scaleY < 0 ? -1 : 1,
        // The container's rotation is fixed for the whole round, so its cos/sin
        // are cached here rather than recomputed on every drag move (this runs
        // once per pointermove — see applyPieceLayout).
        rotCos: Math.cos(container.rotation),
        rotSin: Math.sin(container.rotation),
        S,
        // The part image's centre in container-local space — the offset to undo.
        centreLocal: { x: image.x, y: image.y },
        factor: previewFactor,
        previewFactor,
        // Box the piece belongs to — the whole box is its grab zone.
        box: {
          left: TRAY_MARGIN + i * (boxW + TRAY_GAP),
          right: TRAY_MARGIN + i * (boxW + TRAY_GAP) + boxW,
          top: boxTop,
          bottom: boxTop + boxH,
        },
        centreX: 0,
        centreY: 0,
        baseX: 0,
        baseY: 0,
        placed: false,
      };
      this.trayLayer.add(container);

      // Centred in the box; OPTION_TRANSFORM.x/y nudge from there.
      const x = boxCentreX(i) + opt.x;
      const y = boxCentreY + opt.y;
      item.baseX = x;
      item.baseY = y;
      this.setPieceScale(item, previewFactor);
      this.setPieceCentre(item, x, y);

      this.trayItems.push(item);

      // Gentle idle bob so the pieces read as interactive. Kept on the item so
      // it can be removed on grab / teardown instead of running forever.
      item.bobTween = this.tweens.add({
        targets: container,
        y: container.y - TRAY_BOB,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 120,
      });
    });
  }

  // Chooses the option-preview factor for one piece so its ROTATED artwork fills
  // as much of the inner box as possible while staying entirely inside it.
  //
  // The piece is a container holding a single image that may be rotated and
  // flipped. We measure its true on-screen size at a reference scale (via
  // getBounds, which accounts for that rotation), then set the largest factor
  // whose measured width and height both fit the box — width is the binding
  // constraint for wide pieces, height for tall ones, and rotation is handled
  // because it is baked into the measurement.
  fitPieceToBox(container, key, opt, S, innerW, innerH) {
    const REF = 0.1; // a small reference factor; only ratios matter
    container.setScale(this.signOf(container.scaleX) * S * REF, this.signOf(container.scaleY) * S * REF);
    const b = container.getBounds();
    const wRef = Math.max(b.width, 0.001);
    const hRef = Math.max(b.height, 0.001);

    // Largest factor fitting width and height, then the per-piece OPTION_TRANSFORM
    // scale and a small trim.
    const fitW = innerW / wRef;
    const fitH = innerH / hRef;
    const fitted = Math.min(fitW, fitH) * REF * TRAY_FILL * opt.scale;
    return Math.max(fitted, 0.02);
  }

  // Keeps a scale's sign (−1 flipped, +1 not) while taking an absolute value.
  signOf(v) {
    return v < 0 ? -1 : 1;
  }

  // Positions a piece so the CENTRE OF ITS ART sits at (cx, cy), then re-applies
  // the current scale. The container holds the part at its portrait-local offset,
  // so we shift the container by the (scale- and rotation-aware) negative of that
  // offset. This is the single place the art-centre contract is kept.
  setPieceCentre(item, cx, cy) {
    item.centreX = cx;
    item.centreY = cy;
    this.applyPieceLayout(item);
  }

  // Applies a factor (relative to the full duplicate scale) to a piece, keeping
  // its art centred on (centreX, centreY).
  setPieceScale(item, factor) {
    item.factor = factor;
    this.applyPieceLayout(item);
  }

  applyPieceLayout(item) {
    const c = item.piece;
    const k = item.S * item.factor;
    c.setScale(item.signX * k, item.signY * k);

    // Map the part's local centre through the container transform (scale then
    // rotation), then move the container so that point lands on the target.
    // The rotation's cos/sin are cached at build time (item.rotCos/rotSin).
    const sx = item.centreLocal.x * c.scaleX;
    const sy = item.centreLocal.y * c.scaleY;
    c.setPosition(
      item.centreX - (sx * item.rotCos - sy * item.rotSin),
      item.centreY - (sx * item.rotSin + sy * item.rotCos)
    );
  }

  // A piece's live centre and on-screen footprint, taken from the container's
  // children bounds (no image reading).
  pieceCentre(item) {
    const b = item.piece.getBounds();
    return {
      x: b.centerX,
      y: b.centerY,
      width: b.width,
      height: b.height,
    };
  }

  // ---------------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------------

  onPointerDown(pointer) {
    if (this.phase !== 'playing' || this.drag) return;

    for (let i = this.trayItems.length - 1; i >= 0; i -= 1) {
      const item = this.trayItems[i];
      if (item.placed) continue;

      // The whole box the piece sits in is the primary grab zone — tap anywhere
      // in it to pick the piece up. Checked FIRST because it is four number
      // comparisons; item.piece.getBounds() walks the container and builds a
      // world matrix, so it is only computed when the cheaper test misses.
      const box = item.box;
      const inBox =
        box &&
        pointer.x >= box.left &&
        pointer.x <= box.right &&
        pointer.y >= box.top &&
        pointer.y <= box.bottom;

      // Fallback grab zone: the artwork itself, with a little slack, for when a
      // piece has been dragged out of its own box.
      let onArt = false;
      if (!inBox) {
        const b = item.piece.getBounds();
        onArt =
          pointer.x >= b.left - OPTION_HIT_PAD &&
          pointer.x <= b.right + OPTION_HIT_PAD &&
          pointer.y >= b.top - OPTION_HIT_PAD &&
          pointer.y <= b.bottom + OPTION_HIT_PAD;
      }
      if (!inBox && !onArt) continue;

      // Stop the idle bob (and any in-flight snap tween) so the drag owns the
      // container's position from here.
      item.bobTween?.remove();
      item.bobTween = null;
      this.tweens.killTweensOf(item.piece);
      const centre = this.pieceCentre(item);
      this.drag = {
        item,
        // Grip = art centre minus pointer, so the piece stays put under the
        // finger while it grows to true size.
        gripX: centre.x - pointer.x,
        gripY: centre.y - pointer.y,
        moved: false,
      };
      this.trayLayer.bringToTop(item.piece);
      // Grow to the TRUE placed size as the child lifts it (factor 1).
      this.setPieceScale(item, 1);
      if (onArt) {
        // Keep it under the finger.
        this.setPieceCentre(item, pointer.x + this.drag.gripX, pointer.y + this.drag.gripY);
      } else {
        // Grabbed in the empty part of the box — centre it on the finger.
        this.setPieceCentre(item, pointer.x, pointer.y);
        this.drag.gripX = 0;
        this.drag.gripY = 0;
      }
      return;
    }
  }

  onPointerMove(pointer) {
    if (!this.drag) return;
    const { item, gripX, gripY } = this.drag;
    this.setPieceCentre(item, pointer.x + gripX, pointer.y + gripY);
    this.drag.moved = true;
  }

  onPointerUp() {
    if (!this.drag) return;
    const { item, moved } = this.drag;
    this.drag = null;

    // A tap that never moved is just a tap — shrink it back into the row.
    if (!moved) {
      this.setPieceScale(item, item.previewFactor);
      this.setPieceCentre(item, item.baseX, item.baseY);
      return;
    }

    const centre = this.pieceCentre(item);
    const target = this.slots.find((s) => s.partKey === item.partKey && !s.filled);
    if (!target) {
      this.setPieceScale(item, item.previewFactor);
      this.setPieceCentre(item, item.baseX, item.baseY);
      return;
    }

    // Drop tolerance is half the smaller side of the art, capped, so a piece has
    // to be placed with intent instead of snapping from across the screen. There
    // is no board clamp — dropping anywhere is allowed; only a release on
    // ANOTHER part's spot counts as a mistake.
    const tolerance = Phaser.Math.Clamp(Math.min(centre.width, centre.height) * 0.5, 34, 72);
    const dist = Phaser.Math.Distance.Between(centre.x, centre.y, target.x, target.y);
    if (dist <= tolerance) {
      this.placePiece(item, target);
      return;
    }

    // If it was let go right on top of a DIFFERENT part's tuned position, that's
    // a wrong placement; otherwise it just rests where it was dropped.
    const onWrongSpot = this.slots.some(
      (s) =>
        s !== target &&
        !s.filled &&
        Phaser.Math.Distance.Between(centre.x, centre.y, s.x, s.y) <= tolerance
    );
    if (!onWrongSpot) return;

    this.roundMistakes += 1;
    this.mistakes += 1;
    this.streak = 0;
    this.flashRed();
    this.playSound('wrong', 0.5);
  }

  // Snaps a piece home: the matching duplicate part becomes visible, the option
  // piece is dismissed, and the round advances if that was the last one.
  placePiece(item, slot) {
    item.placed = true;
    slot.filled = true;

    this.playSound(`pop${Phaser.Math.Between(1, 3)}`, 0.9);
    this.spawnSnapBurst(slot.x, slot.y);

    // Punch the dragged piece onto the exact spot at true size, then hide it in
    // favour of the real duplicate part.
    this.setPieceScale(item, 1);
    this.setPieceCentre(item, slot.x, slot.y);
    this.tweens.add({
      targets: item.piece,
      alpha: 0,
      delay: 60,
      duration: 120,
      ease: 'Sine.easeOut',
      onComplete: () => item.piece.setVisible(false),
    });

    // Reveal the genuine part — its transform is already correct (it is a child
    // of the invisible duplicate container), so only its visibility and alpha
    // change. It ships non-visible (see buildBoard), so switch it back on first.
    slot.image.setVisible(true);
    this.tweens.add({
      targets: slot.image,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });

    if (this.trayItems.every((t) => t.placed)) this.completeRound();
  }

  spawnSnapBurst(x, y) {
    const ring = this.add.circle(x, y, 30, 0xffffff, 0).setDepth(DEPTH_REFERENCE + 2);
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

  // ---------------------------------------------------------------------------
  // Round completion + celebration
  // ---------------------------------------------------------------------------

  completeRound() {
    if (this.phase !== 'playing') return;
    this.phase = 'success';

    this.stars += 1;
    if (this.roundMistakes === 0) {
      this.streak += 1;
      this.peakStreak = Math.max(this.peakStreak, this.streak);
    } else {
      this.streak = 0;
    }

    this.playSound('pop3', 0.9);
    this.celebrate();

    const isLast = this.roundIndex >= TOTAL_ROUNDS - 1;
    this.time.delayedCall(2000, () => {
      if (this.phase !== 'success') return;
      if (isLast) this.finishGame();
      else this.transitionToRound(this.roundIndex + 1);
    });
  }

  // The original and the completed duplicate dance as ONE object. They are both
  // children of danceGroup, which is what actually animates — so their relative
  // placement can never drift.
  celebrate() {
    const group = this.danceGroup;
    if (!group) return;

    this.tweens.add({
      targets: group,
      y: '-=20',
      angle: '+=4',
      duration: 300,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });

    this.spawnConfetti(34);

    const yay = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, 'Great!', {
        fontSize: '64px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#22c55e',
        stroke: '#14532d',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_DRAG + 5)
      .setScale(0);
    this.tweens.add({
      targets: yay,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: yay,
          alpha: 0,
          y: yay.y - 40,
          delay: 900,
          duration: 320,
          onComplete: () => yay.destroy(),
        });
      },
    });
  }

  // Confetti — spawns small coloured pieces above the canvas and lets them
  // drift down with a tumble, destroying each as it leaves the screen.
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

  // Fades a veil over the screen, swaps to the next round, fades back out.
  transitionToRound(nextIndex) {
    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0xf3e8d0, 1)
      .setDepth(200)
      .setAlpha(0);
    this.tweens.add({
      targets: veil,
      alpha: 0.85,
      duration: 240,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.setupRound(nextIndex);
        this.tweens.add({
          targets: veil,
          alpha: 0,
          duration: 320,
          ease: 'Sine.easeOut',
          onComplete: () => veil.destroy(),
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Finish
  // ---------------------------------------------------------------------------

  finishGame() {
    this.phase = 'finished';

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);
    // The single end-of-run log — matches Game.jsx's completeEventName.
    this.game.events.emit('game11-complete', {
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

    this.add.rectangle(width / 2, height / 2, width, height, 0x5b4a2f, 0.5).setDepth(300);

    const panel = this.add.container(width / 2, height / 2).setDepth(301).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-220, -150, 440, 300, 28);
    bg.lineStyle(6, 0xf59e0b, 1);
    bg.strokeRoundedRect(-220, -150, 440, 300, 28);
    panel.add(bg);

    const title = this.add
      .text(0, -78, 'All Built!', {
        fontSize: '48px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#5b4a2f',
      })
      .setOrigin(0.5);
    panel.add(title);

    const starLine = this.add
      .text(0, -6, `⭐ ${this.stars} / ${TOTAL_ROUNDS}`, {
        fontSize: '40px',
        fontFamily: 'Fredoka, sans-serif',
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

  // ---------------------------------------------------------------------------
  // Feedback helpers
  // ---------------------------------------------------------------------------

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

}
