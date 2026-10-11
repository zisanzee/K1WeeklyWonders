import { useEffect, useRef, useState } from 'react';

const isCoarse = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// useInView — reports whether the element has entered the viewport.
// Falls back to "always in view" where IntersectionObserver is missing, so
// nothing can stay invisible.
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
// Writes the rotation and the glint origin straight onto the node as custom
// properties so a moving pointer never triggers a React render. Disabled on
// coarse pointers, where a tilt would only fight the touch scroll.
export function useTilt({ max = 12 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (isCoarse()) return undefined;

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

// useSavedFlag — a tiny localStorage-backed boolean. Never throws in private mode.
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

// useScrollProgress — writes the whole page's scroll fraction to `--lv-page`.
// Captures scroll at the document so it works whether the window or an inner
// container (#root) is the scroller. DOM writes only, no React state.
export function useScrollProgress(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = (event) => {
      const t = event.target.scrollingElement || event.target;
      const max = (t.scrollHeight || 0) - (t.clientHeight || 0);
      el.style.setProperty('--lv-page', max > 0 ? (t.scrollTop / max).toFixed(4) : '0');
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [ref]);
}

// usePointerLight — a soft pink light that follows the cursor, AND a parallax
// signal for the whole page: the pointer position (-1..1) is written to
// `--lv-px` / `--lv-py` on the parent (the story root), where the CSS uses it to
// slide the backdrop layers by different amounts. On phones with a gyroscope the
// tilt of the device drives the same two variables instead, so the page leans
// as she tilts it.
export function usePointerLight(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const root = el.parentElement || el;
    const clamp = (n) => Math.max(-1, Math.min(1, n));
    const setParallax = (nx, ny) => {
      root.style.setProperty('--lv-px', nx.toFixed(3));
      root.style.setProperty('--lv-py', ny.toFixed(3));
    };

    if (isCoarse()) {
      // Android and desktop-class browsers allow orientation events outright;
      // iOS demands a permission prompt, which we never trigger — it just stays
      // still there.
      const D = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
      if (!D || typeof D.requestPermission === 'function') return undefined;
      const onTilt = (e) => {
        if (e.gamma == null || e.beta == null) return;
        setParallax(clamp(e.gamma / 28), clamp((e.beta - 50) / 28));
      };
      window.addEventListener('deviceorientation', onTilt, { passive: true });
      return () => window.removeEventListener('deviceorientation', onTilt);
    }

    const onMove = (event) => {
      el.style.setProperty('--cx', `${event.clientX}px`);
      el.style.setProperty('--cy', `${event.clientY}px`);
      el.style.opacity = '1';
      setParallax(
        clamp((event.clientX / window.innerWidth) * 2 - 1),
        clamp((event.clientY / window.innerHeight) * 2 - 1)
      );
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [ref]);
}

// useCountUp — eases a number from 0 up to `target` once `active` turns true,
// then simply follows the live value. Respects reduced motion (jumps straight
// to the target).
export function useCountUp(target, active, durationMs = 2400) {
  const [value, setValue] = useState(0);
  const doneRef = useRef(false);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (!active || doneRef.current) return undefined;
    if (prefersReducedMotion()) {
      doneRef.current = true;
      setValue(targetRef.current);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - k) ** 4;
      setValue(Math.floor(targetRef.current * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else doneRef.current = true;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  if (!active) return 0;
  return doneRef.current ? target : value;
}

// useMagnetic — a button that leans toward the pointer as it approaches.
// Uses the `translate` property so it never fights a transform on the same node.
//
// The pull is CLAMPED to `maxOffset` on each axis. Unclamped, two side-by-side
// buttons each drifted by (distance × strength), which exceeds the flex gap, so
// they slid across each other and overlapped — `translate` reserves no layout
// space, so nothing stopped the collision. Bounding the travel to half the gap
// (see .lv-actions in love-extras.css) makes overlap geometrically impossible.
export function useMagnetic({ strength = 0.28, radius = 110, maxOffset = 9 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || isCoarse()) return undefined;
    const clamp = (n) => Math.max(-maxOffset, Math.min(maxOffset, n));
    const onMove = (event) => {
      const r = el.getBoundingClientRect();
      const dx = event.clientX - (r.left + r.width / 2);
      const dy = event.clientY - (r.top + r.height / 2);
      const reach = radius + Math.max(r.width, r.height) / 2;
      el.style.translate =
        Math.hypot(dx, dy) < reach ? `${clamp(dx * strength)}px ${clamp(dy * strength)}px` : '';
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      el.style.translate = '';
    };
  }, [strength, radius, maxOffset]);

  return ref;
}
