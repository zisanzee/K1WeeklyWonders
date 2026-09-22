// Phaser/common/speech.js
// Enhanced speech-synthesis helper used by every React-based game (Game 1,
// Game 2, Game 5).  Selects the best available OS voice, warms up the TTS
// engine on mount so the first utterance has no cold-start delay, and
// gracefully degrades when speechSynthesis is unavailable (the game visuals
// already show the same text, so silence is a fine fallback).

// ---------- voice selection ----------

// Preference order — natural-sounding English voices from various OSes.
// The first match found in speechSynthesis.getVoices() wins; if none
// match we fall back to any English voice or the system default.
const VOICE_PREFERENCES = [
  'google us english',
  'microsoft david',
  'microsoft zira',
  'microsoft mark',
  'samantha',
  'alex',
  'daniel',
  'karen',
];

let _bestVoice = null;
let _warmedUp = false;

function findBestVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  for (const hint of VOICE_PREFERENCES) {
    const match = voices.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  // Fallback: first voice that sounds like English.
  return voices.find((v) => v.lang.startsWith('en')) || voices[0];
}

// ---------- warmup ----------

/** Prime the TTS engine so the first real speak() call has no delay. */
export function warmupSpeech() {
  if (_warmedUp) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  // Force voice-list population (async on some browsers — the getter itself
  // triggers it, but Chrome may need a small event-loop tick; that's fine,
  // the worst case is the first speak() picks a sub-optimal voice).
  window.speechSynthesis.getVoices();
  _bestVoice = findBestVoice();

  // A silent utterance primes the engine so real utterances don't pay the
  // ~200-500ms cold-start penalty on first call.
  const silent = new SpeechSynthesisUtterance(' ');
  silent.volume = 0;
  if (_bestVoice) silent.voice = _bestVoice;
  window.speechSynthesis.speak(silent);
  window.speechSynthesis.cancel();

  _warmedUp = true;
}

// ---------- speak / cancel ----------

/**
 * Speak a line of text through the best available OS voice.
 * Returns `true` if speech was initiated, `false` if muted or unavailable
 * (callers can use this to show a visual-only fallback if they want).
 */
export function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  utterance.pitch = 1.3;

  // Re-check voices in case they loaded after warmup.
  if (!_bestVoice) _bestVoice = findBestVoice();
  if (_bestVoice) utterance.voice = _bestVoice;

  window.speechSynthesis.speak(utterance);
  return true;
}

/** Cancel any in-flight speech immediately (call on unmount / mute). */
export function cancelSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
