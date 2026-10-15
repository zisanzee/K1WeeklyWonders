// GameScene.js
// Choo-Choo to the Zoo! — the train + controls + rider task, across 3 LEVELS.
//
// What this scene does:
//   • A train of cars laid back-to-back, scaled so `visibleCarts` fill the screen
//     width, riding an invisible curved track (the line is reference-only — see
//     TRACK.show). A single-image HEAD is the locomotive; the body cars are
//     numbered 1..N and the LAST one uses the level's `cartBodyEnd` art.
//   • LEVELS (see LEVELS in tuning.js): each swaps the backdrop, the cart
//     colours and the number of carts — level 1 = 5 green carts (day), level 2 =
//     7 red carts (autumn), level 3 = 10 blue carts (night, with a dark tint on
//     the riders + locomotive). Each level runs `roundsPerLevel` rounds.
//   • INTRO: on each level the train starts fully off-screen to the right and
//     rolls in until the head + first cart straddle the centre; only then do the
//     controls and the task card appear.
//   • Two hold-to-drive zones flank the card at the bottom (a tap anywhere in
//     the side area works) with arrow buttons; a 1..N number line sits on top.
//     The train may only be driven as far as being fully off each edge.
//   • TASK: ONE card at the bottom shows an animal and the position it belongs
//     in, spelled as a word ("second"). Deal order is randomised but every
//     animal and every position is used exactly once. An animal dropped on the
//     WRONG cart registers a wrong and returns to the card; dropped on the right
//     cart it stays. When the last one lands the train celebrates (confetti) and
//     rolls out to the next round/level — auto, with no confirm button.
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
  BACKGROUND_DEPTH,
  START_SCREEN,
  VOICE,
  LEVELS,
  TRAIN,
  TRACK,
  CONTROLS,
  NUMBER_SLIDER,
  TRAIN_SOUND,
  CONFETTI,
} from '@/games/game-14/tuning';
import { RIDER_KEYS } from '@/games/game-14/assets';
import { makeConfettiTexture, makeConfettiSquareTexture } from '@/phaser/common/sceneAssets';

// Re-exported so `import GameScene, { BACKGROUND_COLOR }` keeps working for
// Game.jsx — the value itself lives in tuning.js.
export { BACKGROUND_COLOR } from '@/games/game-14/tuning';

// "1" → "1st", "2" → "2nd", "3" → "3rd", "4" → "4th", … (handles the 11–13
// exceptions). Used for the number painted on each cart's body.
function ordinalSuffix(n) {
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
    this.cartW = 0; // one car's on-screen width after scaling
    this.cartH = 0; // one car's on-screen height after scaling
    // Caches. The track curve constants and pan limits depend only on the level
    // and the layout, so they are computed ONCE per level instead of per frame.
    this.trackBaseY = 0;
    this.trackK = 0;
    this._pan = { lower: 0, upper: 0 };
    // True only while a tween is animating trainX (intro roll-in / outro) — then
    // update() must not also integrate velocity, or the two would fight.
    this.autoMoving = false;
    this.leftBtn = null;
    this.rightBtn = null;
    this.headCart = null; // the head cart container (null if there is no head art)
    this.headSprite = null; // the head image, for its display size
    this.smokeEmitter = null; // pooled chimney-smoke emitter
    this.smokeAccum = 0; // ms accumulator for the smoke cadence
    this.trainSound = null; // looping train-running Sound (rate/volume track speed)
    this.bgImage = null; // the current level's backdrop image

    // Intro / reveal state.
    this.started = false; // false while the start screen is up
    this.introDone = false;
    this.controlsShown = false;
    this.locked = false; // true during a transition (blocks drags + driving)
    this.startOverlay = null; // the start screen container
    this.startBtn = null;
    // Voice.
    this.startVoiceSound = null; // the welcome line (cut off on Start)
    this.voiceSound = null; // the current spoken ordinal line
    this.soundBtn = null; // the small replay-sound button beside the card
    this.soundGlow = null; // the glow layer behind the sound button
    // Number slider.
    this.sliderParts = []; // band + highlight + label (screen-space objects)
    this.sliderStrip = null; // the scrolling container of numbers
    this.sliderNumbers = []; // the number Text objects
    this.sliderZone = null; // the drag/tap surface
    this.sliderHighlight = null;
    this.sliderMask = null; // geometry mask keeping numbers inside the band
    this.sliderLabel = null; // the spelled ordinal below the highlight
    this.sliderValues = []; // [1..count]
    this.sliderCellW = 0;
    this.sliderCX = 0;
    this.selectedIndex = 0; // 0-based index under the centre marker
    this.sliderDrag = null; // { startX, stripStartX, moved } while dragging

    // Level / game state.
    this.levelIndex = 0;
    this.roundInLevel = 1; // 1..TRAIN.roundsPerLevel (re-rolls on the same level)
    this.finished = false; // guards against emitting the completion twice
    this.mistakes = 0;
    this.stars = 0; // star rating for the finished run (end screen)
    this.peakStreak = 0;
    this.startTime = 0;

    // Task card state.
    this.taskParts = []; // every card object, so it can be shown/hidden together
    this.cardAnimal = null; // the draggable animal currently on the card
    this.cardLabel = null; // the spelled-position Text on the card
    this.taskKey = null; // the rider texture key shown for the current task
    this.taskNumber = null; // the cart number the current task targets

    // Task queues. Built (shuffled) when the first task of a level is dealt, so
    // the ORDER is random but an animal can never be dealt twice.
    this.queuesReady = false;
    this.riderQueue = [];
    this.numberQueue = [];
    this.drag = null;
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  create() {
    this.resetRun();
    this.startTime = this.time.now;

    // Track curve constants depend only on the resolution — compute once.
    this.cacheTrack();

    // The level's backdrop (level 1 on load). Missing art falls back to the
    // shared sky gradient + drifting clouds so the canvas is never bare.
    this.buildBackground();

    // Shared bg music + first-tap unlock, plus the shared mute button. Mute is a
    // property of the player (one localStorage key) — never per-game.
    this.bgMusic = ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, CONTROLS.muteX, CONTROLS.muteY, {
      anchor: 'topLeft',
      depth: CONTROLS.muteDepth,
    });

    this.buildTrack();
    this.buildTrain(); // creates the head + carts + smoke emitter + first layout
    this.buildControls();
    this.buildTaskCard();
    this.buildTrainSound();

    // Drag handling is manual (not Phaser's built-in draggable) because riders get
    // reparented between a cart container and the scene, and Phaser's drag deltas
    // are unreliable across that. A scene-level pointermove/up drives it instead.
    // The number slider's drag is scene-level too: a ZONE's own pointermove stops
    // firing on touch once the finger leaves the zone, which desynced the drag.
    this.input.on('pointermove', (pointer) => {
      this.onPointerMove(pointer);
      this.onSliderMove(pointer);
    });
    this.input.on('pointerup', (pointer) => {
      // Nothing drives or drops until the player has tapped Start.
      if (!this.started) return;
      this.stopDrive();
      this.onPointerUp(pointer);
      this.onSliderUp(pointer);
    });
    this.events.once('shutdown', () => {
      this.stopDrive();
      this.trainSound?.stop();
      // Voice lines (all belong to the per-Game SoundManager) must not outlive
      // the scene.
      this.stopStartVoice();
      this.voiceSound?.stop();
      this.voiceSound?.destroy();
      this.voiceSound = null;
    });

    // Hold the whole game behind the start screen; Start begins the roll-in.
    this.buildStartOverlay();
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

    // A tween owns trainX during the intro/outro (autoMoving) — do NOT also
    // integrate velocity then, or the two would fight over the same property.
    if (!this.autoMoving) {
      this.trainX += this.velocity * dt;
      // Once the intro is over, the train may be driven off either edge — but
      // only as far as being fully off-screen; past that it is clamped + stopped.
      if (this.introDone) this.clampPan();
    }

    // Engine sound follows the train's ACTUAL movement, so it chugs during the
    // intro/outro tweens too (those move trainX directly, without `velocity`).
    const speed = dt > 0 ? Math.abs(this.trainX - this._prevX) / dt : 0;
    this._prevX = this.trainX;
    this.updateTrainSound(dt, speed);

    // Lay every cart on the track for its own position — each cart bends to the
    // line independently, so the consist follows the arch instead of rotating
    // as one rigid block. (The per-cart bob + the chimney smoke keep running even
    // when the train is parked, so this is intentionally every frame.)
    this.layoutCarts();
    this.emitSmoke(delta);
  }

  // ---------------------------------------------------------------------------
  // Pan limits — the train can leave the screen, but no further than that
  // ---------------------------------------------------------------------------

  // Recompute the pan limits from the current consist. The relX values do not
  // change during a level, so this runs once per train build (not per frame).
  // Recompute the pan limits from the current consist. Runs once per train build.
  // Writes into a reused object so it allocates nothing.
  cachePanBounds() {
    const width = this.scale.width;
    const half = this.cartW / 2;
    let minRel = Infinity;
    let maxRel = -Infinity;
    for (const c of this.carts) {
      if (c.relX < minRel) minRel = c.relX;
      if (c.relX > maxRel) maxRel = c.relX;
    }
    const pad = TRAIN.pan.overshootPad;
    // Most-negative trainX = whole train just off the LEFT edge.
    this._pan.lower = -maxRel - half - pad;
    // Most-positive trainX = whole train just off the RIGHT edge.
    this._pan.upper = width - minRel + half + pad;
    return this._pan;
  }

  panBounds() {
    return this._pan;
  }

  // Clamp trainX into the (cached) pan limits. Cheap enough to run every frame.
  clampPan() {
    const { lower, upper } = this._pan;
    if (this.trainX < lower) {
      this.trainX = lower;
      if (this.velocity < 0) this.velocity = 0;
    } else if (this.trainX > upper) {
      this.trainX = upper;
      if (this.velocity > 0) this.velocity = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Start screen — fullscreen title art with a Start button near the bottom
  // ---------------------------------------------------------------------------

  buildStartOverlay() {
    const { width, height } = this.scale;
    const cfg = START_SCREEN;

    this.startOverlay = this.add.container(0, 0).setDepth(cfg.depth);

    if (this.textures.exists(cfg.key)) {
      // Title art scaled to COVER the viewport (no letterbox bars).
      const art = this.add.image(width / 2, height / 2, cfg.key);
      art.setScale(Math.max(width / art.width, height / art.height));
      this.startOverlay.add(art);
    } else {
      // Art missing: a plain backdrop so the Start button is still reachable.
      const fallback = this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 1);
      this.startOverlay.add(fallback);
    }

    const startBtn = this.createPillButton(width / 2, cfg.buttonY, cfg.buttonLabel, {
      fontSize: cfg.buttonFontSize,
      paddingX: cfg.buttonPaddingX,
      paddingY: cfg.buttonPaddingY,
      depth: cfg.buttonDepth,
    });
    // createPillButton returns a wrapper — add its container and tween that.
    this.startOverlay.add(startBtn.container);
    this.tweens.add({
      targets: startBtn.container,
      scale: cfg.pulseScale,
      duration: cfg.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    startBtn.on('pointerup', () => this.beginPlay());
    this.startBtn = startBtn;

    // Play the welcome line over the title screen; it is cut off the instant
    // Start is tapped (beginPlay).
    if (this.cache.audio.exists(START_SCREEN.voiceKey)) {
      this.startVoiceSound = this.sound.add(START_SCREEN.voiceKey, {
        volume: START_SCREEN.voiceVolume,
      });
      this.startVoiceSound.play();
    }
  }

  stopStartVoice() {
    this.startVoiceSound?.stop();
    this.startVoiceSound?.destroy();
    this.startVoiceSound = null;
  }

  // Fade the start screen away, then roll the train in for level 1.
  beginPlay() {
    if (this.started) return;
    this.started = true;

    // The welcome line stops the moment Start is tapped.
    this.stopStartVoice();

    const overlay = this.startOverlay;
    this.startOverlay = null;
    this.startBtn = null;
    const fadeMs = START_SCREEN.fadeMs;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: fadeMs,
      ease: 'Sine.easeOut',
      onComplete: () => overlay.destroy(true),
    });

    this.time.delayedCall(fadeMs, () => this.startIntro());
  }

  // ---------------------------------------------------------------------------
  // Intro / level entry — fly the train in from off-screen right
  // ---------------------------------------------------------------------------

  startIntro() {
    const { upper } = this.panBounds();
    const intro = TRAIN.intro;
    // Start fully off the right edge (extra pad so frame 1 is truly empty).
    this.trainX = upper + intro.offscreenPad;
    this.layoutCarts();

    // Controls + card exist but are hidden until the train arrives.
    this.setControlsVisible(false);
    this.setTaskVisible(false);

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
    // The tween owns trainX for its duration (see update()).
    this.autoMoving = true;
    this.tweens.add({
      targets: this,
      trainX: endX,
      duration: durationMs,
      ease,
      onUpdate: () => this.layoutCarts(),
      onComplete: () => {
        this.autoMoving = false;
        onComplete();
      },
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
      // Fade in everything EXCEPT the sound button's glow, which must keep its
      // own alpha (a full fade-in would leave it stuck visible).
      const fadeParts = this.taskParts.filter((o) => !o.isGlow);
      fadeParts.forEach((o) => o.setAlpha(0));
      this.tweens.add({
        targets: fadeParts,
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
    [this.leftZone, this.rightZone].forEach((z) => z?.setVisible(visible));
    (this.sliderParts || []).forEach((o) => o.setVisible(visible));
    this.sliderZone?.setVisible(visible);
    if (visible) {
      // Zone input only while the controls are shown (they start hidden).
      this.leftZone?.setInteractive({ useHandCursor: true });
      this.rightZone?.setInteractive({ useHandCursor: true });
    } else {
      this.leftZone?.disableInteractive();
      this.rightZone?.disableInteractive();
    }
  }

  setTaskVisible(visible) {
    this.taskParts.forEach((o) => o.setVisible(visible));
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
  // `speed` is the train's actual px/s this frame — from the player's driving OR
  // an intro/outro tween, so the engine is heard whenever the train is moving.
  //
  // PERF: when nothing has changed (the train is fully at rest, not driving, and
  // the rate/volume already sit at their targets) this returns immediately — so
  // an idle scene does no per-frame audio work at all.
  updateTrainSound(dt, speed) {
    const s = this.trainSound;
    if (!s) return;
    const cfg = TRAIN_SOUND;
    const speedFrac = Math.min(1, speed / TRAIN.speed);
    const targetRate = cfg.restRate + cfg.rateRange * speedFrac;
    const targetVol = cfg.quietVolume + (cfg.loudVolume - cfg.quietVolume) * speedFrac;
    const atRest = this.driveDir === 0 && this.velocity === 0 && !this.autoMoving;
    if (
      atRest &&
      Math.abs(s.rate - targetRate) < 0.001 &&
      Math.abs(s.volume - targetVol) < 0.001
    ) {
      return;
    }
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
  // Reads the cached curve constants (cacheTrack), so the per-frame cost is one
  // sin() and a multiply-add.
  trackYAt(x) {
    return this.trackBaseY + TRACK.curveAmplitude * Math.sin(this.trackK * x + TRACK.curvePhase);
  }

  // dY/dX of the track at an x — used to rotate a cart to the local slope.
  trackSlopeAt(x) {
    return TRACK.curveAmplitude * this.trackK * Math.cos(this.trackK * x + TRACK.curvePhase);
  }

  // Compute the constants the track math needs, once per level/resolution.
  cacheTrack() {
    this.trackBaseY = this.scale.height * TRACK.yFrac;
    this.trackK = (Math.PI * 2 * TRACK.curveWaves) / this.scale.width;
  }

  // ---------------------------------------------------------------------------
  // Background — the current level's full-screen image, COVER-scaled
  // ---------------------------------------------------------------------------

  buildBackground() {
    const { width, height } = this.scale;
    const key = this.level.background;
    if (this.textures.exists(key)) {
      this.bgImage = this.add.image(width / 2, height / 2, key).setDepth(BACKGROUND_DEPTH);
      this.bgImage.setScale(Math.max(width / this.bgImage.width, height / this.bgImage.height));
    } else {
      // No art: the shared sky gradient + clouds for this and every later level.
      this.addSkyBackground(SKY_THEME, 'g14-sky');
      this.addDriftingClouds(CLOUDS);
    }
  }

  // Slide the backdrop out and the new level's backdrop in, so the level change
  // reads as scenery passing rather than an instant cut.
  swapBackgroundAnimated(onDone) {
    const key = this.level.background;
    if (!this.bgImage || !this.textures.exists(key)) {
      onDone();
      return;
    }
    const { width, height } = this.scale;
    const cfg = TRAIN.transition;

    // Park the incoming backdrop just off the right edge at cover scale. It is
    // created CENTRED vertically (only x is animated), or it would sit with its
    // centre on the top edge and show only half the scene.
    const incoming = this.add.image(width / 2 + cfg.slideX, height / 2, key).setDepth(BACKGROUND_DEPTH);
    incoming.setScale(Math.max(width / incoming.width, height / incoming.height));

    // The current backdrop slides off to the left.
    const outgoing = this.bgImage;
    this.tweens.add({
      targets: outgoing,
      x: width / 2 - cfg.slideX,
      duration: cfg.durationMs,
      ease: cfg.ease,
      onComplete: () => outgoing.destroy(),
    });
    // The new one slides in from the right to centre.
    this.tweens.add({
      targets: incoming,
      x: width / 2,
      duration: cfg.durationMs,
      ease: cfg.ease,
      onComplete: onDone,
    });
    this.bgImage = incoming;
  }

  // ---------------------------------------------------------------------------
  // Track — a dashed horizontal reference line across the middle
  // ---------------------------------------------------------------------------

  buildTrack() {
    const { width } = this.scale;

    // Reference only — hidden from players by default (see TRACK.show). The
    // carts always ride this curve via trackYAt(), drawn or not.
    if (!TRACK.show) return;

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
  // Train — the cars + head, laid along the track (per-level art + count)
  // ---------------------------------------------------------------------------

  buildTrain() {
    const { width } = this.scale;
    const level = this.level;
    const total = level.carts + 1; // numbered cars + the locomotive
    const hasArt = this.textures.exists(level.cartLid) && this.textures.exists(level.cartBody);
    const hasHead = this.textures.exists('trainHead');
    const headTint = level.headTint || null;

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
      const probe = this.add.image(0, 0, level.cartBody).setVisible(false);
      scale = targetW / probe.width;
      cartW = probe.width * scale;
      bodyH = probe.height * scale;
      // The lid is scaled by the SAME factor so it aligns with the body even if
      // the two source images are different pixel sizes.
      const lidSrc = this.textures.get(level.cartLid).getSourceImage();
      lidH = lidSrc.height * scale;
      cartH = bodyH + lidH; // the stacked cart's total height
      probe.destroy();
    }
    this.cartW = cartW;
    this.cartH = cartH;

    // Spacing between adjacent cart CENTRES = the cart width plus an optional
    // gap (see TRAIN.cartGapFrac; 0 = butted together).
    const step = cartW * (1 + TRAIN.cartGapFrac);
    const span = step * (total - 1);
    const startOffset = -span / 2; // local offsets centred on the container origin

    // The ENDING cart is always the LAST sprite in the consist.
    const endIndex = TRAIN.endCartIndex < 0 ? total - 1 : TRAIN.endCartIndex;

    // The body cars carry the number 1..N along the consist; the locomotive
    // (which has no body) is skipped so the count runs across the body cars.
    let numberSeq = 0;

    // Draw order inside a cart (back to front): LID, then the RIDER (added later
    // via addAt(1)), then BODY, then the NUMBER — so a rider sits behind the body
    // but in front of the lid, and the number sits on top of the body.
    for (let i = 0; i < total; i += 1) {
      const isHead = hasHead && i === TRAIN.headIndex;
      // The head's whole container sits at a HIGHER depth, so it reads as being
      // in front of the carts rather than tucked behind its neighbour.
      const cart = this.add.container(0, 0).setDepth(isHead ? TRAIN.headDepth : TRAIN.cartDepth);
      cart.relX = startOffset + i * step;
      cart.isHead = isHead;
      cart.riderSlot = null; // the rider image once one is dropped here
      cart.number = null; // the cart's 1..N number (body cars only)

      if (isHead) {
        // The locomotive. Slightly larger and slightly higher than the carts
        // (see TRAIN.headScaleFrac / headYOffsetFrac). Tinted on the night level
        // so it reads as being outdoors after dark, alongside the riders.
        const head = this.add
          .image(TRAIN.headXOffsetFrac * cartW, TRAIN.headYOffsetFrac * cartH, 'trainHead')
          .setOrigin(0.5)
          .setScale(scale * TRAIN.headScaleFrac);
        if (headTint) head.setTint(headTint);
        cart.add(head);
        cart.cartBody = head;
        this.headCart = cart;
        this.headSprite = head;
      } else if (hasArt) {
        numberSeq += 1;
        cart.number = numberSeq;
        const isEnd = i === endIndex;
        // Body sits at the bottom of the stack; its centre is half a cart-height
        // (body + lid) below the cart's own centre.
        const bodyY = cartH / 2 - bodyH / 2;
        // Lid sits directly on top of the body: its bottom edge meets the body's
        // top edge, so its centre is half a lid-height above that seam.
        const lidY = -cartH / 2 + lidH / 2 - TRAIN.lidOverlap;
        const lid = this.add.image(0, lidY, level.cartLid).setOrigin(0.5).setScale(scale);
        const body = this.add
          .image(0, bodyY, isEnd ? level.cartBodyEnd : level.cartBody)
          .setOrigin(0.5)
          .setScale(scale);
        // Lid FIRST, then body → body draws in front. A rider dropped here is
        // inserted between them (addAt 1).
        cart.add([lid, body]);
        cart.cartBody = body;

        // Big bold number, centred on the body, drawn on top of it.
        const numY = bodyY + TRAIN.number.yOffsetFrac * cartH;
        const num = this.add
          .text(0, numY, ordinalSuffix(numberSeq), {
            fontFamily: TRAIN.number.fontFamily,
            fontSize: `${Math.round(cartW * TRAIN.number.sizeFrac)}px`,
            color: TRAIN.number.color,
            fontStyle: 'bold',
            stroke: TRAIN.number.stroke,
            strokeThickness: Math.max(1, Math.round(cartW * TRAIN.number.strokeFrac)),
          })
          .setOrigin(0.5)
          .setAlpha(TRAIN.number.alpha);
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

    // The consist is laid out — cache the pan limits from it (reads cart relX).
    this.cachePanBounds();
    // Start fully off-screen to the right; the intro tween drives trainX in.
    this.trainX = this._pan.upper;
    this.layoutCarts();

    // Chimney smoke for the head (no-op when there is no head art).
    this.buildSmokeEmitter();
  }

  // Destroy the current consist (used between levels, which change the cart
  // count and art).
  teardownTrain() {
    this.smokeEmitter?.destroy();
    this.smokeEmitter = null;
    for (const cart of this.carts) cart.destroy();
    this.carts = [];
    this.headCart = null;
    this.headSprite = null;
  }

  // ---------------------------------------------------------------------------
  // Controls — the two hold-to-drive targets flank the card at the BOTTOM. Each
  // is a big, forgiving hit zone (the whole area beside the card) with an arrow
  // button at its centre. A 1..10 number line sits across the top.
  // ---------------------------------------------------------------------------

  buildControls() {
    const { width, height } = this.scale;
    const y = height * CONTROLS.yFrac;
    const zoneW = width * CONTROLS.sideFrac;
    const zoneH = height * CONTROLS.zoneHeightFrac;

    // Left/right zones. They sit BELOW the card in depth, so the card + animal
    // still get their own taps; only the open area beside the card moves the
    // train. A tap anywhere in the zone works — no accuracy needed.
    this.leftZone = this.add
      .zone(zoneW / 2, y, zoneW, zoneH)
      .setDepth(CONTROLS.depth)
      .setInteractive({ useHandCursor: true });
    this.leftZone.on('pointerdown', () => {
      this.startDrive(-1);
      this.leftBtn.container.press?.(true);
    });
    this.leftZone.on('pointerup', () => {
      this.stopDrive();
      this.leftBtn.container.press?.(false);
    });

    this.rightZone = this.add
      .zone(width - zoneW / 2, y, zoneW, zoneH)
      .setDepth(CONTROLS.depth)
      .setInteractive({ useHandCursor: true });
    this.rightZone.on('pointerdown', () => {
      this.startDrive(+1);
      this.rightBtn.container.press?.(true);
    });
    this.rightZone.on('pointerup', () => {
      this.stopDrive();
      this.rightBtn.container.press?.(false);
    });

    // Visible arrow buttons at each zone's centre — glossy gradient discs,
    // purely visual (taps fall through to the zones underneath).
    this.leftBtn = this.makeDriveButton(zoneW / 2, y, -1);
    this.rightBtn = this.makeDriveButton(width - zoneW / 2, y, +1);

    this.buildNumberSlider();

    // Hidden until the intro finishes.
    this.setControlsVisible(false);
  }

  // The drive arrow button — a single image (see CONTROLS.buttonImage),
  // flipped horizontally for the LEFT button. Returns { container } so
  // setControlsVisible() can toggle it like a pill.
  makeDriveButton(cx, cy, dir) {
    const cfg = CONTROLS;
    const container = this.add.container(cx, cy).setDepth(cfg.depth + 1);

    let lighten = null;
    if (this.textures.exists(cfg.buttonImage)) {
      const img = this.add.image(0, 0, cfg.buttonImage).setOrigin(0.5).setScale(cfg.buttonScale);
      // An ADD-blend copy faded over the art brightens it.
      lighten = this.add
        .image(0, 0, cfg.buttonImage)
        .setOrigin(0.5)
        .setScale(cfg.buttonScale)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(cfg.buttonLighten);
      // The art points RIGHT; mirror both layers for the left button.
      if (dir < 0) {
        img.setFlipX(true);
        lighten.setFlipX(true);
      }
      container.add([img, lighten]);
    }

    // Visual press feedback (the zone underneath owns the actual input): the
    // button shrinks a little AND brightens.
    container.press = (down) => {
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        scale: down ? cfg.pressScale : 1,
        duration: 90,
        ease: 'Sine.easeOut',
      });
      if (lighten) {
        this.tweens.killTweensOf(lighten);
        this.tweens.add({
          targets: lighten,
          alpha: down ? cfg.buttonLightenPressed : cfg.buttonLighten,
          duration: cfg.lightenMs,
          ease: 'Sine.easeOut',
        });
      }
    };
    return { container };
  }

  // An interactive strip of 1..N numbers across the top. A window of `visible`
  // numbers shows at once; the centred one is highlighted and the spelled
  // ordinal is shown below it. Drag the strip (or tap a number) to slide; on
  // release it snaps to the nearest whole number.
  buildNumberSlider() {
    const { width, height } = this.scale;
    const cfg = NUMBER_SLIDER;
    const count = cfg.count;

    this.sliderParts = [];

    // Strip geometry. Cell width is the band width / visible count, and the strip
    // is laid out at y = 0 with each number at index * cellW; the strip container
    // is then positioned so it scrolls. `this.sliderCX` is the screen centre.
    const stripW = width * cfg.widthFrac;
    const cellW = stripW / cfg.visible;
    const cx = width / 2 + width * (cfg.xFrac || 0);
    const bandY = height * cfg.yFrac;
    this.sliderCX = cx;
    this.sliderCellW = cellW;
    this.sliderValues = Array.from({ length: count }, (_, i) => i + 1);

    // The whole strip lives in a container we can slide left/right. Its depth is
    // ABOVE the band + highlight so the numbers render ON TOP of them (children
    // inherit the container's depth, so a child depth would not help).
    const strip = this.add.container(cx, bandY).setDepth(cfg.depth + 2);
    this.sliderStrip = strip;
    // `selectedIndex` is the value currently under the centre marker (0-based).
    this.selectedIndex = 0;

    // Clip the strip to the band, so it reads as a fixed 5-wide window the
    // numbers scroll through (numbers outside the window are hidden).
    const bandHeight = cfg.number.fontSizePx * cfg.band.heightMult;
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRoundedRect(
      cx - stripW / 2,
      bandY - bandHeight / 2,
      stripW,
      bandHeight,
      cfg.band.radius
    );
    strip.setMask(maskShape.createGeometryMask());
    this.sliderMask = maskShape;

    // Semi-transparent band, drawn in SCREEN space (not the strip) so it stays
    // put while the numbers scroll under it.
    const bandH = cfg.number.fontSizePx * cfg.band.heightMult;
    const band = this.add.graphics().setDepth(cfg.depth);
    band.fillStyle(cfg.band.color, cfg.band.alpha);
    band.fillRoundedRect(cx - stripW / 2, bandY - bandH / 2, stripW, bandH, cfg.band.radius);
    this.sliderParts.push(band);

    // Highlight pill over the centred cell (screen space, behind the numbers).
    const hl = this.add.graphics().setDepth(cfg.depth + 1);
    hl.fillStyle(cfg.highlight.color, cfg.highlight.alpha);
    hl.fillRoundedRect(
      cx - cellW / 2 + cfg.highlight.insetX,
      bandY - cfg.highlight.radius,
      cellW - cfg.highlight.insetX * 2,
      cfg.highlight.radius * 2,
      cfg.highlight.radius
    );
    this.sliderHighlight = hl;
    this.sliderParts.push(hl);

    // The numbers. Each sits at (index) * cellW within the strip (which is
    // centred on cx). Only `visible + 2` are ever on screen, but the full set is
    // cheap and keeps the value→position math dead simple.
    this.sliderNumbers = [];
    for (let i = 0; i < count; i += 1) {
      const label = this.add
        .text(i * cellW, 0, String(i + 1), {
          fontFamily: cfg.number.fontFamily,
          fontSize: `${cfg.number.fontSizePx}px`,
          color: cfg.number.color,
          fontStyle: 'bold',
          stroke: cfg.number.stroke,
          strokeThickness: cfg.number.strokeWidth,
        })
        .setOrigin(0.5);
      strip.add(label);
      this.sliderNumbers.push(label);
    }

    // The spelled ordinal, below the highlighted number (screen space).
    this.sliderLabel = this.add
      .text(cx, bandY + cfg.label.offsetY, '', {
        fontFamily: cfg.label.fontFamily,
        fontSize: `${cfg.label.fontSizePx}px`,
        color: cfg.label.color,
        fontStyle: 'bold',
        stroke: cfg.label.stroke,
        strokeThickness: cfg.label.strokeWidth,
      })
      .setOrigin(0.5)
      .setDepth(cfg.depth + 2);
    this.sliderParts.push(this.sliderLabel);

    // The band is the grab surface. It starts the drag (pointerdown); the MOVE
    // and UP are handled at the scene level (see create) so a finger that slides
    // off the band keeps driving the slider.
    this.sliderZone = this.add
      .zone(cx, bandY, stripW, bandH)
      .setDepth(cfg.depth + 3)
      .setInteractive({ useHandCursor: true });
    this.sliderZone.on('pointerdown', (p) => this.onSliderDown(p));
    this.sliderParts.push(this.sliderZone);

    // Position the strip for the initial selection and paint it.
    this.setSliderIndex(0, true);
  }

  // Move the strip so the current selection is centred, and restyle every number
  // (the centred one full-size, the rest faded) + update the spelled label.
  setSliderIndex(index, instant = false) {
    const cfg = NUMBER_SLIDER;
    const clamped = Math.max(0, Math.min(this.sliderValues.length - 1, index));
    this.selectedIndex = clamped;

    // Place the strip so number `clamped` lands on the screen centre. The strip
    // is allowed to scroll so the FIRST and LAST numbers can also reach centre.
    const targetX = this.sliderCX - clamped * this.sliderCellW;
    if (instant) {
      this.sliderStrip.x = targetX;
    } else {
      this.tweens.killTweensOf(this.sliderStrip);
      this.tweens.add({
        targets: this.sliderStrip,
        x: targetX,
        duration: cfg.snapMs,
        ease: cfg.snapEase,
      });
    }

    // Restyle every number: the centred one full-size, the rest faded + shrunk.
    this.styleSliderNumbers(clamped);

    // The spelled ordinal for the centred number.
    this.sliderLabel.setText(this.ordinalFor(this.sliderValues[clamped]));
  }

  // Apply the selected/unselected look to every number in the strip.
  styleSliderNumbers(selectedIndex) {
    const n = NUMBER_SLIDER.number;
    for (let i = 0; i < this.sliderNumbers.length; i += 1) {
      const label = this.sliderNumbers[i];
      const selected = i === selectedIndex;
      label.setScale(selected ? 1 : n.sideScale);
      label.setAlpha(selected ? 1 : n.sideAlpha);
    }
  }

  // --- Slider input -----------------------------------------------------------

  onSliderDown(pointer) {
    if (!this.started) return;
    this.sliderDrag = {
      startX: pointer.x,
      stripStartX: this.sliderStrip.x,
      moved: false,
    };
    // Cancel any in-flight snap tween so the drag responds immediately.
    this.tweens.killTweensOf(this.sliderStrip);
  }

  onSliderMove(pointer) {
    const drag = this.sliderDrag;
    if (!drag) return;
    const dx = pointer.x - drag.startX;
    if (Math.abs(dx) > NUMBER_SLIDER.tapThresholdPx) drag.moved = true;

    const max = this.sliderValues.length - 1;
    // Clamp the strip to the first/last number so it can never overshoot the ends
    // (which is what let the centring drift). The strip's x for index i is
    // sliderCX - i*cellW, so the legal range is [x(max), x(0)].
    const minX = this.sliderCX - max * this.sliderCellW;
    const maxX = this.sliderCX;
    const rawX = drag.stripStartX + dx;
    this.sliderStrip.x = Math.max(minX, Math.min(maxX, rawX));

    const approx = Math.round((this.sliderCX - this.sliderStrip.x) / this.sliderCellW);
    const clamped = Math.max(0, Math.min(max, approx));
    if (clamped !== this.selectedIndex) {
      this.selectedIndex = clamped;
      this.styleSliderNumbers(clamped);
      this.sliderLabel.setText(this.ordinalFor(this.sliderValues[clamped]));
    }
  }

  onSliderUp(pointer) {
    const drag = this.sliderDrag;
    if (!drag) return;
    this.sliderDrag = null;

    if (!drag.moved) {
      // A tap: select the number nearest the tap x.
      const approx = Math.round((pointer.x - this.sliderCX) / this.sliderCellW);
      const idx = this.selectedIndex + approx;
      this.setSliderIndex(idx);
      return;
    }

    // A drag: snap to the nearest whole number.
    const approx = Math.round((this.sliderCX - this.sliderStrip.x) / this.sliderCellW);
    this.setSliderIndex(approx);
  }

  startDrive(dir) {
    // No driving until Start has been tapped and the train has rolled in.
    if (!this.started || !this.introDone || this.locked) return;
    this.driveDir = dir;
  }

  stopDrive() {
    this.driveDir = 0;
  }

  // ---------------------------------------------------------------------------
  // Wrong-answer feedback
  // ---------------------------------------------------------------------------

  wrongAnswer() {
    const cfg = TRAIN.feedback;
    this.mistakes += 1;
    this.sound.play(cfg.wrongKey, { volume: cfg.wrongVolume });

    // Flash + shake the whole board red so the miss reads instantly.
    const c = cfg.flashColor;
    this.cameras.main.flash(cfg.flashDurationMs, (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
    this.cameras.main.shake(cfg.shakeDurationMs, cfg.shakeAmplitude / this.scale.width);
  }

  // ---------------------------------------------------------------------------
  // Level complete — auto, no confirm button
  // ---------------------------------------------------------------------------

  // Every animal is aboard: celebrate, roll out, then either re-roll the same
  // level (another round) or slide on to the next level.
  onLevelComplete() {
    this.spawnConfetti();
    this.locked = true;
    this.stopDrive();
    this.setControlsVisible(false);
    this.setTaskVisible(false);

    const cfg = TRAIN.placement;
    this.time.delayedCall(cfg.leaveDelayMs, () => {
      // The next step is decided NOW (before the roll-out) so the arrival
      // background swap knows whether the art changes.
      const sameLevel = this.roundInLevel < TRAIN.roundsPerLevel;
      if (sameLevel) this.roundInLevel += 1;
      else {
        this.levelIndex += 1;
        this.roundInLevel = 1;
      }
      const levelChanged = this.levelIndex < LEVELS.length;
      this.leaveTrain(() => this.enterBoard(sameLevel, levelChanged));
    });
  }

  // A short burst of coloured confetti pieces drifting down from above the
  // canvas — the level's "well done" beat.
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
    // The tween owns trainX for its duration (see update()).
    this.autoMoving = true;
    this.tweens.add({
      targets: this,
      trainX: target,
      duration: TRAIN.placement.leaveDurationMs,
      ease: TRAIN.placement.leaveEase,
      onUpdate: () => this.layoutCarts(),
      onComplete: () => {
        this.autoMoving = false;
        onDone();
      },
    });
  }

  // The train is off screen: set up the next board, run the backdrop transition,
  // and fly the train back in. Called with what actually changed.
  enterBoard(sameLevel, levelChanged) {
    // Out of levels → the game is over.
    if (!levelChanged) {
      this.finish();
      return;
    }

    this.clearRiders();

    if (sameLevel) {
      // Same level, next round: only the task order changes.
      this.time.delayedCall(TRAIN.placement.betweenRoundsMs, () => this.arriveBack());
      return;
    }

    // New level: rebuild the consist (new art + count) and animate the backdrop
    // while the train is off screen.
    this.teardownTrain();
    this.buildTrain();
    this.swapBackgroundAnimated(() => this.arriveBack());
  }

  // Fly the train back in from the right and hand control to the player.
  arriveBack() {
    const { upper } = this.panBounds();
    this.trainX = upper + TRAIN.intro.offscreenPad;
    this.layoutCarts();
    this.flyIn(TRAIN.intro.durationMs * 0.85, TRAIN.intro.ease, () => {
      this.locked = false;
      this.setControlsVisible(true);
      this.setTaskVisible(true);
      this.dealTask();
    });
  }

  // Remove every on-cart rider + the current card animal, and reset the task
  // queues so the next board deals a fresh shuffle.
  clearRiders() {
    for (const cart of this.carts) {
      if (cart.riderSlot) {
        cart.riderSlot.destroy();
        cart.riderSlot = null;
      }
    }
    this.destroyCardAnimal();
    this.queuesReady = false;
    this.riderQueue = [];
    this.numberQueue = [];
    this.taskKey = null;
    this.taskNumber = null;
    this.drag = null;
  }

  // The whole game is done (all levels cleared): show the completion, then emit
  // the payload the shared shell logs — the same shape the other games use, so
  // `mistakes` is stored as the wrong-count and stars/totalRounds feed stats.
  finish() {
    if (this.finished) return; // never log twice
    this.finished = true;
    this.locked = true;
    this.setControlsVisible(false);
    this.setTaskVisible(false);

    const mistakes = this.mistakes;
    this.stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;

    const payload = {
      stars: this.stars,
      totalRounds: LEVELS.length,
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

    // The card art (falls back to nothing if the image failed to load).
    if (this.textures.exists(cfg.cardImage)) {
      const card = this.add
        .image(cx, cy, cfg.cardImage)
        .setOrigin(0.5)
        .setScale(cfg.cardScale)
        .setDepth(cfg.depth);
      this.taskParts.push(card);
      // Use the card's ACTUAL on-screen size for the label/animal fractions, so
      // tuning the card size or art keeps them on the card.
      this.cardH = card.displayHeight;
      this.cardW = card.displayWidth;
    } else {
      this.cardH = cfg.cardH;
      this.cardW = cfg.cardW;
    }

    // The spelled position label, drawn ON TOP of the card, with a bold green
    // outline.
    this.cardLabel = this.add
      .text(cx, cy + cfg.labelYFrac * cfg.cardH, '', {
        fontFamily: cfg.labelFontFamily,
        fontSize: `${cfg.labelFontSize}px`,
        color: cfg.labelColor,
        fontStyle: 'bold',
        stroke: cfg.labelStroke,
        strokeThickness: cfg.labelStrokeWidth,
      })
      .setOrigin(0.5)
      .setDepth(cfg.depth + 1);
    this.taskParts.push(this.cardLabel);

    this.buildSoundButton();

    // Hidden until the intro finishes.
    this.setTaskVisible(false);
  }

  // The small semi-transparent "hear it again" button, placed to the RIGHT of
  // the card so the card itself stays uncluttered. Tapping it replays the spoken
  // ordinal for the current task.
  buildSoundButton() {
    const cfg = VOICE.button;
    if (!this.textures.exists(cfg.key)) return;
    const cx = this.taskCardPos.x + cfg.dxFrac * this.cardW;
    const cy = this.taskCardPos.y + cfg.dYFrac * this.cardH;

    const btn = this.add
      .image(cx, cy, cfg.key)
      .setOrigin(0.5)
      .setScale(cfg.scale)
      .setAlpha(cfg.alpha) // semi-transparent
      .setDepth(cfg.depth);

    // Forgiving hit area: a rectangle padded generously around the art, so the
    // tap does not need to be accurate.
    const pad = cfg.hitPadFrac;
    const hitW = btn.width * (1 + pad);
    const hitH = btn.height * (1 + pad);
    btn.setInteractive(
      new Phaser.Geom.Rectangle((btn.width - hitW) / 2, (btn.height - hitH) / 2, hitW, hitH),
      Phaser.Geom.Rectangle.Contains
    );
    btn.input.cursor = 'pointer';

    // A glow copy behind the button (ADD-blend, tinted, hidden by default), and
    // the tween that flashes it and fades it out.
    const glow = this.add
      .image(cx, cy, cfg.key)
      .setOrigin(0.5)
      .setScale(cfg.scale * cfg.glowScale)
      .setTint(cfg.glowColor)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(cfg.depth - 1);
    glow.isGlow = true; // excluded from the reveal fade (see revealControlsAndTask)
    this.soundGlow = glow; // flashed by playOrdinalVoice()
    this.taskParts.push(glow);

    // Keep the animations: hover brightens, tap pops. The glow is driven by the
    // voice itself (playOrdinalVoice), so it pulses on the initial deal too.
    btn.on('pointerover', () => btn.setAlpha(cfg.alphaHover));
    btn.on('pointerout', () => btn.setAlpha(cfg.alpha));
    btn.on('pointerup', () => {
      this.playOrdinalVoice();
      this.tweens.add({
        targets: btn,
        scale: cfg.scale * VOICE.tapScale,
        duration: VOICE.tapMs,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    });

    this.soundBtn = btn;
    this.taskParts.push(btn);
  }

  // Flash the glow to `glowPeakAlpha` then fade it out over `glowMs`.
  flashGlow(glow) {
    const cfg = VOICE.button;
    this.tweens.killTweensOf(glow);
    glow.setAlpha(cfg.glowPeakAlpha);
    this.tweens.add({
      targets: glow,
      alpha: 0,
      delay: cfg.glowRiseMs,
      duration: cfg.glowMs,
      ease: 'Sine.easeIn',
    });
  }

  // Build the two shuffled queues once per level: one entry per numbered cart
  // (its position) and one entry per rider. Every rider and every position is
  // used exactly once; only the ORDER they arrive in is random.
  prepareTaskQueues() {
    this.queuesReady = true;
    const numbers = [...new Set(this.carts.filter((c) => c.number).map((c) => c.number))];
    this.numberQueue = shuffled(numbers);
    this.riderQueue = shuffled([...new Set(RIDER_KEYS.filter((k) => this.textures.exists(k)))]);
  }

  // Deal the next task: take the next animal and the next position off the
  // queues, spell the position, and put that animal on the card.
  dealTask() {
    const cfg = TRAIN.task;
    if (!this.queuesReady) this.prepareTaskQueues();

    // Only as many tasks as the level has carts (extra riders stay unused).
    if (this.riderQueue.length === 0 || this.numberQueue.length === 0) return;

    const number = this.numberQueue.shift();
    const key = this.riderQueue.shift();
    this.taskKey = key;
    this.taskNumber = number;
    this.cardLabel.setText(this.ordinalFor(number));
    // Speak the position as the animal lands on the card.
    this.playOrdinalVoice(number);

    // Replace the card animal (remove it from taskParts too, so the show/hide
    // sweep never touches a destroyed object).
    this.destroyCardAnimal();

    // Animate the card change so it reads as an arrival, not a hard switch.
    this.animateCardPop();

    if (!this.textures.exists(key)) return;

    const src = this.textures.get(key).getSourceImage();
    const s = cfg.animalSize / Math.max(src?.width || 1, src?.height || 1);
    const x = this.taskCardPos.x;
    const y = this.taskCardPos.y + cfg.animalYFrac * cfg.cardH;
    const sprite = this.add.image(x, y, key).setOrigin(0.5).setScale(s).setDepth(cfg.depth + 2);
    this.applyRiderTint(sprite);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', (pointer) => this.beginRiderDrag(sprite, pointer));
    this.popInAnimal(sprite, s);

    this.cardAnimal = sprite;
    this.taskParts.push(sprite);
    if (!this.controlsShown) this.setTaskVisible(false);
  }

  // Pop-in for a newly dealt task: the label drops + springs in, the animal
  // springs up — offset slightly so they do not arrive in perfect lock-step.
  // Tweens only the SPRITE scale/position, so the setTaskVisible() alpha sweep
  // (which runs when controls first appear) never fights it.
  animateCardPop() {
    const cfg = TRAIN.task;
    const a = cfg.dealAnim;
    const cx = this.taskCardPos.x;
    const labelY = this.taskCardPos.y + cfg.labelYFrac * cfg.cardH;

    if (this.cardLabel) {
      this.tweens.killTweensOf(this.cardLabel);
      this.cardLabel.setScale(a.labelFromScale);
      this.cardLabel.setPosition(cx, labelY + a.labelFromYFrac * cfg.cardH);
      this.tweens.add({
        targets: this.cardLabel,
        scale: 1,
        y: labelY,
        duration: a.durationMs,
        delay: a.labelDelayMs,
        ease: a.ease,
      });
    }

    // The animal sprite is created AFTER this call, so its pop is started in
    // dealTask via popInAnimal(); nothing to do here for it.
  }

  // Spring-in for the animal sprite just added to the card.
  popInAnimal(sprite, baseScale) {
    const cfg = TRAIN.task;
    const a = cfg.dealAnim;
    const y = this.taskCardPos.y + cfg.animalYFrac * cfg.cardH;
    sprite.setScale(baseScale * a.animalFromScale);
    sprite.setPosition(this.taskCardPos.x, y + a.animalFromYFrac * cfg.cardH);
    this.tweens.add({
      targets: sprite,
      scale: baseScale,
      y,
      duration: a.durationMs,
      delay: a.animalDelayMs,
      ease: a.ease,
    });
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

  // Speak the ordinal for a task: the clip key equals the spelled word (see
  // TASK.ordinals + assets.js AUDIO), so the voice always matches the card text.
  // Pass no number to replay the CURRENT task's word (used by the sound button).
  playOrdinalVoice(number = this.taskNumber) {
    const key = this.ordinalFor(number);
    if (!key || !this.cache.audio.exists(key)) return;
    // Cut off the previous line so rapid deals do not overlap.
    this.voiceSound?.stop();
    this.voiceSound = this.sound.add(key, { volume: VOICE.volume });
    this.voiceSound.play();
    // Pulse the sound button so it reads as the thing speaking.
    if (this.soundGlow) this.flashGlow(this.soundGlow);
  }

  // Darken a rider on the night level (level.riderTint) so it reads as outdoors
  // after dark; no-op on the day levels.
  applyRiderTint(sprite) {
    const tint = this.level.riderTint;
    if (tint) sprite.setTint(tint);
    else sprite.clearTint();
  }

  // ---------------------------------------------------------------------------
  // Placement helpers
  // ---------------------------------------------------------------------------

  // A numbered cart still without a rider.
  emptyNumberCart() {
    return this.carts.some((c) => c.number && !c.riderSlot);
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

  // Begin a drag from a pointerdown on the CARD animal. Once a rider is seated it
  // has a `cart`, so any further pointerdown on it is ignored — placed animals
  // are fixed.
  beginRiderDrag(sprite, pointer) {
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
    const { sprite } = drag;
    // Only a sprite that is still being dragged (not already seated) resolves.
    if (sprite.cart) {
      this.drag = null;
      return;
    }
    this.drag = null;
    sprite.setAlpha(1);

    const cart = this.cartUnder(sprite.x, sprite.y);

    if (cart && !cart.riderSlot && cart.number === this.taskNumber) {
      // Correct cart. The dragged sprite BECOMES the on-cart rider — detach the
      // card bookkeeping WITHOUT destroying it.
      this.attachRiderToCart(cart, sprite);
      this.forgetCardAnimal(sprite);
      if (this.emptyNumberCart()) this.dealTask();
      else this.onLevelComplete();
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
    this.sound.play(cfg.popKey, { volume: cfg.popVolume });
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
