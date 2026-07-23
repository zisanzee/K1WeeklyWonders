// PhaserDemo.jsx
import { Link } from 'react-router-dom';
import PhaserGame from './PhaserGame';
import NameGate from '../NameGate';
import { usePlayerStore } from '../playerStore';
import { useState } from 'react';

import { motion, AnimatePresence } from "motion/react";

export default function PhaserDemo() {
  return (
    <NameGate gameLabel="Bonus Game: Number Pop">
      <PhaserDemoInner />
    </NameGate>
  );
}

function PhaserDemoInner() {
  const playerName = usePlayerStore((s) => s.playerName);
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
const [selectedNumber, setSelectedNumber] = useState(null);
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
        className="font-body relative z-20  flex items-center gap-1 self-start rounded-full bg-white/90  font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none px-4 py-2 text-sm md:text-base"
      >
        ⬅️ Home
      </Link>

      <div className="relative  w-full z-10 flex  min-h-full flex-1 flex-col md:flex-row items-center justify-center gap-3 sm:gap-5">
 <div className="flex flex-wrap sm:min-w-20 justify-center gap-1 rounded md:flex-col md:items-center">
  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
    const isSelected = selectedNumber === i;

    return (
      <motion.button
        layout
        key={i}
        type="button"
        onClick={() => setSelectedNumber(isSelected ? null : i)}
        initial={false}
        animate={{
          scale: isSelected ? 1.05 : 1,
          backgroundColor: isSelected ? "#facc15" : "#fbbf24",
        }}
        whileHover={{ scale: isSelected ? 1.06 : 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="flex items-center justify-center overflow-hidden rounded-sm  p-1 font-bold shadow-sm md:flex-col"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {isSelected && (
            <motion.div
              key="word"
              layout
              initial={{ opacity: 0, x: -8, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: -8, width: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="overflow-hidden whitespace-nowrap  p-1 text-left text-slate-700"
            >
              {numberWords[i - 1]}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          className="px-2 py-1 text-right text-xl text-slate-700"
        >
          {i}
        </motion.div>
      </motion.button>
    );
  })}
</div>

  <PhaserGame playerName={playerName} />
</div>
    </div>
  );
}