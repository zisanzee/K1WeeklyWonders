// Game.jsx
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import GameScene from './GameScene';
import { ASSET_MANIFEST } from './assets';
import { logPlaySession } from '../../logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time. There is no level
  // select in Game 9: PreloadScene goes straight into GameScene.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83E\uDD9C',
      loadingText: 'Hoisting the treasure...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — see the game's finish logic.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game9',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game9-complete"
      onComplete={handleComplete}
    />
  );
}
