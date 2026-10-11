// sfx.js — a tiny synthesised sound-board. WebAudio only, zero asset files.
//
// Every sound is built from a few oscillators and filtered noise, tuned to a
// major-pentatonic scale so that ANY sequence of interactions stays consonant —
// a fast scroll through the reasons or a frantic round of the heart game can
// never produce a wrong note. A short feedback echo gives it a music-box feel.
//
// The context is created lazily, on the first call after a user gesture (the
// heart hold is that gesture), so browsers never block it. Everything is a
// silent no-op when sound is switched off or WebAudio is missing.

let ac = null;
let out = null;
let wet = null;
let enabled = true;
const lastPlayed = {};

const PENTA = [0, 2, 4, 7, 9];
const ROOT = 392; // G4

const stepFreq = (step) => {
  const s = Math.max(0, Math.floor(step));
  const octave = Math.floor(s / PENTA.length);
  return ROOT * 2 ** ((PENTA[s % PENTA.length] + 12 * octave) / 12);
};

function ensure() {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      ac = new Ctx();
    } catch {
      return null;
    }
    const comp = ac.createDynamicsCompressor();
    out = ac.createGain();
    out.gain.value = 0.55;
    out.connect(comp);
    comp.connect(ac.destination);

    // The echo: wet -> delay -> lowpass -> (feedback to delay) and to the mix.
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.27;
    const feedback = ac.createGain();
    feedback.gain.value = 0.38;
    const lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2400;
    wet = ac.createGain();
    wet.gain.value = 0.35;
    wet.connect(delay);
    delay.connect(lowpass);
    lowpass.connect(feedback);
    feedback.connect(delay);
    lowpass.connect(comp);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

// Rate limiter, so a burst of events cannot stack hundreds of voices.
const allow = (name, ms) => {
  const now = performance.now();
  if (now - (lastPlayed[name] || 0) < ms) return false;
  lastPlayed[name] = now;
  return true;
};

function tone({ freq, dur = 0.9, type = 'sine', gain = 0.16, at = 0, glideTo, send = 0.6 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(out);
  if (send) {
    const s = c.createGain();
    s.gain.value = send;
    g.connect(s);
    s.connect(wet);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.4, from = 800, to = 800, q = 0.8, gain = 0.2, type = 'bandpass', at = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + at;
  const length = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t0);
}

// A bell: the note, a quiet octave above, and a faint inharmonic shimmer.
function bell(freq, gain = 0.16, at = 0, dur = 1.1) {
  tone({ freq, gain, at, dur });
  tone({ freq: freq * 2, gain: gain * 0.3, at, dur: dur * 0.6 });
  tone({ freq: freq * 3.01, gain: gain * 0.1, at, dur: dur * 0.35 });
}

export const sfx = {
  setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled && ac && ac.state === 'running') ac.suspend().catch(() => {});
    if (enabled && ac) ac.resume().catch(() => {});
  },
  isEnabled: () => enabled,
  // Call from a user gesture to make sure audio is allowed to start.
  unlock() {
    ensure();
  },

  // A single scale note. `step` 0.. climbs the pentatonic ladder.
  chime(step = 0, gain = 0.14) {
    if (!allow('chime', 70)) return;
    bell(stepFreq(step), gain);
  },
  // The hold gate "charging": pitch follows progress 0..1 up two octaves.
  tick(progress = 0) {
    if (!allow('tick', 90)) return;
    bell(stepFreq(Math.floor(progress * 9)), 0.07, 0, 0.6);
  },
  pop() {
    if (!allow('pop', 80)) return;
    tone({ freq: 880, glideTo: 1500, dur: 0.14, gain: 0.08, send: 0.3 });
  },
  sparkle() {
    if (!allow('sparkle', 150)) return;
    [0, 0.07, 0.14].forEach((d, i) => bell(stepFreq(10 + i * 2 + Math.floor(Math.random() * 2)), 0.06, d, 0.6));
  },
  whoosh() {
    if (!allow('whoosh', 120)) return;
    noise({ dur: 0.75, from: 300, to: 3200, q: 1.4, gain: 0.1 });
  },
  boom() {
    if (!allow('boom', 140)) return;
    noise({ dur: 0.5, from: 1800, to: 120, q: 0.6, gain: 0.22, type: 'lowpass' });
    tone({ freq: 150, glideTo: 45, dur: 0.45, gain: 0.2, send: 0.2 });
    [0.05, 0.11, 0.17, 0.24].forEach((d) => noise({ dur: 0.05, from: 5000, to: 3000, gain: 0.05, at: d, type: 'highpass' }));
  },
  seal() {
    if (!allow('seal', 300)) return;
    noise({ dur: 0.12, from: 4200, to: 900, q: 2, gain: 0.18 });
    tone({ freq: 220, glideTo: 90, dur: 0.25, gain: 0.16, send: 0.2 });
    bell(stepFreq(7), 0.1, 0.1);
  },
  fanfare() {
    if (!allow('fanfare', 600)) return;
    [0, 2, 4, 5, 7, 9].forEach((s, i) => bell(stepFreq(s + 2), 0.12, i * 0.075, 1.4));
  },
  hug() {
    if (!allow('hug', 300)) return;
    [0, 2, 4].forEach((s) => tone({ freq: stepFreq(s) / 2, dur: 1.6, gain: 0.1, type: 'triangle', send: 0.7 }));
    [4, 7, 9].forEach((s, i) => bell(stepFreq(s), 0.08, 0.12 + i * 0.09, 1.2));
  },
  // The game: pitch climbs with the combo, a falling blip when it breaks.
  catch(combo = 0) {
    if (!allow('catch', 50)) return;
    bell(stepFreq(combo % 12), 0.12, 0, 0.7);
  },
  gold() {
    [7, 9, 11, 14].forEach((s, i) => bell(stepFreq(s), 0.1, i * 0.06, 0.9));
  },
  miss() {
    if (!allow('miss', 120)) return;
    tone({ freq: 330, glideTo: 140, dur: 0.3, gain: 0.12, type: 'triangle', send: 0.2 });
  },
  slow() {
    tone({ freq: 700, glideTo: 180, dur: 0.7, gain: 0.1, type: 'sine', send: 0.8 });
  },
  win() {
    this.fanfare();
    [0.5, 0.8, 1.1].forEach((d) => setTimeout(() => sfx.boom(), d * 1000));
  },
};

export const setSoundEnabled = sfx.setEnabled;
