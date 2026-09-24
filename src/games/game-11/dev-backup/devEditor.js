// devEditor.js  (BACKUP COPY — not imported by anything)
// Game 11 — temporary development editor state.
//
// This is a scratch pad, not game logic. It lets you drag parts and nudge them
// with sliders in the live scene, then copy the resulting numbers back into
// portraitPositions.js. Nothing here ships.
//
//   overrides[key] = { x, y, scale, rotation, z }   // partial, merged over code
//
// portraitPositions.js merges globalThis.__G11_OVERRIDES__ inside partTransform,
// so anything set here immediately wins over the file values during tuning.
//
// See README.md in this folder for how to restore the editor.

const OVERRIDES_KEY = '__G11_OVERRIDES__';

function root() {
  if (typeof globalThis === 'undefined') return {};
  if (!globalThis[OVERRIDES_KEY]) globalThis[OVERRIDES_KEY] = {};
  return globalThis[OVERRIDES_KEY];
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

// Patch one part's override. Only the fields present in `patch` are written, so
// dragging (x/y) never disturbs a slider-set scale.
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

export function resetAll() {
  globalThis[OVERRIDES_KEY] = {};
  emit();
  requestRelayout();
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
let selectedKey = null;

export function getSelected() {
  return selectedKey;
}

export function select(key) {
  selectedKey = key;
  emit();
}

// ---------------------------------------------------------------------------
// Readout — renders the current portrait's values as copy-pasteable code.
// ---------------------------------------------------------------------------
function fmt(n) {
  // Trim to a sane number of decimals so the pasted code stays readable.
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

// `baseFor` supplies the on-file values (so untouched parts still print), and
// `keys` limits the output to the round currently on screen.
export function formatCode(keys, baseFor) {
  const store = root();
  const lines = keys.map((key) => {
    const base = baseFor(key);
    const merged = { ...base, ...(store[key] || {}) };
    return `  ${key}: { x: ${fmt(merged.x)}, y: ${fmt(merged.y)}, scale: ${fmt(
      merged.scale
    )}, rotation: ${fmt(merged.rotation)}, z: ${fmt(merged.z)} },`;
  });
  return lines.join('\n');
}
