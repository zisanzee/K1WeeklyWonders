// PhaserGame.jsx
import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import PreloadScene from './PreloadScene';
import NumberOrderScene from './NumberOrderScene';
import { logPlaySession } from '../logPlaySession';

export default function PhaserGame({ playerName }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  // The completion handler is registered once, inside the mount effect
  // below, so it closes over whatever `playerName` was at that instant.
  // Reading it through a ref instead means a later re-render with a new
  // name still logs correctly, without needing to tear down and recreate
  // the whole Phaser game just to rebind one listener.
  const playerNameRef = useRef(playerName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

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
        //
        // Deliberately NOT setting a custom `resolution` (devicePixelRatio)
        // multiplier here: combined with Scale.FIT, that's a known source of
        // the DOM-pointer-to-game-coordinate mapping drifting out of sync
        // with what's actually drawn — buttons render in the right place,
        // but taps land as if they were somewhere else. The 720x960 base
        // resolution already gives plenty of sharpness on its own.
        width: 720,
        height: 960,
        backgroundColor: '#8fe0fa',
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 0 }, debug: false },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [PreloadScene, NumberOrderScene],
      });

      // One log per finished run — the scene emits this exactly once, right
      // when the 10th bubble pops in order (see showComplete() in
      // NumberOrderScene.js). "Play again" calls scene.restart(), which
      // runs create() again and can fire a fresh 'numberpop-complete' event
      // on its own next finish, so no "already logged" guard is needed here
      // the way the round-based games need one.
      gameRef.current.events.on('numberpop-complete', ({ elapsedSeconds, mistakes }) => {
        logPlaySession({
          game: 'bonusGame1',
          playerName: playerNameRef.current || 'Guest',
          stars: 1,
          totalRounds: 1,
          elapsedSeconds,
          mistakes,
        });
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
      gameRef.current?.events.off('numberpop-complete');
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