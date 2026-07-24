// speech.js
// Same speak() helper used elsewhere in the app, so voice settings (rate,
// pitch) and the muted/no-speechSynthesis guards stay consistent across
// the whole game rather than being reimplemented per scene.

export function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  utterance.pitch = 1.3;
  window.speechSynthesis.speak(utterance);
}
