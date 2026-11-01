// GameScene.js
// Game 16 — THE HUB. One Phaser scene that runs five mini-games in sequence.
//
// WHAT THIS FILE OWNS
// ---------------------------------------------------------------------------
//   • the run position (scene 0..4 × round 0..2 = 15 rounds) via progress.js
//   • the SHARED HUD: scene title, progress dots, prompt line, mute button
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
import { makeConfettiTexture } from '@/phaser/common/sceneAssets';

// Re-exported so `import GameScene, { BACKGROUND_COLOR }` works in Game.jsx.
export { BACKGROUND_COLOR };

// The five scene modules, in registry order. Keys must match scenes.js ids —
// asserted at module scope below so a rename can't silently break the mount.
import ShapesScene from '@/games/game-16/scenes/ShapesScene';
import MirrorScene from '@/games/game-16/scenes/MirrorScene';
import PositionsScene from '@/games/game-16/scenes/PositionsScene';
import LeftRightScene from '@/games/game-16/scenes/LeftRightScene';
import OrdinalScene from '@/games/game-16/scenes/OrdinalScene';

const MODULES = {
  shapes: ShapesScene,
  mirror: MirrorScene,
  positions: PositionsScene,
  'left-right': LeftRightScene,
  ordinal: OrdinalScene,
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
    this.dots = [];
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
    // every scene's `{ correct: false }` report, so it is complete whatever each
    // mechanic turns out to be. Reported in the completion payload once all
    // scenes are playable; nothing sends it before that.
    this.mistakes = 0;
    this.mistakeLog = [];
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

    // One dot per SCENE (not per round): five dots answer "which mini-game am I
    // in, and how many are left", which is what a child needs to know.
    const startX = width / 2 - ((SCENES.length - 1) * hud.dotGap) / 2;
    const y = this.scale.height * hud.dotsYFrac;
    this.dots = SCENES.map((_, i) =>
      this.add
        .circle(startX + i * hud.dotGap, y, hud.dotRadius, hud.dotActiveColor)
        .setDepth(20)
    );

    this.refreshHud();
  }

  // Pushes the current position onto the HUD. Cheap; called on every mount.
  refreshHud() {
    const hud = getHud();
    const scene = sceneAt(this.position.scene);

    this.titleText.setText(`${scene.number} / ${SCENES.length} · ${scene.title}`);

    this.dots.forEach((dot, i) => {
      if (i < this.position.scene) {
        // Completed scenes read green.
        dot.setFillStyle(hud.dotDoneColor, 1);
      } else if (i === this.position.scene) {
        dot.setFillStyle(hud.dotActiveColor, 1);
      } else {
        dot.setFillStyle(hud.dotActiveColor, hud.dotIdleAlpha);
      }
    });
  }

  // The scene modules call this through ctx to change the prompt.
  setPrompt(text) {
    if (this.promptText) this.promptText.setText(text || '');
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

    // RETRY: the same round is mounted again. Nothing advances, so the progress
    // dots and the round counter stay put — a wrong answer must not skip a round.
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
    this.position = next;
    this.mountCurrentScene({ fade: sceneChanged });
  }

  finishRun() {
    const engine = getEngine();
    this.position = { ...this.position, done: true };
    this.refreshHud();
    this.setPrompt('');

    // A complete-run burst, then report to React. The event name and payload are
    // the contract Game.jsx already has wired to logPlaySession.
    if (this.textures.exists('g16-confetti') === false) {
      makeConfettiTexture(this, 'g16-confetti');
    }
    const { width, height } = this.scale;
    for (let i = 0; i < 24; i += 1) {
      const piece = this.add
        .image(width * (0.15 + Math.random() * 0.7), -40, 'g16-confetti')
        .setDepth(50)
        .setScale(0.6 + Math.random() * 0.5)
        .setAngle(Math.random() * 360);
      this.tweens.add({
        targets: piece,
        y: height + 60,
        angle: piece.angle + 360,
        duration: 1600 + Math.random() * 900,
        delay: i * 40,
        ease: 'Quad.easeIn',
        onComplete: () => piece.destroy(),
      });
    }

    const payload = {
      stars: SCENES.length,
      // Derived, never hard-coded: scene 1 runs four rounds, so the run is 16.
      totalRounds: TOTAL_ROUNDS,
      peakStreak: 0,
      // Never hard-coded 0: the real tally, accumulated across all five scenes.
      // Nothing consumes it until the other scenes exist, but reporting a
      // constant would make the value silently wrong the moment they do.
      mistakes: this.mistakes || 0,
      elapsedSeconds: Math.round((this.time.now - (this.startTime || 0)) / 1000),
    };
    this.game.events.emit('game16-complete', payload);
    this.setPrompt(`All ${SCENES.length} mini-games complete!`);

    // Let the confetti play before anything else happens.
    this.time.delayedCall(Math.max(400, engine.transitionMs), () => {
      this.handingOver = false;
    });
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------
  update(time, delta) {
    if (!this.active || this.position.done) return;
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
    });

    // Panel nav: « » step scenes, ◀ ▶ step rounds. Both are DEV paths from
    // progress.js, so neither can end the run.
    TUNING.setNav({
      label: () => navLabel(this.position),
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
  }
}
