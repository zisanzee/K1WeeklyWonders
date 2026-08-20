// Game.jsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Confetti from 'react-confetti';
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import GameScene from './GameScene';
import { ASSET_MANIFEST } from './assets';
import { logPlaySession } from '../../logPlaySession';

export default function Game({ playerName }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiDuration, setConfettiDuration] = useState(0);

  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time. There is no level
  // select in Game 7: PreloadScene goes straight into GameScene, which runs
  // the full 12-round game.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83E\uDD5A',
      loadingText: 'Getting the nests ready...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — see the game's finish logic.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game7',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  // Subscribe to per-round and per-level confetti events via onPhaserReady.
  const handlePhaserReady = (game) => {
    game.events.on('game7-round-correct', () => {
      // 2800ms so the confetti spans the whole bird dance.
      setConfettiDuration(2800);
      setShowConfetti(true);
    });
    game.events.on('game7-level-complete', () => {
      setConfettiDuration(2500);
      setShowConfetti(true);
    });
  };

  // Auto-hide confetti after the duration.
  useEffect(() => {
    if (!showConfetti) return;
    const timer = setTimeout(() => setShowConfetti(false), confettiDuration);
    return () => clearTimeout(timer);
  }, [showConfetti, confettiDuration]);

  return (
    <>
      {/* Portal to document.body with a maximal z-index so the confetti is
          always the foremost layer, even over the Phaser canvas. */}
      {showConfetti &&
        createPortal(
          <Confetti
            recycle={false}
            numberOfPieces={250}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 2147483000,
            }}
          />,
          document.body
        )}
      <BaseGame
        playerName={playerName}
        buildScenes={buildScenes}
        completeEventName="game7-complete"
        onComplete={handleComplete}
        onPhaserReady={handlePhaserReady}
      />
    </>
  );
}
