// Game.jsx — TODO: fill in Bubble Shooter's real asset manifest. Structure
// mirrors BonusGame1/Game.jsx exactly, since both sit on the same shared
// Phaser/BaseGame + Phaser/BasePreloadScene framework.
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import BubbleShooterScene from './BubbleShooterScene';
import { logPlaySession } from '../../logPlaySession';

const ASSETS = [
  // { type: 'audio', key: 'pop', url: '/PhaserAssets/...' },
];

export default function Game({ playerName }) {
  const buildScenes = () => [
    new BasePreloadScene({ key: 'PreloadScene', assets: ASSETS, nextSceneKey: 'BubbleShooterScene' }),
    new BubbleShooterScene(),
  ];

  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'bonusGame2',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="bubbleshooter-complete"
      onComplete={handleComplete}
    />
  );
}
