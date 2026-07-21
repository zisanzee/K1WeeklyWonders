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
        width: 480,
        height: 640,
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
    <div
      ref={containerRef}
      className="mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[2rem] shadow-xl"
    />
  );
}