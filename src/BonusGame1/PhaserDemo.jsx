// PhaserDemo.jsx
import { Link } from 'react-router-dom';
import PhaserGame from './PhaserGame';
import NameGate from '../NameGate';
import { usePlayerStore } from '../playerStore';
import { useState } from 'react';

import { motion, AnimatePresence } from "motion/react";
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const numberWords = [
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

// Stagger the 1-10 buttons in as a little cascade instead of popping in
// all at once — reads as far more intentional/designed.
const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};

const buttonVariants = {
  hidden: { opacity: 0, scale: 0.4, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 22 } },
};

export default function PhaserDemo() {
  return (
    <NameGate gameLabel="Bonus Game: Number Pop">
      <PhaserDemoInner />
    </NameGate>
  );
}

function PhaserDemoInner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const [selectedNumber, setSelectedNumber] = useState(null);

  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8] px-3 pb-2 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
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
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; will-change: transform; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; will-change: transform; }
        .animate-spin-slow { animation: spin-slow 50s linear infinite; will-change: transform; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; will-change: transform, opacity; }
        .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-shimmer { animation: shimmer 2.2s linear infinite; will-change: transform; }
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
        className="font-body relative z-20  flex items-center gap-1 self-start rounded-full bg-white/90  font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none px-4 py-2 text-sm md:text-base"
      >
        ⬅️ Home
      </Link>

      <div className="relative z-10 flex w-full min-h-0 flex-1 flex-col items-center justify-center max-w-2xl gap-2 md:flex-row md:items-center md:gap-6">
        {/* Number rail — a horizontal strip above the game on phones/tablets,
            a vertical strip along the left on wider screens. Same panel,
            just re-flowed via the grid + flex direction below. */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="font-body relative order-1 flex w-full max-w-md flex-none flex-col items-center gap-1.5 rounded-[1.5rem] bg-white/85 px-2.5 py-1.5 shadow-[0_5px_0_rgba(0,0,0,0.12)] backdrop-blur-sm sm:rounded-[1.75rem] sm:px-3 sm:py-2 md:order-none md:w-24 md:max-w-none md:flex-1 md:justify-center md:gap-3 md:self-stretch md:px-2.5 md:py-4"
        >
          {/* Selected word — floats above the rail on mobile so it never
              adds height (and never causes scroll); sits inline in the
              flow on the desktop rail, where there's room to spare. */}
          <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 md:static md:order-first md:flex md:h-9 md:translate-x-0 md:items-center md:justify-center">
            <AnimatePresence mode="wait">
              {selectedNumber !== null && (
                <motion.span
                  key={selectedNumber}
                  initial={{ opacity: 0, scale: 0.6, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 font-heading text-lg font-bold text-orange-600 shadow-[0_3px_0_rgba(0,0,0,0.1)] sm:text-lg md:text-base"
                >
                  {numberWords[selectedNumber - 1]}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <p className="hidden font-heading text-center text-xs font-bold uppercase tracking-wide text-slate-500 md:block">
            🔢 Pick
          </p>

          <motion.div
            variants={gridVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-10 gap-1 sm:gap-1.5 md:grid-cols-1 md:gap-1.5"
          >
            {Array.from({ length: 10 }, (_, idx) => idx + 1).map((i) => {
              const isSelected = selectedNumber === i;
              return (
                <motion.button
                  key={i}
                  type="button"
                  variants={buttonVariants}
                  onClick={() => setSelectedNumber(isSelected ? null : i)}
                  aria-pressed={isSelected}
                  aria-label={`Show ${i} spelled out`}
                  whileHover={{ scale: isSelected ? 1.08 : 1.1, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: isSelected ? 1.1 : 1, y: isSelected ? -2 : 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className={cn(
                    'font-heading relative flex aspect-square items-center justify-center rounded-lg text-lg font-bold shadow-[0_3px_0_rgba(0,0,0,0.15)] transition-colors sm:rounded-xl sm:text-sm md:h-10 md:w-10 md:rounded-2xl md:text-lg',
                    isSelected
                      ? 'bg-gradient-to-b from-amber-300 to-orange-400 text-white ring-2 ring-amber-200 ring-offset-1'
                      : 'bg-white text-slate-600 hover:bg-amber-50'
                  )}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="number-glow"
                      className="absolute -inset-1.5 -z-10 rounded-lg bg-amber-300/40 blur-md sm:rounded-xl md:rounded-2xl"
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                    />
                  )}
                  {i}
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>

        <div className="flex w-full min-h-0 flex-1 items-center justify-center">
          <PhaserGame playerName={playerName} />
        </div>
      </div>
    </div>
  );
}