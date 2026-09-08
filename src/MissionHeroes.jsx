import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { fetchWeeklyMission } from './logPlaySession';
import { GAME_CATALOG } from './gameAccess';

// Map a PlaySession game slug (game1…game9, bonusGame1) to a friendly emoji +
// title for the "which games they played" chips. Unknown slugs fall back to a
// generic gamepad so nothing ever breaks on legacy or renamed games.
const SLUG_INFO = Object.fromEntries(
  GAME_CATALOG.map((g) => [g.progressKey, { emoji: g.emoji, label: g.title }])
);

function infoFor(slug) {
  return SLUG_INFO[String(slug).toLowerCase()] || { emoji: '🎮', label: slug };
}

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [
  'linear-gradient(135deg,#ffd76a,#f59e0b)',
  'linear-gradient(135deg,#e2e8f0,#94a3b8)',
  'linear-gradient(135deg,#fdba74,#c2410c)',
];

// Teacher's view of who finished this week's mission — kids who played at
// least 4 different games since the last Friday. Loaded fresh whenever the
// component mounts (or the refresh button is tapped).
export default function MissionHeroes({ teacherCode }) {
  const [state, setState] = useState({
    status: 'loading', // loading | error | ready
    target: 4,
    completers: [],
  });
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const data = await fetchWeeklyMission(teacherCode);
      if (!mountedRef.current) return;
      setState({
        status: 'ready',
        target: data?.target ?? 4,
        completers: Array.isArray(data?.completers) ? data.completers : [],
      });
    } catch {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, status: 'error' }));
    }
  }, [teacherCode]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const { status, target, completers } = state;

  return (
    <div className="overflow-hidden rounded-3xl aura-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-white/5 to-pink-500/15 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-lg shadow-md sm:h-11 sm:w-11 sm:text-xl">
            🏆
          </span>
          <span style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-lg font-bold aura-heading sm:text-2xl">
            Weekly Mission Heroes
          </span>
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={status === 'loading'}
          aria-label="Refresh mission heroes"
          title="Refresh"
          className="aura-icon-btn h-9 w-9 text-lg active:scale-90 disabled:opacity-50 sm:h-11 sm:w-11"
        >
          <span className={status === 'loading' ? 'inline-block animate-spin' : ''}>🔄</span>
        </button>
      </div>

      <div className="px-4 py-3 sm:px-6">
        <p className="text-center text-sm font-bold aura-soft">
          Played <span className="font-black aura-text">{target} different games</span> this week 🎯
        </p>
        <p className="mt-0.5 text-center text-[11px] font-semibold aura-muted">
          Resets every Friday at noon — same as Weekly Champions
        </p>
      </div>

      <div className="flex-1 px-4 pb-5 sm:px-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 aura-muted">
            <span className="animate-bounce text-4xl">🏅</span>
            <p className="font-bold">Finding this week's heroes…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center aura-muted">
            <span className="text-4xl">😕</span>
            <p className="font-bold aura-soft">Couldn't load mission heroes.</p>
            <button
              type="button"
              onClick={load}
              className="rounded-full bg-violet-500/25 px-5 py-2.5 text-sm font-bold text-violet-100 active:scale-95 hover:bg-violet-500/40"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && completers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-12 text-center">
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="inline-block text-5xl"
            >
              🎯
            </motion.span>
            <p className="mt-3 text-base font-black aura-text">No heroes yet this week</p>
            <p className="mx-auto mt-1 max-w-xs text-sm font-semibold aura-soft">
              Kids unlock this by playing {target} different games before Friday. Let's get playing!
            </p>
          </div>
        )}

        {status === 'ready' && completers.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {completers.map((kid, i) => (
              <motion.div
                key={kid.playerName}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
                className="relative overflow-hidden rounded-2xl aura-card p-3.5 sm:p-4"
              >
                {i === 0 && (
                  <div className="pointer-events-none absolute -right-4 -top-4 text-7xl opacity-10">👑</div>
                )}
                <div className="flex items-center gap-3">
                  {/* Rank medal or number */}
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-sm sm:h-12 sm:w-12"
                    style={{
                      background: RANK_COLORS[i % RANK_COLORS.length],
                    }}
                  >
                    {i === 0 ? (
                      <span className="text-2xl">{MEDALS[0]}</span>
                    ) : (
                      <span className="text-base sm:text-lg">{i + 1}</span>
                    )}
                  </span>

                  {/* Avatar + name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-black aura-text sm:text-base">
                        {kid.playerName}
                      </p>
                      {i === 0 && (
                        <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-bold aura-muted">
                      {kid.distinctGames}/{target} games
                      <span className="mx-1.5 text-white/20">•</span>
                      <span className="text-amber-300">🏆 {kid.trophies}</span>
                    </p>
                  </div>
                </div>

                {/* The games they played */}
                {(kid.games || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(kid.games || []).map((slug) => {
                      const info = infoFor(slug);
                      return (
                        <span
                          key={slug}
                          title={info.label}
                          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold aura-soft ring-1 ring-white/10"
                        >
                          <span className="text-sm">{info.emoji}</span>
                          {info.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
