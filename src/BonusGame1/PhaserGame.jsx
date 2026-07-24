// PhaserGame.jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import PreloadScene from './PreloadScene';
import LevelSelectScene from './LevelSelectScene';
import NumberOrderScene from './NumberOrderScene';
import { logPlaySession } from '../logPlaySession';

// The Phaser canvas is authored at a fixed 720x1080 (2:3) internal
// resolution and scaled to fit its DOM parent via Phaser.Scale.FIT. That
// means every bit of in-game text, button, and bubble is a fixed *internal*
// pixel size — how big any of it actually reads on screen is purely a
// function of how big the CSS box around the canvas is. On phones that box
// was previously sized off a guessed `dvh` formula (min(80dvh*3/4, 98vw))
// which (a) had the wrong multiplier for a 2:3 box — it should be
// `80dvh * 2/3`, not `80dvh * 3/4` — and (b) didn't know how much room the
// number rail / home button above it were actually eating, so it routinely
// overestimated on small screens and got squeezed by the surrounding flex
// layout, rendering everything smaller and harder to read.
//
// Fixing that with more dvh math is still a guess. Instead we measure the
// real available space with a ResizeObserver and compute the largest 2:3
// box that fits inside it — this is correct on any device/orientation
// without needing to know anything about sibling elements' sizes.
const ASPECT_W = 2;
const ASPECT_H = 3;

function fitBox(containerWidth, containerHeight) {
  let w = containerWidth;
  let h = (w * ASPECT_H) / ASPECT_W;
  if (h > containerHeight) {
    h = containerHeight;
    w = (h * ASPECT_W) / ASPECT_H;
  }
  return { width: Math.max(0, Math.floor(w)), height: Math.max(0, Math.floor(h)) };
}

export default function PhaserGame({ playerName }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  // The completion handler is registered once, inside the mount effect
  // below, so it closes over whatever `playerName` was at that instant.
  // Reading it through a ref instead means a later re-render with a new
  // name still logs correctly, without needing to tear down and recreate
  // the whole Phaser game just to rebind one listener.
  const playerNameRef = useRef(playerName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  // Track the wrapper's real available box (whatever the flex layout
  // actually leaves it, on this exact device) and derive the biggest
  // 2:3 game box that fits inside it. Runs on mount, on any resize, and
  // on orientation change — covers phones with dynamic browser chrome.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    const measure = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBoxSize(fitBox(rect.width, rect.height));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    window.addEventListener('orientationchange', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  // Whenever the computed box changes, tell Phaser's ScaleManager to
  // re-read its parent's current size and refit — Scale.FIT recalculates
  // on window resize, but our container can change size (rail collapsing,
  // orientation flip, address bar show/hide) without the window itself
  // firing a resize event.
  useEffect(() => {
    gameRef.current?.scale.refresh();
  }, [boxSize.width, boxSize.height]);

  useEffect(() => {
    if (gameRef.current) return;
    let cancelled = false;

    const start = () => {
      if (cancelled || gameRef.current) return;
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        // 2:3 base resolution. Scale.FIT then scales this to whatever size
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
        // but taps land as if they were somewhere else. The 720x1080 base
        // resolution already gives plenty of sharpness on its own.
        width: 720,
        height: 1080,
        backgroundColor: '#8fe0fa',
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 0 }, debug: false },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [PreloadScene, LevelSelectScene, NumberOrderScene],
      });

      // Fires once per finished level — the scene emits this exactly once,
      // right when a level's final bubble pops in order (see showComplete()
      // in NumberOrderScene.js). With 4 levels now, this can fire up to 4
      // times per visit (once per level cleared), plus again on any replay,
      // so `level`/`levelKey` are included to tell those runs apart. `stars`
      // and `totalRounds` both scale with the level itself — Level 1 sends
      // 1/1, Level 2 sends 2/2, and so on. They have to move together: the
      // server clamps stars to totalRounds, so leaving totalRounds at a
      // flat 1 would silently cap every level's stars back down to 1.
      // "Play again" / "Next Level" both restart or start a scene, which
      // runs create() again and can fire a fresh 'numberpop-complete' event
      // on its own next finish, so no "already logged" guard is needed here
      // the way the round-based games need one.
      gameRef.current.events.on('numberpop-complete', ({ elapsedSeconds, mistakes, level, levelKey, stars, totalRounds }) => {
        logPlaySession({
          game: 'bonusGame1',
          playerName: playerNameRef.current || 'Guest',
          stars,
          totalRounds,
          elapsedSeconds,
          mistakes,
          level,
          levelKey,
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
    <div ref={wrapperRef} className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative"
        style={{
          width: boxSize.width || undefined,
          height: boxSize.height || undefined,
          // Until the first measurement lands, fall back to something
          // reasonable so there's no zero-size flash.
          ...(boxSize.width ? {} : { aspectRatio: '2 / 3', maxWidth: '98%', maxHeight: '98%' }),
        }}
      >
        {/* Soft glow behind the frame — cheap (one blurred div, no animation
            cost) but reads as much more "designed" than a bare canvas. */}
        <div className="pointer-events-none absolute -inset-2 rounded-[2.5rem] bg-gradient-to-br from-white/50 via-yellow-100/40 to-sky-200/50 blur-xl" />
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-[2rem] border-[6px] border-white/80 shadow-2xl ring-4 ring-white/30"
        />
      </div>
    </div>
  );
}
