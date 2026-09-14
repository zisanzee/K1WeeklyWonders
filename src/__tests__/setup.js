// Minimal localStorage stub so modules that touch storage at import time
// (playerStore's persist middleware, the game-access cache) can be imported in
// the node test environment without a DOM.
//
// Deliberately NOT a fake DOM: the suite tests pure functions only. Anything
// needing real rendering belongs in a browser test, which this project
// deliberately does not have (see .roorules → Testing).
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
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
