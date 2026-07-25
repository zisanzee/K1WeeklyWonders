// Game.jsx
// BonusGame1's own thin layer on top of the shared Phaser framework: just
// its asset manifest, its scene list, and how to log a finished session.
// All the actual "mount a Phaser.Game and keep it sized right" logic lives
// in Phaser/BaseGame.jsx.
import BaseGame from '../../Phaser/BaseGame';
import BasePreloadScene from '../../Phaser/BasePreloadScene';
import LevelSelectScene from './LevelSelectScene';
import NumberOrderScene from './NumberOrderScene';
import { logPlaySession } from '../../logPlaySession';

const ASSETS = [
  { type: 'audio', key: 'pop1', url: '/PhaserAssets/pop_fx/pop-1.mp3' },
  { type: 'audio', key: 'pop2', url: '/PhaserAssets/pop_fx/pop-2.mp3' },
  { type: 'audio', key: 'pop3', url: '/PhaserAssets/pop_fx/pop-3.mp3' },
  { type: 'audio', key: 'wrong', url: '/PhaserAssets/wrong.wav' },
  { type: 'audio', key: 'bgMusic', url: '/PhaserAssets/bg_music.m4a' },
];

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time.
  const buildScenes = () => [
    new BasePreloadScene({ key: 'PreloadScene', assets: ASSETS, nextSceneKey: 'LevelSelectScene' }),
    new LevelSelectScene(),
    new NumberOrderScene(),
  ];

  // Fires once per finished level — the scene emits this exactly once,
  // right when a level's final bubble pops in order (see showComplete() in
  // NumberOrderScene.js). With 4 levels, this can fire up to 4 times per
  // visit (once per level cleared), plus again on any replay. `stars` and
  // `totalRounds` both scale with the level itself — Level 1 sends 1/1,
  // Level 2 sends 2/2, and so on. They have to move together: the server
  // clamps stars to totalRounds, so leaving totalRounds at a flat 1 would
  // silently cap every level's stars back down to 1. "Play again" / "Next
  // Level" both restart or start a scene, which runs create() again and
  // can fire a fresh 'numberpop-complete' event on its own next finish, so
  // no "already logged" guard is needed here the way round-based games need.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'bonusGame1',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="numberpop-complete"
      onComplete={handleComplete}
    />
  );
}
