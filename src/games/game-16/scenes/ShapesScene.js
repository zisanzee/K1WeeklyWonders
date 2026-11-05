// scenes/ShapesScene.js
// Scene 1 of 5 — "Shapes" (the factory).
//
// THE ROUND:
//   1. The robot ROLLS IN (a 36-frame animation) at the start of the round.
//   2. The slot reel on its chest spins and lands on a CLUE — "3 corners",
//      "no corners", "4 equal sides", "4 corners".
//   3. When the roll AND the reel have both finished, the four shape options fade
//      in and the prompt appears. Nothing is shown or asked before that.
//   4. The child drags the matching shape onto the belt.
//   5. The belt carries it off to the RIGHT, out of the screen.
//   6. The next round starts and the robot rolls in again.
//
// THE LAST ROUND WANTS TWO SHAPES. "4 corners" is satisfied by BOTH the square
// and the rectangle, and the prompt becomes "Put 2 shapes on the belt." The child
// places them one at a time; the belt only runs once both are on.
//
// THE PROMPT IS GENERIC ON PURPOSE ("Put the shape on the belt."). The CLUE holds
// the information, so a child who can read but does not know what a corner is
// cannot shortcut the question.
//
// Art: a full-bleed workshop background, a looping conveyor, and the robot. The
// shapes are drawn PROCEDURALLY, so no art is needed and the outline, palette and
// size are tuning numbers.
//
// TWO HARD-WON RULES LIVE HERE, both from bugs that were invisible in code:
//
//   • The belt HOLDS its position between rounds. Its scroll offset is parked in
//     the hub's run-level `sceneState` (which survives remounts) and re-applied on
//     create, so the pattern does not snap back at every round change.
//
//   • One offset drives the shape AND the belt (see update()). Two independent
//     rates make the shape skate over a belt moving at a different pace.
import SceneBase from '@/games/game-16/scenes/SceneBase';
import { SCENES } from '@/games/game-16/scenes';
import { IMAGES, animationFrames, animationStill, frameKey } from '@/games/game-16/assets';
import { getScene1 } from '@/games/game-16/tuning';
import { buildReel, buildRounds, isCorrect } from '@/games/game-16/rounds';

const CONFIG = SCENES.find((s) => s.id === 'shapes');

// The round's phase. Explicit rather than a pile of booleans: a drag must not be
// possible while the robot is still rolling, and the send-off must not be
// interruptible.
const PHASE = {
  ROLLING: 'rolling', // robot animation playing — nothing else on screen
  PLAYING: 'playing', // options on the shelf, waiting for a drag
  SENDING: 'sending', // chosen option riding the belt off screen
  WRONG: 'wrong', // wrong option on the belt: red flash, then the same round again
  // Between placing the first of a TWO-shape round and placing the second. The
  // belt is held, the placed shape waits on it, and dragging continues.
  WAITING: 'waiting',
};

// Key in the hub's run-level sceneState where the belt's travel is parked.
const BELT_STATE_KEY = 'beltTotalPx';

// Key in the same state object for this run's shuffled round order.
const ORDER_STATE_KEY = 'shapesRoundOrder';

// Local, so this module needs no Phaser or utility import for one expression.
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export default class ShapesScene extends SceneBase {
  constructor() {
    super({ id: CONFIG.id, accent: CONFIG.color });

    this.bg = null;
    this.belt = null;
    this.robot = null;
    this.animKey = null; // the created Phaser animation key
    this.options = []; // [{ data, container, homeX, homeY, size }]
    this.dragging = null;
    this.phase = PHASE.ROLLING;
    this.roundData = null;
    this.slot = null; // the slot-machine window on the robot's chest
    this.ready = { roll: false, slot: false }; // see maybeReveal()
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  beginRound() {
    // All art handles are rebuilt per mount; drop the old ones so a stale sprite
    // can never survive a round change.
    this.bg = null;
    this.belt = null;
    this.robot = null;
    this.options = [];
    this.dragging = null;
    this.phase = PHASE.ROLLING;
    this.roundActive = true;
    this.slot = null;

    // THE TWO-SHAPE ROUND'S SLOTS. Two fixed places on the belt, each of which may
    // hold one shape. A shape goes to the first FREE slot, so the pair sits apart
    // and both stay visible until the round resolves. Empty until the round asks
    // for two shapes.
    this.slots = [];
    this.placed = [];
    // The round opens only when BOTH intros have finished: the robot's roll and
    // the slot machine's spin. Tracking them separately means re-tuning either
    // duration cannot leave the round stuck waiting for one that already ended.
    this.ready = { roll: false, slot: false };

    // The ride: `null` until an option lands on the belt. `sendOffset` is the one
    // number that drives both the option's x and the belt's texture scroll, so
    // they can never drift apart.
    this.ride = null;
    this.sendOffset = 0;
  }

  // Run-level state that must OUTLIVE a remount. The hub owns the object, so a
  // new scene instance (which every round gets) still sees the same values.
  get state() {
    return this.ctx?.sceneState ?? {};
  }

  // WHICH SHAPE THIS ROUND ASKS FOR — decided ONCE for the whole scene, not per
  // round.
  //
  // "The answer never repeats across the three rounds" is a property of the SET
  // of rounds, so it cannot be decided by a function that only sees one round.
  // Generate the whole plan on the first round, park it in run-level state, and
  // every later round (including a dev jump backwards) reads its slot from it —
  // so a remount cannot silently re-roll the answer.

  destroy() {
    // Park the belt's travel before the instance is thrown away, or the next
    // round rebuilds the strip at offset 0 and the pattern snaps back.
    if (this.ctx && Number.isFinite(this.beltTotalPx)) {
      this.state[BELT_STATE_KEY] = this.beltTotalPx;
    }

    this.roundActive = false;
    this.cancelPending();
    this.stopSlot();
    // A whirr left running would keep playing over the next round's roll.
    this.stopSlotSound();

    // The reel is a child of ctx.layer, so the hub's tear-down frees it. Nothing to
    // do here — kept as a note that this used to need explicit destruction when
    // the reel lived outside the layer.

    this.slot = null;

    this.bg = null;
    this.belt = null;
    this.robot = null;
    this.options = [];
    this.dragging = null;
    this.ride = null;
    super.destroy();
  }

  // Timers created with scene.time must be cancelled explicitly: the hub destroys
  // THIS layer but the clock keeps running, so a stray delayedCall would fire
  // into a dead scene and (worst case) advance a round twice.
  cancelPending() {
    (this.pendingTimers || []).forEach((t) => t.remove(false));
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
    const t = getScene1();
    this.pendingTimers = [];
    // THE RUN'S ROUND ORDER, generated ONCE and parked in run-level state.
    //
    // The first three rounds are shuffled, so they must not be re-shuffled on
    // every mount — a retry, or any remount, has to replay the SAME clue or the
    // child would see a different question for a round they just failed. The hub's
    // `sceneState` survives remounts for exactly this kind of thing.
    if (!this.state[ORDER_STATE_KEY]) this.state[ORDER_STATE_KEY] = buildRounds();
    const order = this.state[ORDER_STATE_KEY];
    this.roundData = order[clamp(round, 0, order.length - 1)];
    // Shapes already placed on the belt this round, for the two-shape round.
    this.placed = [];
    this.onBelt = [];

    // Background → belt → robot, in that order, so the robot reads as standing
    // in front of the belt but behind the options.
    this.bg = this.addCoverImage(ctx, IMAGES.s1Background ? 's1Background' : null, {
      offsetXFrac: t.bgOffsetXFrac,
      offsetYFrac: t.bgOffsetYFrac,
      alpha: t.bgAlpha,
    });

    this.belt = this.addLoopingStrip(ctx, IMAGES.s1Conveyor ? 's1Conveyor' : null, {
      yFrac: t.beltYFrac,
      heightFrac: t.beltHeightFrac,
      alpha: t.beltAlpha,
      overlap: t.beltOverlap,
    });

    // Restore where the belt stopped last round, BEFORE anything is drawn on top
    // of it. Without this the strip starts at 0 and visibly jumps on frame one.
    const parked = this.state[BELT_STATE_KEY];
    this.beltTotalPx = Number.isFinite(parked) ? parked : 0;
    if (this.belt) this.scrollStripByScreenPx(this.belt, this.beltTotalPx);

    this.buildRobot(ctx, t);
    // The slot machine starts WITH the roll, on the robot's chest, so the two
    // intros overlap instead of the child waiting through them one at a time.
    this.startSlot(ctx, t);
    this.startRoll(ctx, t);

    // NOTHING is asked until BOTH the roll and the reel have finished — the
    // prompt is set in revealOptions(). Emptying it here also covers a remount,
    // where the hub's previous prompt would otherwise still be on screen.
    ctx.setPrompt('');
  }

  // The robot sprite, anchored by its FEET to the belt's top edge.
  buildRobot(ctx, t) {
    const frames = animationFrames(t.rollAnimKey);
    if (frames.length === 0) return;

    const still = animationStill(t.rollAnimKey);
    const src = ctx.scene.textures.get(still)?.getSourceImage();
    if (!src?.height) return;

    // SceneBase.widthOf/heightOf, NOT scene.width/height — a Phaser scene has no
    // such properties, and reading them yields undefined → NaN coordinates.
    const W = SceneBase.widthOf(ctx.scene);
    const H = SceneBase.heightOf(ctx.scene);
    const drawnH = H * t.charHeightFrac;
    const scale = drawnH / src.height;
    const beltTop = H * t.beltYFrac - (H * t.beltHeightFrac) / 2;

    this.robot = ctx.scene.add
      .sprite(W * t.charXFrac, beltTop - H * t.charBeltGapFrac, still)
      // Origin (0.5, 1): the anchor is the BOTTOM CENTRE (the feet), so the gap
      // is measured from the contact point rather than the sprite's middle.
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setAlpha(t.charAlpha)
      .setDepth(t.charDepth);

    ctx.layer.add(this.robot);
    this.robotScale = scale;
  }

  // Registers (once per scene instance) and plays the roll animation.
  startRoll(ctx, t) {
    const frames = animationFrames(t.rollAnimKey);
    if (!this.robot || frames.length === 0) {
      // No frames → do not wait on the robot; the reel still decides when the
      // round opens, so this only clears one of the two flags.
      this.ready.roll = true;
      this.maybeReveal(ctx, t);
      return;
    }

    // One animation key per rate, so changing rollFps in the panel does not
    // collide with an animation already registered at the old rate.
    const key = `${t.rollAnimKey}-${t.rollFps}`;
    if (!ctx.scene.anims.exists(key)) {
      ctx.scene.anims.create({
        key,
        frames: frames.map((f) => ({ key: f.key })),
        frameRate: t.rollFps,
        repeat: 0,
      });
    }
    this.animKey = key;

    this.phase = PHASE.ROLLING;
    this.robot.once('animationcomplete', () => {
      // Settle on the LAST frame, so the pose matches the end of the roll instead
      // of snapping back to frame 0.
      this.robot.anims.stop();
      const last = frames[frames.length - 1];
      if (ctx.scene.textures.exists(last.key)) this.robot.setTexture(last.key);

      this.schedule(t.rollHoldMs, () => {
        // The hold is a BEAT, not a gate: it must not block on the reel, which
        // may already have finished. maybeReveal decides.
        this.ready.roll = true;
        this.maybeReveal(ctx, getScene1());
      });
    });
    this.robot.play(key);
  }

  // Opens the round once BOTH intros are done.
  //
  // Two independent durations mean the shorter one can finish first, and either
  // could be re-tuned to be the longer one at any time — so they are tracked
  // separately rather than chained. Whichever finishes last opens the round.
  maybeReveal(ctx, t) {
    if (this.phase !== PHASE.ROLLING) return;
    if (!this.ready.roll || !this.ready.slot) return;
    this.revealOptions(ctx, t);
  }

  // FAINT DROP-ZONE HIGHLIGHTS on the belt — THESE ARE THE SLOTS.
  //
  // One zone where a single shape should go, two when the round wants a pair. They
  // are not decoration: a dropped shape ALWAYS comes to rest in one of them, so
  // what the child sees highlighted is exactly where their shape will end up.
  //
  // ONE SOURCE OF TRUTH: the positions come from `beltSlots()`, the same function
  // `parkOnBelt` seats into. Duplicating the maths here is how the hint and the
  // snap drift apart, and then the highlight lies about where the shape goes.
  //
  // The zones are REBUILT (not just created) whenever a shape is seated, so an
  // occupied slot can be drawn differently and two zones can never look available
  // when only one is.
  buildDropZones(ctx, t) {
    const scene = ctx.scene;
    const W = SceneBase.widthOf(scene);

    const count = this.roundData?.count || 1;

    // THE ZONE MUST BE BIG ENOUGH TO HOLD THE SHAPE, or the highlight lies: a shape
    // whose corners spill past its slot does not look "in place".
    //
    // Derived from the option SIZE (the shape's own drawn width) rather than from an
    // independent radius, so the two cannot drift apart when `option size` is
    // retuned. The `dropZoneRadiusFrac` value is kept as a FLOOR, so a deliberately
    // tight zone is still possible.
    const shapeSize = W * t.optionSizeFrac;
    const fitsShape = (shapeSize / 2) * (t.dropZoneFitMul ?? 1.16);
    const radius = Math.max(W * t.dropZoneRadiusFrac, fitsShape);

    // Seed the slot geometry before the first drop, so the highlights and the later
    // snaps are computed from the same numbers.
    if (count > 1 && this.slots.length === 0) this.slots = this.beltSlots(t);

    // A single-shape round has one implicit slot at the belt's middle.
    const slots =
      count > 1
        ? this.slots
        : [{ x: W * t.dropXFrac, y: SceneBase.heightOf(scene) * t.beltYFrac + SceneBase.heightOf(scene) * t.dropYOffsetFrac }];

    // Reuse the graphics object across rebuilds — a slider drag or a second drop
    // must not leak a Graphics per call.
    if (!this.dropZones?.active) {
      this.dropZones = scene.add.graphics().setDepth(t.slotDepth - 1);
      ctx.layer.add(this.dropZones);

      // A gentle breathe, so the zones read as "somewhere to put it" rather than as
      // part of the painted set. On the OBJECT, so a rebuild keeps it running.
      if (t.dropZonePulseAlpha > 0) {
        this.dropZoneTween = scene.tweens.add({
          targets: this.dropZones,
          alpha: { from: 1 - t.dropZonePulseAlpha, to: 1 },
          duration: Math.max(1, t.dropZonePulseMs),
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      }
    }

    const g = this.dropZones;
    const occupied = new Set((this.onBelt ?? []).map((o) => o.slotIndex));

    g.clear();
    slots.forEach((s, i) => {
      // AN OCCUPIED SLOT FADES BACK, so the child can see at a glance which space
      // they still have. It is not removed — the shape is sitting in it, and an
      // outline that vanished would leave the shape looking like it was nowhere.
      const stillOpen = !occupied.has(i);
      const alpha = stillOpen ? t.dropZoneAlpha : t.dropZoneAlpha * (t.dropZoneOccupiedAlpha ?? 0.4);

      g.fillStyle(t.dropZoneColor, alpha);
      g.fillCircle(s.x, s.y, radius);

      // A ring around an OPEN slot, so it reads as a target to aim at rather than a
      // wash on the belt. Only on open slots: a filled one already has a shape in it.
      if (stillOpen && t.dropZoneRingWidth > 0) {
        g.lineStyle(t.dropZoneRingWidth, t.dropZoneColor, Math.min(1, alpha * 3));
        g.strokeCircle(s.x, s.y, radius);
      }
    });
  }

  // Fade the options in, show the prompt, and start the round for real.
  revealOptions(ctx, t) {
    this.phase = PHASE.PLAYING;
    this.buildDropZones(ctx, t);
    this.buildOptions(ctx, t);
    // THE VOICE NEEDS TWO THINGS, and they must be declared BEFORE the prompt is
    // set — the hub only starts the line once this round's clue is known, which is
    // what keeps "3 corners" ahead of "Put the shape on the belt."
    //
    //   clue  which card the reel landed on (the question)
    //   count how many shapes to place (selects the instruction half)
    //
    // The CLUE is the identity, not the round number: the first three rounds are
    // shuffled per run, so a round-keyed clue would be the wrong recording half the
    // time.
    ctx.setVoiceContext({
      clue: this.roundData?.clue,
      count: this.roundData?.count || 1,
    });

    // Prompt LAST, in the same frame the options appear, so the question is never
    // on screen before there is anything to answer it with. It says only how many
    // shapes to place — the CLUE on the reel carries the actual question.
    ctx.setPrompt(this.roundData?.prompt || '');
  }

  // ---------------------------------------------------------------------------
  // THE SLOT MACHINE — rebuilt from scratch, deliberately the simplest thing that
  // can work.
  // ---------------------------------------------------------------------------
  // A BOX is drawn in the scene, sized and placed entirely from tuning, and the
  // reel's labels are only visible while they are inside it.
  //
  // CLIPPING: each label's visibility is computed from its OVERLAP with the box,
  // every frame. That is not a renderer feature, so it works identically on
  // Canvas and WebGL — which matters because every built-in option failed here:
  //
  //   setMask()/GeometryMask → Canvas-renderer only (there is no
  //                            preRenderWebGL on GeometryMask at all), so on
  //                            WebGL it is a silent no-op.
  //   FilterList.addMask     → WebGL-only, and not implemented on Container.
  //   setCrop()              → clips within a label's OWN frame; the WebGL text
  //                            path does not consult `isCropped` (only the image
  //                            and tileSprite texturers do).
  //   a second Camera        → collided with BaseCamera.ignore() recursing into
  //                            parents and produced a permanently blank window.
  //
  // Overlap is a few lines and cannot silently do nothing. A label fully outside
  // the box is hidden outright; one straddling an edge is faded, which reads as
  // it sliding in and out of the opening.

  startSlot(ctx, t) {
    if (!this.roundData) {
      this.ready.slot = true;
      return;
    }
    if (!this.buildSlot(ctx, t)) {
      // Nothing to show → never leave the round waiting on it.
      this.ready.slot = true;
      return;
    }
    // The whirr starts with the ROLL, not with the spin tween — the child is meant
    // to hear the machine working while the robot rolls in, and the two are
    // deliberately overlapping intros.
    //
    // STARTED ON THE NEXT FRAME, not here. `startSlot` runs during createRound,
    // before `robot.play()`; starting the audio in the same tick makes the sound
    // lead the animation by one frame, which over a 2.6s spin is audible as the
    // whirr finishing slightly before the highlight. `events.once('postupdate')`
    // starts it on the frame the roll actually begins.
    ctx.scene.events.once('postupdate', () => {
      if (this.phase !== PHASE.ROLLING) return;
      this.playSlotSpin(ctx, getScene1());
    });
    this.spinSlot(ctx, t);
  }

  // Creates the box and the reel. Returns null on failure so the caller can skip
  // straight to the options.
  buildSlot(ctx, t) {
    const scene = ctx.scene;
    const W = SceneBase.widthOf(scene);
    const H = SceneBase.heightOf(scene);

    // Where the box sits: on the robot's chest by default.
    let cx = W * t.slotXFrac;
    let cy = H * t.slotYFrac;
    if (t.slotFollowRobot && this.robot) {
      cx = this.robot.x;
      cy = this.robot.y - this.robot.displayHeight / 2;
    }
    cx += W * t.slotOffsetXFrac;
    cy += H * t.slotOffsetYFrac;

    const winW = W * t.slotWidthFrac;
    const winH = winW * t.slotAspect;

    // THE BOX, drawn BEHIND the reel. Everything about it is tuning: fill, border,
    // corner radius, size and position.
    const boxG = scene.add.graphics().setDepth(t.slotDepth);
    ctx.layer.add(boxG);

    // THE REEL sits at the box's centre. Its own `y` is the only thing that
    // animates, so there is exactly one transform to reason about.
    //
    // IT MUST BE A CHILD OF ctx.layer: the hub creates that layer at depth 10 and
    // the full-bleed background lives inside it at depth 0. A top-level object
    // below depth 10 renders UNDER the background, i.e. correctly positioned and
    // completely invisible — which is why the slot could not be seen at all.
    const reel = scene.add.container(cx, cy).setDepth(t.slotDepth + 1);
    ctx.layer.add(reel);

    this.slot = {
      boxG,
      reel,
      labels: [],
      landIndex: 0,
      spinTween: null,
      cx,
      cy,
      winW,
      winH,
      stride: 0,
      cardSize: 0,
    };

    this.drawSlotBox(t);
    return this.slot;
  }

  // Draws the box from tuning. Separate from buildSlot so a live tuning change can
  // redraw it without touching the reel.
  drawSlotBox(t) {
    const slot = this.slot;
    if (!slot?.boxG?.active) return;

    const { cx, cy, winW, winH } = slot;
    const left = cx - winW / 2;
    const top = cy - winH / 2;
    const radius = t.slotBoxRadius;

    slot.boxG.clear();

    if (t.slotBoxFillAlpha > 0) {
      slot.boxG.fillStyle(t.slotBoxFillColor, t.slotBoxFillAlpha);
      slot.boxG.fillRoundedRect(left, top, winW, winH, radius);
    }
    if (t.slotBoxBorderWidth > 0) {
      slot.boxG.lineStyle(t.slotBoxBorderWidth, t.slotBoxBorderColor, 1);
      slot.boxG.strokeRoundedRect(left, top, winW, winH, radius);
    }
  }

  // PLACES AND CLIPS the labels. This is the whole window mechanism.
  //
  // ONE COORDINATE SPACE, DELIBERATELY. `slot.reel.y` is an ABSOLUTE canvas y (the
  // reel is placed at the box centre and only ever moved on y), and each label's
  // own `y` is its offset down the strip. So a label's canvas position is
  // `reel.y + label.y`, and that is what the box is compared against.
  //
  // Mixing the two spaces is what kept emptying the box: the reel was set to
  // y = -0.5 * stride (a LOCAL offset near 0) while the box test used absolute
  // coordinates around cy ~ 540, so every label failed and nothing was shown.
  //
  // TWO LAYERS OF CLIPPING, on purpose:
  //
  //  1. `setCrop` on each label — a REAL partial clip. Half a word slides into the
  //     box and stops at its edge, which is what makes the reel read as a physical
  //     strip passing a window instead of a word snapping on and off. This works
  //     because Text renders through DefaultImageNodes → TexturerImage, which
  //     honours `isCropped`.
  //  2. `setVisible` — labels wholly outside are hidden outright, so no partially
  //     cropped text is ever drawn at the box's edge, and a fully visible label
  //     carries no crop at all (cleanest path for the renderer).
  //
  // The crop is computed per frame from the overlap, so it needs no tuning and
  // cannot drift from the box.
  updateSlotClip() {
    const slot = this.slot;
    if (!slot?.labels?.length) return;

    const top = slot.cy - slot.winH / 2;
    const bottom = slot.cy + slot.winH / 2;

    slot.labels.forEach(({ label }) => {
      const canvasY = slot.reel.y + label.y;
      // The label's REAL drawn height: the width-fit scale changes it, and a
      // stride-based estimate would be wrong for the long words.
      const half = label.displayHeight / 2;

      const labelTop = canvasY - half;
      const labelBottom = canvasY + half;

      // Wholly outside the box → hidden, no crop needed.
      if (labelBottom <= top || labelTop >= bottom) {
        label.setVisible(false);
        return;
      }
      label.setVisible(true);

      // Visible span, in canvas px.
      const visibleTop = Math.max(labelTop, top);
      const visibleBottom = Math.min(labelBottom, bottom);
      const visibleH = visibleBottom - visibleTop;

      // Entirely inside → no crop (cheaper, and avoids any edge artefacts).
      if (visibleH >= label.displayHeight - 0.5) {
        if (label.isCropped) label.setCrop();
        return;
      }

      // PARTIAL: crop to the part that is inside the box.
      //
      // setCrop works in TEXTURE pixels relative to the frame, and a label's
      // texture is its rendered text at native resolution, so the ratio between
      // canvas px and texture px is `displayHeight / frame.realHeight`.
      const src = label.frame;
      const scaleY = src && src.realHeight ? src.realHeight / label.displayHeight : 1;

      // How much is cut off at the top and bottom, in canvas px, then converted.
      const cutTop = (top - labelTop) * scaleY;
      const cutBottom = (labelBottom - bottom) * scaleY;
      const y = Math.max(0, cutTop);
      const height = Math.max(0, src.realHeight - Math.max(0, cutTop) - Math.max(0, cutBottom));

      label.setCrop(0, y, src.realWidth, height);
    });
  }

  // Builds the clue labels and runs the spin.
  spinSlot(ctx, t) {
    const slot = this.slot;
    if (!slot) return;

    const { reel, landIndex } = buildReel(this.roundData.clue, t.slotCycles, Math.random);

    const scene = ctx.scene;

    // Label spacing, from the box height so the whole thing scales together.
    const cardSize = slot.winH * t.slotCardSizeOfWindow;
    const stride = cardSize * (1 + t.slotCardGapFrac);
    slot.stride = stride;
    slot.cardSize = cardSize;

    // A LABEL IS ONE TEXT OBJECT. No container, no graphics, no nesting — a plain
    // object has no parent transform that could double-count its position.
    //
    // The text is a CLUE ("3 corners"), not a shape name. Every label gets the
    // same colour, deliberately: colour used to vary so four labels read as four
    // things, but that made colours look meaningful and the clues are the content
    // now. One strong colour on the dark box is easier to read at a glance.
    const clueColour = `#${Number(t.slotWordColor).toString(16).padStart(6, '0')}`;

    reel.forEach((clue, i) => {
      const label = scene.add
        .text(0, (i + 0.5) * stride, clue, {
          fontSize: `${Math.round(cardSize * t.slotWordSizeOfCard)}px`,
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: clueColour,
          stroke: `#${Number(t.shapeStrokeColor).toString(16).padStart(6, '0')}`,
          strokeThickness: t.slotWordStroke,
        })
        .setOrigin(0.5);

      // Fit the longest clue inside the box, so every one reads at the same size
      // and none can overflow the sides.
      const maxW = slot.winW * t.slotWordFitOfWindow;
      if (label.width > maxW && label.width > 0) {
        label.setScale(maxW / label.width);
      }

      slot.reel.add(label);
      slot.labels.push({ label, clue, index: i });
    });

    slot.landIndex = landIndex;

    // START / REST — ABSOLUTE canvas y, matching updateSlotClip().
    //
    // The strip's answer is its LAST label, and label i sits `(i + 0.5) * stride`
    // below the reel's y. To have label i centred in the box, the reel sits at:
    //
    //   y = cy - (i + 0.5) * stride
    //
    // so starting with label 0 centred means `cy - 0.5 * stride`, and the travel
    // is exactly `landIndex * stride` — one slot per label, no gaps, no repeats.
    const startY = slot.cy - 0.5 * stride;
    const restY = slot.cy - (landIndex + 0.5) * stride;
    slot.restY = restY;
    slot.startY = startY;

    slot.reel.y = startY;
    this.updateSlotClip();
    // The landed clue is what the round asks for, and it is already fixed by the
    // plan — so this is a check that they agree, not a second source of truth.
    slot.landedClue = reel[landIndex];

    this.ready.slot = false;
    slot.spinTween = scene.tweens.add({
      targets: slot.reel,
      y: restY,
      duration: Math.max(1, t.slotSpinMs),
      ease: t.slotEase,
      // Re-clip EVERY frame: the tween only moves the container, so without this
      // the labels would be clipped once, before the strip had moved at all.
      onUpdate: () => this.updateSlotClip(),
      onComplete: () => {
        slot.spinTween = null;
        // Snap exactly on: an easing curve can finish a hair short.
        slot.reel.y = restY;
        this.updateSlotClip();
        this.landSlot(ctx, t);
      },
    });
  }

  // LIVE TUNING for the box.
  //
  // Position and size are cheap to apply while a spin is running: the box is
  // redrawn from the current values and the reel is moved to the new centre, so
  // dragging `slot x` or `slot width` moves the live window instead of rebuilding
  // the round. Card and word size are baked into the label objects, so those take
  // effect on the next round rather than stretching text mid-spin.
  relayoutSlot(t) {
    const slot = this.slot;
    if (!slot?.reel?.active) return;

    const scene = this.ctx?.scene;
    if (!scene) return;

    const W = SceneBase.widthOf(scene);
    const H = SceneBase.heightOf(scene);
    let cx = W * t.slotXFrac;
    let cy = H * t.slotYFrac;
    if (t.slotFollowRobot && this.robot) {
      cx = this.robot.x;
      cy = this.robot.y - this.robot.displayHeight / 2;
    }
    cx += W * t.slotOffsetXFrac;
    cy += H * t.slotOffsetYFrac;

    slot.cx = cx;
    slot.cy = cy;
    slot.winW = W * t.slotWidthFrac;
    slot.winH = slot.winW * t.slotAspect;

    this.drawSlotBox(t);
    slot.reel.setX(cx);
    this.updateSlotClip();
  }

  // The reel has stopped on the answer.
  //
  // HIGHLIGHTING, and why it is not just a scale pulse: the winning word must
  // STAY VISIBLE in the middle of the box, because it is the answer the prompt is
  // about to name. A pulse that only resets the label would leave the box looking
  // empty the moment the spin ends, which is exactly the failure that kept being
  // reported.
  //
  // So the landing does three things together: snap the reel so the answer is dead
  // centre, CLAMP the answer visible regardless of the clip test, and run a
  // scale + tint pulse on it. The remaining labels are hidden at that point, so the
  // box contains exactly one word — the answer.
  landSlot(ctx, t) {
    const slot = this.slot;
    if (this.phase !== PHASE.ROLLING || !slot) return;

    // Snap: an easing curve can finish a fraction of a pixel short.
    slot.reel.y = slot.restY;

    const landed = slot.labels[slot.landIndex];
    if (!landed) return;

    // The answer is centred and MUST be on screen. Clamping here means the
    // highlight can never be applied to a hidden label — the clip test and the
    // "show the winner" requirement are reconciled in one place.
    slot.labels.forEach(({ label }) => label.setVisible(label === landed.label));
    landed.label.setVisible(true);

    if (t.slotLandPulseMs > 0) {
      // RELATIVE to the label's current scale, which may have been capped to fit
      // the box width. An absolute value would shrink a fitted label and leave it
      // there after the yoyo.
      const base = landed.label.scale;
      ctx.scene.tweens.add({
        targets: landed.label,
        scale: base * t.slotLandPulseScale,
        duration: t.slotLandPulseMs,
        ease: t.slotEase,
        yoyo: true,
        onComplete: () => landed.label.setScale(base),
      });
    }

    // A glow behind the winning word.
    //
    // Drawn at the object's OWN origin and then positioned, so a scale tween
    // expands it about the box's centre instead of dragging it off to one side
    // (a Graphics scales about its own (0,0), not about the circles it contains).
    if (t.slotHighlightAlpha > 0) {
      const radius = Math.min(slot.winW, slot.winH) * t.slotHighlightSizeOfBox;

      const glow = ctx.scene.add.graphics().setDepth(slot.boxG.depth + 0.5);
      glow.fillStyle(t.slotHighlightColor, t.slotHighlightAlpha);
      glow.fillCircle(0, 0, radius);
      glow.setPosition(slot.cx, slot.cy);
      ctx.layer.add(glow);

      ctx.scene.tweens.add({
        targets: glow,
        alpha: 0,
        scale: t.slotHighlightGrow,
        duration: Math.max(1, t.slotHighlightMs),
        ease: 'Sine.easeOut',
        onComplete: () => glow.destroy(),
      });
    }

    this.schedule(t.slotSettleMs, () => {
      if (this.phase !== PHASE.ROLLING) return;
      this.ready.slot = true;
      this.maybeReveal(ctx, getScene1());
    });
  }

  // Plays a one-shot sound, safely.
  //
  // Wrapped because a key that is not in the asset manifest — or a clip that has
  // not finished loading — makes `sound.play` fail SILENTLY (or throw, depending
  // on the codec), and an audio problem must never break a round. Mute is handled
  // by Phaser's own sound manager via the shared mute state, so nothing here has
  // to know about it.
  playSound(ctx, key, volume = 1, rate = 1) {
    try {
      const sound = ctx.scene.sound;
      if (!sound || !ctx.scene.cache.audio.exists(key)) return null;
      return sound.play(key, { volume, rate });
    } catch {
      // Never let audio break gameplay.
      return null;
    }
  }

  // PLAY THE SLOT WHIRR STRETCHED TO EXACTLY FIT THE SLOT SEQUENCE.
  //
  // The sequence is: the spin tween, then the land pulse, then a settle hold —
  // and that total has to equal the clip's own length. The clip's duration is a
  // property of the FILE and the browser (a raw MP3's length is only known once
  // decoded), so it cannot be written into tuning as a constant without going
  // stale the moment the asset is swapped.
  //
  // Instead the playback RATE is solved at runtime:
  //
  //     rate = clipDuration / sequenceDuration
  //
  // so a longer clip is sped up, a shorter one slowed down, and the whirr always
  // starts with the roll and finishes exactly as the winning word's highlight ends.
  playSlotSpin(ctx, t) {
    const scene = ctx.scene;
    if (!scene?.sound || !scene.cache.audio.exists('slotSpin')) return;

    // Total time the slot is busy, in ms. Mirrors spinSlot()'s tween + landSlot()'s
    // timing exactly, so the two cannot drift apart.
    const sequenceMs =
      Math.max(1, t.slotSpinMs) + Math.max(0, t.slotLandPulseMs) + Math.max(0, t.slotSettleMs);

    const source = scene.cache.audio.get('slotSpin');
    const clipSeconds = source?.duration;

    // Every tuning read is defended. A MISSING tuning key reads as `undefined`,
    // which propagates into `rate` as NaN — and `sound.play({ rate: NaN })` fails
    // silently, so the sound simply never plays. That is exactly what happened
    // when these three values were added to the schema but not to the defaults.
    const rateMin = Number.isFinite(t.slotSpinRateMin) ? t.slotSpinRateMin : 0.6;
    const rateMax = Number.isFinite(t.slotSpinRateMax) ? t.slotSpinRateMax : 3.5;
    const volume = Number.isFinite(t.slotSpinVolume) ? t.slotSpinVolume : 0.5;

    let rate = 1;
    if (Number.isFinite(clipSeconds) && clipSeconds > 0) {
      rate = (clipSeconds * 1000) / sequenceMs;
      // A rate outside this band sounds absurd: below it the whirr drones, above
      // it it chirps. Clamping keeps a badly-sized asset listenable.
      //
      // A local clamp rather than Phaser.Math.Clamp: this module deliberately does
      // not import Phaser (SceneBase and the scene modules are Phaser-free except
      // through `ctx`), and a stray global would be an implicit dependency.
      rate = Math.min(Math.max(rate, rateMin), rateMax);
    }
    // Belt and braces: a NaN must never reach the sound manager.
    if (!Number.isFinite(rate) || rate <= 0) rate = 1;

    this.slotSound = this.playSound(ctx, 'slotSpin', volume, rate);

    // Hard stop at the end of the sequence, so even a clamped rate cannot leave
    // the whirr running under the options row.
    this.schedule(sequenceMs, () => {
      this.stopSlotSound();
    });
  }

  stopSlotSound() {
    if (!this.slotSound) return;
    try {
      this.slotSound.stop();
    } catch {
      // Already finished or destroyed — nothing to do.
    }
    this.slotSound = null;
  }

  // Stops the spin if a round ends or the scene is torn down mid-animation.
  // Without this the tween keeps running into a destroyed container, and a
  // stopped tween that still holds a reference to a dead Container object is a
  // leak per round.
  stopSlot() {
    if (this.slot?.spinTween) {
      this.slot.spinTween.stop();
      this.slot.spinTween = null;
    }
  }

  // ---------------------------------------------------------------------------
  // THE OPTIONS ROW
  // ---------------------------------------------------------------------------

  buildOptions(ctx, t) {
    this.options = [];
    if (!this.roundData) return;

    const { options } = this.roundData;
    const W = SceneBase.widthOf(ctx.scene);
    const H = SceneBase.heightOf(ctx.scene);
    const size = W * t.optionSizeFrac;

    // The row's CENTRE comes straight from tuning, so re-seating it is one slider
    // and not a search through the layout code.
    const rowX = W * t.optionRowXFrac;
    const rowY = H * t.optionRowYFrac;

    // Centre the row: total width = n sizes + (n-1) gaps.
    const totalW = options.length * size + (options.length - 1) * t.optionGapPx;
    const startX = rowX - totalW / 2 + size / 2;

    options.forEach((data, i) => {
      const x = startX + i * (size + t.optionGapPx);

      // A container per option, so the graphic and its outline move together and
      // the whole thing can be scaled/faded as one.
      const container = ctx.scene.add.container(x, rowY).setDepth(20);

      const fill = this.makeShapeGraphic(ctx, data.type, size, data.hex, t);
      container.add(fill);

      // OUTLINE: a second graphic stroked with the same path. Kept separate so
      // the stroke width can be tuned without redrawing the fill.
      if (t.shapeStrokeWidth > 0) {
        const outline = this.makeShapeGraphic(ctx, data.type, size, null, t, true);
        container.add(outline);
      }

      // Interactivity on the CONTAINER, using its own size as the hit area — a
      // Graphics has no implicit hit area, so this must be explicit or the option
      // would be visible but untouchable.
      container.setSize(size, size);
      container.setInteractive({ useHandCursor: true });
      container.setAlpha(t.shapeIdleAlpha);

      ctx.layer.add(container);
      this.options.push({ data, container, homeX: x, homeY: rowY, size });
    });

    // Fade in, so the options arrive after the robot settles rather than popping.
    if (t.shapesFadeInMs > 0) {
      this.options.forEach((o) => {
        o.container.setAlpha(0);
        ctx.scene.tweens.add({
          targets: o.container,
          alpha: t.shapeIdleAlpha,
          duration: t.shapesFadeInMs,
          ease: 'Sine.easeOut',
        });
      });
    }

    this.installDrag(ctx, t);
  }

  // Draws ONE shape into a Graphics, centred on 0,0.
  //
  // `strokeOnly` draws the same path with no fill, so the outline can be its own
  // graphic (and its own stroke width) without drawing the path twice in one
  // call with different styles.
  makeShapeGraphic(ctx, type, size, colour, t, strokeOnly = false) {
    const g = ctx.scene.add.graphics();
    const half = size / 2;

    if (!strokeOnly && colour != null) g.fillStyle(colour, 1);
    if (strokeOnly) g.lineStyle(t.shapeStrokeWidth, t.shapeStrokeColor, 1);

    if (type === 'circle') {
      g.fillCircle(0, 0, half);
      // A stroked circle needs its own call; fillCircle has no stroke variant.
      if (strokeOnly) g.strokeCircle(0, 0, half);
      return g;
    }

    if (type === 'square') {
      g.fillRect(-half, -half, size, size);
      if (strokeOnly) g.strokeRect(-half, -half, size, size);
      return g;
    }

    if (type === 'rectangle') {
      // WIDER THAN TALL, from tuning. Without its own aspect a rectangle is
      // drawn as a square, and the child cannot tell the two options apart —
      // which makes the round unanswerable rather than just ugly.
      const h = size * t.rectangleAspect;
      g.fillRect(-half, -h / 2, size, h);
      if (strokeOnly) g.strokeRect(-half, -h / 2, size, h);
      return g;
    }

    // triangle — equilateral-ish, centred on 0,0 and pointing up.
    const th = size * 0.87;
    g.beginPath();
    g.moveTo(0, -th / 2);
    g.lineTo(half, th / 2);
    g.lineTo(-half, th / 2);
    g.closePath();
    if (!strokeOnly) g.fillPath();
    if (strokeOnly) g.strokePath();
    return g;
  }

  // ---------------------------------------------------------------------------
  // DRAG AND DROP
  // ---------------------------------------------------------------------------

  // Drag is MANUAL rather than Phaser's built-in draggable.
  //
  // The reason: an option is a Container wrapping two Graphics, and Phaser's drag
  // deltas get unreliable once the dragged object's parent is re-parented or its
  // depth changes mid-drag. Driving it from the scene's own pointer events is a
  // handful of lines and behaves identically on touch and mouse.
  installDrag(ctx, t) {
    const scene = ctx.scene;

    this.onPointerDown = (pointer, currentlyOver) => {
      // Dragging stays enabled while WAITING too, so the second shape of a
      // two-shape round can be placed without a second prompt.
      if (this.phase !== PHASE.PLAYING && this.phase !== PHASE.WAITING) return;
      // Ignore taps on empty space; only an option starts a drag.
      const hit = currentlyOver?.find((o) => this.options.some((s) => s.container === o));
      if (!hit) return;

      const option = this.options.find((s) => s.container === hit);
      this.dragging = {
        option,
        offsetX: option.container.x - pointer.x,
        offsetY: option.container.y - pointer.y,
      };
      option.container.setDepth(40);
      scene.tweens.add({
        targets: option.container,
        scale: t.shapeDragScale,
        duration: 120,
        ease: 'Sine.easeOut',
      });
    };

    this.onPointerMove = (pointer) => {
      if (!this.dragging) return;
      const { option, offsetX, offsetY } = this.dragging;
      option.container.x = pointer.x + offsetX;
      option.container.y = pointer.y + offsetY;
    };

    this.onPointerUp = () => {
      if (!this.dragging) return;
      const { option } = this.dragging;
      this.dragging = null;

      const t2 = getScene1();
      const H = SceneBase.heightOf(scene);

      const beltTop = H * t2.beltYFrac - (H * t2.beltHeightFrac) / 2;
      const beltBottom = H * t2.beltYFrac + (H * t2.beltHeightFrac) / 2;

      // FORGIVING BAND. A kindergartner releasing a shape a little above or below
      // the belt has still aimed at it, so the drop zone extends past the belt by
      // a fraction of its height. Precision is not what this teaches.
      const slack = H * t2.beltHeightFrac * t2.dropToleranceFrac;
      const y = option.container.y;
      const onBelt = y >= beltTop - slack && y <= beltBottom + slack;

      if (!onBelt) {
        this.returnHome(ctx, option);
        return;
      }

      // THE POP FIRES ON A LANDED DROP, RIGHT OR WRONG. It is the sound of a shape
      // being placed, not a reward, so it belongs here and not in `sendAway`.
      this.playSound(ctx, 'pop1');

      // RIGHT OR WRONG is decided HERE, at the drop. `isCorrect` also rejects a
      // DUPLICATE in a two-shape round, so dropping a second square cannot pass.
      const right = isCorrect(this.roundData, option.data.type, this.placed);

      // EVERY DROP IS RECORDED, right or wrong.
      //
      // This is what makes the two-shape round behave: the child is asked for TWO
      // shapes, so they must be allowed to place both before hearing whether they
      // were right. Judging the first one on its own and sending it off is what made
      // a wrong shape ship immediately instead of waiting to be joined.
      this.placed.push({ type: option.data.type, right });

      const total = this.roundData.count || 1;
      const filled = this.placed.length;

      // ---- SLOT IT AND DECIDE WHAT HAPPENS NEXT ----
      //
      // `parkOnBelt` only seats the shape in the next free slot; it deliberately
      // does not care whether the shape is right, because until the belt is full the
      // round has no verdict to give.
      this.parkOnBelt(ctx, option, t2, { right });

      if (filled < total) {
        // STILL WAITING for the rest. Nothing is sent off, nothing is judged.
        return;
      }

      // ---- THE BELT IS FULL: now the round is decided ----
      //
      // The verdict is over the WHOLE set, not per shape: two correct shapes pass,
      // and ANY wrong one fails the round. That is the rule the child is being
      // taught — the pair has to be right together.
      const allRight = this.placed.every((p) => p.right);
      this.resolveBelt(ctx, t2, allRight);
    };

    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.on('pointerup', this.onPointerUp);
  }

  returnHome(ctx, option) {
    ctx.scene.tweens.add({
      targets: option.container,
      x: option.homeX,
      y: option.homeY,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
    option.container.setDepth(20);
  }

  // PARK THE FIRST SHAPE OF A TWO-SHAPE ROUND ON THE BELT.
  //
  // It is a correct answer, but the round is not won yet, so it must not ride
  // away. It snaps onto the belt, slightly LEFT of the drop point, and WAITS. The
  // belt stays still until the second shape arrives, so the pair is carried off
  // together and the relationship between them is visible.
  //
  // The placed shape is removed from the tray so it cannot be dragged twice — and
  // because `isCorrect` rejects a duplicate type, the only way to satisfy "4
  // corners" is with one square and one rectangle, which is the point.
  /**
   * THE SLOT GEOMETRY for a two-shape round.
   *
   * Two fixed places either side of the belt's middle. They are computed once per
   * round rather than per drop, so the FIRST shape to arrive and the second always
   * land in the same two spots — which is what makes the pair read as "in place"
   * instead of as two shapes left wherever they were released.
   *
   * @returns {{x: number, y: number}[]} one entry per shape the round wants
   */
  beltSlots(t) {
    const W = SceneBase.widthOf(this.ctx.scene);
    const H = SceneBase.heightOf(this.ctx.scene);
    const stickY = H * t.beltYFrac + H * t.dropYOffsetFrac;

    // The half-gap used to be `parkSpreadFrac / 2` off the belt's middle, which put
    // the FIRST shape permanently in the LEFT slot — so a child who happened to
    // drop on the right saw their shape jump across the belt.
    //
    // Now each shape takes the first FREE slot in whatever order they arrive. The
    // two positions are symmetric about the drop point, so whichever order they are
    // filled in, the finished pair looks identical.
    const half = (W * t.parkSpreadFrac) / 2;
    return [
      { x: W * t.dropXFrac - half, y: stickY },
      { x: W * t.dropXFrac + half, y: stickY },
    ];
  }

  /**
   * Put a CORRECT shape into the first free belt slot and hold it there.
   *
   * The round is not won yet — a two-shape round needs both — so the shape must not
   * ride away. The belt stays still until the second one arrives, so the pair is
   * carried off together and the relationship between them is visible.
   *
   * The shape SNAPS TO A DEFINED SLOT rather than staying where it was released:
   * at 4-6 years old the drop is imprecise, and two shapes left at the release
   * points can overlap or sit half off the belt. Snapping also means the second
   * shape cannot land on top of the first.
   */
  parkOnBelt(ctx, option, t, { right = true } = {}) {
    this.phase = PHASE.WAITING;

    const scene = ctx.scene;
    const slots = this.slots.length ? this.slots : this.beltSlots(t);
    this.slots = slots;

    // WHICH SLOT — the one NEAREST to where the child actually dropped it.
    //
    // Picking the "first free" slot was wrong: the highlights show two targets, so
    // dropping on the RIGHT one seated the shape in the LEFT one, which reads as the
    // shape ignoring where it was put. Choosing the nearest FREE slot means the
    // shape always comes to rest in the highlight the child aimed at.
    //
    // An OCCUPIED slot is excluded from the candidates, so two shapes can never
    // share a slot and therefore never overlap. If both are taken (should not
    // happen, but be safe) the last slot is used and the shapes simply stack — no
    // crash, and the round still resolves.
    const taken = new Set((this.onBelt ?? []).map((o) => o.slotIndex));
    const free = slots.map((s, i) => ({ s, i })).filter(({ i }) => !taken.has(i));
    const candidates = free.length ? free : slots.map((s, i) => ({ s, i }));

    const dropX = option.container.x;
    const slotIndex = candidates.reduce(
      (best, c) =>
        Math.abs(c.s.x - dropX) < Math.abs(best.s.x - dropX) ? c : best,
      candidates[0]
    ).i;

    const target = slots[slotIndex];

    option.container.setDepth(30);
    option.slotIndex = slotIndex;

    // Drop it from the tray so it is not a drag candidate any more.
    this.options = this.options.filter((o) => o !== option);
    this.onBelt = [...(this.onBelt ?? []), option];

    // A WRONG SHAPE IS SEATED EXACTLY LIKE A CORRECT ONE, and only faintly dimmed.
    //
    // The round has NOT been judged yet — both shapes have to be in place before
    // there is a verdict — so the shape must look placed. The dimming is a gentle
    // cue that this one is probably not right, without telling the child the answer
    // before they have finished; the real feedback (red flash, buzzer) is still held
    // back until the belt is full.
    option.container.setAlpha(right ? 1 : (t.wrongParkAlpha ?? 0.65));

    scene.tweens.add({
      targets: option.container,
      x: target.x,
      y: target.y,
      scale: 1,
      duration: t.dropSnapMs,
      ease: 'Back.easeOut',
    });

    // REDRAW THE HIGHLIGHTS, so the slot that was just filled fades back and the
    // remaining open one still reads as the place to aim at. Without this both
    // zones kept looking equally available after the first shape landed.
    this.buildDropZones(ctx, t);

    // NO `ctx.setPrompt` HERE.
    //
    // It used to re-set the round's prompt after each shape parked, purely to keep
    // the sentence on screen. But the hub's `setPrompt` also STARTS the voice line,
    // so parking the FIRST shape re-spoke the question, and the two-shape round
    // played it twice — once per shape.
    //
    // The text is already on screen and nothing has cleared it: `parkOnBelt` runs
    // before `resolveBelt`, and only the resolve path clears the prompt. So there is
    // nothing to restore, and the line plays once, at the start of the round.
  }

  /**
   * THE BELT IS FULL — send the pair off, and judge the round from the WHOLE set.
   *
   * This is the single place a multi-shape round is decided. Both shapes always
   * leave together, so the child sees their answer completed before hearing about
   * it; what differs is where the ride ENDS UP, which is driven by `phase`:
   * PHASE.SENDING advances the round, PHASE.WRONG re-mounts it.
   *
   * A one-shape round reaches here too, with a one-element `placed`, so there is one
   * path rather than two that can drift apart.
   */
  resolveBelt(ctx, t, allRight) {
    const group = [...(this.onBelt ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
    const option = group[group.length - 1];
    if (!option) return;

    if (allRight) {
      this.sendAway(ctx, option, t);
      return;
    }

    // WRONG: the pair still rides off exactly like a correct one — the child's
    // action plays out — but the round is marked failed so the ride's end plays the
    // buzzer and re-mounts instead of advancing.
    this.phase = PHASE.WRONG;
    ctx.setPrompt('');

    const W = SceneBase.widthOf(ctx.scene);
    const positions = group.map((o) => o.container.x);
    const rightmost = Math.max(...positions) + option.size;

    this.ride = {
      option,
      group,
      offsets: positions.map((x) => x - positions[0]),
      startX: positions[0],
      endX: W + rightmost,
      beltBasePx: this.beltTotalPx ?? 0,
    };
    this.sendOffset = 0;

    // Full opacity on the way out: the dim was a "not sure yet" hint, and now the
    // verdict is in and the feedback is coming from the flash and the buzzer.
    group.forEach((o) => o.container.setDepth(30).setAlpha(1));
  }

  // The option rides the belt to the RIGHT and off screen, then the hub advances.
  //
  // ONE OFFSET DRIVES BOTH THE OPTION AND THE BELT TEXTURE.
  //
  // The first version tweened the option's x AND scrolled the belt texture in
  // update() at a separate speed. Two independent clocks means the option slides
  // over a belt whose planks are moving at a different rate — it appears to skate
  // rather than ride — and any hiccup in one makes it visibly detach.
  //
  // Now `this.sendOffset` is the single source of truth for "how far has the
  // belt travelled since the drop". Each frame it grows by sendOffSpeed * dt, and
  // BOTH readers use it, so they are locked together by construction.
  sendAway(ctx, option, t) {
    this.phase = PHASE.SENDING;
    ctx.setPrompt('');

    const scene = ctx.scene;
    const H = SceneBase.heightOf(scene);
    const W = SceneBase.widthOf(scene);

    option.container.setDepth(30);

    // SNAP TO THE BELT, in both axes.
    //
    // Y: onto the belt's sticking line, rather than the arbitrary height it was
    // released from.
    // X: toward `dropXFrac` (the belt's middle). Without this the shape rides away
    // from wherever it happened to be dropped, which makes the belt look like it
    // is sliding past rather than taking the shape with it. Tuning moves both, so
    // the behaviour survives a `belt y` or `stick y` change.
    const stickY = H * t.beltYFrac + H * t.dropYOffsetFrac;

    // TWO SHAPES RIDE TOGETHER, from the SLOTS they already occupy.
    //
    // They are NOT re-seated here. Each shape was snapped to its own belt slot when
    // it was placed, and re-computing positions at send time would shift the pair
    // sideways at the moment the round resolves — the shapes would visibly jump
    // just as they start moving. Reading the slot positions back means the pair
    // leaves from exactly where the child saw them land.
    //
    // `this.onBelt` already holds the previously parked shapes; `sendAway` is
    // called with the one that completed the pair.
    const group = [...(this.onBelt ?? []), option];

    // Slot order, so the leftmost shape is `group[0]` regardless of which shape
    // arrived first — the ride's `offsets` are measured from the leftmost.
    group.sort((a, b) => a.slotIndex - b.slotIndex);

    const positions = group.map((o) =>
      group.length === 1 ? W * t.dropXFrac : o.container.x
    );

    // A one-shape round has no slots, so it still snaps to the belt's middle.
    if (group.length === 1) positions[0] = W * t.dropXFrac;

    // Snap the group, then start the ride once the LAST of them has landed. The
    // ride origin is the pair's leftmost shape, so `endX` clears the right edge
    // for both.
    let pending = group.length;
    const onSettled = () => {
      pending -= 1;
      if (pending > 0) return;

      // How far right the ride must travel before every shape is off screen.
      const rightmost = Math.max(...positions) + group[group.length - 1].size;

      this.ride = {
        // The shape used for the end test; any of the group works because they
        // move by the same offset.
        option: group[group.length - 1],
        group,
        // Each shape's offset from the leftmost, so the pair keeps its spacing
        // for the whole ride.
        offsets: positions.map((x) => x - positions[0]),
        startX: positions[0],
        endX: W + rightmost,
        beltBasePx: this.beltTotalPx ?? 0,
      };
      this.sendOffset = 0;
    };

    group.forEach((o, i) => {
      o.container.setDepth(30);
      scene.tweens.add({
        targets: o.container,
        x: positions[i],
        y: stickY,
        scale: 1,
        duration: t.dropSnapMs,
        ease: 'Back.easeOut',
        onComplete: onSettled,
      });
    });

    this.onBelt = group;
  }

  // NOTE: there used to be a `wrongDrop()` here that shipped a single wrong shape
  // off the belt the instant it was released. It is gone on purpose.
  //
  // A multi-shape round has to wait for ALL its shapes before it can be judged —
  // the whole point is that the pair has to be right together — so a wrong shape is
  // now seated in a slot like any other and the verdict waits for `resolveBelt()`.
  // For a one-shape round that resolves on the same release, so the behaviour is
  // unchanged there.
  //
  // The feedback itself was never in `wrongDrop`: it lives in `finishWrongDrop()`,
  // which the ride's end calls, so the buzzer and the red flash still happen only
  // after the shapes have actually left the screen.

  // A full-canvas colour flush, used by BOTH outcomes — green for a win, red for a
  // miss. One helper so the two cannot drift apart in timing or depth, which is
  // what makes them read as the same piece of feedback with different meanings.
  //
  // Above everything in the layer but below the HUD, so the prompt stays legible
  // through it. Destroys itself, so nothing has to track it.
  flashScreen(ctx, colour, alpha, fadeMs, holdMs) {
    const scene = ctx.scene;
    const W = SceneBase.widthOf(scene);
    const H = SceneBase.heightOf(scene);

    const flash = scene.add
      .rectangle(W / 2, H / 2, W, H, colour, alpha)
      .setDepth(getScene1().slotDepth + 20)
      .setAlpha(0);
    ctx.layer.add(flash);

    scene.tweens.add({
      targets: flash,
      alpha: 1,
      duration: Math.max(1, fadeMs),
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: Math.max(0, holdMs),
      onComplete: () => flash.destroy(),
    });

    return flash;
  }

  // The wrong shape has now left the screen: flash, buzz, then restart the round.
  // Called from update() the moment the ride reaches its end, so the feedback is
  // synchronised with the shape actually being gone rather than with a timer.
  finishWrongDrop(ctx, t) {
    // The round is over either way; a question still being read out would talk
    // over the buzzer. The retry re-asks it in a moment anyway.
    ctx.stopVoice?.();

    this.flashScreen(ctx, t.wrongFlashColor, t.wrongFlashAlpha, t.wrongFlashMs, t.wrongFlashHoldMs);

    // Buzzer — the shared `wrong` clip, loaded by this game's asset manifest.
    this.playSound(ctx, 'wrong', 0.6);

    this.schedule(t.wrongRestartMs, () => {
      this.cancelPending();
      // `retry: true` tells the hub to re-mount the SAME round and to count it as
      // a mistake rather than a pass.
      ctx.roundComplete({ correct: false, retry: true });
    });
  }

  fadeOutOptions(ctx, exceptOption) {
    const targets = this.options
      .filter((o) => o !== exceptOption)
      .map((o) => o.container);
    if (targets.length === 0) return;
    ctx.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
    });
  }

  // ---------------------------------------------------------------------------
  // UPDATE + TUNING
  // ---------------------------------------------------------------------------

  // The belt is STILL until an option is dropped on it, then it runs until the
  // option is off screen — and STOPS there, holding the position it reached.
  // One integrator, two readers.
  update(ctx, time, delta) {
    // EVERY GUARD BEFORE THE TUNING READ. `getScene1()` deep-merges a fresh object
    // per call in dev, and this loop runs every frame of a round — so resolving it
    // first meant allocating constantly during the (common) frames where the belt
    // is idle. The ride is the only thing this integrator drives, so if there is no
    // ride there is nothing to read.
    if (!this.roundActive) return;
    // A wrong drop also rides the belt away, so the belt must keep moving. The
    // only difference is what happens when the shape leaves the screen.
    if (this.phase !== PHASE.SENDING && this.phase !== PHASE.WRONG) return;
    if (!this.ride) return;

    const t = getScene1();
    // Clamp the step: a backgrounded tab hands back a huge delta on return,
    // which would teleport the option past the edge in one frame.
    const dt = Math.min(delta, 50);

    this.sendOffset += (t.sendOffSpeed * dt) / 1000;

    const { option, group, offsets, startX, endX, beltBasePx } = this.ride;

    // Keep the running total in step with the ride, and park it for the next
    // round immediately — not only in destroy() — so a scene change at any point
    // keeps the belt where the child last saw it.
    this.beltTotalPx = beltBasePx + this.sendOffset;
    this.state[BELT_STATE_KEY] = this.beltTotalPx;

    // 1) The shape — or BOTH shapes of a two-shape round — carried by the belt.
    //
    //    Everything moves by the same offset and keeps its original spacing, so a
    //    pair stays a pair and neither can drift out of step with the belt.
    const x = Math.min(endX, startX + this.sendOffset);
    (group ?? [option]).forEach((o, i) => {
      o.container.x = x + (offsets ? offsets[i] : 0);
    });

    // 2) The belt texture, scrolled by the SAME SCREEN distance.
    //
    //    The helper owns the three traps: texture-vs-screen units, the inverted
    //    sign, and the negative-modulo wrap. Passing screen pixels here is what
    //    makes "the planks move exactly as far as the option did" true rather
    //    than approximately true at some scale factor.
    this.scrollStripByScreenPx(this.belt, beltBasePx + this.sendOffset);

    // 3) Arrived? Stop the ride, leave the belt exactly where it is, finish up.
    //
    // The WRONG branch has its own restart timer already scheduled (started when
    // the shape was dropped), so it only stops the ride — running both would
    // advance the round twice.
    if (x >= endX) {
      this.ride = null;
      if (this.phase === PHASE.SENDING) {
        this.finishSendOff(ctx, option, t);
      } else if (this.phase === PHASE.WRONG) {
        // The shape is off screen NOW, so this is the first moment the red flash
        // and the buzzer should happen.
        this.finishWrongDrop(ctx, t);
      }
    }
  }

  // Runs once, when the option has left the screen. The belt is NOT touched here:
  // it has already stopped at the offset it reached, which is the position the
  // next round resumes from.
  finishSendOff(ctx, option, t) {
    // THE ROUND IS WON — silence the question. The hub also stops it on
    // `roundComplete`, but this scene holds for `winHoldMs` first, so without this
    // the question would still be reading out over the success chime.
    ctx.stopVoice?.();

    // THE SUCCESS MOMENT: chime plus green flush, at the instant the shape has
    // finished sending off and the round is won.
    //
    // `pop1` already fires for EVERY landed drop (it is the sound of putting a
    // shape on the belt), so it cannot also mean "correct" — otherwise right and
    // wrong answers sound identical. This is a second, distinct cue that only a
    // correct answer ever reaches.
    //
    // The green flash mirrors the red one exactly, via the same helper, so the two
    // outcomes read as one piece of feedback with opposite meanings rather than as
    // two unrelated effects.
    this.playSound(ctx, 'pop2', 0.8);
    this.flashScreen(ctx, t.correctFlashColor, t.correctFlashAlpha, t.correctFlashMs, t.correctFlashHoldMs);

    // Hide the rest of the row so the next round starts clean rather than with
    // three leftovers behind the robot.
    this.fadeOutOptions(ctx, option);

    // HOLD THE WIN before the next round mounts.
    //
    // This used `sendOffHoldMs` — a 120ms beat that exists to stop the round
    // cutting instantly after the shape leaves. That is far too short here: the
    // next round re-mounts immediately, destroying this scene, which stopped the
    // chime mid-play and truncated the green flash. The feedback was being
    // cancelled by its own success.
    //
    // `winHoldMs` is derived so it always outlasts the flash, whatever the flash
    // timings are tuned to: fade-in + hold + fade-out, plus a beat.
    const flashMs = t.correctFlashMs + t.correctFlashHoldMs + t.correctFlashMs;
    const holdMs = Math.max(t.winHoldMs, flashMs + t.winHoldPadMs);

    this.schedule(holdMs, () => {
      this.cancelPending();
      // roundComplete is the hub's contract; it advances the run and mounts the
      // next round (or the next scene) for us. Reaching here means the shape on
      // the belt WAS the target, so this is always a pass.
      ctx.roundComplete({ correct: true });
    });
  }

  applyTuning(ctx) {
    const t = getScene1();
    const { width, height } = ctx.scene.scale;

    // Background.
    if (this.bg) {
      const src = ctx.scene.textures.get('s1Background').getSourceImage();
      if (src?.width) {
        this.bg
          .setScale(Math.max(width / src.width, height / src.height))
          .setPosition(width / 2 + width * t.bgOffsetXFrac, height / 2 + height * t.bgOffsetYFrac)
          .setAlpha(t.bgAlpha);
      }
    }

    // Belt.
    if (this.belt) {
      const src = ctx.scene.textures.get('s1Conveyor').getSourceImage();
      const stripH = height * t.beltHeightFrac;
      const scale = src?.height ? stripH / src.height : this.belt.scale;
      const overlap = t.beltOverlap ?? 0.012;
      const tileScaleX = scale * (1 + overlap);

      this.belt.sprite
        .setPosition(width / 2, height * t.beltYFrac)
        .setSize(width, stripH)
        .setTileScale(tileScaleX, scale)
        .setAlpha(t.beltAlpha);

      this.belt.scale = scale;
      this.belt.tileScaleX = tileScaleX;
      this.belt.tileWidth = (src?.width ?? 1) * tileScaleX;

      // Re-apply the parked offset: a tileScale change moves the texture, so the
      // strip would silently shift while you drag the height slider.
      if (Number.isFinite(this.beltTotalPx)) {
        this.scrollStripByScreenPx(this.belt, this.beltTotalPx);
      }
    }

    // Robot — repositioned from the BELT's top edge, so dragging `belt y` cannot
    // slide the belt out from under a stationary robot.
    if (this.robot) {
      const still = animationStill(t.rollAnimKey);
      const src = ctx.scene.textures.get(still)?.getSourceImage();
      const drawnH = height * t.charHeightFrac;
      const scale = src?.height ? drawnH / src.height : this.robotScale;
      const beltTop = height * t.beltYFrac - (height * t.beltHeightFrac) / 2;

      this.robot
        .setPosition(width * t.charXFrac, beltTop - height * t.charBeltGapFrac)
        .setScale(scale)
        .setAlpha(t.charAlpha)
        .setDepth(t.charDepth);
      this.robotScale = scale;
    }

    // The slot BOX: redrawn from tuning and the reel moved to match, so the box
    // position, size, fill, border, corner radius and depth all apply live.
    // Word spacing and word size are baked into the labels, so those take effect
    // on the next round rather than stretching text mid-spin.
    this.relayoutSlot(t);

    // The options row is rebuilt on the next round; while PLAYING, re-seat it so
    // a row-x / row-y / size / gap change is visible without a reload.
    if (this.phase === PHASE.PLAYING && this.options.length > 0) {
      const rowX = width * t.optionRowXFrac;
      const rowY = height * t.optionRowYFrac;
      const size = width * t.optionSizeFrac;
      const count = this.options.length;
      const totalW = count * size + (count - 1) * t.optionGapPx;
      const startX = rowX - totalW / 2 + size / 2;

      this.options.forEach((o, i) => {
        o.homeX = startX + i * (size + t.optionGapPx);
        o.homeY = rowY;
        if (this.dragging?.option !== o) {
          o.container.setPosition(o.homeX, o.homeY);
        }
      });
    }

    this.tuningSnapshot = ctx.sceneTuning;
  }
}

// Re-exported for the scene's own animation frame keys, so nothing else has to
// import assets.js to name a frame.
export { frameKey };
