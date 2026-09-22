// Game.jsx
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/feed-me-shapes/GameScene';
import { ASSET_MANIFEST } from '@/games/feed-me-shapes/assets';
import { logPlaySession } from '@/api/logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time. No level select:
  // PreloadScene goes straight into GameScene.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83C\uDF55',
      loadingText: 'Waking the shape monster...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — see GameScene.finishGame().
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game10',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game10-complete"
      onComplete={handleComplete}
      // The scene draws its own wood-grain artwork across the whole canvas, so
      // the canvas is opaque here. Leaving it transparent would let the
      // platform's purple gradient show through every gap in the art.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
