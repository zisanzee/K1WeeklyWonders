// Game.jsx
// Position Mission! — wires the game into the shared Phaser shell.
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-12/GameScene';
import { ASSET_MANIFEST } from '@/games/game-12/assets';
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
      loadingEmoji: '\u2728',
      loadingText: 'Getting Position Mission! ready...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — the scene emits 'game12-complete' with
  // { stars, totalRounds, peakStreak, mistakes, elapsedSeconds }.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      // Slug matches the registry progressKey and follows game 11's `gameNN`
      // shape (no hyphen). The server validates the `game` slug against a known
      // set, so a mismatched form would make every session silently rejected.
      game: 'game12',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game12-complete"
      onComplete={handleComplete}
      // Opaque canvas: the scene paints its own full-bleed artwork, so a
      // transparent canvas would let the platform gradient show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
