import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';

function getNextFridayNoon(now = new Date()) {
  const target = new Date(now);
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;
  target.setDate(now.getDate() + daysUntilFriday);
  target.setHours(12, 0, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

function getTimeParts(target, currentTime) {
  const totalSeconds = Math.max(
    0,
    Math.floor((target.getTime() - currentTime) / 1000)
  );
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
  };
}

function TimeUnit({ value, label }) {
  return (
    <div className="flex min-w-[3rem] flex-col items-center justify-center rounded-[0.85rem] border border-white/60 bg-gradient-to-b from-white/90 to-white/50 p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md sm:min-w-[3.5rem]">
      <span className="font-heading text-xl font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-br from-slate-700 to-slate-900 sm:text-2xl">
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
    <div className="flex flex-col gap-1.5 px-1.5 sm:px-2">
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

export default function NextGameTimer({ withTopOffset = false }) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    // Only days/hours are ever displayed, so there's nothing to gain from
    // re-rendering every second — and every re-render forces the browser to
    // repaint the nested backdrop-blur layers below, which is one of the
    // most expensive operations a phone GPU can do. Ticking once a minute
    // keeps the display perfectly accurate while cutting that repaint work
    // by ~60x.
    let timeoutId;
    const tick = () => {
      const now = Date.now();
      setCurrentTime(now);
      const millisecondsUntilNextMinute = 60000 - (now % 60000) + 8;
      timeoutId = window.setTimeout(tick, millisecondsUntilNextMinute);
    };
    tick();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const target = useMemo(
    () => getNextFridayNoon(new Date(currentTime)),
    [currentTime]
  );

  const parts = useMemo(
    () => getTimeParts(target, currentTime),
    [target, currentTime]
  );

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
      <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 px-1 py-1 sm:flex-nowrap sm:gap-6 sm:px-3">
        
        {/* Left Side: Icon & Text */}
        <div className="flex items-center gap-2.5">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-yellow-400 text-sm shadow-sm sm:h-9 sm:w-9 sm:text-lg"
          >
            🎉
          </motion.div>

          <div className="flex items-center gap-1.5 text-base font-bold text-slate-700 sm:text-base">
            <span>New game every</span>
            
            {/* Redesigned 'Friday!' Badge */}
            <motion.span 
              whileHover={{ scale: 1.05 }}
              className="relative inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-2 py-0.5 text-white shadow-[0_2px_10px_rgba(168,85,247,0.4)]"
            >
              <span className="font-black uppercase tracking-wider text-[10px] sm:text-[11px] drop-shadow-sm">
                Friday!
              </span>
            </motion.span>
          </div>
        </div>

        {/* Right Side: Compact Timer */}
        <div
          aria-live="polite"
          className="flex items-center rounded-xl bg-slate-900/5 p-1 shadow-inner sm:rounded-full"
        >
          <TimeUnit value={parts.days} label="days" />
          <BlinkingSeparator />
          <TimeUnit value={parts.hours} label="hours" />
        </div>

      </div>
    </motion.section>
  );
}