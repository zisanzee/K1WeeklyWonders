// Game.jsx
// Position Mission! — wires the game into the shared Phaser shell.
//
// In dev a live-tuning sidebar from the shared kit (@/devTuning) is mounted
// beside the canvas. It is lazy + DEV-gated (see @/devTuning/config), so neither
// it nor anything hanging off it ever reaches a production build. In production
// the output is exactly the BaseGame.
import { lazy, Suspense } from 'react';
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-12/GameScene';
import { ASSET_MANIFEST } from '@/games/game-12/assets';
import { TUNING, TUNING_SCHEMA, DEV_TUNING_ENABLED } from '@/games/game-12/sceneTuning';
import { logPlaySession } from '@/api/logPlaySession';
import { TUNING_DEV_ENABLED } from '@/devTuning/config';

// Lazy + dev-gated. The condition is written INLINE on import.meta.env.DEV so
// Vite replaces it with the literal `false` in a production build; the ternary
// then folds, the dynamic import() becomes unreachable, and the panel chunk is
// dropped from the bundle entirely — it is never even emitted, let alone loaded.
const DevTuningPanel =
  import.meta.env.DEV && TUNING_DEV_ENABLED && DEV_TUNING_ENABLED
    ? lazy(() => import('@/devTuning/DevTuningPanel'))
    : null;

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

  const game = (
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

  // Production (or the editor switched off): exactly the game, no extra DOM.
  if (!DevTuningPanel) return game;

  return (
    <div className="flex h-full w-full">
      <div className="min-h-0 flex-1">{game}</div>
      <Suspense fallback={null}>
        <DevTuningPanel tuning={TUNING} schema={TUNING_SCHEMA} />
      </Suspense>
    </div>
  );
}
