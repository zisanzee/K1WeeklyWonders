// Game.jsx
import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import LevelSelectScene from './LevelSelectScene';
import GameScene from './GameScene';
import { ASSET_MANIFEST } from './assets';
import { logPlaySession } from '../../logPlaySession';

export default function Game({ playerName }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiDuration, setConfettiDuration] = useState(0);

  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'LevelSelectScene',
      loadingEmoji: '\uD83E\uDD5A',
      loadingText: 'Getting the nests ready...',
    }),
    new LevelSelectScene(),
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
      setConfettiDuration(1200);
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
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={showConfetti ? 200 : 0}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}
        />
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
