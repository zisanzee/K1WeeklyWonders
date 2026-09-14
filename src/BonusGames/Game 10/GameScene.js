// GameScene.js
// Game 10 — "Feed the Shapes".
//
// Fruit-ninja-style food shapes launch up from the bottom of the canvas and
// arc back down under gravity. A monster stands on the ground and calls out a
// shape — by name in Level 1 (rounds 1-4), by geometric property in Level 2
// (rounds 5-10). The child walks the monster left and right along the floor to
// be under the right shape as it lands, and to be out from under the wrong
// ones. Three correct catches clears a round; 10 rounds total.
//
// The monster is the only thing the child controls. It is steered by pressing
// anywhere on the left or right half of the play area — the two discs down the
// edges (see buildWalkPad) label those halves rather than being the targets, so
// the whole game is one continuous decision: which way do I walk?
//
// Catching is resolved automatically when a shape reaches the monster's FACE —
// the catch zone is the head's own footprint, so a shape landing on the body or
// the legs does nothing at all. There is no timing input: only positioning.
//
// One scene, no level select: an internal `roundIndex` 0..9 and a per-round
// `phase` of 'playing' → 'success' → next round (or finish at round 10).

import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import {
  ROUND_SCRIPT,
  SHAPES,
  SHAPE_IDS,
  FOOD_KEYS,
  TOTAL_ROUNDS,
  FEEDS_PER_ROUND,
} from './levels';
import { ensureBgMusic, addMuteButton } from '../../Phaser/common/audioState';
import createMonster, {
  MONSTER_START_X,
  MONSTER_CATCH_RADIUS_X,
  MONSTER_CATCH_RADIUS_Y,
  MONSTER_TAP_TOP,
  MONSTER_TAP_BOTTOM,
  MONSTER_TAP_HALF_W,
  MONSTER_TRAVEL_MARGIN,
  MONSTER_WORLD_SCALE,
  MONSTER_FEET_Y,
} from './monster';

// ---------------------------------------------------------------------------
// Layout + tuning constants (720x1080 base resolution — see Phaser/config.js)
// ---------------------------------------------------------------------------
const GRAVITY = 430; // px/s^2, scene-local (the shared default stays 0)
// Every shape is normalised to this on-screen height. Nudged down twice — 150
// felt crowded on a phone, where the monster, the prompt bubble and two shapes
// all compete for the same canvas.
//
// The CATCH ZONE is deliberately not scaled to match: it stays at its own fixed
// size, so shrinking the food is a change in visual density, not in how easy
// the game is to win.
const SHAPE_HEIGHT = 110;
const MAX_SHAPES = 2; // more than this is too busy for a K1 audience
// Spawn across the width the monster can actually reach. Now that it walks the
// floor instead of living in one corner, the whole canvas floor is fair game —
// a shape landing in a lane the monster can't stand in would be uncatchable.
const SPAWN_X_MIN = 150;
const SPAWN_X_MAX = 570;
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
// Horizontal speed is deliberately gentle. This is a positioning game, not a
// reflex game: the child is walking a monster into place with two buttons, so a
// shape that streaks sideways would demand a sprint the controls can't deliver.
const LAUNCH_VX_MAX = 45;
// Shapes now arrive more often, so there's less dead air between throws — at
// the old 1400-2000ms the child often had nothing to react to. The monster is
// walked with buttons rather than dragged, so it can afford the extra traffic.
const SPAWN_MIN_MS = 950;
const SPAWN_MAX_MS = 1400;

// The monster's position, part scales and catch-zone size all live in
// ./monster.js (MONSTER_POSE / MONSTER_FEED_RADIUS_*) — that file is the one
// place to move or resize any part of it.

// Steering feel. The monster eases toward the target rather than snapping to
// it, so it reads as walking and stopping rather than being slid.
const STEER_LERP = 0.18;
// Speed cap in px/s, so a held button can't make the catch zone outrun a shape
// mid-drop. This is the hard ceiling on how fast the monster can ever move.
const STEER_MAX_SPEED = 620;
// Walking speed while a button is held, in px/s. Deliberately under the cap, so
// the button is what sets the pace rather than the cap clipping it.
const STEER_BUTTON_SPEED = 480;

// A press on the monster is ambiguous: it could be a tap to replay the round's
// line, or the start of a walk. Below both of these it counts as the tap.
// Deliberately short and tight — holding to walk has to begin moving quickly
// enough to feel like steering rather than a delay.
const POKE_TAP_MS = 260;
const POKE_SLOP_PX = 18;

// The on-screen steering discs, one down each side and vertically centred.
// Purely the visual cue for the two halves — the whole half of the screen
// presses the button behind it, so nothing depends on hitting the disc itself.
//
// Deliberately NOT enlarged to match that bigger target: at the walk limits the
// disc already overlaps the monster, and growing it would sit it on top of the
// face the child is trying to watch.
const PAD_BUTTON_RADIUS = 64;
const PAD_BUTTON_MARGIN = 30;

// Draw order for the pad parts. Above the flying shapes (6) and the monster
// (12), below the HUD (20+) and the red flash (85).
const PAD_DEPTH = 45;

// Top-left, left-anchored so the bubble grows away from the screen edge. The
// left edge plus the wrap width caps the widest bubble at ~436px, which keeps
// it clear of the progress bar running along the top.
const PROMPT_X = 24;
const PROMPT_Y = 196;
const PROMPT_WRAP = 340;

// Shares the top row with the mute button. The prompt bubble moved up to the
// top-left, so the bar starts to the right of the mute button (which ends at
// x=60) rather than at the far left, and runs to just short of the right edge.
const PROGRESS_W = 600;
const PROGRESS_H = 26;
const PROGRESS_Y = 52;
const PROGRESS_X = 80;

// Where the monster's feet meet the floor, in world y. Derived from the pose in
// monster.js rather than hardcoded, because these must agree or the contact
// shadow visibly detaches from the feet — and the pose y does not move when the
// overall monster scale changes, only the legs' offset from it does.
const FEET_Y = MONSTER_FEET_Y;

const TOTAL_FEEDS = TOTAL_ROUNDS * FEEDS_PER_ROUND;

// The clear colour behind everything, sampled from the 'background' artwork's
// own wood palette.
//
// This exists so the one frame before the artwork's texture draws isn't a bare
// canvas as the scene fades in.
export const BACKGROUND_COLOR = '#FBE7B4';

// HUD colours for sitting on the cream artwork. The shared white/translucent
// styling the other games use is invisible here — a 22%-alpha white track on
// near-white reads as nothing at all — so the bar switches to a dark brown
// track with a gold fill.
const TRACK_COLOR = 0x5b3a12;
const TRACK_ALPHA = 0.32;
const TICK_COLOR = 0xffffff;
const FILL_COLOR = 0xfbbf24;

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
    // The start screen's welcome line, held separately from `currentVoice`
    // (which is the round's instruction). Separate because playVoice() returns
    // early when a key is missing — before stopping what's playing — so a round
    // with no voice clip would leave the welcome talking over the game.
    // beginPlay() stops this explicitly instead.
    this.welcomeVoice = null;

    this.shapes = [];
    this.lastSpawnShape = null;
    this.spawnsSinceTarget = 0;
    this.spawnTimer = null;

    // Steering state. The monster's live position lives on its container; this
    // is only the value the pad eases it toward.
    this.monsterX = MONSTER_START_X;
    this.walkMin = MONSTER_TRAVEL_MARGIN;
    this.walkMax = width - MONSTER_TRAVEL_MARGIN;
    this.speed = 0;
    // A press on the monster that hasn't been resolved into either a poke or a
    // walk yet — see onPointerDown / updatePendingPoke.
    this.pendingPoke = null;

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

    // Stop any in-flight voice when leaving/restarting this scene. The welcome
    // line counts too — leaving the start screen without pressing Start (via
    // the Home link, or a scene restart) must not leave it playing.
    this.events.once('shutdown', () => {
      [this.currentVoice, this.welcomeVoice].forEach((voice) => {
        if (voice) {
          voice.stop();
          voice.destroy();
        }
      });
      this.currentVoice = null;
      this.welcomeVoice = null;
    });

    // 1. Background: the 'background' artwork, cover-fit.
    //
    // There is deliberately no addSkyBackground() gradient underneath it — that
    // would build a second full-screen 720x1080 canvas texture and draw it
    // blended every frame, all of it permanently hidden behind this image,
    // which covers the canvas by construction.
    //
    // The art is a 2:3 portrait backdrop (wood grain with the four foods tucked
    // into the corners), which is exactly the canvas aspect, so cover-fit lands
    // it almost 1:1.
    this.bgArt = this.add.image(width / 2, height / 2, 'background').setDepth(1);
    const cover = Math.max(width / this.bgArt.width, height / this.bgArt.height);
    this.bgArt.setScale(cover);

    // A light wash. Without it the pale artwork leaves the white in-game text
    // (and the pale prompt bubble) with almost no contrast.
    this.levelWash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xffffff, 0.12)
      .setDepth(2);

    // 2. Play area is the whole canvas — shapes sit at a low depth so they can
    //    fly behind the monster and HUD.
    this.buildProgressBar();
    this.buildPromptBubble();
    this.buildMonster();
    this.buildWalkPad();

    // 3. Full-screen red flash overlay — invisible until a wrong feed fires.
    this.redFlash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xff2b2b, 1)
      .setDepth(85)
      .setAlpha(0);

    // 4. Scale factors, per FOOD rather than per shape — every food texture
    // normalises to SHAPE_HEIGHT.
    //
    // Keyed by texture, not by shape id: a shape now has more than one food, and
    // they are different sizes (a 250x250 donut and a 150x250 chocolate bar both
    // represent the same shape at very different aspect ratios). Measuring each
    // texture once here is both correct and cheaper than measuring on spawn.
    this.foodScales = {};
    FOOD_KEYS.forEach((key) => {
      this.foodScales[key] = SHAPE_HEIGHT / measureTexture(this, key).h;
    });

    // Input: the monster follows a held finger anywhere in the play area, and
    // the round's line is replayed by tapping the monster itself (see
    // onPointerDown). Both are registered on the scene rather than per-object,
    // because the target is a container of sprites rather than one hit-testable
    // image.
    this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
    this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));

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
    // Warm brown rather than the indigo the other games veil with — over the
    // cream artwork an indigo scrim reads as a muddy grey.
    this.startOverlay.add(
      this.add.rectangle(0, 0, width, height, 0x4a2c0a, 0.35).setInteractive()
    );

    // The whole card is the 'game-start' artwork — title, mascot, the four
    // foods and the how-to-play line are all baked into it, so none of it is
    // rebuilt here. That replaced a drawn panel plus a food-preview row and
    // three separate text objects, which is both less code and a few draw calls
    // fewer per frame.
    //
    // Added to the overlay at the overlay's own origin, so the button below can
    // be positioned against a known canvas point rather than a nested one.
    const card = this.add.image(0, 0, 'game-start').setOrigin(0.5);
    this.startOverlay.add(card);

    // Sized to fit the viewport with margin rather than at its natural size:
    // the art is 460x500, so on a 720x1080 canvas it is the width that runs out
    // first and the fit is width-driven.
    const margin = 44;
    const fit = Math.min(
      (width - margin * 2) / card.width,
      (height - margin * 2) / card.height
    );
    card.setScale(fit);

    // The button sits near the bottom of the card, over the artwork's flat blue
    // cloud area and clear of its own instruction text.
    //
    // Positioned in the OVERLAY's coordinates, like the card — not the canvas's.
    // The overlay is centred on the canvas, so a canvas-space y here would be
    // read as an offset from that centre and land the button half a screen too
    // low.
    const btnY = (card.height * fit) / 2 - 58;
    const startBtn = this.createPillButton(0, btnY, 'Start \u25B6', {
      fontSize: '38px',
      paddingX: 56,
      paddingY: 20,
      bgColor: 0x8b5cf6,
      textColor: '#ffffff',
      borderColor: 0x5b21b6,
    });

    // MUST be added to the overlay. createPillButton() puts its container on the
    // SCENE, so without this the button is not a child of the overlay — and
    // hideStartOverlay() only fades and destroys the overlay, leaving an orphan
    // Start button sitting on top of the game for the rest of the session.
    this.startOverlay.add(startBtn.container);

    // Soft "come play" bob, same cue the other games' start buttons use.
    this.tweens.add({
      targets: startBtn.container,
      y: btnY - 9,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    startBtn.on('pointerup', () => this.beginPlay());

    // Autoplay the welcome line with the title card. Works without a click for
    // the same reason the round voices do — the scene's SoundManager has
    // already been unlocked by the time the child reaches this screen (they
    // tapped through NameGate), so no extra gesture gate is needed here.
    this.playWelcome();
  }

  beginPlay() {
    if (this.phase !== 'ready') return;

    // Cut the welcome line the moment the child commits, rather than letting it
    // talk over the first round's instruction.
    if (this.welcomeVoice) {
      this.welcomeVoice.stop();
      this.welcomeVoice.destroy();
      this.welcomeVoice = null;
    }

    this.startRound(0);
    this.hideStartOverlay();
  }

  // Plays the start screen's welcome line. Kept separate from playVoice() so
  // it can be stopped on demand (see beginPlay) and so it doesn't occupy
  // `currentVoice`, which belongs to the round instruction.
  playWelcome() {
    const key = 'VA-Welcome';
    if (!this.cache.audio.exists(key)) return;

    // Idempotent, and that guard is load-bearing. A play() on a locked context
    // isn't dropped — it buffers and starts the moment the context unlocks — so
    // the immediate call below AND the unlock retry both fire, giving two
    // overlapping copies of the line. Checking isPlaying is the same guard
    // ensureBgMusic() uses to survive exactly this.
    const start = () => {
      if (this.welcomeVoice && this.welcomeVoice.isPlaying) return;

      this.welcomeVoice = this.sound.add(key);
      this.welcomeVoice.once('complete', () => {
        this.welcomeVoice.destroy();
        this.welcomeVoice = null;
      });
      this.welcomeVoice.play();
    };

    // A deep link straight to the game (persisted login, no tap on this page
    // load) leaves the AudioContext locked. Retry on the unlock event — but only
    // while still on the start screen: if the child has already pressed Start,
    // that press IS the unlock, and playing the welcome then would talk over the
    // first round.
    if (this.sound.locked) {
      this.sound.once('unlocked', () => {
        if (this.phase === 'ready') start();
      });
    }

    start();
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
    this.progressTrack.fillStyle(TRACK_COLOR, TRACK_ALPHA);
    this.progressTrack.fillRoundedRect(left, PROGRESS_Y - radius, PROGRESS_W, PROGRESS_H, radius);

    this.progressFill = this.add.graphics().setDepth(31);
    this.progressFillLeft = left;

    // Ten faint ticks marking the round boundaries, so "after 10 rounds it
    // fills up completely" is readable at a glance.
    this.progressTicks = this.add.graphics().setDepth(32);
    this.progressTicks.fillStyle(TICK_COLOR, 0.55);
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

    this.progressFill.fillStyle(FILL_COLOR, 1);
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
  // Monster
  // -----------------------------------------------------------------------
  // Assembly and posing live in ./monster.js — MONSTER_POSE at the top of that
  // file is the single place to adjust any part's position or scale.

  // Tapping the monster replays the round's instruction so the child can hear
  // the question again — the main reason to tap it. `phase` isn't checked:
  // replaying a clip to re-hear the question is the whole point of the tap, and
  // playVoice() stops whatever is currently speaking, so a fresh line
  // supersedes any in-flight praise rather than layering over it.
  pokeMonster() {
    playVoice(this, this.round.voiceKey);
    this.monster.reactToPoke();
  }

  buildMonster() {
    this.monster = createMonster(this);
    this.monster.container.setX(MONSTER_START_X);

    // Contact shadow under the feet. Kept width-only (no y scaling) so it reads
    // as a shadow on the floor; the y here is the feet, not the assembly origin.
    this.monsterShadow = this.add
      .ellipse(
        MONSTER_START_X,
        FEET_Y,
        300 * MONSTER_WORLD_SCALE,
        56 * MONSTER_WORLD_SCALE,
        0x3b230a,
        0.24
      )
      .setDepth(8);

    // The catch ellipse in LOCAL space — offsets from the monster's own origin,
    // not world coordinates. It has to be local because the monster now moves:
    // a world-space zone would have to be rewritten every frame, and more
    // importantly the catch test would then be reading a stale copy the moment
    // the monster is steered mid-drop. Callers add container.x/y to place it.
    //
    // The catch zone is the head's own footprint — food has to reach the face.
    // Assigned before the reach marker below, which reads its radius.
    this.feedZone = {
      radiusX: MONSTER_CATCH_RADIUS_X,
      radiusY: MONSTER_CATCH_RADIUS_Y,
    };

    // A dim landing pad on the floor, exactly as wide as the catch zone — which
    // is now the head's own width, so the marker genuinely traces what the
    // monster can eat with. Catching is invisible geometry otherwise, and a
    // child has no way to learn how close "close enough" is; this is what makes
    // the mechanic legible, and it slides along the floor as they steer.
    this.reachMark = this.add
      .ellipse(
        MONSTER_START_X,
        FEET_Y,
        this.feedZone.radiusX * 2,
        64 * MONSTER_WORLD_SCALE,
        0xf59e0b,
        0.22
      )
      .setDepth(9);
  }

  // World-space centre of the catch zone — the head, not the mouth. The mouth
  // is only the lower part of the face, so centring the zone there would let
  // the monster miss anything that lands on its forehead.
  catchCentre() {
    return this.monster.getCatchCentre();
  }

  // World-space mouth position, used only for aiming the swallow animation and
  // the "+1" pop. Separate from catchCentre() on purpose — a shape is eaten at
  // the mouth, but it's caught across the whole face.
  mouthPos() {
    return this.monster.getMouth();
  }

  // -----------------------------------------------------------------------
  // Walk pad — one disc down each side, one live half of the screen behind it
  // -----------------------------------------------------------------------
  // Stepping with a held thumb rather than dragging the monster itself: a child
  // steering an object by touching it also has to avoid the falling food, and
  // on a small screen their hand covers the very thing they need to watch.
  //
  // The discs are things to aim AT, not things that must be hit: the whole left
  // half of the play area walks left and the whole right half walks right (see
  // sideFor). A five-year-old aiming at a 64px circle misses it constantly, and
  // a miss read as the game being broken.

  buildWalkPad() {
    const { width, height } = this.scale;
    // Vertically centred, one down each edge — clear of the prompt bubble at
    // the top and the floor marker at the bottom.
    const y = height / 2;

    // The discs are plain shapes at absolute canvas coordinates, NOT containers
    // and NOT interactive. Input is resolved by onPointerDown against the whole
    // half of the screen, so nothing here depends on Phaser hit-testing the art.
    //
    // That also retires the container hit-area trap these used to have: Phaser
    // adds a container's displayOrigin to the pointer before running the hit
    // test, and a Container's displayOrigin is width/2 — so a Circle declared at
    // (0,0) was tested half a button-size away from where it was drawn, leaving
    // a single small crescent that actually responded.
    const makeButton = (x, label, dir) => {
      const ring = this.add
        .circle(x, y, PAD_BUTTON_RADIUS + 7, 0xf59e0b, 0)
        .setStrokeStyle(4, 0xf59e0b, 0.5)
        .setDepth(PAD_DEPTH);
      const disc = this.add
        .circle(x, y, PAD_BUTTON_RADIUS, 0xfff4cf, 0.62)
        .setDepth(PAD_DEPTH);
      const arrow = this.add
        .text(x, y, label, {
          fontSize: '52px',
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: '#7c4a03',
        })
        .setOrigin(0.5)
        .setDepth(PAD_DEPTH);

      // Held state lives on the button, not on the scene, because several
      // different presses — the disc and the empty half of the screen behind
      // it — all land on the same button.
      //
      // `pointerId` is recorded so a two-thumb grip works: holding left and
      // releasing the right thumb must not cancel the left button. Only the
      // pointer that pressed a button can release it.
      const state = { held: false, pointerId: null };

      const press = (pointer) => {
        state.held = true;
        state.pointerId = pointer ? pointer.id : null;
        disc.setFillStyle(0xfde68a, 0.95);
        ring.setStrokeStyle(4, 0xb45309, 0.9);
        arrow.setScale(1.15);
      };

      const release = (pointer) => {
        // Ignore a release from a DIFFERENT finger than the one holding this
        // button — that finger owns the other button, not this one.
        if (pointer && state.pointerId !== null && pointer.id !== state.pointerId) {
          return;
        }
        state.held = false;
        state.pointerId = null;
        disc.setFillStyle(0xfff4cf, 0.62);
        ring.setStrokeStyle(4, 0xf59e0b, 0.5);
        arrow.setScale(1);
      };

      return { state, x, y, dir, press, release };
    };

    this.walkPad = {
      left: makeButton(PAD_BUTTON_MARGIN + PAD_BUTTON_RADIUS, '\u25C0', -1),
      right: makeButton(width - PAD_BUTTON_MARGIN - PAD_BUTTON_RADIUS, '\u25B6', 1),
    };
  }

  // Which way the pad wants to go right now: -1, 0 or 1. Neutral when nothing
  // is held, so releasing is a real command in its own right.
  walkPadDirection() {
    if (!this.walkPad) return 0;
    const l = this.walkPad.left.state.held ? -1 : 0;
    const r = this.walkPad.right.state.held ? 1 : 0;
    return l + r;
  }

  // Which way a press at canvas x means. Splitting on the midpoint exactly means
  // the two halves meet with no dead band down the middle of the screen.
  sideFor(x) {
    return x < this.scale.width / 2 ? -1 : 1;
  }

  // The one button a direction owns. Singular on purpose: a direction has
  // exactly one disc, no matter which part of that half pressed it.
  buttonFor(dir) {
    return dir < 0 ? this.walkPad.left : this.walkPad.right;
  }

  // Holds the button for a direction, wherever on that half the press landed.
  pressSide(dir, pointer) {
    if (!this.walkPad) return;
    this.buttonFor(dir).press(pointer);
  }

  // Resolves a pending press on the monster into either a poke or a walk.
  // Called every frame, because "this has been held too long to be a tap" is a
  // decision that can only be made with time passing.
  updatePendingPoke() {
    const pending = this.pendingPoke;
    if (!pending) return;

    // Steering only means anything mid-round. A press that straddles the beat
    // between rounds is dropped rather than left armed to fire on the next one.
    if (this.phase !== 'playing') {
      this.pendingPoke = null;
      return;
    }

    const heldTooLong = this.time.now - pending.time >= POKE_TAP_MS;
    // Measured from where the finger landed, not from the monster: the monster
    // may be walking, and the press is only a poke if the finger itself stayed
    // put.
    const dragged =
      Phaser.Math.Distance.Between(
        pending.x,
        pending.y,
        this.toWorldX(pending.pointer.x),
        pending.pointer.y
      ) > POKE_SLOP_PX;

    if (!heldTooLong && !dragged) return;

    this.pendingPoke = null;
    this.pressSide(pending.dir, pending.pointer);
  }

  chompMonster() {
    this.monster.chomp();
  }

  // Quick "no" head-shake + show the refused face.
  rejectMonster() {
    this.monster.refuse();
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

    // Which FOOD carries this shape is cosmetic — the game only ever compares
    // shape ids. Picked randomly per spawn so the two foods of a shape both
    // appear over a run rather than one being effectively invisible.
    const foods = SHAPES[id].foods;
    const foodKey =
      foods.length === 1 ? foods[0] : Phaser.Utils.Array.GetRandom(foods);

    const scale = this.foodScales[foodKey];
    const x = Phaser.Math.Between(SPAWN_X_MIN, SPAWN_X_MAX);

    const shadow = this.add
      .ellipse(x, this.scale.height - 46, (SHAPE_HEIGHT * 0.9), 22, 0x000000, 0.22)
      .setDepth(5);

    const sprite = this.physics.add.image(x, SPAWN_Y, foodKey).setDepth(6);
    sprite.setScale(scale);
    // The SHAPE is what gameplay reads; the texture is only what's on screen.
    sprite.shapeId = id;
    sprite.foodKey = foodKey;
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

    // Shapes are never interactive: pointer input drives the monster, and
    // catching is resolved by the scene-wide sweep in checkCatches(). That
    // sidesteps Phaser's hit-area coordinate space entirely.

    this.shapes.push(sprite);
    this.playSound(`throw-whoosh${Phaser.Math.Between(1, 3)}`, 0.7);
  }

  // -----------------------------------------------------------------------
  // Steering — the only thing the player controls
  // -----------------------------------------------------------------------

  // A press in the play area steers: the left half walks left, the right half
  // walks right, and the disc drawn on that side is only the label saying so.
  //
  // A press that lands ON the monster is held back for a beat, because that
  // same tap is how the round's line gets replayed. It converts to a walk the
  // moment the finger drags or the press outlives a tap (updatePendingPoke).
  onPointerDown(pointer) {
    if (this.phase !== 'playing') return;

    const px = this.toWorldX(pointer.x);
    const py = pointer.y;

    // Never steer from the top strip: that row holds the mute button and the
    // progress bar, so a tap there is UI input, and leaning on it would drag
    // the monster to whichever edge the child happened to touch.
    if (py < 110) return;

    // The tap target is the monster's whole body, not just the head. A child
    // reaching out to poke it aims at whatever they can see, so restricting the
    // tap to the head means most taps on the body silently do nothing.
    if (this.isOverMonster(px, py)) {
      this.pendingPoke = {
        pointer,
        x: px,
        y: py,
        time: this.time.now,
        dir: this.sideFor(px),
      };
      return;
    }

    this.pressSide(this.sideFor(px), pointer);
  }

  // Is a world-space point anywhere on the monster?
  //
  // A plain box, deliberately: the monster is a stack of loosely-joined parts
  // (feet, body, head, mouth) with no single silhouette to test against, and a
  // few px of slack around a box is far more forgiving for a fingertip than an
  // exact outline would be.
  isOverMonster(x, y) {
    const c = this.monster.container;
    const dx = x - c.x;
    const dy = y - c.y;
    return (
      dy >= MONSTER_TAP_TOP &&
      dy <= MONSTER_TAP_BOTTOM &&
      Math.abs(dx) <= MONSTER_TAP_HALF_W
    );
  }

  onPointerUp(pointer) {
    // A press that never converted into a walk was a tap on the monster, so
    // replay the round's line. The strip above 110px can't reach here —
    // onPointerDown returns before arming one.
    if (this.pendingPoke && this.pendingPoke.pointer === pointer) {
      this.pendingPoke = null;
      this.pokeMonster();
    }

    // Belt and braces on the pad buttons. The disc is no longer a hit target,
    // so the finger can lift anywhere — including off the canvas entirely — and
    // no per-button pointerup will ever arrive. Without this the button would
    // stay held and the monster would walk into the wall after the child has
    // let go.
    //
    // The pointer is passed through so the buttons can check it against the one
    // that pressed them — releasing with one thumb must not cancel a button
    // being held by the other.
    if (this.walkPad) {
      this.walkPad.left.release(pointer);
      this.walkPad.right.release(pointer);
    }
  }

  // World-space x for a pointer reading. The scene is 1:1 with the camera (no
  // zoom or scroll), so this is just the main camera's world point.
  toWorldX(pointerX) {
    return this.cameras.main.getWorldPoint(pointerX, 0).x;
  }

  // Clamped destination for a raw x. Kept as its own method so the pointer
  // path, the keyboard path and the per-frame easing all agree on the limits.
  clampWalk(x) {
    return Phaser.Math.Clamp(x, this.walkMin, this.walkMax);
  }

  steerToward(x) {
    this.monsterX = this.clampWalk(x);
  }

  // Per-frame steering. Split out of update() so the catch logic below reads as
  // its own concern.
  updateSteering(delta) {
    const dt = Math.min(delta, 50) / 1000; // clamp, so a stalled frame can't teleport

    // The pads nudge the TARGET rather than the position, so the monster keeps
    // moving for a moment after the child releases — that easing is what makes
    // it feel like a character walking and stopping rather than a slider. Both
    // buttons held cancel out, which is the natural reading of pressing both.
    const padDir = this.phase === 'playing' ? this.walkPadDirection() : 0;
    if (padDir !== 0) {
      this.steerToward(
        this.monsterX + Math.sign(padDir) * STEER_BUTTON_SPEED * dt
      );
    }

    const prevX = this.monster.container.x;
    let nextX = Phaser.Math.Linear(prevX, this.monsterX, STEER_LERP);

    // Speed cap. The lerp alone would let a flick across the canvas cross the
    // whole width in a few frames, which at this size reads as a teleport.
    const maxStep = STEER_MAX_SPEED * dt;
    nextX = Phaser.Math.Clamp(nextX, prevX - maxStep, prevX + maxStep);

    this.monster.container.setX(nextX);
    this.speed = dt > 0 ? Math.abs(nextX - prevX) / dt : 0;

    // Lean into the direction of travel, and only while actually moving —
    // otherwise a stationary monster would keep a stale lean after a flick.
    // Called unconditionally: lean() is a no-op unless the direction changes,
    // so there's no need to track the last one here as well.
    this.monster.lean(this.speed > 30 ? Math.sign(nextX - prevX) : 0);

    // Legs step in proportion to the distance actually covered, so they can't
    // end up skating while the monster crawls or vice versa.
    this.monster.walk(delta, this.speed);

    // The pupils ease toward their target here rather than through a tween, so
    // there is nothing to allocate or tear down as the target changes.
    this.monster.updateEyes(delta);

    if (this.monsterShadow) {
      this.monsterShadow.setX(nextX);
    }
    if (this.reachMark) {
      this.reachMark.setX(nextX);
    }

    // Let the monster watch the most threatening shape — the one about to land.
    if (this.phase === 'playing') {
      const incoming = this.mostImminentShape();
      if (incoming) this.monster.lookAt(incoming.x, incoming.y);
    }
  }

  // The shape closest to reaching the catch zone, i.e. the one that matters
  // right now. Returns null when nothing is in flight.
  mostImminentShape() {
    let best = null;
    let bestY = -Infinity;
    this.shapes.forEach((shape) => {
      if (shape.rejected) return;
      // Ignore shapes still on the way up: they're nowhere near the monster's
      // reach, and letting them win would point the eyes at every fresh throw.
      if (shape.body && shape.body.velocity.y < 0) return;
      if (shape.y > bestY) {
        bestY = shape.y;
        best = shape;
      }
    });
    return best;
  }

  // -----------------------------------------------------------------------
  // Catching — automatic, resolved against the monster's mouth
  // -----------------------------------------------------------------------

  // A shape is caught the moment it enters the catch ellipse.
  //
  // The `velocity.y > 0` guard is load-bearing, not a nicety: shapes launch
  // from below the monster and rise straight through the catch zone on the way
  // up, so without it every single throw would be swallowed at launch. Only a
  // descending shape counts.
  //
  // A point test is enough because the zone is tall (~460px on its y axis) and
  // a shape covers ~15px per frame at this gravity, so it cannot tunnel past it.
  checkCatches() {
    if (this.phase !== 'playing') return;

    const head = this.catchCentre();

    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const shape = this.shapes[i];
      if (shape.rejected) continue;
      if (shape.body && shape.body.velocity.y <= 0) continue;

      const dx = (shape.x - head.x) / this.feedZone.radiusX;
      const dy = (shape.y - head.y) / this.feedZone.radiusY;
      if (dx * dx + dy * dy > 1) continue;

      this.resolveCatch(shape);
    }
  }

  // First-time entry into the catch zone fires the rear-up, plus the eye cue.
  // Kept separate from the catch itself so the animation is driven by approach
  // (which is the "catching" moment the child sees) while the resolution is
  // driven by contact.
  checkAnticipation() {
    if (this.phase !== 'playing') return;

    const head = this.catchCentre();
    this.shapes.forEach((shape) => {
      // A rejected shape was already knocked away; it must not re-arm the
      // eat pose on its way out, or the monster would lunge at the food it
      // just refused.
      if (shape.rejected) return;

      // A rising shape is on its way UP past the monster and has no chance of
      // being eaten — it's the throw, not the catch. Reacting to it made the
      // monster gape at the start of every single arc, which read as it being
      // startled by its own food rather than waiting for it.
      if (shape.body && shape.body.velocity.y < 0) return;

      // Wider than the catch zone itself, so the monster starts opening before
      // the shape is close enough to be eaten rather than at the same instant.
      const dx = (shape.x - head.x) / (this.feedZone.radiusX * 1.5);
      const dy = (shape.y - head.y) / (this.feedZone.radiusY * 1.5);
      const near = dx * dx + dy * dy <= 1;

      if (near && !shape.anticipating) {
        shape.anticipating = true;
        this.monster.anticipate();
        this.monster.lookAt(shape.x, shape.y);
      } else if (!near && shape.anticipating) {
        shape.anticipating = false;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Feeding
  // -----------------------------------------------------------------------

  resolveCatch(sprite) {
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
      // Wrong shape: the monster rejects it and knocks it away rather than
      // swallowing it. It has to be removed from play here — the catch test is
      // a per-frame sweep, so a shape left inside the zone would be caught
      // again on the very next frame and rack up a mistake per frame.
      this.mistakes += 1;
      this.streak = 0;
      this.flashRed();
      this.shake(this.promptContainer);
      this.playSound('wrong', 0.8);
      this.rejectMonster();
      this.monster.sulk();
      this.knockAway(sprite);
    }
  }

  // Bounces a rejected shape up and away from the monster, then lets it fall
  // out of play normally. Direction is away from the monster so it always
  // clears the catch zone instead of re-entering it.
  //
  // Deliberately stays in `this.shapes`: update()'s loop is what tracks the
  // ground shadow and despawns anything that falls off the bottom, so pulling
  // it out of the list here would leave the sprite and its shadow frozen on
  // screen forever. `rejected` is what excludes it from catch/anticipation.
  knockAway(sprite) {
    if (!sprite.body) {
      this.removeShapeFromList(sprite);
      this.destroyShape(sprite);
      return;
    }

    // Direction of the knock is measured from the head, since that's what the
    // shape just collided with — not the mouth, which sits lower down.
    const head = this.catchCentre();
    const away = sprite.x >= head.x ? 1 : -1;

    sprite.rejected = true;
    sprite.anticipating = false;
    sprite.body.setAllowGravity(true);
    sprite.body.setVelocity(away * Phaser.Math.Between(180, 300), -420);
    sprite.setAngularVelocity(Phaser.Math.Between(-320, 320));
  }

  // Small reward beat near the monster on each correct feed.
  showFeedPop() {
    const mouth = this.mouthPos();
    const label = this.add
      .text(mouth.x, mouth.y - 90, '+1', {
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

  // Sucks the shape into the mouth. Reads the mouth's live position rather than
  // a cached one, because the monster may still be walking as this fires.
  popIntoMonster(sprite) {
    this.removeShapeFromList(sprite);
    if (sprite.body) sprite.body.enable = false;
    sprite.disableInteractive();

    const mouth = this.mouthPos();

    this.tweens.add({
      targets: sprite,
      x: mouth.x,
      y: mouth.y,
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

    // A finger can be mid-press across a round change, and a held button is
    // ignored outside 'playing'. Releasing here means the press the child was
    // still making doesn't resume as a walk the instant play restarts.
    this.pendingPoke = null;
    if (this.walkPad) {
      this.walkPad.left.release(null);
      this.walkPad.right.release(null);
    }

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

  update(time, delta) {
    const { height } = this.scale;

    // Resolve a press that landed on the monster before steering reads the pad,
    // so a press that has just become a walk is already held this frame.
    this.updatePendingPoke();

    // Steering next: it decides where the mouth is, and the catch test below
    // reads that position through mouthPos().
    this.updateSteering(delta);

    // Approach cue + catch resolution, in that order — a shape that has just
    // entered the zone should already be reared-up for by the time it lands.
    this.checkAnticipation();
    this.checkCatches();

    // Shadows track their shape's simulated height, and anything that falls
    // past the bottom edge simply despawns — no penalty, no mistake. A missed
    // shape is its own punishment: the monster just doesn't get fed.
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
      if (sprite.body) {
        const halfW = (sprite.displayWidth || 0) / 2;
        const halfH = (sprite.displayHeight || 0) / 2;
        if (sprite.x < halfW) sprite.x = halfW;
        else if (sprite.x > this.scale.width - halfW) sprite.x = this.scale.width - halfW;
        if (sprite.y < halfH) sprite.y = halfH;
      }

      if (sprite.y > height + 90) {
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

  // Shakes the prompt bubble on a wrong feed.
  //
  // Restores to PROMPT_X rather than to whatever x the target had when this was
  // called, and kills any shake already running first. Reading the live x is a
  // trap: a second wrong feed landing mid-shake captures the DISPLACED position
  // and then restores the prompt to that, nudging it sideways a little further
  // on every mistake until it drifts off the edge.
  shake(target) {
    this.tweens.killTweensOf(target);
    target.setX(PROMPT_X);

    this.tweens.add({
      targets: target,
      x: PROMPT_X + 8,
      duration: 55,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => target.setX(PROMPT_X),
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
    // playSound, not playVoice: this is a sound effect, and playVoice() would
    // also force-stop whatever the monster is currently saying and register the
    // effect as the active "voice", so a later line could cut it off mid-chomp.
    this.playSound('eating_sound', 0.9);

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
