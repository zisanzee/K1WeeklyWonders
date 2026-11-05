// voice.js
// GAME 16 — prompt-voice playback, and the "say it again" button.
//
// THREE RULES, and they are the whole feature:
//
//   1. When a prompt is SET, its voice plays.
//   2. When the round COMPLETES, the voice stops immediately — mid-word is
//      correct, because the child has moved on and a voice talking over the next
//      transition is noise.
//   3. A button at the top right replays the CURRENT line, and glows while
//      anything is playing so there is something to tap when nothing is said.
//
// WHY A SINGLE SHARED `current` HANDLE, NOT PER-SCENE STATE
// ---------------------------------------------------------------------------
// Only one line may be audible at a time. Phaser's SoundManager is per-Game, so a
// module-level handle genuinely covers every scene; tracking it per scene instead
// would let a line from the previous round keep talking over the new one.
//
// WHY `stop()` IS IDEMPOTENT AND TRY-WRAPPED
// ---------------------------------------------------------------------------
// It is called from the completion path, from mount, from shutdown and from the
// button. Any one of those running against an already-destroyed sound must be a
// no-op rather than a throw — a prompt line failing to stop must never be able to
// break a round handover.
import { isMuted } from '@/phaser/common/audioState';
import { getVoice } from '@/games/game-16/tuning';
import { voiceFor, voiceKeyAndUrlFor } from '@/games/game-16/prompts';

// The one audible line, if any: { sound, key }.
let current = null;

// The button, and the loop that glows it. Kept module-level for the same reason
// as `current`: exactly one exists per game instance.
let button = null;
let glowTween = null;

// ---- PLAYBACK --------------------------------------------------------------

/**
 * Stop whatever prompt line is playing, right now.
 *
 * Safe to call at any time, on any number of times in a row.
 */
export function stopPromptVoice() {
  if (!current) return;
  const { sound } = current;
  current = null;

  try {
    sound.stop();
    sound.destroy();
  } catch {
    // Already torn down by the scene shutdown — nothing to do.
  }

  setButtonGlowing(false);
}

/**
 * Is a prompt line audible right now?
 *
 * Read by the button's glow and by the tests, so "is it playing" has exactly one
 * definition.
 */
export function isPromptVoicePlaying() {
  return Boolean(current?.sound?.isPlaying);
}

/**
 * Play one prompt row's line.
 *
 * @param {object} scene    a live Phaser scene (the hub)
 * @param {string} sceneId  'shapes' | 'mirror' | 'positions' | 'building'
 * @param {number} round    1-BASED round / portrait / floor, matching prompts.js
 * @param {object} [extra]
 *   { clue }             scene 1 only: the clue the reel landed on — it SELECTS the clip
 *   { slot }             scene 3 only: which of the portrait's two prompts
 *   { floor }            scene 4 only: the 1-based floor being asked about
 * @param {object} [opts]
 *   { allowFallback }    true for a MANUAL replay, so a round with no recording of
 *                        its own can still play the nearest earlier one. False (the
 *                        default) for the automatic play when a prompt appears.
 * @returns {boolean} true when something actually started
 */
export function playPromptVoice(scene, sceneId, round, extra = {}, opts = {}) {
  // A new line always silences the old one FIRST, so two can never overlap.
  stopPromptVoice();

  if (!scene || isMuted()) return false;

  // `allowFallback` is what separates the two callers:
  //
  //   AUTOMATIC (a prompt appearing)   → false. A round with no recording is
  //                                      SILENT; re-reading the previous round's
  //                                      line unprompted would be noise.
  //   MANUAL (the "say it again" tap)  → true. The child is asking to hear the
  //                                      instruction they are following, which for
  //                                      scene 2 is round 1's clip on every round.
  const { key, url } = voiceKeyAndUrlFor(sceneId, round, extra);
  const playable = opts.allowFallback ? url : voiceFor(sceneId, round, extra);
  if (!playable) return false;

  return playKey(scene, key);
}

/**
 * Play ONE audio key.
 *
 * THE single primitive: every audible prompt goes through here, so "only one line
 * at a time" and "the glow tracks the audio" are true by construction rather than
 * by each caller remembering them.
 *
 * @param {object} scene  a live Phaser scene
 * @param {string} key    the audio key to play
 * @returns {boolean} true when the line started
 */
function playKey(scene, key) {
  if (!scene || !key || !scene.cache.audio.exists(key)) return false;

  let sound = null;
  try {
    sound = scene.sound.add(key, { volume: getVoice().promptVolume });
  } catch {
    return false;
  }

  sound.once('complete', () => {
    // Only clear the handle if it is still OURS — otherwise a line that has
    // already been superseded would blank the state of the one replacing it.
    if (current?.sound === sound) {
      current = null;
      setButtonGlowing(false);
    }

    try {
      sound.destroy();
    } catch {
      /* already gone */
    }
  });

  try {
    sound.play();
  } catch {
    try {
      sound.destroy();
    } catch {
      /* already gone */
    }
    return false;
  }

  current = { sound, key };
  setButtonGlowing(true);
  return true;
}

// ---- THE BUTTON ------------------------------------------------------------

/**
 * Build the "say it again" button at the top right.
 *
 * A pill from the shared helper, so it matches the mute toggle in size and press
 * feel rather than being a bespoke shape. `simple: true` skips the helper's press
 * bounce — the glow IS the feedback here, and two animations on one tap is noise.
 *
 * @returns {object|null} the pill wrapper (has `.container`, `.on`, `.destroy`)
 */
export function createVoiceButton(scene, x, y, opts = {}) {
  if (!scene) return null;

  const v = getVoice();

  button = scene.createPillButton(x, y, v.buttonIcon, {
    fontSize: `${v.buttonFontSize}px`,
    minWidth: v.buttonMinSize,
    minHeight: v.buttonMinSize,
    circle: true,
    simple: true,
    depth: v.buttonDepth,
    anchor: 'topRight',
    ...opts,
  });

  button.on('pointerup', () => {
    // The hub registers the actual replay callback, because only it knows which
    // round is on screen. The button stays dumb so it cannot go stale.
    onPress?.();
  });

  return button;
}

// The replay callback the hub installs. A module-level function reference so the
// button (created once) can always reach the CURRENT round.
let onPress = null;

/** Point the button at the current round. Called by the hub on every mount. */
export function setVoiceButtonHandler(fn) {
  onPress = typeof fn === 'function' ? fn : null;
}

/**
 * Glow the button while a line plays, and stop glowing when it ends.
 *
 * The glow is a SCALE pulse plus an alpha pulse on the button's own container, so
 * it costs one tween on one object. It is killed the moment playback stops —
 * a button left pulsing after the audio ended is the most obvious sign of a
 * half-finished implementation.
 */
export function setButtonGlowing(on) {
  if (!button?.container) return;

  glowTween?.remove?.();
  glowTween = null;

  const target = button.container;

  if (!on) {
    target.setScale(1);
    target.setAlpha(1);
    return;
  }

  const v = getVoice();
  glowTween = button.container.scene?.tweens?.add({
    targets: target,
    scale: v.glowScale,
    duration: Math.max(1, v.glowMs),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

/** Tear the button and its tween down. Called from the hub's shutdown. */
export function destroyVoiceButton() {
  glowTween?.remove?.();
  glowTween = null;
  stopPromptVoice();
  button?.destroy?.();
  button = null;
  onPress = null;
}
