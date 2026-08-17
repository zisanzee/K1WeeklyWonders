// RotateHint.jsx
// Full-screen reminder shown only on touch devices (phones/tablets) while the
// device is in landscape. Disappears automatically once the screen is rotated
// back to portrait. Uses a coarse-pointer/touch check rather than UA sniffing.
import { useEffect, useState } from 'react';

export default function RotateHint() {
  const [isTouch, setIsTouch] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    setIsTouch(
      navigator.maxTouchPoints > 0 ||
        'ontouchstart' in window ||
        window.matchMedia('(pointer: coarse)').matches
    );

    const mql = window.matchMedia('(orientation: landscape)');
    const update = () => setIsLandscape(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  if (!isTouch || !isLandscape) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-slate-900/90 px-6 text-center backdrop-blur-sm">
      {/* Rotating tablet — starts wide (landscape) and rocks to vertical to
          hint at rotating the device. */}
      <div className="rotate-hint h-16 w-24 rounded-2xl border-4 border-white/90 bg-white/10 p-1.5 shadow-[0_0_50px_rgba(255,255,255,0.3)]">
        <div className="h-full w-full rounded-lg bg-white/20" />
      </div>

      <p className="max-w-xs text-3xl font-extrabold leading-tight text-white drop-shadow">
        Rotate the screen for best experience.
      </p>

      <style>{`
        @keyframes rotate-hint {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(90deg); }
          100% { transform: rotate(0deg); }
        }
        .rotate-hint { animation: rotate-hint 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
