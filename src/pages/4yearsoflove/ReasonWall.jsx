import { useCallback, useEffect, useState } from 'react';
import {
  REASONS,
  REASONS_DONE,
  REASONS_SUBTITLE,
  REASONS_TAP_HINT,
  REASONS_TITLE,
  reasonsKeptLabel,
} from './config';
import { useInView } from './hooks';
import { sfx } from './sfx';

// One reason. It reveals when it enters the viewport, pops a few hearts from its
// corner and rings a note (each reason a step higher on the scale), reports
// itself to the wall, and is lit by a spotlight that follows the pointer.
//
// UPGRADE: the card now tilts in 3D toward the pointer, and can be TAPPED to
// "keep" it — it lights up, bursts hearts and a bigger chime, and the wall
// counts how many she has kept.
function Reason({ reason, index, onSeen, onLove, burstAt }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const [loved, setLoved] = useState(false);

  useEffect(() => {
    if (!inView) return;
    onSeen?.(index + 1);
    sfx.chime(index, 0.07);
    const r = ref.current?.getBoundingClientRect();
    if (r) burstAt?.(r.right - 34, r.top + 34, { count: 7, power: 0.5 });
  }, [inView, index, onSeen, burstAt, ref]);

  const onMove = (event) => {
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${event.clientX - r.left}px`);
    el.style.setProperty('--my', `${event.clientY - r.top}px`);
    el.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
  };
  const onLeave = (event) => {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
  };

  const toggle = (event) => {
    const next = !loved;
    setLoved(next);
    onLove?.(next);
    if (next) {
      const r = event.currentTarget.getBoundingClientRect();
      burstAt?.(r.left + r.width / 2, r.top + r.height / 2, { count: 26, power: 1 });
      sfx.chime(index + 5, 0.16);
      sfx.sparkle();
    } else {
      sfx.pop();
    }
  };

  return (
    <article
      ref={ref}
      className={`lv-reason${inView ? ' is-in' : ''}${loved ? ' is-loved' : ''}`}
      style={{ transitionDelay: `${(index % 2) * 90}ms` }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-pressed={loved}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle(e);
        }
      }}
    >
      <span className="lv-reason__num" aria-hidden="true">{index + 1}</span>
      <span>
        <span className="lv-reason__kind">{reason.kind}</span>
        <span className="lv-reason__text">{reason.text}</span>
      </span>
      <span className="lv-reason__emoji" aria-hidden="true">{reason.emoji}</span>
      <span className="lv-reason__love" aria-hidden="true">♥</span>
    </article>
  );
}

export default function ReasonWall({ burstAt }) {
  const [seen, setSeen] = useState(0);
  const [kept, setKept] = useState(0);
  const onSeen = useCallback((n) => setSeen((s) => Math.max(s, n)), []);
  const onLove = useCallback((on) => setKept((k) => Math.max(0, k + (on ? 1 : -1))), []);
  const total = REASONS.length;

  return (
    <section className="lv-act">
      <h2 className="lv-act__title lv-grad">{REASONS_TITLE}</h2>

      {/* A sticky pill that stays with her while she scrolls and counts up. */}
      <div className="lv-hud" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={seen}>
        <span className="lv-hud__text">
          {seen < total ? `${REASONS_SUBTITLE} · ${seen} / ${total}` : `${REASONS_DONE} ♥`}
        </span>
        <span className="lv-hud__bar">
          <span style={{ width: `${(seen / total) * 100}%` }} />
        </span>
        <span className="lv-hud__kept">
          {kept > 0 ? reasonsKeptLabel(kept) : REASONS_TAP_HINT}
        </span>
      </div>

      <div className="lv-reasons">
        {REASONS.map((reason, index) => (
          <Reason
            key={reason.kind}
            reason={reason}
            index={index}
            onSeen={onSeen}
            onLove={onLove}
            burstAt={burstAt}
          />
        ))}
      </div>
    </section>
  );
}
