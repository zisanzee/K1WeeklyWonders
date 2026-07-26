// Game.jsx
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import LevelSelectScene from './LevelSelectScene';
import CompareDiceScene from './CompareDiceScene';
import { ASSET_MANIFEST } from './assets';
import { logPlaySession } from '../../logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'LevelSelectScene',
      loadingEmoji: '🎲',
      loadingText: 'Getting the dice ready...',
    }),
    new LevelSelectScene(),
    new CompareDiceScene(),
  ];

  // Fires once per finished level (pass or fail) — see finishLevel() in
  // CompareDiceScene.js. stars/totalRounds scale with level progress the
  // same way BonusGame1 does it (Level 1 -> 1/1, Level 2 -> 2/2).
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game4',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="comparedice-complete"
      onComplete={handleComplete}
    />
  );
}