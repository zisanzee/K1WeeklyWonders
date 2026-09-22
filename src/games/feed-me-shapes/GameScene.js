// GameScene.js
// Game 10 — "Feed Me Shapes".
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
import BaseScene from '@/phaser/BaseScene';
import {
  ROUND_SCRIPT,
  SHAPES,
  SHAPE_IDS,
  FOOD_KEYS,
  TOTAL_ROUNDS,
  FEEDS_PER_ROUND,
} from '@/games/feed-me-shapes/levels';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
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
} from '@/games/feed-me-shapes/monster';

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

// The prompt pill is CENTRED along the top row and the Hint button sits
// top-right. The pill's width adapts to its wording but is capped so the centred
// pill still clears the button — see setPrompt, which wraps to that cap before
// measuring. Tapping Hint slides the whole prompt off the left edge and brings
// the hint card in to the top-left.
const PROMPT_ROW_Y = 158;
// Distance the prompt travels past the left edge when it slides out.
const PROMPT_MARGIN_X = 24;
const HINT_BUTTON_MARGIN = 24;
// Clear space kept between the prompt pill and the Hint button.
const PROMPT_HINT_GAP = 24;
const PROMPT_FONT_SIZE = 32;
// Horizontal padding between the pill's edge and the text it holds.
const PROMPT_PAD_X = 24;
// Level 1 shows the target shape INSIDE the prompt pill, to the right of the
// wording. Drawn as a geometry glyph (not a food sprite) so it states the shape
// itself — a triangle reads as a triangle — rather than one of the many foods
// that happen to be that shape.
const PROMPT_SHAPE_GAP = 18;
const PROMPT_SHAPE_H = 64;
const SHAPE_GLYPH_FILL = 0xffd93d;
// A dark brown outline, not the amber the fill nearly matched: an amber stroke
// over a yellow fill was invisible, so the glyph read as a flat blob.
const SHAPE_GLYPH_STROKE = 0x7c4a03;
// The hint art is 272x304, flush against the left edge. Scale 1.125 is half, up
// 50% (to 0.75), up a further 50%. Its rendered width drives the slide-in
// distance; the height follows from the art's aspect ratio.
const HINT_CARD_X = 0;
const HINT_IMAGE_SCALE = 1.125;

// Presses above this y never steer the monster — that strip holds the mute
// button and the progress bar, so a tap there is UI input. The prompt row below
// it is excluded by rect instead (see isInPromptRow), so growing the prompt pill
// doesn't turn a whole horizontal band of the play area into dead space.
const HUD_TOP_GUARD = 110;

// Shares the top row with the mute button. The bar starts to the right of the
// mute button (which ends at x=60) rather than at the far left, and runs to
// just short of the right edge.
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

    // Cached per-frame values. These are all pure functions of things that only
    // change on a resize (which cancels the scene), so recomputing them every
    // frame in the catch/anticipation sweep was pure waste.
    // The reused output object for the catch-centre query, so the per-frame
    // sweeps never allocate.
    this.catchPoint = { x: 0, y: 0 };
    // Reciprocal radii: the catch test divides by them twice per shape, and a
    // multiply by the reciprocal is cheaper than a divide.
    this.invFeedRx = 1 / MONSTER_CATCH_RADIUS_X;
    this.invFeedRy = 1 / MONSTER_CATCH_RADIUS_Y;
    // The anticipation zone is the catch zone widened by 1.5 (see
    // checkAnticipation), so its reciprocals are precomputed too.
    this.invAnticipateRx = 1 / (MONSTER_CATCH_RADIUS_X * 1.5);
    this.invAnticipateRy = 1 / (MONSTER_CATCH_RADIUS_Y * 1.5);
    // Floor for the shadow ramp, cached so it isn't recomputed per shape.
    this.shadowRampRange = Math.max(1, height - 200);
    // Narrower half-extents used by the per-frame bounds clamp.
    this.clampHalfW = 0;
    this.clampHalfH = 0;

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
    // Widest normalised footprint across every food, so the per-frame bounds
    // clamp can use one cached half-width instead of reading each sprite's
    // displayWidth every frame. Every food is normalised to SHAPE_HEIGHT, but
    // their aspect ratios differ, so the width takes the max rather than
    // assuming a square. The height is SHAPE_HEIGHT by construction.
    let widest = 0;
    FOOD_KEYS.forEach((key) => {
      const { w, h } = measureTexture(this, key);
      const scale = SHAPE_HEIGHT / h;
      this.foodScales[key] = scale;
      const displayW = w * scale;
      if (displayW > widest) widest = displayW;
    });
    // The arcade body is set from display size at spawn and the sprite is never
    // scaled afterwards, so these match the old per-sprite displayWidth/2 reads.
    this.clampHalfW = widest / 2;
    this.clampHalfH = SHAPE_HEIGHT / 2;

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

    // The button sits low on the card, over the artwork's flat blue cloud area
    // and clear of its own instruction text. Raised from the very bottom edge so
    // it reads as part of the card rather than hanging off it.
    //
    // Positioned in the OVERLAY's coordinates, like the card — not the canvas's.
    // The overlay is centred on the canvas, so a canvas-space y here would be
    // read as an offset from that centre and land the button half a screen too
    // low.
    const btnY = (card.height * fit) / 2 - 104;
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
  // across every feed and reaches exactly 100% on the last round's final feed —
  // deriving it from rounds+feedsThisRound instead would double-count the
  // last feed of a round (it's counted both as "this round" and as part of
  // the now-completed round). TOTAL_FEEDS tracks FEEDS_PER_ROUND, so this stays
  // correct if the per-round count changes again.
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
    // The pill is sized, wrapped and centred per round in setPrompt(); this only
    // builds the objects.
    this.promptContainer = this.add
      .container(PROMPT_MARGIN_X, PROMPT_ROW_Y)
      .setDepth(20);
    this.promptBg = this.add.graphics();
    this.promptText = this.add
      .text(0, 0, '', {
        fontSize: `${PROMPT_FONT_SIZE}px`,
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#7c4a03',
        // Centre-aligned so every wrapped line is centred within the pill
        // rather than ragged-right against its left inset.
        align: 'center',
        wordWrap: { width: 0 },
      })
      .setOrigin(0, 0.5);
    // Level 1 shows the target shape right of the prompt. Drawn as a geometry
    // glyph per round in setPrompt(); hidden by default so Level 2 (and the
    // frames before round 1) never show a stale shape. Sits inside the prompt
    // container, so it travels with the prompt on the slide and the shake.
    this.promptShape = this.add.graphics().setVisible(false);
    this.promptShapeW = 0;
    this.promptContainer.add([this.promptBg, this.promptText, this.promptShape]);
    this.promptBaseX = PROMPT_MARGIN_X; // shake() restores to this

    // The hint image is a card hugging the top-left corner. It slides in from the
    // left while the prompt slides out off the same edge, so the illustration
    // takes the prompt's place instead of covering it. Built empty here; filled
    // in setPrompt() (Level 1 rounds have no hint).
    this.hintPanel = this.add.container(0, PROMPT_ROW_Y).setDepth(22).setVisible(false);
    this.hintImage = null;
    this.hintOpen = false;
    this.hintTargetX = 0;
    this.hintStartX = -1000;

    // The Hint button sits in the top-right corner of the row — the opposite
    // end from the prompt, so the two never compete for space.
    this.hintButton = this.createPillButton(0, PROMPT_ROW_Y, 'Hint \uD83D\uDCA1', {
      fontSize: '26px',
      paddingX: 20,
      paddingY: 12,
      bgColor: 0xffd93d,
      textColor: '#7c4a03',
      borderColor: 0xf59e0b,
      depth: 21,
    });
    this.hintButton.on('pointerup', () => this.toggleHint());
    // Hidden until the first setPrompt() decides whether this round has a hint;
    // otherwise a stray "Hint" pill would sit above the start overlay's veil.
    this.hintButton.container.setVisible(false);
    this.hintRightX = 0;

    // The row is UI, never a steering zone. Set for real in setPrompt(); these
    // defaults only cover the frames before the first round.
    this.promptRowHit = { left: 0, right: 0, top: 0, bottom: 0 };
    this.hintRowHit = { left: 0, right: 0, top: 0, bottom: 0 };
    this.hintCardHit = { left: 0, right: 0, top: 0, bottom: 0 };
  }

  setPrompt(text, round, hintKey = null) {
    const hintW = this.hintButton.width();
    // Place the button BEFORE wrapping the prompt, because its width sets the
    // space the prompt must leave for it.
    this.hintRightX = this.scale.width - HINT_BUTTON_MARGIN - hintW / 2;
    this.hintButton.container.setX(this.hintRightX);

    // Level 1 shows the target shape inside the pill, right of the wording;
    // Level 2 relies on the wording and the hint art instead. Its width is
    // measured here (before the wrap) because the pill — text column + shape
    // slot — must fit the space to the left of the Hint button.
    const showShape = !!round && round.level === 1;
    // The glyph is drawn at a fixed square footprint, so the wrap only has to
    // reserve that plus the gap.
    const shapeW = PROMPT_SHAPE_H;
    const shapeSpace = showShape ? PROMPT_SHAPE_GAP + shapeW : 0;

    // Cap the prompt so the centred pill (which now holds the shape too) can
    // never grow under the Hint button. Wrapping to this width rather than
    // letting the text run wide and then clipping it is what keeps the text
    // style intact: it wraps to a second line instead of colliding with the
    // button. The pill is centred, so its right edge is at (width + w)/2 and
    // must clear the button's left edge.
    // PROMPT_PAD_X * 2 is the pill's own horizontal padding, which adds to the
    // pill width but not to the wrap width — leaving it out would let the pill's
    // right edge land exactly on the button's left edge.
    const promptMaxWidth = Math.max(
      120,
      2 * (this.hintRightX - hintW / 2 - PROMPT_HINT_GAP - this.scale.width / 2) -
        PROMPT_PAD_X * 2 -
        shapeSpace
    );
    this.promptText.setWordWrapWidth(promptMaxWidth);
    this.promptText.setText(text);

    // The pill is sized to the widest WRAPPED line, plus the shape slot when
    // Level 1 shows one, plus PROMPT_PAD_X on each side. Phaser's `align:
    // 'center'` centres each wrapped line against the widest line, so anchoring
    // the text at the pill's left padding is enough to centre every line within
    // its own column — no fixed size needed (and it would be actively wrong: a
    // fixed width would be re-reported as the content width next round).
    const textW = this.promptText.width;
    const h = this.promptText.height + 28;
    const w = textW + shapeSpace + PROMPT_PAD_X * 2;

    // Origin 0 x keeps the text's left edge exactly at the pill's padding, which
    // is what leaves the shape slot clear on the right.
    this.promptText.setOrigin(0, 0.5);
    this.promptText.setPosition(PROMPT_PAD_X, 0);

    this.promptBg.clear();
    this.promptBg.fillStyle(0x000000, 0.18);
    this.promptBg.fillRoundedRect(0, -h / 2 + 5, w, h, h / 2);
    this.promptBg.fillStyle(0xfff4cf, 1);
    this.promptBg.fillRoundedRect(0, -h / 2, w, h, h / 2);
    this.promptBg.lineStyle(4, 0xf59e0b, 1);
    this.promptBg.strokeRoundedRect(0, -h / 2, w, h, h / 2);

    // Draw the glyph inside the pill, just right of the text and vertically
    // centred with it. Drawn here (rather than as a texture) so a triangle is a
    // triangle, not whichever food happens to carry that shape.
    if (showShape) {
      this.drawShapeGlyph(
        round.shape,
        PROMPT_PAD_X + textW + PROMPT_SHAPE_GAP + shapeW / 2,
        0,
        shapeW
      );
      this.promptShape.setVisible(true);
    } else {
      this.promptShape.clear();
      this.promptShape.setVisible(false);
    }

    // The pill is the whole visual footprint now that the shape is inside it, so
    // centring the pill centres the group. Only the slide-out destination changes
    // when the hint opens, so this restores it to the resting position.
    //
    // promptW is the full visual footprint and is what the slide/transition use,
    // while promptBaseX is the container origin (the pill's left edge).
    this.promptBaseX = (this.scale.width - w) / 2; // shake() restores to this
    this.promptContainer.setX(this.promptBaseX);
    this.promptW = w;

    // The row is UI: the play-area steering handler ignores presses that land on
    // it (see onPointerDown). Two tight rects — the prompt group and the Hint
    // button — rather than a full-width band, so the rest of the strip stays
    // playable.
    const rowTop = PROMPT_ROW_Y - h / 2 - 6;
    const rowBottom = PROMPT_ROW_Y + h / 2 + 6;
    this.promptRowHit = {
      left: this.promptBaseX - 6,
      right: this.promptBaseX + w + 6,
      top: rowTop,
      bottom: rowBottom,
    };
    this.hintRowHit = {
      left: this.hintRightX - hintW / 2 - 6,
      right: this.hintRightX + hintW / 2 + 6,
      top: rowTop,
      bottom: rowBottom,
    };

    this.configureHint(hintKey, h);
  }

  // Draws one of the four shapes as actual geometry into this.promptShape.
  // Coordinates are container-local; (cx, cy) is the glyph's centre and `size`
  // its bounding square. The rectangle is drawn wider than tall — that
  // proportion IS what distinguishes it from a square, so the two must not come
  // out looking alike.
  drawShapeGlyph(shapeId, cx, cy, size) {
    const g = this.promptShape;
    g.clear();
    g.fillStyle(SHAPE_GLYPH_FILL, 1);
    g.lineStyle(4, SHAPE_GLYPH_STROKE, 1);

    // One pass per path. Phaser's Graphics batches by fill/stroke state, so a
    // fill+stroke pair per primitive preserves the draw order AND stays a single
    // geometry pass — issuing all fills and then all strokes would double that.
    if (shapeId === 'circle') {
      g.fillCircle(cx, cy, size / 2);
      g.strokeCircle(cx, cy, size / 2);
      return;
    }

    if (shapeId === 'triangle') {
      const half = size / 2;
      g.beginPath();
      g.moveTo(cx, cy - half);
      g.lineTo(cx + half, cy + half);
      g.lineTo(cx - half, cy + half);
      g.closePath();
      g.fillPath();
      g.strokePath();
      return;
    }

    // A rectangle is drawn clearly wider than tall — that difference in
    // proportions is exactly the contrast the Level 1 rounds are teaching, so
    // the two must not read as the same glyph. The square is inset slightly so
    // it sits visually the same size as the others.
    const isRect = shapeId === 'rectangle';
    const rw = isRect ? size : size * 0.82;
    const rh = isRect ? size * 0.6 : size * 0.82;
    g.fillRect(cx - rw / 2, cy - rh / 2, rw, rh);
    g.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
  }

  // Builds this round's hint card (272x304 art, scaled by HINT_IMAGE_SCALE) in
  // the top-left corner, or hides the button entirely when the round has no
  // hint. Top-aligned with the prompt so the illustration's top edge sits level
  // with the pill and the Hint button.
  configureHint(key, bubbleH) {
    if (this.hintImage) {
      this.hintImage.destroy();
      this.hintImage = null;
    }
    this.hintOpen = false;
    this.hintPanel.setVisible(false);
    this.promptContainer.setX(this.promptBaseX);
    // Back to the closed (amber, lightbulb) look — a round starting while the
    // previous hint was open would otherwise inherit the red ✕ state.
    this.setHintButtonState(false);

    const usable = key && this.textures.exists(key);
    this.hintButton.container.setVisible(!!usable);
    if (!usable) return;

    // The image is top-left anchored at the panel's own origin, so the panel's
    // x IS the card's left edge — that's what lets HINT_CARD_X sit it flush
    // against the canvas edge. (Anchoring by centre here was the bug that left
    // the card stranded half its width in from the edge.)
    const img = this.add.image(0, 0, key).setOrigin(0, 0);
    img.setScale(HINT_IMAGE_SCALE);
    // Top edge level with the prompt pill.
    img.setPosition(0, -bubbleH / 2);
    this.hintPanel.add(img);
    this.hintImage = img;

    const cardW = img.displayWidth;
    const cardTop = PROMPT_ROW_Y - bubbleH / 2;
    // Open: left edge at HINT_CARD_X. Closed: a full card-width further left,
    // i.e. entirely off-canvas.
    this.hintTargetX = HINT_CARD_X;
    this.hintStartX = HINT_CARD_X - cardW;
    // The card is sizeable enough to reach down into the play area, so while
    // it's open it's treated as UI too — a tap on it must not walk the monster.
    this.hintCardHit = {
      left: HINT_CARD_X,
      right: HINT_CARD_X + cardW,
      top: cardTop,
      bottom: cardTop + img.displayHeight,
    };
    // The prompt slides out until its centred pill is entirely past the left
    // edge — its own left edge must travel a full pill-width past 0.
    this.promptOpenX = -this.promptW - PROMPT_MARGIN_X;
    this.hintPanel.setX(this.hintStartX);
  }

  toggleHint() {
    if (!this.hintImage) return; // no hint for this round (Level 1)
    if (this.phase !== 'playing') return;
    if (this.hintOpen) this.closeHint();
    else this.openHint();
  }

  openHint() {
    this.hintOpen = true;
    this.setHintButtonState(true);
    this.tweens.killTweensOf(this.hintPanel);
    this.tweens.killTweensOf(this.promptContainer);
    this.hintPanel.setVisible(true).setX(this.hintStartX);
    // The card slides in from the left while the prompt slides out off the left
    // edge, handing the top row over to the illustration.
    this.tweens.add({
      targets: this.hintPanel,
      x: this.hintTargetX,
      duration: 320,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.promptContainer,
      x: this.promptOpenX,
      duration: 320,
      ease: 'Back.easeOut',
    });
  }

  closeHint() {
    this.hintOpen = false;
    this.setHintButtonState(false);
    this.tweens.killTweensOf(this.hintPanel);
    this.tweens.killTweensOf(this.promptContainer);
    this.tweens.add({
      targets: this.hintPanel,
      x: this.hintStartX,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => this.hintPanel.setVisible(false),
    });
    this.tweens.add({
      targets: this.promptContainer,
      x: this.promptBaseX,
      duration: 260,
      ease: 'Sine.easeIn',
    });
  }

  // The Hint button while the hint is open reads as "tap to close": red, with
  // an ✕ in place of the lightbulb. Leaving it looking like the closed state
  // would imply a second tap opens another hint rather than putting this one
  // away.
  setHintButtonState(open) {
    this.hintButton.setText(open ? 'Hint \u2715' : 'Hint \uD83D\uDCA1');
    this.hintButton.setBg(open ? 0xef4444 : 0xffd93d);
    this.hintButton.setBorder(open ? 0xb91c1c : 0xf59e0b);
    this.hintButton.setTextColor(open ? '#ffffff' : '#7c4a03');

    // setText() re-measures the pill, so the two labels can differ in width by
    // a few px — re-derive the tap row from the live width rather than leaving
    // the old rect behind.
    const hintW = this.hintButton.width();
    this.hintRowHit = {
      left: this.hintRightX - hintW / 2 - 6,
      right: this.hintRightX + hintW / 2 + 6,
      top: this.hintRowHit.top,
      bottom: this.hintRowHit.bottom,
    };
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
    // Filled into the scene's own reused object — see monster.getCatchCentre.
    return this.monster.getCatchCentre(this.catchPoint);
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

    let id;
    if (forceTarget) {
      id = target;
    } else {
      // Rejection-sample the 4 shapes instead of building a filtered array every
      // spawn: the pool is `SHAPE_IDS minus lastSpawnShape`, so re-rolling until
      // it differs is the same distribution with no allocation. Bounded so a
      // pathological RNG still terminates.
      const n = SHAPE_IDS.length;
      let guard = 0;
      do {
        id = SHAPE_IDS[Math.floor(Math.random() * n)];
        guard += 1;
      } while (id === this.lastSpawnShape && guard < 12);

      // Fell through the guard (only reachable if lastSpawnShape repeats
      // pathologically) — step to the next shape so it always differs.
      if (id === this.lastSpawnShape) {
        id = SHAPE_IDS[(SHAPE_IDS.indexOf(id) + 1) % n];
      }
    }

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
    // the monster to whichever edge the child happened to touch. Two rects are
    // excluded rather than the whole strip: the mute/progress HUD above, and the
    // prompt row. Blocking the entire top band would have grown into dead space
    // as the prompt pill got taller.
    if (py < HUD_TOP_GUARD) return;
    if (this.isInPromptRow(px, py)) return;

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

  // Does a world-space point fall on the prompt pill or the Hint button? Those
  // are UI, so a press there must not steer the monster — but each exclusion is
  // a tight rect, so the row's empty gaps and the rest of that strip stay
  // playable.
  isInPromptRow(x, y) {
    const rects = [this.promptRowHit, this.hintRowHit];
    if (this.hintOpen) rects.push(this.hintCardHit);
    return rects.some(
      (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    );
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
    // Index loop, not forEach — this runs every frame and forEach allocates a
    // closure per call. At most MAX_SHAPES (2) iterations, so it's also cheaper
    // than the iterator machinery.
    const shapes = this.shapes;
    for (let i = 0; i < shapes.length; i += 1) {
      const shape = shapes[i];
      if (shape.rejected) continue;
      // Ignore shapes still on the way up: they're nowhere near the monster's
      // reach, and letting them win would point the eyes at every fresh throw.
      if (shape.body && shape.body.velocity.y < 0) continue;
      if (shape.y > bestY) {
        bestY = shape.y;
        best = shape;
      }
    }
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
    // Read the cached reciprocals into locals — this loop runs every frame.
    const invRx = this.invFeedRx;
    const invRy = this.invFeedRy;

    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const shape = this.shapes[i];
      if (shape.rejected) continue;
      if (shape.body && shape.body.velocity.y <= 0) continue;

      const dx = (shape.x - head.x) * invRx;
      const dy = (shape.y - head.y) * invRy;
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
    // Wide-zone reciprocals, cached — see the constructor values.
    const invRx = this.invAnticipateRx;
    const invRy = this.invAnticipateRy;
    const shapes = this.shapes;

    // An index loop, not forEach: this runs every frame and forEach allocates a
    // closure each time, which is exactly the kind of steady garbage that shows
    // up as periodic stutter on phones.
    for (let i = 0; i < shapes.length; i += 1) {
      const shape = shapes[i];

      // A rejected shape was already knocked away; it must not re-arm the
      // eat pose on its way out, or the monster would lunge at the food it
      // just refused.
      if (shape.rejected) continue;

      // A rising shape is on its way UP past the monster and has no chance of
      // being eaten — it's the throw, not the catch. Reacting to it made the
      // monster gape at the start of every single arc, which read as it being
      // startled by its own food rather than waiting for it.
      if (shape.body && shape.body.velocity.y < 0) continue;

      // Wider than the catch zone itself, so the monster starts opening before
      // the shape is close enough to be eaten rather than at the same instant.
      const dx = (shape.x - head.x) * invRx;
      const dy = (shape.y - head.y) * invRy;
      const near = dx * dx + dy * dy <= 1;

      if (near && !shape.anticipating) {
        shape.anticipating = true;
        this.monster.anticipate();
        this.monster.lookAt(shape.x, shape.y);
      } else if (!near && shape.anticipating) {
        shape.anticipating = false;
      }
    }
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
      // Shake whichever the child is actually looking at: with the hint open the
      // prompt is off-screen, so shake the hint card instead — but shake the
      // PANEL, not the image inside it. The image's x is local to the panel, so
      // the canvas-space base used here would fling it sideways within it.
      this.shake(
        this.hintOpen && this.hintImage ? this.hintPanel : this.promptContainer,
        this.hintOpen
      );
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

  // `skipSpawn` exists for the mid-transition hand-off in playRoundTransition:
  // that path rebuilds the prompt while the slide-in is still running, so the
  // round must stay held back (phase 'transition') and the caller schedules the
  // first spawn once the animation actually finishes.
  startRound(roundIndex, { skipSpawn = false } = {}) {
    this.roundIndex = roundIndex;
    this.round = ROUND_SCRIPT[roundIndex];
    this.feedsThisRound = 0;
    this.phase = skipSpawn ? 'transition' : 'playing';

    // A finger can be mid-press across a round change, and a held button is
    // ignored outside 'playing'. Releasing here means the press the child was
    // still making doesn't resume as a walk the instant play restarts.
    this.pendingPoke = null;
    if (this.walkPad) {
      this.walkPad.left.release(null);
      this.walkPad.right.release(null);
    }

    // The hint texture is preloaded under a per-round key (see assets.js); the
    // round's `hintImage` URL in levels.js is only the source for that key.
    this.setPrompt(
      this.round.prompt,
      this.round,
      this.round.hintImage ? `hint-${roundIndex}` : null
    );
    this.popIn(this.promptContainer, 1);
    playVoice(this, this.round.voiceKey);

    if (!skipSpawn) this.scheduleSpawn(500);
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
        // The level banner is its own transition, so the slide would just fight
        // it for attention.
        this.showLevelBanner(`Level ${ROUND_SCRIPT[nextIndex].level}! 🎉`, () => {
          this.startRound(nextIndex);
        });
      } else {
        this.playRoundTransition(() => this.startRound(nextIndex));
      }
    });
  }

  // The beat between two rounds of the same level. The old prompt is pushed off
  // the right edge and the next one slides back in from the left, with a soft
  // white sweep crossing the canvas — so the hand-off reads as a change of
  // question rather than the same bubble silently swapping its words.
  playRoundTransition(onSwap) {
    const { width, height } = this.scale;

    // Alpha kept low: a full-screen wipe at high opacity reads as a flash to a
    // 5-year-old, this is meant to be a soft hand-off.
    const sweep = this.add
      .rectangle(-width / 2, height / 2, width, height, 0xffffff, 0.55)
      .setDepth(58);
    this.tweens.add({
      targets: sweep,
      x: width * 1.5,
      duration: 560,
      ease: 'Sine.easeInOut',
      onComplete: () => sweep.destroy(),
    });

    // Off the right edge, i.e. its left edge past the canvas.
    const outX = width + this.promptW;
    this.tweens.add({
      targets: this.promptContainer,
      x: outX,
      alpha: 0,
      duration: 240,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Rebuild the bubble for the new round (this sets x back to its centred
        // resting place), then re-park it off the LEFT edge and slide it in.
        // The round is started with skipSpawn so it stays in 'transition' —
        // otherwise the spawner would begin dropping shapes while the prompt is
        // still sliding in, which is exactly the overlap this is meant to avoid.
        onSwap();
        // startRound also runs popIn(), which would scale the bubble up at the
        // same time as this slide — cancel it so the slide is the only motion.
        this.tweens.killTweensOf(this.promptContainer);
        this.promptContainer.setScale(1);
        this.promptContainer.setAlpha(0);
        this.promptContainer.setX(-this.promptW - PROMPT_MARGIN_X);
        this.tweens.add({
          targets: this.promptContainer,
          x: this.promptBaseX,
          alpha: 1,
          duration: 320,
          ease: 'Back.easeOut',
          onComplete: () => {
            // The transition is over: flip to 'playing' and let the round begin.
            // Nothing could spawn before this point, so the slide is guaranteed
            // to finish before the first shape.
            this.phase = 'playing';
            this.scheduleSpawn(450);
          },
        });
      },
    });
  }

  // Automatic, no player input — matches the brief's "no level-select screen".
  //
  // The 'level-2' artwork flies up from below the canvas and decelerates into a
  // stop dead centre: the rise uses a power ease-out so the motion is fastest at
  // the bottom and eases in over the last stretch, which is what reads as the
  // card "arriving" rather than sliding past. `onDone` fires only after the hold
  // AND the fade have finished, so the next round cannot overlap the transition.
  showLevelBanner(text, onDone) {
    const { width, height } = this.scale;
    const centreY = height / 2;

    // Same artwork for both level changes; the passed `text` is kept as a
    // fallback for any future level that has no art.
    const hasArt = this.textures.exists('level-2');
    const c = this.add.container(width / 2, centreY).setDepth(60);

    // Assigned in both branches below — declared uninitialised so there's no
    // dead `= 0` write.
    let cardH;
    if (hasArt) {
      const art = this.add.image(0, 0, 'level-2').setOrigin(0.5);
      // Fit within the canvas with margin, same rule the start card uses.
      const margin = 40;
      const fit = Math.min(
        (width - margin * 2) / art.width,
        (height - margin * 2) / art.height,
        1
      );
      art.setScale(fit);
      cardH = art.displayHeight;
      c.add(art);
    } else {
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
      cardH = 162;
    }

    // Start fully below the canvas — bottom edge at or past the viewport bottom.
    const startY = centreY + cardH / 2 + height / 2;
    c.setY(startY);

    this.tweens.add({
      targets: c,
      y: centreY,
      duration: 900,
      // Power2 out: quick off the mark at the bottom, long glide to a stop at the
      // middle. (Sine is gentler at both ends and reads as a drift, not an
      // arrival.)
      ease: 'Power2.easeOut',
      onComplete: () => {
        // Hold, then fade and hand off. Chained rather than a single delayedCall
        // so the round can never start while the card is still on screen.
        this.tweens.add({
          targets: c,
          alpha: 0,
          delay: 700,
          duration: 280,
          ease: 'Sine.easeIn',
          onComplete: () => {
            c.destroy();
            onDone();
          },
        });
      },
    });
  }

  // -----------------------------------------------------------------------
  // Per-frame bookkeeping
  // -----------------------------------------------------------------------

  update(time, delta) {
    // Cached once per frame rather than read per shape — update() already
    // touches this.scale several times and each read is a property hop.
    const height = this.scale.height;
    const maxX = this.scale.width - this.clampHalfW;

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
        // Lower on screen = closer to the ground = bigger, darker shadow. The
        // ramp denominator is cached (see create) instead of recomputed per
        // shape per frame.
        let t = (sprite.y - 200) / this.shadowRampRange;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const shadowScale = 0.55 + t * 0.75;
        sprite.shadow.x = sprite.x;
        sprite.shadow.setScale(shadowScale, shadowScale);
        sprite.shadow.setAlpha(0.08 + t * 0.18);
      }

      // A world-bounds bounce only reverses on the next physics step, by which
      // point the sprite can be a few pixels outside the canvas — clamp it back
      // so it never actually leaves the visible area.
      //
      // Every shape is normalised to the same on-screen size by foodScales, so
      // the half-extents are the same for all of them and are cached in create()
      // rather than read off each sprite (displayWidth/Height) every frame.
      if (sprite.body) {
        const halfW = this.clampHalfW;
        const halfH = this.clampHalfH;
        if (sprite.x < halfW) sprite.x = halfW;
        else if (sprite.x > maxX) sprite.x = maxX;
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

  // Shakes the prompt (or the hint card when it is open) on a wrong feed.
  //
  // Restores to a fixed resting x rather than to whatever x the target had when
  // this was called, and kills any shake already running first. Reading the live
  // x is a trap: a second wrong feed landing mid-shake captures the DISPLACED
  // position and then restores to that, nudging it sideways a little further on
  // every mistake until it drifts off. Shaking the container (not a child) is
  // what keeps the base in canvas space — a child's x is local to its parent.
  shake(target, isHint = false) {
    // The hint panel is positioned by its centre (so `base` is its centre x); the
    // prompt container by its left edge. The nudge is small either way so it
    // reads as a reaction rather than the element wandering.
    const base = isHint ? this.hintTargetX : this.promptBaseX;

    this.tweens.killTweensOf(target);
    target.setX(base);

    this.tweens.add({
      targets: target,
      x: base + 8,
      duration: 55,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => target.setX(base),
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
