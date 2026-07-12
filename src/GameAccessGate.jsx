import { Link } from 'react-router-dom';
import { usePlayerStore } from './playerStore';
import { isGameUnlocked } from './gameAccess';

// Wrap a game's inner content with this (inside NameGate). It re-checks
// the same unlock rules the homepage cards use, so someone who types a
// locked game's URL directly (e.g. /Game3) sees a friendly "not out yet"
// screen instead of the game itself — teachers still get straight in.
export default function GameAccessGate({ gameNumber, gameLabel, children }) {
  const isTeacher = usePlayerStore((s) => s.isTeacher);

  if (isGameUnlocked(gameNumber, isTeacher)) return children;

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4 text-center">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />
      <div className="pointer-events-none absolute left-[8%] top-[10%] text-5xl opacity-80">☁️</div>
      <div className="pointer-events-none absolute right-[10%] top-[16%] text-4xl opacity-70">☁️</div>

      <span className="text-7xl">🔒</span>
      <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-2xl font-bold text-slate-800 sm:text-3xl">
        {gameLabel || 'This game'} isn't out yet!
      </h1>
      <p style={{ fontFamily: "'Nunito', sans-serif" }} className="max-w-xs text-sm font-semibold text-slate-600 sm:text-base">
        Ask your teacher when it'll be ready to play ✨
      </p>
      <Link
        to="/"
        style={{ fontFamily: "'Fredoka', sans-serif" }}
        className="mt-2 rounded-full bg-white px-6 py-3 text-base font-bold text-slate-700 shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
      >
        🏠 Back home
      </Link>
    </div>
  );
}
