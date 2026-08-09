// Phaser/BaseGame.jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { createGameConfig, DEFAULT_ASPECT, DEFAULT_BASE_RESOLUTION } from './config';

// The Phaser canvas is authored at a fixed internal resolution (2:3 by
// default) and scaled to fit its DOM parent via Phaser.Scale.FIT. That
// means every bit of in-game text, button, and bubble is a fixed
// *internal* pixel size — how big any of it actually reads on screen is
// purely a function of how big the CSS box around the canvas is.
//
// Rather than guess that box size with dvh/vw math (which breaks the
// moment a sibling element's height changes, or on phones with dynamic
// browser chrome), this measures the real available space with a
// ResizeObserver and computes the largest same-aspect-ratio box that fits
// inside it — correct on any device/orientation without needing to know
// anything about sibling elements' sizes.
//
// This is the shared version of BonusGame1's original PhaserGame.jsx —
// every bonus game mounts its own scenes through this instead of
// reimplementing the fit-box/resize/font-wait dance itself.
function fitBox(containerWidth, containerHeight, aspect) {
  let w = containerWidth;
  let h = (w * aspect.height) / aspect.width;
  if (h > containerHeight) {
    h = containerHeight;
    w = (h * aspect.width) / aspect.height;
  }
  return { width: Math.max(0, Math.floor(w)), height: Math.max(0, Math.floor(h)) };
}

export default function BaseGame({
  playerName,
  // Factory (not a static array) so a fresh set of scene instances is
  // created per mount — some scenes (a configured BasePreloadScene, for
  // example) carry per-game data in their constructor, so reusing stale
  // instances across mounts would be wrong.
  buildScenes,
  // Name of the event a game's scenes emit on `this.game.events` when a
  // level/round finishes (e.g. 'numberpop-complete'). Left undefined if a
  // game doesn't need to report anything back to React.
  completeEventName,
  // (payload, playerName) => void — called whenever completeEventName
  // fires. Typically wraps logPlaySession().
  onComplete,
  // (game) => void — called after the Phaser Game instance is created,
  // so the parent can subscribe to additional custom events beyond
  // completeEventName (e.g. per-round confetti events).
  onPhaserReady,
  aspect = DEFAULT_ASPECT,
  baseResolution = DEFAULT_BASE_RESOLUTION,
  backgroundColor = '#8fe0fa',
  physics,
  // Wait for webfonts (Fredoka/Nunito etc.) to finish loading before the
  // first Phaser frame, so in-game text doesn't briefly render in a
  // fallback font before the webfont swaps in.
  waitForFonts = true,
}) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  // The completion handler closes over whatever `playerName` was at the
  // instant it was registered. Reading it through a ref instead means a
  // later re-render with a new name still logs correctly, without
  // needing to tear down and recreate the whole Phaser game just to
  // rebind one listener.
  const playerNameRef = useRef(playerName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  // Track the wrapper's real available box (whatever the flex layout
  // actually leaves it, on this exact device) and derive the biggest
  // same-aspect box that fits inside it. Runs on mount, on any resize,
  // and on orientation change.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    const measure = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBoxSize(fitBox(rect.width, rect.height, aspect));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect.width, aspect.height]);

  // Whenever the computed box changes, tell Phaser's ScaleManager to
  // re-read its parent's current size and refit — Scale.FIT recalculates
  // on window resize, but our container can change size (rail collapsing,
  // orientation flip, address bar show/hide) without the window itself
  // firing a resize event.
  useEffect(() => {
    gameRef.current?.scale.refresh();
  }, [boxSize.width, boxSize.height]);

  useEffect(() => {
    if (gameRef.current) return undefined;
    let cancelled = false;

    const start = () => {
      if (cancelled || gameRef.current) return;
      gameRef.current = new Phaser.Game(createGameConfig({
        parent: containerRef.current,
        scenes: buildScenes(),
        width: baseResolution.width,
        height: baseResolution.height,
        backgroundColor,
        physics,
      }));

      if (completeEventName) {
        gameRef.current.events.on(completeEventName, (payload) => {
          onComplete?.(payload, playerNameRef.current);
        });
      }

      onPhaserReady?.(gameRef.current);
    };

    if (waitForFonts && document.fonts?.ready) {
      document.fonts.ready.then(start);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      if (completeEventName) gameRef.current?.events.off(completeEventName);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative"
        style={{
          width: boxSize.width || undefined,
          height: boxSize.height || undefined,
          // Until the first measurement lands, fall back to filling the
          // parent — no reason to hold back 2% on mobile when every pixel
          // matters for small hands tapping game elements.
          ...(boxSize.width
            ? {}
            : { aspectRatio: `${aspect.width} / ${aspect.height}`, maxWidth: '100%', maxHeight: '100%' }),
        }}
      >
        {/* Soft glow behind the frame — sm+ only. On phones the glow just
            wastes pixels that the canvas could use, and the blurred edges
            are invisible against a phone bezel anyway. */}
        <div className="pointer-events-none absolute -inset-2 hidden rounded-[2.5rem] bg-gradient-to-br from-white/50 via-yellow-100/40 to-sky-200/50 blur-xl sm:block" />
        {/* Container border/ring/shadow are stripped back to nearly nothing
            on mobile so the Phaser canvas fills the screen edge-to-edge.
            sm+ restores the decorative frame now that we have room for it. */}
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-lg border-0 shadow-none ring-0 sm:rounded-[2rem] sm:border-[6px] sm:border-white/80 sm:shadow-2xl sm:ring-4 sm:ring-white/30"
        />
      </div>
    </div>
  );
}
