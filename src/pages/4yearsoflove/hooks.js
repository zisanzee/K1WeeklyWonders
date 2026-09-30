import { useEffect, useRef, useState } from 'react';

// useNow — a value that updates on an interval while the component is mounted.
// A single shared ticking clock for the counter.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

// useInView — reports whether the element has entered the viewport, once.
// Drives the per-item reveal in the reasons wall. Falls back to "always in view"
// where IntersectionObserver is missing, so nothing can stay invisible.
export function useInView({ threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}

// useTilt — pointer-tracked 3D hover for the envelope and the paper.
//
// Writes the rotation and the glint origin straight onto the node as custom
// properties (--rx/--ry/--sx/--sy/--glint) so a moving pointer never triggers a
// React render. The CSS does the rest: `.lv-tiltable` consumes the two angles
// and `.lv-glint` tracks the two positions.
//
// Disabled on coarse pointers, where there is no hover to track and a tilt
// would only fight the touch scroll.
export function useTilt({ max = 12 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const coarse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (coarse) return undefined;

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
      el.style.setProperty('--sx', `${px * 100}%`);
      el.style.setProperty('--sy', `${py * 100}%`);
      el.style.setProperty('--glint', '1');
    };
    const onLeave = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      // Back to the resting 0.35, not 0 — the shine is meant to be softly
      // present even with no pointer (see the .lv-tiltable comment in love.css).
      el.style.setProperty('--glint', '0.35');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [max]);

  return ref;
}

// useSavedFlag — a tiny localStorage-backed boolean, used for the music toggle
// so her choice survives a refresh. Never throws in private mode.
export function useSavedFlag(key, initial = false) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : raw === '1';
    } catch {
      return initial;
    }
  });

  const update = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      /* storage unavailable — the toggle just won't persist */
    }
  };

  return [value, update];
}
