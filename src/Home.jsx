import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import StatsPanel from "./StatsPanel";
import NameGate from "./NameGate";
import NextGameTimer from "./NextGameTimer";
import { usePlayerStore } from "./playerStore";
import {
  useGameAccessStore,
  isGameUnlockedNow,
} from "./gameAccess";
import { fetchSummary } from "./logPlaySession";
import { Helmet } from "react-helmet-async";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>K1 Weekly Wonders | Interactive Kindergarten Numeracy Games</title>
        <meta
          name="description"
          content="K1 Weekly Wonders offers free interactive numeracy games for Kindergarten 1 students. Practice counting, number recognition, part-whole relationships, sequencing, and more."
        />
      </Helmet>

      <section className="hidden">
        <h1>Weekly Numeracy Games for Kindergarten 1</h1>
        <p>
          K1 Weekly Wonders provides interactive maths games that help
          Kindergarten children practise counting, number recognition,
          addition, subtraction and other early numeracy skills through
          engaging activities.
        </p>
      </section>

      <NameGate gameLabel="K1 Weekly Wonders">
        <HomeContent />
      </NameGate>
    </>
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
  const navigate = useNavigate();
  const playerName = usePlayerStore((s) => s.playerName);
  const classId = usePlayerStore((s) => s.classId);
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);
  const [showStats, setShowStats] = useState(false);
  const [progressByGame, setProgressByGame] = useState({});
  const [loadingTo, setLoadingTo] = useState(null);

  const gameAccessLoaded = useGameAccessStore((s) => s.loaded);
  const gameAccessLoadedClassId = useGameAccessStore((s) => s.loadedClassId);
  const gameAccessLoading = useGameAccessStore((s) => s.loading);
  const gameAccessError = useGameAccessStore((s) => s.error);
  const fetchGameAccess = useGameAccessStore((s) => s.fetchGameAccess);
  const gameAccessReady = gameAccessLoaded && gameAccessLoadedClassId === classId;

  useEffect(() => {
    if (classId) fetchGameAccess(classId);
  }, [classId, fetchGameAccess]);

  const unlocked = useGameAccessStore((state) => state.unlocked);
  const orderedGames = useGameAccessStore((state) => state.games);

  const numberedGames = useMemo(() => {
    let nextGameNumber = 0;

    return orderedGames.map((game) => ({
      ...game,
      displayNumber: game.isBonus ? 'B' : String(++nextGameNumber),
    }));
  }, [orderedGames]);

  useEffect(() => {
    let cancelled = false;
    if (!classId || !playerName) return undefined;
    fetchSummary({ classId, playerName })
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
  }, [classId, playerName]);

  useEffect(() => {
    if (!gameAccessReady) return undefined;

    const prefetchGames = () => {
      if (isGameUnlockedNow(1, isTeacher)) import("./Game1");
      if (isGameUnlockedNow(2, isTeacher)) import("./Game2");
      if (isGameUnlockedNow(3, isTeacher)) import("./Game3");
      if (isGameUnlockedNow(4, isTeacher)) import("./BonusGames/Game4/PhaserDemo");
      if (isGameUnlockedNow(5, isTeacher)) import("./Game5");
      if (isGameUnlockedNow(6, isTeacher)) import("./Game6");
      if (isGameUnlockedNow(7, isTeacher)) import("./BonusGames/Game 7/PhaserDemo");
      if (isGameUnlockedNow('b1', isTeacher)) import("./BonusGames/BonusGame1/PhaserDemo");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchGames, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(prefetchGames, 800);
    return () => clearTimeout(t);
    // Do not preload from an earlier class while the current class is loading.
  }, [gameAccessReady, isTeacher, unlocked]);

  const greeting = useMemo(() => timeGreeting(), []);

  const openGame = (to) => {
    setLoadingTo(to);
    requestAnimationFrame(() => {
      navigate(to);
    });
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />

      <style>{`
        @keyframes golden-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.05); }
        }

        @keyframes golden-shimmer {
          0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
          20% { opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateX(300%) skewX(-12deg); opacity: 0; }
        }

        .animate-golden-glow { animation: golden-glow 2.4s ease-in-out infinite; }
        .animate-golden-shimmer { animation: golden-shimmer 2.6s ease-in-out infinite; }

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

        /* will-change is intentionally left off the small decorative spans
           below (sparkles, drifting numbers, kite, sway). Pre-promoting
           every tiny infinite animation to its own GPU layer is what
           actually causes jank on older/low-memory phones: each layer is
           cheap in isolation but a dozen persistent layers add up fast.
           Only the two large, always-visible cloud drifts and the sun spin
           keep will-change, since those are worth the trade. */
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; will-change: transform; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; }
        .animate-wiggle { animation: wiggle 2.5s ease-in-out infinite; }
        .animate-pop-in { animation: pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 50s linear infinite; will-change: transform; }
        .animate-bob { animation: bob 2.4s ease-in-out infinite; }
        .animate-sway { animation: sway 3.2s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes kite-drift {
          0%, 100% { transform: translate(0, 0) rotate(-4deg); }
          50% { transform: translate(14px, -10px) rotate(4deg); }
        }
        .animate-kite-drift { animation: kite-drift 5s ease-in-out infinite; }
        .animate-number-drift { animation: number-drift 5.5s ease-in-out infinite; }

        /* Isolate the purely-decorative layer so its constant animation
           never triggers layout/paint work outside its own bounding box. */
        .decor-layer { contain: layout paint style; }

        /* Respect both explicit reduced-motion preference and the fact
           that low-power mode on older phones often implies it — this
           kills every infinite decorative loop at once, which is the
           single biggest win available for weak devices, with zero
           impact on animation quality for everyone else. */
        @media (prefers-reduced-motion: reduce) {
          .animate-float-slow,
          .animate-float-slower,
          .animate-wiggle,
          .animate-sparkle,
          .animate-spin-slow,
          .animate-bob,
          .animate-sway,
          .animate-kite-drift,
          .animate-number-drift,
          .animate-golden-glow,
          .animate-golden-shimmer {
            animation: none !important;
          }
        }
      `}</style>

      {isTeacher && (
       <div className="fixed px-2 md:px-6 max-w-6xl mx-auto top-3 left-0 right-0 z-50 flex justify-between ">
  <motion.button
    type="button"
    onClick={() => navigate("/game-access")}
    whileHover={{ y: -2 }}
    whileTap={{ y: 1 }}
    className="flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] sm:text-base"
  >
    🔓 Teacher controls
  </motion.button>

  <motion.button
    type="button"
    onClick={() => setShowStats(true)}
    whileHover={{ y: -2 }}
    whileTap={{ y: 1 }}
    className="flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] sm:text-base"
  >
    📊 View Stats
  </motion.button>
</div>
      )}

      {showStats && <StatsPanel onClose={() => setShowStats(false)} />}

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

      <div className="decor-layer pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[12%] animate-float-slow text-5xl opacity-90 sm:text-6xl">☁️</div>
        <div className="absolute right-[14%] top-[20%] animate-float-slower text-4xl opacity-80 sm:text-5xl">☁️</div>
        {/* Sub-decorations below are hidden on phones: fewer concurrent
            infinite animations where GPU/CPU headroom is smallest, while
            desktops/tablets keep the fuller scene. Blur was also dropped
            from the two "hazy" clouds — animating filter:blur together
            with transform forces the browser to re-rasterize every frame
            instead of just re-compositing, which is disproportionately
            expensive on older phones for a barely-visible effect. */}
        <div className="hidden sm:block absolute left-[22%] top-[68%] animate-float-slower text-3xl opacity-70 sm:text-4xl">☁️</div>
        <div className="absolute bottom-[22%] right-[4%] animate-float-slow text-5xl opacity-90 sm:text-6xl">☁️</div>
        <div className="hidden sm:block absolute left-[42%] top-[6%] animate-float-slower text-3xl opacity-60">☁️</div>
        <div className="hidden sm:block absolute right-[20%] top-[8%] animate-kite-drift text-4xl opacity-90 sm:text-5xl">🪁</div>

        <div className="absolute left-[8%] top-[30%] flex h-10 w-10 animate-number-drift items-center justify-center rounded-full bg-white/90 font-heading text-lg font-extrabold text-teal-600 shadow-md sm:h-12 sm:w-12 sm:text-xl">
          2
        </div>
        <div
          className="hidden sm:flex absolute right-[10%] top-[36%] h-9 w-9 animate-number-drift items-center justify-center rounded-full bg-white/90 font-heading text-base font-extrabold text-violet-600 shadow-md sm:h-11 sm:w-11 sm:text-lg"
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
        <div
          className="hidden sm:block absolute right-[6%] top-[50%] animate-sparkle text-xl sm:text-2xl"
          style={{ animationDelay: "0.6s" }}
        >
          ✨
        </div>
        <div
          className="absolute bottom-[36%] right-[38%] animate-sparkle text-2xl sm:text-3xl"
          style={{ animationDelay: "0.3s" }}
        >
          ⭐
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-24 md:h-32">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="h-full w-full">
          <path
            fill="#6FCF57"
            fillOpacity="0.9"
            d="M0,110 C 240,190 480,30 720,90 C 960,150 1200,50 1440,110 L1440,200 L0,200 Z"
          />
          <path
            fill="#57B846"
            d="M0,150 C 260,90 500,190 760,140 C 1020,90 1260,180 1440,140 L1440,200 L0,200 Z"
          />
        </svg>
        <span className="absolute bottom-2 left-[18%] animate-sway text-2xl sm:bottom-4 sm:text-3xl">🌼</span>
        <span className="absolute bottom-3 right-[22%] animate-float-slower text-xl sm:bottom-5 sm:text-2xl">🦋</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <NextGameTimer withTopOffset={isTeacher} />

        <div className="animate-pop-in mt-4 text-center">
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

        <div className="relative mt-10 w-full max-w-4xl sm:mt-14">
          <div className="pointer-events-none absolute inset-x-10 top-1/2 z-0 hidden -translate-y-1/2 border-t-[3px] border-dashed border-white/60 sm:block" />

          {gameAccessReady ? (
            <div className="relative z-10 flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-8 md:gap-10 lg:gap-14">
              {numberedGames.map((game, index) => {
               const isUnlockedForPlayers = Boolean(unlocked[game.key]);
               const isOpen = isTeacher || isUnlockedForPlayers;

               return (
                 <GameCard
      key={game.key}
      to={game.to}
      number={game.displayNumber}
      emoji={game.emoji}
      title={game.title}
      subtitle={game.subtitle}
      gradient={game.gradient}
      ring={game.ring}
      delay={0.1 + index * 0.05}
      open={isOpen}
       progress={progressByGame[game.progressKey]}
       shine={game.shiny}
       teacherAccessUnlocked={isTeacher ? isUnlockedForPlayers : null}
       onOpen={() => openGame(game.to)}
    />
              );
              })}
            </div>
          ) : (
            <div className="relative z-10 flex min-h-64 flex-col items-center justify-center gap-3 rounded-[2rem] bg-white/20 px-6 text-center text-white shadow-inner backdrop-blur-sm">
              {gameAccessError ? (
                <>
                  <span className="text-4xl">😕</span>
                  <p className="font-body font-bold">We couldn't load your class games.</p>
                  <button type="button" onClick={() => fetchGameAccess(classId)} className="font-body rounded-full bg-white px-5 py-2 text-sm font-bold text-sky-700 shadow-sm">Try again</button>
                </>
              ) : (
                <>
                  <span className="h-9 w-9 animate-spin rounded-full border-4 border-white/90 border-t-transparent" />
                  <p className="font-body font-bold">{gameAccessLoading ? 'Loading your class games…' : 'Preparing your class games…'}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 hidden items-center gap-3 text-white/70 sm:flex">
          <span className="h-0.5 w-10 border-t-2 border-dashed border-white/50" />
          <span className="font-body text-sm font-bold">More wonders coming soon</span>
          <span className="h-0.5 w-10 border-t-2 border-dashed border-white/50" />
        </div>
      </div>

      {loadingTo && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55">
          <div className="rounded-3xl bg-white px-6 py-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-sky-300 border-t-transparent" />
              <p className="font-body text-sm font-bold text-slate-700">
                Loading game...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-50 md:right-5">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-4 py-2 shadow-lg">
          <div className="h-4 min-w-4 animate-pulse rounded-full bg-red-500/75" />
          <div className="w-[15rem] leading-tight md:w-[24rem]">
            <p className="font-body text-left text-xs font-medium text-white/80 md:text-md">
              Game results are saved automatically and submitted to teachers.
            </p>
          </div>
        </div>
      </div>

      <footer className="relative z-10 mt-10 w-full px-4 pb-28 sm:mt-12 sm:pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/30 bg-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.10)]">
            <div className="h-1 w-full bg-gradient-to-r from-yellow-300 via-pink-300 to-sky-300" />

            <div className="flex flex-col items-center gap-2 px-5 py-4 text-center sm:px-7 sm:py-5">
              <p className="font-body text-[0.78rem] font-extrabold uppercase tracking-[0.22em] text-slate-700">
                K1 Weekly Wonders
              </p>

              <p className="font-body text-sm text-slate-800 sm:text-base">
                © {new Date().getFullYear()} · Created by Towhid Hossain and Siti Soleha
              </p>

              <p className="font-body text-xs font-medium text-slate-700/80 sm:text-sm">
                A collaborative numeracy project for joyful early learning.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const GameCard = React.memo(function GameCard({
  to,
  emoji,
  title,
  subtitle,
  gradient,
  ring,
  delay,
  open,
  progress,
  shine,
  teacherAccessUnlocked,
  number,
  onOpen,
}) {
  const isShiny = shine && open;

  return (
    <div className="relative">
      {isShiny && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-yellow-200 via-amber-300 to-pink-200 blur-2xl"
        />
      )}

      {number !== "B" && (
        <div className="absolute left-3 top-3 z-30 flex h-9 min-w-9 items-center justify-center rounded-full bg-white/70 px-2 text-xl font-extrabold text-slate-900/70 shadow-md">
          {number}
        </div>
      )}

      {teacherAccessUnlocked !== null && (
        <span
          role="img"
          aria-label={teacherAccessUnlocked ? "Unlocked for players" : "Locked for players"}
          title={teacherAccessUnlocked ? "Unlocked for players" : "Locked for players"}
          className={`absolute top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 text-lg shadow-md ${
            teacherAccessUnlocked
              ? "bg-emerald-500 text-white"
              : "bg-slate-700 text-white"
          } ${number !== "B" ? "left-14" : "left-3"}`}
        >
          {teacherAccessUnlocked ? "🔓" : "🔒"}
        </span>
      )}

      <MotionLink
        to={open ? to : "#"}
        aria-disabled={!open}
        tabIndex={open ? 0 : -1}
        onClick={(e) => {
          if (!open) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          onOpen?.();
        }}
        style={{
          animationDelay: `${delay}s`,
          background: open ? gradient : "linear-gradient(135deg,#94a3b8,#64748b)",
        }}
        whileHover={open ? { y: -8, rotate: -1 } : {}}
        whileTap={open ? { y: 2, scale: 0.98 } : {}}
        className={`group animate-pop-in relative flex h-[20rem] w-[86vw] min-w-[260px] max-w-[300px] flex-col overflow-hidden rounded-[2.25rem] p-6 shadow-[0_14px_0_rgba(0,0,0,0.16)] ring-8 transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 sm:h-[24.5rem] sm:w-[18rem] md:w-[19rem] lg:w-[20rem] ${
          open ? ring : "ring-white/40 cursor-not-allowed"
        } ${isShiny ? "ring-yellow-200" : ""}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at top left, rgba(255,255,255,0.42), transparent 34%), radial-gradient(circle at bottom right, rgba(255,255,255,0.16), transparent 42%)",
          }}
        />

        {isShiny && (
          <span className="pointer-events-none absolute right-[-2.6rem] top-3 z-30 w-40 rotate-45 bg-gradient-to-r from-yellow-300 to-amber-500 py-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md">
            ✨ New
          </span>
        )}

        {number === "B" && (
          <span className="pointer-events-none absolute left-0 right-0 top-0 z-30 w-full bg-gradient-to-r from-sky-400/55 to-red-500/55 py-1 text-center text-[11px] uppercase tracking-wide text-white shadow-md">
            Bonus
          </span>
        )}

        {open && (
          <span
            className={`pointer-events-none absolute inset-y-0 -left-1/2 z-10 w-1/2 -skew-x-12 transition-transform duration-700 ease-out group-hover:translate-x-[250%] ${
              isShiny ? "animate-golden-shimmer bg-white/40" : "bg-white/25"
            }`}
          />
        )}

        {!open && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/35">
            <span className="animate-bob text-6xl drop-shadow sm:text-7xl">🔒</span>
            <span className="rounded-full bg-white/90 px-4 py-1 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
              Coming soon ✨
            </span>
          </div>
        )}

<div className="relative z-10 flex h-full flex-col items-center">
  <div className="mt-6 flex h-24 items-center justify-center">
            <div
              className={`text-7xl transition-transform duration-300 sm:text-7xl ${
                open ? "group-hover:scale-125 group-hover:rotate-6" : "opacity-40"
              }`}
            >
              {emoji}
            </div>
          </div>

          <p
            className={`font-heading mt-2 min-h-[3rem] text-center text-xl font-bold leading-tight sm:text-[1.35rem] ${
              open ? "text-slate-900" : "text-white/55"
            }`}
          >
            {title}
          </p>

          <p
            className={`font-body mt-2 min-h-[4rem] whitespace-pre-line text-center text-sm leading-snug sm:text-[0.98rem] ${
              open ? "text-white/92" : "text-white/40"
            }`}
          >
            {subtitle}
          </p>

          {open && (
            <span className="font-body mt-auto rounded-full bg-white/92 px-5 py-1.5 text-sm font-extrabold text-slate-700 shadow transition-colors group-hover:bg-white">
              Play now →
            </span>
          )}
        </div>
      </MotionLink>
    </div>
  );
});
