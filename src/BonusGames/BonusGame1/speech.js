// Phaser/common/speech.js
//
// Plays short pre-recorded voice-over clips instead of synthesizing speech
// with the browser's Web Speech API (window.speechSynthesis). TTS quality
// and voice selection vary wildly across browsers/OSes, and some mobile
// browsers won't speak at all without a fresh user gesture — a recorded
// clip loaded through the scene's own preload (see assets.js / the
// flattened ASSET_MANIFEST) sidesteps all of that.
//
// `key` must be one of the audio keys already loaded into this scene's
// sound cache — i.e. one of the keys in AUDIO / ASSET_MANIFEST in
// assets.js (e.g. 'introBiggerDice', 'winGoodJob').

let currentVoice = null;

/**
 * Play a recorded voice line.
 * @param {Phaser.Scene} scene - the scene whose sound manager/cache to use.
 * @param {string} key - audio key from assets.js (e.g. 'winGoodJob').
 * @param {boolean} [muted=false] - if true, any line already playing is
 *   stopped and no new one is started.
 */
export function speak(scene, key, muted = false) {
  if (!scene) return;

  // Stop whatever line is still playing first — covers both the "muted"
  // case and the normal case of a new line interrupting an old one (e.g.
  // a level restarting while the previous "Good job!" is still finishing),
  // so lines never stack on top of each other.
  if (currentVoice) {
    currentVoice.stop();
    currentVoice.destroy();
    currentVoice = null;
  }

  if (muted || !key) return;

  if (!scene.cache.audio.exists(key)) {
    // Missing/misspelled key shouldn't crash the scene — just skip the
    // voice line and say why, so it's obvious in the console during dev.
    console.warn(`speak(): no audio loaded for key "${key}"`);
    return;
  }

  const voice = scene.sound.add(key);
  currentVoice = voice;
  voice.once('complete', () => {
    voice.destroy();
    if (currentVoice === voice) currentVoice = null;
  });
  voice.play();
}
