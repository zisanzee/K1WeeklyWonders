// GameScene.js
// Game 16 — THE HUB. One Phaser scene that runs four mini-games in sequence.
//
// WHAT THIS FILE OWNS
// ---------------------------------------------------------------------------
//   • the run position (scene 0..4 × round 0..2 = 15 rounds) via progress.js
//   • the SHARED HUD: scene title, prompt line, mute button
//   • mounting/unmounting one scene MODULE at a time (../scenes/*), with a fade
//     handover, so a run keeps one create(), one music instance and one mute
//   • the dev plumbing: the tuning panel's scene/round nav, live relayout, and
//     keyboard shortcuts for the same actions
//
// WHAT IT DELIBERATELY DOES NOT OWN
// ---------------------------------------------------------------------------
// Any mechanic. Each scene draws into `this.layer` and reports completion through
// ctx.roundComplete(). The hub never inspects a scene's internals, which is what
// lets five unrelated mechanics share one run.
//
// EVERY adjustable number lives in tuning.js; the cycling logic lives in
// progress.js (pure, unit tested). This file is assembly only.
import BaseScene from '@/phaser/BaseScene';
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
import { textFor } from '@/games/game-16/prompts';
import {
  createVoiceButton,
  destroyVoiceButton,
  playPromptVoice,
  setVoiceButtonHandler,
  stopPromptVoice,
} from '@/games/game-16/voice';
import { getStartScreen } from '@/games/game-16/tuning';
import {
  BACKGROUND_COLOR,
  DEV_TUNING_ENABLED,
  TUNING,
  getEndScreen,
  getEngine,
  getHud,
  getSceneTuning,
  getVoice,
} from '@/games/game-16/tuning';
import { SCENES, sceneAt } from '@/games/game-16/scenes';
import {
  TOTAL_ROUNDS,
  advance,
  describe as describePosition,
  jumpRound,
  jumpScene,
  navLabel,
  startRun,
} from '@/games/game-16/progress';
import { burstConfetti, destroyConfetti, runWipe } from '@/games/game-16/effects';

// Re-exported so `import GameScene, { BACKGROUND_COLOR }` works in Game.jsx.
export { BACKGROUND_COLOR };

// Depth of the start poster.
//
// It has to sit ABOVE the things it replaces: the scene layer (10), the HUD band
// (19), the shared prompt (20) and the "say it again" button (26) — none of which
// belong on a title screen.
//
// It must sit BELOW the mute button (40), though. Covering that would leave a
// child unable to silence the game until they had already started it, which
// defeats the point of a mute control. Everything else above 35 is the end panel
// and the dev hint (60), both of which are later than this screen anyway.
const START_DEPTH = 35;

// The four scene modules, in registry order. Keys must match scenes.js ids —
// asserted at module scope below so a rename can't silently break the mount.
import ShapesScene from '@/games/game-16/scenes/ShapesScene';
import MirrorScene from '@/games/game-16/scenes/MirrorScene';
import PositionsScene from '@/games/game-16/scenes/PositionsScene';
import BuildingScene from '@/games/game-16/scenes/BuildingScene';

// FOUR scenes. "Positions" and "Left - Right" were the same mechanic, so they are
// one scene with four portraits (see scenes.js), and the ordinal placeholder is
// replaced by the real building.
const MODULES = {
  shapes: ShapesScene,
  mirror: MirrorScene,
  positions: PositionsScene,
  building: BuildingScene,
};

// Fail loudly at import time rather than half-running: a scene in the registry
// with no module would mount `undefined` and die on the first createRound().
for (const scene of SCENES) {
  if (!MODULES[scene.id]) {
    throw new Error(`game-16: no module registered for scene "${scene.id}"`);
  }
}

const MUTE = { x: 24, y: 20, anchor: 'topLeft', depth: 40 };

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
    this.resetRun();
  }

  // Per-RUN state. Called from the constructor AND at the top of create(),
  // because scene.restart() re-runs create() on the SAME instance.
  resetRun() {
    this.position = startRun();
    this.active = null; // the mounted scene module instance
    this.layer = null; // container the active scene draws into
    this.promptText = null;
    this.titleText = null;
    this.hudBg = null;
    // RUN-LEVEL scene state that must survive a round remount: the belt's travel
    // position, a scene's generated round plan, anything a scene needs to carry
    // across the destroy/recreate cycle that happens at every round change.
    //
    // Deliberately NOT on scene instances: a new instance is created per round,
    // so anything parked there is silently reset — which is exactly what made the
    // conveyor snap back to its starting pattern on every round change.
    this.sceneState = {};
    this.devHint = null; // dev-only position/shortcut readout
    this.startTime = 0; // run clock, for elapsedSeconds

    this.bgMusic = null;
    // Guard flags so a fade cannot double-advance if a scene reports completion
    // twice (a mechanic bug we should not let corrupt the run).
    this.handingOver = false;

    // WRONG-ANSWER TALLY for the whole run (all five scenes). Incremented from
    // every scene's `{ correct: false }` report or its `mistakes` count, so it is
    // complete whatever each mechanic turns out to be.
    this.mistakes = 0;
    this.mistakeLog = [];

    // The end panel: an array of the objects it owns. It lives ON THE SCENE rather
    // than in `layer`, because it has to sit above the confetti — and that means
    // the layer teardown will not reach it, so it is cleared explicitly.
    this.endScreen = null;

    // True while the scene-change wipe is running, so `update()` can skip the
    // mounted scene's per-frame work for the ~0.5s the screen is covered. The
    // scene still exists during the wipe; it is just not visible.
    this.wiping = false;

    // THE START SCREEN. `started` is the guard that makes `beginRun` idempotent —
    // a tap fires pointerdown (the scene-wide listener) and pointerup (the
    // button), and without it the run would start twice.
    //
    // `startPulse` is held separately because that tween targets a CHILD of the
    // poster container; `killTweensOf(container)` does not reach it, and a
    // repeating tween on a destroyed object ticks forever.
    this.startScreen = null;
    this.startPulse = null;
    this.started = false;

    // The ctx handed to `update()`, built once per mount. See `ctxForActive`.
    this.ctxCache = null;

    // A voice line requested while the wipe was covering the screen. Played by
    // `flushPendingVoice` once the transition has fully cleared.
    this.pendingVoice = null;

    // What the CURRENT round's prompt depends on beyond the round number —
    // scene 3's slot ('A'/'B'), scene 4's floor. `prompts.js` is keyed by identity,
    // so the voice lookup needs this; it is cleared on every mount and set by a
    // scene that needs it through `ctx.setVoiceContext`.
    this.voiceExtra = null;
  }

  create() {
    this.resetRun();
    // Run clock, read back into elapsedSeconds when the run completes.
    this.startTime = this.time.now;
    this.input.once('pointerdown', () => ensureBgMusic(this));

    // Tear the mounted scene down if the hub shuts down mid-run (a restart, or
    // the player leaving), so its objects never outlive it.
    this.events.once('shutdown', () => this.shutdown());

    this.buildBackdrop();
    this.buildHud();

    this.bgMusic = ensureBgMusic(this);
    addMuteButton(this, MUTE.x, MUTE.y, { anchor: MUTE.anchor, depth: MUTE.depth });

    // THE "SAY IT AGAIN" BUTTON, top right.
    //
    // Created BEFORE the first scene mounts, so a child who cannot read can replay
    // the question from the very first round. The handler is pointed at whatever
    // round is current, so the button never goes stale.
    const voice = getVoice();
    createVoiceButton(this, this.scale.width - voice.buttonInsetX, voice.buttonInsetY);
    // The BUTTON replays with fallback: on a round with no recording of its own
    // (scene 2 rounds 2-3) it still speaks the instruction the child is following.
    setVoiceButtonHandler(() => this.replayPromptVoice());

    // THE START SCREEN, then the first scene.
    //
    // The game does NOT begin here: `showStartScreen` paints the title poster and
    // calls `beginRun` from its Start button. Mounting straight away would start
    // scene 1's reel rolling while the poster was still on screen.
    this.showStartScreen();

    this.setupDevTools();
  }

  // ---------------------------------------------------------------------------
  // START SCREEN
  // ---------------------------------------------------------------------------
  /**
   * The title poster: one full-bleed image and a Start button under it.
   *
   * Everything is parented to ONE container at START_DEPTH, so `beginRun` can
   * tear the whole screen down with a single destroy and nothing can be left
   * behind over the first scene.
   */
  showStartScreen() {
    const s = getStartScreen();
    const { width: W, height: H } = this.scale;

    const container = this.add.container(0, 0).setDepth(START_DEPTH);
    this.startScreen = container;

    // THE POSTER, drawn COVER-style: scaled to FILL the canvas and centred, so it
    // never distorts on a different aspect ratio. The source is 2:3 like the base
    // resolution, so on the reference device it fits exactly.
    if (this.textures.exists('startBackground')) {
      const bg = this.add.image(W / 2, H / 2, 'startBackground').setOrigin(0.5);
      const scale = Math.max(W / (bg.width || 1), H / (bg.height || 1));
      bg.setScale(scale);
      container.add(bg);
    } else {
      // A missing poster must not leave a blank blue screen: a flat wash in the
      // scene's own backdrop colour still gives the button something to sit on.
      container.add(this.add.rectangle(W / 2, H / 2, W, H, BACKGROUND_COLOR, 1));
    }

    // START, low on the poster where the art has an empty band.
    const btn = this.createPillButton(W / 2, H * s.buttonYFrac, s.buttonLabel, {
      fontSize: `${s.buttonFontSize}px`,
      paddingX: s.buttonPaddingX,
      paddingY: s.buttonPaddingY,
      bgColor: s.buttonBgColor,
      textColor: s.buttonTextColor,
      depth: s.buttonDepth,
      circle: false,
    });
    container.add(btn.container);

    // A slow breathing scale, so the screen is not dead before the first tap.
    // ONE tween on ONE object — cheap enough to keep on a low-end tablet.
    //
    // ⚠ THE TWEEN IS KEPT ON THE SCENE, AND THAT IS NOT OPTIONAL.
    //
    // It targets `btn.container`, which is a CHILD of the poster container — and
    // Phaser only tears tweens down when the SCENE is destroyed, not when a Game
    // Object is. A repeating tween whose target has been destroyed therefore keeps
    // ticking forever, writing to a dead object on every frame, and `scene.restart()`
    // reuses the same TweenManager so they ACCUMULATE across replays. That is a
    // per-frame cost that grows every time the child replays the game.
    //
    // Both teardown paths (`beginRun`, `shutdown`) release it explicitly for that
    // reason — killing tweens of the poster container alone does not reach it.
    if ((s.buttonPulse ?? 1) !== 1) {
      this.startPulse = this.tweens.add({
        targets: btn.container,
        scale: s.buttonPulse,
        duration: Math.max(120, s.buttonPulseMs ?? 900),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // THE BUTTON IS THE ONLY THING THAT STARTS THE GAME.
    //
    // It used to also listen for a scene-wide tap, so a child could start by
    // pressing anywhere on the poster. That was a mistake: it made the Start
    // button feel like it did nothing, because the game had already begun on the
    // way down and the button only ever saw the gesture end. One deliberate
    // control is clearer than an invisible one.
    //
    // Nothing else on this screen is interactive, so a stray tap simply does
    // nothing — which is the correct, forgiving behaviour for a title screen.
    btn.on('pointerup', () => this.beginRun(container));

    // A SHORT fade, starting from ALPHA 1 — not from 0.
    //
    // Starting at 0 meant the dark backdrop showed through for the whole fade, so
    // the first thing a child saw on every load was a navy flash before the
    // poster appeared. That reads as "broken", not as a transition. The preload
    // screen has already covered the download, so there is nothing to hide: the
    // poster comes up at full opacity and only breathes very slightly.
    container.setAlpha(1);
    const fadeMs = Math.max(0, s.fadeMs ?? 260);
    if (fadeMs > 0) {
      // From a barely-there dip rather than from nothing: the eye reads this as
      // the poster settling, and no dark frame is ever exposed.
      container.setAlpha(0.92);
      this.tweens.add({
        targets: container,
        alpha: 1,
        duration: fadeMs,
        ease: 'Sine.easeOut',
      });
    }
  }

  /**
   * Leave the start screen and play scene 1.
   *
   * Guarded, because the button's `pointerup` and the scene's `pointerdown` can
   * BOTH fire for one tap — pointerdown precedes pointerup, so without the guard
   * the run would start twice and scene 1 would mount on top of itself.
   */
  beginRun(startScreen) {
    if (this.started) return;
    this.started = true;

    // NOTE: the scene-wide listener registered by `showStartScreen` is a `once`,
    // so it disposes of itself. An earlier version tried to remove it here with
    // `this.input.off('pointerdown', () => {}, this)` — which removes nothing,
    // because a fresh arrow function is a different reference. The `started`
    // guard above is what actually makes this re-entry-proof.

    // Tear the poster down BEFORE the first mount, so its art cannot sit over
    // scene 1's layer.
    //
    // BOTH tweens are released: the fade targets the container, and the pulse
    // targets the BUTTON INSIDE it — `killTweensOf(container)` does not reach a
    // child, so leaving the pulse running would tick against a destroyed object
    // for the rest of the run.
    // The run clock starts NOW, not at create() — the time a child spends reading
    // the poster is not time spent playing.
    this.startTime = this.time.now;

    // THE SAME TRANSITION AS EVERY OTHER HANDOVER.
    //
    // The poster stays ON SCREEN underneath the wipe and is destroyed at the
    // covered moment, so scene 1's card sweeps in over the title art instead of
    // the title art vanishing first and leaving a bare backdrop for a frame.
    // That ordering is why the teardown moved into `onCovered` rather than
    // happening here.
    const engine = getEngine();
    this.wiping = true;

    runWipe(this, {
      colour: engine.wipeColor,
      alpha: engine.wipeAlpha ?? 1,
      sceneId: sceneAt(this.position.scene).id,
      title: engine.wipeTitle ? sceneAt(this.position.scene).title : null,
      onCovered: () => {
        // Covered: now the poster can go, and scene 1 can be built under the panel.
        this.startPulse?.remove?.();
        this.startPulse = null;
        this.tweens.killTweensOf(startScreen);
        startScreen?.destroy?.(true);
        this.startScreen = null;

        this.mountCurrentScene({ fade: false });
      },
    }).then(() => {
      this.wiping = false;
      this.flushPendingVoice();
    });
  }

  // ---------------------------------------------------------------------------
  // BACKDROP
  // ---------------------------------------------------------------------------
  // A flat field + a soft vignette rather than a baked sky: the five scenes bring
  // their own art, and a busy shared backdrop behind five different pictures is
  // the thing that makes a multi-scene game look assembled rather than designed.
  buildBackdrop() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b1220).setDepth(-20);

    // Vignette: four translucent edges, cheaper than a baked gradient texture and
    // resolution-independent.
    const g = this.add.graphics().setDepth(-19);
    g.fillStyle(0x000000, 0.18);
    g.fillRect(0, 0, width, height * 0.08);
    g.fillRect(0, height * 0.92, width, height * 0.08);
  }

  // ---------------------------------------------------------------------------
  // SHARED HUD
  // ---------------------------------------------------------------------------
  // Drawn ONCE and only repositioned, because these elements persist across all
  // 15 rounds. Rebuilding them on every round change is what makes a prompt
  // flicker at every transition.
  buildHud() {
    const hud = getHud();
    const { width } = this.scale;

    // THE SCENE TITLE IS GONE FROM THE TOP-LEFT.
    //
    // It used to read "2 / 4 · Mirror", sitting exactly where the mute button is
    // in the top-left corner — so the two overlapped and neither was readable.
    // Nothing is lost by removing it: the transition card already announces each
    // mini-game by name and picture on the way in, and the run's progress is
    // shown on the end screen.
    //
    // `titleText` stays declared (as null) because `applyPromptPosition` and the
    // dev chrome still reference it defensively.

    this.promptText = this.add
      .text(this.scale.width / 2, this.scale.height * hud.promptYFrac, '', {
        fontSize: `${hud.promptFontSize}px`,
        fontFamily: 'Fredoka, sans-serif',
        color: hud.promptColor,
        fontStyle: 'bold',
        align: 'center',
        // WHITE TYPE WITH A THIN DARK OUTLINE. The prompt sits over each scene's
        // own full-bleed art, so a flat colour is legible on some of the five and
        // invisible on others; the stroke works on all of them.
        stroke: hud.promptStrokeColor,
        strokeThickness: hud.promptStrokeThickness,
        // Wrapped to a fraction of the canvas so a long prompt cannot run off a
        // narrow phone.
        wordWrap: { width: width * hud.promptWrapFrac },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.refreshHud();
  }

  // Pushes the current position onto the HUD. Cheap; called on every mount.
  //
  // Now a no-op for the title: the "2 / 4 · Mirror" chip was removed because it
  // occupied the same top-left corner as the mute button. The method is kept
  // because callers rely on it as the "the position changed" hook, and because a
  // future HUD element would go here.
  refreshHud() {
    if (!this.titleText) return;
    const scene = sceneAt(this.position.scene);
    this.titleText.setText(`${scene.number} / ${SCENES.length} · ${scene.title}`);
  }

  /**
   * Play the voice line for whatever this round is currently asking.
   *
   * Called from two places only: when a prompt is SET (rule 1), and when the
   * replay button is pressed (rule 3). The `extra` argument carries what the
   * scene's prompt depends on beyond the round number — scene 3's slot, scene 4's
   * floor — because `prompts.js` is keyed by identity, not by sentence.
   */
  playPromptVoice(extra = this.voiceExtra ?? {}, opts = {}) {
    // ---- WAIT FOR THE TRANSITION ----
    //
    // A scene sets its prompt while it mounts, which during a scene change is
    // UNDER the wipe. Speaking then means the child hears the question while
    // staring at a title card, and the first words have already gone by the time
    // the scene appears.
    //
    // So while a wipe is running the line is DEFERRED, not dropped: the request is
    // parked and played when the wipe reports it has fully cleared. A later request
    // replaces an earlier one, so a scene that sets its prompt twice still speaks
    // once.
    if (this.wiping) {
      this.pendingVoice = { extra, opts };
      return false;
    }

    const scene = sceneAt(this.position.scene);
    // The tables are 1-based, as a human reads them; the hub counts from 0. This
    // is the ONLY place that conversion happens.
    return playPromptVoice(this, scene.id, this.position.round + 1, extra, opts);
  }

  /**
   * Play a line that was deferred while the wipe covered the screen.
   *
   * Called when the wipe resolves. Safe when nothing was queued, so the caller does
   * not have to know whether a scene actually asked for a voice.
   */
  flushPendingVoice() {
    const pending = this.pendingVoice;
    this.pendingVoice = null;
    if (!pending) return;

    const scene = sceneAt(this.position.scene);
    playPromptVoice(this, scene.id, this.position.round + 1, pending.extra, pending.opts);
  }

  /** The "say it again" tap: replay the current round's line, falling back. */
  replayPromptVoice() {
    return this.playPromptVoice(this.voiceExtra ?? {}, { allowFallback: true });
  }

  /** Stop the current line — called the instant a round completes. */
  stopPromptVoice() {
    stopPromptVoice();
  }

  /**
   * The scene modules call this through ctx to change the prompt.
   *
   * Setting a prompt also STARTS its voice line (rule 1). Clearing it (an empty
   * string, which scenes use deliberately between beats) stops any line rather
   * than leaving one talking over a moment with no question on screen.
   */
  setPrompt(text) {
    if (this.promptText) this.promptText.setText(text || '');

    if (!text) {
      this.stopPromptVoice();
      return;
    }

    // SCENE 1 IS TRIGGERED BY ITS CLUE, NOT BY ITS TEXT.
    //
    // Its on-screen sentence is the same generic instruction every round, and only
    // the AUDIO varies (each clue's clip says the whole sentence). So there is no
    // text to match on — the scene having declared a clue IS the trigger.
    const scene = sceneAt(this.position.scene);
    const extra = this.voiceExtra ?? {};

    if (scene.id === 'shapes') {
      if (extra.clue) this.playPromptVoice(extra);
      return;
    }

    // Every other scene: play when the text matches what this round's row says. A
    // scene that sets an incidental string ("Swipe to visit the floors") should not
    // trigger a prompt recording — and a scene with no voice row plays nothing.
    const expected = textFor(scene.id, this.position.round + 1, extra);
    if (!expected || text !== expected) return;

    this.playPromptVoice();
  }

/**
 * The full-width band behind the prompt, for scenes that do not have clear space
 * at the top.
 *
 * Drawn at depth 19 — BELOW the prompt text (20) but ABOVE every scene's layer
 * (10) — so it is a header bar over the art rather than something the art can
 * cover.
 *
 * It is DESTROYED rather than hidden when a scene has no band, because a stray
 * full-width rectangle left on screen by the previous scene would read as a bug.
 */
applyPromptBand(block = {}, W) {
  const height = Number.isFinite(block.promptBandHeight) ? block.promptBandHeight : 0;

  // No band for this scene: remove any the last one left behind.
  if (height <= 0) {
    this.promptBand?.destroy();
    this.promptBand = null;
    return;
  }

  if (!this.promptBand?.active) {
    this.promptBand = this.add.graphics().setDepth(19);
  }

  const g = this.promptBand;
  g.clear();

  // Pinned to the very top: a header bar, so `height` is the only position it
  // needs and it cannot be dragged off screen by a y slider meant for the text.
  g.fillStyle(block.promptBandColor ?? 0xd2b48c, block.promptBandAlpha ?? 0.92);
  g.fillRect(0, 0, W, height);

  // A hairline along the bottom edge, so it reads as a bar with a defined end.
  if (block.promptBandEdgeWidth > 0) {
    g.fillStyle(block.promptBandEdgeColor ?? 0xfbbf24, 1);
    g.fillRect(0, height - block.promptBandEdgeWidth, W, block.promptBandEdgeWidth);
  }
}

/**
 * Move the prompt to the CURRENT scene's preferred y.
 *
 * The prompt is shared HUD — drawn once, outside any scene's layer — so its
 * position cannot live in a scene module. Instead each scene's tuning block
 * carries a `promptYFrac`, and this applies it on every mount: scene 3 wants its
 * sentence at the bottom under the portrait, the others keep the top.
 *
 * A NEGATIVE value means "no opinion" and falls back to the shared HUD y, so a
 * scene that does not care needs no override and cannot accidentally pin the
 * prompt to the top of the canvas.
 */
applyPromptPosition() {
  if (!this.promptText) return;

  const hud = getHud();
  const scene = sceneAt(this.position.scene);
  const block = getSceneTuning(scene.id) || {};
  const W = this.scale.width;
  const H = this.scale.height;

  // -1 on any of these means "use the shared HUD value", so a scene that does
  // not care needs no override at all.
  const pick = (perScene, fallback) =>
    Number.isFinite(perScene) && perScene >= 0 ? perScene : fallback;

  const yFrac = pick(block.promptYFrac, hud.promptYFrac);
  const wrapFrac = pick(block.promptWrapFrac, hud.promptWrapFrac);
  const xFrac = block.promptXFrac;
  const align = typeof block.promptAlign === 'string' ? block.promptAlign : null;

  this.promptText.setY(H * yFrac);

  // THE PROMPT BAND, drawn BEFORE the text is placed so it never covers it.
  this.applyPromptBand(block, W);

  // PROMPT AND TITLE COLOURS, re-applied on EVERY mount from the shared HUD and
  // then overridden by the scene.
  //
  // It has to be unconditional: a scene that banded its prompt to dark-on-tan
  // would otherwise leave that styling on the NEXT scene, whose prompt sits
  // directly on art and needs white-with-an-outline.
  const strokeThickness =
    Number.isFinite(block.promptStrokeThickness) && block.promptStrokeThickness >= 0
      ? block.promptStrokeThickness
      : hud.promptStrokeThickness;

  this.promptText.setColor(block.promptColor || hud.promptColor);
  this.promptText.setStroke(
    block.promptStrokeColor || hud.promptStrokeColor,
    strokeThickness
  );

  if (this.titleText) {
    this.titleText.setColor(block.promptTitleColor || hud.titleColor);
  }

  // ANCHOR AND ALIGNMENT HAVE TO AGREE, or the block drifts.
  //
  //  · no promptXFrac → centred on the canvas midline (origin 0.5).
  //  · promptXFrac + align 'left' → origin 0 at that x, so the text grows
  //    rightward from the column's left edge.
  //  · promptXFrac + align 'center' → origin 0.5 at the column's MIDPOINT, so
  //    centred lines sit centred in the column. Anchoring at 0 here would centre
  //    each line on the column's left edge and push the text under the disc.
  const anchored = Number.isFinite(xFrac) && xFrac >= 0;

  if (!anchored) {
    this.promptText.setOrigin(0.5).setX(W / 2);
  } else if (align === 'center') {
    this.promptText.setOrigin(0.5).setX(W * xFrac + (W * wrapFrac) / 2);
  } else {
    this.promptText.setOrigin(0, 0.5).setX(W * xFrac);
  }

  if (align) this.promptText.setAlign(align);
  // `setWordWrapWidth` re-flows the existing text immediately, which is what
  // makes dragging the wrap slider visible without a remount.
  this.promptText.setWordWrapWidth(W * wrapFrac);
}

  // ---------------------------------------------------------------------------
  // MOUNTING
  // ---------------------------------------------------------------------------
  mountCurrentScene({ fade = true } = {}) {
    const scene = sceneAt(this.position.scene);
    const Module = MODULES[scene.id];

    // Clear the previous scene FIRST, so its objects cannot outlive it.
    if (this.active) {
      this.active.destroy();
      this.active = null;
    }
    if (this.layer) {
      this.layer.removeAll(true);
      this.layer.destroy();
      this.layer = null;
    }

    // A fresh container per mount. removeAll(true) above is the belt to this
    // braces: even a scene that leaked a reference cannot draw into a dead layer.
    this.layer = this.add.container(0, 0).setDepth(10);

    this.active = new Module();
    this.handingOver = false;

    // Reset BEFORE mount so we can tell whether the scene set its own prompt.
    this.promptSetByScene = false;

    // THE VOICE CONTEXT IS PER-ROUND, so a new mount starts without one; a scene
    // that needs it (scene 3's slot, scene 4's floor) sets it again through
    // `ctx.setVoiceContext` before it sets its prompt.
    //
    // The outgoing round's line is silenced FIRST — otherwise the previous
    // question would still be talking over the new one.
    this.voiceExtra = null;
    this.stopPromptVoice();

    // THE ONE ctx THIS MOUNT USES: the same object the scene is built with and the
    // same one `update()` is handed, so the two can never disagree about tuning.
    this.ctxCache = this.buildCtx(scene);
    const ctx = this.ctxCache;
    this.active.mount(ctx, this.position.round);

    this.refreshHud();
    this.applyPromptPosition();
    // The scene's `hint` is only a PLACEHOLDER for mechanics that have no prompt
    // of their own yet. A finished scene sets its own — or deliberately sets an
    // empty one while it is not ready to ask anything — and this must not
    // overwrite that. Without the guard, scene 1's roll-in would be covered by
    // the hint text before the options exist.
    if (!this.promptSetByScene) this.setPrompt(scene.hint);

    if (fade) {
      // Slide+fade the new layer in. The outgoing layer is already gone, so this
      // is a single in-animation rather than a true crossfade — cheaper, and it
      // reads as "next one" rather than "same one changing".
      const engine = getEngine();
      this.layer.setAlpha(0);
      this.tweens.add({
        targets: this.layer,
        alpha: 1,
        duration: Math.max(0, engine.transitionMs * engine.crossfade),
        ease: 'Sine.easeOut',
      });
    }
  }

  // The handle object a scene receives. Kept in ONE place so a change to the scene
  // contract cannot leave two shapes of ctx in circulation.
  buildCtx(scene) {
    return {
      scene: this,
      layer: this.layer,
      sceneTuning: getSceneTuning(scene.id),
      engine: getEngine(),
      registry: scene,

      // Run-level scratch space handed to the scene. Survives round remounts, so
      // a scene can carry its belt position (or its generated round plan) from
      // one round to the next. Cleared only when the whole run restarts.
      sceneState: this.sceneState,

      // Fraction placement, so a scene never hard-codes canvas pixels.
      fracX: (f) => this.scale.width * f,
      fracY: (f) => this.scale.height * f,

      // Any call from a scene wins over the placeholder hint (see
      // mountCurrentScene). `''` counts as a decision, not as "unset".
      setPrompt: (text) => {
        this.promptSetByScene = true;
        this.setPrompt(text);
      },

      // Silence the prompt line NOW.
      //
      // `handleRoundComplete` already stops it, but scenes 3 and 4 HOLD on the
      // finished picture for a beat before they report — so without this the
      // question would still be being read out a second after the child answered
      // it, talking over the success chime. A scene calls this the moment the
      // answer lands.
      stopVoice: () => this.stopPromptVoice(),

      // What this round's prompt depends on BEYOND the round number — scene 3's
      // slot ('A'/'B'), scene 4's floor. A scene calls this BEFORE it sets its
      // prompt, so the voice lookup has the identity it needs. Scenes whose prompt
      // is purely per-round never call it.
      setVoiceContext: (extra) => {
        this.voiceExtra = extra ?? null;
      },

      // SCENE 1: declare the CLUE the reel landed on, so the voice can speak it
      // before the instruction. The prompt starts the line only once this is set,
      // which is what keeps the two halves in the right order.
      setClueContext: (clue) => {
        this.voiceExtra = { ...(this.voiceExtra ?? {}), clue };
      },

      // Speak this round's line.
      //
      // Scenes 3 and 4 draw their own prompt text, so the hub's `setPrompt` never
      // fires for them and they must ask for their voice explicitly. They go
      // THROUGH the hub rather than calling the voice module directly, so the
      // "wait until the transition has cleared" deferral applies to every scene
      // rather than only the two that share the hub's prompt.
      playVoice: (extra = {}) => this.playPromptVoice(extra),

      // A scene reports one round finished. The guard makes a double-report a
      // no-op instead of skipping a round.
      roundComplete: (payload = {}) => this.handleRoundComplete(payload),

      // Spoken line. No audio pipeline yet, so this is deliberately inert but
      // present, so a mechanic can be written against the real API.
      say: () => {},
    };
  }

  // ---------------------------------------------------------------------------
  // ROUND FLOW
  // ---------------------------------------------------------------------------
  handleRoundComplete(payload = {}) {
    if (this.handingOver) return;
    this.handingOver = true;

    // MISTAKES are a run-level tally. Every scene reports its failures the same
    // way (`{ correct: false }`), so the count works whatever the mechanics turn
    // out to be — and it is what the completion payload will send once all five
    // scenes exist.
    // RULE 2: the voice STOPS the instant a round completes. Mid-word is correct —
    // the child has answered, and a line still talking over the next transition is
    // noise. Done before the mistake accounting so it happens on every path.
    this.stopPromptVoice();

    if (!payload.correct) {
      this.mistakes = (this.mistakes || 0) + 1;
      this.mistakeLog = this.mistakeLog || [];
      this.mistakeLog.push({
        scene: this.position.scene,
        round: this.position.round,
      });
    }

    // A scene can also report mistakes it absorbed ITSELF, for a wrong answer
    // that did not end the round (scene 2 keeps the parts already placed, so it
    // cannot ask for a retry). Without this branch those misses are silently
    // lost and the run's total under-reports. Counted separately from the
    // `correct: false` case so a scene doing both cannot be double-counted.
    if (Number.isFinite(payload.mistakes) && payload.mistakes > 0) {
      this.mistakes = (this.mistakes || 0) + payload.mistakes;
      this.mistakeLog = this.mistakeLog || [];
      for (let i = 0; i < payload.mistakes; i += 1) {
        this.mistakeLog.push({
          scene: this.position.scene,
          round: this.position.round,
        });
      }
    }

    // RETRY: the same round is mounted again. Nothing advances, so the scene
    // title and the round counter stay put — a wrong answer must not skip a round.
    // The `handingOver` guard is released on the next tick, after the remount, so
    // a second report cannot slip in.
    if (payload.retry) {
      this.mountCurrentScene({ fade: false });
      this.time.delayedCall(0, () => {
        this.handingOver = false;
      });
      return;
    }

    const next = advance(this.position);

    if (next.done) {
      this.finishRun();
      return;
    }

    // A scene change resets the prompt; a round change within a scene does not
    // need a fade, because the layer is rebuilt anyway.
    const sceneChanged = next.scene !== this.position.scene;

    // CELEBRATE FINISHING A MINI-GAME, not just the run. Reaching the end of a
    // scene is the achievement a child can perceive; the run's own finish is then
    // just the last of these. Fired BEFORE the change so the pieces are already
    // falling as the wipe sweeps over them.
    if (sceneChanged) burstConfetti(this, getEngine().sceneConfetti ?? 0);

    this.position = next;

    if (!sceneChanged) {
      this.mountCurrentScene({ fade: false });
      return;
    }

    // THE SCENE CHANGE, as a two-beat wipe: cover the screen, swap while it is
    // hidden, then sweep it away.
    //
    // The swap happens at the covered moment, so the outgoing scene's teardown and
    // the incoming scene's build are never visible — which is what made the old
    // bare fade read as a flash of empty backdrop between two pictures.
    //
    // All of that (including the `wiping` flag) lives in `runSceneWipe`, which the
    // start screen calls too, so there is one transition and not two that drift.
    this.runSceneWipe(sceneAt(next.scene));
  }

  /**
   * The one scene-change transition, shared by every handover.
   *
   * Extracted so the START into scene 1 transition is literally the same code as
   * every later one. It used to be inline in `handleRoundComplete`, which meant
   * the first scene arrived with a bare cut while scenes 2-4 got the card. That
   * inconsistency made the game look unfinished at the exact moment a child
   * first sees it.
   *
   * @param {object} incoming  the scene registry entry being entered
   */
  runSceneWipe(incoming) {
    const engine = getEngine();
    this.wiping = true;

    runWipe(this, {
      colour: engine.wipeColor,
      // SEMI-TRANSPARENT, so the outgoing frame stays faintly visible under the
      // panel and the handover reads as frosted glass rather than a slab.
      alpha: engine.wipeAlpha ?? 1,
      // Which scene's transition card to show. The scene ID (not its title) is
      // what `runWipe` maps to a texture, so renaming a scene cannot break it.
      sceneId: incoming.id,
      title: engine.wipeTitle ? incoming.title : null,
      onCovered: () => {
        this.mountCurrentScene({ fade: false });
        // The new scene mounted UNDER the panel, so it can set its prompt now —
        // but `playPromptVoice` still defers while `wiping` is true, which it is
        // until the sweep has fully cleared.
      },
    })
      // THE TRANSITION IS FULLY OVER: now the question may be spoken.
      //
      // `wiping` is released here rather than at `onCovered`, because the child is
      // still looking at a title card until the out-sweep finishes. Speaking at the
      // covered moment means the first words are already gone by the time the scene
      // appears.
      .then(() => {
        this.wiping = false;
        this.flushPendingVoice();
      });
  }

  finishRun() {
    this.position = { ...this.position, done: true };
    this.refreshHud();
    // Clearing the prompt stops the line as a side effect; called explicitly too,
    // so the run end cannot leave a question being read aloud behind the panel.
    this.setPrompt('');
    this.stopPromptVoice();

    // The finished run is REPORTED FIRST and the overlay second. The overlay is a
    // full-canvas scrim, so if it went up first and the event threw, the run would
    // look stuck behind a panel that never became dismissible.
    const payload = {
      stars: SCENES.length,
      // Derived, never hard-coded: scene 1 runs four rounds, so the run is 16.
      totalRounds: TOTAL_ROUNDS,
      peakStreak: 0,
      // Never hard-coded 0: the real tally, accumulated across every scene. A
      // constant here would be silently wrong the moment a scene reported one.
      mistakes: this.mistakes || 0,
      elapsedSeconds: Math.round((this.time.now - (this.startTime || 0)) / 1000),
    };
    this.game.events.emit('game16-complete', payload);

    // A beat of confetti over the finished game, THEN the panel arrives on top.
    // Drawing both at once makes the panel look like it interrupted the
    // celebration instead of concluding it.
    this.spawnFinishConfetti();

    this.time.delayedCall(Math.max(320, (getEndScreen().popMs ?? 380) * 0.7), () => {
      this.showEndScreen(payload);
    });
  }

  /**
   * The FINAL confetti burst.
   *
   * Uses the shared emitter (see effects.js) rather than a loop of tweened images:
   * one batched draw, a pooled particle set, no per-burst allocations. The count is
   * a tuning value, and the emitter's own `maxAliveParticles` caps the total no
   * matter how many bursts overlap.
   */
  spawnFinishConfetti() {
    burstConfetti(this, getEngine().finishConfetti ?? getEndScreen().confettiCount ?? 0);
  }

  /**
   * THE END SCREEN.
   *
   * A scrim, a panel with the run's result, one star per finished scene popping
   * in sequence, and a REPLAY button. The replay button is the reason this exists:
   * a child who has just finished wants to play again, and the alternative is
   * leaving the game and finding it in the catalogue.
   *
   * Everything is on its own depth band above every scene (which caps out around
   * 25) and above the confetti (50), and held in one array so `shutdown` can take
   * it all down if the player leaves mid-panel.
   */
  showEndScreen(payload = {}) {
    if (this.endScreen) return; // never stack two panels on a double report

    // THE PANEL IS BUILT DEFENSIVELY, because the failure mode here is uniquely
    // bad: the scrim and the panel are created first, and if anything after them
    // throws, the player is left staring at a dimmed screen they cannot tap out of.
    // With no replay button, that reads as "the game hung". Catching means a
    // problem in the decoration degrades to a plain panel rather than a dead end.
    try {
      this.buildEndScreen(payload);
    } catch {
      // Whatever was built is still tracked, so it can at least be dismissed.
      this.ensureEndScreenDismissible();
    }
  }

  buildEndScreen(payload = {}) {
    const end = getEndScreen();
    const { width: W, height: H } = this.scale;

    this.endScreen = [];
    const track = (obj) => {
      this.endScreen.push(obj);
      return obj;
    };

    // ---- the scrim: swallows input too, so nothing behind it can be tapped ----
    const scrim = track(
      this.add
        .rectangle(W / 2, H / 2, W, H, end.scrimColor, end.scrimAlpha)
        .setDepth(60)
        .setInteractive()
    );

    // ---- the panel ----
    const panelW = Math.min(W * end.panelWidthFrac, end.panelMaxWidth);
    const panelH = H * end.panelHeightFrac;

    const panel = track(this.add.container(W / 2, H / 2).setDepth(61));

    const bg = this.add.graphics();
    bg.fillStyle(end.panelColor, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, end.panelRadius);
    bg.lineStyle(end.panelBorderWidth, end.panelBorderColor, 1);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, end.panelRadius);
    panel.add(bg);

    // THE ENTRANCE PUNCH: the panel arrives scaled down, so it reads as a new
    // surface rather than a sudden change of the game behind it.
    panel.setScale(0.7).setAlpha(0);
    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: Math.max(1, end.popMs),
      ease: 'Back.easeOut',
    });

    // ---- the headline ----
    panel.add(
      this.add
        .text(0, panelH * end.titleYOffsetFrac, end.titleText, {
          fontSize: `${end.titleFontSize}px`,
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: end.titleColor,
        })
        .setOrigin(0.5)
    );

    // ---- ONE STAR PER FINISHED SCENE, popping in sequence ----
    const totalStars = Math.max(1, payload.stars || SCENES.length);
    const starY = panelH * end.starYOffsetFrac;
    const rowW = totalStars * end.starSize + (totalStars - 1) * end.starGapPx;

    for (let i = 0; i < totalStars; i += 1) {
      const x = -rowW / 2 + end.starSize / 2 + i * (end.starSize + end.starGapPx);

      const star = this.add
        .text(x, starY, '★', {
          fontSize: `${end.starSize}px`,
          fontFamily: 'Fredoka, sans-serif',
          color: end.starColor,
        })
        .setOrigin(0.5)
        .setScale(0);

      panel.add(star);

      // Staggered, so the run feels COUNTED. Each star also overshoots slightly,
      // which is what makes it land with weight.
      this.tweens.add({
        targets: star,
        scale: 1,
        duration: Math.max(1, end.starPopMs),
        delay: 160 + i * end.starStaggerMs,
        ease: 'Back.easeOut',
      });
    }

    // ---- the summary ----
    const mistakes = payload.mistakes || 0;
    const summary =
      mistakes === 0
        ? 'Perfect run — no mistakes!'
        : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} this run`;

    panel.add(
      this.add
        .text(0, panelH * end.summaryYOffsetFrac, summary, {
          fontSize: `${end.summaryFontSize}px`,
          fontFamily: 'Fredoka, sans-serif',
          fontStyle: 'bold',
          color: end.summaryColor,
        })
        .setOrigin(0.5)
    );

    // ---- REPLAY ----
    //
    // `createPillButton` returns a WRAPPER object (`{ container, setText, on, … }`),
    // not a display object — so the container has to be added to the panel, and the
    // handler is bound on the wrapper, which forwards to that container.
    //
    // Passing the wrapper to `panel.add()` threw inside Phaser, which is what left
    // the finished run hanging on a blank screen: the exception aborted
    // `showEndScreen` AFTER the scrim was created, so the game sat behind a
    // dimmed, untappable overlay with no button on it.
    const buttonY = panelH * end.buttonYOffsetFrac;
    const replay = this.createPillButton(0, buttonY, end.buttonLabel, {
      fontSize: `${end.buttonFontSize}px`,
      bgColor: end.buttonBgColor,
      textColor: end.buttonTextColor,
      paddingX: end.buttonPaddingX,
      paddingY: end.buttonPaddingY,
      depth: 62,
    });
    panel.add(replay.container);

    // Deferred by one tick: this handler runs INSIDE the button's own pointerup,
    // and destroying the panel (which owns the button) mid-event would tear down
    // the object whose handler is still on the stack. A 0ms call lands after the
    // event has finished unwinding.
    replay.on('pointerup', () => {
      this.time.delayedCall(0, () => this.restartRun());
    });

    // Keep the tracked list to the things that must be destroyed. The panel owns
    // its children, so destroying it takes the text and the button with it.
    this.endScreen = [scrim, panel];
  }

  /**
   * Play again.
   *
   * `scene.restart()` re-runs create() on the SAME scene instance, which is why
   * `resetRun()` is called at the top of create() — the run state, the mounted
   * scene and the mistake tally all have to be re-initialised there or the second
   * run would inherit the first one's position.
   */
  restartRun() {
    this.clearEndScreen();
    this.scene.restart();
  }

  /**
   * Last-resort escape hatch for the end panel.
   *
   * If `buildEndScreen` threw part-way, the scrim may be up with nothing usable on
   * it. Rather than leaving the run unrecoverable, a tap anywhere restarts — which
   * is what the missing button would have done. Kept separate so the happy path
   * never depends on it.
   */
  ensureEndScreenDismissible() {
    const scrim = this.endScreen?.[0];
    if (!scrim?.active) {
      // Nothing made it to the screen at all: still give the player a way out.
      this.restartRun();
      return;
    }
    scrim.removeAllListeners?.();
    scrim.on?.('pointerup', () => this.restartRun());
  }

  clearEndScreen() {
    if (!this.endScreen) return;
    // `endScreen` holds [scrim, panel]; the panel OWNS its children, so destroying
    // the panel takes the text, the stars and the button with it. The scrim is a
    // sibling, so it is destroyed separately.
    this.endScreen.forEach((obj) => obj?.destroy?.());
    this.endScreen = null;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------
  update(time, delta) {
    // Nothing to drive while covered by the wipe, or once the run is over. That is
    // the difference between "the transition costs nothing" and "the transition
    // runs a hidden scene's integrator for half a second".
    if (!this.active || this.position.done || this.wiping) return;
    this.active.update(this.ctxForActive(), time, delta);
  }

  /**
   * The ctx handed to a scene's `update()`.
   *
   * CACHED PER MOUNT, not rebuilt per frame.
   *
   * This used to call `buildCtx()` every frame, and `buildCtx` resolves
   * `getSceneTuning(id)` — which in dev deep-merges the ENTIRE `SCENES` table
   * (`{shapes:{…}, mirror:{…}, positions:{…}, building:{…}}`) to read four prompt
   * fields. That is a full object graph rebuilt 60 times a second, for the whole
   * run, whether or not anything moved. It was the single largest per-frame cost
   * in the game and it grew worse as scenes gained tuning.
   *
   * The ctx is rebuilt on mount and on `applyTuning` (see `ctxForActive(true)`), so
   * a slider still takes effect immediately — but a resting frame now costs one
   * property read.
   */
  ctxForActive(refresh = false) {
    if (!refresh && this.ctxCache) return this.ctxCache;
    const scene = sceneAt(this.position.scene);
    this.ctxCache = this.buildCtx(scene);
    return this.ctxCache;
  }

  // ---------------------------------------------------------------------------
  // DEV TOOLS
  // ---------------------------------------------------------------------------
  // Everything here is dev-only. The kit's createTuning() is already inert in a
  // production build, and this whole method is gated on import.meta.env.DEV.
  setupDevTools() {
    if (!import.meta.env.DEV || !DEV_TUNING_ENABLED) return;

    // Live relayout: dragging a slider re-applies values to the mounted scene
    // instead of rebuilding it, so tuning never resets the round in progress.
    TUNING.setRelayout(() => {
      // `true` forces a fresh ctx, so the slider's new value reaches the scene.
      if (this.active) this.active.applyTuning(this.ctxForActive(true));
      this.refreshHud();
      // The prompt's y is per-scene, so dragging that slider has to move it.
      this.applyPromptPosition();
    });

    // Panel nav: « » step scenes, ◀ ▶ step rounds. Both are DEV paths from
    // progress.js, so neither can end the run.
    TUNING.setNav({
      label: () => navLabel(this.position),
      // The 1-BASED round, as a reader. The panel's array groups (scene 2's
      // parts table) use it in their `scope` to show only the mounted round's
      // rows; without it they would always fall back to round 1. A function
      // rather than a value, because the panel renders on every change and the
      // position moves underneath it.
      round: () => this.position.round + 1,
      prevScene: () => this.devJump(jumpScene(this.position, -1)),
      nextScene: () => this.devJump(jumpScene(this.position, 1)),
      prev: () => this.devJump(jumpRound(this.position, -1)),
      next: () => this.devJump(jumpRound(this.position, 1)),
    });

    // The same two actions from the canvas, so you do not have to reach for the
    // panel while looking at the game. Same handlers, so they can't drift.
    this.input.keyboard?.on('keydown-BRACKETLEFT', () =>
      this.devJump(jumpScene(this.position, -1))
    );
    this.input.keyboard?.on('keydown-BRACKETRIGHT', () =>
      this.devJump(jumpScene(this.position, 1))
    );
    this.input.keyboard?.on('keydown-COMMA', () => this.devJump(jumpRound(this.position, -1)));
    this.input.keyboard?.on('keydown-PERIOD', () => this.devJump(jumpRound(this.position, 1)));

    // A tiny on-canvas hint, so the shortcuts are discoverable without the docs.
    // Stored on the instance because it carries the live position: created once,
    // then refreshed by refreshDevHint() after every jump, so it can never show a
    // stale scene while you are tuning.
    this.devHint = this.add
      .text(this.scale.width - 16, this.scale.height - 12, '', {
        fontSize: '12px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#94a3b8',
      })
      .setOrigin(1, 1)
      .setDepth(60);

    this.refreshDevHint();
  }

  // Keeps the dev hint's position readout current. A no-op outside dev (the text
  // object only exists when setupDevTools ran).
  refreshDevHint() {
    if (!this.devHint) return;
    this.devHint.setText(
      `${describePosition(this.position)}  ·  [ ] scene  , . round`
    );
  }

  // Jump to a dev position and remount. Always a scene-change path, because the
  // dev jumps reset the round or cross a boundary.
  devJump(nextPosition) {
    const sceneChanged = nextPosition.scene !== this.position.scene;
    this.position = { ...nextPosition, done: false };
    this.mountCurrentScene({ fade: sceneChanged });
    this.refreshDevHint();
  }

  // ---------------------------------------------------------------------------
  // SHUTDOWN
  // ---------------------------------------------------------------------------
  shutdown() {
    // Registered in create() via the scene's own event so a restart is clean.
    if (this.active) {
      this.active.destroy();
      this.active = null;
    }
    // The end panel is NOT in `layer`, so the scene teardown does not reach it.
    this.clearEndScreen();

    // Neither is the start poster: leaving the game from the title screen would
    // otherwise keep a full-canvas image and its pulsing button alive across a
    // restart, and the second run would paint scene 1 underneath a dead poster.
    //
    // The pulse is released BY HAND because it targets the button inside the
    // poster container, which `killTweensOf(container)` cannot reach.
    this.startPulse?.remove?.();
    this.startPulse = null;
    this.tweens.killTweensOf(this.startScreen);
    this.startScreen?.destroy?.(true);
    this.startScreen = null;
    this.started = false;

    // The confetti emitter is cached against THIS scene instance, and a restart
    // reuses that instance — so a stale, already-destroyed emitter would otherwise
    // be handed back on the second run and every burst would throw.
    destroyConfetti(this);

    // The voice module holds module-level state (the audible line, the button, its
    // glow tween). That must not outlive the game, or a restart reuses a destroyed
    // button and a dead sound handle.
    destroyVoiceButton();

    this.wiping = false;
  }
}
