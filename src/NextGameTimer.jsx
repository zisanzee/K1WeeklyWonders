import { useEffect, useState } from "react";
import { motion } from "motion/react";

function getNextFriday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 5=Fri ... 6=Sat
  let daysUntil = (5 - day + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // if it's Friday, count to *next* Friday
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntil);
  target.setHours(0, 0, 0, 0);
  return target;
}

function getTimeParts(target) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export default function NextGameTimer() {
  const [target, setTarget] = useState(getNextFriday);
  const [parts, setParts] = useState(() => getTimeParts(target));

  useEffect(() => {
    const id = setInterval(() => {
      const next = getTimeParts(target);
      setParts(next);
      if (next.days === 0 && next.hours === 0 && next.minutes === 0 && next.seconds === 0) {
        setTarget(getNextFriday());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const Unit = ({ value, label }) => (
    <div className="flex flex-col items-center leading-none">
      <span className="font-heading text-sm font-extrabold text-slate-800 sm:text-base">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-body text-[0.55rem] font-bold uppercase tracking-wide text-slate-500 sm:text-[0.6rem]">
        {label}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-20 mx-auto flex w-fit max-w-[94vw] flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/40 bg-white/85 px-3 py-1.5 shadow-[0_4px_0_rgba(0,0,0,0.1)] backdrop-blur-md sm:gap-3 sm:px-5 sm:py-2.5"
    >
      <span className="text-base sm:text-xl">🎉</span>
      <span className="font-body text-[0.7rem] font-extrabold text-slate-700 sm:text-sm">
        New game every Friday!
      </span>
      <span className="hidden h-4 w-px bg-slate-300 sm:block" />
      <div className="flex items-center gap-1 sm:gap-2">
        <Unit value={parts.days} label="days" />
        <span className="font-heading text-slate-400">:</span>
        <Unit value={parts.hours} label="hrs" />
        <span className="font-heading text-slate-400">:</span>
        <Unit value={parts.minutes} label="min" />
        <span className="font-heading text-slate-400">:</span>
        <Unit value={parts.seconds} label="sec" />
      </div>
    </motion.div>
  );
}