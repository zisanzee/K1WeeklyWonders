// audioState.js
// Shared mute toggle + bg-music helper for every Phaser game.
//
// This used to exist as five near-identical per-game copies (Game 4, 7, 8, 9,
// 10), each with its OWN localStorage key. That meant a child who muted the
// audio in one game got full volume again the moment they opened the next one,
// which is exactly the bug this module exists to prevent — the mute preference
// is a property of the *player*, not of whichever game they happen to be in.
//
// There is deliberately ONE key here. Never re-introduce a per-game key.

const MUTE_KEY = 'ezw-muted-v1';

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(value) {
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable — mute just won't persist across reloads.
  }
}

// Call once from each scene's create(). Reuses the existing bgMusic Sound
// if one's already playing from a previous scene instead of restarting it,
// and defers play() until Phaser's AudioContext actually unlocks if the
// browser blocked autoplay before any touch/click happened.
//
// Phaser's SoundManager is per-Game, not per-Scene, so the same Sound object
// can and should survive scene transitions.
export function ensureBgMusic(scene) {
  scene.sound.mute = isMuted();

  let music = scene.sound.get('bgMusic');
  if (!music && scene.cache.audio.exists('bgMusic')) {
    music = scene.sound.add('bgMusic', { loop: true, volume: 0.28 });
  }
  if (!music) return null;

  const tryPlay = () => {
    if (!music.isPlaying) music.play();
  };

  // Don't gate on `sound.locked` — that made the music wait for the first
  // click while the voice clips started straight away. Try now, and let the
  // unlock listener act as a retry only if the browser blocked this play.
  tryPlay();
  scene.sound.once('unlocked', tryPlay);

  return music;
}

// Small circular 🔊/🔇 toggle. Placed with createPillButton's own
// anchor/x/y so it can be positioned the same way any other pill is.
// `simple: true` skips uiHelpers' built-in press-bounce animation — this
// button is meant to be a flat, no-frills toggle, not a "juicy" button.
export function addMuteButton(scene, x, y, opts = {}) {
  const btn = scene.createPillButton(x, y, isMuted() ? '🔇' : '🔊', {
    fontSize: '20px',
    minWidth: 44,
    minHeight: 44,
    circle: true,
    simple: true,
    depth: 25,
    ...opts,
  });
  btn.on('pointerup', () => {
    const next = !isMuted();
    setMuted(next);
    scene.sound.mute = next;
    btn.setText(next ? '🔇' : '🔊');
  });
  return btn;
}
