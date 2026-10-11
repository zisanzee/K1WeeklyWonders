import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HOLD_BEATS,
  HOLD_DONE_MESSAGE,
  HOLD_DRAIN_PER_SEC,
  HOLD_EMOJI_DONE,
  HOLD_EMOJI_IDLE,
  HOLD_EYEBROW,
  HOLD_FULL_LABEL,
  HOLD_HEADING,
  HOLD_MS,
  HOLD_SPARK_EVERY_MS,
  HOLD_STAGES,
  HOLD_SUBLABEL,
  HOLD_VIBRATE_FINISH,
  HOLD_VIBRATE_TICK,
} from './config';

// HoldGate — the opening ritual. Nothing else is on screen until the heart is
// genuinely held to full.
//
// FIX: the previous loop captured `holding` in a useCallback closure, so the
// running rAF kept calling a stale frame with holding=false and the heart could
// drain instead of fill. The loop now reads `holdingRef`, which never goes stale.
//
// UPGRADE: a ring meter, sparks that grow as it fills, haptic ticks, a heart that
// glows and trembles with progress, status lines, and a bloom + fireworks finale
// before the gate dissolves into the story.
const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported — purely a bonus */
  }
};

const stageLabel = (progress) => {
  let label = HOLD_SUBLABEL;
  for (const [at, text] of HOLD_STAGES) if (progress >= at) label = text;
  return label;
};

export default function HoldGate({ onComplete, burstAt, fireworkAt }) {
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle → done → leaving
  const [holding, setHolding] = useState(false);

  const progressRef = useRef(0);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const sparkRef = useRef(0);
  const stepRef = useRef(0);
  const timersRef = useRef([]);
  const heartRef = useRef(null);
  const fillRef = useRef(null);
  const ringRef = useRef(null);

  const propsRef = useRef({});
  propsRef.current = { onComplete, burstAt, fireworkAt };

  const later = useCallback((fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  const center = () => {
    const r = heartRef.current?.getBoundingClientRect();
    return r
      ? [r.left + r.width / 2, r.top + r.height / 2]
      : [window.innerWidth / 2, window.innerHeight * 0.42];
  };

  const paint = useCallback((value) => {
    progressRef.current = value;
    heartRef.current?.style.setProperty('--lv-progress', value.toFixed(4));
    if (fillRef.current) fillRef.current.style.width = `${value * 100}%`;
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(1 - value);
    setPct(Math.round(value * 100));
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    holdingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    paint(1);
    setHolding(false);
    setPhase('done');
    vibrate(HOLD_VIBRATE_FINISH);

    const [x, y] = center();
    const p = propsRef.current;
    p.burstAt?.(x, y, { count: 70, power: 1.7 });
    p.fireworkAt?.(x, y - 90);
    later(() => {
      p.fireworkAt?.(x - 120, y - 20);
      p.fireworkAt?.(x + 120, y - 20);
    }, 260);
    later(() => setPhase('leaving'), 950);
    later(() => propsRef.current.onComplete?.(), 1600);
  }, [later, paint]);

  const tick = useCallback(
    (now) => {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      const hold = holdingRef.current;
      const raw = progressRef.current + (hold ? (dt * 1000) / HOLD_MS : -dt * HOLD_DRAIN_PER_SEC);
      const next = Math.max(0, Math.min(1, raw));
      paint(next);

      const step = Math.floor(next * HOLD_BEATS);
      if (hold) {
        if (step > stepRef.current) vibrate(HOLD_VIBRATE_TICK);
        if (now - sparkRef.current > HOLD_SPARK_EVERY_MS) {
          sparkRef.current = now;
          const [x, y] = center();
          propsRef.current.burstAt?.(x, y, {
            count: 1 + Math.floor(next * 4),
            power: 0.3 + next * 0.5,
          });
        }
      }
      stepRef.current = step;

      if (next >= 1) {
        finish();
        return;
      }
      if (!hold && next <= 0) {
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [finish, paint]
  );

  const ensureLoop = useCallback(() => {
    if (rafRef.current || doneRef.current) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const start = useCallback(() => {
    if (doneRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    ensureLoop();
  }, [ensureLoop]);

  const release = useCallback(() => {
    if (doneRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    ensureLoop();
  }, [ensureLoop]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      timersRef.current.forEach(clearTimeout);
    },
    []
  );

  const onKeyDown = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) start();
  };
  const onKeyUp = (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      release();
    }
  };

  const done = phase !== 'idle';

  return (
    <div className={`lv-gate${done ? ' is-done' : ''}${phase === 'leaving' ? ' is-leaving' : ''}`}>
      <span className="lv-gate__bloom" aria-hidden="true" />
      <div className="lv-gate__inner">
        <p className="lv-eyebrow">{HOLD_EYEBROW}</p>

        <div className="lv-gate__stage">
          <span className="lv-gate__ring" aria-hidden="true" />
          <svg className="lv-gate__meter" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="lv-meter-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="55%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#c4b5fd" />
              </linearGradient>
            </defs>
            <circle className="lv-gate__meter-bg" cx="50" cy="50" r="46" />
            <circle ref={ringRef} className="lv-gate__meter-fg" cx="50" cy="50" r="46" pathLength="1" />
          </svg>

          <button
            type="button"
            ref={heartRef}
            className={`lv-heart${holding ? ' is-held' : ''}${done ? ' is-beating' : ''}`}
            style={{ '--lv-progress': 0 }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              start();
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            aria-label={HOLD_HEADING}
          >
            <span className="lv-heart__body" aria-hidden="true">
              <span className="lv-heart__lobe lv-heart__lobe--l" />
              <span className="lv-heart__lobe lv-heart__lobe--r" />
              <span className="lv-heart__point" />
            </span>
            <span className="lv-heart__fill" aria-hidden="true" />
            <span className="lv-heart__gloss" aria-hidden="true" />
            <span className="lv-heart__inner">
              <span className="lv-heart__emoji" aria-hidden="true">
                {done ? HOLD_EMOJI_DONE : HOLD_EMOJI_IDLE}
              </span>
              <span className="lv-heart__label">{done ? HOLD_FULL_LABEL : `${pct}%`}</span>
            </span>
          </button>
        </div>

        <div className="lv-gate__track" aria-hidden="true">
          <div className="lv-gate__fill" ref={fillRef} />
        </div>

        <p className="lv-gate__hint" aria-live="polite">
          {done ? HOLD_DONE_MESSAGE : stageLabel(pct / 100)}
        </p>
      </div>
    </div>
  );
}
