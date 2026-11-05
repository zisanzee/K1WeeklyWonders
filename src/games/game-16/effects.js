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
import { isMuted } from '@/phaser/common/audioState';

// Depth bands for the effects. The end panel uses 60/61 and the dev hint 60, so
// confetti sits UNDER them (it must not cover a panel or a button) and ABOVE
// every scene layer (10) and the HUD band (19).
const CONFETTI_DEPTH = 55;
const WIPE_DEPTH = 58;

// The key the outgoing frame is snapshotted under during a wipe. One key, reused,
// and removed again afterwards — a per-transition key would leak a full-canvas
// texture for every scene change.
const SNAPSHOT_KEY = '__g16_wipe_frame';

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
 * Fire a confetti burst from a TIDY, FIXED point.
 *
 * WHY NOT RANDOM. The first version picked a random x per burst, which looked
 * wrong for a reason worth writing down: confetti is a punctuation mark, and a
 * punctuation mark that appears in a different place each time reads as noise
 * rather than as celebration. It also sometimes burst from behind the prompt band
 * or off the edge of a narrow canvas, so the effect was half-hidden at random.
 *
 * So the burst ALWAYS comes from the same place — the horizontal centre, just
 * above the top edge — and the LATERAL spread comes from the particles' own angle
 * cone instead. That gives the arc of a real confetti drop, centred and symmetric
 * on every screen, with no per-burst randomness at all.
 *
 * @param {object} scene  the Phaser scene that owns the emitter
 * @param {number} count  how many pieces
 */
export function burstConfetti(scene, count) {
  if (!scene || !(count > 0)) return;
  const emitter = confettiEmitter(scene);
  if (!emitter) return;

  const { width: W } = scene.scale;

  try {
    // ONE explode at the centre. The emitter's own `angle` cone (see
    // `confettiSpreadDeg`) fans the pieces out from there, so the shape of the
    // burst is defined by the tuning rather than by where it happened to land.
    emitter.explode(Math.round(count), W / 2, -28);
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
 * Play one of the two transition whooshes.
 *
 * Forward for the in-sweep, the pre-reversed file for the out-sweep — see
 * assets.js for why a negative playback rate is not an option.
 *
 * Deliberately silent-safe: a missing key, a locked audio context or a muted
 * player all resolve to doing nothing. A transition sound must never be able to
 * break the transition.
 */
function playWhoosh(scene, key, rate, volume) {
  if (!scene?.sound || !scene.cache?.audio?.exists?.(key)) return;
  if (isMuted() || volume <= 0) return;
  try {
    // `play` adds, plays, and destroys on complete — no reference to leak.
    scene.sound.play(key, { rate, volume });
  } catch {
    /* audio unavailable: the wipe still runs */
  }
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

  // Every fallback here comes from tuning, never an inline literal: an inline
  // dark default is how the panel stayed black after the palette was changed.
  const panel = scene.add
    .rectangle(-panelW / 2 - overscan, H / 2, panelW, H, colour ?? engine.wipeFallbackColor ?? 0xc8f0e4, 1)
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
        color: engine.wipeTitleColor ?? engine.wipeTitleFallbackColor ?? '#14503f',
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
    // ---- THE PERFORMANCE HALF OF THE TRANSITION ----
    //
    // Take a snapshot NOW, before the panel has moved, so it is the un-wiped frame.
    // When it arrives it is slipped UNDER the panel (depth-2) and everything below
    // is frozen: the outgoing scene's images are stopped and hidden while the panel
    // covers them, so Phaser stops transforming and sorting a scene nobody can see.
    //
    // Optional by construction — `frozen` stays null if the readback is unavailable
    // and the wipe just costs what it did before.
    let frozen = null;
    let froze = false;
    // EXACTLY the objects this wipe hid, so `thaw` can put back only those.
    //
    // Blanket `setVisible(true)` would be wrong: some objects are legitimately
    // invisible (a reel's losing labels, a parked shape), and thawing them would
    // make hidden art appear mid-run.
    const hidden = [];

    const freezeBelow = () => {
      if (froze || !scene.textures?.exists(SNAPSHOT_KEY)) return;
      froze = true;
      frozen = scene.add.image(W / 2, H / 2, SNAPSHOT_KEY).setDepth(WIPE_DEPTH - 2);

      // HIDE EVERYTHING UNDER THE SNAPSHOT — and nothing else.
      //
      // This is the whole saving. An earlier attempt also called
      // `scene.sys.pause()` here, which froze the very tween driving the wipe: the
      // panel stopped mid-sweep and the game looked hung. Visibility alone is
      // enough, because Phaser culls a hidden object out of the render loop.
      //
      // The test is DEPTH, so this needs no knowledge of which scene is mounted or
      // how many objects it built.
      scene.children.list.forEach((o) => {
        if (o === frozen || o === panel || o === label) return;
        if (o.depth < WIPE_DEPTH - 2 && o.visible) {
          o.setVisible(false);
          hidden.push(o);
        }
      });
    };

    /**
     * PUT THE NEW SCENE BACK ON TOP, under the panel.
     *
     * THIS IS THE FIX FOR "the transition happens, THEN the scene changes".
     *
     * The snapshot is the OUTGOING scene's frame, parked at depth WIPE_DEPTH-2 —
     * i.e. ABOVE the freshly mounted scene (layer 10). So without this, the
     * out-sweep revealed the OLD frozen picture, and the new scene only appeared
     * when the snapshot was destroyed at the very end: a visible pop.
     *
     * Called AFTER the swap, so the objects re-shown are the new scene's (plus the
     * shared HUD, which the outgoing scene's teardown never touches and which would
     * otherwise stay hidden for the rest of the run).
     */
    const thaw = () => {
      frozen?.destroy?.();
      frozen = null;
      if (scene.textures?.exists(SNAPSHOT_KEY)) scene.textures.remove(SNAPSHOT_KEY);

      // Anything still alive that this wipe hid. The hub has already destroyed the
      // outgoing scene's objects, so these are the HUD and the new layer's own.
      hidden.forEach((o) => o?.active && o.setVisible?.(true));
      hidden.length = 0;

      // The new layer was created at full alpha by its mount, which respected the
      // crossfade — but the wipe is doing the revealing, so make sure it is solid.
      scene.children.list.forEach((o) => {
        if (o.depth === 10) o.setAlpha?.(1);
      });
    };

    scene.renderer?.snapshotArea?.(0, 0, W, H, (image) => {
      try {
        if (!image || !scene.textures) return;
        if (scene.textures.exists(SNAPSHOT_KEY)) scene.textures.remove(SNAPSHOT_KEY);
        scene.textures.addImage(SNAPSHOT_KEY, image);
        freezeBelow();
      } catch {
        /* no snapshot: the wipe still runs, just unoptimised */
      }
    });

    // THE IN-SWEEP'S SOUND, played as the sweep starts so it is heard under the
    // whole movement rather than after it.
    if (engine.wipeWhoosh ?? true) {
      playWhoosh(scene, 'whoosh', engine.wipeWhooshRateIn ?? 1, engine.wipeWhooshVolume ?? 0);
    }

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

        // THE NEW SCENE GOES UNDER THE PANEL HERE — not at the end.
        //
        // This is what makes the change invisible: the swap happens with the screen
        // covered, and the fresh scene is then revealed BY the out-sweep rather than
        // popping into place after it. Without this call the out-sweep uncovered the
        // OLD snapshot frame and the new scene appeared only when that snapshot was
        // destroyed, at the very end of the transition.
        thaw();

        // ---- THE HOLD ----
        //
        // This is the beat the transition was missing. Without it the panel
        // swept in and straight back out, so the scene title was on screen for
        // only a few frames as it crossed the middle — long enough to notice,
        // too short to read.
        //
        // The hold is DELIBERATE dead time: nothing moves, the panel is fully
        // covering, the title sits still in the middle. Reading a short phrase
        // takes a kindergartner noticeably longer than an adult, hence the
        // generous default.
        const holdMs = Math.max(0, engine.wipeHoldMs ?? 0);

        const sweepOut = () => {
          // THE OUT-SWEEP'S SOUND: the SAME recording, reversed, so the two
          // halves read as one movement passing through rather than two separate
          // effects. Fired here (not at the hold) so it tracks the panel's exit.
          if (engine.wipeWhoosh ?? true) {
            playWhoosh(
              scene,
              'whooshReverse',
              engine.wipeWhooshRateOut ?? 1,
              engine.wipeWhooshVolume ?? 0,
            );
          }

          scene.tweens.add({
            targets: [panel, label].filter(Boolean),
            x: W + panelW / 2 + overscan,
            duration: ms,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
              panel.destroy();
              label?.destroy();
              // Belt and braces: if the swap never happened (no onCovered), nothing
              // was thawed, and a frozen scene would be left behind.
              frozen?.destroy?.();
              if (scene.textures?.exists(SNAPSHOT_KEY)) scene.textures.remove(SNAPSHOT_KEY);
              hidden.forEach((o) => o?.active && o.setVisible?.(true));
              hidden.length = 0;
              resolve();
            },
          });
        };

        if (holdMs <= 0) {
          sweepOut();
          return;
        }

        // The title gets its own small settle while the screen holds, so the hold
        // does not read as a freeze: it lands, then breathes once.
        if (label?.active && (engine.wipeTitleHoldScale ?? 1) !== 1) {
          scene.tweens.add({
            targets: label,
            scale: engine.wipeTitleHoldScale,
            duration: holdMs * 0.45,
            ease: 'Sine.easeOut',
          });
        }

        scene.time.delayedCall(holdMs, sweepOut);
      },
    });
  });
}
