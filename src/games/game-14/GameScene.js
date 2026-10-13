// GameScene.js
// Game 14 — the train + controls + rider task, across 3 rounds.
//
// What this scene does:
//   • A horizontal reference line across the middle (visual only — the "track").
//   • A train of cars laid back-to-back, scaled so three fill the screen width,
//     sitting on the line. A single-image HEAD is the locomotive; the body cars
//     are numbered 1..N and the LAST one uses the `cartBodyEnd` art.
//   • INTRO: the train starts fully off-screen to the right and rolls in until
//     the head + first cart straddle the screen centre; only then do the control
//     buttons and the task card appear.
//   • Two hold-to-drive buttons slide the whole train along the track — but only
//     as far as being fully off each edge (see TRAIN.pan), never further.
//   • TASK: ONE card at the bottom shows an animal and the position it belongs
//     in, spelled as a word ("second"). Deal order is randomised but every
//     animal and every position is used exactly once. Animals may be dropped on
//     ANY cart (right or wrong); when every animal is placed, an "All aboard!"
//     button appears between the arrows.
//   • CHECK: tapping "All aboard!" verifies the placements. If correct the train
//     leaves off-screen to the left and the next of the 3 rounds begins; if
//     wrong the board flashes red, plays the wrong sound, and a wrong is counted.
//
// EVERY adjustable number lives in `tuning.js`, not here. This file is logic only.
//
// Coordinates are INTERNAL pixels on the 720x1080 canvas; this scene uses
// this.scale so it also survives a different base resolution.
import * as Phaser from 'phaser';
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import {
  SKY_THEME,
  CLOUDS,
  BACKGROUND,
  TRAIN,
  TRACK,
  CONTROLS,
  TRAIN_SOUND,
  CONFETTI,
} from '@/games/game-14/tuning';
import { RIDER_KEYS } from '@/games/game-14/assets';
import { makeConfettiTexture, makeConfettiSquareTexture } from '@/phaser/common/sceneAssets';

// Re-exported so `import GameScene, { BACKGROUND_COLOR }` keeps working for
// Game.jsx — the value itself lives in tuning.js.
export { BACKGROUND_COLOR } from '@/games/game-14/tuning';

// Fisher-Yates shuffle on a copy, so the task order is randomised without ever
// repeating an entry.
function shuffled(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Bakes a soft radial smoke puff once, cached under a fixed key so every puff
// (and a scene restart) reuses the same texture instead of redrawing canvas.
function makeSmokeTexture(scene) {
  const key = 'g14-smoke';
  if (scene.textures.exists(key)) return key;
  const { textureSize: size, textureStops } = TRAIN.smoke;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  textureStops.forEach(([offset, color]) => g.addColorStop(offset, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.resetRun();
  }

  // All per-RUN state. Called from the constructor AND at the top of create(),
  // because scene.restart() re-runs create() on the SAME instance (the
  // constructor does not run again) — anything initialised only there would
  // carry over into a replay.
  resetRun() {
    this.trainX = 0; // the train's current horizontal offset (moves along the track)
    this.velocity = 0; // current signed speed; eases toward the target (px/s)
    this.driveDir = 0; // -1 driving left, +1 driving right, 0 coasting/idle
    this.elapsed = 0; // ms clock, drives the idle bob
    this._prevX = 0; // last frame's trainX, to measure actual movement for sound
    this.carts = [];
    this.cartScale = 1;
    this.cartW = 0; // one car's on-screen width after scaling
    this.cartH = 0; // one car's on-screen height after scaling
    this.trackY = 0;
    this.leftBtn = null;
    this.rightBtn = null;
    this.headCart = null; // the head cart container (null if there is no head art)
    this.headSprite = null; // the head image, for its display size
    this.smokeEmitter = null; // pooled chimney-smoke emitter
    this.smokeAccum = 0; // ms accumulator for the smoke cadence
    this.trainSound = null; // looping train-running Sound (rate/volume track speed)

    // Intro / reveal state.
    this.introDone = false;
    this.controlsShown = false;
    this.locked = false; // true during a transition (blocks drags + driving)

    // Game / round state.
    this.round = 1;
    this.finished = false; // guards against emitting the completion twice
    this.mistakes = 0;
    this.stars = 0; // star rating for the finished run (end screen)
    this.streak = 0;
    this.peakStreak = 0;
    this.startTime = 0;

    // Task card state.
    this.taskParts = []; // every card object, so it can be shown/hidden together
    this.cardAnimal = null; // the draggable animal currently on the card
    this.cardLabel = null; // the spelled-position Text on the card
    this.taskKey = null; // the rider texture key shown for the current task
    this.taskNumber = null; // the cart number the current task targets
    this.riders = []; // every on-cart rider sprite (for round cleanup)
    this.tasks = new Map(); // riderKey -> cart number (the dealt task set)
    this.allAboardBtn = null;

    // Task queues. Built (shuffled) when the first task of a round is dealt, so
    // the ORDER is random but an animal can never be dealt twice.
    this.queuesReady = false;
    this.riderQueue = [];
    this.numberQueue = [];
  }

  create() {
    this.resetRun();
    this.startTime = this.time.now;

    // Full-screen countryside backdrop. When it is missing, fall back to the
    // shared sky gradient + drifting clouds so the scene is never a bare canvas.
    if (this.textures.exists(BACKGROUND.key)) {
      this.addBackgroundCover();
    } else {
      this.addSkyBackground(SKY_THEME, 'g14-sky');
      this.addDriftingClouds(CLOUDS);
    }

    // Shared bg music + first-tap unlock, plus the shared mute button. Mute is a
    // property of the player (one localStorage key) — never per-game.
    this.bgMusic = ensureBgMusic(this);
    // Retry once on the first tap in case the browser blocked autoplay.
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, CONTROLS.muteX, CONTROLS.muteY, {
      anchor: 'topLeft',
      depth: CONTROLS.muteDepth,
    });

    this.buildTrack();
    this.buildTrain();
    this.buildControls();
    this.buildTaskCard();
    this.buildAllAboard();
    this.buildTrainSound();

    // Drag handling is manual (not Phaser's built-in draggable) because riders get
    // reparented between a cart container and the scene, and Phaser's drag deltas
    // are unreliable across that. A scene-level pointermove/up drives it instead.
    this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer) => {
      this.stopDrive();
      this.onPointerUp(pointer);
    });
    this.events.once('shutdown', () => {
      this.stopDrive();
      // The SoundManager is per-Game, so a looping train bed would outlive this
      // scene unless it is stopped here.
      this.trainSound?.stop();
    });

    // Roll the train in from off-screen; on arrival the controls + card appear.
    this.startIntro();
  }

  update(_time, delta) {
    const dt = Math.min(delta, TRAIN.maxDeltaMs) / 1000; // clamp a tab-wake step
    this.elapsed += delta;

    // Ease the velocity toward the target (full speed while held, 0 when idle)
    // with exponential coasting — the train rolls away from a standstill and
    // eases to a stop rather than snapping, so it reads like a real train.
    const target = this.locked ? 0 : this.driveDir * TRAIN.speed;
    const rate = this.driveDir ? TRAIN.accel : TRAIN.brake;
    this.velocity += (target - this.velocity) * (1 - Math.exp(-rate * dt));

    // Settle the last trace of speed to rest so a stopped train is exactly still.
    if (!this.driveDir && Math.abs(this.velocity) < TRAIN.settleSpeed) this.velocity = 0;

    this.trainX += this.velocity * dt;

    // Once the intro is over, the train may be driven off either edge — but only
    // as far as being fully off-screen; past that it is clamped and stopped.
    if (this.introDone) this.clampPan();

    // Lay every cart on the track for its own position — each cart bends to the
    // line independently, so the consist follows the arch instead of rotating
    // as one rigid block.
    this.layoutCarts();
    this.emitSmoke(delta);

    // Engine sound follows the train's ACTUAL movement, so it chugs during the
    // intro/outro tweens too (those move trainX directly, without `velocity`).
    const speed = dt > 0 ? Math.abs(this.trainX - this._prevX) / dt : 0;
    this._prevX = this.trainX;
    this.updateTrainSound(dt, speed);
  }

  // ---------------------------------------------------------------------------
  // Pan limits — the train can leave the screen, but no further than that
  // ---------------------------------------------------------------------------

  panBounds() {
    const width = this.scale.width;
    const half = this.cartW / 2;
    const minRel = Math.min(...this.carts.map((c) => c.relX));
    const maxRel = Math.max(...this.carts.map((c) => c.relX));
    const pad = TRAIN.pan.overshootPad;
    // Most-negative trainX = whole train just off the LEFT edge.
    const lower = -maxRel - half - pad;
    // Most-positive trainX = whole train just off the RIGHT edge.
    const upper = width - minRel + half + pad;
    return { lower, upper };
  }

  clampPan() {
    const { lower, upper } = this.panBounds();
    if (this.trainX < lower) {
      this.trainX = lower;
      if (this.velocity < 0) this.velocity = 0;
    } else if (this.trainX > upper) {
      this.trainX = upper;
      if (this.velocity > 0) this.velocity = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Intro / round entry — fly the train in from off-screen right
  // ---------------------------------------------------------------------------

  startIntro() {
    const { upper } = this.panBounds();
    const intro = TRAIN.intro;
    // Start fully off the right edge (extra pad so frame 1 is truly empty).
    this.trainX = upper + intro.offscreenPad;
    this.layoutCarts();

    // Controls + card + all-aboard exist but are hidden until the train arrives.
    this.setControlsVisible(false);
    this.setTaskVisible(false);
    this.setAllAboardVisible(false);

    this.flyIn(intro.durationMs, intro.ease, () => {
      this.introDone = true;
      this.revealControlsAndTask();
    });
  }

  // Fly the train from its current (off-screen) position to the centred rest
  // position where the two intro carts straddle the screen centre.
  flyIn(durationMs, ease, onComplete) {
    const width = this.scale.width;
    const { upper } = this.panBounds();
    const intro = TRAIN.intro;
    const iFrom = Math.min(intro.centerFrom, this.carts.length - 1);
    const iTo = Math.min(intro.centerTo, this.carts.length - 1);
    const midRel = (this.carts[iFrom].relX + this.carts[iTo].relX) / 2;
    const endX = Math.min(width / 2 - midRel, upper);
    this.tweens.add({
      targets: this,
      trainX: endX,
      duration: durationMs,
      ease,
      onUpdate: () => this.layoutCarts(),
      onComplete,
    });
  }

  revealControlsAndTask() {
    if (this.controlsShown) return;
    this.controlsShown = true;

    // Controls pop in.
    this.setControlsVisible(true);
    [this.leftBtn, this.rightBtn].forEach((btn) => {
      const c = btn?.container;
      if (!c) return;
      c.setScale(0.6).setAlpha(0);
      this.tweens.add({
        targets: c,
        scale: 1,
        alpha: 1,
        duration: TRAIN.rider.popInDurationMs,
        ease: TRAIN.rider.popInEase,
      });
    });

    // Card fades in, then the first task is dealt.
    if (this.taskParts.length) {
      this.setTaskVisible(true);
      this.taskParts.forEach((o) => o.setAlpha(0));
      this.tweens.add({
        targets: this.taskParts,
        alpha: 1,
        duration: TRAIN.rider.popInDurationMs,
        ease: 'Sine.easeOut',
        onComplete: () => this.dealTask(),
      });
    } else {
      this.dealTask();
    }
  }

  setControlsVisible(visible) {
    [this.leftBtn, this.rightBtn].forEach((btn) => btn?.container?.setVisible(visible));
  }

  setTaskVisible(visible) {
    this.taskParts.forEach((o) => o.setVisible(visible));
  }

  setAllAboardVisible(visible) {
    this.allAboardBtn?.container?.setVisible(visible);
  }

  // Position each cart on the curved track: its own x, its own y from the line,
  // and its own rotation from the local slope. Called every frame, and once when
  // the train is first built.
  layoutCarts() {
    for (let i = 0; i < this.carts.length; i += 1) {
      const cart = this.carts[i];
      const x = this.trainX + cart.relX;
      cart.x = x;
      // Its own point on the line, plus a gentle per-cart bob phase-shifted
      // along the consist so the cars ripple like a real train.
      cart.y =
        this.trackYAt(x) +
        Math.sin(this.elapsed / TRAIN.bobPeriodMs + i * TRAIN.bobPhaseStep) * TRAIN.bobAmplitude;
      cart.rotation = Math.atan(this.trackSlopeAt(x));
    }
  }

  // ---------------------------------------------------------------------------
  // Train sound — a looping "train running" bed whose rate + volume follow the
  // train's speed (see TRAIN_SOUND in tuning.js)
  // ---------------------------------------------------------------------------

  buildTrainSound() {
    if (!this.cache.audio.exists(TRAIN_SOUND.key)) return;
    this.trainSound = this.sound.add(TRAIN_SOUND.key, {
      loop: TRAIN_SOUND.loop,
      volume: TRAIN_SOUND.quietVolume,
      rate: TRAIN_SOUND.restRate,
    });
    const tryPlay = () => {
      if (this.trainSound && !this.trainSound.isPlaying) this.trainSound.play();
    };
    // Try now; if the browser blocked autoplay, retry on the first unlock.
    tryPlay();
    this.sound.once('unlocked', tryPlay);
  }

  // Glide the rate and volume toward targets derived from the current speed.
  // `speedFrac` is |velocity| / top speed, so full speed = 1 and a stop = 0.
  // `speed` is the train's actual px/s this frame — from the player's driving OR
  // an intro/outro tween, so the engine is heard whenever the train is moving.
  updateTrainSound(dt, speed) {
    const s = this.trainSound;
    if (!s) return;
    const cfg = TRAIN_SOUND;
    const speedFrac = Math.min(1, speed / TRAIN.speed);
    const targetRate = cfg.restRate + cfg.rateRange * speedFrac;
    const targetVol = cfg.quietVolume + (cfg.loudVolume - cfg.quietVolume) * speedFrac;
    // Exponential smoothing, frame-rate independent. setRate() (not a bare
    // `s.rate =`) so the underlying audio node is actually updated.
    s.setRate(s.rate + (targetRate - s.rate) * (1 - Math.exp(-cfg.smoothRate * dt)));
    s.setVolume(s.volume + (targetVol - s.volume) * (1 - Math.exp(-cfg.smoothVolume * dt)));
  }

  // ---------------------------------------------------------------------------
  // Chimney smoke — cheap pooled puffs from a fixed point on the head
  // ---------------------------------------------------------------------------

  buildSmokeEmitter() {
    if (!this.headCart) return; // no head art → nothing to smoke from
    const key = makeSmokeTexture(this);
    if (!this.textures.exists(key)) return;
    const s = TRAIN.smoke;
    this.smokeEmitter = this.add.particles(0, 0, key, {
      lifespan: { min: s.lifeMinMs, max: s.lifeMaxMs },
      speedY: { min: s.riseMin, max: s.riseMax }, // both negative → rises
      speedX: { min: -s.driftX, max: s.driftX },
      scale: { start: s.scaleMin, end: s.scaleMax },
      alpha: { start: s.alphaStart, end: 0 },
      tint: s.tint,
      quantity: 0,
      emitting: false,
    });
    this.smokeEmitter.setDepth(TRAIN.smokeDepth);
  }

  // Emit on a cadence from a FIXED point on the head (its chimney). The position
  // never depends on the direction of travel or on speed — the plume always
  // rises from the exact same spot.
  emitSmoke(delta) {
    const emitter = this.smokeEmitter;
    if (!emitter || !this.headCart || !this.headSprite) return;

    this.smokeAccum += delta;
    if (this.smokeAccum < TRAIN.smoke.everyMs) return;
    this.smokeAccum = 0;

    const hw = this.headSprite.displayWidth;
    const hh = this.headSprite.displayHeight;
    const x = this.headCart.x + hw * TRAIN.smoke.chimneyX;
    const y = this.headCart.y - hh / 2 + TRAIN.smoke.topOffset;
    emitter.explode(TRAIN.smoke.quantity, x, y);
  }

  // The vertical position of the track line at an internal screen x, in px. The
  // line and the carts share this, so a cart always sits exactly on the line.
  trackYAt(x) {
    const base = this.scale.height * TRACK.yFrac;
    const k = (Math.PI * 2 * TRACK.curveWaves) / this.scale.width;
    return base + TRACK.curveAmplitude * Math.sin(k * x + TRACK.curvePhase);
  }

  // dY/dX of the track at an x — used to rotate a cart to the local slope.
  trackSlopeAt(x) {
    const k = (Math.PI * 2 * TRACK.curveWaves) / this.scale.width;
    return TRACK.curveAmplitude * k * Math.cos(k * x + TRACK.curvePhase);
  }

  // Draw the background image COVER-scaled: scaled so it fills the canvas on
  // both axes (never stretched), centred, and behind everything else.
  addBackgroundCover() {
    const { width, height } = this.scale;
    const img = this.add.image(width / 2, height / 2, BACKGROUND.key).setDepth(BACKGROUND.depth);
    img.setScale(Math.max(width / img.width, height / img.height));
    return img;
  }

  // ---------------------------------------------------------------------------
  // Track — a dashed horizontal reference line across the middle
  // ---------------------------------------------------------------------------

  buildTrack() {
    const { width } = this.scale;
    // Base (unbent) y — the mid-height centre line.
    this.trackY = this.scale.height * TRACK.yFrac;

    const gfx = this.add.graphics().setDepth(0);
    gfx.lineStyle(TRACK.thickness, TRACK.color, TRACK.lineAlpha);

    // Follow the same curve the carts ride, sampled finely so the dashes read as
    // one gently bending line rather than a flat rail. Alternate drawing/blank
    // runs of TRACK.dash / TRACK.gap produce the dashes along the bend.
    const step = TRACK.drawStep;
    const period = TRACK.dash + TRACK.gap;
    let drawing = true;
    for (let x = 0; x <= width; x += step) {
      const y = this.trackYAt(x);
      if (drawing) {
        gfx.beginPath();
        gfx.moveTo(x, y);
        drawing = false;
      } else {
        gfx.lineTo(x, y);
        // Complete this dash once we have filled its run.
        if (x % period >= TRACK.dash - step) {
          gfx.strokePath();
          drawing = true;
        }
      }
    }
    gfx.strokePath();
  }

  // ---------------------------------------------------------------------------
  // Train — the cars + head, laid along the track
  // ---------------------------------------------------------------------------

  buildTrain() {
    const { width } = this.scale;
    const hasArt = this.textures.exists('cartLid') && this.textures.exists('cartBody');
    const hasHead = this.textures.exists('trainHead');

    // Target one cart's on-screen width so `visibleCarts` of them span the
    // screen. The body defines the cart's width; a probe gives its source size
    // so the shared scale can be derived.
    const targetW = width / TRAIN.visibleCarts;

    let scale = 1;
    let cartW = targetW;
    let cartH = targetW * TRAIN.placeholderAspect;
    let lidH = 0;
    let bodyH = 0;
    if (hasArt) {
      const probe = this.add.image(0, 0, 'cartBody').setVisible(false);
      scale = targetW / probe.width;
      cartW = probe.width * scale;
      bodyH = probe.height * scale;
      // The lid is scaled by the SAME factor so it aligns with the body even if
      // the two source images are different pixel sizes.
      const lidSrc = this.textures.get('cartLid').getSourceImage();
      lidH = lidSrc.height * scale;
      cartH = bodyH + lidH; // the stacked cart's total height
      probe.destroy();
    }
    this.cartScale = scale;
    this.cartW = cartW;
    this.cartH = cartH;

    // Carts butt directly against each other — no gap between adjacent carts.
    const step = cartW; // spacing between adjacent cart CENTRES
    const span = step * (TRAIN.carts - 1);
    const startOffset = -span / 2; // local offsets centred on the container origin

    // The ENDING cart index — normally the LAST cart, whatever the count/order.
    const endIndex = TRAIN.endCartIndex < 0 ? TRAIN.carts - 1 : TRAIN.endCartIndex;
    const hasEndArt = this.textures.exists('cartBodyEnd');

    // The body cars carry the number 1..N along the consist; the locomotive
    // (which has no body) is skipped so the count runs across the body cars.
    let numberSeq = 0;

    // Draw order inside a cart (back to front): LID, then the RIDER (added later
    // via addAt(1)), then BODY, then the NUMBER — so a rider sits behind the body
    // but in front of the lid, and the number sits on top of the body.
    for (let i = 0; i < TRAIN.carts; i += 1) {
      const isHead = hasHead && i === TRAIN.headIndex;
      // The head's whole container sits at a HIGHER depth, so it reads as being
      // in front of the carts rather than tucked behind its neighbour.
      const cart = this.add.container(0, 0).setDepth(isHead ? TRAIN.headDepth : TRAIN.cartDepth);
      cart.relX = startOffset + i * step;
      cart.isHead = isHead;
      cart.riderSlot = null; // the rider image once one is dropped here
      cart.number = null; // the cart's 1..N number (body cars only)

      if (isHead) {
        // The locomotive. Its own single image (no lid/body split), but scaled by
        // the SAME factor as the carts and centred on the cart origin — exactly
        // like the lid+body stack — so it lines up with the consist instead of
        // sitting proud of it.
        const head = this.add.image(0, 0, 'trainHead').setOrigin(0.5).setScale(scale);
        cart.add(head);
        cart.cartBody = head;
        this.headCart = cart;
        this.headSprite = head;
      } else if (hasArt) {
        numberSeq += 1;
        cart.number = numberSeq;
        const isEnd = i === endIndex && hasEndArt;
        // Body sits at the bottom of the stack; its centre is half a cart-height
        // (body + lid) below the cart's own centre.
        const bodyY = cartH / 2 - bodyH / 2;
        // Lid sits directly on top of the body: its bottom edge meets the body's
        // top edge, so its centre is half a lid-height above that seam.
        const lidY = -cartH / 2 + lidH / 2 - TRAIN.lidOverlap;
        const lid = this.add.image(0, lidY, 'cartLid').setOrigin(0.5).setScale(scale);
        const body = this.add
          .image(0, bodyY, isEnd ? 'cartBodyEnd' : 'cartBody')
          .setOrigin(0.5)
          .setScale(scale);
        // Lid FIRST, then body → body draws in front. A rider dropped here is
        // inserted between them (addAt 1).
        cart.add([lid, body]);
        cart.cartBody = body;

        // Big bold number, centred on the body, drawn on top of it.
        const numY = bodyY + TRAIN.number.yOffsetFrac * cartH;
        const num = this.add
          .text(0, numY, String(numberSeq), {
            fontFamily: TRAIN.number.fontFamily,
            fontSize: `${Math.round(cartW * TRAIN.number.sizeFrac)}px`,
            color: TRAIN.number.color,
            fontStyle: 'bold',
            stroke: TRAIN.number.stroke,
            strokeThickness: Math.max(1, Math.round(cartW * TRAIN.number.strokeFrac)),
          })
          .setOrigin(0.5);
        cart.add(num);
        cart.numberText = num;
      } else {
        // No artwork loaded yet: a single block so the mechanic and controls are
        // still visible while the assets load.
        const block = this.add.rectangle(0, 0, cartW, cartH, TRAIN.placeholderColor).setOrigin(0.5);
        cart.add(block);
      }

      this.carts.push(cart);
    }

    // Start fully off-screen to the right; the intro tween drives trainX in.
    this.trainX = this.panBounds().upper;
    this.layoutCarts();

    // Chimney smoke for the head (no-op when there is no head art).
    this.buildSmokeEmitter();
  }

  // ---------------------------------------------------------------------------
  // Controls — hold-to-drive buttons, top-left (left) and top-right (right)
  // ---------------------------------------------------------------------------

  buildControls() {
    const { width } = this.scale;

    this.leftBtn = this.createPillButton(CONTROLS.edgeInset, CONTROLS.y, CONTROLS.glyphLeft, {
      fontSize: CONTROLS.fontSize,
      minWidth: CONTROLS.minWidth,
      minHeight: CONTROLS.minHeight,
    });
    this.bindHold(this.leftBtn, -1);

    this.rightBtn = this.createPillButton(
      width - CONTROLS.edgeInset,
      CONTROLS.y,
      CONTROLS.glyphRight,
      {
        fontSize: CONTROLS.fontSize,
        minWidth: CONTROLS.minWidth,
        minHeight: CONTROLS.minHeight,
      }
    );
    this.bindHold(this.rightBtn, +1);

    // Hidden until the intro finishes.
    this.setControlsVisible(false);
  }

  // Wire a control so holding it drives the train in `dir`. The shared pill
  // button already provides press feedback; here we add the drive intent.
  bindHold(button, dir) {
    button.on('pointerdown', () => this.startDrive(dir));
    button.on('pointerup', () => this.stopDrive());
    button.on('pointerout', () => this.stopDrive());
  }

  startDrive(dir) {
    if (!this.introDone || this.locked) return; // no driving until it has arrived
    this.driveDir = dir;
  }

  stopDrive() {
    this.driveDir = 0;
  }

  // ---------------------------------------------------------------------------
  // All aboard — the confirm button between the arrows
  // ---------------------------------------------------------------------------

  buildAllAboard() {
    const { width, height } = this.scale;
    const cfg = TRAIN.allAboard;
    this.allAboardBtn = this.createPillButton(width / 2, height * cfg.yFrac, cfg.label, {
      fontSize: cfg.fontSize,
      minWidth: cfg.minWidth,
      minHeight: cfg.minHeight,
      depth: cfg.depth,
    });
    this.allAboardBtn.on('pointerup', () => this.checkAllAboard());
    this.setAllAboardVisible(false);
  }

  // Tapping All aboard: every animal is already on its correct cart (a wrong
  // drop is rejected on the spot), so this simply confirms and rolls on. It is
  // gated on the board actually being complete.
  checkAllAboard() {
    if (this.locked || !this.allAboardTrue()) return;
    this.onCorrectRound();
  }

  wrongAnswer() {
    const cfg = TRAIN.allAboard;
    this.mistakes += 1;
    this.streak = 0;
    this.sound.play(cfg.wrongKey, { volume: 0.7 });

    // Flash + shake the whole board red so the miss reads instantly.
    const c = cfg.flashColor;
    this.cameras.main.flash(cfg.flashDurationMs, (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
    this.cameras.main.shake(cfg.shakeDurationMs, cfg.shakeAmplitude / this.scale.width);
  }

  onCorrectRound() {
    this.spawnConfetti();
    this.locked = true;
    this.stopDrive();
    this.peakStreak = Math.max(this.peakStreak, (this.streak += 1));
    this.setAllAboardVisible(false);

    const cfg = TRAIN.placement;
    this.time.delayedCall(cfg.leaveDelayMs, () => {
      // Controls pop out and the train leaves off screen to the LEFT.
      this.setControlsVisible(false);
      this.setTaskVisible(false);
      this.leaveTrain(() => this.nextRound());
    });
  }

  // A short burst of coloured confetti pieces drifting down from above the
  // canvas — the round's "well done" beat after All aboard is confirmed.
  spawnConfetti(count = CONFETTI.count) {
    const { width, height } = this.scale;
    const keys = [makeConfettiTexture(this), makeConfettiSquareTexture(this)];
    for (let i = 0; i < count; i += 1) {
      const piece = this.add
        .image(
          Phaser.Math.Between(20, width - 20),
          Phaser.Math.Between(CONFETTI.startMinY, CONFETTI.startMaxY),
          keys[i % keys.length]
        )
        .setDepth(CONFETTI.depth)
        .setTint(Phaser.Utils.Array.GetRandom(CONFETTI.tints))
        .setScale(Phaser.Math.FloatBetween(CONFETTI.minScale, CONFETTI.maxScale))
        .setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: piece,
        x: piece.x + Phaser.Math.Between(-CONFETTI.swayX, CONFETTI.swayX),
        y: height + 60,
        angle: piece.angle + Phaser.Math.Between(220, 620),
        duration: Phaser.Math.Between(CONFETTI.fallMinMs, CONFETTI.fallMaxMs),
        delay: i * 40,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  // Roll the train fully off the left edge, then run `onDone`.
  leaveTrain(onDone) {
    const { lower } = this.panBounds();
    const target = lower - TRAIN.intro.offscreenPad;
    this.tweens.add({
      targets: this,
      trainX: target,
      duration: TRAIN.placement.leaveDurationMs,
      ease: TRAIN.placement.leaveEase,
      onUpdate: () => this.layoutCarts(),
      onComplete: onDone,
    });
  }

  nextRound() {
    this.round += 1;
    if (this.round > TRAIN.rounds) {
      this.finish();
      return;
    }
    // Reset the board for the new round while the train is off screen, then fly
    // it back in from the right.
    this.time.delayedCall(TRAIN.placement.betweenRoundsMs, () => {
      this.resetRoundBoard();
      const { upper } = this.panBounds();
      this.trainX = upper + TRAIN.intro.offscreenPad;
      this.layoutCarts();
      this.flyIn(TRAIN.intro.durationMs * 0.85, TRAIN.intro.ease, () => {
        // The round transition unlocks the board again — otherwise the controls
        // and dragging stay dead for every round after the first.
        this.locked = false;
        this.setControlsVisible(true);
        this.setTaskVisible(true);
        this.dealTask();
      });
    });
  }

  // Clear the previous round's riders + task state, ready for a fresh deal.
  resetRoundBoard() {
    for (const cart of this.carts) {
      if (cart.riderSlot) {
        cart.riderSlot.destroy();
        cart.riderSlot = null;
      }
    }
    this.riders = [];
    this.tasks.clear();
    this.queuesReady = false;
    this.riderQueue = [];
    this.numberQueue = [];
    this.destroyCardAnimal();
    this.taskKey = null;
    this.taskNumber = null;
    this.drag = null;
    this.setAllAboardVisible(false);
  }

  // The whole game is done (all TRAIN.rounds cleared): show the completion, then
  // emit the payload the shared shell logs — the same shape the other games use,
  // so `mistakes` is stored as the wrong-count and stars/totalRounds feed stats.
  finish() {
    if (this.finished) return; // never log twice
    this.finished = true;
    this.locked = true;
    this.setControlsVisible(false);
    this.setTaskVisible(false);
    this.setAllAboardVisible(false);

    const mistakes = this.mistakes;
    this.stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;

    const payload = {
      stars: this.stars,
      totalRounds: TRAIN.rounds,
      peakStreak: this.peakStreak,
      mistakes,
      elapsedSeconds: Math.round((this.time.now - this.startTime) / 1000),
    };
    // The shared shell (Game.jsx) listens for this and logs the play session —
    // `mistakes` is the wrong-count the server stores.
    this.game.events.emit('game14-complete', payload);

    this.showEndOverlay();
  }

  // The shared end screen every other game uses: a dim wash, a white rounded
  // panel with a title, the star row and a wrong count, and a Play Again button
  // that restarts the scene.
  showEndOverlay() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 0.6).setDepth(300);

    const panel = this.add.container(width / 2, height / 2).setDepth(301).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-220, -170, 440, 340, 28);
    bg.lineStyle(6, 0xf59e0b, 1);
    bg.strokeRoundedRect(-220, -170, 440, 340, 28);
    panel.add(bg);

    const title = this.add
      .text(0, -80, 'All aboard!', {
        fontSize: '40px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#3b2f1e',
      })
      .setOrigin(0.5);
    panel.add(title);

    const stars = this.add
      .text(0, -10, '\u2B50'.repeat(this.stars), { fontSize: '40px' })
      .setOrigin(0.5);
    panel.add(stars);

    const note = this.add
      .text(0, 50, `${this.mistakes} ${this.mistakes === 1 ? 'wrong' : 'wrongs'}`, {
        fontSize: '22px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#8a7758',
      })
      .setOrigin(0.5);
    panel.add(note);

    const btn = this.createPillButton(width / 2, height / 2 + 128, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 302,
    });
    btn.on('pointerup', () => this.scene.restart());
  }

  // ---------------------------------------------------------------------------
  // Task card — ONE card at the bottom, showing an animal + its spelled position
  // ---------------------------------------------------------------------------

  buildTaskCard() {
    const { width, height } = this.scale;
    const cfg = TRAIN.task;
    const cx = width / 2;
    const cy = height * cfg.cardYFrac;
    this.taskCardPos = { x: cx, y: cy };

    const card = this.add.graphics().setDepth(cfg.depth);
    card.fillStyle(0x000000, cfg.shadowAlpha);
    card.fillRoundedRect(
      cx - cfg.cardW / 2 + cfg.shadowOffset,
      cy - cfg.cardH / 2 + cfg.shadowOffset,
      cfg.cardW,
      cfg.cardH,
      cfg.radius
    );
    card.fillStyle(cfg.fill, cfg.fillAlpha);
    card.fillRoundedRect(cx - cfg.cardW / 2, cy - cfg.cardH / 2, cfg.cardW, cfg.cardH, cfg.radius);
    card.lineStyle(cfg.borderWidth, cfg.border, 1);
    card.strokeRoundedRect(cx - cfg.cardW / 2, cy - cfg.cardH / 2, cfg.cardW, cfg.cardH, cfg.radius);
    this.taskParts.push(card);

    // The spelled position label, in the upper part of the card.
    this.cardLabel = this.add
      .text(cx, cy + cfg.labelYFrac * cfg.cardH, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${cfg.labelFontSize}px`,
        color: cfg.labelColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(cfg.depth + 1);
    this.taskParts.push(this.cardLabel);

    // Hidden until the intro finishes.
    this.setTaskVisible(false);
  }

  // Build the two shuffled queues once per round: one entry per numbered cart
  // (its position) and one entry per rider. Every rider and every position is
  // used exactly once; only the ORDER they arrive in is random.
  prepareTaskQueues() {
    this.queuesReady = true;
    // De-dupe defensively, then shuffle: neither a position nor an animal can be
    // dealt twice in a round.
    const numbers = [...new Set(this.carts.filter((c) => c.number).map((c) => c.number))];
    this.numberQueue = shuffled(numbers);
    this.riderQueue = shuffled([...new Set(RIDER_KEYS.filter((k) => this.textures.exists(k)))]);
    this.tasks.clear();
  }

  // Deal the next task: take the next animal and the next position off the
  // queues, spell the position, and put that animal on the card.
  dealTask() {
    const cfg = TRAIN.task;
    if (!this.queuesReady) this.prepareTaskQueues();

    if (this.riderQueue.length === 0 || this.numberQueue.length === 0) {
      // Every animal is dealt; the confirm button takes over.
      this.showAllAboard();
      return;
    }

    const number = this.numberQueue.shift();
    const key = this.riderQueue.shift();
    this.taskKey = key;
    this.taskNumber = number;
    // Record the correct placement for the check: THIS animal rides THIS cart.
    this.tasks.set(key, number);
    this.cardLabel.setText(this.ordinalFor(number));

    // Replace the card animal (remove it from taskParts too, so the show/hide
    // sweep never touches a destroyed object).
    this.destroyCardAnimal();
    if (!this.textures.exists(key)) return;

    const src = this.textures.get(key).getSourceImage();
    const s = cfg.animalSize / Math.max(src?.width || 1, src?.height || 1);
    const x = this.taskCardPos.x;
    const y = this.taskCardPos.y + cfg.animalYFrac * cfg.cardH;
    const sprite = this.add.image(x, y, key).setOrigin(0.5).setScale(s).setDepth(cfg.depth + 2);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', (pointer) => this.beginRiderDrag(sprite, pointer));

    this.cardAnimal = sprite;
    this.taskParts.push(sprite);
    if (!this.controlsShown) this.setTaskVisible(false);
  }

  destroyCardAnimal() {
    if (!this.cardAnimal) return;
    const s = this.cardAnimal;
    this.cardAnimal = null;
    const i = this.taskParts.indexOf(s);
    if (i >= 0) this.taskParts.splice(i, 1);
    s.destroy();
  }

  ordinalFor(number) {
    const words = TRAIN.task.ordinals;
    return words[number - 1] || `${number}th`;
  }

  // ---------------------------------------------------------------------------
  // Placement check helpers
  // ---------------------------------------------------------------------------

  // A numbered cart still without a rider.
  emptyNumberCart() {
    return this.carts.some((c) => c.number && !c.riderSlot);
  }

  // True when every numbered cart holds a rider.
  allAboardTrue() {
    const numberCarts = this.carts.filter((c) => c.number);
    return numberCarts.length > 0 && numberCarts.every((c) => c.riderSlot);
  }

  showAllAboard() {
    this.destroyCardAnimal();
    this.taskKey = null;
    this.taskNumber = null;
    this.setAllAboardVisible(true);
    this.allAboardBtn?.container?.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: this.allAboardBtn?.container,
      scale: 1,
      alpha: 1,
      duration: TRAIN.rider.popInDurationMs,
      ease: TRAIN.rider.popInEase,
    });
  }

  // ---------------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------------

  // Cart-local position + scale an ON-CART rider should have.
  riderLocalPos() {
    const cfg = TRAIN.rider;
    return { x: cfg.xFrac * this.cartW + cfg.offsetX, y: cfg.yFrac * this.cartH + cfg.offsetY };
  }

  riderScaleFor(key) {
    const src = this.textures.get(key).getSourceImage();
    return (this.cartW * TRAIN.rider.scaleFrac) / (src?.width || 1);
  }

  cardAnimalScaleFor(key) {
    const src = this.textures.get(key).getSourceImage();
    return TRAIN.task.animalSize / Math.max(src?.width || 1, src?.height || 1);
  }

  // Begin a drag from a pointerdown. `origin` is 'card' (the task-card animal) or
  // 'cart' (a rider already on a cart). The sprite becomes a scene-level object
  // parented at its WORLD position, then follows the pointer until release.
  beginRiderDrag(sprite, pointer) {
    // Only the CARD animal is draggable. Once a rider is seated it has a `cart`,
    // so any further pointerdown on it is ignored — placed animals are fixed.
    if (!this.introDone || this.locked || this.drag || sprite.cart) return;

    // Kill any return/grow tween still running on the sprite.
    this.tweens.killTweensOf(sprite);

    sprite.setPosition(pointer.x, pointer.y);
    sprite.setDepth(TRAIN.rider.dragDepth);
    sprite.setAlpha(TRAIN.rider.dragAlpha);
    // Grow to the on-cart size so it is the size it will be when it lands.
    this.tweens.add({
      targets: sprite,
      scale: this.riderScaleFor(sprite.texture.key),
      duration: TRAIN.task.grabGrowMs,
      ease: TRAIN.task.grabEase,
    });

    this.drag = { sprite };
  }

  onPointerMove(pointer) {
    if (!this.drag) return;
    const s = this.drag.sprite;
    if (s.active) s.setPosition(pointer.x, pointer.y);
  }

  onPointerUp() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const { sprite } = drag;
    sprite.setAlpha(1);

    const cart = this.cartUnder(sprite.x, sprite.y);

    if (cart && !cart.riderSlot && cart.number === this.taskNumber) {
      // Correct cart: it stays. The dragged sprite BECOMES the on-cart rider —
      // detach the card bookkeeping WITHOUT destroying it.
      this.attachRiderToCart(cart, sprite);
      this.forgetCardAnimal(sprite);
      if (this.emptyNumberCart()) this.dealTask();
      else this.showAllAboard();
      return;
    }

    if (cart) {
      // Wrong cart (or an already-filled one): register a wrong and send the
      // animal back to the card to try again.
      this.wrongAnswer();
    }

    // Off the carts, or wrong: float back to the card, still ungrown.
    this.returnToCard(sprite);
    sprite.setDepth(TRAIN.task.depth + 2);
  }

  // Re-seat a scene-level rider sprite into a cart: reparent into the cart
  // container between the lid (0) and the body (1→2).
  attachRiderToCart(cart, sprite) {
    this.tweens.killTweensOf(sprite);
    this.children.remove(sprite);
    cart.addAt(sprite, 1);
    const pos = this.riderLocalPos();
    sprite.setPosition(pos.x, pos.y).setScale(this.riderScaleFor(sprite.texture.key));
    cart.riderSlot = sprite;
    sprite.cart = cart;
    // Placed animals are fixed — no further dragging.
    sprite.disableInteractive();
    this.seatPop(sprite);
  }

  seatPop(sprite) {
    const cfg = TRAIN.rider;
    // The pop sound fires exactly when an animal is placed on a cart.
    this.sound.play('pop1', { volume: 0.7 });
    const base = this.riderScaleFor(sprite.texture.key);
    sprite.setScale(base * cfg.landScaleFrom);
    this.tweens.add({
      targets: sprite,
      scale: base,
      duration: cfg.landDurationMs,
      ease: cfg.landEase,
    });
  }

  // Drop the card's record of a sprite that is still alive (it has just been
  // seated on a cart). Never destroys the sprite.
  forgetCardAnimal(sprite) {
    if (this.cardAnimal === sprite) this.cardAnimal = null;
    const i = this.taskParts.indexOf(sprite);
    if (i >= 0) this.taskParts.splice(i, 1);
    this.taskKey = null;
    this.taskNumber = null;
  }

  returnToCard(sprite) {
    const cfg = TRAIN.task;
    this.tweens.add({
      targets: sprite,
      x: this.taskCardPos.x,
      y: this.taskCardPos.y + cfg.animalYFrac * cfg.cardH,
      scale: this.cardAnimalScaleFor(sprite.texture.key),
      duration: cfg.returnMs,
      ease: 'Sine.easeOut',
    });
  }

  // The cart whose drop box contains a point (body cars only — the head is not a
  // drop target).
  cartUnder(x, y) {
    const halfW = this.cartW * TRAIN.rider.dropHalfWFrac;
    const halfH = this.cartH * TRAIN.rider.dropHalfHFrac;
    for (const cart of this.carts) {
      if (cart.isHead) continue;
      if (Math.abs(x - cart.x) <= halfW && Math.abs(y - cart.y) <= halfH) return cart;
    }
    return null;
  }
}
