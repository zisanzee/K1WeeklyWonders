// Game.jsx
// Choo-Choo to the Zoo! — wires the game into the shared Phaser shell.
//
// No live-tuning panel here (add one later per docs/DEV_TUNING.md if the
// mechanic needs by-eye numbers) — this keeps the boilerplate minimal.
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-14/GameScene';
import { ASSET_MANIFEST } from '@/games/game-14/assets';
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
      loadingEmoji: '\uD83D\uDE82',
      loadingText: 'Getting Choo-Choo to the Zoo! ready...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — the scene emits 'game14-complete' with
  // { stars, totalRounds, peakStreak, mistakes, elapsedSeconds }.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      // Slug matches the registry progressKey and follows game 11's `gameNN`
      // shape (no hyphen). The server validates the `game` slug against a known
      // set, so a mismatched form would make every session silently rejected.
      game: 'game14',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game14-complete"
      onComplete={handleComplete}
      // Opaque canvas: the scene paints its own sky so the platform gradient
      // does not show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
