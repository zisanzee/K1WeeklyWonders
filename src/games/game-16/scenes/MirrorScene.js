// scenes/MirrorScene.js
// Scene 2 of 5 — "Mirror".
//
// THE ROUND:
//   1. The portrait is ALREADY THERE, drawn complete on the SOURCE side of the
//      mirror line (round 1: the left half; round 2: the top; round 3: the
//      top-left corner).
//   2. The tray along the bottom holds the three pieces that complete the
//      MIRRORED side — already shown mirrored, so a piece in the tray looks
//      exactly like it will look once it is placed. That is game 12's trick:
//      its tray item is built with the character's true transform, so the option
//      is never a lie about what will be placed.
//   3. The child drags a piece onto its spot on the mirrored side. Correct →
//      it snaps into the reflection and stays. Wrong socket → buzzer, red flash,
//      shake, back to the tray. Empty space → back to the tray, no penalty.
//   4. When all three pieces are down the two halves match, the finished pair is
//      held a beat, then the hub advances the round.
//
// HOW A PIECE IS MIRRORED — the one idea this file is built around:
// each draggable piece is a CONTAINER carrying the reflection
//
//     R(2φ) · S(1, -1)     (positioned at the mirror anchor)
//
// with the part's image inside it at the part's SOURCE-side offset. Because that
// matrix IS the reflection about a line at angle φ, the container renders the
// part exactly mirrored — for any axis angle, any part rotation and any scale —
// with no per-part trigonometry to get wrong.
//
// The consequence that makes placement trivial: the tray and the socket are THE
// SAME CONTAINER in two positions.
//
//   container at the anchor  → child renders at anchor + M·offset
//                            = the reflected point (i.e. PLACED)
//   container at a tray slot → child renders at traySlot - M·offset + M·offset
//                            = the tray slot (i.e. IN THE TRAY)
//
// So a drop is one tween. `trayAnchorPos()` is the only place that arithmetic
// lives, and the drop box is measured against where the child actually appears,
// never against the container.
//
// GEOMETRY lives in mirrorRounds.js; the tables live in tuning.js (so the dev
// panel can print the whole tuning file back for a one-paste save).
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';
import {
  getMirrorPart,
  getMirrorPartsFor,
  getMirrorRound,
  getScene2,
  setDevScope,
  TUNING,
} from '@/games/game-16/tuning';
import {
  reflectionTransform,
  sideOfLine,
  splitCanvas,
} from '@/games/game-16/mirrorRounds';

const CONFIG = SCENES.find((s) => s.id === 'mirror');

// Slack around a piece's bounds for a grab, in px. Game 12's HIT_PAD: the art is
// unpadded, so without slack only the visible pixels are grabbable.
const HIT_PAD = 12;

export default class MirrorScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });

    this.entries = []; // one per part: container + child, plus tray state
    this.dupGroup = null; // dev-only hint layer, see drawMirrorHints
    this.devDrag = null; // dev-only canvas tuning drag
    this.drag = null; // the piece currently being dragged
    this.boxes = null; // Map<partId, {x,y,w,h}> — the ONLY accept zones
    this.phase = 'playing'; // 'playing' | 'winning'
    this.mistakes = 0;
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  beginRound() {
    this.entries = [];
    this.dupGroup = null;
    this.devDrag = null;
    this.drag = null;
    this.boxes = null;
    this.phase = 'playing';
    // Per-ROUND misses, reported WITH the pass so the run's tally stays honest.
    this.mistakes = 0;
    this.pendingTimers = [];
    this.removeListeners();
  }

  destroy() {
    this.removeListeners();
    this.cancelPending();
    // A bob left running would keep tweening a destroyed image — a leak per round.
    this.entries.forEach((entry) => entry.bobTween?.remove());
    // Everything drawn is a child of ctx.layer, which the hub clears and destroys
    // wholesale, so no display object needs freeing by hand.
    this.entries = [];
    this.dupGroup = null;
    this.drag = null;
    super.destroy();
  }

  // A timer made with scene.time outlives this module (the hub destroys the
  // layer, not the clock), so a stray call would fire into a dead scene.
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
    // human refers to them ("round 3's axis").
    const roundNumber = round + 1;
    this.roundNumber = roundNumber;

    const t = getScene2();
    const meta = getMirrorRound(roundNumber);
    const parts = getMirrorPartsFor(roundNumber);

    this.meta = meta;
    this.anchor = { x: meta.axisX, y: meta.axisY };
    // The reflection matrix, resolved once per round. Everything mirror-related
    // reads it from here so the halves, the pieces and the boxes cannot disagree.
    this.refl = reflectionTransform(meta.axisDeg);

    // Keep the panel's part table on this round (game 12's setDevScope).
    setDevScope(roundNumber);

    // Order matters: the washes are the background, the static portrait sits on
    // the source half, the pieces go above both.
    this.drawHalves(ctx, t, meta);
    this.drawSockets(ctx, t, parts);
    this.drawStaticPortrait(ctx, parts, t);
    this.buildPieces(ctx, parts, t);

    if (t.showMirrorHints) this.drawMirrorHints(ctx, parts);
    this.repaintBoxes(t);

    ctx.setPrompt(this.promptFor());
    this.installPlay(ctx);
  }

  /**
   * THE PROMPT — the same sentence for all three rounds.
   *
   * It used to be per-round ("Move the pieces…", "Fill in the matching half…",
   * "Complete the picture across the line."), but the three rounds ask exactly the
   * same thing of the child: the only thing that changes is the ANGLE of the mirror
   * line, and that is visible on screen. Three phrasings for one instruction made
   * the round transition look like a different task when it was not — and a
   * 4-6 year old has to re-read a new sentence to find that out.
   *
   * One sentence, learned once, applies to all three.
   */
  promptFor() {
    return 'Complete the character by matching the other side.';
  }

  // THE TWO HALVES — the divider drawn as colour, not as a line.
  //
  // Each side gets a flat pastel wash and the EDGE WHERE THEY MEET is the axis.
  // There is deliberately no stroke: a child reads "this side / that side" from
  // the colour, and a thin line is easy to lose against the art.
  //
  // The fills are clipped to the canvas by splitCanvas(), because a rectangle
  // cannot be "half a canvas" when the axis is at 45°.
  drawHalves(ctx, t, meta) {
    const W = SceneBase.widthOf(ctx.scene);
    const H = SceneBase.heightOf(ctx.scene);

    const positive = ctx.scene.add.graphics().setDepth(-20);
    const negative = ctx.scene.add.graphics().setDepth(-20);
    ctx.layer.add(positive);
    ctx.layer.add(negative);

    this.halves = { positive, negative, W, H };
    this.paintHalves(t, meta);
  }

  // Repaints both washes from the current tuning and axis, so a live slider never
  // has to rebuild the round.
  //
  // WHICH SIDE IS RED is DERIVED: the source half is whichever side the round's
  // own parts sit on. So a part is always built on red and mirrored onto blue,
  // even if the axis is dragged past the portrait.
  paintHalves(t, meta) {
    const halves = this.halves;
    if (!halves?.positive?.active) return;

    const { positive, negative, W, H } = halves;
    positive.clear();
    negative.clear();

    const anchor = { x: meta.axisX, y: meta.axisY };
    const split = splitCanvas(anchor, meta.axisDeg, W, H);

    const sample = this.sourcePoint(meta, W, H);
    const sourceOnPositive = sideOfLine(sample, anchor, meta.axisDeg) >= 0;

    const sourceG = sourceOnPositive ? positive : negative;
    const mirrorG = sourceOnPositive ? negative : positive;
    const sourcePoly = sourceOnPositive ? split.positive : split.negative;
    const mirrorPoly = sourceOnPositive ? split.negative : split.positive;

    fillPolygon(sourceG, sourcePoly, t.sourceFillColor, t.sourceFillAlpha);
    fillPolygon(mirrorG, mirrorPoly, t.mirrorFillColor, t.mirrorFillAlpha);

    // An OPTIONAL line on top of the colour change. Off by default (width 0).
    if (meta.lineWidth > 0 && meta.lineAlpha > 0) {
      mirrorG.lineStyle(meta.lineWidth, t.lineColor, t.lineAlpha);
      drawPolygonPath(mirrorG, sourcePoly);
      mirrorG.strokePath();
    }
  }

  /**
   * A point on the SOURCE half: the mean of the round's part positions, i.e. the
   * portrait's centre of mass. Deriving it means the washes follow the parts when
   * an axis is dragged past them, instead of the scene claiming a part is on the
   * wrong side of the line.
   */
  sourcePoint(meta, W, H) {
    const rows = getMirrorPartsFor(meta.round);
    if (rows.length === 0) return { x: W / 2, y: H / 2 };
    const sum = rows.reduce(
      (acc, part) => ({ x: acc.x + part.x, y: acc.y + part.y }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / rows.length, y: sum.y / rows.length };
  }

  /**
   * THE PORTRAIT, drawn once, in position, on the source side.
   *
   * Static and non-interactive: it is the model the mirrored half has to match,
   * so it must never be draggable or hidden. Built from the same rows the pieces
   * are built from, so the two halves cannot describe different portraits.
   */
  drawStaticPortrait(ctx, parts, t) {
    this.staticImages = [];

    parts.forEach((part) => {
      const row = getMirrorPart(part.id);
      const key = this.textureFor(ctx, row);

      const image = ctx.scene.add
        .image(row.x, row.y, key)
        .setScale(row.scale)
        .setRotation(degToRad(row.rotation))
        .setFlipX(!!row.flipX)
        .setAlpha(clamp01((row.alpha ?? 1) * (t.portraitAlpha ?? 1)))
        .setDepth(10 + (row.z || 0));

      ctx.layer.add(image);
      this.staticImages.push({ id: row.id, image, row });
    });
  }

  // FAINT SOCKETS on the mirrored side, so the child can see where a piece goes.
  // Purely a hint, drawn under the pieces; the DROP BOX is what decides the
  // outcome, and this is deliberately a little smaller than it so a piece that
  // looks "just off" the disc can still be accepted.
  drawSockets(ctx, t, parts) {
    const g = ctx.scene.add.graphics().setDepth(8);
    ctx.layer.add(g);
    this.socketG = g;
    this.repaintSockets(ctx, t, parts.map((part) => getMirrorPart(part.id)));
  }

  sourceSize(ctx, row) {
    const key = this.textureFor(ctx, row);
    const src = ctx.scene.textures.get(key)?.getSourceImage?.();
    return { w: src?.width || 100, h: src?.height || 100 };
  }

  /**
   * Where a source part lands on the MIRRORED side, in canvas px.
   *
   * ONE function does this arithmetic, and the boxes, the sockets and the dev
   * hints all read it — so a drop can never be judged against a different point
   * from the one drawn on screen.
   */
  mirroredPoint(row) {
    return this.applyReflection({
      x: row.x + (row.dupDX || 0),
      y: row.y + (row.dupDY || 0),
    });
  }

  // Apply the round's reflection to a canvas point about the anchor:
  //   anchor + R(2φ)·S(1,-1)·(p - anchor)
  applyReflection(p) {
    const dx = p.x - this.anchor.x;
    const dy = p.y - this.anchor.y;
    const cos = Math.cos(this.refl.rotationRad);
    const sin = Math.sin(this.refl.rotationRad);
    const sx = dx * this.refl.scaleX;
    const sy = dy * this.refl.scaleY;
    return {
      x: this.anchor.x + cos * sx - sin * sy,
      y: this.anchor.y + sin * sx + cos * sy,
    };
  }

  // The vector a child's local offset becomes after the reflection. Used to place
  // the container so its child sits at a chosen canvas point.
  reflectOffset(local) {
    const cos = Math.cos(this.refl.rotationRad);
    const sin = Math.sin(this.refl.rotationRad);
    const sx = local.x * this.refl.scaleX;
    const sy = local.y * this.refl.scaleY;
    return { x: cos * sx - sin * sy, y: sin * sx + cos * sy };
  }

  /**
   * The container position that puts a piece's CENTRE at a canvas point.
   *
   * The container's transform maps its child's local offset to
   * `containerPos + M·offset`, so to have the child at `screen` the container
   * must sit at `screen - M·offset`. This is the whole tray/placed trick, and it
   * lives here so nothing else does that subtraction by hand.
   */
  containerPosFor(screen, localOffset) {
    const m = this.reflectOffset(localOffset);
    return { x: screen.x - m.x, y: screen.y - m.y };
  }

  /**
   * ONE PIECE = a reflected container plus its image, in the tray.
   *
   * The image is a child at the part's SOURCE-side offset, so the container's
   * reflection does all the mirroring. Scaling the CHILD (for the tray preview)
   * leaves the container transform — and therefore the mirroring — untouched,
   * which is what keeps a tray piece looking like the placed piece.
   */
  buildPieces(ctx, parts, t) {
    // A row centred on the canvas, `trayGapX` apart.
    const W = SceneBase.widthOf(ctx.scene);
    const count = parts.length;
    const startX = W / 2 - ((count - 1) * t.trayGapX) / 2;

    this.entries = [];

    parts.forEach((part, i) => {
      const row = getMirrorPart(part.id);
      const key = this.textureFor(ctx, row);
      const traySlot = { x: startX + i * t.trayGapX, y: t.trayY };

      // Local offset inside the container: the part's SOURCE position relative to
      // the anchor. This is the quantity the reflection turns into the mirrored
      // position, so it must be the source offset and nothing else.
      const local = { x: row.x - this.anchor.x, y: row.y - this.anchor.y };

      // THE TRAY DISC + shadow, so the option reads as floating on the scene.
      const shadow = ctx.scene.add
        .circle(traySlot.x, traySlot.y + t.trayShadowDy, t.trayBoxPx / 2, 0x000000, t.trayShadowAlpha)
        .setDepth(5);
      ctx.layer.add(shadow);

      const disc = ctx.scene.add
        .circle(traySlot.x, traySlot.y, t.trayBoxPx / 2, 0xffffff, t.trayDiscAlpha)
        .setStrokeStyle(t.trayDiscStrokeWidth, 0xffffff, t.trayDiscStrokeAlpha)
        .setDepth(6);
      ctx.layer.add(disc);

      // THE CONTAINER carries the reflection; the image lives inside it.
      const trayPos = this.containerPosFor(traySlot, local);
      const container = ctx.scene.add
        .container(trayPos.x, trayPos.y)
        .setRotation(this.refl.rotationRad)
        .setScale(this.refl.scaleX, this.refl.scaleY)
        .setDepth(20);
      ctx.layer.add(container);

      const image = ctx.scene.add
        .image(local.x, local.y, key)
        .setScale(row.scale)
        .setRotation(
          degToRad((row.rotation || 0) + (row.dupRotation || 0))
        )
        .setFlipX(!!row.flipX);
      container.add(image);

      const entry = {
        id: row.id,
        data: row,
        container,
        image,
        disc,
        shadow,
        local,
        traySlot,
        placed: false,
        bobTween: null,
      };
      this.entries.push(entry);

      this.applyPreview(entry, t);
      this.startBob(ctx, entry, t);
    });

    // A drop box per part, at the MIRRORED position — the only accept zones.
    this.boxes = new Map(
      parts.map((part) => {
        const row = getMirrorPart(part.id);
        return [part.id, this.computeBox(row, ctx)];
      })
    );
  }

  // The displayed size of a piece at FULL scale, ignoring the container's
  // reflection (which does not change size).
  fullSize(entry) {
    return {
      w: Math.abs(entry.image.width * entry.data.scale * (entry.data.dupScaleMul ?? 1)),
      h: Math.abs(entry.image.height * entry.data.scale * (entry.data.dupScaleMul ?? 1)),
    };
  }

  /**
   * Shrink a piece into its tray slot.
   *
   * Preview scale is a CEILING derived from the piece's own size, so a tall piece
   * and a wide piece both fit the disc and neither overflows it. Never ENLARGES,
   * so a small piece stays small next to a large one.
   */
  applyPreview(entry, t) {
    const full = this.fullSize(entry);
    const inner = Math.max(1, t.trayBoxPx - 2 * t.trayBoxInset);
    const fit = Math.min(inner / Math.max(full.w, 1), inner / Math.max(full.h, 1));
    const mul = Math.min(1, fit);

    entry.image.setScale(entry.data.scale * mul);

    // The container sits wherever the CHILD's centre needs to be under the tray
    // slot — recomputed against the scaled child, since scaling changes nothing
    // about the offset (the child's local position is unchanged).
    const pos = this.containerPosFor(entry.traySlot, entry.local);
    entry.container.setPosition(pos.x, pos.y);
    entry.previewMul = mul;
  }

  // Grow a piece to the size it will be PLACED at, so what is under the finger is
  // exactly what will land.
  applyFull(entry) {
    entry.image.setScale(entry.data.scale);
  }

  startBob(ctx, entry, t) {
    entry.bobTween?.remove();
    entry.bobTween = null;
    if (!t.trayBobPx) return;
    entry.bobTween = ctx.scene.tweens.add({
      targets: entry.container,
      y: entry.container.y - t.trayBobPx,
      duration: Math.max(1, t.trayBobMs),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * The accept zone for one part, centred on its MIRRORED position.
   *
   * Centred on the mirrored point (not the container) because that is where the
   * piece APPEARS; a box that disagreed with the picture would make a
   * right-looking drop register as wrong.
   *
   * SIZE, in order of preference:
   *   1. the part's own `boxW`/`boxH` (game 12's BOXES table, folded into the
   *      row) — the escape hatch for a PNG with transparent padding;
   *   2. a SQUARE of `boxSizeFrac` × the piece's LONGEST side.
   *
   * A square by default, and deliberately smaller than the art: an image's
   * bounds include its transparent margin, so a box taken from them is much
   * larger than the piece looks and neighbouring boxes overlap. That overlap is
   * exactly what makes a piece dropped dead-on its own spot land in a
   * neighbour's box and be judged wrong.
   */
  computeBox(row, ctx) {
    const t = getScene2();
    const target = this.mirroredPoint(row);
    const src = this.sourceSize(ctx, row);
    const mul = row.scale * (row.dupScaleMul ?? 1);

    const explicitW = Number(row.boxW) || 0;
    const explicitH = Number(row.boxH) || 0;

    // The longest side, so a tall part and a wide part get the same square.
    const auto = Math.max(src.w, src.h) * mul * t.boxSizeFrac;

    const w = Math.max(t.boxMinPx, explicitW > 0 ? explicitW : auto);
    const h = Math.max(t.boxMinPx, explicitH > 0 ? explicitH : auto);
    return { x: target.x, y: target.y, w, h };
  }

  /**
   * The box a release lands in, or null — the NEAREST box whose bounds contain
   * the point, not the first one found.
   *
   * The nearest-first rule is what makes an overlap harmless: if two boxes do
   * overlap, the drop resolves to the one the child actually aimed at. With
   * "first match wins", a piece dropped squarely on its own spot could resolve
   * to a neighbour purely because of the order boxes were inserted — the exact
   * "right spot, marked wrong" bug.
   *
   * `pad` is game 12's boxDropPad: a forgiving band so a near miss still counts.
   */
  boxAt(x, y, pad = 0) {
    if (!this.boxes) return null;

    let best = null;
    let bestDist = Infinity;

    for (const [id, box] of this.boxes.entries()) {
      const halfW = box.w / 2 + pad;
      const halfH = box.h / 2 + pad;
      const dx = x - box.x;
      const dy = y - box.y;
      if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) continue;

      // Distance from the box's CENTRE, so a centred drop always resolves to the
      // box it is centred on.
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        best = id;
        bestDist = dist;
      }
    }

    return best;
  }

  // Where a piece currently APPEARS on the canvas — its child's centre, through
  // the container transform. This is what a drop is judged on.
  pieceCentre(entry) {
    const pos = entry.container;
    const m = this.reflectOffset(entry.local);
    return { x: pos.x + m.x, y: pos.y + m.y };
  }

  textureFor(ctx, row) {
    const declared = row.textureKey;
    if (declared && ctx.scene.textures.exists(declared)) return declared;

    // A part added without a textureKey still finds its art by convention
    // (`crab1` → `s2Crab1`); if nothing matches we keep the declared key so
    // Phaser draws its own visible placeholder rather than nothing.
    const derived = `s2${row.id.charAt(0).toUpperCase()}${row.id.slice(1)}`;
    if (ctx.scene.textures.exists(derived)) return derived;

    return declared || derived;
  }

  // DEV AID: a ring at each mirrored target. Off by default; it exists so the
  // reflection can be judged before anything is placed.
  drawMirrorHints(ctx, parts) {
    const g = ctx.scene.add.graphics().setDepth(9);
    ctx.layer.add(g);

    parts.forEach((part) => {
      const row = getMirrorPart(part.id);
      if (!row.mirror) return;
      const p = this.mirroredPoint(row);
      g.lineStyle(2, 0xfacc15, 0.7);
      g.strokeCircle(p.x, p.y, 40);
    });
  }

  // ---------------------------------------------------------------------------
  // PLAY — grab a tray piece, drop it on its socket
  // ---------------------------------------------------------------------------
  // Game 12's onPointerDown / Move / Up. The dev drag claims a gesture first, so
  // a tuning session is never fought by the game.
  installPlay(ctx) {
    const scene = ctx.scene;

    this.onPlayDown = (pointer) => {
      if (this.devDrag) return;
      if (this.phase !== 'playing' || this.drag) return;

      // Only UNPLACED pieces are draggable, so a placed part is final.
      const entry = this.entries.find(
        (e) => !e.placed && (this.hitsPiece(e, pointer) || this.hitsDisc(e, pointer))
      );
      if (!entry) return;

      entry.bobTween?.remove();
      entry.bobTween = null;
      scene.tweens.killTweensOf(entry.container);

      // DELTA-based drag: record where the container and the pointer started and
      // move by the difference. Because the child sits at a rotated, flipped
      // offset inside the container, a grip measured in container space would be
      // wrong on every round; a pointer DELTA is correct on all of them.
      this.drag = {
        entry,
        startX: entry.container.x,
        startY: entry.container.y,
        pointerX: pointer.x,
        pointerY: pointer.y,
        moved: false,
      };

      this.applyFull(entry);
      entry.container.setDepth(900);
      entry.disc.setAlpha(0);
      entry.shadow.setAlpha(0);
    };

    this.onPlayMove = (pointer) => {
      if (!this.drag) return;
      const { entry, startX, startY, pointerX, pointerY } = this.drag;
      entry.container.setPosition(
        startX + (pointer.x - pointerX),
        startY + (pointer.y - pointerY)
      );
      this.drag.moved = true;
    };

    this.onPlayUp = () => {
      if (this.devDrag) return;
      if (!this.drag) return;

      const { entry, moved } = this.drag;
      this.drag = null;

      // A tap that never moved is just a tap — settle back into the tray.
      if (!moved) {
        this.returnToTray(entry);
        return;
      }

      // Judged on where the piece APPEARS, not where its container sits.
      const centre = this.pieceCentre(entry);
      const landedIn = this.boxAt(centre.x, centre.y, getScene2().dropPad);

      if (landedIn === entry.id) {
        this.placePiece(ctx, entry);
        return;
      }

      if (landedIn && landedIn !== entry.id) {
        this.wrongDrop(ctx, entry);
        return;
      }

      // Empty space: no penalty. A child who let go in the wrong place has not
      // answered anything, and punishing it teaches them to fear the screen edges.
      this.returnToTray(entry);
    };

    scene.input.on('pointerdown', this.onPlayDown);
    scene.input.on('pointermove', this.onPlayMove);
    scene.input.on('pointerup', this.onPlayUp);
  }

  // A grab also counts on the tray disc, so a small piece is not hard to catch.
  hitsDisc(entry, pointer) {
    if (!entry.disc?.active || entry.disc.alpha === 0) return false;
    return (
      Math.hypot(pointer.x - entry.disc.x, pointer.y - entry.disc.y) <=
      entry.disc.radius + HIT_PAD
    );
  }

  // The piece's VISUAL bounds on the canvas. The container holds a rotated and
  // y-inverted child, so its own bounds are not the piece's — the child's world
  // bounds are.
  hitsPiece(entry, pointer) {
    const b = entry.image.getBounds?.();
    if (!b) return false;
    return (
      pointer.x >= b.left - HIT_PAD &&
      pointer.x <= b.right + HIT_PAD &&
      pointer.y >= b.top - HIT_PAD &&
      pointer.y <= b.bottom + HIT_PAD
    );
  }

  // Back into the tray at preview size, bobbing again.
  returnToTray(entry) {
    const t = getScene2();
    this.ctx.scene.tweens.add({
      targets: entry.container,
      x: this.containerPosFor(entry.traySlot, entry.local).x,
      y: this.containerPosFor(entry.traySlot, entry.local).y,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.applyPreview(entry, t);
        entry.container.setDepth(20);
        entry.disc.setAlpha(1);
        entry.shadow.setAlpha(1);
        this.startBob(this.ctx, entry, t);
      },
    });
  }

  /**
   * CORRECT: the container moves to the ANCHOR, which — by the transform — puts
   * the child exactly on the mirrored point. No separate "reveal" is needed: the
   * piece the child was holding IS the mirrored piece.
   */
  placePiece(ctx, entry) {
    if (this.phase !== 'playing') return;
    const t = getScene2();

    entry.placed = true;
    entry.bobTween?.remove();
    entry.bobTween = null;
    ctx.scene.tweens.killTweensOf(entry.container);

    this.applyFull(entry);

    // The disc and shadow belong to the tray; fade them out.
    ctx.scene.tweens.add({
      targets: [entry.disc, entry.shadow],
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
    });

    ctx.scene.tweens.add({
      targets: entry.container,
      x: this.anchor.x,
      y: this.anchor.y,
      duration: Math.max(1, t.snapMs),
      ease: 'Back.easeOut',
      onComplete: () => {
        entry.container.setDepth(10 + (entry.data.z || 0));
        this.pop(ctx, entry, t);
        this.maybeFinishRound(ctx, t);
      },
    });

    this.playSound(ctx, 'pop2', 0.7);
    this.flash(ctx, t.correctFlashColor, t.correctFlashAlpha, t.correctFlashMs, t.correctFlashHoldMs);
  }

  // A short scale pulse on the CHILD, so the placement is acknowledged in place
  // without disturbing the container's reflection.
  pop(ctx, entry, t) {
    const full = entry.data.scale;
    ctx.scene.tweens.add({
      targets: entry.image,
      scale: full * t.landPulseScale,
      duration: Math.max(1, t.landPulseMs),
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => entry.image.setScale(full),
    });
  }

  // WRONG SOCKET: shake, red flash, buzzer, back to the tray. The round does not
  // advance and no placed piece is disturbed; the miss is tallied for the run.
  wrongDrop(ctx, entry) {
    const t = getScene2();
    this.mistakes = (this.mistakes || 0) + 1;

    this.flash(ctx, t.wrongFlashColor, t.wrongFlashAlpha, t.wrongFlashMs, t.wrongFlashHoldMs);
    this.playSound(ctx, 'wrong', 0.5);

    // Shake the CHILD, positively and negatively about its own rotation, then
    // settle exactly back on it.
    const base = degToRad((entry.data.rotation || 0) + (entry.data.dupRotation || 0));
    const shake = degToRad(t.wrongShakeDeg);

    ctx.scene.tweens.add({
      targets: entry.image,
      rotation: base + shake,
      duration: 60,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        entry.image.setRotation(base);
        this.returnToTray(entry);
      },
    });
  }

  // All three placed: hold on the finished pair, then hand over.
  maybeFinishRound(ctx, t) {
    if (this.entries.length === 0) return;
    if (!this.entries.every((e) => e.placed)) return;

    this.phase = 'winning';
    // Clearing the prompt stops the line as a side effect, and `stopVoice` is
    // called explicitly too because this scene holds for `winHoldMs` before it
    // reports — the question must not still be reading out over the win.
    ctx.setPrompt('');
    ctx.stopVoice?.();

    const flashMs = t.correctFlashMs * 2 + t.correctFlashHoldMs;
    const holdMs = Math.max(t.winHoldMs, flashMs + 200);

    this.schedule(holdMs, () => {
      this.cancelPending();
      // The misses ride along WITH the pass rather than asking for a retry:
      // re-running the round would throw away the pieces already placed.
      ctx.roundComplete({ correct: true, mistakes: this.mistakes || 0 });
    });
  }

  // A full-canvas colour flush, above the art but below the HUD.
  flash(ctx, colour, alpha, fadeMs, holdMs) {
    this.flashScreen(ctx, { colour, alpha, fadeMs, holdMs, depth: 45 });
  }

  // One-shot sound, wrapped: a key that is not in the manifest fails silently or
  // throws depending on the codec, and audio must never break a round.
  playSound(ctx, key, volume = 1) {
    try {
      const sound = ctx.scene.sound;
      if (!sound || !ctx.scene.cache.audio.exists(key)) return null;
      return sound.play(key, { volume });
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // DEV — on-canvas tuning drag (game 12's devPick / devDragMove / devCommit)
  // ---------------------------------------------------------------------------
  // Purely a tuning aid: grab the STATIC portrait, drop it, and the new x/y is
  // written back into the kit so the slider and the copy-paste readout agree.
  // Gated on import.meta.env.DEV, so it cannot reach a player.
  installDevDrag(ctx) {
    if (!import.meta.env.DEV) return;

    const scene = ctx.scene;

    this.onDevDown = (pointer) => {
      // The play drag and this listen to the SAME pointer, so each has to stay
      // out of the other's way or one gesture does both. Rule: this takes a
      // STATIC portrait image, which the child can never drag.
      if (this.drag) return;
      if (this.phase !== 'playing') return;

      const hit = [...(this.staticImages || [])]
        .reverse()
        .find((item) => this.hitsStatic(item, pointer));
      if (!hit) return;

      this.devDrag = {
        item: hit,
        dx: hit.image.x - pointer.x,
        dy: hit.image.y - pointer.y,
        moved: false,
      };
      hit.image.setDepth(999);
    };

    this.onDevMove = (pointer) => {
      if (!this.devDrag) return;
      const { item, dx, dy } = this.devDrag;
      item.image.setPosition(pointer.x + dx, pointer.y + dy);
      this.devDrag.moved = true;
    };

    this.onDevUp = () => {
      if (!this.devDrag) return;
      const { item, moved } = this.devDrag;
      this.devDrag = null;

      item.image.setDepth(10 + (item.row.z || 0));
      if (!moved) return;

      // Write back through the kit — the table the panel and the formatter both
      // read, so there is no third copy to keep in step.
      TUNING.set({
        MIRROR_PARTS: {
          [item.id]: { x: Math.round(item.image.x), y: Math.round(item.image.y) },
        },
      });

      // Keep our own row in step so a second drag starts from the committed
      // position rather than the authored one.
      item.row = { ...item.row, x: Math.round(item.image.x), y: Math.round(item.image.y) };
    };

    scene.input.on('pointerdown', this.onDevDown);
    scene.input.on('pointermove', this.onDevMove);
    scene.input.on('pointerup', this.onDevUp);
  }

  hitsStatic(item, pointer) {
    const b = item.image?.getBounds?.();
    if (!b) return false;
    return (
      pointer.x >= b.left - HIT_PAD &&
      pointer.x <= b.right + HIT_PAD &&
      pointer.y >= b.top - HIT_PAD &&
      pointer.y <= b.bottom + HIT_PAD
    );
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
  // The panel calls this on every slider move. It must MOVE existing objects
  // rather than rebuild, or tuning would throw away the round in progress.
  applyTuning(ctx) {
    const t = getScene2();
    if (!this.meta) return;

    const roundMeta = getMirrorRound(this.roundNumber);
    this.meta = roundMeta;
    this.anchor = { x: roundMeta.axisX, y: roundMeta.axisY };
    this.refl = reflectionTransform(roundMeta.axisDeg);

    // The waters and the reflection must always be recomputed TOGETHER: moving
    // one without the other leaves the pieces mirrored about a different axis
    // from the one the colour boundary shows, which reads as a mirroring bug.
    this.paintHalves(t, roundMeta);

    const rows = getMirrorPartsFor(this.roundNumber);
    const W = SceneBase.widthOf(ctx.scene);
    const count = this.entries.length;
    const startX = W / 2 - ((count - 1) * t.trayGapX) / 2;

    // The tray moved, so every box moves with it.
    this.boxes = new Map(
      rows.map((row) => [row.id, this.computeBox(row, ctx)])
    );

    this.entries.forEach((entry, i) => {
      const row = rows.find((r) => r.id === entry.id);
      // A part being dragged keeps its live position until the drop.
      if (row && this.devDrag?.item?.id !== entry.id) entry.data = { ...row };

      entry.local = {
        x: entry.data.x - this.anchor.x,
        y: entry.data.y - this.anchor.y,
      };
      entry.traySlot = { x: startX + i * t.trayGapX, y: t.trayY };

      // The container's transform follows the axis.
      entry.container
        .setRotation(this.refl.rotationRad)
        .setScale(this.refl.scaleX, this.refl.scaleY);

      // The child's own transform follows the row.
      entry.image
        .setPosition(entry.local.x, entry.local.y)
        .setRotation(
          degToRad((entry.data.rotation || 0) + (entry.data.dupRotation || 0))
        )
        .setFlipX(!!entry.data.flipX);

      if (entry.placed) {
        // Placed: the container belongs at the anchor.
        entry.container.setPosition(this.anchor.x, this.anchor.y);
        this.applyFull(entry);
        entry.disc.setAlpha(0);
        entry.shadow.setAlpha(0);
      } else if (this.drag?.entry !== entry) {
        // In the tray at the (possibly moved) slot.
        this.applyPreview(entry, t);
      }

      // The discs follow the tray.
      if (entry.disc?.active) {
        entry.disc.setPosition(entry.traySlot.x, entry.traySlot.y).setRadius(t.trayBoxPx / 2);
        entry.disc.setStrokeStyle(t.trayDiscStrokeWidth, 0xffffff, t.trayDiscStrokeAlpha);
        entry.disc.setFillStyle(0xffffff, entry.placed ? 0 : t.trayDiscAlpha);
      }
      if (entry.shadow?.active) {
        entry.shadow
          .setPosition(entry.traySlot.x, entry.traySlot.y + t.trayShadowDy)
          .setRadius(t.trayBoxPx / 2);
        entry.shadow.setFillStyle(0x000000, entry.placed ? 0 : t.trayShadowAlpha);
      }
    });

    // The static portrait and the sockets follow their rows.
    (this.staticImages || []).forEach((item) => {
      const row = rows.find((r) => r.id === item.id);
      if (!row) return;
      item.row = { ...row };
      item.image
        .setPosition(row.x, row.y)
        .setScale(row.scale)
        .setRotation(degToRad(row.rotation))
        .setFlipX(!!row.flipX)
        .setAlpha(clamp01((row.alpha ?? 1) * (t.portraitAlpha ?? 1)))
        .setDepth(10 + (row.z || 0));
    });

    this.repaintSockets(ctx, t, rows);
    this.repaintBoxes(t);
  }

  /**
   * DEV: outline every drop box, so a piece's box can be judged against the art
   * and against its neighbours.
   *
   * This is the tool for the "right spot, still marked wrong" problem: the boxes
   * are the ONLY thing that decides a drop, so seeing them is the difference
   * between tuning and guessing. Gated on the `showBoxes` toggle.
   */
  repaintBoxes(t) {
    if (!import.meta.env.DEV) return;

    // Create on demand: the overlay costs nothing while the toggle is off.
    if (!t.showBoxes) {
      this.boxG?.destroy?.();
      this.boxG = null;
      return;
    }

    if (!this.boxG?.active) {
      this.boxG = this.ctx.scene.add.graphics().setDepth(950);
      this.ctx.layer.add(this.boxG);
    }

    const g = this.boxG;
    g.clear();
    if (!this.boxes) return;

    // A drop is judged with `dropPad` slack, so that is the outline worth seeing.
    const pad = t.dropPad || 0;

    for (const [id, box] of this.boxes.entries()) {
      const entry = this.entries.find((e) => e.id === id);
      const colour = entry?.placed ? 0x22c55e : 0x38bdf8;
      g.lineStyle(2, colour, 0.9);
      g.strokeRect(box.x - box.w / 2 - pad, box.y - box.h / 2 - pad, box.w + pad * 2, box.h + pad * 2);
      // A cross at the centre: a correct drop resolves to the NEAREST centre, so
      // that point is what the child has to hit.
      g.lineStyle(1, colour, 0.6);
      g.beginPath();
      g.moveTo(box.x - 6, box.y);
      g.lineTo(box.x + 6, box.y);
      g.moveTo(box.x, box.y - 6);
      g.lineTo(box.x, box.y + 6);
      g.strokePath();
    }
  }

  /**
   * Repaint the socket discs.
   *
   * Sized from the DROP BOX (`socketSizeMul` × the box's half-size), not from the
   * raw art, so the hint can never promise a bigger target than the box actually
   * accepts. `showBoxes` outlines the real thing if the two need comparing.
   */
  repaintSockets(ctx, t, rows) {
    const g = this.socketG;
    if (!g?.active) return;
    g.clear();
    if (t.socketAlpha <= 0) return;

    rows.forEach((row) => {
      const target = this.mirroredPoint(row);
      const box = this.computeBox(row, ctx);
      const r = Math.max(8, (Math.max(box.w, box.h) / 2) * t.socketSizeMul);
      g.fillStyle(0xffffff, t.socketAlpha);
      g.fillCircle(target.x, target.y, r);
    });
  }

  // The dev drag is installed once per mount, after the portrait exists.
  mount(ctx, round) {
    super.mount(ctx, round);
    this.installDevDrag(ctx);
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

// Fill a polygon Phaser can draw. An empty polygon (the axis missing the canvas
// entirely) is a no-op rather than an error.
function fillPolygon(g, poly, colour, alpha) {
  if (!poly || poly.length < 3 || alpha <= 0) return;
  g.fillStyle(colour, alpha);
  drawPolygonPath(g, poly);
  g.fillPath();
}

function drawPolygonPath(g, poly) {
  if (!poly || poly.length < 3) return;
  g.beginPath();
  g.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i += 1) g.lineTo(poly[i].x, poly[i].y);
  g.closePath();
}
