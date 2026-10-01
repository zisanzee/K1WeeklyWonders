import { describe, it, expect, beforeEach } from 'vitest';
import { createTuning } from '@/devTuning/core';

// Vitest runs with import.meta.env.DEV === true, so createTuning takes its dev
// path — which is exactly the code these tests need to exercise.
function makeTuning() {
  const TABLES = {
    ENGINE: { speed: 300, gravity: 800 },
    PLAYER: { x: 360, nested: { a: 1, b: 2 } },
    LANES: [
      { id: 0, x: 180 },
      { id: 1, x: 540 },
    ],
  };
  return { tuning: createTuning({ id: 'TEST', tables: TABLES }), TABLES };
}

describe('devTuning core', () => {
  beforeEach(() => {
    delete globalThis.__TEST_OVERRIDES__;
    delete globalThis.__TEST_TABLES__;
    delete globalThis.__TEST_BUS__;
  });

  it('reads the base tables through get()', () => {
    const { tuning } = makeTuning();
    expect(tuning.get('ENGINE')).toEqual({ speed: 300, gravity: 800 });
    expect(tuning.get('LANES')).toHaveLength(2);
  });

  it('merges a nested override without clobbering sibling keys', () => {
    const { tuning } = makeTuning();
    tuning.set({ PLAYER: { nested: { a: 9 } } });
    expect(tuning.get('PLAYER').nested).toEqual({ a: 9, b: 2 });
    expect(tuning.get('PLAYER').x).toBe(360);
  });

  it('keys array-section overrides by item id', () => {
    const { tuning } = makeTuning();
    tuning.set({ LANES: { 1: { x: 600 } } });
    const lanes = tuning.get('LANES');
    expect(lanes[0].x).toBe(180); // untouched
    expect(lanes[1].x).toBe(600); // patched
  });

  it('reset() clears one section, reset(no arg) clears all', () => {
    const { tuning } = makeTuning();
    tuning.set({ ENGINE: { speed: 500 }, PLAYER: { x: 400 } });
    tuning.reset('ENGINE');
    expect(tuning.get('ENGINE').speed).toBe(300);
    expect(tuning.get('PLAYER').x).toBe(400);
    tuning.reset();
    expect(tuning.get('PLAYER').x).toBe(360);
  });

  it('notifies subscribers on every change', () => {
    const { tuning } = makeTuning();
    let hits = 0;
    const unsub = tuning.subscribe(() => {
      hits += 1;
    });
    tuning.set({ ENGINE: { speed: 1 } });
    tuning.set({ ENGINE: { speed: 2 } });
    expect(hits).toBe(2);
    unsub();
    tuning.set({ ENGINE: { speed: 3 } });
    expect(hits).toBe(2);
  });

  it('sees HMR-republished tables through the same accessor', () => {
    const { tuning } = makeTuning();
    // Simulate a saved tuning file: the fresh module overwrites the global.
    globalThis.__TEST_TABLES__ = {
      ENGINE: { speed: 999, gravity: 800 },
      PLAYER: tuning.get('PLAYER'),
      LANES: tuning.get('LANES'),
    };
    expect(tuning.get('ENGINE').speed).toBe(999);
  });
});
