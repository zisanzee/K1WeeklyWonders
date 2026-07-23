// PhaserDemo.jsx
import { Link } from 'react-router-dom';
import PhaserGame from './PhaserGame';
import NameGate from '../NameGate';
import { usePlayerStore } from '../playerStore';

export default function PhaserDemo() {
  return (
    <NameGate gameLabel="Bonus Game: Number Pop">
      <PhaserDemoInner />
    </NameGate>
  );
}

function PhaserDemoInner() {
  const playerName = usePlayerStore((s) => s.playerName);

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8] px-4 pb-6 pt-4 sm:pt-6">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />

      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(-16px) translateX(8px); } }
        @keyframes float-slower { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-11px); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes pop-in { 0% { transform: scale(0.7) translateY(14px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; will-change: transform; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; will-change: transform; }
        .animate-spin-slow { animation: spin-slow 50s linear infinite; will-change: transform; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; will-change: transform, opacity; }
        .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>

      {/* Sun, top corner — same treatment as the homepage for visual continuity */}
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

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[10%] animate-float-slow text-4xl opacity-90 sm:text-5xl">☁️</div>
        <div className="absolute right-[16%] top-[16%] animate-float-slower text-3xl opacity-80 sm:text-4xl">☁️</div>
        <div className="absolute left-[10%] top-[55%] animate-sparkle text-xl sm:text-2xl">✨</div>
        <div className="absolute right-[8%] top-[62%] animate-sparkle text-2xl sm:text-3xl" style={{ animationDelay: '0.6s' }}>
          ⭐
        </div>
      </div>

      <Link
        to="/"
        className="font-body relative z-20 mb-2 flex items-center gap-1 self-start rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-4 sm:py-2 sm:text-sm md:text-base"
      >
        ⬅️ Home
      </Link>

      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-3 sm:gap-5">
        <h1 className="font-heading animate-pop-in text-center text-[clamp(1.6rem,5vw,2.75rem)] font-bold leading-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.15)]">
          🔢 Number Pop!
        </h1>
        <PhaserGame playerName={playerName} />
      </div>
    </div>
  );
}