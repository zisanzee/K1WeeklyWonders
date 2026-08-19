// PhaserDemo.jsx
import { Link } from 'react-router-dom';
import Game from './Game';
import NameGate from '../../NameGate';
import GameAccessGate from '../../GameAccessGate';
import { usePlayerStore } from '../../playerStore';

export default function PhaserDemo() {
  return (
    <NameGate gameLabel="Game 9">
      <GameAccessGate gameNumber={9} gameLabel="Game 9">
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

      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(-14px) translateX(6px); } }
        @keyframes float-slower { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
        .animate-float-slow { animation: float-slow 7s ease-in-out infinite; will-change: transform; }
        .animate-float-slower { animation: float-slower 9s ease-in-out infinite; will-change: transform; }
        .animate-spin-slow { animation: spin-slow 50s linear infinite; will-change: transform; }
        .animate-sparkle { animation: sparkle 2s ease-in-out infinite; will-change: transform, opacity; }
      `}</style>

      {/* Sun, top corner — same as the other bonus games for visual continuity */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 sm:h-32 sm:w-32">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-spin-slow">
          <g fill="#FFD93D">
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x="94" y="0" width="12" height="46" rx="6" transform={`rotate(${i * 30} 100 100)`} />
            ))}
          </g>
        </svg>
        <div className="absolute inset-[18%] rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 shadow-[0_0_30px_rgba(255,217,61,0.6)]" />
      </div>

      {/* Floating clouds + sparkles — zero layout cost, cheap GPU-composited
          animations, same pattern as the other bonus games */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[7%] top-[9%] animate-float-slow text-4xl opacity-90 sm:text-5xl">☁️</div>
        <div className="absolute right-[12%] top-[12%] animate-float-slower text-3xl opacity-80 sm:text-4xl">☁️</div>
        <div className="absolute left-[12%] top-[54%] animate-sparkle text-xl sm:text-2xl">✨</div>
        <div className="absolute right-[6%] top-[60%] animate-sparkle text-2xl sm:text-3xl" style={{ animationDelay: '0.7s' }}>
          ⭐
        </div>
      </div>

      <Link
        to="/"
        className="font-body relative z-20 flex items-center gap-1.5 self-start rounded-full bg-white/65 font-bold text-slate-600 shadow-[0_2px_0_rgba(0,0,0,0.06)] ring-1 ring-white/40 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_3px_0_rgba(0,0,0,0.10)] active:translate-y-0.5 active:shadow-none px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base md:text-lg"
      >
        🏠 Home
      </Link>

      <div className="relative z-10 flex w-full min-h-0 flex-1 items-center justify-center">
        <Game playerName={playerName} />
      </div>
    </div>
  );
}
