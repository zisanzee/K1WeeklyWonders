import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import StatsPanel from "./StatsPanel";
import NameGate from "./NameGate";
import { usePlayerStore } from "./playerStore";
import { isGameUnlocked } from "./gameAccess";
import { fetchSummary } from "./logPlaySession";

export default function Home() {
  return (
    <NameGate gameLabel="K1 Weekly Wonders">
      <HomeContent />
    </NameGate>
  );
}

const MotionLink = motion.create(Link);

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HomeContent() {
  const playerName = usePlayerStore((s) => s.playerName);
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);
  const [showStats, setShowStats] = useState(false);
  const [progressByGame, setProgressByGame] = useState({});

  // Purely cosmetic — if the stats server is unreachable, the homepage
  // still works fine, it just won't show the "best score" badges below.
  useEffect(() => {
    let cancelled = false;
    fetchSummary()
      .then((rows) => {
        if (cancelled) return;
        const mine = {};
        rows.forEach((row) => {
          if (row.playerName === playerName) mine[row.game] = row;
        });
        setProgressByGame(mine);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playerName]);

  const greeting = useMemo(() => timeGreeting(), []);

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8]">
      {/* Google Fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />

      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes pop-in {
          0% { transform: scale(0.7) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(6deg); }
        }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; }
        .animate-wiggle { animation: wiggle 2.5s ease-in-out infinite; }
        .animate-pop-in { animation: pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 50s linear infinite; }
        .animate-bob { animation: bob 2.4s ease-in-out infinite; }
        .animate-sway { animation: sway 3.2s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes kite-drift {
          0%, 100% { transform: translate(0, 0) rotate(-4deg); }
          50% { transform: translate(14px, -10px) rotate(4deg); }
        }
        .animate-kite-drift { animation: kite-drift 5s ease-in-out infinite; }
      `}</style>

      {/* Stats button — teachers only */}
      {isTeacher && (
        <motion.button
          type="button"
          onClick={() => setShowStats(true)}
          whileHover={{ y: -2 }}
          whileTap={{ y: 1 }}
          className="font-body fixed right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] sm:text-base"
        >
          📊 View Stats
        </motion.button>
      )}
      {showStats && <StatsPanel onClose={() => setShowStats(false)} />}

      {/* Sun, top corner */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 sm:h-44 sm:w-44 md:h-56 md:w-56">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-spin-slow">
          <g fill="#FFD93D">
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x="94" y="0" width="12" height="46" rx="6" transform={`rotate(${i * 30} 100 100)`} />
            ))}
          </g>
        </svg>
        <div className="absolute inset-[18%] rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 shadow-[0_0_40px_rgba(255,217,61,0.6)]" />
      </div>

      {/* Floating clouds & sparkles */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[12%] animate-float-slow text-5xl opacity-90 sm:text-6xl">☁️</div>
        <div className="absolute right-[14%] top-[20%] animate-float-slower text-4xl opacity-80 sm:text-5xl">☁️</div>
        <div className="absolute left-[22%] top-[68%] animate-float-slower text-3xl opacity-70 blur-[0.5px] sm:text-4xl">☁️</div>
        <div className="absolute bottom-[22%] right-[4%] animate-float-slow text-5xl opacity-90 sm:text-6xl">☁️</div>
        <div className="absolute left-[42%] top-[6%] animate-float-slower text-3xl opacity-60 blur-[0.5px]">☁️</div>
        <div className="absolute right-[20%] top-[8%] animate-kite-drift text-4xl opacity-90 sm:text-5xl">🪁</div>

        <div className="absolute left-[5%] top-[42%] animate-sparkle text-2xl sm:text-3xl">⭐</div>
        <div className="absolute right-[8%] top-[46%] animate-sparkle text-xl sm:text-2xl" style={{ animationDelay: "0.6s" }}>✨</div>
        <div className="absolute left-[47%] top-[10%] animate-sparkle text-xl sm:text-2xl" style={{ animationDelay: "1s" }}>✨</div>
        <div className="absolute bottom-[30%] right-[36%] animate-sparkle text-2xl sm:text-3xl" style={{ animationDelay: "0.3s" }}>⭐</div>
        <div className="absolute bottom-[36%] left-[10%] animate-sparkle text-lg sm:text-xl" style={{ animationDelay: "0.9s" }}>✨</div>
      </div>

      {/* Ground / hills */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-24 md:h-32">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="h-full w-full">
          <path fill="#6FCF57" fillOpacity="0.9" d="M0,110 C 240,190 480,30 720,90 C 960,150 1200,50 1440,110 L1440,200 L0,200 Z" />
          <path fill="#57B846" d="M0,150 C 260,90 500,190 760,140 C 1020,90 1260,180 1440,140 L1440,200 L0,200 Z" />
        </svg>
        <span className="absolute bottom-2 left-[18%] animate-sway text-2xl sm:bottom-4 sm:text-3xl">🌼</span>
        <span className="absolute bottom-3 right-[22%] animate-float-slower text-xl sm:bottom-5 sm:text-2xl">🦋</span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        {/* Title */}
        <div className="animate-pop-in text-center">
          <h1 className="font-heading text-[clamp(2.4rem,7vw,6rem)] font-bold leading-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.15)]">
            <span className="inline-block animate-wiggle text-yellow-300">K1</span>{" "}
            <span className="text-white">Weekly</span>{" "}
            <span className="text-pink-400">Wonders</span> 🌟
          </h1>
          <p className="font-body mt-3 text-[clamp(1rem,2.4vw,1.6rem)] font-bold text-white/90">
            {greeting}, {playerName}! Pick a game and let's play! 🎈
          </p>
          <button
            type="button"
            onClick={resetPlayer}
            className="font-body mt-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/30 hover:text-white"
          >
            Not {playerName}? Switch player
          </button>
        </div>

        {/* Game cards */}
        <div className="relative mt-10 w-full max-w-4xl sm:mt-14">
          <div className="pointer-events-none absolute inset-x-10 top-1/2 z-0 hidden -translate-y-1/2 border-t-[3px] border-dashed border-white/60 sm:block" />

          <div className="relative z-10 flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-8 md:gap-10 lg:gap-14">
            <GameCard
              to="/Game1"
              emoji="🧺"
              title="Week 1"
              subtitle="Count & win!"
              color="from-green-400 to-teal-400"
              ring="ring-green-200"
              delay={0.1}
              open={isGameUnlocked(1, isTeacher)}
              progress={progressByGame.game1}
            />
            <GameCard
              to="/Game2"
              emoji="🧸"
              title="Week 2"
              subtitle="Compare quantity!"
              color="from-cyan-400 to-blue-400"
              ring="ring-cyan-200"
              delay={0.22}
              open={isGameUnlocked(2, isTeacher)}
              progress={progressByGame.game2}
            />
            <GameCard
              to="/Game3"
              emoji="🐙"
              title="Week 3"
              subtitle="Around the Number!"
              color="from-purple-500 to-indigo-400 "
              ring="ring-purple-200"
              delay={0.34}
              open={isGameUnlocked(3, isTeacher)}
              progress={progressByGame.game3}
            />
          </div>
        </div>

        {/* Coming soon hint */}
        <div className="mt-8 hidden items-center gap-3 text-white/70 sm:flex">
          <span className="h-0.5 w-10 border-t-2 border-dashed border-white/50" />
          <span className="font-body text-sm font-bold">More wonders coming soon</span>
          <span className="h-0.5 w-10 border-t-2 border-dashed border-white/50" />
        </div>
      </div>
    </div>
  );
}

function GameCard({ to, emoji, title, subtitle, color, ring, delay, open, progress }) {
  return (
    <MotionLink
      to={open ? to : "#"}
      aria-disabled={!open}
      tabIndex={open ? 0 : -1}
      onClick={(e) => {
        if (!open) e.preventDefault();
      }}
      style={{ animationDelay: `${delay}s` }}
      whileHover={open ? { y: -8, rotate: -1 } : {}}
      whileTap={open ? { y: 2, scale: 0.98 } : {}}
      className={`group animate-pop-in relative flex w-[78vw] max-w-[260px] flex-col items-center overflow-hidden rounded-[2rem] bg-gradient-to-b p-6 shadow-[0_10px_0_rgba(0,0,0,0.15)] ring-8 sm:w-56 sm:p-7 md:w-64 lg:w-72 lg:p-8 xl:w-80 ${
        open ? `${color} ${ring}` : "from-slate-400 to-slate-500 ring-white/40 cursor-not-allowed"
      }`}
    >
      {open && (
        <span className="pointer-events-none absolute inset-y-0 -left-1/2 z-10 w-1/2 -skew-x-12 bg-white/25 transition-transform duration-700 ease-out group-hover:translate-x-[250%]" />
      )}

      {!open && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/25 backdrop-blur-[2px]">
          <span className="animate-bob text-6xl drop-shadow sm:text-7xl">🔒</span>
          <span className="font-body rounded-full bg-white/90 px-4 py-1 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
            Coming soon ✨
          </span>
        </div>
      )}

      <div
        className={`mb-3 text-6xl transition-transform duration-300 sm:text-7xl ${
          open ? "group-hover:scale-125 group-hover:rotate-6" : "opacity-40"
        }`}
      >
        {emoji}
      </div>

      <h2 className={`font-heading text-xl font-bold drop-shadow sm:text-2xl ${open ? "text-white" : "text-white/50"}`}>
        {title}
      </h2>

      <p className={`font-body mt-1 text-center text-sm font-semibold sm:text-base ${open ? "text-white/90" : "text-white/40"}`}>
        {subtitle}
      </p>

      {open && progress && (
        <div className="font-body mt-3 flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[11px] font-extrabold text-white sm:text-xs">
          <span>
            ⭐ {progress.bestStars}/{progress.totalRounds}
          </span>
          <span className="opacity-60">·</span>
          <span>🎮 {progress.playCount}x</span>
        </div>
      )}

      {open && (
        <span className="font-body mt-4 rounded-full bg-white/90 px-5 py-1.5 text-sm font-extrabold text-slate-700 shadow group-hover:bg-white">
          Play now →
        </span>
      )}
    </MotionLink>
  );
}