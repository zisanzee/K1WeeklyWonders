import { describe, it, expect } from 'vitest';
import {
  advance,
  describe as describePosition,
  jumpRound,
  jumpScene,
  navLabel,
  runProgress,
  startRun,
} from '@/games/game-16/progress';
import { SCENES, ROUNDS_PER_SCENE, TOTAL_ROUNDS, sceneAt, sceneById } from '@/games/game-16/scenes';

// The scene/round handover is the one piece of game-16 logic that is easy to get
// subtly wrong and impossible to notice until someone plays to the end: an
// off-by-one only shows up on the final round, and a missing wrap only shows up
// mid-run. So it is pinned exhaustively rather than sampled.

describe('scene registry', () => {
  it('declares exactly five scenes', () => {
    expect(SCENES).toHaveLength(5);
  });

  it('gives every scene a unique id', () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('numbers every scene 1..5 in order', () => {
    // `number` is displayed to the player, so a gap would read as a missing game.
    expect(SCENES.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('gives every scene a positive round count', () => {
    // NOT "all scenes have 3". Scene 1 runs FOUR: its last round is a two-shape
    // round that needs its own clue, so folding it into three would drop a clue.
    // Asserting equality here would protect the wrong invariant and fail the
    // moment a second scene legitimately differs.
    for (const scene of SCENES) {
      expect(scene.rounds, scene.id).toBeGreaterThan(0);
      expect(Number.isInteger(scene.rounds), scene.id).toBe(true);
    }
  });

  it('defaults an unspecified scene to ROUNDS_PER_SCENE', () => {
    // The constant is a DEFAULT, so the scenes that do not override it match it.
    const defaulted = SCENES.filter((s) => s.rounds === ROUNDS_PER_SCENE);
    expect(defaulted.length).toBeGreaterThan(0);
  });

  it('derives TOTAL_ROUNDS from the scenes, not from a fixed sum', () => {
    // Scene 1's extra round is included because the total is computed.
    expect(TOTAL_ROUNDS).toBe(SCENES.reduce((sum, s) => sum + s.rounds, 0));
    expect(TOTAL_ROUNDS).toBe(16); // 4 (scene 1) + 4 × 3
  });

  it('looks scenes up by id and by index', () => {
    expect(sceneById('mirror').number).toBe(2);
    expect(sceneById('nope')).toBeUndefined();
    expect(sceneAt(0).id).toBe('shapes');
    expect(sceneAt(4).id).toBe('ordinal');
  });

  it('clamps an out-of-range index instead of returning undefined', () => {
    // A corrupt or stale saved index must show scene 1, not crash the hub.
    expect(sceneAt(-1).id).toBe('shapes');
    expect(sceneAt(99).id).toBe('ordinal');
    expect(sceneAt(1.5)).toBe(SCENES[1]);
  });
});

describe('advance — the production path', () => {
  it('starts at the first round of the first scene', () => {
    expect(startRun()).toEqual({ scene: 0, round: 0, done: false });
  });

  it('walks the whole run in exactly 15 steps', () => {
    let position = startRun();
    let steps = 0;
    while (!position.done && steps < 100) {
      position = advance(position);
      steps += 1;
    }
    expect(steps).toBe(TOTAL_ROUNDS);
    expect(position.done).toBe(true);
  });

  it('stays in the scene for rounds 0 → 1 → 2', () => {
    const r1 = advance({ scene: 0, round: 0, done: false });
    expect(r1).toEqual({ scene: 0, round: 1, done: false });
    const r2 = advance(r1);
    expect(r2).toEqual({ scene: 0, round: 2, done: false });
  });

  it('rolls from the last round of a scene into round 0 of the next', () => {
    // The boundary that a naive `round + 1` gets wrong.
    const lastRoundOfFirst = { scene: 0, round: 2, done: false };
    expect(advance(lastRoundOfFirst)).toEqual({ scene: 1, round: 0, done: false });
  });

  it('rolls over correctly at every scene boundary', () => {
    for (let scene = 0; scene < SCENES.length - 1; scene += 1) {
      const at = { scene, round: SCENES[scene].rounds - 1, done: false };
      const next = advance(at);
      expect(next.scene, `from scene ${scene}`).toBe(scene + 1);
      expect(next.round).toBe(0);
      expect(next.done).toBe(false);
    }
  });

  it('never skips or repeats a round', () => {
    let position = startRun();
    const seen = [];
    while (!position.done) {
      seen.push(`${position.scene}:${position.round}`);
      position = advance(position);
    }
    expect(seen).toHaveLength(TOTAL_ROUNDS);
    expect(new Set(seen).size).toBe(TOTAL_ROUNDS);
    expect(seen[0]).toBe('0:0');
    expect(seen[seen.length - 1]).toBe('4:2');
  });

  it('ends on the LAST round rather than one past it', () => {
    // So a completion screen can still say "scene 5, round 3".
    const finalRound = { scene: 4, round: 2, done: false };
    const after = advance(finalRound);
    expect(after.done).toBe(true);
    expect(after.scene).toBe(4);
    expect(after.round).toBe(2);
  });

  it('is idempotent once done', () => {
    const finished = { scene: 4, round: 2, done: true };
    expect(advance(finished).done).toBe(true);
  });
});

describe('jumpScene — dev only', () => {
  it('steps whole scenes and resets the round', () => {
    expect(jumpScene({ scene: 0, round: 2, done: false }, 1)).toEqual({
      scene: 1,
      round: 0,
      done: false,
    });
  });

  it('clamps at the first and last scene', () => {
    expect(jumpScene(startRun(), -1).scene).toBe(0);
    expect(jumpScene({ scene: 4, round: 0, done: false }, 1).scene).toBe(4);
  });

  it('never marks the run done, even at the last scene', () => {
    // A developer must not be able to end the run by tuning.
    expect(jumpScene({ scene: 4, round: 2, done: false }, 1).done).toBe(false);
  });
});

describe('jumpRound — dev only', () => {
  it('steps within a scene', () => {
    expect(jumpRound({ scene: 1, round: 0, done: false }, 1)).toEqual({
      scene: 1,
      round: 1,
      done: false,
    });
  });

  it('rolls forward into the next scene at the boundary', () => {
    expect(jumpRound({ scene: 0, round: 2, done: false }, 1)).toEqual({
      scene: 1,
      round: 0,
      done: false,
    });
  });

  it('rolls backward into the previous scene at the boundary', () => {
    expect(jumpRound({ scene: 1, round: 0, done: false }, -1)).toEqual({
      scene: 0,
      round: 2,
      done: false,
    });
  });

  it('clamps at the very first round', () => {
    expect(jumpRound(startRun(), -1)).toEqual({ scene: 0, round: 0, done: false });
  });

  it('clamps at the very last round', () => {
    expect(jumpRound({ scene: 4, round: 2, done: false }, 1)).toEqual({
      scene: 4,
      round: 2,
      done: false,
    });
  });

  it('can walk the entire run and back without ending it', () => {
    // The dev nav's ◀ ▶ is a single round step, so it must be safe to hold down.
    let position = startRun();
    for (let i = 0; i < 40; i += 1) position = jumpRound(position, 1);
    expect(position).toEqual({ scene: 4, round: 2, done: false });
    for (let i = 0; i < 40; i += 1) position = jumpRound(position, -1);
    expect(position).toEqual({ scene: 0, round: 0, done: false });
  });
});

describe('display helpers', () => {
  it('describes the position with 1-based counters', () => {
    expect(describePosition({ scene: 0, round: 0 })).toBe('scene 1 / 5 · round 1 / 3');
    expect(describePosition({ scene: 4, round: 2 })).toBe('scene 5 / 5 · round 3 / 3');
  });

  it('builds a compact dev nav label', () => {
    expect(navLabel({ scene: 1, round: 1 })).toBe('2/5 mirror · round 2/3');
  });

  it('reports run progress from 0 to 1', () => {
    expect(runProgress(startRun())).toBe(0);
    expect(runProgress({ scene: 4, round: 2 })).toBeCloseTo(14 / 15);
    // A hypothetical position past the end still clamps to <= 1.
    expect(runProgress({ scene: 4, round: 2 }) <= 1).toBe(true);
  });
});
