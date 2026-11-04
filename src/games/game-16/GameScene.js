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
import {
  BACKGROUND_COLOR,
  DEV_TUNING_ENABLED,
  TUNING,
  getEndScreen,
  getEngine,
  getHud,
  getSceneTuning,
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

    this.mountCurrentScene({ fade: false });

    this.setupDevTools();
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

    this.titleText = this.add
      .text(hud.titleX, hud.titleY, '', {
        fontSize: `${hud.titleFontSize}px`,
        fontFamily: 'Fredoka, sans-serif',
        color: hud.titleColor,
        fontStyle: 'bold',
      })
      .setDepth(20);

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
  // The scene title carries the progress on its own ("2 / 4 · Mirror Bays"), so
  // there is no separate row of dots: the title says the same thing in words a
  // child can read out, and the dots were competing with the prompt for the top
  // of the screen in the scenes that paint a full-width header band.
  refreshHud() {
    const scene = sceneAt(this.position.scene);
    this.titleText.setText(`${scene.number} / ${SCENES.length} · ${scene.title}`);
  }

  // The scene modules call this through ctx to change the prompt.
setPrompt(text) {
  if (this.promptText) this.promptText.setText(text || '');
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
    const ctx = this.buildCtx(scene);
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

    const outgoing = sceneAt(this.position.scene);

    this.position = next;

    if (!sceneChanged) {
      this.mountCurrentScene({ fade: false });
      return;
    }

    // THE SCENE CHANGE, as a two-beat wipe: cover the screen in the OUTGOING
    // scene's accent, swap while it is hidden, then sweep it away.
    //
    // The swap happens at the covered moment, so the outgoing scene's teardown and
    // the incoming scene's build are never visible — which is what made the old
    // bare fade read as a flash of empty backdrop between two pictures.
    const engine = getEngine();
    this.wiping = true;

    runWipe(this, {
      colour: engine.wipeColor ?? outgoing.color,
      title: engine.wipeTitle ? sceneAt(next.scene).title : null,
      onCovered: () => {
        this.mountCurrentScene({ fade: false });
        this.wiping = false;
      },
    });
  }

  finishRun() {
    this.position = { ...this.position, done: true };
    this.refreshHud();
    this.setPrompt('');

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
    const buttonY = panelH * end.buttonYOffsetFrac;
    const replay = this.createPillButton(0, buttonY, end.buttonLabel, {
      fontSize: `${end.buttonFontSize}px`,
      bgColor: end.buttonBgColor,
      textColor: end.buttonTextColor,
      paddingX: end.buttonPaddingX,
      paddingY: end.buttonPaddingY,
      depth: 62,
    });
    panel.add(replay);

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

  clearEndScreen() {
    if (!this.endScreen) return;
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

  // Rebuilds the ctx for update(). Cheap (an object literal), and it means a
  // scene always sees the CURRENT tuning values during update, even mid-drag.
  ctxForActive() {
    const scene = sceneAt(this.position.scene);
    return this.buildCtx(scene);
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
      if (this.active) this.active.applyTuning(this.ctxForActive());
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

    // The confetti emitter is cached against THIS scene instance, and a restart
    // reuses that instance — so a stale, already-destroyed emitter would otherwise
    // be handed back on the second run and every burst would throw.
    destroyConfetti(this);

    this.wiping = false;
  }
}
