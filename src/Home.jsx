import React, { useEffect, useMemo, useState } from "react";
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

  // Warm the cache for each unlocked game once the homepage is idle, so the
  // first tap on a card doesn't have to wait on a fresh chunk download —
  // this matches the same import() specifiers used by the lazy() calls in
  // main.jsx, so the browser/bundler reuses this fetch instead of refetching.
  useEffect(() => {
    const prefetchGames = () => {
      if (isGameUnlocked(1, isTeacher)) import("./Game1");
      if (isGameUnlocked(2, isTeacher)) import("./Game2");
      if (isGameUnlocked(3, isTeacher)) import("./Game3");
      if (isGameUnlocked(4, isTeacher)) import("./Game4");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchGames, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(prefetchGames, 800);
    return () => clearTimeout(t);
  }, [isTeacher]);

  const greeting = useMemo(() => timeGreeting(), []);

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8]">
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
        @keyframes number-drift {
          0%, 100% { transform: translate(0, 0) rotate(-6deg); }
          50% { transform: translate(8px, -12px) rotate(6deg); }
        }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; will-change: transform; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; will-change: transform; }
        .animate-wiggle { animation: wiggle 2.5s ease-in-out infinite; will-change: transform; }
        .animate-pop-in { animation: pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; will-change: transform, opacity; }
        .animate-spin-slow { animation: spin-slow 50s linear infinite; will-change: transform; }
        .animate-bob { animation: bob 2.4s ease-in-out infinite; will-change: transform; }
        .animate-sway { animation: sway 3.2s ease-in-out infinite; transform-origin: bottom center; will-change: transform; }
        @keyframes kite-drift {
          0%, 100% { transform: translate(0, 0) rotate(-4deg); }
          50% { transform: translate(14px, -10px) rotate(4deg); }
        }
        .animate-kite-drift { animation: kite-drift 5s ease-in-out infinite; will-change: transform; }
        .animate-number-drift { animation: number-drift 5.5s ease-in-out infinite; will-change: transform; }
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

      {/* Floating clouds, numbers & sparkles */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[12%] animate-float-slow text-5xl opacity-90 sm:text-6xl">☁️</div>
        <div className="absolute right-[14%] top-[20%] animate-float-slower text-4xl opacity-80 sm:text-5xl">☁️</div>
        <div className="absolute left-[22%] top-[68%] animate-float-slower text-3xl opacity-70 blur-[0.5px] sm:text-4xl">☁️</div>
        <div className="absolute bottom-[22%] right-[4%] animate-float-slow text-5xl opacity-90 sm:text-6xl">☁️</div>
        <div className="absolute left-[42%] top-[6%] animate-float-slower text-3xl opacity-60 blur-[0.5px]">☁️</div>
        <div className="absolute right-[20%] top-[8%] animate-kite-drift text-4xl opacity-90 sm:text-5xl">🪁</div>

        {/* Playful number bubbles — a nod to the counting theme */}
        <div className="absolute left-[8%] top-[30%] flex h-10 w-10 animate-number-drift items-center justify-center rounded-full bg-white/90 font-heading text-lg font-extrabold text-teal-600 shadow-md sm:h-12 sm:w-12 sm:text-xl">
          2
        </div>
        <div
          className="absolute right-[10%] top-[36%] flex h-9 w-9 animate-number-drift items-center justify-center rounded-full bg-white/90 font-heading text-base font-extrabold text-violet-600 shadow-md sm:h-11 sm:w-11 sm:text-lg"
          style={{ animationDelay: "1.2s" }}
        >
          5
        </div>
        <div
          className="absolute bottom-[32%] left-[46%] flex h-8 w-8 animate-number-drift items-center justify-center rounded-full bg-white/90 font-heading text-sm font-extrabold text-orange-500 shadow-md sm:h-10 sm:w-10 sm:text-base"
          style={{ animationDelay: "0.6s" }}
        >
          9
        </div>

        <div className="absolute left-[5%] top-[46%] animate-sparkle text-2xl sm:text-3xl">⭐</div>
        <div className="absolute right-[6%] top-[50%] animate-sparkle text-xl sm:text-2xl" style={{ animationDelay: "0.6s" }}>✨</div>
        <div className="absolute bottom-[36%] right-[38%] animate-sparkle text-2xl sm:text-3xl" style={{ animationDelay: "0.3s" }}>⭐</div>
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
          <h1 className="font-heading text-[clamp(2.4rem,7vw,6rem)] font-bold leading-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.15)]">
            <span className="inline-block animate-wiggle text-yellow-300">K1</span>{" "}
            <span className="text-[#FFF6DA]">Weekly</span>{" "}
            <span className="text-pink-400">Wonders</span> 🌟
          </h1>
          <p className="font-body mt-3 text-[clamp(1rem,2.4vw,1.6rem)] font-medium text-white/90">
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
              title="Count & Win!"
              subtitle="Week 1"
              color="from-teal-400 to-emerald-500"
              ring="ring-teal-200"
              delay={0.1}
              open={isGameUnlocked(1, isTeacher)}
              progress={progressByGame.game1}
            />
            <GameCard
              to="/Game2"
              emoji="🧸"
              title="Compare Quantity!"
              subtitle="Week 2"
              color="from-sky-400 to-blue-500"
              ring="ring-sky-200"
              delay={0.2}
              open={isGameUnlocked(2, isTeacher)}
              progress={progressByGame.game2}
            />
            <GameCard
              to="/Game3"
              emoji="🐙"
              title="Around the Number!"
              subtitle="Week 3"
              color="from-violet-400 to-fuchsia-500"
              ring="ring-violet-200"
              delay={0.3}
              open={isGameUnlocked(3, isTeacher)}
              progress={progressByGame.game3}
            />
            <GameCard
              to="/Game4"
              emoji="🚀"
              title="Splits and Groups!"
              subtitle="Week 4"
              color="from-amber-400 to-orange-500"
              ring="ring-amber-200"
              delay={0.4}
              open={isGameUnlocked(4, isTeacher)}
              progress={progressByGame.game4}
            />
           
            <GameCard
              to="/Game5"
              emoji="🗝️"
              title="Part-Part-Whole!"
              subtitle="Week 5"
              color="from-rose-400 to-pink-500"
              ring="ring-rose-200"
              delay={0.5}
              open={isGameUnlocked(5, isTeacher)}
              progress={progressByGame.game5}
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

      <div className="fixed bottom-5 right-5 md:right-5 z-50">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-4 py-2 shadow-lg backdrop-blur-md">
          <div className="h-4 min-w-4 animate-pulse rounded-full bg-red-500/75" />

          <div className="leading-tight w-[15rem] md:w-[24rem]">
            <p className="font-body text-left text-xs md:text-md font-medium text-white/80">
              Game results are saved automatically and submitted to teachers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const GameCard = React.memo(function GameCard({ to, emoji, title, subtitle, color, ring, delay, open, progress }) {
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
      className={`group animate-pop-in relative flex w-[78vw] max-w-[260px] flex-col items-center overflow-hidden rounded-[2rem] bg-gradient-to-b p-6 shadow-[0_10px_0_rgba(0,0,0,0.15)] ring-8 transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 sm:w-56 sm:p-7 md:w-64 lg:w-72 lg:p-8 xl:w-80 ${
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

      <p className={`font-heading text-xl font-bold sm:text-xl ${open ? "text-slate-900" : "text-white/55"}`}>
        {title}
      </p>

      <p className={`font-body mt-1 text-center text-sm font-semibold sm:text-base ${open ? "text-white/90" : "text-white/40"}`}>
        {subtitle}
      </p>

      {open && (
        <span className="font-body mt-4 rounded-full bg-white/90 px-5 py-1.5 text-sm font-extrabold text-slate-700 shadow group-hover:bg-white">
          Play now →
        </span>
      )}
    </MotionLink>
  );
});