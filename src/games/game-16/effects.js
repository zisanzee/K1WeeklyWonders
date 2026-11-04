// effects.js
// Game 16 — the shared celebration + transition effects.
//
// WHY THIS IS ONE MODULE AND NOT PER-SCENE CODE
// ---------------------------------------------------------------------------
// Confetti is the effect most likely to stutter on a school tablet, and it is
// easy to write in the way that stutters: forty `add.image` calls, each with its
// own tween, each destroyed on completion. That is forty display objects, forty
// tweens and forty destructions per burst — and a child who finishes scenes
// quickly stacks them.
//
// ONE ParticleEmitter changes the cost shape. Phaser batches a single emitter's
// particles into one draw, recycles them from a pool, and never allocates per
// particle at burst time. The pool is capped by `confettiMaxLive`, so a burst
// arriving mid-fall TRIMMES rather than adding: the ceiling is fixed no matter how
// fast the scenes go by.
//
// The emitter is created once per Phaser scene and reused for every burst, so
// there is no create/destroy churn between scenes either.
//
// THE TRANSITION lives here for the same reason: it is one rectangle, not a stack
// of slices, and both the wipe and the confetti need to agree about depth.
import { getEngine } from '@/games/game-16/tuning';
import { makeConfettiTexture } from '@/phaser/common/sceneAssets';

// Depth bands for the effects. The end panel uses 60/61 and the dev hint 60, so
// confetti sits UNDER them (it must not cover a panel or a button) and ABOVE
// every scene layer (10) and the HUD band (19).
const CONFETTI_DEPTH = 55;
const WIPE_DEPTH = 58;

// The emitter, keyed by the Phaser scene that owns it. A WeakMap so a destroyed
// scene's entry goes with it instead of pinning the scene forever.
const emitters = new WeakMap();

/**
 * The shared confetti emitter for this scene, created on first use.
 *
 * Returns null when the texture could not be made (a content-security or decode
 * failure), so every caller can simply skip the effect rather than throw — a
 * celebration must never be able to break a completed round.
 */
export function confettiEmitter(scene) {
  if (!scene) return null;

  const existing = emitters.get(scene);
  if (existing?.active) return existing;

  const engine = getEngine();
  const texture = makeConfettiTexture(scene);
  if (!texture || !scene.textures.exists(texture)) return null;

  // CONSTRUCTION IS GUARDED. A celebration is decoration; it must never be able
  // to take down a scene change or a finished round. If the particle API differs
  // from what this config expects, the game simply plays without confetti.
  try {
    const emitter = scene.add.particles(0, 0, texture, {
      // NOTHING EMITTED UNTIL ASKED: `emitting: false` plus explicit `explode()`
      // means the emitter exists but costs nothing between celebrations. This is
      // the same shape game 13's dust emitter uses, so the two behave identically.
      emitting: false,
      quantity: 1,
      lifespan: engine.confettiMs ?? 1500,
      gravityY: engine.confettiGravityY ?? 620,
      speed: { min: engine.confettiSpeedMin ?? 220, max: engine.confettiSpeedMax ?? 520 },
      // Fired UPWARD-ish and outward, so the pieces arc across the screen rather
      // than dropping straight down in a column.
      angle: {
        min: 90 - (engine.confettiSpreadDeg ?? 55),
        max: 90 + (engine.confettiSpreadDeg ?? 55),
      },
      scale: { min: 0.7, max: 1.3 },
      rotate: { min: -220, max: 220 },
      // THE CEILING. `maxAliveParticles` sizes the pool, so a burst cannot grow the
      // population past it — the cost of the effect is fixed, not proportional to
      // how fast the scenes go by.
      maxAliveParticles: engine.confettiMaxLive ?? 90,
      // An ARRAY is Phaser's "pick one at random per particle", so the burst is a
      // mix of colours rather than one flat colour per emitter.
      tint: [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6],
    });

    emitter.setDepth(CONFETTI_DEPTH);
    emitters.set(scene, emitter);
    return emitter;
  } catch {
    return null;
  }
}

/**
 * Fire a confetti burst at a screen position.
 *
 * `explode(count, x, y)` is the same call game 13 uses: it seeds exactly `count`
 * particles at that point in ONE step, rather than relying on an emit zone, and
 * Phaser recycles them from the pool.
 *
 * `y` defaults to just above the top edge so the pieces fall INTO the screen.
 */
export function burstConfetti(scene, count, x = null, y = null) {
  if (!scene || !(count > 0)) return;
  const emitter = confettiEmitter(scene);
  if (!emitter) return;

  const { width } = scene.scale;
  // Spread across the top edge unless a specific point was asked for.
  const px = Number.isFinite(x) ? x : width * (0.15 + Math.random() * 0.7);
  const py = Number.isFinite(y) ? y : -24;

  try {
    emitter.explode(Math.round(count), px, py);
  } catch {
    // A particle API mismatch must not cost a completed round.
  }
}

/**
 * Release the emitter when the scene shuts down.
 *
 * Phaser destroys children of the scene on shutdown, but the WeakMap entry would
 * keep a reference until GC — and on a run restart the SAME scene instance is
 * reused, so a stale destroyed emitter would be handed back by `confettiEmitter`
 * and `explode()` on it would throw.
 */
export function destroyConfetti(scene) {
  if (!scene) return;
  const emitter = emitters.get(scene);
  if (emitter?.destroy) emitter.destroy();
  emitters.delete(scene);
}

/**
 * The scene-change wipe.
 *
 * Runs a full-width panel across the canvas in the OUTGOING scene's accent, calls
 * `onCovered` at the moment the screen is completely hidden (which is when the hub
 * swaps the scene, so the swap itself is never seen), then sweeps the panel off to
 * reveal the new one.
 *
 * ONE rectangle, tweened on x. `onCovered` is invoked exactly once, guarded — a
 * tween that is killed mid-flight must not fire it late, and a swap that never
 * happens would leave the panel parked over the game.
 *
 * @returns {Promise<void>} resolves when the wipe has fully cleared
 */
export function runWipe(scene, { colour, title, onCovered } = {}) {
  const engine = getEngine();
  const ms = Math.max(0, engine.wipeMs ?? 0);

  // Tuning off, or no scene: swap immediately, so the change still happens.
  if (!scene || ms === 0) {
    onCovered?.();
    return Promise.resolve();
  }

  const { width: W, height: H } = scene.scale;
  const overscan = engine.wipeOverscanPx ?? 40;
  // Wide enough to cover the canvas on the way through.
  const panelW = W + overscan * 2;

  const panel = scene.add
    .rectangle(-panelW / 2 - overscan, H / 2, panelW, H, colour ?? 0x1e293b, 1)
    .setDepth(WIPE_DEPTH);

  // The title rides ON the panel, so it is centred on the panel's own x and moves
  // with it — no second tween to keep in step.
  let label = null;
  if (engine.wipeTitle && title) {
    label = scene.add
      .text(panel.x, H / 2, title, {
        fontSize: `${engine.wipeTitleFontSize ?? 52}px`,
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: engine.wipeTitleColor ?? '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(WIPE_DEPTH + 1)
      // Fades in as the panel covers, so it arrives with the sweep rather than
      // sitting on a blank rectangle the whole way across.
      .setAlpha(0);
  }

  return new Promise((resolve) => {
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      swapped = true;
      onCovered?.();
    };

    // TWO SEQUENTIAL TWEENS, one per sweep. A tween chain rather than a single
    // yoyo because the two halves need DIFFERENT things to happen between them
    // (the scene swap), and the panel must not be destroyed until it is fully off
    // the canvas again.
    //
    // `Cubic.easeInOut` on both: the sweep starts gently, is fastest as it crosses,
    // and settles at the far edge — which is what makes it read as a deliberate
    // wipe rather than a rectangle being dragged.
    scene.tweens.add({
      targets: [panel, label].filter(Boolean),
      // Ends with the panel exactly covering the canvas, so the swap happens with
      // nothing visible at the edges.
      x: W / 2,
      duration: ms,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        // The label rides the panel, so it needs no tween of its own — only its
        // fade. Clamped, because the panel's x passes 1 quickly at the start.
        if (label?.active) label.setAlpha(Math.min(1, Math.max(0, (panel.x + panelW / 2) / W)));
      },
      onComplete: () => {
        // The screen is fully covered: this is the only safe moment to swap.
        swap();

        scene.tweens.add({
          targets: [panel, label].filter(Boolean),
          x: W + panelW / 2 + overscan,
          duration: ms,
          ease: 'Cubic.easeInOut',
          onComplete: () => {
            panel.destroy();
            label?.destroy();
            resolve();
          },
        });
      },
    });
  });
}
