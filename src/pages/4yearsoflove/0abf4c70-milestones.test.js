import { describe, it, expect } from 'vitest';
import { START_MS, START_OFFSET_MINUTES, getAnniversary } from '@/pages/4yearsoflove/anniversary';
import { MILESTONES, achievedMilestones } from '@/pages/4yearsoflove/milestones';

// A UTC instant from Singapore wall-clock parts (UTC+8, no DST).
const singapore = (y, m1, d, h = 0) =>
  Date.UTC(y, m1 - 1, d, h) - START_OFFSET_MINUTES * 60_000;

describe('achievedMilestones', () => {
  it('is empty at the very start', () => {
    expect(achievedMilestones(getAnniversary(START_MS))).toEqual([]);
  });

  it('unlocks the 100-day milestone on day 100 and not before', () => {
    const before = achievedMilestones(getAnniversary(START_MS + 99 * 86_400_000));
    const on = achievedMilestones(getAnniversary(START_MS + 100 * 86_400_000));
    expect(before.map((m) => m.id)).not.toContain('d100');
    expect(on.map((m) => m.id)).toContain('d100');
  });

  it('has every milestone by the four-year mark', () => {
    const all = achievedMilestones(getAnniversary(singapore(2026, 10, 12)));
    expect(all).toHaveLength(MILESTONES.length);
  });

  it('only ever grows as time passes', () => {
    let previous = 0;
    for (let day = 0; day <= 1600; day += 25) {
      const count = achievedMilestones(getAnniversary(START_MS + day * 86_400_000)).length;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });
});
