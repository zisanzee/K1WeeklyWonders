// Game.jsx
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene from '@/games/pizza-order/GameScene';
import { ASSET_MANIFEST } from '@/games/pizza-order/assets';
import { logPlaySession } from '@/api/logPlaySession';

export default function Game({ playerName }) {
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

  // No React-layer confetti anymore — the money confetti is spawned inside
  // GameScene from the moneyForConfetti texture, so there's nothing extra to
  // subscribe to via onPhaserReady.
  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game8-complete"
      onComplete={handleComplete}
    />
  );
}
