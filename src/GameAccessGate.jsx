import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerStore } from './playerStore';
import { useGameAccessStore, useIsGameUnlocked } from './gameAccess';

// Wrap a game's inner content with this (inside NameGate). It re-checks
// the same unlock rules the homepage cards use, so someone who types a
// locked game's URL directly (e.g. /Game3) sees a friendly "not out yet"
// screen instead of the game itself — teachers still get straight in.
export default function GameAccessGate({ gameNumber, gameLabel, children }) {
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const classId = usePlayerStore((s) => s.classId);
  const loaded = useGameAccessStore((s) => s.loaded);
  const loadedClassId = useGameAccessStore((s) => s.loadedClassId);
  const error = useGameAccessStore((s) => s.error);
  const fetchGameAccess = useGameAccessStore((s) => s.fetchGameAccess);
  const unlocked = useIsGameUnlocked(gameNumber, isTeacher);
  const [loadingTooLong, setLoadingTooLong] = useState(false);

  // Someone may land here directly (e.g. a bookmarked /Game3 URL) without
  // ever hitting the homepage, so this can't assume access data is loaded.
  useEffect(() => {
    if (loaded && loadedClassId === classId) return;
    setLoadingTooLong(false);
    const tooLongTimer = setTimeout(() => setLoadingTooLong(true), 8_000);
    fetchGameAccess(classId);
    return () => clearTimeout(tooLongTimer);
  }, [classId, loaded, loadedClassId, fetchGameAccess]);

  // While the class's game-access data is loading, show a spinner
  // instead of a blank screen so the user knows something is happening.
  if (!loaded || loadedClassId !== classId) {
    return (
      <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4 text-center">
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
        />
        {error ? (
          <>
            <span className="text-5xl">😕</span>
            <p style={{ fontFamily: "'Nunito', sans-serif" }} className="max-w-xs text-sm font-bold text-slate-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => fetchGameAccess(classId)}
              style={{ fontFamily: "'Fredoka', sans-serif" }}
              className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-sky-700 shadow-[0_4px_0_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            >
              Try again
            </button>
            <Link
              to="/"
              style={{ fontFamily: "'Fredoka', sans-serif" }}
              className="rounded-full bg-white/70 px-4 py-1.5 text-xs font-bold text-slate-500"
            >
              🏠 Back home
            </Link>
          </>
        ) : (
          <>
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-white/90 border-t-transparent" />
            <p style={{ fontFamily: "'Nunito', sans-serif" }} className="text-base font-bold text-white">
              Loading your class games…
            </p>
            {loadingTooLong && (
              <p style={{ fontFamily: "'Nunito', sans-serif" }} className="max-w-xs text-xs font-semibold text-white/70">
                Still working on it — thanks for your patience!
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  if (isTeacher) return children;
  if (unlocked) return children;

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
