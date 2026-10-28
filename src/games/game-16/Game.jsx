// Game.jsx
// Game 16 (in works) — wires the game into the shared Phaser shell.
//
// This is plumbing only: preload the (currently empty) asset manifest, then hand
// off to GameScene. There is no mechanic yet, so the complete-event hook is
// present but DORMANT — nothing in the scene emits it.
//
// When real gameplay lands, the scene emits 'game16-complete' with
// { stars, totalRounds, peakStreak, mistakes, elapsedSeconds } and this file
// forwards it to logPlaySession. Add the dev live-tuning sidebar at that point
// per docs/DEV_TUNING.md if the mechanic needs by-eye numbers (see
// game-13/Game.jsx for the DevTuningFrame pattern).
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-16/GameScene';
import { ASSET_MANIFEST } from '@/games/game-16/assets';
import { logPlaySession } from '@/api/logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount, so a
  // fresh set of scene instances is created each time. No level select for a
  // boilerplate: PreloadScene goes straight into GameScene.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      // Generic balloon, matching the catalogue's placeholder emoji: a scaffold
      // must not imply a mechanic with its art either.
      loadingEmoji: '\uD83C\uDF88',
      loadingText: 'Getting this game ready\u2026',
    }),
    new GameScene(),
  ];

  // Dormant until the mechanic exists. Kept wired so enabling play logging is
  // one emit from the scene rather than a refactor of this file.
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

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game16-complete"
      onComplete={handleComplete}
      // Opaque canvas: the scene paints its own sky, so the platform gradient
      // must not show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
