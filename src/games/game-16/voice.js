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

// The button, the speaker icon inside it, the halo behind it, and the tweens on
// them. All module-level for the same reason as `current`: exactly one of each
// exists per game instance.
let button = null;
let icon = null;
let halo = null;
let glowTween = null;
let iconTween = null;
let haloLoop = null;

// The icon's RESTING scale, set by `setDisplaySize` when it is created.
//
// This has to be remembered, not recomputed: the PNG is 200 px and is drawn at
// ~30 px, so its scale is ~0.15. Tweening `scale` to an absolute 1.14 would make
// the icon seven times its size — the pulse must be RELATIVE to this number.
let iconBaseScale = 1;

// The texture key the speaker PNG is loaded under (see assets.js).
const ICON_KEY = 'voiceIcon';

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
 * THE ICON IS AN IMAGE, NOT AN EMOJI.
 *
 * It used to be a 🔊 glyph, which was wrong three ways: every platform drew a
 * different speaker, it was too small to read at button size, and a glyph cannot
 * be tinted or scaled as one shape. The PNG is pure black on transparent, so it
 * sits on the white pill and can be tinted amber while speaking without a second
 * asset. When the texture is missing (offline first load, blocked CDN) it falls
 * back to the emoji rather than showing a green box.
 *
 * Structure, back to front:
 *   halo  — a stroked ring OUTSIDE the pill, hidden until speaking
 *   pill  — the shared white circle
 *   icon  — the speaker PNG, added INTO the pill's container
 *
 * @returns {object|null} the pill wrapper (has `.container`, `.on`, `.destroy`)
 */
export function createVoiceButton(scene, x, y, opts = {}) {
  if (!scene) return null;

  const v = getVoice();
  const hasIcon = Boolean(scene.textures?.exists?.(ICON_KEY));

  button = scene.createPillButton(x, y, hasIcon ? '' : v.buttonIcon, {
    fontSize: `${v.buttonFontSize}px`,
    minWidth: v.buttonMinSize,
    minHeight: v.buttonMinSize,
    circle: true,
    simple: true,
    depth: v.buttonDepth,
    anchor: 'topRight',
    // THE TRANSLUCENT, OUTLINED DISC.
    //
    // The fill alpha needs `bgAlpha` on the shared pill helper (added for this);
    // the faint dark edge is what keeps a see-through pale disc visible on the
    // pale parts of the scene art.
    bgColor: v.buttonBgColor ?? 0xffffff,
    bgAlpha: v.buttonBgAlpha ?? 1,
    borderColor: v.buttonBorderColor ?? null,
    ...opts,
  });

  if (!button?.container) return button;

  // The icon is added INTO the pill's container so it inherits the container's
  // position, depth and scale — no second transform to keep in sync, and the
  // pill's own glow tween carries it along for free.
  if (hasIcon) {
    icon = scene.add.image(0, 0, ICON_KEY).setDisplaySize(v.iconSize, v.iconSize);
    // Remember the resting scale BEFORE anything tweens it — see iconBaseScale.
    iconBaseScale = icon.scaleX;

    // CENTRED ON THE PILL, not on the container origin. With `anchor: 'topRight'`
    // the container's own origin is the button's outer corner, so the pill's
    // centre sits half a size up-and-left of it. Reusing the wrapper's width
    // keeps this correct for any size or padding rather than hard-coding it.
    const size = typeof button.width === 'function' ? button.width() : v.buttonMinSize;
    icon.setPosition(-size / 2, size / 2);
    button.container.add(icon);
  }

  // THE HALO, created AFTER the pill so it would sort above it — so it is pushed
  // down one depth instead. It has to sit BEHIND the white circle: a ring drawn
  // on top of a filled circle reads as a border, not as light coming off it.
  halo = scene.add
    .circle(x, y, ((v.buttonMinSize ?? 46) + (v.glowRingPad ?? 0)) / 2)
    .setDepth((v.buttonDepth ?? 26) - 1)
    .setStrokeStyle(v.glowRingWidth ?? 4, v.glowRingColor ?? 0xff9f1c, 1)
    .setFillStyle()
    .setVisible(false);
  // Anchored to the same corner as the pill, then offset to the pill's centre,
  // so it stays concentric however the pill is placed.
  halo.setPosition(x - (v.buttonMinSize ?? 46) / 2, y + (v.buttonMinSize ?? 46) / 2);

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
 * THREE things happen together, and all three are needed for it to read as
 * "speaking" rather than "selected":
 *
 *   1. the HALO expands outwards and fades — light coming off the button, which
 *      is what makes it visible against any scene art behind it;
 *   2. the ICON swells and tints amber — the symbol itself reacting, which is
 *      what a child actually watches;
 *   3. the whole pill breathes very slightly in scale.
 *
 * Everything is killed on the first stop, and the icon is reset to its untinted
 * state: a button left pulsing or left amber after the audio ends is the most
 * obvious sign of a half-finished implementation.
 */
export function setButtonGlowing(on) {
  if (!button?.container) return;

  const v = getVoice();
  const scene = button.container.scene;

  // Always tear the previous state down first, so calling this twice is safe and
  // cannot stack two loops on one object.
  glowTween?.remove?.();
  iconTween?.remove?.();
  haloLoop?.remove?.();
  glowTween = null;
  iconTween = null;
  haloLoop = null;

  if (!on) {
    button.container.setScale(1);
    // Back to the RESTING scale, not to 1 — the icon is smaller than its texture.
    // No `clearTint` needed: the icon is never tinted (see the note below).
    icon?.setScale(iconBaseScale);
    halo?.setVisible(false).setAlpha(0);
    return;
  }

  glowTween = scene?.tweens?.add({
    targets: button.container,
    scale: v.glowScale,
    duration: Math.max(1, v.glowMs),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  if (icon) {
    iconTween = scene?.tweens?.add({
      targets: icon,
      // RELATIVE to the resting scale — see iconBaseScale. An absolute target
      // here would resize the icon by a factor of its texture size.
      scale: iconBaseScale * (v.iconPulse ?? 1),
      duration: Math.max(1, v.glowMs),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // THE ICON IS DELIBERATELY **NOT** RECOLOURED WHILE SPEAKING.
    //
    // It used to be tinted amber, and that was wrong once the button became a
    // 55%-opaque white disc: a tinted silhouette loses contrast against the pale
    // fill, so the icon became harder to read exactly while it was doing
    // something. It stays pure black — the highest contrast available on this
    // button — and the speaking state is carried by MOTION OUTSIDE the glyph
    // instead: this swelling pulse, and the halo expanding off the button.
    //
    // `glowTint` is now intentionally unused. Do not reintroduce a tint here
    // without rechecking it against the translucent fill.
  }

  if (halo) {
    // Restart from the button's own size every time, so a pulse interrupted
    // halfway does not leave the halo stuck at an arbitrary radius.
    const base = v.buttonMinSize ?? 46;
    halo
      .setVisible(true)
      .setScale(1)
      .setRadius?.((base + (v.glowRingPad ?? 0)) / 2)
      .setAlpha(v.glowRingAlpha ?? 0.85);

    // No `onRepeat` reset is needed: a repeating Phaser tween restarts from the
    // start values it captured at creation (scale 1, full alpha), so each cycle
    // begins as a fresh pulse LEAVING the button rather than a ring collapsing
    // back inwards. Adding a manual reset here would only duplicate that.
    haloLoop = scene?.tweens?.add({
      targets: halo,
      scale: v.glowRingScale ?? 1.5,
      alpha: 0,
      duration: Math.max(1, v.glowMs) * 1.6,
      repeat: -1,
      ease: 'Sine.easeOut',
    });
  }
}

/** Tear the button, the icon, the halo and every tween down. */
export function destroyVoiceButton() {
  glowTween?.remove?.();
  iconTween?.remove?.();
  haloLoop?.remove?.();
  glowTween = null;
  iconTween = null;
  haloLoop = null;
  stopPromptVoice();
  halo?.destroy?.();
  halo = null;
  // `icon` lives inside the button's container, so destroying the button takes it
  // with it — no separate destroy, which would double-free it.
  icon = null;
  button?.destroy?.();
  button = null;
  onPress = null;
}
