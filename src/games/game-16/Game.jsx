// Game.jsx
// Game 16 — wires the five-scene run into the shared Phaser shell, with the
// shared live-tuning sidebar mounted through <DevTuningFrame>.
//
// The frame owns the single DEV gate (see @/devTuning/panel.js), so this file has
// no `if` and no lazy()/Suspense: in production the frame returns the game alone
// — no extra DOM, no sidebar chunk. `enabled` is this game's own local-dev switch.
//
// See plans/game-16-five-scenes.md for how the hub (GameScene.js) runs the five
// mini-games, and scenes.js for the scene registry.
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-16/GameScene';
import { ASSET_MANIFEST } from '@/games/game-16/assets';
import { DEV_TUNING_ENABLED, TUNING, TUNING_SCHEMA } from '@/games/game-16/tuning';
import { logPlaySession } from '@/api/logPlaySession';
import DevTuningFrame from '@/devTuning/DevTuningFrame';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount, so a fresh
  // set of scene instances is created each time. The hub is a single scene: it
  // mounts the five mini-games itself.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      loadingEmoji: '\uD83C\uDF88',
      loadingText: 'Getting this game ready\u2026',
    }),
    new GameScene(),
  ];

  // The hub emits 'game16-complete' once the 15th round is finished.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      // Must equal the registry progressKey. The server validates the `game`
      // slug against a known set, so 'game16' must also be added server-side
      // before real sessions are stored.
      game: 'game16',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  const game = (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game16-complete"
      onComplete={handleComplete}
      // Opaque canvas: the hub paints its own backdrop, so the platform gradient
      // must not show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );

  // Production (or the editor switched off) → the frame returns `game` as-is.
  return (
    <DevTuningFrame tuning={TUNING} schema={TUNING_SCHEMA} enabled={DEV_TUNING_ENABLED}>
      {game}
    </DevTuningFrame>
  );
}
