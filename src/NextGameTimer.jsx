import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { usePlayerStore } from './playerStore';
import { useGameAccessStore, useNextScheduledGame } from './gameAccess';

// The banner used to be a hardcoded "new game every Friday" countdown. It is
// now entirely schedule-driven: a teacher picks a lock time per game and this
// counts down to the soonest one. With nothing scheduled it renders nothing at
// all — there is no default weekly cadence to fall back on.
export default function NextGameTimer({ withTopOffset = false }) {
  const game = useNextScheduledGame();
  const fetchGameAccess = useGameAccessStore((state) => state.fetchGameAccess);
  const classId = usePlayerStore((state) => state.classId);
  const isTeacher = usePlayerStore((state) => state.isTeacher);

  // Parsed on each render rather than memoised — it's a single Date.parse, and
  // the React Compiler can't preserve a memo keyed on an optional-chained
  // property, so manual memoisation here only produces a lint error.
  const targetTime = game?.unlockAt ? Date.parse(game.unlockAt) : NaN;

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  // Guards against firing the refresh twice: the tick below and the effect
  // that watches for a passed target can both notice the same expiry.
  const refreshedForRef = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(targetTime)) return undefined;
    // Seconds are shown, so tick every second — but resync to the wall clock
    // each time so a throttled background tab doesn't drift and briefly show a
    // stale countdown when it is brought back to the foreground.
    let timeoutId;
    const tick = () => {
      const now = Date.now();
      setCurrentTime(now);
      if (now >= targetTime) return;
      const untilNextSecond = 1000 - (now % 1000) + 8;
      timeoutId = window.setTimeout(tick, untilNextSecond);
    };
    tick();
    return () => window.clearTimeout(timeoutId);
  }, [targetTime]);

  // When the countdown reaches zero, ask the server for the new arrangement —
  // it applies the due unlock on read, so the game appears and the banner
  // either disappears or rolls on to the next scheduled game.
  useEffect(() => {
    if (!Number.isFinite(targetTime) || currentTime < targetTime) return;
    if (refreshedForRef.current === targetTime) return;
    refreshedForRef.current = targetTime;
    fetchGameAccess(classId);
  }, [currentTime, targetTime, classId, fetchGameAccess]);

  if (!game || !Number.isFinite(targetTime) || currentTime >= targetTime) {
    return null;
  }
  // Admins have no class of their own, so a class-scoped schedule is
  // meaningless to them.
  if (isTeacher && !classId) return null;

  const totalSeconds = Math.floor((targetTime - currentTime) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <motion.section
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative z-20 mx-auto w-fit max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/50 bg-white/40 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:rounded-full sm:p-2 ${
        withTopOffset ? 'mt-8 sm:mt-0' : ''
      }`}
    >
      {/* Top Gradient Accent Line */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-indigo-500 opacity-90" />

      {/* Main Content Wrapper */}
      <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 px-1 py-1 sm:flex-nowrap sm:gap-5 sm:px-3">
        {/* Left Side: Icon & Text */}
        <div className="flex min-w-0 items-center gap-2.5">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-yellow-400 text-sm shadow-sm sm:h-9 sm:w-9 sm:text-lg"
          >
            🎁
          </motion.div>

          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 sm:text-[10px]">
              New game unlocks
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-base font-bold text-slate-700">
              <span className="truncate">{game.emoji || '🎮'}</span>
              <span className="max-w-[10rem] truncate sm:max-w-[14rem]">{game.title}</span>
            </span>
          </div>
        </div>

        {/* Right Side: Live Countdown */}
        <div
          aria-live="polite"
          className="flex items-center rounded-xl bg-slate-900/5 p-1 shadow-inner sm:rounded-full"
        >
          {days > 0 && (
            <>
              <TimeUnit value={days} label="days" />
              <BlinkingSeparator />
            </>
          )}
          <TimeUnit value={hours} label="hours" />
          <BlinkingSeparator />
          <TimeUnit value={minutes} label="mins" />
          <BlinkingSeparator />
          <TimeUnit value={seconds} label="secs" />
        </div>
      </div>
    </motion.section>
  );
}

function TimeUnit({ value, label }) {
  return (
    <div className="flex min-w-[2.4rem] flex-col items-center justify-center rounded-[0.85rem] border border-white/60 bg-gradient-to-b from-white/90 to-white/50 p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md sm:min-w-[2.9rem]">
      <span className="font-heading text-lg font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-br from-slate-700 to-slate-900 sm:text-xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-slate-400 sm:mt-1 sm:text-[9px]">
        {label}
      </span>
    </div>
  );
}

function BlinkingSeparator() {
  return (
    <div className="flex flex-col gap-1.5 px-1 sm:px-1.5">
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        className="h-1.5 w-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]"
      />
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
        className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
      />
    </div>
  );
}
