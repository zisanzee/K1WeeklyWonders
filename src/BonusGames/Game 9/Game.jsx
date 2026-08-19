// Game.jsx
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import GameScene from './GameScene';
import { ASSET_MANIFEST } from './assets';
import { logPlaySession } from '../../logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time. PreloadScene goes
  // straight into GameScene; add a LevelSelectScene here (following Game 7's
  // pattern) if the design later calls for level cards.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83C\uDFAE',
      loadingText: 'Getting the game ready...',
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
