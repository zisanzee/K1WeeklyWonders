// audioState.js
// Tiny localStorage-backed mute toggle + a helper that makes sure exactly
// one looping 'bgMusic' Sound exists for the whole game session (Phaser's
// SoundManager is per-Game, not per-Scene, so the same Sound object can
// and should survive scene transitions instead of being stopped/recreated
// every time scenes swap).

const MUTE_KEY = 'game9-muted-v1';

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function setMuted(value) {
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable — mute just won't persist across reloads.
  }
}

// Call once from each scene's create(). Reuses the existing bgMusic Sound
// if one's already playing from a previous scene instead of restarting it.
// Attempts playback immediately (the same path the voice clips take, which
// is why they autoplay), then also retries when the AudioContext unlocks if
// a browser still deferred the first play.
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

  // Don't gate on `sound.locked` — that's what made music wait for the
  // first click while the voice clips started straight away. Play now and
  // let the unlock listener act as a retry only if the browser blocked it.
  tryPlay();
  scene.sound.once('unlocked', tryPlay);

  return music;
}

// Small circular 🔊, 🔇 toggle. Placed with createPillButton's own
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
