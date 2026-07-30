// audioState.js
// Tiny localStorage-backed mute toggle + a helper that makes sure exactly
// one looping 'bgMusic' Sound exists for the whole game session (Phaser's
// SoundManager is per-Game, not per-Scene, so the same Sound object can
// and should survive scene transitions instead of being stopped/recreated
// every time scenes swap).

const MUTE_KEY = 'game7-muted-v1';

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
// if one's already playing from a previous scene instead of restarting it,
// and defers play() until Phaser's AudioContext actually unlocks if the
// browser blocked autoplay before any touch/click happened.
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

  if (!music.isPlaying) {
    if (scene.sound.locked) {
      scene.sound.once('unlocked', tryPlay);
    } else {
      tryPlay();
    }
  }

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
