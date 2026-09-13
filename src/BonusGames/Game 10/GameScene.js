// GameScene.js
// Game 10 — "Feed the Shapes".
//
// Fruit-ninja-style food shapes launch up from the bottom and arc back down
// under gravity. A monster in the bottom-right calls out a shape — by name in
// Level 1 (rounds 1-4), by geometric property in Level 2 (rounds 5-10) — and
// the child catches the matching shape mid-air and drags it into the monster's
// mouth. Three correct feeds clears a round; 10 rounds total.
//
// One scene, no level select: an internal `roundIndex` 0..9 and a per-round
// `phase` of 'playing' → 'success' → next round (or finish at round 10).

import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { ROUND_SCRIPT, SHAPES, SHAPE_IDS, TOTAL_ROUNDS, FEEDS_PER_ROUND } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';

// ---------------------------------------------------------------------------
// Layout + tuning constants (720x1080 base resolution — see Phaser/config.js)
// ---------------------------------------------------------------------------
const GRAVITY = 430; // px/s^2, scene-local (the shared default stays 0)
const SHAPE_HEIGHT = 150; // every shape is normalised to this on-screen height
const MAX_SHAPES = 2; // more than this is too busy for a K1 audience
const SPAWN_X_MIN = 90;
const SPAWN_X_MAX = 450; // clears the monster's corner (x >= ~490)
const SPAWN_Y = 1130; // just below the bottom edge, so shapes fly in
// The arc is fully determined by two numbers: apex height = LAUNCH_VY^2 /
// (2 * GRAVITY), and total flight time = 2 * |LAUNCH_VY| / GRAVITY.
//
// So slowing the flight WITHOUT lowering the apex needs both moved together:
// multiplying GRAVITY by k and LAUNCH_VY by sqrt(k) keeps the apex identical
// while stretching the duration by sqrt(k). Against the previous pairing of
// (620, -1120) this k = 0.69 keeps the same ~1000px apex and same peak height
// (y≈120, just under the progress bar) but stretches the round trip from ~3.6s
// to ~4.9s. Retune both together, or the shapes either stop reaching the top or
// shoot past it.
const LAUNCH_VY = -930;
// Horizontal speed is deliberately gentle: this is a "catch and drag" game,
// not a reflex game, so the shape should hang in the air long enough to grab.
const LAUNCH_VX_MAX = 45;
const SPAWN_MIN_MS = 1400;
const SPAWN_MAX_MS = 2000;

const MONSTER_X = 590;
const MONSTER_Y = 930;
const MONSTER_MOUTH_DY = 30;
// Deliberately generous, and wider vertically than horizontally. The drop
// check is "is the shape's CENTRE inside this circle", so it has to cover the
// whole area a child would reasonably aim at — working distance, not accuracy,
// is the skill being tested here. Vertical radius is the larger of the two
// because the monster is approached from above, so a drop that lands on its
// head should still count.
const FEED_RADIUS_X = 160;
const FEED_RADIUS_Y = 230;

// Bottom-left corner, left-anchored so it grows away from the screen edge. The
// left edge plus a 340px wrap caps the widest bubble at ~436px, which stops it
// running under the (now much wider) feed zone, whose left edge is at x≈430.
const PROMPT_X = 30;
const PROMPT_Y = 950;
const PROMPT_WRAP = 340;

// Started at x=100 and stopped short of the right edge so the bar clears the
// mute button (x≈38), which is the only other thing on the top row.
const PROGRESS_W = 520;
const PROGRESS_H = 26;
const PROGRESS_Y = 64;
const PROGRESS_X = 100;

const TOTAL_FEEDS = TOTAL_ROUNDS * FEEDS_PER_ROUND;

// Backgrounds + clouds, matching the shared aurora night-sky theme.
const THEME = {
  bgColors: ['#1e1b5a', '#4c1d95', '#831843'],
  groundColor: '#312e81',
};

// Safe voice playback — skips gracefully if a clip is missing (round 4 has no
// name clip in some manifests) and stops any previous line so prompts never
// overlap. Deliberately does NOT substitute another clip on a miss: falling
// back to the Level 2 property line here would leak it into Level 1.
function playVoice(scene, key, onComplete) {
  if (!key || !scene.cache.audio.exists(key)) {
    if (onComplete) onComplete();
    return null;
  }
  if (scene.currentVoice) {
    scene.currentVoice.stop();
    scene.currentVoice.destroy();
    scene.currentVoice = null;
  }
  const sound = scene.sound.add(key);
  sound.once('complete', () => {
    sound.destroy();
    scene.currentVoice = null;
    if (onComplete) onComplete();
  });
  sound.play();
  scene.currentVoice = sound;
  return sound;
}

// Measures a texture's native pixel size without leaving it on screen.
function measureTexture(scene, key) {
  const probe = scene.add.image(-1000, -1000, key);
  const w = probe.width;
  const h = probe.height;
  probe.destroy();
  return { w, h };
}

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.startTime = this.time.now;
    this.mistakes = 0;
    this.stars = 0;
    this.streak = 0;
    this.peakStreak = 0;
    this.feedsTotal = 0;
    this.feedsThisRound = 0;
    this.roundIndex = 0;
    this.round = ROUND_SCRIPT[0];
    this.phase = 'ready'; // flipped to 'playing' by beginPlay()
    this.currentVoice = null;

    this.shapes = [];
    this.heldShape = null;
    this.lastSpawnShape = null;
    this.spawnsSinceTarget = 0;
    this.spawnTimer = null;

    this.progressFraction = 0;

    // Gravity is set on this scene's own world rather than the shared
    // DEFAULT_PHYSICS, which stays gravity-free for the other bonus games.
    this.physics.world.gravity.y = GRAVITY;

    // Bounce shapes off the left/right/top edges so they stay in the canvas
    // instead of flying off-screen. The bottom is put far below the viewport,
    // which leaves it effectively open — an unclaimed shape still falls out
    // and despawns normally.
    this.physics.world.setBounds(0, 0, width, height * 3);

    // Background music + first-tap unlock, same pattern as the other games.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft', depth: 1000 });

    // Stop any in-flight voice when leaving/restarting this scene.
    this.events.once('shutdown', () => {
      if (this.currentVoice) {
        this.currentVoice.stop();
        this.currentVoice.destroy();
        this.currentVoice = null;
      }
    });

    // 1. Background — the shared baked aurora gradient rather than the
    //    'background' texture (which is a 250x250 image at the same scale as
    //    the food sprites, so it isn't a scene backdrop) plus a few drifting
    //    clouds, matching the other bonus games.
    this.addSkyBackground(THEME, 'game10-bg').setDepth(0);
    this.addDriftingClouds([
      { xr: 0.16, yr: 0.3, scale: 0.9, alpha: 0.45 },
      { xr: 0.74, yr: 0.52, scale: 1.1, alpha: 0.35 },
    ]);

    // 2. Play area is the whole canvas — shapes sit at a low depth so they can
    //    fly behind the monster and HUD.
    this.buildProgressBar();
    this.buildPromptBubble();
    this.buildMonster();

    // 3. Full-screen red flash overlay — invisible until a wrong feed fires.
    this.redFlash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff2b2b, 1)
      .setDepth(85)
      .setAlpha(0);

    // 4. Scale factors — all four shape textures normalise to SHAPE_HEIGHT.
    this.shapeScales = {};
    SHAPE_IDS.forEach((id) => {
      const tex = measureTexture(this, SHAPES[id].imageKey);
      this.shapeScales[id] = SHAPE_HEIGHT / tex.h;
    });

    // Catching is a distance test against the pointer (grabBest) rather than a
    // per-sprite hit area. Phaser tests a custom hit area in "top-left space"
    // (it adds displayOriginX/Y to the transformed pointer before calling the
    // callback), so a Rectangle built around a sprite's centre with negative
    // coordinates only ever matched its bottom-right quadrant — which is why
    // grabbing used to fail most of the time. One explicit test in world space
    // is both correct and easier to reason about.
    this.grabOffset = { x: 0, y: 0 };
    this.heldDragged = false;

    this.input.on('pointerdown', () => this.grabBest());
    this.input.on('pointerup', () => this.onPointerUp());

    // The round only starts once the child taps Start — see buildStartOverlay()
    // / beginPlay().
    this.buildStartOverlay();
  }

  // -----------------------------------------------------------------------
  // Start overlay — title card + Start button. Everything is built up-front
  // and simply faded out, so tapping Start is instant. Until then `phase` is
  // 'ready', which keeps the spawner idle and the shapes un-grabbable.
  // -----------------------------------------------------------------------

  buildStartOverlay() {
    this.phase = 'ready';

    const { width, height } = this.scale;
    // Centred container, so every child below is positioned relative to the
    // middle of the screen.
    this.startOverlay = this.add.container(width / 2, height / 2).setDepth(200);

    // The veil swallows taps that miss the Start button, so an eager first
    // tap can't grab a shape through the overlay.
    this.startOverlay.add(
      this.add.rectangle(0, 0, width, height, 0x1e1b5a, 0.55).setInteractive()
    );

    // Panel runs nearly the full canvas height. Its children are positioned
    // relative to the centre of this box, not the screen, so growing it here
    // moves the card's content down with it.
    const panelTop = 150 - height / 2;
    const panelH = 780;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.25);
    panel.fillRoundedRect(-340, panelTop + 8, 680, panelH, 40);
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-340, panelTop, 680, panelH, 40);
    panel.lineStyle(8, 0x8b5cf6, 1);
    panel.strokeRoundedRect(-340, panelTop, 680, panelH, 40);
    this.startOverlay.add(panel);

    // A row of the four food shapes as static art instead of one big emoji, so
    // the title screen previews what's actually in the game.
    SHAPE_IDS.forEach((id, i) => {
      const preview = this.add
        .image((i - 1.5) * 132, -255, SHAPES[id].imageKey)
        .setScale(104 / measureTexture(this, SHAPES[id].imageKey).h);
      this.tweens.add({
        targets: preview,
        y: -268,
        duration: 900 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.startOverlay.add(preview);
    });
    this.startOverlay.add(
      this.add
        .text(0, -132, 'Feed the\nShapes', {
          fontSize: '48px',
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: '#4c1d95',
          align: 'center',
        })
        .setOrigin(0.5)
    );
    this.startOverlay.add(
      this.add
        .text(0, 10, 'Catch the shape the monster\nasks for and drag it into its mouth!', {
          fontSize: '24px',
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: '#6d28d9',
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5)
    );

    const startBtn = this.createPillButton(0, 210, 'Start \u25B6', {
      fontSize: '38px',
      paddingX: 56,
      paddingY: 20,
      bgColor: 0x8b5cf6,
      textColor: '#ffffff',
      borderColor: 0x5b21b6,
      depth: 201,
    });
    this.startOverlay.add(startBtn.container);

    // Soft "come play" bob, same cue the other games' start buttons use.
    this.tweens.add({
      targets: startBtn.container,
      y: 201,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    startBtn.on('pointerup', () => this.beginPlay());
  }

  beginPlay() {
    if (this.phase !== 'ready') return;
    this.startRound(0);
    this.hideStartOverlay();
  }

  hideStartOverlay() {
    const overlay = this.startOverlay;
    if (!overlay) return;
    this.startOverlay = null;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => overlay.destroy(true),
    });
  }

  // -----------------------------------------------------------------------
  // HUD — progress bar + prompt bubble
  // -----------------------------------------------------------------------

  buildProgressBar() {
    const left = PROGRESS_X;
    const radius = PROGRESS_H / 2;

    this.progressTrack = this.add.graphics().setDepth(30);
    this.progressTrack.fillStyle(0xffffff, 0.22);
    this.progressTrack.fillRoundedRect(left, PROGRESS_Y - radius, PROGRESS_W, PROGRESS_H, radius);

    this.progressFill = this.add.graphics().setDepth(31);
    this.progressFillLeft = left;

    // Ten faint ticks marking the round boundaries, so "after 10 rounds it
    // fills up completely" is readable at a glance.
    this.progressTicks = this.add.graphics().setDepth(32);
    this.progressTicks.fillStyle(0xffffff, 0.35);
    for (let i = 1; i < TOTAL_ROUNDS; i += 1) {
      const x = left + (PROGRESS_W * i) / TOTAL_ROUNDS;
      this.progressTicks.fillRect(x - 1, PROGRESS_Y - radius + 4, 2, PROGRESS_H - 8);
    }

    this.drawProgressFill(0);
  }

  drawProgressFill(fraction) {
    const left = this.progressFillLeft;
    const radius = PROGRESS_H / 2;
    const w = Math.max(0, PROGRESS_W * fraction);

    this.progressFill.clear();
    if (w <= 0) return;

    this.progressFill.fillStyle(0xfbbf24, 1);
    if (w < PROGRESS_H) {
      this.progressFill.fillRoundedRect(left, PROGRESS_Y - radius, w, PROGRESS_H, w / 2);
    } else {
      this.progressFill.fillRoundedRect(left, PROGRESS_Y - radius, w, PROGRESS_H, radius);
    }
  }

  // Animates the fill rather than snapping it, so each feed reads as progress.
  // Driven off one monotonic counter of correct feeds, so it fills smoothly
  // across all 30 feeds and reaches exactly 100% on round 10's 3rd feed —
  // deriving it from rounds+feedsThisRound instead would double-count the
  // third feed of a round (it's counted both as "this round" and as part of
  // the now-completed round).
  advanceProgressBar() {
    const target = Math.min(1, this.feedsTotal / TOTAL_FEEDS);

    const proxy = { v: this.progressFraction };
    this.tweens.killTweensOf(proxy);
    this.tweens.add({
      targets: proxy,
      v: target,
      duration: 320,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.progressFraction = proxy.v;
        this.drawProgressFill(proxy.v);
      },
      onComplete: () => {
        this.progressFraction = target;
        this.drawProgressFill(target);
      },
    });
  }

  buildPromptBubble() {
    this.promptContainer = this.add.container(PROMPT_X, PROMPT_Y).setDepth(20);
    this.promptBg = this.add.graphics();
    // Left-aligned: the bubble is anchored at its own left edge in setPrompt(),
    // so the word-wrap width is the real constraint on how wide it gets.
    this.promptText = this.add
      .text(0, 0, '', {
        fontSize: '26px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#7c4a03',
        align: 'left',
        wordWrap: { width: PROMPT_WRAP },
      })
      .setOrigin(0, 0.5);
    this.promptContainer.add([this.promptBg, this.promptText]);
  }

  setPrompt(text) {
    this.promptText.setText(text);

    // The old box was built as "text width + 48" and the text pinned at x=0,
    // which is the wrong frame: the box grows from the LEFT edge, so the text
    // ended up jammed against the left rounded cap with all the slack stranded
    // on the right. Centring the text inside the finished box is what actually
    // aligns it — 24px of padding then falls on each side automatically.
    const textW = this.promptText.width;
    const h = this.promptText.height + 28;
    const w = textW + 48;

    this.promptText.setPosition((w - textW) / 2, 0);

    this.promptBg.clear();
    this.promptBg.fillStyle(0x000000, 0.18);
    this.promptBg.fillRoundedRect(0, -h / 2 + 5, w, h, h / 2);
    this.promptBg.fillStyle(0xfff4cf, 1);
    this.promptBg.fillRoundedRect(0, -h / 2, w, h, h / 2);
    this.promptBg.lineStyle(4, 0xf59e0b, 1);
    this.promptBg.strokeRoundedRect(0, -h / 2, w, h, h / 2);
  }

  // -----------------------------------------------------------------------
  // Monster (placeholder art — kept in one method so real art is a local swap)
  // -----------------------------------------------------------------------

  buildMonster() {
    const c = this.add.container(MONSTER_X, MONSTER_Y).setDepth(12);

    const body = this.add.graphics();
    body.fillStyle(0x22c55e, 1);
    body.fillEllipse(0, 0, 200, 180);
    body.lineStyle(6, 0x15803d, 1);
    body.strokeEllipse(0, 0, 200, 180);
    body.fillStyle(0x4ade80, 1);
    body.fillCircle(-58, -42, 16);
    body.fillCircle(52, -50, 12);
    c.add(body);

    c.add(this.add.circle(-38, -30, 22, 0xffffff));
    c.add(this.add.circle(38, -30, 22, 0xffffff));
    c.add(this.add.circle(-38, -26, 11, 0x1f2937));
    c.add(this.add.circle(38, -26, 11, 0x1f2937));

    // The mouth is its own object so it can squash open on a chomp.
    this.monsterMouth = this.add.ellipse(0, MONSTER_MOUTH_DY, 92, 30, 0x7f1d1d);
    c.add(this.monsterMouth);

    this.monster = c;

    // Idle "breathing" so the corner never looks static.
    this.monsterIdleTween = this.tweens.add({
      targets: c,
      y: MONSTER_Y - 9,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Invisible hit-ellipse at the mouth, used to resolve a drop. Elliptical
    // rather than circular — see FEED_RADIUS_X/Y for why it's taller than wide.
    this.feedZone = {
      x: MONSTER_X,
      y: MONSTER_Y + MONSTER_MOUTH_DY,
      radiusX: FEED_RADIUS_X,
      radiusY: FEED_RADIUS_Y,
    };
  }

  chompMonster() {
    this.tweens.killTweensOf(this.monsterMouth);
    this.monsterMouth.setScale(1, 1);
    this.tweens.add({
      targets: this.monsterMouth,
      scaleY: 2.4,
      scaleX: 1.15,
      duration: 110,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => this.monsterMouth.setScale(1, 1),
    });

    // Only the chomp tween is interrupted here — killing every tween on the
    // container would also kill the infinite idle-bob, freezing the monster
    // for the rest of the run after the very first feed.
    if (this.chompTween) this.chompTween.stop();
    this.chompTween = this.tweens.add({
      targets: this.monster,
      scaleX: 1.12,
      scaleY: 0.88,
      duration: 130,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.monster.setScale(1, 1);
        this.chompTween = null;
      },
    });
  }

  // Quick "no" head-shake. Moves the mouth (not the container) so it can't
  // fight the idle-bob tween driving the container's y.
  rejectMonster() {
    if (this.rejectTween) this.rejectTween.stop();
    this.rejectTween = this.tweens.add({
      targets: this.monsterMouth,
      x: -12,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.monsterMouth.setX(0);
        this.rejectTween = null;
      },
    });
  }

  // -----------------------------------------------------------------------
  // Spawning
  // -----------------------------------------------------------------------

  scheduleSpawn(delay) {
    if (this.spawnTimer) {
      this.spawnTimer.remove(false);
      this.spawnTimer = null;
    }
    this.spawnTimer = this.time.delayedCall(delay, () => {
      this.spawnTimer = null;
      if (this.phase !== 'playing') return;

      if (this.shapes.length < MAX_SHAPES) {
        this.spawnShape();
        this.scheduleSpawn(Phaser.Math.Between(SPAWN_MIN_MS, SPAWN_MAX_MS));
      } else {
        // At the cap — retry shortly rather than dropping the slot entirely.
        this.scheduleSpawn(400);
      }
    });
  }

  // Distractor mix: never the same shape twice in a row, and a pity timer so
  // the target can't be absent for more than 3 consecutive spawns (an unlucky
  // RNG streak otherwise reads as "broken" to a 5-year-old).
  pickShapeId() {
    const target = this.round.shape;
    // The pity timer deliberately overrides the no-repeat rule: if the target
    // has been absent for the last few spawns it must come back even if it was
    // also the previous shape.
    const forceTarget = this.spawnsSinceTarget >= 3;
    const pool = SHAPE_IDS.filter(
      (id) => id !== this.lastSpawnShape || (forceTarget && id === target)
    );

    const id = forceTarget ? target : Phaser.Utils.Array.GetRandom(pool);

    if (id === target) this.spawnsSinceTarget = 0;
    else this.spawnsSinceTarget += 1;

    this.lastSpawnShape = id;
    return id;
  }

  spawnShape() {
    const id = this.pickShapeId();
    const scale = this.shapeScales[id];
    const x = Phaser.Math.Between(SPAWN_X_MIN, SPAWN_X_MAX);

    const shadow = this.add
      .ellipse(x, this.scale.height - 46, (SHAPE_HEIGHT * 0.9), 22, 0x000000, 0.22)
      .setDepth(5);

    const sprite = this.physics.add.image(x, SPAWN_Y, SHAPES[id].imageKey).setDepth(6);
    sprite.setScale(scale);
    sprite.shapeId = id;
    sprite.shadow = shadow;

    sprite.setVelocity(Phaser.Math.Between(-LAUNCH_VX_MAX, LAUNCH_VX_MAX), LAUNCH_VY);
    sprite.setAngularVelocity(Phaser.Math.Between(-60, 60));

    // Bounce off the top/left/right edges rather than flying out of the canvas
    // (the world bounds are set in create(), with an effectively open bottom).
    sprite.body.setCollideWorldBounds(true);
    sprite.body.onWorldBounds = true;
    sprite.body.setBounce(0.65, 0.65);
    sprite.body.setDamping(true);
    sprite.body.setDrag(0.98, 1);

    // Squash on launch → normal, so it reads as "thrown".
    const sx = sprite.scaleX;
    const sy = sprite.scaleY;
    sprite.setScale(scale * 1.18, scale * 0.82);
    this.tweens.add({
      targets: sprite,
      scaleX: sx,
      scaleY: sy,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // No per-sprite input at all: grabbing is resolved scene-wide in grabBest()
    // on pointerdown. That avoids Phaser's hit-area coordinate space entirely
    // and means a tap anywhere near a shape still catches it.

    this.shapes.push(sprite);
    this.playSound(`throw-whoosh${Phaser.Math.Between(1, 3)}`, 0.7);
  }

  // -----------------------------------------------------------------------
  // Catch + drag
  // -----------------------------------------------------------------------

  // Picks the shape nearest the tap, within a forgiving radius. Iterating
  // rather than hit-testing per sprite also makes "nearest wins" fall out for
  // free when two shapes overlap.
  grabBest() {
    if (this.phase !== 'playing' || this.heldShape) return;

    const pointer = this.input.activePointer;
    // Ignore taps on the top strip (mute button + progress bar) — a shape near
    // its apex can pass close enough to the mute button to fall inside the grab
    // radius, which would make muting also snatch a shape out of the air.
    if (pointer.y < 130) return;

    const px = this.toWorldX(pointer.x);
    const py = pointer.y;

    // Generous enough for a fingertip, and scaled off the shape size so it
    // stays proportionate if SHAPE_HEIGHT is ever retuned.
    const grabRadius = SHAPE_HEIGHT * 1.05;

    let best = null;
    let bestDist = Infinity;
    this.shapes.forEach((shape) => {
      const dist = Phaser.Math.Distance.Between(px, py, shape.x, shape.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = shape;
      }
    });

    if (best && bestDist <= grabRadius) this.onShapeGrabbed(best, px, py);
  }

  onShapeGrabbed(sprite, px, py) {
    if (this.phase !== 'playing' || this.heldShape) return;

    this.heldShape = sprite;
    // Remember where in the shape it was grabbed, so dragging doesn't teleport
    // the sprite's centre onto the finger while a small one is held.
    this.grabOffset.x = px - sprite.x;
    this.grabOffset.y = py - sprite.y;
    this.heldDragged = false;

    // Freeze it mid-air: zero motion, no gravity, physics integration off —
    // update() then drives its position straight off the pointer.
    if (sprite.body) {
      sprite.body.setVelocity(0, 0);
      sprite.body.setAllowGravity(false);
      sprite.body.moves = false;
    }
    sprite.setAngularVelocity(0);

    this.heldBaseScale = sprite.scaleX;
    sprite.setScale(sprite.scaleX * 1.15, sprite.scaleY * 1.15);

    this.heldGlow = this.add
      .circle(sprite.x, sprite.y, SHAPE_HEIGHT * 0.72, 0xffffff, 0.22)
      .setDepth(5);
  }

  onPointerUp() {
    const sprite = this.heldShape;
    if (!sprite) return;

    this.heldShape = null;
    if (this.heldGlow) {
      this.heldGlow.destroy();
      this.heldGlow = null;
    }
    sprite.setScale(this.heldBaseScale, this.heldBaseScale);

    // Grabs are deliberately loose, so a plain tap near a shape shouldn't count
    // as a feed — that would let the child feed the monster by tapping empty
    // space beside it. Only a real drag can resolve as a feed.
    if (!this.heldDragged) {
      this.releaseToFlight(sprite, Phaser.Math.Between(-60, 60), 60, true);
      return;
    }

    // Ellipse test: normalising each axis by its own radius turns any ellipse
    // into a unit circle, so a single squared-distance comparison covers it.
    const dx = (sprite.x - this.feedZone.x) / this.feedZone.radiusX;
    const dy = (sprite.y - this.feedZone.y) / this.feedZone.radiusY;

    if (dx * dx + dy * dy <= 1) {
      this.resolveFeedAttempt(sprite);
    } else {
      // Released into open air — resume flight where it was dropped rather
      // than snapping back to its launch spot.
      this.releaseToFlight(sprite, Phaser.Math.Between(-60, 60), 120, true);
    }
  }

  // World-space x for a pointer reading. The scene is 1:1 with the camera (no
  // zoom or scroll), so this is just the main camera's world point.
  toWorldX(pointerX) {
    return this.cameras.main.getWorldPoint(pointerX, 0).x;
  }

  releaseToFlight(sprite, vx, vy, allowGravity) {
    if (!sprite.body) return;
    sprite.body.moves = true;
    sprite.body.setAllowGravity(allowGravity);
    sprite.body.setVelocity(vx, vy);
    sprite.setAngularVelocity(Phaser.Math.Between(-70, 70));
  }

  // -----------------------------------------------------------------------
  // Feeding
  // -----------------------------------------------------------------------

  resolveFeedAttempt(sprite) {
    if (sprite.shapeId === this.round.shape) {
      this.feedsThisRound += 1;
      this.feedsTotal += 1;
      this.streak += 1;
      this.peakStreak = Math.max(this.peakStreak, this.streak);

      this.playSound('eating_sound', 0.9);
      this.chompMonster();
      this.showFeedPop();
      this.popIntoMonster(sprite);
      this.advanceProgressBar();

      if (this.feedsThisRound >= FEEDS_PER_ROUND) this.completeRound();
    } else {
      // Wrong shape — visual + mistake only. The sprite survives (it's still
      // catchable) and the round/progress bar do NOT advance.
      this.mistakes += 1;
      this.streak = 0;
      this.flashRed();
      this.shake(this.promptContainer);
      this.playSound('wrong', 0.8);
      this.rejectMonster();
      // Booted back up and to the LEFT, into the play area — a positive vx
      // here would just carry it off the right edge behind the monster.
      this.releaseToFlight(sprite, Phaser.Math.Between(-260, -140), -320, true);
    }
  }

  // Small reward beat near the monster on each correct feed.
  showFeedPop() {
    const label = this.add
      .text(this.feedZone.x, this.feedZone.y - 90, '+1', {
        fontSize: '40px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#86efac',
        stroke: '#14532d',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(70);

    this.tweens.add({
      targets: label,
      y: label.y - 70,
      alpha: 0,
      duration: 750,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  popIntoMonster(sprite) {
    this.removeShapeFromList(sprite);
    if (sprite.body) sprite.body.enable = false;
    sprite.disableInteractive();

    this.tweens.add({
      targets: sprite,
      x: this.feedZone.x,
      y: this.feedZone.y,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      angle: sprite.angle + 90,
      duration: 220,
      ease: 'Sine.easeIn',
      onComplete: () => this.destroyShape(sprite),
    });
  }

  destroyShape(sprite) {
    if (sprite.shadow) sprite.shadow.destroy();
    sprite.destroy();
  }

  removeShapeFromList(sprite) {
    const i = this.shapes.indexOf(sprite);
    if (i !== -1) this.shapes.splice(i, 1);
  }

  // Clears anything still in flight, e.g. between rounds.
  clearShapes() {
    this.heldShape = null;
    if (this.heldGlow) {
      this.heldGlow.destroy();
      this.heldGlow = null;
    }
    this.shapes.forEach((sprite) => this.destroyShape(sprite));
    this.shapes = [];
  }

  // -----------------------------------------------------------------------
  // Round / level progression
  // -----------------------------------------------------------------------

  startRound(roundIndex) {
    this.roundIndex = roundIndex;
    this.round = ROUND_SCRIPT[roundIndex];
    this.feedsThisRound = 0;
    this.phase = 'playing';

    this.setPrompt(this.round.prompt);
    this.popIn(this.promptContainer, 1);
    playVoice(this, this.round.voiceKey);

    this.scheduleSpawn(500);
  }

  popIn(target, toScale, delay = 0) {
    target.setScale(toScale * 0.6);
    this.tweens.add({
      targets: target,
      scale: toScale,
      delay,
      duration: 320,
      ease: 'Back.easeOut',
    });
  }

  completeRound() {
    this.phase = 'success';
    this.stars += 1; // one star per ROUND, not per feed

    const nextIndex = this.roundIndex + 1;
    const isLast = nextIndex >= TOTAL_ROUNDS;

    this.time.delayedCall(700, () => {
      if (this.phase !== 'success') return;

      this.clearShapes();

      if (isLast) {
        this.finishGame();
        return;
      }

      this.phase = 'transition';
      const finishingLevel = this.round.level;

      if (ROUND_SCRIPT[nextIndex].level !== finishingLevel) {
        this.showLevelBanner(`Level ${ROUND_SCRIPT[nextIndex].level}! 🎉`, () => {
          this.startRound(nextIndex);
        });
      } else {
        this.startRound(nextIndex);
      }
    });
  }

  // Automatic, no player input — matches the brief's "no level-select screen".
  showLevelBanner(text, onDone) {
    const { width } = this.scale;
    const c = this.add.container(width / 2, 540).setDepth(60).setScale(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-230, -75, 460, 150, 34);
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-230, -81, 460, 150, 34);
    bg.lineStyle(6, 0x8b5cf6, 1);
    bg.strokeRoundedRect(-230, -81, 460, 150, 34);

    const label = this.add
      .text(0, -6, text, {
        fontSize: '46px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#4c1d95',
      })
      .setOrigin(0.5);

    c.add([bg, label]);

    this.tweens.add({ targets: c, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: c,
      alpha: 0,
      delay: 1150,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        c.destroy();
        onDone();
      },
    });
  }

  // -----------------------------------------------------------------------
  // Per-frame bookkeeping
  // -----------------------------------------------------------------------

  update() {
    const pointer = this.input.activePointer;

    // Held shape follows the pointer with a light lerp — snapping exactly to
    // the cursor reads badly on touch. Clamped to the canvas so a finger that
    // strays off the edge doesn't park the shape outside it.
    if (this.heldShape) {
      const halfW = (this.heldShape.displayWidth || 0) / 2;
      const halfH = (this.heldShape.displayHeight || 0) / 2;
      const grabX = this.toWorldX(pointer.x);
      const targetX = Phaser.Math.Clamp(
        grabX - this.grabOffset.x,
        halfW,
        this.scale.width - halfW
      );
      const targetY = Phaser.Math.Clamp(
        pointer.y - this.grabOffset.y,
        halfH,
        this.scale.height - halfH
      );

      // Track movement so onPointerUp() can tell a deliberate drop from a tap
      // that merely landed near a shape.
      const step = Phaser.Math.Distance.Between(
        targetX, targetY, this.heldShape.x, this.heldShape.y
      );
      if (step > 3) this.heldDragged = true;

      this.heldShape.x += (targetX - this.heldShape.x) * 0.35;
      this.heldShape.y += (targetY - this.heldShape.y) * 0.35;
      if (this.heldGlow) {
        this.heldGlow.setPosition(this.heldShape.x, this.heldShape.y);
      }
    }

    const { height } = this.scale;

    // Shadows track their shape's simulated height, and anything that falls
    // past the bottom edge simply despawns — no penalty, no mistake.
    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const sprite = this.shapes[i];

      if (sprite.shadow) {
        // Lower on screen = closer to the ground = bigger, darker shadow.
        const t = Phaser.Math.Clamp((sprite.y - 200) / (height - 200), 0, 1);
        sprite.shadow.x = sprite.x;
        sprite.shadow.setScale(0.55 + t * 0.75, 0.55 + t * 0.75);
        sprite.shadow.setAlpha(0.08 + t * 0.18);
      }

      // A world-bounds bounce only reverses on the next physics step, by which
      // point the sprite can be a few pixels outside the canvas — clamp it back
      // so it never actually leaves the visible area.
      if (sprite.body && sprite !== this.heldShape) {
        const halfW = (sprite.displayWidth || 0) / 2;
        const halfH = (sprite.displayHeight || 0) / 2;
        if (sprite.x < halfW) sprite.x = halfW;
        else if (sprite.x > this.scale.width - halfW) sprite.x = this.scale.width - halfW;
        if (sprite.y < halfH) sprite.y = halfH;
      }

      if (sprite !== this.heldShape && sprite.y > height + 90) {
        this.despawn(sprite);
      }
    }
  }

  despawn(sprite) {
    this.removeShapeFromList(sprite);
    if (sprite.body) sprite.body.enable = false;
    sprite.disableInteractive();

    const shadow = sprite.shadow;
    sprite.shadow = null;
    if (shadow) {
      this.tweens.add({ targets: shadow, alpha: 0, duration: 250, onComplete: () => shadow.destroy() });
    }
    this.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 250,
      onComplete: () => sprite.destroy(),
    });
  }

  // -----------------------------------------------------------------------
  // Feedback + finish
  // -----------------------------------------------------------------------

  shake(target) {
    const baseX = target.x;
    this.tweens.add({
      targets: target,
      x: baseX + 8,
      duration: 55,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => target.setX(baseX),
    });
  }

  flashRed() {
    this.redFlash.setAlpha(0.38);
    this.tweens.killTweensOf(this.redFlash);
    this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 350, ease: 'Sine.easeOut' });
  }

  // No-ops gracefully when a clip isn't in the manifest.
  playSound(key, volume = 1) {
    if (key && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  finishGame() {
    this.phase = 'finished';
    if (this.spawnTimer) {
      this.spawnTimer.remove(false);
      this.spawnTimer = null;
    }
    this.clearShapes();
    playVoice(this, 'eating_sound'); // celebratory chomp on the final feed

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);

    // The single end-of-run log — matches Game.jsx's completeEventName.
    // `stars` is one per ROUND (max 10), not one per feed, so it stays
    // comparable to `totalRounds` the way the other games report it.
    this.game.events.emit('game10-complete', {
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

    this.add.rectangle(width / 2, height / 2, width, height, 0x1e1b5a, 0.6).setDepth(90);

    const panel = this.add.container(width / 2, height / 2).setDepth(91).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-220, -150, 440, 300, 28);
    panel.add(bg);

    panel.add(
      this.add.text(0, -52, '🍽️', { fontSize: '72px' }).setOrigin(0.5)
    );

    panel.add(
      this.add.text(0, 30, 'Well fed!', {
        fontSize: '42px',
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#1e1b5a',
      }).setOrigin(0.5)
    );

    this.createPillButton(width / 2, height / 2 + 105, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 92,
    }).on('pointerup', () => this.scene.restart());
  }
}
