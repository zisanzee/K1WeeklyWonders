import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '@/auth/playerStore';
import {
  useGameAccessStore,
  useIsGameUnlocked,
  useGameByKey,
  formatUnlockCountdown,
} from '@/games/gameAccess';
import BrandLoader from '@/ui/BrandLoader';

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

  // A scheduled game is locked AND has a pending unlock time. Telling a child
  // "ask your teacher" when the teacher has already scheduled the unlock is
  // both unhelpful and slightly dishonest — the answer is right there.
  const game = useGameByKey(gameNumber);
  const unlockAt = game?.unlockAt || null;
  const [now, setNow] = useState(() => Date.now());

  // Only ticks while a schedule is actually pending, so an ordinary locked game
  // (no unlockAt) never starts a timer.
  useEffect(() => {
    if (!unlockAt || unlocked || isTeacher) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [unlockAt, unlocked, isTeacher]);

  const countdown =
    !unlocked && !isTeacher ? formatUnlockCountdown(unlockAt, now) : null;

  // Someone may land here directly (e.g. a bookmarked /Game3 URL) without
  // ever hitting the homepage, so this can't assume access data is loaded.
  useEffect(() => {
    if (loaded && loadedClassId === classId) return;
    fetchGameAccess(classId);
  }, [classId, loaded, loadedClassId, fetchGameAccess]);

  // Teachers/admins always pass straight through. This must come BEFORE the
  // loading gate: the global admin has no classId, so game-access data never
  // loads for them and they'd otherwise be stuck on the spinner forever.
  if (isTeacher) return children;

  // A failed game-access load still needs a useful, retryable screen…
  if ((!loaded || loadedClassId !== classId) && error) {
    return (
      <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4 text-center">
        <span className="text-5xl">😕</span>
        <p className="font-body max-w-xs text-sm font-bold text-slate-700">
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
      </div>
    );
  }

  // …otherwise show the shared branded loader (same screen as app boot).
  if (!loaded || loadedClassId !== classId) {
    return <BrandLoader />;
  }

  if (unlocked) return children;

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4 text-center">
      <div className="pointer-events-none absolute left-[8%] top-[10%] text-5xl opacity-80">☁️</div>
      <div className="pointer-events-none absolute right-[10%] top-[16%] text-4xl opacity-70">☁️</div>

      <span className="text-7xl">{countdown ? '⏳' : '🔒'}</span>
      <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-2xl font-bold text-slate-800 sm:text-3xl">
        {countdown
          ? `${gameLabel || 'This game'} unlocks soon!`
          : `${gameLabel || 'This game'} isn't out yet!`}
      </h1>
      {countdown ? (
        <>
          <p className="font-body max-w-xs text-sm font-semibold text-slate-600">
            Ready in
          </p>
          <span className="font-heading rounded-full bg-white/80 px-6 py-2 text-2xl font-black text-sky-700 shadow-[0_4px_0_rgba(0,0,0,0.1)]">
            {countdown}
          </span>
          <p className="font-body max-w-xs text-xs font-semibold text-slate-500">
            Come back then and it'll be ready to play ✨
          </p>
        </>
      ) : (
        <p className="font-body max-w-xs text-sm font-semibold text-slate-600 sm:text-base">
          Ask your teacher when it'll be ready to play ✨
        </p>
      )}
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
