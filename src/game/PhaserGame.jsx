import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import NumberOrderScene from './NumberOrderScene';

export default function PhaserGame() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;
    let cancelled = false;

    const start = () => {
      if (cancelled || gameRef.current) return;
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        // 3:4 base resolution. Scale.FIT then scales this to whatever size
        // the CSS container ends up at (see the wrapper div's className
        // below), so the actual on-screen size is driven by that container,
        // not this number — but a bigger base resolution means Phaser is
        // scaling *down* into most containers instead of stretching a small
        // canvas up, which is why things look noticeably crisper.
        width: 720,
        height: 960,
        // Multiplies the canvas's backing-store resolution by the device's
        // pixel ratio (capped at 2 — going higher rarely helps and costs
        // real GPU/memory on older phones, which is exactly the hardware we
        // most need this to run smoothly on).
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: '#8fe0fa',
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 0 }, debug: false },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [NumberOrderScene],
      });
    };

    // Wait for Fredoka/Nunito to finish loading so the first frame of text
    // doesn't briefly render in a fallback font before the webfont swaps in.
    if (document.fonts?.ready) {
      document.fonts.ready.then(start);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="relative mx-auto w-[min(94vw,46rem,calc(75dvh*3/4))]">
      {/* Soft glow behind the frame — cheap (one blurred div, no animation
          cost) but reads as much more "designed" than a bare canvas. */}
      <div className="pointer-events-none absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-white/50 via-yellow-100/40 to-sky-200/50 blur-xl" />
      <div
        ref={containerRef}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] border-[6px] border-white/80 shadow-2xl ring-4 ring-white/30"
      />
    </div>
  );
}