// Game.jsx
// Game 11 — BOILERPLATE ONLY. Wires the game into the shared Phaser shell.
// This is the part that stays the same once the mechanics are built; only the
// scene list and the completion payload change.
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-11/GameScene';
import { ASSET_MANIFEST } from '@/games/game-11/assets';
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
      loadingEmoji: '\uD83E\uDDE9',
      loadingText: 'Getting the game ready...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — the scene must emit 'game11-complete'
  // with { stars, totalRounds, peakStreak, mistakes, elapsedSeconds }.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      game: 'game11',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game11-complete"
      onComplete={handleComplete}
      // Opaque canvas: the scene paints its own full-bleed artwork, so a
      // transparent canvas would let the platform gradient show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
