// Game.jsx
// Game 15 — wires the scaffold into the shared Phaser shell.
//
// This is plumbing only: preload the (currently empty) asset manifest, then
// hand off to GameScene. The completion→logPlaySession hook is wired up but
// intentionally dormant — nothing emits 'game15-complete' until the scene has
// a real end-of-run. Add the dev live-tuning sidebar later per
// docs/DEV_TUNING.md if the mechanic needs by-eye numbers (see game-13/Game.jsx
// for the DevTuningFrame pattern).
import BaseGame from '@/phaser/BaseGame';
import BasePreloadScene from '@/phaser/BasePreloadScene';
import GameScene, { BACKGROUND_COLOR } from '@/games/game-15/GameScene';
import { ASSET_MANIFEST } from '@/games/game-15/assets';
import { logPlaySession } from '@/api/logPlaySession';

export default function Game({ playerName }) {
  // Factory (not a static array) — BaseGame calls this once per mount so a
  // fresh set of scene instances is created each time.
  const buildScenes = () => [
    new BasePreloadScene({
      key: 'PreloadScene',
      assets: ASSET_MANIFEST,
      nextSceneKey: 'GameScene',
      // Placeholder until the game has an identity — swap for its emoji.
      loadingEmoji: '\uD83D\uDEC0',
      loadingText: 'Getting Game 15 ready...',
    }),
    new GameScene(),
  ];

  // Ready for the real end-of-run: when the scene calls
  // this.game.events.emit('game15-complete', { stars, totalRounds, peakStreak,
  // mistakes, elapsedSeconds }) this logs the session. Nothing emits it yet.
  const handleComplete = (payload, currentPlayerName) => {
    logPlaySession({
      // Must equal the registry progressKey. The server validates the `game`
      // slug against a known set, so 'game15' must also be added server-side
      // before real sessions are stored.
      game: 'game15',
      playerName: currentPlayerName || 'Guest',
      ...payload,
    });
  };

  return (
    <BaseGame
      playerName={playerName}
      buildScenes={buildScenes}
      completeEventName="game15-complete"
      onComplete={handleComplete}
      // Opaque canvas: the scene paints its own sky, so the platform gradient
      // must not show through.
      backgroundColor={BACKGROUND_COLOR}
      transparent={false}
    />
  );
}
