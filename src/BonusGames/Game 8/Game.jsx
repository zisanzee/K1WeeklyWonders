// Game.jsx
import { useEffect, useState } from 'react';
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
  // select in Game 8: PreloadScene goes straight into GameScene.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83C\uDF55',
      loadingText: 'Getting the pizza ready...',
    }),
    new GameScene(),
  ];

  // Fires once, when the full 10-round run is complete.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game8',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  // Per-round confetti (Phase B answered correctly) plus a bigger final
  // burst when the whole run finishes.
  const handlePhaserReady = (game) => {
    game.events.on('game8-round-correct', () => {
      setConfettiDuration(1200);
      setShowConfetti(true);
    });
    game.events.on('game8-deliver-correct', () => {
      setConfettiDuration(1500);
      setShowConfetti(true);
    });
    game.events.on('game8-dance', () => {
      setConfettiDuration(2500);
      setShowConfetti(true);
    });
    game.events.on('game8-complete', () => {
      setConfettiDuration(3000);
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
          numberOfPieces={200}
          gravity={0.6}
          initialVelocityY={{ min: 25, max: 60 }}
          friction={0.92}
          tweenDuration={1500}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}
        />
      )}
      <BaseGame
        playerName={playerName}
        buildScenes={buildScenes}
        completeEventName="game8-complete"
        onComplete={handleComplete}
        onPhaserReady={handlePhaserReady}
      />
    </>
  );
}
