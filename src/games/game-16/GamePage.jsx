// GamePage.jsx
// Game 16 (in works) — page chrome.
//
// The `gameLabel` values here must match the catalogue entry's label/title in
// registry.js, or the lock screen and the card disagree. Both are currently the
// placeholder '(in works)', so an unfinished game is unmistakable everywhere it
// appears — rename all of them together, once it actually works.
import { Link } from 'react-router-dom';
import Game from '@/games/game-16/Game';
import NameGate from '@/auth/NameGate';
import GameAccessGate from '@/auth/GameAccessGate';
import { usePlayerStore } from '@/auth/playerStore';

export default function GamePage() {
  return (
    <NameGate gameLabel="(in works)">
      <GameAccessGate gameNumber={16} gameLabel="(in works)">
        <GamePageInner />
      </GameAccessGate>
    </NameGate>
  );
}

function GamePageInner() {
  const playerName = usePlayerStore((s) => s.playerName);

  return (
    // .aura-page paints the homepage's aurora backdrop (see aurora.css).
    // NameGate returns children directly once signed in, so it never renders
    // its own .aura-page around a game: this page has to provide one.
    <div className="aura-page relative flex h-[100dvh] w-full flex-col items-center overflow-hidden px-0 pb-0 pt-0 sm:px-4 sm:pb-4 sm:pt-3">
      <Link
        to="/"
        className="font-body relative z-20 ml-3 mt-3 flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2.5 text-sm font-bold text-[#3b2f1e] shadow-lg shadow-black/15 ring-1 ring-white/60 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl active:translate-y-0.5 active:shadow-md sm:ml-4 sm:mt-4 sm:px-5 sm:py-3 sm:text-base md:text-lg"
      >
        🏠 Home
      </Link>

      <div className="relative z-10 flex w-full min-h-0 flex-1 items-center justify-center">
        <Game playerName={playerName} />
      </div>
    </div>
  );
}
