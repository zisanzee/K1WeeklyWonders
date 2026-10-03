// Game.jsx
// Game 13 — wires the game into the shared Phaser shell.
//
// The dev live-tuning sidebar is mounted through the shared <DevTuningFrame>,
// which owns the single DEV gate (see @/devTuning/panel.js). In production that
// gate folds away and the frame returns the game alone — no extra DOM and no
// panel chunk in the bundle. `enabled` is this game's own local-dev switch.
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-13/GameScene';
import { ASSET_MANIFEST } from '@/games/game-13/assets';
import { ROAD_TUNING, TUNING_SCHEMA, DEV_TUNING_ENABLED } from '@/games/game-13/roadTuning';
import { logPlaySession } from '@/api/logPlaySession';
import DevTuningFrame from '@/devTuning/DevTuningFrame';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time. No level select:
  // PreloadScene goes straight into GameScene.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83D\uDE97',
      loadingText: 'Getting Lane Switch ready...',
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

  const game = (
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

  // Production (or the editor switched off) → the frame returns `game` as-is.
  return (
    <DevTuningFrame
      tuning={ROAD_TUNING}
      schema={TUNING_SCHEMA}
      enabled={DEV_TUNING_ENABLED}
    >
      {game}
    </DevTuningFrame>
  );
}
