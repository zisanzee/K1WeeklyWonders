import { useEffect, useMemo, useState } from 'react';

// Confetti — a one-shot burst of falling pieces, used by the counter reveal.
//
// It spawns `count` pieces once (randomised position, delay, drift, spin and
// colour via CSS custom properties), animates them entirely in CSS, then removes
// the whole layer after `durationMs` so it can never linger in the DOM.
const COLORS = ['#fb7185', '#f472b6', '#e879f9', '#c4b5fd', '#fda4af', '#fbcfe8'];

export default function Confetti({ count = 80, durationMs = 5600 }) {
  const [visible, setVisible] = useState(true);

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.1,
        duration: 2.6 + Math.random() * 2.4,
        drift: `${(Math.random() - 0.5) * 260}px`,
        spin: `${Math.random() * 900 - 450}deg`,
        color: COLORS[i % COLORS.length],
        round: Math.random() < 0.3,
      })),
    [count]
  );

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(id);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="lv-confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="lv-confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            borderRadius: p.round ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--lv-drift': p.drift,
            '--lv-spin': p.spin,
          }}
        />
      ))}
    </div>
  );
}
