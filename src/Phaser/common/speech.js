// Phaser/common/speech.js
// Shared speak() helper used by every bonus game, so voice settings (rate,
// pitch) and the muted/no-speechSynthesis guards stay consistent across
// the whole app rather than being reimplemented per game.

export function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  utterance.pitch = 1.3;
  window.speechSynthesis.speak(utterance);
}
