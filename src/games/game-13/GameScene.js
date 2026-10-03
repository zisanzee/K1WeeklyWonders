// GameScene.js
// Game 13 — the Left/Right dodge game.
//
// Per round:
//   1. The car keeps driving and a big prompt (LEFT or RIGHT) appears at the top.
//   2. After a short beat an obstacle spawns in the OPPOSITE lane and rides down
//      at the current road speed. Obeying the prompt keeps the car clear.
//   3. The obstacle passing below the car (without a hit) clears the round and
//      the progress bar gains one step. One second later the next prompt appears.
//   4. Each round the road speeds up and the prompt→obstacle gap shrinks
//      (see rounds.js). After 10 rounds the game is complete.
//
// Hitting the obstacle flashes the screen red and knocks the run back one
// round: from round 4 you restart on round 3, clear it, and move to round 4
// again. The progress bar drains back to match the current round.
//
// TUNING IS HOT: every value is read through roadTuning.js's get*() accessors,
// never the raw constants, so editing the tuning file (Vite HMR) or dragging the
// dev panel's sliders re-applies to this live scene with no page reload. In dev
// the lane guides can also be dragged directly on the canvas.
import * as Phaser from 'phaser';
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import {
  makeConfettiTexture,
  makeConfettiSquareTexture,
} from '@/phaser/common/sceneAssets';
import { OBSTACLE_KEYS } from '@/games/game-13/assets';
import {
  TOTAL_ROUNDS,
  roundSpeed,
  roundDelay,
  buildRoundPlan,
  starsForMistakes,
} from '@/games/game-13/rounds';
import {
  getRoad,
  getLanes,
  getLaneGuide,
  getCar,
  getRounds,
  getObstacle,
  getProgressBar,
  getPrompt,
  getAudioMix,
  getBgMusic,
  getStartScreen,
  getDepth,
  fitScaleToLane,
  ROAD_TUNING,
  DEV_TUNING_ENABLED,
} from '@/games/game-13/roadTuning';

// The clear colour behind everything, and the Phaser canvas clear colour (see
// Game.jsx) so the single frame before the road draws is not a bare canvas.
export const BACKGROUND_COLOR = '#1f2937';

// Per-game dev-editor gate: a dev build alone is not enough — the game's own
// DEV_TUNING_ENABLED switch must also be on (see roadTuning.js). This keeps
// Game 13 player-facing in local dev while the editor stays wired for others.
const DEV_EDITOR = import.meta.env.DEV && DEV_TUNING_ENABLED;

// Bakes a soft radial smoke puff once, cached under a fixed key so every puff
// (and a scene restart) reuses the same texture instead of redrawing canvas.
function makeSmokeTexture(scene) {
  const key = 'g13-smoke';
  if (scene.textures.exists(key)) return key;
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
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
    this.phase = 'start';
    this.stars = 0;
    this.mistakes = 0;
    this.peakStreak = 0;

    this.roadTiles = [];
    this.roadScroll = 0; // current px offset into the tiling, 0..tileHeight
    this.tileHeight = 0; // one road tile's on-screen height

    this.carContainer = null; // positioned x = lane centre; y = base + jump offset
    this.carRig = null; // child container: shake/lean jitter (kept off the x = lane tween)
    this.carSprite = null;
    this.currentLane = 0; // index into LANES
    this.laneSwitchTweens = [];
    this.carScale = 1; // current lane-fit scale, so shakes do not clobber it
    this.laneX = 0; // the car's lane-centre x; tweened on lane change, written each frame
    this.switchLean = 0; // extra lean (deg) layered on top of the shake while switching
    this.hitShakeUntil = 0; // this.time.now deadline for the violent crash shake
    // Crash displacement, applied to the car container each frame (0 in play).
    this.lurchOffsetX = 0;
    this.lurchOffsetY = 0;
    this.crashSpin = 0; // extra spin (deg) while crashing

    this.guideGfx = null;
    this.guideZones = [];
    this.dragGuide = null; // { laneId, grabX, grabY } while dragging a guide

    this.obstacleSprite = null;
    this.obstacleLane = null;
    this.obstacleKind = null; // which obstacle key the sprite is showing
    this.obstacleBaseY = 0; // uninterrupted y (idle bounce is added on top)
    this.obstacleBaseScale = 1;
    this.crashPending = false; // contact registered, reaction grace counting down
    this.crashFired = false; // this round has already resolved as a hit
    this.crashActive = false; // crash playing: scroll + obstacle are frozen
    this.crashTween = null; // the crash lurch tween (kept so it can be stopped)

    this.dustPuffKey = null;
    this.dustAccum = 0; // ms accumulator for the exhaust spawn cadence
    this.dustEmitter = null; // pooled particle emitter (no per-puff tween churn)

    // PER-ROUND TUNING CACHE. The accessors deep-copy their section on every
    // call, so calling them inside update() allocated several objects every
    // frame — a real cost on old phones. We snapshot them once per round (and on
    // any live tuning change) and read the cached plain objects in the hot loop.
    this.roadCfg = null;
    this.roundsCfg = null;
    this.carCfg = null;
    this.lanesCfg = null;
    this.obstacleCfg = null;
    this.depthCfg = null;
    this.audioCfg = null;
    this.startScreenCfg = null;
    this.bgMusicCfg = null;
    this.bgMusic = null; // shared bgMusic Sound handle (this game's level)

    // Scalar collision extents, recomputed only when the car/obstacle changes —
    // so the per-frame collision test needs no getBounds(). These are the
    // distances from the sprite centre to its NOSE / TAIL, each trimmed by the
    // tuning `collision` inset so transparent padding in the art never counts.
    this.carNoseOff = 40;
    this.carTailOff = 40;
    this.obstacleNoseOff = 40; // nose = leading edge (bottom, moving down-screen)
    this.obstacleTailOff = 40;

    // Audio: the engine loop is two voices crossfaded for a seamless loop (see
    // startEngine/updateEngine), plus a flip so skid1/skid2 alternate.
    this.engineVoices = null; // [voiceA, voiceB] — non-looping, crossfaded
    this.engineActive = 0; // which voice is currently audible
    this.engineFading = false; // a crossfade is in progress
    this.engineDuration = 0; // clip length in seconds (once decoded)
    this.skidFlip = false;
    this.plan = []; // fixed per-run round plan (prompt + obstacle lane)
    this.roundIndex = 0; // 0-based index into plan; plan[roundIndex] is the LIVE round
    this.roundTimers = []; // pending delayedCall handles for the current round
    this.obstacleWarned = false; // has the hazard grace elapsed this round?
    this.transitioning = false; // true during the red-flash knock-back

    this.progressFill = null;
    this.progressTween = null;
    this.jumpTween = null;

    this.promptContainer = null;
    this.directionText = null;

    this.flashRect = null;
    this.startOverlay = null;
    this.startBtn = null;
    this.startVoiceSound = null; // the welcome voice line, cut off on Start
  }

  create() {
    // Fresh run state — see resetRun() for why this is not constructor-only.
    this.resetRun();

    this.startTime = this.time.now;

    // Snapshot tuning BEFORE the builds, so they can read the cache too.
    this.cacheTuning();

    // Background music + first-tap unlock, plus the shared mute button. The
    // volume is this game's own (BG_MUSIC), not the shared default.
    this.bgMusic = ensureBgMusic(this, getBgMusic().volume);
    this.input.once('pointerdown', () => this.applyBgMusicVolume());
    // Keep a handle: the mute button is NOT part of the lane-tap surface, so a
    // tap on it must not also move the car (see handleLaneTap).
    this.muteButton = addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Backdrop first so every other layer sits on top of it.
    this.buildRoad();

    // Lane scaffolding, then the things that live on the road.
    this.buildLaneGuides();
    this.buildObstacle();
    this.buildCar();

    this.buildPrompt();
    this.buildProgressBar();
    this.buildFlash();

    this.dustPuffKey = makeSmokeTexture(this);
    this.buildDustEmitter();

    // Screen-left taps go to the left lane, screen-right to the right lane.
    this.input.on('pointerdown', (pointer) => this.handleLaneTap(pointer));

    this.buildStartOverlay();

    // Stop the engine loop + welcome voice if this scene shuts down (defensive:
    // the SoundManager is per-Game, so they would otherwise outlive a transition).
    this.events.once('shutdown', () => {
      this.stopEngine();
      this.stopStartVoice();
    });

    // Live tuning: the shared kit calls this to re-apply after a panel drag or a
    // saved tuning-file hot-reload.
    ROAD_TUNING.setRelayout(() => this.applyTuning());
    if (DEV_EDITOR) this.setupDevHooks();
  }

  // ---------------------------------------------------------------------------
  // Road — a top-to-bottom loop of the bgLoop texture
  // ---------------------------------------------------------------------------

  buildRoad() {
    const { width, height } = this.scale;

    if (!this.textures.exists('bgLoop')) {
      // No artwork yet: paint a flat road-ish gradient so the lane guides and
      // car still have something to sit on rather than a bare canvas.
      const backdrop = this.add.graphics().setDepth(getDepth().road);
      backdrop.fillGradientStyle(0x475569, 0x475569, 0x1f2937, 0x1f2937, 1);
      backdrop.fillRect(0, 0, width, height);
      return;
    }

    // Cover the canvas WIDTH (so lane markings are not squashed) and let the
    // height follow the aspect ratio. One tile then scrolls its own height.
    const probe = this.add.image(0, 0, 'bgLoop').setOrigin(0, 0);
    probe.setScale(width / probe.width);
    const dispH = probe.displayHeight;
    this.tileHeight = dispH;

    // Enough vertical copies to cover the canvas plus one for the seam.
    const count = Math.ceil(height / dispH) + 1;
    const tiles = [probe];
    for (let i = 1; i < count; i += 1) {
      tiles.push(this.add.image(0, 0, 'bgLoop').setOrigin(0, 0).setScale(probe.scaleX));
    }

    this.roadTiles = tiles.map((tile, i) => {
      tile.setDepth(getDepth().road);
      return { tile, baseY: i * dispH };
    });
  }

  // ---------------------------------------------------------------------------
  // Lane guides — highlighted translucent boxes for tuning (see LANE_GUIDE.show)
  // ---------------------------------------------------------------------------

  buildLaneGuides() {
    this.guideZones = [];
    // Hidden for players and not in the editor → create nothing at all (no
    // empty Graphics object to sit in the display list).
    if (!this.laneGuideCfg.show && !DEV_EDITOR) return;
    this.guideGfx = this.add.graphics().setDepth(this.depthCfg.guide);
    this.drawLaneGuides();
  }

  drawLaneGuides() {
    if (!this.guideGfx) return;
    this.guideGfx.clear();
    this.guideZones = [];

    const guide = this.laneGuideCfg;
    // Hidden for players; still drawn (and draggable) in the dev editor.
    if (!guide.show && !DEV_EDITOR) return;

    (this.lanesCfg || getLanes()).forEach((lane) => {
      const x = lane.x - lane.w / 2;
      const y = lane.y - lane.h / 2;
      this.guideGfx.fillStyle(guide.fill, guide.fillAlpha);
      this.guideGfx.fillRoundedRect(x, y, lane.w, lane.h, guide.radius);
      this.guideGfx.lineStyle(guide.strokeWidth, guide.stroke, guide.strokeAlpha);
      this.guideGfx.strokeRoundedRect(x, y, lane.w, lane.h, guide.radius);

      // In dev, make each guide draggable so the lane can be positioned by eye.
      if (DEV_EDITOR) {
        const zone = this.add
          .zone(lane.x, lane.y, lane.w, lane.h)
          .setDepth(getDepth().guide)
          .setInteractive({ useHandCursor: true });
        zone.on('pointerdown', (pointer) => {
          this.dragGuide = { laneId: lane.id, grabX: pointer.x - lane.x, grabY: pointer.y - lane.y };
        });
        this.guideZones.push(zone);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Player car — parked bottom-centre of a lane, shakes as if driving
  // ---------------------------------------------------------------------------

  buildCar() {
    const lane = this.laneFor(this.currentLane);
    const car = this.carCfg;
    // A container so the lane-switch tween owns `x` while the shake jitters the
    // child sprite independently — the two never fight over the same property.
    this.carContainer = this.add.container(lane.x, car.y).setDepth(this.depthCfg.car);
    this.laneX = lane.x; // drives container.x each frame (lane tween + crash lurch)
    // The rig carries ALL rotation/scale jitter (shake + switch lean) and the
    // sprite sits inside it, so the container's `x` tween (lane change) never
    // fights the rotation, and setScale on the sprite never fights the shake.
    this.carRig = this.add.container(0, 0);
    this.carContainer.add(this.carRig);

    if (this.textures.exists('playerCar')) {
      this.carSprite = this.add.image(0, 0, 'playerCar').setOrigin(0.5);
      this.applyCarScale();
    } else {
      // Placeholder body so lane switching is still visible without the art.
      this.carSprite = this.add.rectangle(0, 0, lane.w - car.lanePadding * 2, 120, 0x38bdf8).setOrigin(0.5);
    }
    this.carRig.add(this.carSprite);
  }

  applyCarScale() {
    const car = this.carCfg;
    const lane = this.laneFor(this.currentLane);
    if (this.textures.exists('playerCar')) {
      this.carScale = fitScaleToLane(lane, this.carSprite.width, car.lanePadding, car.scale);
      this.carRig?.setScale(this.carScale);
    }
    // Cache the car's inset nose/tail offsets for the per-frame collision test.
    const half = this.carSprite.displayHeight / 2;
    const ins = car.collision || {};
    this.carNoseOff = half * (1 - (ins.frontInset ?? 0)); // car faces up → nose = top
    this.carTailOff = half * (1 - (ins.rearInset ?? 0));
  }

  // Send the car to the lane on the tapped half of the screen.
  handleLaneTap(pointer) {
    if (this.phase !== 'playing' || this.transitioning) return;
    // While dragging a lane guide, a tap is a drag, not a lane change.
    if (this.dragGuide) return;
    // The scene-level pointerdown fires for taps ANYWHERE, including the shared
    // mute button — whose own pointerup toggles mute. Without this hit-test, a
    // tap on the mute button (top-left = left half) also counted as a lane tap.
    if (this.pointerOverUi(pointer)) return;

    const leftHalf = pointer.x < this.scale.width / 2;
    const target = leftHalf ? 0 : (this.lanesCfg?.length ?? 2) - 1;
    this.moveCarToLane(target);
  }

  // True when the pointer is inside an interactive UI control (e.g. the mute
  // button) rather than the play surface. Guards against controls that were
  // destroyed earlier (the start button after play begins, `getBounds` on a
  // destroyed object).
  pointerOverUi(pointer) {
    const controls = [this.muteButton, this.startBtn];
    return controls.some((c) => {
      const el = c?.container || c;
      if (!el || !el.active || !el.getBounds) return false;
      const b = el.getBounds();
      return Phaser.Geom.Rectangle.Contains(b, pointer.x, pointer.y);
    });
  }

  moveCarToLane(laneIndex) {
    if (laneIndex === this.currentLane || !this.carContainer) return;
    const goingRight = laneIndex > this.currentLane;
    this.currentLane = laneIndex;

    const lane = this.laneFor(laneIndex);
    const car = this.carCfg;
    const sway = car.switch || {};
    // Kill any in-flight switch so a fast double-tap does not fight itself.
    this.laneSwitchTweens.forEach((t) => t.stop());
    this.switchLean = 0;

    // The car keeps its jitter but tilts INTO the direction it is moving, then
    // unwinds as it settles — so it reads as steering rather than sliding.
    // Animate a scalar `laneX` (not the container's x directly) so shakeCar(),
    // which writes container.x every frame for the crash lurch, does not fight
    // this tween.
    const tilt = (sway.tiltDeg ?? 0) * (goingRight ? 1 : -1);
    this.laneSwitchTweens = [
      this.tweens.add({
        targets: this,
        laneX: lane.x,
        duration: car.switchDuration,
        ease: car.switchEase,
        onUpdate: (tw) => {
          const k = Math.sin(tw.progress * Math.PI); // 0 → 1 → 0
          this.switchLean = tilt * k;
        },
        onComplete: () => {
          this.switchLean = 0;
        },
      }),
    ];

    // Skid as the tyres break — alternate the two clips so a rapid left-right
    // does not sound like a stutter of the same sample.
    this.skidFlip = !this.skidFlip;
    this.playSfx(this.skidFlip ? 'skid1' : 'skid2', this.audioCfg.skidVolume);
  }

  // ---------------------------------------------------------------------------
  // Obstacle — one at a time, hidden until its round spawns it
  // ---------------------------------------------------------------------------

  buildObstacle() {
    const available = OBSTACLE_KEYS.filter((key) => this.textures.exists(key));
    this.obstacleAvailable = available;
    if (available.length === 0) return;

    this.obstacleSprite = this.add
      .image(0, 0, Phaser.Utils.Array.GetRandom(available))
      .setDepth(this.depthCfg.obstacle)
      .setVisible(false);
  }

  // Sizes the obstacle to its lane and parks it at the given y.
  placeObstacle(lane, y, newTexture = false) {
    const sprite = this.obstacleSprite;
    if (!sprite) return;
    const obstacle = this.obstacleCfg;
    if (newTexture) {
      this.obstacleKind = Phaser.Utils.Array.GetRandom(this.obstacleAvailable);
      sprite.setTexture(this.obstacleKind);
    }
    this.obstacleBaseScale = fitScaleToLane(lane, sprite.width, obstacle.lanePadding, obstacle.scale);
    sprite.setScale(this.obstacleBaseScale);
    sprite.setRotation(0);
    this.obstacleBaseY = y;
    sprite.setPosition(lane.x, y);
    // Cache the inset nose/tail offsets so the per-frame test needs no getBounds().
    // The obstacle drives DOWN-screen, so its leading (bottom) edge is the nose.
    const half = sprite.displayHeight / 2;
    const ins = obstacle.collision || {};
    this.obstacleNoseOff = half * (1 - (ins.frontInset ?? 0));
    this.obstacleTailOff = half * (1 - (ins.rearInset ?? 0));
  }

  // Idle animation applied every frame from `obstacleBaseY`:
  //   shake  → cars thrum like the player car (jitter + wobble)
  //   bounce → tires/cone/box hop gently
  //   static → puddle sits dead still
  applyObstacleMotion() {
    const sprite = this.obstacleSprite;
    if (!sprite || !sprite.visible) return;
    const obstacle = this.obstacleCfg;
    const kind = this.obstacleKind;
    const mode = obstacle.motion?.[kind] || 'static';
    const lane = this.obstacleLane;
    const x = lane ? lane.x : sprite.x;

    if (mode === 'shake') {
      const t = (this.time.now / 1000) * 6;
      sprite.x = x + Math.sin(t) * 1.4 + Math.cos(t * 1.7) * 1;
      sprite.y = this.obstacleBaseY + Math.cos(t * 1.3) * 1.2;
      sprite.rotation = Phaser.Math.DegToRad(Math.sin(t * 0.9) * 1.1);
    } else if (mode === 'bounce') {
      const { amplitude, speed } = obstacle.bounce;
      const t = (this.time.now / 1000) * speed;
      sprite.x = x;
      sprite.y = this.obstacleBaseY - Math.abs(Math.sin(t)) * amplitude;
      sprite.rotation = 0;
    } else {
      sprite.x = x;
      sprite.y = this.obstacleBaseY;
      sprite.rotation = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt — the big LEFT / RIGHT instruction
  // ---------------------------------------------------------------------------

  buildPrompt() {
    this.promptContainer = this.add
      .container(this.scale.width / 2, getPrompt().y)
      .setDepth(getDepth().prompt)
      .setVisible(false);

    this.directionText = this.add
      .text(0, 0, '', {
        fontSize: `${getPrompt().fontSize}px`,
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: getPrompt().leftColor,
        stroke: getPrompt().stroke,
        strokeThickness: getPrompt().strokeWidth,
      })
      .setOrigin(0.5);

    this.promptContainer.add([this.directionText]);
  }

  showPrompt(direction) {
    const prompt = getPrompt();
    const word = direction === 'left' ? 'Left' : 'Right';
    const color = direction === 'left' ? prompt.leftColor : prompt.rightColor;

    this.directionText.setText(word);
    this.directionText.setColor(color);
    this.directionText.setFontSize(prompt.fontSize);
    this.directionText.setX(0);

    // Speak the direction with the prompt (clip is the word "left"/"right").
    this.playSfx(direction === 'left' ? 'sayLeft' : 'sayRight', this.audioCfg.voiceVolume);

    // Slide in from the side it points toward and POP (Back) into place, then
    // settle into the idle bob.
    const centerX = this.scale.width / 2;
    const fromX = centerX + (direction === 'left' ? -prompt.inSlideX : prompt.inSlideX);
    this.promptContainer
      .setVisible(true)
      .setPosition(fromX, prompt.y)
      .setAlpha(0)
      .setScale(0.6);
    this.tweens.killTweensOf(this.promptContainer);
    this.tweens.add({
      targets: this.promptContainer,
      x: centerX,
      alpha: 1,
      scale: 1,
      duration: prompt.inDurationMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.promptContainer,
          y: prompt.y - prompt.bobAmount,
          duration: prompt.bobMs,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  // Animated exit: shrink + fade out (then hide), so the prompt does not just
  // blink away when the round clears or a crash interrupts it.
  hidePrompt() {
    if (!this.promptContainer || !this.promptContainer.visible) return;
    const prompt = getPrompt();
    const container = this.promptContainer;
    this.tweens.killTweensOf(container);
    this.tweens.add({
      targets: container,
      alpha: 0,
      scale: 0.6,
      y: prompt.y,
      duration: prompt.outDurationMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        container.setVisible(false).setScale(1);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Progress bar — distance to the finish, down the right edge
  // ---------------------------------------------------------------------------

  buildProgressBar() {
    const bar = getProgressBar();
    this.progressBarGfx = this.add.graphics().setDepth(getDepth().bar);
    this.progressGfx = this.add.graphics().setDepth(getDepth().bar + 1);
    this.drawProgressBar(bar);
    this.progressFill = 0;
  }

  // Re-draws the static track/border and the current fill (frac of TOTAL_ROUNDS).
  drawProgressBar(bar = getProgressBar(), frac = this.progressFill ?? 0) {
    const left = bar.x - bar.width / 2;
    const top = bar.y - bar.height / 2;

    this.progressBarGfx.clear();
    this.progressBarGfx.fillStyle(bar.trackFill, bar.trackAlpha);
    this.progressBarGfx.fillRoundedRect(left, top, bar.width, bar.height, bar.radius);
    this.progressBarGfx.lineStyle(bar.borderWidth, bar.border, bar.borderAlpha);
    this.progressBarGfx.strokeRoundedRect(left, top, bar.width, bar.height, bar.radius);

    this.progressGfx.clear();
    const clamped = Phaser.Math.Clamp(frac, 0, 1);
    if (clamped > 0) {
      const h = bar.height * clamped;
      // Fill is anchored to the bottom of the track and grows upward; the corner
      // radius is shrunk when the fill is short so it never bows outward.
      const r = Math.min(bar.radius, h / 2);
      this.progressGfx.fillStyle(bar.fillColor, bar.fillAlpha);
      this.progressGfx.fillRoundedRect(left, top + bar.height - h, bar.width, h, {
        tl: r,
        tr: r,
        bl: bar.radius,
        br: bar.radius,
      });
    }
  }

  // The fill target for a given live round (1-based): rounds already cleared,
  // counted from the start of the run. Intentionally not "highest reached".
  progressFracForRound(liveRound) {
    return (liveRound - 1) * this.roundsCfg.fillPerRound;
  }

  // Animates the bar toward a target fraction (a plain re-draw when it is short).
  animateProgressTo(target) {
    const bar = getProgressBar();
    const from = this.progressFill ?? 0;
    this.progressFill = target;
    this.progressTween?.stop();
    if (Math.abs(target - from) < 0.001 || bar.animateMs <= 0) {
      this.drawProgressBar(bar, target);
      return;
    }
    this.progressTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: bar.animateMs,
      ease: 'Sine.easeOut',
      onUpdate: (tw) => this.drawProgressBar(bar, from + (target - from) * tw.getValue()),
    });
  }

  // Redraw the bar after a live tuning change, keeping the current fill.
  applyProgressBarTuning() {
    this.progressTween?.stop();
    this.drawProgressBar(getProgressBar(), this.progressFill ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Red hit flash
  // ---------------------------------------------------------------------------

  buildFlash() {
    const { width, height } = this.scale;
    this.flashRect = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff2b2b, 1)
      .setDepth(getDepth().flash)
      .setAlpha(0);
  }

  flashRed() {
    this.flashRect.setAlpha(0.55);
    this.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: 450,
      ease: 'Sine.easeOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  // One-shot SFX. Guarded on the clip existing (a failed Cloudinary load must
  // never throw mid-round).
  playSfx(key, volume) {
    if (!this.cache.audio.exists(key)) return;
    this.sound.play(key, { volume });
  }

  // The engine clip loops with a hard seam, so instead of Phaser's `loop` we run
  // TWO voices and crossfade the tail of one into the head of the other (see
  // updateEngine). Both voices are created for this run and destroyed on scene
  // shutdown, so a restart never leaks Sound objects into the SoundManager.
  engineVoicesStillPlaying() {
    return (this.engineVoices || []).some((v) => v?.isPlaying);
  }

  startEngine() {
    if (!this.cache.audio.exists('engine')) return;
    const mix = this.audioCfg;

    if (!this.engineVoices) {
      const mk = () => this.sound.add('engine', { loop: false, volume: 0 });
      this.engineVoices = [mk(), mk()];
    }

    const dur = this.sound.get('engine')?.totalDuration;
    this.engineDuration = dur && dur > 1 ? dur : 0; // 0 → fall back to plain loop

    // If a loop is already running (e.g. a scene restart kept things warm),
    // just refresh the volume and leave it be.
    if (this.engineVoicesStillPlaying()) {
      this.applyEngineVolume();
      return;
    }

    const [a, b] = this.engineVoices;
    // If the clip length is unknown, fall back to a plain (seamless-less) loop
    // rather than a voice that never repeats.
    a.setLoop(this.engineDuration <= 0);
    a.play({ volume: mix.engineVolume });
    this.engineActive = 0;

    // Once the clip is decoded, start B half a cycle after A, so the crossfade
    // phase is already staggered when the first fade happens.
    this.time.delayedCall(120, () => {
      if (this.phase !== 'playing' || this.engineDuration <= 0) return;
      b.play({ volume: 0, seek: this.engineDuration / 2 });
    });
  }

  // Stops both voices and destroys them, so nothing lingers in the SoundManager
  // across a scene restart (the voices are re-created by startEngine).
  stopEngine() {
    (this.engineVoices || []).forEach((v) => {
      v?.stop();
      v?.destroy();
    });
    this.engineVoices = null;
    this.engineFading = false;
  }

  // Re-apply this game's bg-music level to the shared music Sound. Distinct
  // from the shared default so each game can sit at its own level.
  applyBgMusicVolume() {
    const vol = (this.bgMusicCfg || getBgMusic()).volume;
    const music = this.bgMusic || this.sound.get('bgMusic');
    if (music) music.setVolume(vol);
  }

  // Re-apply the tuned volume to whichever voice is audible.
  applyEngineVolume() {
    const mix = getAudioMix();
    if (!this.engineVoices) return;
    const active = this.engineVoices[this.engineActive];
    if (active?.isPlaying) active.setVolume(mix.engineVolume);
  }

  // Called every frame: when the audible voice nears its end, start the other
  // voice and crossfade, so the boundary is a blend of tail-into-head rather
  // than a click.
  updateEngine() {
    if (!this.engineVoices || this.engineDuration <= 0) return;
    const mix = this.audioCfg; // cached — no per-frame getAudioMix() allocation
    const active = this.engineVoices[this.engineActive];
    if (!active?.isPlaying) return;

    const remaining = this.engineDuration - active.seek;
    if (!this.engineFading && remaining <= mix.engineCrossfadeSec) {
      this.engineFading = true;
      const other = this.engineVoices[1 - this.engineActive];
      other.play({ volume: 0 }); // head, overlapping the tail
      this.tweens.killTweensOf([active, other]);
      this.tweens.add({
        targets: active,
        volume: 0,
        duration: mix.engineCrossfadeSec * 1000,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: other,
        volume: mix.engineVolume,
        duration: mix.engineCrossfadeSec * 1000,
        ease: 'Sine.easeInOut',
      });
      this.engineActive = 1 - this.engineActive;
      this.time.delayedCall(mix.engineCrossfadeSec * 1000, () => {
        this.engineFading = false;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Round loop
  // ---------------------------------------------------------------------------

  startRun() {
    this.phase = 'playing';
    this.roundIndex = 0;
    this.mistakes = 0;
    this.plan = buildRoundPlan(this.lanesCfg.length);
    this.progressFill = 0;
    this.drawProgressBar(getProgressBar(), 0);
    this.startEngine(); // the car is running from here until the game ends

    // A quiet beat after Start before the first prompt — the car is rolling, but
    // the player gets a moment to settle in.
    const delay = this.roundsCfg.startDelayMs ?? 0;
    if (delay > 0) this.time.delayedCall(delay, () => this.beginRound());
    else this.beginRound();
  }

  // Sets up the LIVE round (plan[roundIndex]): paints the prompt and schedules
  // the obstacle to appear after the round's shrinking delay.
  //
  // The car is deliberately NOT auto-steered here: the player has to read the
  // prompt and tap to the matching lane themselves. The obstacle lands in the
  // opposite lane, so staying put only works when the prompt already matches the
  // lane the car happens to be in.
  beginRound() {
    // Prior rounds' delayed calls have already fired and auto-removed; drop the
    // stale handles so the list does not grow across a long run.
    this.roundTimers = [];
    const step = this.plan[this.roundIndex];
    const rounds = this.roundsCfg;

    // Defensive: never begin a round from a displaced/limbo car pose.
    if (this.crashActive || this.lurchOffsetX || this.lurchOffsetY || this.crashSpin) {
      this.crashActive = false;
      this.resetCarPose();
    }

    this.obstacleWarned = false;
    this.crashPending = false;
    this.crashFired = false;
    if (this.obstacleSprite) this.obstacleSprite.setVisible(false);

    this.showPrompt(step.direction);

    const delay = roundDelay(rounds.promptHoldMs, step.round);
    // Honk a beat BEFORE the obstacle appears, so it warns the player the hazard
    // is coming (clamped so it never fires in the past or after the spawn).
    const lead = Math.max(0, Math.min(delay - 50, this.audioCfg.honkLeadMs));
    if (lead > 0) {
      this.roundTimers.push(
        this.time.delayedCall(delay - lead, () => this.playSfx('honk', this.audioCfg.honkVolume))
      );
    }
    this.roundTimers.push(
      this.time.delayedCall(delay, () => this.spawnObstacle())
    );
  }

  spawnObstacle() {
    if (this.phase !== 'playing' || this.transitioning) return;
    const step = this.plan[this.roundIndex];
    const lane = this.laneFor(step.obstacleLane);
    if (!this.obstacleSprite || !lane) return;

    // Re-home the sprite in case the lane moved since it was last shown.
    this.placeObstacle(lane, -120, true);
    this.obstacleLane = lane;
    this.obstacleSprite.setVisible(true);

    const rounds = this.roundsCfg;
    this.roundTimers.push(
      this.time.delayedCall(rounds.obstacleWarnMs, () => {
        this.obstacleWarned = true;
      })
    );
  }

  clearRound() {
    // Obedient placement move for the NEXT prompt happens in beginRound(); here
    // we just retire the obstacle and advance.
    if (this.obstacleSprite) this.obstacleSprite.setVisible(false);
    this.hidePrompt();
    this.peakStreak = Math.max(this.peakStreak, this.roundIndex + 1);

    this.roundIndex += 1;
    // After clearing, the next round to play is plan[roundIndex]; its 1-based
    // number drives the distance bar.
    this.animateProgressTo(this.progressFracForRound(this.roundIndex + 1));

    if (this.roundIndex >= TOTAL_ROUNDS) {
      this.roundTimers.push(this.time.delayedCall(450, () => this.finishGame()));
      return;
    }
    // A beat after the obstacle left the frame, the next prompt appears.
    this.roundTimers.push(this.time.delayedCall(1000, () => this.beginRound()));
  }

  // The obstacle reached the car while the car was in its lane → hit.
  handleHit() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.crashFired = true;
    this.crashPending = false;
    this.crashActive = true;

    // Stop the lane-change tween so the car cannot be mid-cross when the crash
    // fires; its lane is banked into `laneX` so the pose is unambiguous.
    this.laneSwitchTweens.forEach((t) => t.stop());
    this.laneSwitchTweens = [];
    this.switchLean = 0;
    this.laneX = this.laneFor(this.currentLane).x;

    this.tweens.killTweensOf(this.promptContainer);
    this.hidePrompt();
    this.flashRed();
    this.playSfx('crash', this.audioCfg.crashVolume);
    this.mistakes += 1;

    const crash = this.carCfg.crash;
    // Keep the obstacle parked in the lane, on top of the crash, so it reads as
    // a collision rather than the obstacle blinking away.
    if (this.obstacleSprite) this.obstacleBaseY = this.obstacleSprite.y;

    // Phase 1 — VIOLENT shake for `durationMs` (shakeCar reads `hitShakeUntil`),
    // plus a lurch: the car is thrown sideways and backward and spins off-axis.
    this.hitShakeUntil = this.time.now + crash.durationMs;

    const dir = this.currentLane === 0 ? -1 : 1;
    this.lurchOffsetX = crash.lurchX * dir;
    this.lurchOffsetY = crash.lurchBack;
    this.crashSpin = 0;
    this.crashTween?.stop();
    this.crashTween = this.tweens.add({
      targets: this,
      lurchOffsetX: this.lurchOffsetX * -0.25,
      lurchOffsetY: 0,
      duration: crash.reboundMs,
      ease: 'Bounce.easeOut',
    });

    // Phase 2 — after the burst + hold, reset the car and knock back a round.
    const totalMs = crash.durationMs + crash.holdMs;
    this.time.delayedCall(totalMs, () => {
      this.crashActive = false;
      this.hitShakeUntil = 0;
      this.lurchOffsetX = 0;
      this.lurchOffsetY = 0;
      this.crashSpin = 0;
      if (this.obstacleSprite) this.obstacleSprite.setVisible(false);
      this.knockBackRound();
    });
  }

  // Puts the car back to a clean, neutral pose at its lane centre. Called after a
  // crash (and defensively at each round start) so no crash displacement or spin
  // can ever persist and leave the car stuck between lanes.
  resetCarPose() {
    if (!this.carContainer) return;
    this.laneX = this.laneFor(this.currentLane).x;
    this.lurchOffsetX = 0;
    this.lurchOffsetY = 0;
    this.crashSpin = 0;
    this.switchLean = 0;
    this.hitShakeUntil = 0;
    this.carContainer.setPosition(this.laneX, this.carCfg.y);
    if (this.carRig) {
      this.carRig.setRotation(0).setPosition(0, 0);
      this.applyCarScale();
    }
  }

  // "Start again on the PREVIOUS round": from round 4 the player restarts on
  // round 3 (or at the start if they were on round 1).
  knockBackRound() {
    this.transitioning = false;
    this.roundIndex = Math.max(0, this.roundIndex - 1);
    this.resetCarPose();
    // Drain the bar back to match the round we restarted on.
    this.animateProgressTo(this.progressFracForRound(this.roundIndex + 1));
    this.beginRound();
  }

  // ---------------------------------------------------------------------------
  // Live tuning re-apply
  // ---------------------------------------------------------------------------

  // Re-reads every tuned value and pushes it onto the objects already on screen,
  // WITHOUT rebuilding them — that is what makes a slider drag apply instantly.
  applyTuning() {
    // Refresh the cache FIRST, so every step below (and the collision offsets)
    // reacts to the change that triggered this re-apply.
    this.cacheTuning();

    // Lane guides (also refresh their dev drag zones).
    this.guideZones.forEach((z) => z.destroy());
    this.guideZones = [];
    this.drawLaneGuides();

    const lanes = this.lanesCfg;
    if (this.carContainer) {
      // Re-anchor x to the (possibly re-tuned) lane centre via laneX, so the
      // next frame's shakeCar() writes the right position.
      this.laneX = this.laneFor(this.currentLane).x;
      this.applyCarScale();
    }

    // Obstacle re-anchor (keeps its current y + texture, and recomputes its
    // inset collision offsets from the fresh OBSTACLE config).
    if (this.obstacleSprite?.visible && this.obstacleLane) {
      const lane = lanes.find((l) => l.id === this.obstacleLane.id) || this.obstacleLane;
      this.obstacleLane = lane;
      this.placeObstacle(lane, this.obstacleBaseY);
    }

    if (this.promptContainer) this.promptContainer.y = getPrompt().y;

    // Start screen: still up → move the button + re-apply the voice volume.
    if (this.startBtn) this.startBtn.container.y = this.startScreenCfg.buttonY;
    if (this.startVoiceSound?.isPlaying) {
      this.startVoiceSound.setVolume(this.startScreenCfg.voiceVolume);
    }

    this.applyProgressBarTuning();
    this.applyEngineVolume();
    this.applyBgMusicVolume();
  }

  // Snapshot every tuning section the frame loop reads, once per round (and on
  // any live tuning change). The accessors deep-copy their section on each call,
  // so calling them inside update() allocated several objects every frame — a
  // measurable cost on old phones. Reading these plain cached objects in the hot
  // paths removes that churn entirely.
  cacheTuning() {
    this.roadCfg = getRoad();
    this.roundsCfg = getRounds();
    this.carCfg = getCar();
    this.lanesCfg = getLanes();
    this.obstacleCfg = getObstacle();
    this.laneGuideCfg = getLaneGuide();
    this.depthCfg = getDepth();
    this.audioCfg = getAudioMix();
    this.bgMusicCfg = getBgMusic();
    this.startScreenCfg = getStartScreen();
  }

  // Lane row by index, from the cache (falls back to a fresh read if not cached).
  laneFor(index) {
    const lanes = this.lanesCfg || getLanes();
    return lanes[index] || lanes[0];
  }

  // ---------------------------------------------------------------------------
  // Dev hooks — canvas drag of lane guides + a snapshot the panel reads.
  // ---------------------------------------------------------------------------

  setupDevHooks() {
    // Drag a lane guide on the canvas to move that lane. The write goes into the
    // shared kit's override store (so the panel sliders stay in step) and the
    // kit immediately re-applies it via the relayout callback registered above.
    this.input.on('pointermove', (pointer) => {
      if (!this.dragGuide) return;
      const { laneId, grabX, grabY } = this.dragGuide;
      ROAD_TUNING.set({ LANES: { [laneId]: { x: pointer.x - grabX, y: pointer.y - grabY } } });
    });
    this.input.on('pointerup', () => {
      this.dragGuide = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  update(_time, delta) {
    if (this.phase !== 'playing') return;
    // The world freezes during a crash: the road and the obstacle stop scrolling
    // and the obstacle (parked on the car) stays put. Only the car animates.
    if (!this.crashActive) {
      const dt = delta / 1000; // seconds
      const step = this.plan[this.roundIndex];
      const liveRound = step ? step.round : 1;
      // Read the cached road speed — no per-frame allocation.
      const travel = roundSpeed(this.roadCfg.scrollSpeed, liveRound) * dt;
      this.scrollRoad(travel);
      this.scrollObstacle(travel);
    }
    this.emitDust(delta);
    this.shakeCar();
    this.updateEngine(); // crossfade the engine loop's tail into the next head
  }

  // A single pooled particle emitter for the exhaust. This replaces the old
  // per-puff `add.image` + tween + destroy churn (a new object and a new tween
  // every ~80 ms that GC then had to collect) with one recycled texture at a
  // fixed count — far kinder to old phones.
  buildDustEmitter() {
    if (!this.textures.exists(this.dustPuffKey)) return;
    const dust = this.carCfg.dust;
    this.dustEmitter = this.add.particles(0, 0, this.dustPuffKey, {
      lifespan: { min: dust.riseMinMs, max: dust.riseMaxMs },
      speedY: { min: dust.driftY * 0.5, max: dust.driftY }, // downward (out the back)
      speedX: { min: -dust.driftX, max: dust.driftX },
      scale: { start: dust.scaleMin, end: dust.scaleMin * 2.4 },
      alpha: { start: dust.startAlpha, end: dust.endAlpha },
      tint: dust.tint,
      quantity: 0,
      emitting: false,
    });
    this.dustEmitter.setDepth(this.depthCfg.dust);
  }

  // Exhaust: emits puffs from the BACK of the car (the car faces up-screen, so
  // the back is the bottom of the sprite) that drift further DOWN-screen. Runs on
  // a cadence, and dumps a bigger, faster burst while crashing.
  emitDust(delta) {
    const emitter = this.dustEmitter;
    if (!emitter || !this.carContainer) return;
    const dust = this.carCfg.dust;
    if (!dust.enabled) return;

    const crashing = this.crashActive;
    this.dustAccum += delta;
    if (this.dustAccum < (crashing ? dust.crashEveryMs : dust.everyMs)) return;
    this.dustAccum = 0;

    const count = crashing ? dust.crashBurst : 1;
    const x = this.carContainer.x + Phaser.Math.Between(-dust.spreadX, dust.spreadX);
    const y = this.carContainer.y + this.carScale * 48;
    // `explode(count, x, y)` — the same particle API other games here use.
    emitter.explode(count, x, y);
  }

  scrollRoad(travel) {
    const tiles = this.roadTiles;
    if (tiles.length === 0) return;
    const dispH = this.tileHeight;
    this.roadScroll = (this.roadScroll + travel) % dispH;
    // Each tile sits one full tile ABOVE its slot, so the window [0, dispH) at
    // the top of the screen is always covered as the offset wraps. Indexed loop
    // (no per-frame iterator/ destructuring allocation).
    for (let i = 0; i < tiles.length; i += 1) {
      tiles[i].tile.y = tiles[i].baseY + this.roadScroll - dispH;
    }
  }

  scrollObstacle(travel) {
    const sprite = this.obstacleSprite;
    if (!sprite || !sprite.visible || this.transitioning) return;

    // Advance the LOGICAL y (bounce/shake is drawn on top of it), then draw.
    this.obstacleBaseY += travel;
    this.applyObstacleMotion();
    const rounds = this.roundsCfg;

    // ---- Accurate overlap test -------------------------------------------
    // Contact is a vertical overlap between the obstacle's INSET extent and the
    // car's INSET body, both using cached nose/tail offsets (no getBounds() per
    // frame, and no transparent padding registering as a hit). The car is settled
    // in a lane at contact (lane taps are locked while transitioning).
    const carY = this.carCfg.y;
    const carTop = carY - this.carNoseOff; // car faces up → its nose is the top edge
    const carBottom = carY + this.carTailOff;
    const obsBottom = sprite.y + this.obstacleNoseOff; // leading (bottom) edge
    const obsTop = sprite.y - this.obstacleTailOff;
    const overlaps = obsBottom > carTop && obsTop < carBottom;

    if (
      this.obstacleWarned &&
      !this.crashFired &&
      this.phase === 'playing' &&
      this.obstacleLane &&
      this.currentLane === this.obstacleLane.id &&
      overlaps
    ) {
      // Register contact, then wait `reactionMs` before the crash actually fires
      // so it lands AS the car plows into the obstacle rather than the frame the
      // edge first touches.
      if (!this.crashPending) {
        this.crashPending = true;
        this.roundTimers.push(
          this.time.delayedCall(this.carCfg.crash.reactionMs, () => {
            if (this.phase === 'playing' && !this.transitioning) this.handleHit();
          })
        );
      }
      return;
    }

    // Fully past the car (its top edge below the car) → round cleared. Using the
    // sprite's real bounds means a tall hitbox is judged consistently. Skipped
    // while a contact is pending: at high speed the obstacle can fully clear the
    // 70 ms reaction grace, and we must not both register a hit AND clear.
    if (!this.crashPending && obsTop > carBottom + rounds.passMargin) {
      this.clearRound();
    }
  }

  shakeCar() {
    if (!this.carRig) return;
    const car = this.carCfg;

    // During the crash BURST the base shake is replaced by the violent one (and
    // the crash spin is layered on). After the burst the car holds still until
    // the round restarts.
    const crashing = this.time.now < this.hitShakeUntil;
    const shake = crashing ? car.crash.shake : car.shake;

    const t = (this.time.now / 1000) * (shake.speed / 10);
    // Layered sines read as an engine judder rather than a clean oscillation.
    this.carRig.x = Math.sin(t) * shake.amplitude * 0.6 + Math.cos(t * 1.7) * shake.amplitude * 0.4;
    this.carRig.y = Math.cos(t * 1.3) * shake.amplitude * 0.5;
    this.carRig.rotation = Phaser.Math.DegToRad(
      Math.sin(t * 0.9) * shake.rotation + this.switchLean + this.crashSpin
    );

    // Lane-change squash: the rig narrows across the car's travel (peak while
    // `switchLean` is at full tilt), then relaxes back to full width.
    const tilt = car.switch?.tiltDeg || 1;
    const squash = car.switch?.squash ?? 1;
    const k = Math.min(1, Math.abs(this.switchLean) / tilt); // 0..1 during a switch
    this.carRig.setScale(this.carScale * (1 - (1 - squash) * k), this.carScale);

    // Container carries the lane position (from the switch tween / live tuning)
    // plus the crash lurch; both on top of the rig's own jitter.
    if (this.carContainer) {
      this.carContainer.x = this.laneX + this.lurchOffsetX;
      this.carContainer.y = car.y + this.lurchOffsetY;
    }
  }

  // ---------------------------------------------------------------------------
  // Start screen
  // ---------------------------------------------------------------------------

  buildStartOverlay() {
    const { width, height } = this.scale;
    const screen = getStartScreen();
    this.phase = 'start';

    this.startOverlay = this.add.container(0, 0).setDepth(getDepth().start);

    if (this.textures.exists('startScreen')) {
      // Fullscreen title art, scaled to COVER the viewport (no letterbox bars).
      const art = this.add.image(width / 2, height / 2, 'startScreen');
      art.setScale(Math.max(width / art.width, height / art.height));
      this.startOverlay.add(art);
    } else {
      // Artwork missing (e.g. a failed load): a plain dark backdrop so the
      // screen still reads and the Start button stays reachable.
      const fallback = this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 1);
      this.startOverlay.add(fallback);
      const title = this.add
        .text(width / 2, height / 2 - 60, 'Lane Switch', {
          fontSize: '56px',
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const how = this.add
        .text(width / 2, height / 2 + 20, 'Tap the side the prompt says', {
          fontSize: '22px',
          fontFamily: 'Fredoka, sans-serif',
          color: '#cbd5e1',
          align: 'center',
          wordWrap: { width: width - 120 },
        })
        .setOrigin(0.5);
      this.startOverlay.add(title);
      this.startOverlay.add(how);
    }

    const startBtn = this.createPillButton(
      width / 2,
      screen.buttonY,
      screen.buttonLabel || 'Start \u25B6',
      {
        fontSize: '34px',
        paddingX: 48,
        paddingY: 20,
        depth: getDepth().start + 1,
      }
    );
    // createPillButton returns a wrapper ({ container, on, ... }), not a plain
    // GameObject — add its container to the overlay, and tween that container.
    this.startOverlay.add(startBtn.container);
    this.tweens.add({
      targets: startBtn.container,
      scale: 1.06,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    startBtn.on('pointerup', () => this.beginPlay());
    this.startBtn = startBtn;

    // Welcome voice: the game has finished loading here (preload scene is done),
    // so start the line and let it play over the title screen. It is cut off the
    // moment Start is tapped (beginPlay).
    this.playStartVoice();
  }

  // Plays the start-screen voice line once. Guarded on the clip existing so a
  // failed Cloudinary load never throws.
  playStartVoice() {
    if (!this.cache.audio.exists('startVoice')) return;
    this.stopStartVoice();
    this.startVoiceSound = this.sound.add('startVoice', {
      volume: getStartScreen().voiceVolume,
    });
    this.startVoiceSound.play();
  }

  stopStartVoice() {
    this.startVoiceSound?.stop();
    this.startVoiceSound?.destroy();
    this.startVoiceSound = null;
  }

  // Fades the start screen out and starts the world moving.
  beginPlay() {
    if (this.phase !== 'start') return;

    this.stopStartVoice(); // the welcome line stops the instant Start is tapped

    const overlay = this.startOverlay;
    this.startOverlay = null;
    this.startBtn = null;
    const fadeMs = getStartScreen().fadeMs ?? 420;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: fadeMs,
      ease: 'Sine.easeOut',
      onComplete: () => overlay.destroy(true),
    });

    this.time.delayedCall(fadeMs, () => this.startRun());
  }

  // ---------------------------------------------------------------------------
  // Finish
  // ---------------------------------------------------------------------------

  finishGame() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';

    this.roundTimers.forEach((t) => t.remove(false));
    this.roundTimers = [];
    this.crashActive = false;
    this.crashTween?.stop();
    this.stopEngine();
    this.tweens.killTweensOf(this.promptContainer);
    if (this.obstacleSprite) this.obstacleSprite.setVisible(false);
    if (this.promptContainer) this.promptContainer.setVisible(false);

    this.stars = starsForMistakes(this.mistakes);
    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);
    this.spawnConfetti(28);

    // The single end-of-run log — matches Game.jsx's completeEventName.
    this.game.events.emit('game13-complete', {
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
      .text(0, -80, 'You made it!', {
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
      .text(0, 50, `${this.mistakes} ${this.mistakes === 1 ? 'bump' : 'bumps'}`, {
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

  // Confetti — small coloured pieces drifting down from above the canvas.
  spawnConfetti(count = 24) {
    const { width, height } = this.scale;
    const texKeys = [makeConfettiTexture(this), makeConfettiSquareTexture(this)];
    const tints = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6];

    for (let i = 0; i < count; i += 1) {
      const key = texKeys[i % texKeys.length];
      const piece = this.add
        .image(Phaser.Math.Between(20, width - 20), Phaser.Math.Between(-180, -60), key)
        .setDepth(getDepth().car + 4)
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
