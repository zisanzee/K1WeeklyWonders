// Phaser/common/numbersVoice.js
// Shared URL map + helpers for pre-recorded number-word voice clips (one through
// ten). Every game — Phaser or React — can import the pieces it needs rather than
// each game duplicating these URLs or rolling its own number-voice logic.
//
// Audio keys in Phaser follow the pattern `voice-one` .. `voice-ten` so they
// never collide with a game's own audio keys (which are typically short names
// like 'bgMusic', 'correctVoice', etc.).

const WORD_TO_URL = {
  one: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347720/one_xreq8m.mp3',
  two: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347719/two_b1xw7b.mp3',
  three: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347719/three_eqlojo.mp3',
  four: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347718/four_ippmsk.mp3',
  five: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347719/five_hkexdf.mp3',
  six: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347720/six_zeiwfd.mp3',
  seven: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347719/seven_eeut0h.mp3',
  eight: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347718/eight_vdcgpo.mp3',
  nine: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347719/nine_ajmnwe.mp3',
  ten: 'https://res.cloudinary.com/hijmipga/video/upload/v1785347718/ten_wa5hgw.mp3',
};

const WORDS = Object.keys(WORD_TO_URL); // ['one', 'two', ..., 'ten']

/** Raw URL map keyed by number-word — useful for React games using use-sound. */
export const NUMBERS_VOICE = WORD_TO_URL;

/**
 * Pre-formatted asset manifest array for BasePreloadScene({ assets: ... }).
 * Audio keys are `voice-one` .. `voice-ten`.
 *
 * Usage in a game's assets.js:
 * @example
 *   import { NUMBERS_VOICE_MANIFEST } from '../../Phaser/common/numbersVoice';
 *   export const ASSET_MANIFEST = [
 *     { type: 'image', key: 'background', url: IMAGES.background },
 *     ...NUMBERS_VOICE_MANIFEST,
 *   ];
 */
export const NUMBERS_VOICE_MANIFEST = WORDS.map((word) => ({
  type: 'audio',
  key: `voice-${word}`,
  url: WORD_TO_URL[word],
}));

/**
 * Convert a number (1-10) or word ('one'-'ten') to the Phaser audio key.
 * Returns `null` for out-of-range numbers or unknown words.
 */
function toAudioKey(input) {
  if (typeof input === 'number') {
    const word = WORDS[input - 1];
    return word ? `voice-${word}` : null;
  }
  const lower = input.toLowerCase();
  return lower in WORD_TO_URL ? `voice-${lower}` : null;
}

/**
 * Play a pre-loaded number voice clip through a Phaser scene's sound manager.
 * The audio must have been loaded (e.g. via NUMBERS_VOICE_MANIFEST in the
 * game's BasePreloadScene) — otherwise a warning is logged and nothing plays.
 *
 * Stops any previous number voice before starting a new one, so clips never
 * stack on top of each other (same pattern as BonusGame1/speech.js).
 *
 * @param {Phaser.Scene} scene - the scene whose sound cache/manager to use.
 * @param {number|string} number - integer 1-10 or word 'one'..'ten'.
 * @param {boolean} [muted=false] - if true, any current voice is stopped but
 *   no new one is started.
 * @param {function} [onComplete] - optional callback fired when the clip
 *   finishes playing (or immediately if the clip isn't loaded). Useful for
 *   chaining voice lines without guessing timeouts.
 */
export function playNumberVoice(scene, number, muted = false, onComplete) {
  if (!scene) return;

  const key = toAudioKey(number);
  if (!key) {
    console.warn(`playNumberVoice(): invalid input "${number}"`);
    return;
  }

  // Stop whatever number voice is still playing first.
  if (window.__currentNumberVoice) {
    window.__currentNumberVoice.stop();
    window.__currentNumberVoice.destroy();
    window.__currentNumberVoice = null;
  }

  if (muted) return;

  if (!scene.cache.audio.exists(key)) {
    console.warn(`playNumberVoice(): no audio loaded for key "${key}" — did you include NUMBERS_VOICE_MANIFEST in your preload?`);
    if (onComplete) onComplete();
    return;
  }

  const voice = scene.sound.add(key);
  window.__currentNumberVoice = voice;
  voice.once('complete', () => {
    voice.destroy();
    if (window.__currentNumberVoice === voice) {
      window.__currentNumberVoice = null;
    }
    onComplete?.();
  });
  voice.play();
}

/**
 * Return the Cloudinary URL for a given number's voice clip — handy for React
 * games that want to use `use-sound` or plain `new Audio()` instead of Phaser's
 * sound manager.
 *
 * @example
 *   import { getNumberVoiceUrl } from '../../Phaser/common/numbersVoice';
 *   import useSound from 'use-sound';
 *   const [play] = useSound(getNumberVoiceUrl(3));
 *
 * @param {number|string} number - integer 1-10 or word 'one'..'ten'.
 * @returns {string|undefined} The mp3 URL, or undefined if the input is invalid.
 */
export function getNumberVoiceUrl(number) {
  if (typeof number === 'number') {
    const word = WORDS[number - 1];
    return word ? WORD_TO_URL[word] : undefined;
  }
  return WORD_TO_URL[number.toLowerCase()];
}
