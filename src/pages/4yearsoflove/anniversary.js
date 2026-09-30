// anniversary.js
// Pure, framework-free date maths for the /4yearsoflove keepsake page.
//
// Why this is a separate module: the live counter is the heart of the page, and
// it is the one part that must be provably right (and is therefore the part
// worth unit-testing — see anniversary.test.js). Everything else on the page is
// presentation.
//
// ---------------------------------------------------------------------------
// THE START DATE — the one ambiguous input
// ---------------------------------------------------------------------------
// "12/10/22" is ambiguous (US MM/DD vs the rest of the world DD/MM). It is
// resolved here, in ONE place, as **12 October 2022** (DD/MM/YY, the format
// used in the couple's timezone). If that reading is ever wrong, change
// `START_DATE_PARTS` below and the entire page follows — no other file encodes
// the date.
//
// The anchor is midday-neutral midnight in Asia/Dhaka (UTC+6). Bangladesh has
// observed no DST since 2009, so a FIXED offset is exactly correct here and the
// count can never drift by an hour mid-year the way a zone-database lookup
// would if the rules ever changed.

export const START_DATE_PARTS = Object.freeze({
  year: 2022,
  month: 10, // 1-based: 10 = October
  day: 12,
  hour: 0,
  minute: 0,
  second: 0,
});

// Minutes offset of the anniversary's "local" timezone. Asia/Dhaka = UTC+6.
export const START_OFFSET_MINUTES = 360;

// The exact UTC instant the relationship began. Computed (not hardcoded) so the
// parts above stay the single source of truth.
export const START_MS =
  Date.UTC(
    START_DATE_PARTS.year,
    START_DATE_PARTS.month - 1,
    START_DATE_PARTS.day,
    START_DATE_PARTS.hour,
    START_DATE_PARTS.minute,
    START_DATE_PARTS.second
  ) -
  START_OFFSET_MINUTES * 60_000;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// A Date whose UTC getters report the wall-clock time at `offsetMinutes`.
// Working through UTC getters (instead of local ones) keeps the result
// identical for a viewer in Dhaka and a viewer in New York — the count is a
// property of the couple's calendar, not of whoever happens to be looking.
function toZonedParts(ms, offsetMinutes) {
  const d = new Date(ms + offsetMinutes * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

// Days in a given 1-based month. Day 0 of the NEXT month is the last day of
// this one — the standard idiom, and it gets February/leap years right for free.
function daysInMonth(year, month1) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

// The core calendar breakdown.
//
// Months and days are NOT fixed-length units, so this borrows the way a human
// counts: "the 12th of October to the 5th of March is 4 months and 24 days",
// not 148 days snapped to some average. Seconds borrow from minutes, minutes
// from hours, hours from days, days from the length of the *previous* month of
// the end date, months from years.
export function diffParts(fromMs, toMs, offsetMinutes = START_OFFSET_MINUTES) {
  const from = toZonedParts(fromMs, offsetMinutes);
  const to = toZonedParts(toMs, offsetMinutes);

  let years = to.year - from.year;
  let months = to.month - from.month;
  let days = to.day - from.day;
  let hours = to.hour - from.hour;
  let minutes = to.minute - from.minute;
  let seconds = to.second - from.second;

  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    // Borrow the length of the month before the end month (e.g. going from
    // 31 Jan to 28 Feb borrows 31, so the answer is "28 days", not "-3").
    const borrowMonth = to.month - 1 === 0 ? 12 : to.month - 1;
    const borrowYear = to.month - 1 === 0 ? to.year - 1 : to.year;
    days += daysInMonth(borrowYear, borrowMonth);
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return { years, months, days, hours, minutes, seconds };
}

// Everything the page wants, in one call.
export function getAnniversary(nowMs = Date.now()) {
  const parts = diffParts(START_MS, nowMs);
  const elapsedMs = Math.max(0, nowMs - START_MS);

  const { year: startYear, month: startMonth, day: startDay } = START_DATE_PARTS;
  const startWeekday = new Date(
    Date.UTC(startYear, startMonth - 1, startDay)
  ).getUTCDay();

  // The next month-anniversary (the 12th of next month, 00:00 Dhaka) and the
  // progress through the current month between the two — drives the ring that
  // fills a little more each day.
  const now = toZonedParts(nowMs, START_OFFSET_MINUTES);
  const thisMonthIndex = now.month - 1; // 0-based
  const thisYear = now.year;
  const lastMonthAnniversary =
    Date.UTC(thisYear, thisMonthIndex, startDay) - START_OFFSET_MINUTES * 60_000;
  const nextMonthIndex = thisMonthIndex + 1; // 0-based, may be 12
  const nextMonthAnniversary =
    Date.UTC(thisYear, nextMonthIndex, startDay) -
    START_OFFSET_MINUTES * 60_000;

  const monthSpan = nextMonthAnniversary - lastMonthAnniversary;
  const monthProgress =
    monthSpan > 0
      ? Math.min(1, Math.max(0, (nowMs - lastMonthAnniversary) / monthSpan))
      : 0;

  // Days until the next whole year (the big one — "5 years" is coming).
  const nextYearIndex = thisYear + (now.month > startMonth || (now.month === startMonth && now.day >= startDay) ? 1 : 0);
  const nextYearAnniversary =
    Date.UTC(nextYearIndex, startMonth - 1, startDay) -
    START_OFFSET_MINUTES * 60_000;
  const daysToNextYear = Math.max(
    0,
    Math.ceil((nextYearAnniversary - nowMs) / MS_PER_DAY)
  );

  return {
    ...parts,
    // Coarse totals for the "in other units" strip.
    totalDays: Math.floor(elapsedMs / MS_PER_DAY),
    totalWeeks: Math.floor(elapsedMs / (7 * MS_PER_DAY)),
    totalHours: Math.floor(elapsedMs / MS_PER_HOUR),
    totalMinutes: Math.floor(elapsedMs / MS_PER_MINUTE),
    totalSeconds: Math.floor(elapsedMs / MS_PER_SECOND),
    // The next milestone the couple can look forward to.
    daysToNextYear,
    nextYearCount: nextYearIndex - startYear,
    // 0 → 1 progress through the current month-anniversary to the next.
    monthProgress,
    startWeekdayName: WEEKDAY_NAMES[startWeekday],
    startMonthName: MONTH_NAMES[startMonth - 1],
    startYear,
  };
}

// Pad to at least 2 digits, for the odometer cells.
export function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

// "4 years 11 months" / "1 year 1 month 2 days" — singular-safe, and drops
// trailing zero units so it never says "4 years 0 months 0 days".
export function formatAnniversary(parts) {
  const units = [
    ['year', parts.years],
    ['month', parts.months],
    ['day', parts.days],
    ['hour', parts.hours],
    ['minute', parts.minutes],
    ['second', parts.seconds],
  ];
  const spoken = units
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${value} ${name}${value === 1 ? '' : 's'}`);
  return spoken.length ? spoken.join(' ') : '0 seconds';
}

// A big integer with thousands separators (for total seconds/days).
export function formatNumber(n) {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US');
}
