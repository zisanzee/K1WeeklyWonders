// scenes/PositionsScene.js
// Scene 3 of 5 — "Positions".
//
// ---------------------------------------------------------------------------
// THIS REPLACES T W O SCENES
// ---------------------------------------------------------------------------
// "Positions" (top/middle/bottom) and "Left - Right" were separate mini-games,
// but they are one mechanic: a prompt names a RELATIVE POSITION and the child
// drags an object to the spot that answers it. They are merged here with FOUR
// portraits, each asking two opposite relations:
//
//   portrait 1  on top of / at the bottom of     (the wall)
//   portrait 2  in front of / behind             (the road, top-down)
//   portrait 3  inside / outside                 (the box)
//   portrait 4  to the left of / to the right of (the table)
//
// The registry id is still 'positions', because that keys the tuning block, the
// panel group and the run's progress.
//
// ---------------------------------------------------------------------------
// THE ROUND
// ---------------------------------------------------------------------------
//   1. The portrait's background is drawn, empty.
//   2. Prompt A is shown ("Put the cat on top of the wall") and ONE object is
//      offered in a disc above the prompt.
//   3. The child drags it out — it grows to true size — and drops it on the spot
//      that answers the prompt.
//        · on the right spot  → it snaps in, the spot pulses, and the prompt
//                               advances to B
//        · on the OTHER spot  → buzzer, red flash, the area flashes red, and the
//                               object returns to the disc. Counted as a mistake.
//        · anywhere else      → returns to the disc, no penalty: nothing was
//                               answered.
//   4. Prompt B is shown with its object, same rules.
//   5. Both placed → the finished pair is held for a beat, `pop2` plays, and the
//      hub advances the round.
//
// ---------------------------------------------------------------------------
// WHY ONE OPTION, NOT A TRAY
// ---------------------------------------------------------------------------
// The prompt already NAMES the object ("the cat"), so offering a choice would
// turn a positional task into a matching one. One object on offer keeps the
// question entirely about WHERE.
//
// The accept zones are deliberately LARGE (`areaSizePx`, overridable per slot):
// the objective is knowing which side of the wall / car / box / plate something
// goes, not hitting a pixel on a tablet.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';
import {
  getHud,
  getPositionPartsFor,
  getPositionRound,
  getPositions,
  getSceneTuning,
  TUNING,
} from '@/games/game-16/tuning';

// The pop2 success cue — the same key scenes 1 and 2 use.
const SUCCESS_SOUND = 'pop2';

const CONFIG = SCENES.find((s) => s.id === 'positions');

// Slack around an object's bounds for a dev grab, in px — game 12's HIT_PAD.
const HIT_PAD = 14;

export default class PositionsScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });

    this.objects = []; // every placed / placeable object of the round
    this.areas = []; // [{ slot, x, y, w, h, id }] the accept zones
    this.devDrag = null; // dev-only canvas tuning drag

    this.drag = null; // the option being dragged
    this.phase = 'idle'; // 'playing' | 'settling' | 'winning'
    this.promptIndex = 0; // 0 = prompt A, 1 = prompt B
    this.placed = []; // slots already placed
    this.mistakes = 0;
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  beginRound() {
    this.objects = [];
    this.areas = [];
    this.devDrag = null;
    this.drag = null;
    this.phase = 'idle';
    this.promptIndex = 0;
    this.placed = [];
    this.mistakes = 0;
    this.pendingTimers = [];
    this.promptContainer = null;
    this.removeListeners();
  }

  destroy() {
    this.cancelPending();
    this.removeListeners();
    // The prompt is its own container so it can be torn down between prompts; the
    // hub destroys the layer too, but clearing here keeps the reference honest.
    this.clearPrompt();
    // Every other display object is a child of ctx.layer, which the hub clears and
    // destroys wholesale, so nothing needs freeing by hand.
    this.objects = [];
    this.areas = [];
    super.destroy();
  }

  cancelPending() {
    (this.pendingTimers || []).forEach((timer) => timer.remove(false));
    this.pendingTimers = [];
  }

  schedule(ms, fn) {
    const timer = this.ctx.scene.time.delayedCall(ms, () => {
      this.pendingTimers = (this.pendingTimers || []).filter((t) => t !== timer);
      fn();
    });
    this.pendingTimers = this.pendingTimers || [];
    this.pendingTimers.push(timer);
    return timer;
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  createRound(ctx, round) {
    // The hub counts rounds from 0; the tables are 1-based because that is how a
    // human refers to them ("portrait 3's box").
    const roundNumber = round + 1;
    this.roundNumber = roundNumber;

    const t = getPositions();
    const meta = getPositionRound(roundNumber);
    // Sorted by slot, so `entries[0]` answers prompt A and `entries[1]` prompt B.
    const parts = getPositionPartsFor(roundNumber);

    this.meta = meta;
    this.entries = parts;

    this.drawBackground(ctx, t, meta);
    this.buildAreas(ctx, t, meta, parts);
    this.drawDevTargets(ctx, t);

    // The first prompt's object appears in the option circle, and the round
    // begins. Nothing is draggable before this, which is why `phase` starts idle.
    this.showPromptObject(ctx, t, 0);

    this.installPlay(ctx);
    this.installDevDrag(ctx);
  }

  /**
   * The portrait's background, COVER-fit like scene 1's factory.
   *
   * Cover (not stretch) so the art never distorts on a different aspect, and it
   * fills the canvas with no letterboxing. `bgScale` / `bgX` / `bgY` are the
   * hand corrections on top, which is what makes a painted horizon or table edge
   * land where the placements expect it.
   */
  drawBackground(ctx, t, meta) {
    const key = meta.bgKey;
    if (!key || !ctx.scene.textures.exists(key)) return null;

    const W = SceneBase.widthOf(ctx.scene);
    const H = SceneBase.heightOf(ctx.scene);
    const src = ctx.scene.textures.get(key).getSourceImage();
    if (!src?.width || !src?.height) return null;

    const cover = Math.max(W / src.width, H / src.height);

    const image = ctx.scene.add
      .image(meta.bgX, meta.bgY, key)
      .setScale(cover * (meta.bgScale ?? 1))
      .setDepth(0)
      .setAlpha(1);

    ctx.layer.add(image);
    this.bg = image;
    this.bgCover = cover;
    return image;
  }

  /**
   * The two accept zones, as data.
   *
   * A rectangle centred on the placement, `areaSizePx` on a side, with the
   * per-slot `slotABoxW/H` override. Stored rather than drawn: the zone is the
   * DECIDER, and drawing it is a separate concern (`drawAreaHints`).
   */
  buildAreas(ctx, t, meta, parts) {
    this.areas = parts.map((part) => {
      const slot = this.slotFor(part);
      const size = t.areaSizePx;
      return {
        id: part.id,
        slot: slot.key,
        x: slot.x,
        y: slot.y,
        w: slot.boxW > 0 ? slot.boxW : size,
        h: slot.boxH > 0 ? slot.boxH : size,
      };
    });
  }

  /**
   * A prompt's placement, read from the portrait.
   *
   * `slot: 'A'` → slotAX / slotAY / slotAScale / slotABoxW / slotABoxH, and the
   * same for 'B'. Kept as one function so the naming convention is applied in one
   * place instead of being spelled out at every use.
   */
  slotFor(part) {
    const meta = this.meta || {};
    const s = String(part.slot || 'A').toUpperCase();
    const prefix = s === 'B' ? 'slotB' : 'slotA';

    return {
      key: s,
      x: numberOr(meta[`${prefix}X`], part.x),
      y: numberOr(meta[`${prefix}Y`], part.y),
      scale: numberOr(meta[`${prefix}Scale`], 1),
      boxW: numberOr(meta[`${prefix}BoxW`], 0),
      boxH: numberOr(meta[`${prefix}BoxH`], 0),
    };
  }

  /**
   * Offer the object for prompt `index`.
   *
   * Creates the OPTION DISC above the prompt and the object inside it at preview
   * size, then sets the prompt. The object is the DRAGGABLE thing; the disc is
   * decoration and a drop target for "put it back".
   */
  showPromptObject(ctx, t, index) {
    const part = this.entries[index];
    if (!part) return;

    this.promptIndex = index;
    this.phase = 'playing';

    const W = SceneBase.widthOf(ctx.scene);
    // LEFT of centre, beside the prompt — the hub reserves the right-hand side via
    // the scene's `promptXFrac`, so the disc and the sentence cannot overlap.
    const optionX = W * (t.optionXFrac ?? 0.5);
    const optionY = t.optionY;

    this.clearOption(ctx);

    // The disc: a soft circle plus a shadow, so the option reads as floating on
    // the picture rather than as part of the painting.
    const shadow = ctx.scene.add
      .circle(optionX, optionY + t.optionShadowDy, t.optionRadius, 0x000000, t.optionShadowAlpha)
      .setDepth(30);
    ctx.layer.add(shadow);

    const disc = ctx.scene.add
      .circle(optionX, optionY, t.optionRadius, 0xffffff, t.optionDiscAlpha)
      .setStrokeStyle(t.optionDiscStrokeWidth, 0xffffff, t.optionDiscStrokeAlpha)
      .setDepth(31);
    ctx.layer.add(disc);

    const key = part.textureKey;
    const exists = key && ctx.scene.textures.exists(key);

    const image = exists
      ? ctx.scene.add.image(optionX, optionY, key).setDepth(32)
      : null;

    if (image) {
      ctx.layer.add(image);
      // Built at FULL size first, then shrunk to fit the disc — that is what lets
      // the preview be derived from the piece's real bounds (rotation included).
      image
        .setRotation(degToRad(part.rotation))
        .setFlipX(!!part.flipX)
        .setAlpha(clamp01((part.alpha ?? 1) * (t.objectAlpha ?? 1)));
      this.applyOptionPreview(image, part, t);
    }

    this.option = {
      part,
      disc,
      shadow,
      image,
      x: optionX,
      y: optionY,
      scale: image ? image.scaleX : 1,
    };

    // A slow bob, so the option reads as pickable. The BOB moves the image only:
    // moving the disc too would make the whole thing feel like it is floating
    // away.
    if (image && t.optionBobPx > 0) {
      this.option.bobTween = ctx.scene.tweens.add({
        targets: [image],
        y: optionY - t.optionBobPx,
        duration: Math.max(1, t.optionBobMs),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // The hub's own prompt line is CLEARED and this scene draws the sentence
    // itself, because one word in it has to be bigger and a different colour and
    // Phaser Text cannot style inline. See renderPrompt().
    ctx.setPrompt('');
    this.renderPrompt(part);
  }

  // ---------------------------------------------------------------------------
  // THE PROMPT — word-by-word layout
  // ---------------------------------------------------------------------------
  /**
   * Draw the prompt as individual word objects so ONE word can be emphasised.
   *
   * WHY NOT ONE TEXT OBJECT: Phaser's Text has no inline styling — a single string
   * cannot have one word at 1.45× and another colour. There is no rich-text object
   * in the core API either. So the sentence is measured and laid out as words,
   * which also means the wrap is ours rather than the hub's: the same column, the
   * same centred alignment, but the emphasised word is simply drawn at a bigger
   * size and its own colour.
   *
   * Every word is a child of ONE container, so tearing the prompt down at the end
   * of a round (or on a remount) is a single destroy and nothing can leak between
   * rounds.
   *
   * The layout mirrors what the hub does for its plain prompt, so the two agree on
   * where the column is: it reads the SAME per-scene `promptXFrac` /
   * `promptWrapFrac` / `promptYFrac` / `promptAlign` values.
   */
  renderPrompt(part) {
    this.clearPrompt();
    if (!this.ctx?.scene || !part?.prompt) return;

    const t = getPositions();
    const hud = getHud();
    const block = getSceneTuning('positions') || {};
    const { width: W, height: H } = this.ctx.scene.scale;

    const pick = (perScene, fallback) =>
      Number.isFinite(perScene) && perScene >= 0 ? perScene : fallback;

    const wrapFrac = pick(block.promptWrapFrac, hud.promptWrapFrac);
    const xFrac = pick(block.promptXFrac, 0.5);
    const yFrac = pick(block.promptYFrac, hud.promptYFrac);
    const align = typeof block.promptAlign === 'string' ? block.promptAlign : 'center';

    const colLeft = W * xFrac;
    const colWidth = W * wrapFrac;
    const baseY = H * yFrac;

    const bodySize = hud.promptFontSize;
    const emSize = Math.round(bodySize * (t.emphasisSizeMul ?? 1.45));
    const gap = Math.max(4, bodySize * 0.26);
    const lineGap = Math.max(6, bodySize * 0.3);
    // The emphasised word is taller than the line, so the first line is pushed
    // down by half the difference to keep the sentence's optical centre on baseY.
    const firstBaseline = baseY - (emSize - bodySize) / 2;

    const words = String(part.prompt).split(/\s+/).filter(Boolean);
    const emph = String(part.emphasis || '').toLowerCase();

    const container = this.ctx.scene.add.container(0, 0).setDepth(20);
    this.ctx.layer.add(container);

    // --- measure, then wrap into lines ---------------------------------------
    const made = words.map((word) => {
      const isEm = emph && stripPunctuation(word) === emph;
      const text = this.ctx.scene.add.text(0, 0, word, {
        fontSize: `${isEm ? emSize : bodySize}px`,
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: isEm ? t.emphasisColor : hud.promptColor,
        stroke: isEm ? t.emphasisStrokeColor : hud.promptStrokeColor,
        strokeThickness: isEm
          ? (t.emphasisStrokeThickness ?? 4)
          : hud.promptStrokeThickness,
      });
      text.setOrigin(0, 0.5);
      container.add(text);
      return { text, isEm, w: text.width, h: text.height };
    });

    const lines = [];
    let line = { items: [], width: 0, height: 0 };
    made.forEach((item) => {
      const extra = line.items.length ? gap : 0;
      if (line.items.length && line.width + extra + item.w > colWidth) {
        lines.push(line);
        line = { items: [], width: 0, height: 0 };
      }
      const lead = line.items.length ? gap : 0;
      line.items.push(item);
      line.width += lead + item.w;
      line.height = Math.max(line.height, item.h);
    });
    if (line.items.length) lines.push(line);

    // --- place them -----------------------------------------------------------
    // A LINE is centred (or left/right aligned) inside the column; the column
    // itself sits where promptXFrac put it. `centre` was the requested look, so
    // that is the default here too.
    let y = firstBaseline;
    lines.forEach((ln, i) => {
      if (i > 0) y += lines[i - 1].height / 2 + lineGap + ln.height / 2;

      let x;
      if (align === 'left') x = colLeft;
      else if (align === 'right') x = colLeft + colWidth - ln.width;
      else x = colLeft + (colWidth - ln.width) / 2;

      ln.items.forEach((item) => {
        // Vertically centre each word's own line box, so a big word and a small
        // word sit on the same visual baseline rather than one floating.
        item.text.setPosition(x, y);
        x += item.w + gap;
      });
    });

    this.promptContainer = container;
  }

  clearPrompt() {
    this.promptContainer?.destroy?.(true);
    this.promptContainer = null;
  }

  // True size for this object: the slot's scale times the part's own multiplier.
  fullScaleFor(part) {
    const slot = this.slotFor(part);
    return (slot.scale ?? 1) * (part.scale ?? 1);
  }

  applyOptionPreview(image, part, t) {
    const full = this.fullScaleFor(part);
    image.setScale(full);

    const b = image.getBounds();
    const inner = Math.max(1, t.optionRadius * 2 - 2 * t.optionBoxInset);
    const fit = Math.min(inner / Math.max(b.width, 1), inner / Math.max(b.height, 1));
    // A CEILING, never an enlargement: a small cut-out stays small.
    image.setScale(full * Math.min(1, fit));
  }

  /**
   * Tear down the option offer, ready for the next prompt.
   *
   * IT MUST NOT DESTROY A PLACED OBJECT. When a piece is placed, the image stops
   * being "the option" and becomes part of the picture — and this runs on the
   * next prompt, so destroying `this.option.image` unconditionally would delete
   * the object the child just put down, leaving only the second one on screen.
   * `placeObject` detaches the image (`option.image = null`) for exactly this
   * reason; the guard here is the belt to that braces.
   */
  clearOption(ctx) {
    if (!this.option) return;
    this.option.bobTween?.remove();
    if (ctx?.scene && this.option.image) ctx.scene.tweens.killTweensOf(this.option.image);
    this.option.disc?.destroy();
    this.option.shadow?.destroy();
    // Only the object still on offer is ours to destroy.
    if (this.option.image) this.option.image.destroy();
    this.option = null;
  }

  // ---------------------------------------------------------------------------
  // PLAY
  // ---------------------------------------------------------------------------
  installPlay(ctx) {
    const scene = ctx.scene;

    this.onPlayDown = (pointer) => {
      // The dev drag claims a gesture first, so tuning never fights the game.
      if (this.devDrag) return;
      if (this.phase !== 'playing' || this.drag) return;
      if (!this.option?.image) return;

      // Grab the object itself, or anywhere on its disc — a small cut-out is not
      // easy to catch otherwise.
      const onArt = this.hitsImage(this.option.image, pointer);
      const onDisc =
        Math.hypot(pointer.x - this.option.disc.x, pointer.y - this.option.disc.y) <=
        this.option.disc.radius + HIT_PAD;
      if (!onArt && !onDisc) return;

      const image = this.option.image;

      this.option.bobTween?.remove();
      this.option.bobTween = null;
      scene.tweens.killTweensOf(image);

      // Grow to TRUE size on pick-up, so what is under the finger is what lands.
      image.setScale(this.fullScaleFor(this.option.part));
      image.setDepth(900);

      // DELTA drag. The object has no rotated parent, but a delta keeps the grab
      // point stable whatever the preview scale was.
      this.drag = {
        image,
        startX: image.x,
        startY: image.y,
        pointerX: pointer.x,
        pointerY: pointer.y,
        moved: false,
      };

      this.phase = 'settling';
    };

    this.onPlayMove = (pointer) => {
      if (!this.drag) return;
      const { image, startX, startY, pointerX, pointerY } = this.drag;
      image.setPosition(startX + (pointer.x - pointerX), startY + (pointer.y - pointerY));
      this.drag.moved = true;
    };

    this.onPlayUp = () => {
      if (this.devDrag) return;
      if (!this.drag) return;

      const { image, moved } = this.drag;
      this.drag = null;

      // A tap that never moved is just a tap: settle back into the disc.
      if (!moved) {
        this.returnToOption(ctx);
        return;
      }

      // Which area was it dropped in? Judged on the object's CENTRE.
      const landedIn = this.areaAt(image.x, image.y);

      if (landedIn && landedIn.id === this.option.part.id) {
        this.placeObject(ctx, landedIn);
        return;
      }

      if (landedIn) {
        // The OTHER object's area: a real mistake.
        this.wrongArea(ctx, landedIn);
        return;
      }

      // Nowhere useful: no penalty. A child who let go in the wrong place has not
      // answered anything, and punishing it teaches them to fear the screen.
      this.returnToOption(ctx);
    };

    scene.input.on('pointerdown', this.onPlayDown);
    scene.input.on('pointermove', this.onPlayMove);
    scene.input.on('pointerup', this.onPlayUp);
  }

  /**
   * The area containing a point, or null.
   *
   * NEAREST-first when two overlap, so a drop centred on one zone can never
   * resolve to its neighbour because of insertion order — the same rule, and the
   * same reason, as scene 2's drop boxes.
   *
   * `dropPad` adds slack on top of the drawn zone, so a near miss still counts.
   */
  areaAt(x, y) {
    const pad = getPositions().dropPad || 0;

    let best = null;
    let bestDist = Infinity;

    for (const area of this.areas) {
      const dx = x - area.x;
      const dy = y - area.y;
      if (Math.abs(dx) > area.w / 2 + pad || Math.abs(dy) > area.h / 2 + pad) continue;

      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        best = area;
        bestDist = dist;
      }
    }

    return best;
  }

  hitsImage(image, pointer) {
    const b = image.getBounds?.();
    if (!b) return false;
    return (
      pointer.x >= b.left - HIT_PAD &&
      pointer.x <= b.right + HIT_PAD &&
      pointer.y >= b.top - HIT_PAD &&
      pointer.y <= b.bottom + HIT_PAD
    );
  }

  // Put the object back in the option circle at preview size, bobbing again.
  returnToOption(ctx) {
    const t = getPositions();
    if (!this.option?.image) {
      this.phase = 'playing';
      return;
    }

    const { image, x, y } = this.option;
    this.phase = 'settling';

    ctx.scene.tweens.add({
      targets: image,
      x,
      y,
      duration: Math.max(1, t.mistakeReturnMs),
      ease: 'Back.easeOut',
      onComplete: () => {
        this.applyOptionPreview(image, this.option.part, t);
        image.setDepth(32);
        this.phase = 'playing';
        if (t.optionBobPx > 0) {
          this.option.bobTween = ctx.scene.tweens.add({
            targets: image,
            y: y - t.optionBobPx,
            duration: Math.max(1, t.optionBobMs),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    });
  }

  /**
   * CORRECT: snap onto the placement, pulse it, and move on.
   *
   * The object becomes a permanent part of the picture: it keeps its full size
   * and its tuned rotation, so the finished portrait is exactly what was authored.
   */
  placeObject(ctx, area) {
    const t = getPositions();
    this.phase = 'settling';

    const part = this.option.part;
    const image = this.option.image;
    const slot = this.slotFor(part);

    // THE OPTION IS CONSUMED, BUT THE OBJECT IS NOT.
    //
    // The image becomes part of the picture, so it must be DETACHED from the
    // option before the next prompt calls clearOption() — otherwise that would
    // destroy the object the child just placed and only the second one would be
    // left on screen. The disc and shadow are decoration and go for good.
    const offer = this.option;
    offer.bobTween?.remove();
    offer.bobTween = null;
    ctx.scene.tweens.killTweensOf(image);

    offer.disc.destroy();
    offer.shadow.destroy();
    this.option = null;

    image.setScale(this.fullScaleFor(part));

    ctx.scene.tweens.add({
      targets: image,
      x: slot.x,
      y: slot.y,
      duration: Math.max(1, t.snapMs),
      ease: 'Back.easeOut',
      onComplete: () => {
        image.setDepth(10 + (part.z || 0));
        this.pop(ctx, image, t);
        this.flash(ctx, t.correctFlashColor, t.correctFlashAlpha, t.correctFlashMs, t.correctFlashHoldMs);
        this.advancePrompt(ctx, t);
      },
    });

    this.placed.push(area.slot);
    this.objects.push({ id: part.id, slot: area.slot, image, data: part });
  }

  // A short scale pulse, so the placement is acknowledged in place.
  pop(ctx, image, t) {
    const base = image.scaleX;
    ctx.scene.tweens.add({
      targets: image,
      scale: base * t.landPulseScale,
      duration: Math.max(1, t.landPulseMs),
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => image.setScale(base),
    });
  }

  /**
   * WRONG AREA: buzz, red flash, the area itself pulses red, and the object goes
   * back to the option circle. The prompt does NOT change — the child is asked
   * the same question again, and the miss is tallied for the run.
   */
  wrongArea(ctx, area) {
    const t = getPositions();
    this.mistakes += 1;
    this.phase = 'settling';

    this.flash(ctx, t.wrongFlashColor, t.wrongFlashAlpha, t.wrongFlashMs, t.wrongFlashHoldMs);
    this.playSound(ctx, 'wrong', 0.55);
    this.pulseArea(ctx, area, t);

    const image = this.option?.image;
    if (!image) {
      this.phase = 'playing';
      return;
    }

    // Shake about the object's own rotation, then settle exactly back on it, so a
    // rotated cut-out does not end up crooked.
    const base = degToRad(this.option.part.rotation);
    const shake = degToRad(t.mistakeShakeDeg);

    ctx.scene.tweens.add({
      targets: image,
      rotation: base + shake,
      duration: 60,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        image.setRotation(base);
        this.returnToOption(ctx);
      },
    });
  }

  // The area flashes red, so the child sees WHICH zone they hit — the screen-wide
  // flash alone does not say that.
  pulseArea(ctx, area, t) {
    const g = ctx.scene.add.graphics().setDepth(35);
    ctx.layer.add(g);

    g.fillStyle(t.wrongFlashColor, t.wrongAreaPulseAlpha);
    g.fillRoundedRect(area.x - area.w / 2, area.y - area.h / 2, area.w, area.h, 18);

    ctx.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: Math.max(1, t.wrongAreaPulseMs),
      ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  /**
   * Move to the next prompt, or finish the round.
   *
   * The beat between the two placements is deliberate: without it the second
   * object appears in the same frame the first one lands, and the two read as one
   * event.
   */
  advancePrompt(ctx, t) {
    const next = this.promptIndex + 1;

    if (next < this.entries.length) {
      this.schedule(Math.max(0, t.nextPromptMs), () => {
        this.clearOption(ctx);
        this.showPromptObject(ctx, t, next);
      });
      return;
    }

    this.finishRound(ctx, t);
  }

  // Both placed: hold on the finished portrait, play the success cue, hand over.
  finishRound(ctx, t) {
    this.phase = 'winning';
    ctx.setPrompt('');
    this.clearPrompt();

    // `pop2` — the success cue scenes 1 and 2 use, so a completed portrait sounds
    // like a completed anything.
    this.playSound(ctx, SUCCESS_SOUND, t.successPopVolume, t.successPopRate);
    this.flash(ctx, t.correctFlashColor, t.correctFlashAlpha * 1.6, t.correctFlashMs, t.correctFlashHoldMs);

    this.schedule(Math.max(0, t.winHoldMs), () => {
      this.cancelPending();
      // Misses ride along WITH the pass rather than asking for a retry: the
      // picture is finished, and re-running it would undo that.
      ctx.roundComplete({ correct: true, mistakes: this.mistakes || 0 });
    });
  }

  // A full-canvas colour flush, above the art but below the HUD.
  flash(ctx, colour, alpha, fadeMs, holdMs) {
    this.flashScreen(ctx, { colour, alpha, fadeMs, holdMs, depth: 45 });
  }

  // One-shot sound, wrapped: a key that is not in the manifest fails silently or
  // throws depending on the codec, and audio must never break a round.
  playSound(ctx, key, volume = 1, rate = 1) {
    try {
      const sound = ctx.scene.sound;
      if (!sound || !ctx.scene.cache.audio.exists(key)) return null;
      return sound.play(key, { volume, rate });
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // DEV — drag an area, write the position back
  // ---------------------------------------------------------------------------
  // Two jobs in dev:
  //   · drag an AREA to move where an object lands;
  //   · `showTargets` outlines both areas so their size can be judged.
  //
  // This is game 12's devPick / devDragMove / devCommit, over the placements
  // rather than the art.
  installDevDrag(ctx) {
    if (!import.meta.env.DEV) return;

    const scene = ctx.scene;

    this.onDevDown = (pointer) => {
      // Never start a tuning drag while the child's own drag is in flight.
      if (this.drag) return;

      // Grab the nearest area's centre.
      const hit = this.areas.find(
        (a) =>
          Math.abs(pointer.x - a.x) <= a.w / 2 + 8 &&
          Math.abs(pointer.y - a.y) <= a.h / 2 + 8
      );
      if (!hit) return;

      this.devDrag = {
        area: hit,
        dx: hit.x - pointer.x,
        dy: hit.y - pointer.y,
        moved: false,
      };
    };

    this.onDevMove = (pointer) => {
      if (!this.devDrag) return;
      const { area, dx, dy } = this.devDrag;
      area.x = pointer.x + dx;
      area.y = pointer.y + dy;
      this.devDrag.moved = true;
      this.drawDevTargets(this.ctx, getPositions(), true);
    };

    this.onDevUp = () => {
      if (!this.devDrag) return;
      const { area, moved } = this.devDrag;
      this.devDrag = null;

      if (!moved) return;

      const x = Math.round(area.x);
      const y = Math.round(area.y);
      const prefix = area.slot === 'B' ? 'slotB' : 'slotA';

      // Write the placement (what the scene reads) and the part's fallback x/y, so
      // the slider, the canvas and the paste readout all agree.
      TUNING.set({
        POSITION_ROUNDS: { [this.meta.id]: { [`${prefix}X`]: x, [`${prefix}Y`]: y } },
        POSITION_PARTS: { [area.id]: { x, y } },
      });
    };

    scene.input.on('pointerdown', this.onDevDown);
    scene.input.on('pointermove', this.onDevMove);
    scene.input.on('pointerup', this.onDevUp);
  }

  // The area outlines, shown when `showTargets` is on. Rebuilt in place while
  // dragging rather than allocated per frame.
  drawDevTargets(ctx, t, whileDragging = false) {
    if (!t?.showTargets) {
      this.targetG?.destroy?.();
      this.targetG = null;
      return;
    }

    if (!this.targetG?.active) {
      this.targetG = ctx.scene.add.graphics().setDepth(5);
      ctx.layer.add(this.targetG);
    }

    const g = this.targetG;
    g.clear();

    this.areas.forEach((area) => {
      g.lineStyle(2, t.targetColor, Math.min(1, t.targetAlpha * 4));
      g.strokeRect(area.x - area.w / 2, area.y - area.h / 2, area.w, area.h);
      g.lineStyle(1, t.targetColor, Math.min(1, t.targetAlpha * 3));
      g.beginPath();
      g.moveTo(area.x - 8, area.y);
      g.lineTo(area.x + 8, area.y);
      g.moveTo(area.x, area.y - 8);
      g.lineTo(area.x, area.y + 8);
      g.strokePath();
    });

    // While dragging, nothing else needs redrawing.
    if (whileDragging) return;
  }

  removeListeners() {
    const scene = this.ctx?.scene;
    if (scene?.input) {
      if (this.onPlayDown) scene.input.off('pointerdown', this.onPlayDown);
      if (this.onPlayMove) scene.input.off('pointermove', this.onPlayMove);
      if (this.onPlayUp) scene.input.off('pointerup', this.onPlayUp);
      if (this.onDevDown) scene.input.off('pointerdown', this.onDevDown);
      if (this.onDevMove) scene.input.off('pointermove', this.onDevMove);
      if (this.onDevUp) scene.input.off('pointerup', this.onDevUp);
    }
    this.onPlayDown = null;
    this.onPlayMove = null;
    this.onPlayUp = null;
    this.onDevDown = null;
    this.onDevMove = null;
    this.onDevUp = null;
    this.devDrag = null;
  }

  // ---------------------------------------------------------------------------
  // TUNING (live relayout)
  // ---------------------------------------------------------------------------
  // Moves what is on screen rather than rebuilding, so tuning never throws away
  // the round in progress.
  applyTuning(ctx) {
    const t = getPositions();
    if (!this.meta) return;

    const meta = getPositionRound(this.roundNumber);
    this.meta = meta;

    // Background.
    if (this.bg?.active) {
      this.bg
        .setPosition(meta.bgX, meta.bgY)
        .setScale((this.bgCover ?? 1) * (meta.bgScale ?? 1));
    }

    // Areas follow their placements; a dragged area keeps its live position.
    this.areas.forEach((area) => {
      if (this.devDrag?.area === area) return;
      const slot = this.slotFor(this.entries.find((e) => e.id === area.id) || {});
      const size = t.areaSizePx;
      area.x = slot.x;
      area.y = slot.y;
      area.w = slot.boxW > 0 ? slot.boxW : size;
      area.h = slot.boxH > 0 ? slot.boxH : size;
    });

    // The option disc follows its tuning.
    if (this.option?.disc?.active) {
      const W = SceneBase.widthOf(ctx.scene);
      const x = W * (t.optionXFrac ?? 0.5);
      const y = t.optionY;
      this.option.x = x;
      this.option.y = y;
      this.option.disc.setPosition(x, y).setRadius(t.optionRadius);
      this.option.disc.setStrokeStyle(t.optionDiscStrokeWidth, 0xffffff, t.optionDiscStrokeAlpha);
      this.option.disc.setFillStyle(0xffffff, t.optionDiscAlpha);
      this.option.shadow
        .setPosition(x, y + t.optionShadowDy)
        .setRadius(t.optionRadius);
      this.option.shadow.setFillStyle(0x000000, t.optionShadowAlpha);

      if (this.option.image?.active && !this.drag) {
        this.option.image.setPosition(x, this.option.image.y);
        this.applyOptionPreview(this.option.image, this.option.part, t);
      }
    }

    // Placed objects sit where the slots say.
    this.objects.forEach((obj) => {
      const part = this.entries.find((e) => e.id === obj.id);
      if (!part) return;
      obj.data = { ...part };
      const slot = this.slotFor(part);
      obj.image
        .setPosition(slot.x, slot.y)
        .setScale(this.fullScaleFor(part))
        .setRotation(degToRad(part.rotation))
        .setFlipX(!!part.flipX);
    });

    this.drawDevTargets(ctx, t);

    // The prompt is drawn by this scene (word by word, for the emphasis), so a
    // tuning change has to re-render it rather than only moving the hub's text.
    if (this.phase === 'playing' && this.entries[this.promptIndex]) {
      this.renderPrompt(this.entries[this.promptIndex]);
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function degToRad(deg) {
  return ((Number(deg) || 0) * Math.PI) / 180;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

// A finite number, or the fallback. Guards a tuning row that has not been
// re-published yet: `undefined` would place an object at NaN, where it exists but
// is never visible.
function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// A word without its punctuation, lowercased — so "inside" matches "inside,"
// and the emphasis still lands when a sentence ends on the marked word.
function stripPunctuation(word) {
  return String(word)
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}
