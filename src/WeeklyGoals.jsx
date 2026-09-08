import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { fetchPlayerWeekly } from './logPlaySession';
import { GAME_CATALOG } from './gameAccess';

// Maps a PlaySession game slug (game1…game9, bonusGame1) to a friendly
// emoji + title so the mission tiles can show *which* games were played.
// Unknown/legacy slugs fall back to a generic gamepad so nothing breaks.
const SLUG_INFO = Object.fromEntries(
  GAME_CATALOG.map((g) => [g.progressKey, { emoji: g.emoji, label: g.title }])
);
const FALLBACK_INFO = { emoji: '🎮', label: 'A game' };

function infoFor(slug) {
  return SLUG_INFO[String(slug).toLowerCase()] || FALLBACK_INFO;
}

// Distinct LOCAL calendar day for a timestamp — buckets by the player's own
// timezone, which is the one that matters for a "days learning" count.
function localDayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// The mission is "play 4 DIFFERENT games" so the slots fill with the distinct
// games discovered this week (in first-played order), not with repeat plays.
const TARGET = 4;

const FONT = "'Fredoka', system-ui, sans-serif";
// Frosted-glass chrome that matches the rest of the aurora beta page.
const GLASS_BACKGROUND =
  "linear-gradient(165deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)";
const TEXT_DARK = "#f8fafc";
const TEXT_SOFT = "#c7d2fe";
const TEXT_MUTED = "#8795cf";

const TILE_COLORS = [
  'linear-gradient(145deg,#38bdf8,#2563eb)',
  'linear-gradient(145deg,#a78bfa,#7c3aed)',
  'linear-gradient(145deg,#fb7185,#db2777)',
  'linear-gradient(145deg,#fbbf24,#f59e0b)',
];

function MissionTile({ filled, emoji, index, reduceMotion }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 360, damping: 18 }}
      className="relative flex aspect-square w-14 flex-col items-center justify-center rounded-2xl ring-2 sm:w-16"
      style={{
        background: filled
          ? TILE_COLORS[index % TILE_COLORS.length]
          : 'rgba(255,255,255,0.06)',
        boxShadow: filled
          ? '0 8px 18px -8px rgba(0,0,0,0.45)'
          : 'inset 0 0 0 1px rgba(255,255,255,0.12)',
      }}
    >
      {filled ? (
        <>
          <span className="text-2xl leading-none drop-shadow-sm sm:text-3xl">{emoji}</span>
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-white ring-2 ring-white/80">
            ✓
          </span>
        </>
      ) : (
        <span className="text-xl font-black text-white/25 sm:text-2xl">?</span>
      )}
    </motion.div>
  );
}

export default function WeeklyGoals({ classId, playerName }) {
  const [data, setData] = useState(null); // { plays, target, since }
  const [loading, setLoading] = useState(true);

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    let cancelled = false;
    if (!classId || !playerName) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    fetchPlayerWeekly(classId, playerName).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, playerName]);

  const { trophies, days, distinctGames, doneGames, completed } = useMemo(() => {
    const plays = data?.plays || [];
    const distinct = [];
    const seen = new Set();
    for (const p of plays) {
      const key = String(p.game).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        distinct.push(infoFor(key));
      }
    }
    const daySet = new Set(plays.map((p) => localDayKey(p.completedAt)));
    return {
      trophies: plays.length,
      days: daySet.size,
      distinctGames: distinct.length,
      doneGames: distinct.slice(0, TARGET),
      completed: distinct.length >= TARGET,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto mt-6 w-full max-w-3xl px-3 sm:px-6">
        <div
          className="flex items-center justify-center gap-2 rounded-[1.6rem] border-[3px] border-white/20 px-5 py-4 text-sm font-bold shadow-lg"
          style={{ fontFamily: FONT, color: TEXT_SOFT, background: GLASS_BACKGROUND, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent border-l-pink-400" />
          Checking your week…
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className="relative z-10 mx-auto mt-5 w-full max-w-3xl px-3 sm:mt-7 sm:px-6"
      style={{ fontFamily: FONT }}
    >
      {/* Top "always visible" stat chips — trophies + days learning */}
      <div className="flex items-stretch justify-center gap-2.5 sm:gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[3px] border-white/25 px-3 py-2 shadow-xl sm:flex-none sm:gap-2.5 sm:px-5 sm:py-2.5"
          style={{ background: GLASS_BACKGROUND, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
        >
          <motion.span
            animate={{ rotate: [-6, 8, -6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-2xl sm:text-3xl"
          >
            🏆
          </motion.span>
          <div className="leading-none text-center sm:text-left">
            <p
              className="text-2xl font-black sm:text-3xl"
              style={{
                color: '#ffca28',
                background: 'linear-gradient(135deg,#ffe486 0%,#ffca28 55%,#ff8a3d 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))',
              }}
            >
              {trophies}
            </p>
            <p
              className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] sm:text-[11px]"
              style={{ color: TEXT_SOFT }}
            >
              Weekly trophies
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[3px] border-white/25 px-3 py-2 shadow-xl sm:flex-none sm:gap-2.5 sm:px-5 sm:py-2.5"
          style={{ background: GLASS_BACKGROUND, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
        >
          <motion.span
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 1.7, repeat: Infinity }}
            className="text-2xl sm:text-3xl"
          >
            🔥
          </motion.span>
          <div className="leading-none text-center sm:text-left">
            <p
              className="text-2xl font-black sm:text-3xl"
              style={{
                background: 'linear-gradient(135deg,#ff9ecb 0%,#ff4fa3 50%,#d6127a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))',
              }}
            >
              {days}
            </p>
            <p
              className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] sm:text-[11px]"
              style={{ color: TEXT_SOFT }}
            >
              {days === 1 ? 'Day' : 'Days'} learning
            </p>
          </div>
        </motion.div>
      </div>

      {/* Weekly mission card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="relative mt-3 overflow-hidden rounded-[1.75rem] border-[3px] border-white/25 px-4 py-4 shadow-xl sm:mt-4 sm:rounded-[2rem] sm:px-6 sm:py-5"
        style={{ background: GLASS_BACKGROUND, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-10 text-violet-300">🎯</div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="text-2xl sm:text-3xl"
          >
            🎯
          </motion.span>
          <div className="min-w-0 flex-1">
            <p
              className="text-base font-black sm:text-lg"
              style={{
                color: TEXT_DARK,
                background: 'linear-gradient(135deg,#c4b5fd 0%,#f9a8d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {completed ? 'Mission complete!' : "This week's mission"}
            </p>
            <p className="text-[11px] font-bold sm:text-xs" style={{ color: TEXT_SOFT }}>
              {completed
                ? 'You played 4 different games — what a champion!'
                : `Play ${TARGET} different games before Friday!`}
            </p>
          </div>
          {completed && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 15 }}
              className="rounded-full px-3 py-1.5 text-xs font-black text-white shadow-md sm:text-sm"
              style={{
                background: 'linear-gradient(135deg,#4ade80 0%,#10b981 100%)',
                boxShadow: '0 6px 16px -6px rgba(16,185,129,0.7)',
              }}
            >
              🎉 Done!
            </motion.span>
          )}
        </div>

        {/* Mission slots — light up as each new game is discovered */}
        <div className="mt-4 flex items-center justify-center gap-2.5 sm:gap-3">
          {Array.from({ length: TARGET }).map((_, i) => (
            <MissionTile
              key={i}
              index={i}
              reduceMotion={reduceMotion}
              filled={Boolean(doneGames[i])}
              emoji={doneGames[i]?.emoji}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-3 flex-1 overflow-hidden rounded-full shadow-inner"
            style={{ background: 'rgba(0,0,0,0.28)' }}
          >
            <motion.div
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${Math.min(100, (distinctGames / TARGET) * 100)}%` }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 120, damping: 20 }}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6)',
                boxShadow: '0 0 12px rgba(167,139,250,0.6)',
              }}
            />
          </div>
          <span className="text-xs font-black sm:text-sm" style={{ color: TEXT_DARK }}>
            {Math.min(distinctGames, TARGET)}/{TARGET}
          </span>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>
          {distinctGames === 0
            ? 'Play your first game to start!'
            : completed
              ? 'See you next week for a new mission!'
              : `${TARGET - distinctGames} more ${TARGET - distinctGames === 1 ? 'game' : 'games'} to go!`}
        </p>
      </motion.div>
    </div>
  );
}
