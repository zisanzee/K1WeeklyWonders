import { describe, it, expect, beforeEach } from 'vitest';
import { isChunkLoadError, canAttemptChunkRecovery } from '@/pwa/staleChunkRecovery';

describe('isChunkLoadError', () => {
  // Every phrasing below is one a real browser has produced for a lazy chunk
  // that 404s after a deploy. Chrome's "Failed to fetch dynamically imported
  // module" is the one reported from the field, but the others arrive from
  // Safari and from bundler-level failures, and missing any of them means the
  // user gets a dead error screen instead of an automatic recovery.
  it.each([
    'Failed to fetch dynamically imported module: https://ezwonders.com/assets/GamePage-abc.js',
    'ChunkLoadError: Loading chunk 12 failed.',
    'Loading chunk GamePage failed.',
    'Importing a module script failed.',
    'error loading dynamically imported module',
  ])('recognises %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('accepts a bare string as well as an Error', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('does not treat an ordinary render error as a chunk error', () => {
    // Critical: an ordinary error must NOT trigger the unregister-and-wipe path,
    // which would cost every cached asset for no reason.
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(false);
  });

  it('is safe on empty or missing input', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('')).toBe(false);
  });
});

describe('canAttemptChunkRecovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows the first attempt', () => {
    expect(canAttemptChunkRecovery()).toBe(true);
  });

  it('refuses a second attempt inside the cooldown', () => {
    // A genuinely missing chunk must not be able to reload the browser in a
    // loop — one error screen is far better for a child than that.
    const now = Date.now();
    sessionStorage.setItem('ezw.chunk-reload-at', String(now));

    expect(canAttemptChunkRecovery(now + 1_000)).toBe(false);
    expect(canAttemptChunkRecovery(now + 59_000)).toBe(false);
  });

  it('allows another attempt once the cooldown has elapsed', () => {
    const now = Date.now();
    sessionStorage.setItem('ezw.chunk-reload-at', String(now));

    expect(canAttemptChunkRecovery(now + 61_000)).toBe(true);
  });

  it('allows an attempt when storage is unavailable', () => {
    // Private mode / a locked-down school browser: better to try once than to
    // never attempt recovery at all. Replaced wholesale rather than spied on,
    // because there is no real Storage class in the node test environment.
    const original = globalThis.sessionStorage;
    globalThis.sessionStorage = {
      getItem() {
        throw new Error('storage disabled');
      },
      setItem() {
        throw new Error('storage disabled');
      },
      removeItem() {},
      clear() {},
    };

    try {
      expect(canAttemptChunkRecovery()).toBe(true);
    } finally {
      globalThis.sessionStorage = original;
    }
  });
});
