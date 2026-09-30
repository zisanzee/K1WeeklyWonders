import { useEffect, useRef, useState } from 'react';
import { getAnniversary, formatNumber, pad2 } from './anniversary';
import { COUNTER_HEADING, COUNTER_SUBLABEL, FINALE_MESSAGE, UNIT_LABELS } from './content';
import { useInView, useNow } from './hooks';

// The four live cells. All of them are ELAPSED-since values — this is a "how long
// we have had" clock, not a countdown to anything.
const CELLS = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
];

// A single odometer cell. The value node is keyed on its own text, so React
// remounts it whenever the number changes and the tick animation replays.
function Cell({ label, value }) {
  return (
    <div className="lv-odo">
      <span key={value} className="lv-odo__value">
        {pad2(value)}
      </span>
      <span className="lv-odo__label">{label}</span>
    </div>
  );
}

// The closing act. Owns its own 1 Hz clock, derives everything from the pure
// module in anniversary.js, and fires the confetti exactly once — when the
// counter is first scrolled into view.
export default function Counter({ burstAt, onReveal }) {
  const now = useNow(1000);
  const a = getAnniversary(now);
  const [ref, inView] = useInView({ threshold: 0.35 });
  const [revealed, setRevealed] = useState(false);
  const lastMinute = useRef(null);

  // The first time the counter is actually seen: tell the page (which arms the
  // confetti) and fire a heart burst. This is the page's ending, so it is
  // deliberately the biggest single effect.
  useEffect(() => {
    if (!inView || revealed) return;
    setRevealed(true);
    onReveal?.();
    burstAt?.(window.innerWidth / 2, window.innerHeight * 0.72, {
      count: 70,
      power: 1.5,
    });
  }, [inView, revealed, onReveal, burstAt]);

  // A small burst on every whole minute together — frequent enough to feel
  // alive, rare enough not to be noise.
  useEffect(() => {
    if (lastMinute.current === null) {
      lastMinute.current = a.minutes;
      return;
    }
    if (lastMinute.current !== a.minutes) {
      lastMinute.current = a.minutes;
      burstAt?.(window.innerWidth / 2, window.innerHeight * 0.7, {
        count: 10,
        power: 0.7,
      });
    }
  }, [a.minutes, burstAt]);

  return (
    <section className="lv-act" ref={ref}>
      <h2 className="lv-act__title lv-grad">{COUNTER_HEADING}</h2>
      <p className="lv-eyebrow" style={{ letterSpacing: '0.24em' }}>
        {COUNTER_SUBLABEL}
      </p>

      {/* The single figure that says it all, biggest and first. */}
      <p
        className="lv-grad"
        style={{
          fontSize: 'clamp(2.4rem, 12vw, 5rem)',
          fontWeight: 700,
          lineHeight: 1.05,
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatNumber(a.totalDays)}
      </p>
      <p className="lv-eyebrow" style={{ letterSpacing: '0.24em', marginTop: '-0.4rem' }}>
        {a.totalDays === 1 ? 'day together' : 'days together'}
      </p>

      {/* Everything above the days, spelled out. */}
      <p className="lv-since">
        <span aria-hidden="true">💞</span>
        {a.years} {a.years === 1 ? 'year' : 'years'} · {a.months}{' '}
        {a.months === 1 ? 'month' : 'months'} · {a.days} {a.days === 1 ? 'day' : 'days'}
      </p>

      <div className="lv-odometer">
        {CELLS.map((cell) => (
          <Cell key={cell.key} label={cell.label} value={a[cell.key]} />
        ))}
      </div>

      {/* Totals, for the "just how much is that" curiosity. */}
      <div className="lv-units">
        <span className="lv-unit">
          <span className="lv-unit__n">{formatNumber(a.totalHours)}</span>
          <span className="lv-unit__k">{UNIT_LABELS.hours}</span>
        </span>
        <span className="lv-unit">
          <span className="lv-unit__n">{formatNumber(a.totalMinutes)}</span>
          <span className="lv-unit__k">{UNIT_LABELS.minutes}</span>
        </span>
        <span className="lv-unit">
          <span className="lv-unit__n">{formatNumber(a.totalSeconds)}</span>
          <span className="lv-unit__k">{UNIT_LABELS.seconds}</span>
        </span>
      </div>

      <p className="lv-finale lv-grad">{FINALE_MESSAGE}</p>
    </section>
  );
}
