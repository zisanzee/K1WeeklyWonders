// devEditor.js  (BACKUP COPY — not imported by anything)
// Game 12 — temporary development editor state.
//
// This is a scratch pad, not game logic. It lets you drag characters/boxes and
// nudge them with sliders in the live scene, then copy the resulting numbers
// back into sceneTuning.js.
//
// The scene imports this unconditionally (it is tiny and side-effect-light), but
// every call site is behind `DEV_EDITOR`/`import.meta.env.DEV`, so in a
// production build the exported functions are never reached. The heavier part —
// the React panel — is lazy + dev-gated in Game.jsx and does drop out.
//
//   overrides[key]     = { x, y, scale, rotation, flipX, z }  // partial, merged
//   boxOverrides[key]  = { x, y, w, h }                       // partial, merged
//
// sceneTuning.js's partTransform() reads globalThis.__G12_OVERRIDES__ and
// boxOverride() reads globalThis.__G12_BOX_OVERRIDES__, so anything set here
// immediately wins over the file values during tuning.

const OVERRIDES_KEY = '__G12_OVERRIDES__';
const BOX_OVERRIDES_KEY = '__G12_BOX_OVERRIDES__';

function root() {
  if (typeof globalThis === 'undefined') return {};
  if (!globalThis[OVERRIDES_KEY]) globalThis[OVERRIDES_KEY] = {};
  return globalThis[OVERRIDES_KEY];
}

function boxRoot() {
  if (typeof globalThis === 'undefined') return {};
  if (!globalThis[BOX_OVERRIDES_KEY]) globalThis[BOX_OVERRIDES_KEY] = {};
  return globalThis[BOX_OVERRIDES_KEY];
}

// A tiny event bus so the React panel and the Phaser scene stay in step without
// importing each other.
const listeners = new Set();
let relayout = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

// The scene registers how to re-apply values to what is on screen.
export function setRelayout(fn) {
  relayout = fn;
}

export function requestRelayout() {
  if (relayout) relayout();
}

export function getOverrides() {
  return root();
}

export function getOverride(key) {
  return root()[key] || {};
}

export function hasOverride(key) {
  return key in root();
}

// Patch one character's override. Only the fields present in `patch` are
// written, so dragging (x/y) never disturbs a slider-set scale.
export function update(key, patch) {
  const store = root();
  store[key] = { ...store[key], ...patch };
  emit();
  requestRelayout();
}

export function resetPart(key) {
  const store = root();
  delete store[key];
  emit();
  requestRelayout();
}

// ---------------------------------------------------------------------------
// Box overrides — the same shape as part overrides but for drop boxes, kept in
// their own store so a character drag never clobbers a box edit and vice-versa.
// ---------------------------------------------------------------------------
export function getBoxOverride(key) {
  return boxRoot()[key] || {};
}

export function updateBox(key, patch) {
  const store = boxRoot();
  store[key] = { ...store[key], ...patch };
  emit();
  requestRelayout();
}

export function resetBox(key) {
  const store = boxRoot();
  delete store[key];
  emit();
  requestRelayout();
}

export function resetAll() {
  if (typeof globalThis !== 'undefined') {
    globalThis[OVERRIDES_KEY] = {};
    globalThis[BOX_OVERRIDES_KEY] = {};
  }
  emit();
  requestRelayout();
}

// ---------------------------------------------------------------------------
// Selection. A single selected key, plus whether the panel is editing that
// character's transform or its box.
// ---------------------------------------------------------------------------
let selectedKey = null;
let mode = 'part'; // 'part' | 'box'

export function getSelected() {
  return selectedKey;
}

export function getMode() {
  return mode;
}

export function select(key, nextMode = 'part') {
  selectedKey = key;
  mode = nextMode;
  emit();
}

export function setMode(nextMode) {
  mode = nextMode;
  emit();
}

// ---------------------------------------------------------------------------
// Readout — renders the current scene's values as copy-pasteable code.
// ---------------------------------------------------------------------------
function fmt(n) {
  // Trim to a sane number of decimals so the pasted code stays readable.
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

// `baseFor` supplies the on-file values (so untouched characters still print),
// and `keys` limits the output to the scene currently on screen.
export function formatCode(keys, baseFor) {
  const store = root();
  const lines = keys.map((key) => {
    const base = baseFor(key);
    const merged = { ...base, ...(store[key] || {}) };
    return `  ${key}: { x: ${fmt(merged.x)}, y: ${fmt(merged.y)}, scale: ${fmt(
      merged.scale
    )}, rotation: ${fmt(merged.rotation)}, flipX: ${merged.flipX ? 'true' : 'false'}, z: ${fmt(
      merged.z
    )} },`;
  });
  return lines.join('\n');
}

// Box readout — the copy-pasteable lines for CHARACTER_BOXES, same idea as
// formatCode but for the box table.
export function formatBoxCode(keys, baseFor, currentFor) {
  const lines = keys.map((key) => {
    const base = baseFor(key) || {};
    const current = currentFor(key) || {};
    const merged = { ...base, ...current };
    return `  ${key}: { x: ${fmt(merged.x)}, y: ${fmt(merged.y)}, w: ${fmt(
      merged.w
    )}, h: ${fmt(merged.h)} },`;
  });
  return lines.join('\n');
}
