// src/devTuning/core.js
// Generic, framework-free engine behind the shared dev-tuning kit.
//
// A game calls createTuning({ id, tables }) with its plain tuning tables (the
// numbers you tune by eye). It gets back a small accessor object the game reads
// through, plus a live-override store that the dev panel writes to.
//
// How hot-editing works:
//   - The game's tuning file publishes its tables to `globalThis.__<id>_TABLES__`
//     on EVERY module evaluation. When you save an edit, Vite replaces the
//     module, the new tables overwrite that global, and the already-running
//     scene's accessors read them through `get()` on their next call — no page
//     reload. (A running scene holds the OLD module's `get` closure, so reading
//     the constants directly would keep showing stale numbers.)
//   - The dev panel's edits live in a SEPARATE store (`__<id>_OVERRIDES__`)
//     layered on top, so the two never clobber each other.
//
// Zero-cost when off: createTuning() checks import.meta.env.DEV. In a production
// build it returns a thin accessor that reads the constants directly — no
// globals, no bus, no merges, no HMR, no runtime work.

const EMPTY = {};

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Recursive merge for plain objects (arrays are replaced). Lets the panel patch
// a leaf like { car: { crash: { shake: { amplitude } } } } without dropping the
// sibling keys on the way down.
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function createTuning({ id, tables }) {
  // ---- production: read the constants directly, do nothing else. ----
  if (!import.meta.env.DEV) {
    return {
      id,
      dev: false,
      get: (key) => tables[key],
      readAll: () => tables,
      set() {},
      reset() {},
      subscribe: () => () => {},
      setRelayout() {},
      requestRelayout() {},
      setNav() {},
      getNav: () => null,
      notify() {},
      formatCode: () => '',
    };
  }

  // ---- dev: publish tables + run the override store and change bus. ----
  const TABLES_KEY = `__${id}_TABLES__`;
  const OVERRIDES_KEY = `__${id}_OVERRIDES__`;
  const BUS_KEY = `__${id}_BUS__`;

  if (typeof globalThis !== 'undefined') globalThis[TABLES_KEY] = tables;

  const live = () => globalThis[TABLES_KEY] || tables;
  const overrides = () => globalThis[OVERRIDES_KEY] || EMPTY;

  // The change bus lives on globalThis too, so panel subscriptions and the
  // scene's relayout callback survive an HMR module swap.
  function bus() {
    globalThis[BUS_KEY] = globalThis[BUS_KEY] || { listeners: new Set(), relayout: null };
    return globalThis[BUS_KEY];
  }

  // Notify panel subscribers only — NOT the relayout callback. Used by the nav
  // slot and other UI-only updates, so they never re-enter the scene's relayout
  // (which would be an infinite loop when a scene's relayout itself pokes).
  function notify() {
    for (const fn of bus().listeners) fn();
  }

  function poke() {
    const b = bus();
    for (const fn of b.listeners) fn();
    if (b.relayout) b.relayout();
  }

  // Current value of a section: base tables with any live override applied.
  // Array sections (e.g. lanes) are keyed by each item's `id`.
  function get(key) {
    const base = live()[key];
    if (base === undefined) return undefined;
    const ov = overrides()[key];
    if (Array.isArray(base)) {
      const map = ov || {};
      return base.map((item) => ({ ...item, ...(map[item.id] || {}) }));
    }
    return ov ? deepMerge(base, ov) : base;
  }

  function readAll() {
    const out = {};
    for (const key of Object.keys(live())) out[key] = get(key);
    return out;
  }

  // Write a patch. Object sections deep-merge; array sections merge per item id.
  function set(patch) {
    if (typeof globalThis === 'undefined') return;
    const store = (globalThis[OVERRIDES_KEY] = globalThis[OVERRIDES_KEY] || {});
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) continue;
      const base = live()[key];
      if (Array.isArray(base)) {
        store[key] = store[key] || {};
        for (const [itemId, itemPatch] of Object.entries(value)) {
          store[key][itemId] = deepMerge(store[key][itemId] || {}, itemPatch);
        }
      } else {
        store[key] = deepMerge(store[key] || {}, value);
      }
    }
    poke();
  }

  // Clear one section's overrides, or every section's when called with no key.
  function reset(key) {
    if (typeof globalThis === 'undefined') return;
    if (key) {
      const store = globalThis[OVERRIDES_KEY];
      if (store) delete store[key];
    } else {
      globalThis[OVERRIDES_KEY] = {};
    }
    poke();
  }

  function subscribe(fn) {
    const b = bus();
    b.listeners.add(fn);
    return () => b.listeners.delete(fn);
  }

  function setRelayout(fn) {
    bus().relayout = fn;
  }

  // Optional per-game NAVIGATION for the panel: the scene registers prev/next
  // handlers plus a label + the current scope (e.g. scene number), and the panel
  // renders ◀ label ▶. Only games whose schema sets `nav: true` use this.
  function setNav(handlers) {
    bus().nav = handlers || null;
    notify(); // UI-only: never triggers relayout
  }

  function getNav() {
    return bus().nav || null;
  }

  // Copy-paste source: the game supplies the formatter (it owns its file shape).
  function formatCode(formatter) {
    const values = readAll();
    return formatter ? formatter(values) : JSON.stringify(values, null, 2);
  }

  // Used by a tuning file's HMR accept hook: when the module is saved, the new
  // tables are already published, so a poke is all it takes to re-apply.
  function requestRelayout() {
    poke();
  }

  return {
    id,
    dev: true,
    get,
    readAll,
    set,
    reset,
    subscribe,
    setRelayout,
    requestRelayout,
    setNav,
    getNav,
    notify,
    formatCode,
  };
}
