// Minimal storage stubs so modules that touch storage at import time
// (playerStore's persist middleware, the game-access cache, the stale-chunk
// reload guard) can be imported in the node test environment without a DOM.
//
// Deliberately NOT a fake DOM: the suite tests pure functions only. Anything
// needing real rendering belongs in a browser test, which this project
// deliberately does not have (see .roorules → Testing).
function createStorageStub() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

// Each gets its OWN backing store — localStorage and sessionStorage are
// separate in a browser, and a shared one would hide a real bug.
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorageStub();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createStorageStub();
}
