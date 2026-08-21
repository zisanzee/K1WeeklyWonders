// Game.jsx
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import GameScene from './GameScene';
import StartScene from './StartScene';
import { ASSET_MANIFEST } from './assets';
import { logPlaySession } from '../../logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time. There is no level
  // select in Game 7: PreloadScene loads assets, StartScene shows the title
  // art + Play button, and GameScene runs the full 12-round game.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'StartScene',
      loadingEmoji: '\uD83E\uDD5A',
      loadingText: 'Getting the nests ready...',
    }),
    new StartScene(),
    new GameScene(),
  ];

  // Fires when the full 12-round game is complete.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game7',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  // All confetti is spawned inside GameScene now — there is no React-layer
  // confetti to subscribe to.
  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game7-complete"
      onComplete={handleComplete}
    />
  );
}
