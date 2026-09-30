import { useEffect, useRef } from 'react';

// useActScroll — drives one scroll-linked act.
//
// The act's outer element is made `sticky` and exactly one viewport tall, while
// a taller "track" element gives it scroll distance. As the track scrolls past,
// this hook measures how far through it we are (0 → 1) and writes that to a
// custom property (`--p`) on the stage, plus calls `onProgress` — all inside a
// requestAnimationFrame loop.
//
// Why a rAF loop and not scroll events: the progress must keep up with momentum
// scrolling, and scroll listeners can fire many times per frame. Reading
// getBoundingClientRect once per frame is cheap and always in sync with what the
// compositor is actually showing. Crucially, the progress goes into CSS
// variables and DOM writes, NEVER React state — a state update per frame would
// re-render the whole subtree 60 times a second.
//
// Returns the ref to put on the STAGE element.
export function useActScroll(trackRef, { onProgress, actKey = 'default' } = {}) {
  const stageRef = useRef(null);
  // Keep the latest callback without re-subscribing the loop.
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return undefined;

    let raf = 0;
    let running = true;
    let current = -1;

    const measure = () => {
      const rect = track.getBoundingClientRect();
      // Scrollable distance inside the track: total height minus the one
      // viewport the sticky stage occupies.
      const distance = rect.height - window.innerHeight;
      const raw = distance > 0 ? -rect.top / distance : 0;
      const p = Math.max(0, Math.min(1, raw));

      // Skip the write when nothing changed to the 4th decimal.
      if (Math.abs(p - current) > 0.0002) {
        current = p;
        stage.style.setProperty('--p', p.toFixed(4));
        progressRef.current?.(p);
      }
      if (running) raf = requestAnimationFrame(measure);
    };

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) {
        current = -1;
        raf = requestAnimationFrame(measure);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', measure);
    raf = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', measure);
    };
    // actKey remounts the measurement when the stage is swapped in/out.
  }, [trackRef, actKey]);

  return stageRef;
}
