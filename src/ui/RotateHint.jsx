// RotateHint.jsx
// Full-screen reminder shown only on real phones/tablets while the device is
// in landscape. Disappears automatically once the screen is rotated back to
// portrait, or when the user dismisses it with the close button.
import { useEffect, useState } from 'react';

// Primary-input checks distinguish genuine phones/tablets (coarse pointer with
// no hover) from laptops that expose touch points but still use a
// mouse/trackpad as their primary pointer.
function isMobileOrTablet() {
  if (navigator.userAgentData?.mobile !== undefined) {
    return navigator.userAgentData.mobile;
  }
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  if (coarsePointer && noHover) return true;
  // iPadOS Safari and some older devices report desktop-ish user agents
  // while still being touch-only.
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|Silk|BlackBerry|PlayBook/i.test(
    navigator.userAgent
  );
}

export default function RotateHint() {
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileOrTablet());

    const mql = window.matchMedia('(orientation: landscape)');
    const update = () => setIsLandscape(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Once the device returns to portrait, forget a manual dismissal so the
  // hint can warn again if the user rotates back.
  useEffect(() => {
    if (!isLandscape) setDismissed(false);
  }, [isLandscape]);

  if (!isMobile || !isLandscape || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-slate-900/90 px-6 text-center backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close rotate hint"
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl font-bold text-white transition hover:bg-white/20"
      >
        ✕
      </button>

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
