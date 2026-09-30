import { useCallback, useEffect, useRef, useState } from 'react';
import { HOLD_DONE_MESSAGE, HOLD_HEADING, HOLD_SUBLABEL } from './content';

// HoldGate — the whole opening. The ONLY thing on screen until the heart is
// genuinely held to full.
//
// This is a real press-and-hold, not a click: progress fills while a pointer (or
// space/enter) is down and drains the moment it is released, over ~2.6s. That
// happened wrong before — the animation only ever ran on press, so a single tap
// filled it — which is exactly the bug this replaced.
//
// The fill loop is driven by requestAnimationFrame and writes the heart's
// `--lv-progress` and the meter's width straight onto the DOM. React state holds
// only the integer percentage, and only for the label, so a 60fps fill never
// re-renders the tree.
const HOLD_MS = 2600;
const DRAIN_PER_SEC = 1.7; // how fast it empties when released (progress/second)
const TICK_STEP = 0.07; // minimum visible step for a repeated key press

export default function HoldGate({ onComplete, burstAt }) {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [holding, setHolding] = useState(false);

  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const heartRef = useRef(null);
  const fillRef = useRef(null);
  const doneRef = useRef(false);

  // Latest callbacks without re-creating the loop.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const burstRef = useRef(burstAt);
  burstRef.current = burstAt;

  const paint = useCallback((value) => {
    progressRef.current = value;
    heartRef.current?.style.setProperty('--lv-progress', String(value));
    if (fillRef.current) fillRef.current.style.width = `${value * 100}%`;
    setPct(Math.round(value * 100));
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const frame = useCallback(
    (now) => {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      const target = holding ? progressRef.current + (dt * 1000) / HOLD_MS : progressRef.current - dt * DRAIN_PER_SEC;
      const next = Math.max(0, Math.min(1, target));
      paint(next);

      if (next >= 1) {
        stop();
        if (!doneRef.current) {
          doneRef.current = true;
          setDone(true);
          setHolding(false);
          burstRef.current?.(
            window.innerWidth / 2,
            window.innerHeight * 0.42,
            { count: 64, power: 1.6 }
          );
          // Let the "filled" state be seen for a beat before the story takes over.
          setTimeout(() => completeRef.current?.(), 720);
        }
        return;
      }

      // Nothing left to animate once it has drained back to empty and released.
      if (!holding && next <= 0) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    },
    [holding, paint, stop]
  );

  const ensureLoop = useCallback(() => {
    if (!rafRef.current && !doneRef.current) {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  const start = useCallback(() => {
    if (doneRef.current) return;
    setHolding(true);
    ensureLoop();
  }, [ensureLoop]);

  const release = useCallback(() => {
    if (doneRef.current) return;
    setHolding(false);
    ensureLoop();
  }, [ensureLoop]);

  useEffect(() => () => stop(), [stop]);

  // Keyboard: space/enter. Held-down keys repeat, and each repeat nudges the
  // progress, so the hold is genuinely achievable without a pointer.
  const onKeyDown = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat) {
      // A repeat is a nudge rather than a fresh start — start() is idempotent.
      if (progressRef.current < 1) {
        paint(Math.min(1, progressRef.current + TICK_STEP));
        if (progressRef.current >= 1 && !doneRef.current) {
          doneRef.current = true;
          setDone(true);
          burstRef.current?.(window.innerWidth / 2, window.innerHeight * 0.42, { count: 64, power: 1.6 });
          setTimeout(() => completeRef.current?.(), 720);
        }
      }
      return;
    }
    start();
  };
  const onKeyUp = (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      release();
    }
  };

  return (
    <div className="lv-gate">
      <div className="lv-gate__inner">
        <span className="lv-gate__ring" aria-hidden="true" />

        <p className="lv-eyebrow">A little ritual first</p>

        <button
          type="button"
          ref={heartRef}
          className={`lv-heart${holding ? ' is-held' : ''}${done ? ' is-beating' : ''}`}
          style={{ '--lv-progress': 0 }}
          onPointerDown={(e) => {
            // Capture so a finger that slides off the heart still releases it.
            e.currentTarget.setPointerCapture?.(e.pointerId);
            start();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          aria-label={HOLD_HEADING}
        >
          <span className="lv-heart__body" aria-hidden="true">
            <span className="lv-heart__lobe lv-heart__lobe--l" />
            <span className="lv-heart__lobe lv-heart__lobe--r" />
            <span className="lv-heart__point" />
          </span>
          {/* Siblings of the rotated body, so the pouring glow and the highlight
              stay level on screen instead of tilting 45° with the shape. */}
          <span className="lv-heart__fill" aria-hidden="true" />
          <span className="lv-heart__gloss" aria-hidden="true" />
          <span className="lv-heart__inner">
            <span className="lv-heart__emoji" aria-hidden="true">{done ? '💖' : '💗'}</span>
            <span className="lv-heart__label">{done ? 'full' : `${pct}%`}</span>
          </span>
        </button>

        <div className="lv-gate__track" aria-hidden="true">
          <div className="lv-gate__fill" ref={fillRef} />
        </div>

        <p className="lv-gate__hint">{done ? HOLD_DONE_MESSAGE : HOLD_SUBLABEL}</p>
      </div>
    </div>
  );
}
