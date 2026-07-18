import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchStats, fetchSummary, fetchAllPlays, deletePlayerGame } from './logPlaySession';
import { usePlayerStore } from './playerStore';

const GAME_LABELS = {
  game1: '🧺 Count & Win',
  game2: '🧸 Compare Quantity',
  game3: '🐙 Around the Number',
  game4: '🚀 Splits and Groups',
  game5: "🗝️ Part-Part-Whole",
};

// New games "just work" here: known slugs get their custom emoji/name above,
// anything else falls back to a generic "🎮 Game N" derived from the slug.
function gameLabel(key) {
  if (GAME_LABELS[key]) return GAME_LABELS[key];
  const num = key.match(/\d+/)?.[0];
  return num ? `🎮 Game ${num}` : key;
}

// Pulls just the number out of a game key (game2 -> 2) for the filter pills
// and for sorting the "Game" column naturally (game2 < game10).
function gameSortValue(key) {
  const match = key.match(/\d+/);
  return match ? Number(match[0]) : key;
}

// Formats a play's score consistently across the summary and all-plays views.
function formatStars(stars, totalRounds) {
  if (stars == null) return '—';
  return totalRounds ? `${stars}/${totalRounds} ⭐` : `${stars} ⭐`;
}

const DEVICE_ICONS = { mobile: '📱', tablet: '💻', desktop: '🖥️', unknown: '❔' };
const DEVICE_KIND_LABEL = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop', unknown: 'Unknown' };

// Older plays logged before device tracking was added won't have this field.
function formatDevice(device) {
  if (!device) return { icon: '❔', text: 'Unknown', title: 'No device info recorded for this play.' };
  const icon = DEVICE_ICONS[device.kind] || '❔';
  const kindLabel = DEVICE_KIND_LABEL[device.kind] || 'Unknown';
  const text = device.os && device.os !== 'Unknown OS' ? `${kindLabel} · ${device.os}` : kindLabel;
  const title = [device.browser, device.os, device.userAgent].filter(Boolean).join(' · ') || 'No further detail available.';
  return { icon, text, title };
}

const DEFAULT_SORT_DIR = {
  playerName: 'asc',
  game: 'asc',
  bestStreak: 'desc',
  lastPlayedAt: 'desc',
};

// Same idea as DEFAULT_SORT_DIR, but for the raw "show all plays" table,
// which sorts individual sessions rather than aggregated per-player rows.
const DEFAULT_SORT_DIR_ALL = {
  playerName: 'asc',
  game: 'asc',
  stars: 'desc',
  peakStreak: 'desc',
  completedAt: 'desc',
  deviceKind: 'asc',
};

// How long we wait before assuming a slow response is a cold-start
// rather than just normal network latency.
const SLOW_THRESHOLD_MS = 3000;

// How long an armed delete button stays "Confirm?" before resetting.
const CONFIRM_TIMEOUT_MS = 4000;

export default function StatsPanel({ onClose }) {
  // Access to this panel is already decided at the name/code prompt (Home
  // only renders the Stats button for teachers) — this just reads who's in.
  const teacherName = usePlayerStore((s) => s.playerName);
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);

  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [slow, setSlow] = useState(false);
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState([]);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('lastPlayedAt');
  const [sortDir, setSortDir] = useState('desc');

  // "Show all plays" reveals every individual session instead of the
  // one-row-per-player+game summary. Fetched lazily on first toggle and
  // cached — cheap to flip back and forth without re-hitting the server.
  const [showAll, setShowAll] = useState(false);
  const [allPlays, setAllPlays] = useState(null);
  const [allStatus, setAllStatus] = useState('idle'); // idle | loading | error | ready
  const [allSlow, setAllSlow] = useState(false);
  const [sortKeyAll, setSortKeyAll] = useState('completedAt');
  const [sortDirAll, setSortDirAll] = useState('desc');

  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const slowTimerRef = useRef(null);
  const allSlowTimerRef = useRef(null);
  const confirmTimerRef = useRef(null);

  const load = async () => {
    setStatus('loading');
    setSlow(false);
    slowTimerRef.current = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);

    try {
      const [statsData, summaryData] = await Promise.all([fetchStats(), fetchSummary()]);
      setStats(statsData);
      setSummary(summaryData);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      clearTimeout(slowTimerRef.current);
      setSlow(false);
    }
  };

  useEffect(() => {
    if (!teacherName) return undefined;
    load();
    return () => {
      clearTimeout(slowTimerRef.current);
      clearTimeout(allSlowTimerRef.current);
      clearTimeout(confirmTimerRef.current);
    };
  }, [teacherName]);

  const loadAllPlays = async () => {
    setAllStatus('loading');
    setAllSlow(false);
    allSlowTimerRef.current = setTimeout(() => setAllSlow(true), SLOW_THRESHOLD_MS);

    try {
      const data = await fetchAllPlays();
      setAllPlays(data);
      setAllStatus('ready');
    } catch (err) {
      console.error(err);
      setAllStatus('error');
    } finally {
      clearTimeout(allSlowTimerRef.current);
      setAllSlow(false);
    }
  };

  const handleToggleShowAll = () => {
    setShowAll((prev) => {
      const next = !prev;
      if (next && allPlays === null) loadAllPlays();
      return next;
    });
  };

  // Lock background scroll while the modal is open, and let Escape close it —
  // both matter on iPad, where the page behind can scroll under a tap-drag.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleSwitchTeacher = () => {
    resetPlayer();
    onClose?.();
  };

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key] || 'asc');
    }
  };

  const handleSortAll = (key) => {
    if (key === sortKeyAll) {
      setSortDirAll((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKeyAll(key);
      setSortDirAll(DEFAULT_SORT_DIR_ALL[key] || 'asc');
    }
  };

  const handleDeleteClick = (row) => {
    const key = `${row.playerName}::${row.game}`;
    setDeleteError(null);
    if (confirmDeleteKey === key) {
      performDelete(row, key);
    } else {
      setConfirmDeleteKey(key);
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteKey(null), CONFIRM_TIMEOUT_MS);
    }
  };

  const performDelete = async (row, key) => {
    clearTimeout(confirmTimerRef.current);
    setConfirmDeleteKey(null);
    setDeletingKey(key);
    try {
      await deletePlayerGame(row.game, row.playerName);
      await load();
      // The cached raw play list would now show sessions that no longer
      // exist — clear it so the next "show all" toggle refetches fresh.
      setAllPlays(null);
    } catch (err) {
      console.error(err);
      setDeleteError(`Couldn't delete ${row.playerName}'s ${gameLabel(row.game)} record — try again.`);
    } finally {
      setDeletingKey(null);
    }
  };

  const filteredSummary = useMemo(() => {
    let rows = filter === 'all' ? summary : summary.filter((row) => row.game === filter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((row) => row.playerName.toLowerCase().includes(q));
    return rows;
  }, [summary, filter, search]);

  const sortedSummary = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredSummary].sort((a, b) => {
      if (sortKey === 'lastPlayedAt') {
        return (new Date(a.lastPlayedAt).getTime() - new Date(b.lastPlayedAt).getTime()) * dir;
      }
      if (sortKey === 'game') {
        const av = gameSortValue(a.game);
        const bv = gameSortValue(b.game);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }, [filteredSummary, sortKey, sortDir]);

  const filteredAllPlays = useMemo(() => {
    if (!allPlays) return [];
    let rows = filter === 'all' ? allPlays : allPlays.filter((row) => row.game === filter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((row) => row.playerName.toLowerCase().includes(q));
    return rows;
  }, [allPlays, filter, search]);

  const sortedAllPlays = useMemo(() => {
    const dir = sortDirAll === 'asc' ? 1 : -1;
    return [...filteredAllPlays].sort((a, b) => {
      if (sortKeyAll === 'completedAt') {
        return (new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()) * dir;
      }
      if (sortKeyAll === 'game') {
        const av = gameSortValue(a.game);
        const bv = gameSortValue(b.game);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      }
      if (sortKeyAll === 'deviceKind') {
        const av = a.device?.kind || 'zzz';
        const bv = b.device?.kind || 'zzz';
        return av.localeCompare(bv) * dir;
      }
      const av = a[sortKeyAll];
      const bv = b[sortKeyAll];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }, [filteredAllPlays, sortKeyAll, sortDirAll]);

  const activeGameStats = filter === 'all' ? null : stats?.perGame.find((g) => g._id === filter);
  const activeGamePlayers = filter === 'all' ? null : summary.filter((row) => row.game === filter).length;
  const columnCount = filter === 'all' ? 5 : 4;
  // The all-plays table swaps the Actions column for Stars *and* adds a
  // Device column, so it has one more column than the summary table.
  const columnCountAll = columnCount + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={onClose}>
      <style>{`
        @keyframes wake-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .animate-wake-progress { animation: wake-progress 1.4s ease-in-out infinite; }
      `}</style>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
          <h2 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-lg font-bold text-slate-800 sm:text-2xl">
            📊 Who's been playing?
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={status === 'loading'}
              aria-label="Refresh stats"
              title="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition-colors active:scale-90 active:bg-slate-200 disabled:opacity-50 sm:h-11 sm:w-11 sm:hover:bg-slate-200"
            >
              <span className={status === 'loading' ? 'inline-block animate-spin' : ''}>🔄</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 transition-colors active:scale-90 active:bg-slate-200 sm:h-11 sm:w-11 sm:hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {status === 'ready' && stats && (
          <div
            className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-6"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <p className="text-sm font-semibold text-slate-500">
              Welcome back, <span className="font-bold text-slate-700">{teacherName}</span>! 👋
            </p>
            <button
              onClick={handleSwitchTeacher}
              className="shrink-0 text-xs font-bold text-slate-400 underline decoration-slate-300 underline-offset-2 active:text-slate-600"
            >
              Not you?
            </button>
          </div>
        )}

        {status === 'ready' && stats && (
          <div className="border-b border-slate-100 px-4 py-2.5 sm:px-6 sm:py-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} label="All games">
                🎯
              </FilterPill>
              {stats.perGame.map((g) => (
                <FilterPill
                  key={g._id}
                  active={filter === g._id}
                  onClick={() => setFilter(g._id)}
                  label={gameLabel(g._id)}
                >
                  {gameSortValue(g._id)}
                </FilterPill>
              ))}
            </div>
            <p
              className="mt-2 text-center text-xs font-bold text-slate-500 sm:text-sm"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              {filter === 'all' ? 'Showing all games' : gameLabel(filter)}
            </p>
          </div>
        )}

        {status === 'ready' && stats && (
          <div className="border-b border-slate-100 px-4 py-2.5 sm:px-6 sm:py-3">
            <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
              <div className="relative w-full max-w-xs">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search a player…"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-pink-300 focus:bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-300 transition-colors active:bg-slate-200 active:text-slate-500"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleShowAll}
                style={{ fontFamily: "'Nunito', sans-serif" }}
                className={`flex h-10 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-all active:scale-95 sm:h-11 sm:w-auto ${
                  showAll
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 active:bg-slate-200 sm:hover:bg-slate-200'
                }`}
              >
                {showAll ? '📋 Show summary' : '🧾 Show all plays'}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] font-semibold text-slate-400 sm:text-xs">
              {showAll
                ? 'Every individual play, most recent first.'
                : 'One row per player — tap "Show all plays" to see every play.'}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5" style={{ fontFamily: "'Nunito', sans-serif" }}>
          {status === 'loading' && !slow && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400 sm:py-16">
              <span className="animate-bounce text-4xl">⏳</span>
              <p className="font-bold">Loading stats…</p>
            </div>
          )}

          {status === 'loading' && slow && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-slate-400 sm:py-16">
              <span className="animate-pulse text-4xl">☕</span>
              <p className="font-bold text-slate-500">Waking things up…</p>
              <p className="max-w-xs text-xs">This can take a few extra seconds after a quiet spell. Hang tight!</p>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                <span className="animate-wake-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-sky-300 to-pink-300" />
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-slate-400 sm:py-16">
              <span className="text-4xl">😕</span>
              <p className="font-bold text-slate-500">Couldn't load the stats.</p>
              <p className="max-w-xs text-xs">Check your connection and try again.</p>
              <button
                onClick={load}
                className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 active:scale-95 active:bg-slate-200 sm:hover:bg-slate-200"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && stats && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${filter}-${showAll}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <div
                  className={
                    filter === 'all'
                      ? 'mx-auto grid max-w-xs grid-cols-2 gap-3'
                      : 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]'
                  }
                >
                  {filter === 'all' ? (
                    <>
                      <StatCard label="Total plays" value={stats.totalPlays} />
                      <StatCard label="Players" value={stats.uniquePlayers} />
                    </>
                  ) : activeGameStats ? (
                    <>
                      <StatCard label={gameLabel(filter)} value={activeGameStats.plays} sub="total plays" />
                      <StatCard label="Players" value={activeGamePlayers} />
                      <StatCard label="Avg score" value={activeGameStats.avgStars.toFixed(1)} sub="★ per play" />
                      <StatCard label="Best streak" value={activeGameStats.bestStreak} sub="🔥 in a row" />
                    </>
                  ) : (
                    <StatCard label={gameLabel(filter)} value={0} sub="no plays yet" />
                  )}
                </div>

                {deleteError && (
                  <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs font-bold text-rose-500">
                    {deleteError}
                  </p>
                )}

                {!showAll && (
                  <>
                    {/* Phones: stacked cards avoid the sideways-scrolling table below. */}
                    <div className="mt-6 space-y-2.5 sm:hidden">
                      {sortedSummary.length === 0 ? (
                        <EmptyState search={search} filter={filter} />
                      ) : (
                        sortedSummary.map((row) => {
                          const key = `${row.playerName}::${row.game}`;
                          const isConfirming = confirmDeleteKey === key;
                          const isDeleting = deletingKey === key;
                          return (
                            <div key={key} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <PlayerName name={row.playerName} timesPlayed={row.timesPlayed} />
                                  {filter === 'all' && (
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{gameLabel(row.game)}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteClick(row)}
                                  disabled={isDeleting}
                                  title={isConfirming ? 'Tap again to confirm' : `Delete ${row.playerName}'s ${gameLabel(row.game)} record`}
                                  className={`min-w-11 shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-all active:scale-90 disabled:opacity-50 ${
                                    isConfirming
                                      ? 'bg-rose-500 text-white shadow-sm'
                                      : 'bg-slate-50 text-slate-300 active:bg-rose-50 active:text-rose-500'
                                  }`}
                                >
                                  {isDeleting ? '…' : isConfirming ? 'Confirm?' : '🗑️'}
                                </button>
                              </div>
                              <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                                <span>🔥 {row.bestStreak} best streak</span>
                                <span>
                                  {new Date(row.lastPlayedAt).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Tablet/desktop: sortable table. */}
                    <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-slate-100 sm:block">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <SortHeader label="Player" sortKey="playerName" current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                            {filter === 'all' && (
                              <SortHeader label="Game" sortKey="game" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                            )}
                            <SortHeader label="Best streak" sortKey="bestStreak" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                            <SortHeader label="Last played" sortKey="lastPlayedAt" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                            <th className="px-3 py-1">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSummary.length === 0 ? (
                            <tr>
                              <td colSpan={columnCount} className="px-4 py-8 text-center font-bold text-slate-400">
                                {search.trim()
                                  ? `No players found matching "${search.trim()}".`
                                  : filter === 'all'
                                  ? 'No plays logged yet — go play a game! 🎮'
                                  : `No plays logged for ${gameLabel(filter)} yet.`}
                              </td>
                            </tr>
                          ) : (
                            sortedSummary.map((row) => {
                              const key = `${row.playerName}::${row.game}`;
                              const isConfirming = confirmDeleteKey === key;
                              const isDeleting = deletingKey === key;
                              return (
                                <tr key={key} className="border-t border-slate-100 transition-colors sm:hover:bg-slate-50">
                                  <td className="px-4 py-3.5 text-left font-bold text-slate-700">
                                    <PlayerName name={row.playerName} timesPlayed={row.timesPlayed} />
                                  </td>
                                  {filter === 'all' && (
                                    <td className="px-4 py-3.5 text-center text-slate-600">{gameLabel(row.game)}</td>
                                  )}
                                  <td className="px-4 py-3.5 text-center text-slate-600">🔥{row.bestStreak}</td>
                                  <td className="px-4 py-3.5 text-center text-slate-500">
                                    {new Date(row.lastPlayedAt).toLocaleString(undefined, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <button
                                      onClick={() => handleDeleteClick(row)}
                                      disabled={isDeleting}
                                      title={isConfirming ? 'Tap again to confirm' : `Delete ${row.playerName}'s ${gameLabel(row.game)} record`}
                                      className={`min-w-11 rounded-full px-3 py-2.5 text-xs font-bold transition-all active:scale-90 disabled:opacity-50 ${
                                        isConfirming
                                          ? 'bg-rose-500 text-white shadow-sm'
                                          : 'bg-transparent text-slate-300 active:bg-rose-50 active:text-rose-500 sm:hover:bg-rose-50 sm:hover:text-rose-500'
                                      }`}
                                    >
                                      {isDeleting ? '…' : isConfirming ? 'Confirm?' : '🗑️'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {showAll && (
                  <div className="mt-6">
                    {allStatus === 'loading' && !allSlow && (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400 sm:py-16">
                        <span className="animate-bounce text-4xl">⏳</span>
                        <p className="font-bold">Loading every play…</p>
                      </div>
                    )}

                    {allStatus === 'loading' && allSlow && (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-slate-400 sm:py-16">
                        <span className="animate-pulse text-4xl">☕</span>
                        <p className="font-bold text-slate-500">Waking things up…</p>
                        <p className="max-w-xs text-xs">This can take a few extra seconds after a quiet spell. Hang tight!</p>
                        <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                          <span className="animate-wake-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-sky-300 to-pink-300" />
                        </div>
                      </div>
                    )}

                    {allStatus === 'error' && (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-slate-400 sm:py-16">
                        <span className="text-4xl">😕</span>
                        <p className="font-bold text-slate-500">Couldn't load every play.</p>
                        <p className="max-w-xs text-xs">Check your connection and try again.</p>
                        <button
                          onClick={loadAllPlays}
                          className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 active:scale-95 active:bg-slate-200 sm:hover:bg-slate-200"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {allStatus === 'ready' && (
                      <>
                        {/* Phones: stacked cards, one per play. */}
                        <div className="space-y-2.5 sm:hidden">
                          {sortedAllPlays.length === 0 ? (
                            <EmptyState search={search} filter={filter} />
                          ) : (
                            sortedAllPlays.map((row, i) => {
                              const device = formatDevice(row.device);
                              return (
                                <div
                                  key={`${row.playerName}::${row.game}::${row.completedAt}::${i}`}
                                  className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
                                >
                                  <p className="font-bold text-slate-700">{row.playerName}</p>
                                  {filter === 'all' && (
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{gameLabel(row.game)}</p>
                                  )}
                                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                                    <span>{formatStars(row.stars, row.totalRounds)}</span>
                                    <span>🔥 {row.peakStreak}</span>
                                    <span>
                                      {new Date(row.completedAt).toLocaleString(undefined, {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      })}
                                    </span>
                                    <span title={device.title}>
                                      {device.icon} {device.text}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Tablet/desktop: sortable table. */}
                        <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 sm:block">
                          <table className="w-full min-w-[480px] text-sm">
                            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                              <tr>
                                <SortHeader label="Player" sortKey="playerName" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="left" />
                                {filter === 'all' && (
                                  <SortHeader label="Game" sortKey="game" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                )}
                                <SortHeader label="Stars" sortKey="stars" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                <SortHeader label="Streak" sortKey="peakStreak" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                <SortHeader label="Played at" sortKey="completedAt" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                <SortHeader label="Device" sortKey="deviceKind" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                              </tr>
                            </thead>
                            <tbody>
                              {sortedAllPlays.length === 0 ? (
                                <tr>
                                  <td colSpan={columnCountAll} className="px-4 py-8 text-center font-bold text-slate-400">
                                    {search.trim()
                                      ? `No players found matching "${search.trim()}".`
                                      : filter === 'all'
                                      ? 'No plays logged yet — go play a game! 🎮'
                                      : `No plays logged for ${gameLabel(filter)} yet.`}
                                  </td>
                                </tr>
                              ) : (
                                sortedAllPlays.map((row, i) => {
                                  const device = formatDevice(row.device);
                                  return (
                                    <tr
                                      key={`${row.playerName}::${row.game}::${row.completedAt}::${i}`}
                                      className="border-t border-slate-100 transition-colors sm:hover:bg-slate-50"
                                    >
                                      <td className="px-4 py-3.5 text-left font-bold text-slate-700">{row.playerName}</td>
                                      {filter === 'all' && (
                                        <td className="px-4 py-3.5 text-center text-slate-600">{gameLabel(row.game)}</td>
                                      )}
                                      <td className="px-4 py-3.5 text-center text-slate-600">{formatStars(row.stars, row.totalRounds)}</td>
                                      <td className="px-4 py-3.5 text-center text-slate-600">🔥{row.peakStreak}</td>
                                      <td className="px-4 py-3.5 text-center text-slate-500">
                                        {new Date(row.completedAt).toLocaleString(undefined, {
                                          dateStyle: 'medium',
                                          timeStyle: 'short',
                                        })}
                                      </td>
                                      <td className="px-4 py-3.5 text-center text-slate-600" title={device.title}>
                                        {device.icon} {device.text}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Small badge next to a player's name showing how many times they've played
// — only relevant in the summary view, where repeat plays are collapsed.
function PlayerName({ name, timesPlayed }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {name}
      {timesPlayed > 1 && (
        <span
          title={`Played ${timesPlayed} times`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-100 px-1.5 text-[10px] font-extrabold text-pink-600"
        >
          ×{timesPlayed}
        </span>
      )}
    </span>
  );
}

function EmptyState({ search, filter }) {
  if (search.trim()) return <p className="py-8 text-center font-bold text-slate-400">No players found matching "{search.trim()}".</p>;
  if (filter === 'all') return <p className="py-8 text-center font-bold text-slate-400">No plays logged yet — go play a game! 🎮</p>;
  return <p className="py-8 text-center font-bold text-slate-400">No plays logged for {gameLabel(filter)} yet.</p>;
}

function FilterPill({ active, onClick, children, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ fontFamily: "'Fredoka', sans-serif" }}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold transition-all active:scale-90 sm:h-11 sm:w-11 sm:text-lg ${
        active
          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
          : 'bg-slate-100 text-slate-600 active:bg-slate-200 sm:hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function SortHeader({ label, sortKey: key, current, dir, onSort, align = 'left' }) {
  const active = key === current;
  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th className="p-0">
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`flex w-full items-center gap-1 whitespace-nowrap px-4 py-3 font-bold uppercase tracking-wide transition-colors active:bg-slate-100 ${justify} ${
          active ? 'text-slate-800' : 'text-slate-500 sm:hover:text-slate-700'
        }`}
      >
        {label}
        <span className={`text-[9px] ${active ? 'text-pink-500 opacity-100' : 'opacity-0'}`}>
          {dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center transition-colors active:bg-slate-100">
      <p className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Fredoka', sans-serif" }}>
        {value ?? 0}
      </p>
      <p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-400">{sub}</p>}
    </div>
  );
}