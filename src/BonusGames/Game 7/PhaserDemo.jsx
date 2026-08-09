// PhaserDemo.jsx
import { Link } from 'react-router-dom';
import Game from './Game';
import NameGate from '../../NameGate';
import GameAccessGate from '../../GameAccessGate';
import { usePlayerStore } from '../../playerStore';

export default function PhaserDemo() {
  return (
    <NameGate gameLabel="Game 7">
      <GameAccessGate gameNumber={7} gameLabel="Game 7">
        <PhaserDemoInner />
      </GameAccessGate>
    </NameGate>
  );
}

function PhaserDemoInner() {
  const playerName = usePlayerStore((s) => s.playerName);

  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8] px-0 pb-0 pt-0 sm:px-4 sm:pb-4 sm:pt-3">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />

      <Link
        to="/"
        className="font-body relative z-20 flex items-center gap-0.5 self-start rounded-full bg-white/90 font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none px-2 py-1 text-[10px] sm:px-4 sm:py-2 sm:text-sm md:text-base"
      >
        ⬅️ Home
      </Link>

      <div className="relative z-10 flex w-full min-h-0 flex-1 items-center justify-center">
        <Game playerName={playerName} />
      </div>
    </div>
  );
}
