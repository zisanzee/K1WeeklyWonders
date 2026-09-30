import { describe, it, expect } from 'vitest';
import {
  START_MS,
  START_OFFSET_MINUTES,
  diffParts,
  getAnniversary,
  formatAnniversary,
  formatNumber,
  pad2,
} from '@/pages/4yearsoflove/anniversary';

// Helper: a UTC instant from Dhaka wall-clock parts (UTC+6, no DST).
const dhaka = (y, m1, d, h = 0, min = 0, s = 0) =>
  Date.UTC(y, m1 - 1, d, h, min, s) - START_OFFSET_MINUTES * 60_000;

describe('START_MS', () => {
  it('anchors 12 October 2022 00:00 Dhaka to 11 Oct 2022 18:00 UTC', () => {
    expect(START_MS).toBe(Date.UTC(2022, 9, 11, 18, 0, 0));
  });
});

describe('diffParts', () => {
  it('is all zeros at the exact start instant', () => {
    expect(diffParts(START_MS, START_MS)).toEqual({
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it('counts whole years with no residue on a year anniversary', () => {
    expect(diffParts(START_MS, dhaka(2023, 10, 12))).toEqual({
      years: 1,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it('borrows the length of the previous month (31 Jan → 28 Feb = 28 days)', () => {
    const from = dhaka(2023, 1, 31);
    const to = dhaka(2023, 2, 28);
    const parts = diffParts(from, to);
    expect(parts.months).toBe(0);
    expect(parts.days).toBe(28);
  });

  it('handles a leap-day start without producing negative days', () => {
    const parts = diffParts(dhaka(2024, 2, 29), dhaka(2025, 2, 28));
    expect(parts.days).toBeGreaterThanOrEqual(0);
    expect(parts.months).toBeGreaterThanOrEqual(0);
  });

  it('never produces an out-of-range unit for arbitrary pairs', () => {
    // Invariants that must hold for ANY two instants — the guards against a
    // borrow that fails to cascade (which is how a counter silently shows
    // "-1 days" to someone).
    for (let i = 0; i < 500; i += 1) {
      const a = Date.UTC(2022, 0, 1) + i * 7_919_000_000;
      const b = a + (i % 13) * 43_200_000 + 3_600_000;
      const p = diffParts(a, b);
      expect(p.years).toBeGreaterThanOrEqual(0);
      expect(p.months).toBeGreaterThanOrEqual(0);
      expect(p.months).toBeLessThan(12);
      expect(p.days).toBeGreaterThanOrEqual(0);
      expect(p.days).toBeLessThanOrEqual(31);
      expect(p.hours).toBeGreaterThanOrEqual(0);
      expect(p.hours).toBeLessThan(24);
      expect(p.minutes).toBeGreaterThanOrEqual(0);
      expect(p.minutes).toBeLessThan(60);
      expect(p.seconds).toBeGreaterThanOrEqual(0);
      expect(p.seconds).toBeLessThan(60);
    }
  });
});

describe('getAnniversary', () => {
  it('reports zero totals at the start instant', () => {
    const a = getAnniversary(START_MS);
    expect(a.totalSeconds).toBe(0);
    expect(a.totalDays).toBe(0);
    expect(a.startMonthName).toBe('October');
    expect(a.startYear).toBe(2022);
  });

  it('reports 4 years at the 4-year mark', () => {
    const a = getAnniversary(dhaka(2026, 10, 12));
    expect(a.years).toBe(4);
    expect(a.months).toBe(0);
    expect(a.totalDays).toBe(Math.floor((dhaka(2026, 10, 12) - START_MS) / 86_400_000));
  });

  it('keeps monthProgress inside 0..1', () => {
    for (let day = 0; day < 400; day += 9) {
      const a = getAnniversary(START_MS + day * 86_400_000);
      expect(a.monthProgress).toBeGreaterThanOrEqual(0);
      expect(a.monthProgress).toBeLessThanOrEqual(1);
    }
  });

  it('points at a future next-year anniversary with a sane day count', () => {
    const a = getAnniversary(dhaka(2026, 9, 27)); // ~15 days before the 4th
    expect(a.nextYearCount).toBe(4);
    expect(a.daysToNextYear).toBeGreaterThan(0);
    expect(a.daysToNextYear).toBeLessThanOrEqual(366);
  });
});

describe('formatters', () => {
  it('drops trailing zero units and pluralises correctly', () => {
    expect(
      formatAnniversary({
        years: 1,
        months: 1,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      })
    ).toBe('1 year 1 month');
    expect(
      formatAnniversary({
        years: 4,
        months: 11,
        days: 2,
        hours: 0,
        minutes: 0,
        seconds: 0,
      })
    ).toBe('4 years 11 months 2 days');
    expect(
      formatAnniversary({
        years: 0,
        months: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      })
    ).toBe('0 seconds');
  });

  it('pads and groups numbers', () => {
    expect(pad2(7)).toBe('07');
    expect(pad2(42)).toBe('42');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
