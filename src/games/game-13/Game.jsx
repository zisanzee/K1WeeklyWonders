// Game.jsx
// Game 13 — BOILERPLATE ONLY. Wires the game into the shared Phaser shell.
// This is the part that stays the same once the mechanics are built; only the
// scene list and the completion payload change.
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-13/GameScene';
import { ASSET_MANIFEST } from '@/games/game-13/assets';
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
      loadingText: 'Getting Game 13 ready...',
    }),
    new GameScene(),
  ];

  // Fires when the game is complete — the scene emits 'game13-complete' with
  // { stars, totalRounds, peakStreak, mistakes, elapsedSeconds }.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      // Slug matches the registry progressKey and follows game 11's `gameNN`
      // shape (no hyphen), matching the server's validated game-slug set.
      game: 'game13',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game13-complete"
      onComplete={handleComplete}
      // Opaque canvas: the scene paints its own full-bleed artwork, so a
      // transparent canvas would let the platform gradient show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
