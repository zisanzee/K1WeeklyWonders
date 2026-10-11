import { useEffect, useRef, useState } from 'react';
import { START_DATE_PARTS, getAnniversary, formatNumber, pad2 } from './anniversary';
import {
  COUNTER_CELLS,
  COUNTER_DAYS_LABEL,
  COUNTER_HEADING,
  COUNTER_MONTH_LABEL,
  COUNTER_SUBLABEL,
  COUNTER_TICK_MS,
  COUNTUP_MS,
  FINALE_FIREWORKS,
  FINALE_MESSAGE,
  HUG_BURST,
  HUG_EMOJI,
  HUG_LABEL,
  HUG_REPLIES,
  MILESTONES_TAIL,
  MILESTONES_TITLE,
  MINUTE_BURST,
  REPLAY_EMOJI,
  REPLAY_LABEL,
  REVEAL_BURST,
  ROCKET_VOLLEY,
  SALVO,
  SECRET_FOUND,
  SECRET_TAPS,
  SECRET_WINDOW_MS,
  UNIT_LABELS,
  unitLabel,
  yearTurnMessage,
} from './config';
import { achievedMilestones } from './milestones';
import { useCountUp, useInView, useMagnetic, useNow } from './hooks';
import { sfx } from './sfx';

// Odometer cells are ELAPSED-since values — a "how long we have had" clock,
// never a countdown. Labels come from ./config.js (COUNTER_CELLS).

// Keyed on its own text so React remounts it on change and the tick replays.
function Cell({ label, value }) {
  return (
    <div className="lv-odo">
      <span key={value} className="lv-odo__value">{pad2(value)}</span>
      <span className="lv-odo__label">{label}</span>
    </div>
  );
}

// The closing act. Owns a 1 Hz clock and derives everything from anniversary.js.
//
// UPGRADE:
//  - the big day count rolls up from zero when the act is first seen
//  - milestone chips for every round number already passed
//  - a secret: tap the ring five times for a heart-shaped firework
//  - reaching the end always triggers the full anniversary send-off (message,
//    rocket volley, fanfare) — this is no longer tied to the live clock ticking
//    a whole year over, so it shows on every visit instead of never
//  - magnetic buttons and a hug chord
export default function Counter({ burstAt, fireworkAt, rocketAt, onReveal, onHug }) {
  const now = useNow(COUNTER_TICK_MS);
  const a = getAnniversary(now);
  const [ref, inView] = useInView({ threshold: 0.35, once: false });
  const [revealed, setRevealed] = useState(false);
  const [hugs, setHugs] = useState(0);
  const [toast, setToast] = useState('');
  const lastMinute = useRef(null);
  const taps = useRef({ n: 0, at: 0 });
  const timers = useRef([]);
  const hugRef = useMagnetic({ strength: 0.3 });
  const replayRef = useMagnetic({ strength: 0.3 });

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const say = (text, ms = 4200) => {
    setToast(text);
    later(() => setToast(''), ms);
  };

  const salvo = (w, h) =>
    Array.from({ length: SALVO.count }, (_, i) => i).forEach((i) =>
      later(
        () =>
          fireworkAt?.(
            w * (0.2 + 0.2 * i),
            h * (0.2 + (i % 2) * 0.13),
            i === 1 ? 'heart' : undefined
          ),
        i * SALVO.staggerMs
      )
    );

  // First sighting: the full anniversary send-off. Deliberately NOT bound to the
  // live clock — reaching the end of the story always gets the message, the
  // rocket volley and the fanfare. (It used to fire only if the page happened to
  // be open the exact instant a whole year ticked over, so it almost never did.)
  //
  // This is also the ONLY burst of rockets on the act: there used to be a
  // separate 4.2 s `setInterval` firing a rocket/firework forever while she
  // looked at the ending. Each one ended in `sfx.boom()`, so it read as a drum
  // beating endlessly over a screen that (on low-power devices) showed nothing.
  // One send-off is a celebration; a loop was a metronome.
  useEffect(() => {
    if (!inView || revealed) return;
    setRevealed(true);
    onReveal?.();
    sfx.fanfare();
    say(yearTurnMessage(), 9000);
    const w = window.innerWidth;
    const h = window.innerHeight;
    burstAt?.(w / 2, h * 0.72, REVEAL_BURST);
    salvo(w, h);
    for (let i = 0; i < ROCKET_VOLLEY.count; i += 1) {
      later(
        () =>
          rocketAt?.(
            w * (0.1 + Math.random() * 0.8),
            h * (0.14 + Math.random() * 0.3),
            i % 3 === 0 ? 'heart' : 'peony'
          ),
        i * ROCKET_VOLLEY.staggerMs
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, revealed, onReveal, burstAt]);

  // The sky keeps going after the send-off, so the ending lingers instead of
  // dying in one volley. Fires every FINALE_FIREWORKS.intervalMs for
  // FINALE_FIREWORKS.durationMs, then stops itself — a celebration, not the old
  // endless metronome. Only while the ending is on screen.
  useEffect(() => {
    if (!inView || !revealed) return undefined;
    let n = 0;
    const stopAt = Date.now() + FINALE_FIREWORKS.durationMs;
    const id = setInterval(() => {
      if (Date.now() >= stopAt) {
        clearInterval(id);
        return;
      }
      n += 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = w * (0.12 + Math.random() * 0.76);
      const y = h * (0.12 + Math.random() * 0.34);
      const kind = n % FINALE_FIREWORKS.heartEvery === 0 ? 'heart' : 'peony';
      if (n % FINALE_FIREWORKS.rocketEvery === 0) rocketAt?.(x, y, kind);
      else fireworkAt?.(x, y, kind);
    }, FINALE_FIREWORKS.intervalMs);
    return () => clearInterval(id);
  }, [inView, revealed, fireworkAt, rocketAt]);

  // A small burst on every whole minute together.
  useEffect(() => {
    if (lastMinute.current === null) {
      lastMinute.current = a.minutes;
      return;
    }
    if (lastMinute.current !== a.minutes) {
      lastMinute.current = a.minutes;
      sfx.chime(a.minutes % 10, 0.08);
      burstAt?.(window.innerWidth / 2, window.innerHeight * 0.7, MINUTE_BURST);
    }
  }, [a.minutes, burstAt]);

  const hug = () => {
    setHugs((n) => n + 1);
    onHug?.();
    sfx.hug();
    burstAt?.(window.innerWidth / 2, window.innerHeight * 0.62, HUG_BURST);
    salvo(window.innerWidth, window.innerHeight);
    rocketAt?.(window.innerWidth / 2, window.innerHeight * 0.22, 'heart');
    try {
      navigator.vibrate?.([20, 40, 20, 40, 60]);
    } catch {
      /* optional */
    }
  };

  const replay = () => {
    document.getElementById('root')?.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The secret: five taps on the ring inside two seconds.
  const onRingTap = (event) => {
    const t = taps.current;
    const stamp = performance.now();
    t.n = stamp - t.at < SECRET_WINDOW_MS ? t.n + 1 : 1;
    t.at = stamp;
    sfx.chime(t.n * 2, 0.12);
    const r = event.currentTarget.getBoundingClientRect();
    burstAt?.(r.left + r.width / 2, r.top + r.height / 2, { count: 8 + t.n * 4, power: 0.6 + t.n * 0.15 });
    if (t.n >= SECRET_TAPS) {
      t.n = 0;
      sfx.fanfare();
      fireworkAt?.(r.left + r.width / 2, r.top - 20, 'heart');
      later(() => fireworkAt?.(r.left, r.top + r.height * 0.4, 'heart'), 220);
      later(() => fireworkAt?.(r.right, r.top + r.height * 0.4, 'heart'), 440);
      say(SECRET_FOUND, 3600);
    }
  };

  // The big number rolls up from zero on first sight, then tracks the live value.
  const shownDays = useCountUp(a.totalDays, revealed, COUNTUP_MS);
  const monthPct = Math.round(a.monthProgress * 100);
  const milestones = achievedMilestones(a);

  return (
    <section className="lv-act" ref={ref}>
      <h2 className="lv-act__title lv-grad">{COUNTER_HEADING}</h2>
      <p className="lv-eyebrow" style={{ letterSpacing: '0.24em' }}>{COUNTER_SUBLABEL}</p>
      <p className="lv-datebig lv-grad">
        {a.startWeekdayName}, {START_DATE_PARTS.day} {a.startMonthName} {a.startYear}
      </p>

      {/* The days figure, wrapped in a ring that fills through this month of us,
          with a glowing spark riding its edge. */}
      <div className="lv-daysring" onClick={onRingTap}>
        <svg className="lv-daysring__svg" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="lv-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="60%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <circle className="lv-daysring__bg" cx="60" cy="60" r="54" />
          <circle
            className="lv-daysring__fg"
            cx="60"
            cy="60"
            r="54"
            pathLength="1"
            style={{ strokeDashoffset: 1 - a.monthProgress }}
          />
        </svg>
        <span className="lv-daysring__orbit" aria-hidden="true" style={{ '--a': `${a.monthProgress * 360}deg` }} />
        <div className="lv-daysring__core">
          <span className="lv-daysring__n lv-grad" aria-label={`${formatNumber(a.totalDays)} days`}>
            {formatNumber(shownDays)}
          </span>
          <span className="lv-eyebrow" style={{ letterSpacing: '0.24em' }}>
            {a.totalDays === 1 ? COUNTER_DAYS_LABEL.one : COUNTER_DAYS_LABEL.many}
          </span>
        </div>
      </div>
      <p className="lv-ringnote">{COUNTER_MONTH_LABEL} · {monthPct}%</p>

      <p className="lv-since">
        <span aria-hidden="true">💞</span>
        {a.years} {unitLabel(a.years, 'year')} · {a.months} {unitLabel(a.months, 'month')} ·{' '}
        {a.days} {unitLabel(a.days, 'day')}
      </p>

      <div className="lv-odometer">
        {COUNTER_CELLS.map((cell) => (
          <Cell key={cell.key} label={cell.label} value={a[cell.key]} />
        ))}
      </div>

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

      {milestones.length > 0 && (
        <div className="lv-miles-wrap">
          <p className="lv-eyebrow" style={{ letterSpacing: '0.2em' }}>{MILESTONES_TITLE}</p>
          <ul className={`lv-miles${revealed ? ' is-in' : ''}`}>
            {milestones.map((m, i) => (
              <li key={m.id} className="lv-mile" style={{ '--i': i }}>
                <span aria-hidden="true">{m.emoji}</span> {m.label}
              </li>
            ))}
            <li className="lv-mile lv-mile--tail" style={{ '--i': milestones.length }}>
              {MILESTONES_TAIL}
            </li>
          </ul>
        </div>
      )}

      <p className="lv-finale lv-grad">{FINALE_MESSAGE}</p>

      <div className="lv-actions">
        <button type="button" className="lv-btn" onClick={hug} ref={hugRef}>
          <span aria-hidden="true">{HUG_EMOJI}</span>
          {HUG_LABEL}
        </button>
        <button type="button" className="lv-btn lv-btn--soft" onClick={replay} ref={replayRef}>
          <span aria-hidden="true">{REPLAY_EMOJI}</span>
          {REPLAY_LABEL}
        </button>
      </div>
      <p className="lv-hugnote" key={hugs} aria-live="polite">
        {hugs > 0 ? HUG_REPLIES[(hugs - 1) % HUG_REPLIES.length] : ''}
      </p>

      {toast && (
        <p className="lv-toast" key={toast} role="status">
          {toast}
        </p>
      )}
    </section>
  );
}
