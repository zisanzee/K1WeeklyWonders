import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchStats, fetchSummary, fetchPlaysPage, deletePlayerGame } from './logPlaySession';
import { usePlayerStore } from './playerStore';

const GAME_LABELS = {
  game1: '🧺 Count & Win',
  game2: '🧸 Compare Quantities',
  game3: '🐙 Which Number?',
  game4: '🎲 Compare Die and Dominoes',
  game5: '🚀 Making & Splitting Groups',
  game6: "🗝️ Part-Part-Whole",
  game7: "🥚 Mama Bird's Eggs",
  game8: "🍕 Pizza Order!",
  game9: "🦜 Polly's Treasure Quest",
  bonusGame1: "9️⃣ Number Pop",
};

// New games "just work" here: known slugs get their custom emoji/name above,
// anything else falls back to a generic "🎮 Game N" derived from the slug.
function gameLabel(key) {
  if (GAME_LABELS[key]) return GAME_LABELS[key];
  const num = key.match(/\d+/)?.[0];
  return num ? `🎮 Game ${num}` : key;
}

// Splits a "🧺 Count & Win"-style label into its emoji and name, so the
// dropdown can show the emoji on its own (trigger button) and both together
// (menu rows). Every entry in GAME_LABELS follows "emoji name", and the
// gameLabel() fallback ("🎮 Game N") does too, so a plain first-space split
// is all this needs.
function splitLabel(label) {
  const idx = label.indexOf(' ');
  if (idx === -1) return { emoji: '', name: label };
  return { emoji: label.slice(0, idx), name: label.slice(idx + 1) };
}

// Formats a play's score consistently across the summary and all-plays views.
function formatStars(stars, totalRounds) {
  if (stars == null) return '—';
  return totalRounds ? `${stars}/${totalRounds} ⭐` : `${stars} ⭐`;
}

// Bonus games (the Phaser time-trials) don't fit the round/star/streak shape
// the numbered games use — "streak" is always 0 and "stars" is always 1/1
// for them, so the panel shows time-taken in those spots instead.
function isBonusGame(gameKey) {
  return /^bonusGame/i.test(gameKey || '');
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

// Rows requested per page for the streaming lists.
const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// usePaginatedList — drives one server-paginated, infinite-scrolling list.
// The server owns filtering (game + name search), sorting, and paging, so the
// client just asks for a page and appends rows as a sentinel scrolls into
// view. Re-fetches from page 1 whenever `params` (filter/search/sort) changes.
// ---------------------------------------------------------------------------
function usePaginatedList({ fetcher, params, active = true, refetchToken = 0 }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState(active ? 'loading' : 'idle'); // idle|loading|error|ready
  const [appending, setAppending] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const pageRef = useRef(1);
  const busyRef = useRef(false);
  const sentinelRef = useRef(null);

  // loadPage closes over the current fetcher + params so it always queries
  // with the latest filter/search/sort. It's recreated when those change,
  // which also re-arms the scroll observer below.
  const loadPage = useCallback(async ({ page, replace }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (replace) {
      // Wipe the previous rows immediately so a filter/search/sort change
      // never flashes stale data under the new criteria.
      setStatus('loading');
      setRows([]);
      setAppending(false);
      setLoadMoreError(false);
    } else {
      setAppending(true);
      setLoadMoreError(false);
    }
    try {
      const data = await fetcher({ ...params, page, limit: PAGE_SIZE });
      const nextRows = Array.isArray(data?.rows) ? data.rows : [];
      pageRef.current = page;
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
      setRows((prev) => (replace ? nextRows : [...prev, ...nextRows]));
      setStatus('ready');
    } catch (err) {
      console.error(err);
      if (replace) {
        setStatus('error');
        setRows([]);
      } else {
        setLoadMoreError(true);
      }
    } finally {
      busyRef.current = false;
      if (!replace) setAppending(false);
    }
  }, [fetcher, params]);

  // Load the first page whenever the list becomes active, its params change,
  // or the parent asks for a forced refresh (refetchToken bump).
  useEffect(() => {
    if (!active) return undefined;
    loadPage({ page: 1, replace: true });
  }, [active, params, refetchToken, loadPage]);

  // Infinite scroll: when a page of rows is loaded and more remain, watch the
  // sentinel element and pull the next page as it scrolls into view. A large
  // positive rootMargin pre-fetches just before the teacher reaches the end.
  useEffect(() => {
    if (!active || status !== 'ready' || !hasMore) return undefined;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !busyRef.current) {
          loadPage({ page: pageRef.current + 1, replace: false });
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, status, hasMore, loadPage]);

  const loadMore = useCallback(() => {
    if (!busyRef.current) loadPage({ page: pageRef.current + 1, replace: false });
  }, [loadPage]);

  const retry = useCallback(() => {
    loadPage({ page: 1, replace: true });
  }, [loadPage]);

  return { rows, total, hasMore, status, appending, loadMoreError, sentinelRef, loadMore, retry };
}

// Small spinner + scroll-trigger used at the bottom of each streaming list.
// The invisible sentinel is what the IntersectionObserver watches; the visible
// bits are just feedback while an extra page is being fetched.
function ListFooter({ list }) {
  // Pull the fields out into locals so the shared `list` object (which also
  // carries the scroll sentinel ref) isn't read during render.
  const { status, loadMoreError, hasMore, appending, sentinelRef, loadMore } = list;
  if (status !== 'ready') return null;
  if (loadMoreError) {
    return (
      <div className="flex justify-center py-4">
        <button
          onClick={loadMore}
          className="rounded-full bg-violet-500/25 px-5 py-2.5 text-sm font-bold text-violet-100 active:scale-95 hover:bg-violet-500/40"
        >
          Couldn't load more — tap to retry
        </button>
      </div>
    );
  }
  if (!hasMore && !appending) {
    // Nothing left to fetch (and nothing failed) — no footer at all.
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {/* Sentinel only exists while more rows might follow; the observer
          effect re-attaches to it whenever hasMore flips. */}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px w-full" />}
      {appending && (
        <span className="flex items-center gap-1.5 text-xs font-semibold aura-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-pink-400/40 border-t-pink-400" />
          Loading more…
        </span>
      )}
    </div>
  );
}

// Shared "loading / error / empty" states for a single streaming list region.
function ListState({ list, kind }) {
  if (list.status === 'loading' || (list.status === 'ready' && list.rows.length === 0 && list.total === 0)) {
    if (list.status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-10 aura-muted sm:py-16">
          <span className="animate-bounce text-4xl">⏳</span>
          <p className="font-bold">Loading {kind === 'all' ? 'every play' : 'stats'}…</p>
        </div>
      );
    }
    return null; // ready + empty handled by the caller's EmptyState below.
  }
  if (list.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center aura-muted sm:py-16">
        <span className="text-4xl">😕</span>
        <p className="font-bold aura-soft">Couldn't load {kind === 'all' ? 'every play' : 'the stats'}.</p>
        <p className="max-w-xs text-xs">Check your connection and try again.</p>
        <button
          onClick={list.retry}
          className="rounded-full bg-violet-500/25 px-5 py-2.5 text-sm font-bold text-violet-100 active:scale-95 hover:bg-violet-500/40"
        >
          Try again
        </button>
      </div>
    );
  }
  return null;
}

export default function StatsPanel({ onClose, embedded = false }) {
  // Access to this panel is already decided at the name/code prompt (Home
  // only renders the Stats button for teachers) — this just reads who's in.
  const teacherName = usePlayerStore((s) => s.playerName);
  const teacherCode = usePlayerStore((s) => s.teacherCode);
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);

  const [statsStatus, setStatsStatus] = useState('loading'); // loading | error | ready
  const [slow, setSlow] = useState(false);
  const [stats, setStats] = useState(null);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState('lastPlayedAt');
  const [sortDir, setSortDir] = useState('desc');

  // "Show all plays" reveals every individual session instead of the
  // one-row-per-player+game summary.
  const [showAll, setShowAll] = useState(false);
  const [sortKeyAll, setSortKeyAll] = useState('completedAt');
  const [sortDirAll, setSortDirAll] = useState('desc');

  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Bumped on manual refresh / after a delete so both lists re-fetch page 1
  // even when their other params (filter/sort/search) didn't change.
  const [version, setVersion] = useState(0);

  const slowTimerRef = useRef(null);
  const confirmTimerRef = useRef(null);

  const loadStats = useCallback(async () => {
    setStatsStatus('loading');
    setSlow(false);
    slowTimerRef.current = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    try {
      const data = await fetchStats(teacherCode);
      setStats(data);
      setStatsStatus('ready');
    } catch (err) {
      console.error(err);
      setStatsStatus('error');
    } finally {
      clearTimeout(slowTimerRef.current);
      setSlow(false);
    }
  }, [teacherCode]);

  // Search is debounced so typing doesn't fire a server query per keystroke —
  // only the settled term (or an empty one) triggers a re-fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!teacherName) return undefined;
    loadStats();
    return () => {
      clearTimeout(slowTimerRef.current);
      clearTimeout(confirmTimerRef.current);
    };
  }, [teacherName, teacherCode, loadStats]);

  // Params for the two server-backed lists. Both share the game filter + name
  // search, but keep independent sort state (summary vs raw sessions). A
  // manual refresh is handled separately via the version/refetchToken, which
  // is deliberately NOT part of these objects so it never hits the API.
  const summaryParams = useMemo(
    () => ({
      teacherCode,
      game: filter === 'all' ? undefined : filter,
      q: debouncedSearch || undefined,
      sortKey,
      sortDir,
    }),
    [teacherCode, filter, debouncedSearch, sortKey, sortDir]
  );

  const allPlaysParams = useMemo(
    () => ({
      teacherCode,
      game: filter === 'all' ? undefined : filter,
      q: debouncedSearch || undefined,
      sortKey: sortKeyAll,
      sortDir: sortDirAll,
    }),
    [teacherCode, filter, debouncedSearch, sortKeyAll, sortDirAll]
  );

  const summaryList = usePaginatedList({
    fetcher: fetchSummary,
    params: summaryParams,
    active: Boolean(teacherCode),
    refetchToken: version,
  });

  const allPlaysList = usePaginatedList({
    fetcher: fetchPlaysPage,
    params: allPlaysParams,
    active: Boolean(teacherCode) && showAll,
    refetchToken: version,
  });

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    loadStats();
  }, [loadStats]);

  const handleToggleShowAll = () => {
    setShowAll((prev) => !prev);
  };

  // Lock background scroll while the modal is open, and let Escape close it —
  // both matter on iPad, where the page behind can scroll under a tap-drag.
  // When embedded as a tab on the teacher-controls page, neither applies.
  useEffect(() => {
    if (embedded) return undefined;
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
  }, [onClose, embedded]);

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
      await deletePlayerGame(row.game, row.playerName, teacherCode);
      // Deleting shrinks the dataset, so rebuild from the first page.
      refresh();
    } catch (err) {
      console.error(err);
      setDeleteError(`Couldn't delete ${row.playerName}'s ${gameLabel(row.game)} record — try again.`);
    } finally {
      setDeletingKey(null);
    }
  };

  // Options for the game-filter dropdown: "All games" plus one entry per
  // game that's actually shown up in the data, in server order. Counts are
  // per-game play totals from the (small) stats payload.
  const filterOptions = useMemo(() => {
    const opts = [{ key: 'all', emoji: '🎯', name: 'All games' }];
    (stats?.perGame || []).forEach((g) => {
      opts.push({ key: g._id, ...splitLabel(gameLabel(g._id)) });
    });
    return opts;
  }, [stats]);

  const filterCounts = useMemo(() => {
    const counts = { all: stats?.totalPlays ?? 0 };
    (stats?.perGame || []).forEach((g) => {
      counts[g._id] = g.plays;
    });
    return counts;
  }, [stats]);

  // Per-game header cards come from the aggregated stats payload (full-class
  // math), not from the paginated lists — correct regardless of which page of
  // rows is currently loaded.
  const activeGameStats = filter === 'all' ? null : (stats?.perGame || []).find((g) => g._id === filter) || null;
  const activeIsBonus = filter !== 'all' && isBonusGame(filter);
  const columnCount = filter === 'all' ? 5 : 4;
  // The all-plays table swaps the Actions column for Stars *and* adds a
  // Device column, so it has one more column than the summary table.
  const columnCountAll = columnCount + 1;
  // When a single game is filtered the column can say exactly what it shows;
  // mixed ("all games") rows can be either kind, so the header stays neutral
  // and each cell decides for itself.
  const streakOrTimeHeader = filter === 'all' ? 'Streak / Time' : activeIsBonus ? 'Time' : 'Streak';

  const noRowsForList = (list) => list.status === 'ready' && list.total === 0;

  const inner = (
    <>
      <style>{`
        @keyframes wake-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .animate-wake-progress { animation: wake-progress 1.4s ease-in-out infinite; }
      `}</style>
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-pink-500/15 via-white/5 to-purple-500/15 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-lg shadow-md sm:h-11 sm:w-11 sm:text-xl">
              📊
            </span>
            <span style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-lg font-bold aura-heading sm:text-2xl">
              Who's been playing?
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={statsStatus === 'loading'}
              aria-label="Refresh stats"
              title="Refresh"
              className="aura-icon-btn h-9 w-9 text-lg active:scale-90 disabled:opacity-50 sm:h-11 sm:w-11"
            >
              <span className={statsStatus === 'loading' ? 'inline-block animate-spin' : ''}>🔄</span>
            </button>
            {!embedded && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="aura-icon-btn h-9 w-9 text-lg font-bold active:scale-90 sm:h-11 sm:w-11"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {statsStatus === 'ready' && stats && (
          <div
            className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 sm:px-6"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <p className="text-sm font-semibold aura-muted">
              Welcome back, <span className="font-bold aura-text">{teacherName}</span>! 👋
            </p>
            <button
              onClick={handleSwitchTeacher}
              className="shrink-0 text-xs font-bold aura-muted underline decoration-white/40 underline-offset-2 hover:text-indigo-200"
            >
              Not you?
            </button>
          </div>
        )}

        {statsStatus === 'ready' && stats && (
          <div className="border-b border-white/10 px-4 py-3 sm:px-6">
            <div className="flex justify-center">
              <GameFilterDropdown options={filterOptions} value={filter} onChange={setFilter} counts={filterCounts} />
            </div>
          </div>
        )}

        {statsStatus === 'ready' && stats && (
          <div className="border-b border-white/10 px-4 py-2.5 sm:px-6 sm:py-3">
            <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
              <div className="relative w-full max-w-xs">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 aura-muted">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search a player…"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                  className="aura-input py-2.5 pl-9 pr-9 text-sm font-semibold"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-indigo-200 active:bg-white/10"
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
                    : 'bg-white/10 text-white active:bg-white/20 sm:hover:bg-white/20'
                }`}
              >
                {showAll ? '📋 Show summary' : '🧾 Show all plays'}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] font-semibold aura-muted sm:text-xs">
              {showAll
                ? 'Every individual play — keeps loading as you scroll.'
                : 'One row per player — rows load in as you scroll.'}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5" style={{ fontFamily: "'Nunito', sans-serif" }}>
          {statsStatus === 'loading' && !slow && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 aura-muted sm:py-16">
              <span className="animate-bounce text-4xl">⏳</span>
              <p className="font-bold">Loading stats…</p>
            </div>
          )}

          {statsStatus === 'loading' && slow && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center aura-muted sm:py-16">
              <span className="animate-pulse text-4xl">☕</span>
              <p className="font-bold aura-soft">Waking things up…</p>
              <p className="max-w-xs text-xs">This can take a few extra seconds after a quiet spell. Hang tight!</p>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <span className="animate-wake-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-sky-300 to-pink-300" />
              </div>
            </div>
          )}

          {statsStatus === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center aura-muted sm:py-16">
              <span className="text-4xl">😕</span>
              <p className="font-bold aura-soft">Couldn't load the stats.</p>
              <p className="max-w-xs text-xs">Check your connection and try again.</p>
              <button
                onClick={refresh}
                className="rounded-full bg-violet-500/25 px-5 py-2.5 text-sm font-bold text-violet-100 active:scale-95 hover:bg-violet-500/40"
              >
                Try again
              </button>
            </div>
          )}

          {statsStatus === 'ready' && stats && (
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
                      <StatCard label="Players" value={activeGameStats.players} />
                      <StatCard label="Avg score" value={activeGameStats.avgStars?.toFixed(1)} sub="★ per play" />
                      {activeIsBonus ? (
                        <StatCard label="Avg time" value={formatSeconds(activeGameStats.avgElapsedSeconds)} sub="⏱️ per play" />
                      ) : (
                        <StatCard
                          label="Avg streak"
                          value={(activeGameStats.avgBestStreak ?? 0).toFixed(1)}
                          sub="🔥 per player"
                        />
                      )}
                    </>
                  ) : (
                    <StatCard label={gameLabel(filter)} value={0} sub="no plays yet" />
                  )}
                </div>

                {deleteError && (
                  <p className="mt-4 rounded-xl bg-rose-500/20 px-3 py-2 text-center text-xs font-bold text-rose-100">
                    {deleteError}
                  </p>
                )}

                {!showAll && (
                  <>
                    <ListState list={summaryList} kind="summary" />
                    {noRowsForList(summaryList) && (
                      <div className="mt-6">
                        <EmptyState search={search} filter={filter} />
                      </div>
                    )}
                    {summaryList.status === 'ready' && summaryList.rows.length > 0 && (
                      <>
                        {/* Phones: stacked cards avoid the sideways-scrolling table below. */}
                        <div className="mt-6 space-y-2.5 sm:hidden">
                          {summaryList.rows.map((row) => {
                            const key = `${row.playerName}::${row.game}`;
                            const isConfirming = confirmDeleteKey === key;
                            const isDeleting = deletingKey === key;
                            return (
                              <div key={key} className="aura-card rounded-2xl p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <PlayerName name={row.playerName} timesPlayed={row.timesPlayed} />
                                    {filter === 'all' && (
                                      <p className="mt-0.5 text-xs font-semibold aura-muted">{gameLabel(row.game)}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteClick(row)}
                                    disabled={isDeleting}
                                    title={isConfirming ? 'Tap again to confirm' : `Delete ${row.playerName}'s ${gameLabel(row.game)} record`}
                                    className={`min-w-11 shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-all active:scale-90 disabled:opacity-50 ${
                                      isConfirming
                                        ? 'bg-rose-500 text-white shadow-sm'
                                        : 'bg-transparent text-rose-200 active:bg-rose-500/20 active:text-rose-100 sm:hover:bg-rose-500/20 sm:hover:text-rose-100'
                                    }`}
                                  >
                                    {isDeleting ? '…' : isConfirming ? 'Confirm?' : '🗑️'}
                                  </button>
                                </div>
                                <div className="mt-2.5 flex items-center justify-between text-xs font-semibold aura-muted">
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
                          })}
                        </div>

                        {/* Tablet/desktop: sortable table. */}
                        <div className="aura-card mt-6 hidden overflow-x-auto rounded-2xl sm:block">
                          <table className="w-full min-w-[480px] text-sm">
                            <thead className="aura-table-head text-xs font-bold uppercase tracking-wide">
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
                              {summaryList.rows.length === 0 ? (
                                <tr>
                                  <td colSpan={columnCount} className="px-4 py-8 text-center font-bold aura-muted">
                                    <EmptyStateInline search={search} filter={filter} />
                                  </td>
                                </tr>
                              ) : (
                                summaryList.rows.map((row) => {
                                  const key = `${row.playerName}::${row.game}`;
                                  const isConfirming = confirmDeleteKey === key;
                                  const isDeleting = deletingKey === key;
                                  return (
                                    <tr key={key} className="aura-table-row transition-colors">
                                      <td className="px-4 py-3.5 text-left font-bold aura-text">
                                        <PlayerName name={row.playerName} timesPlayed={row.timesPlayed} />
                                      </td>
                                      {filter === 'all' && (
                                        <td className="px-4 py-3.5 text-center aura-soft">{gameLabel(row.game)}</td>
                                      )}
                                      <td className="px-4 py-3.5 text-center aura-soft">🔥{row.bestStreak}</td>
                                      <td className="px-4 py-3.5 text-center aura-muted">
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
                                              : 'bg-transparent text-rose-200 active:bg-rose-500/20 active:text-rose-100 sm:hover:bg-rose-500/20 sm:hover:text-rose-100'
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

                        <ListFooter list={summaryList} />
                      </>
                    )}
                  </>
                )}

                {showAll && (
                  <div className="mt-6">
                    <ListState list={allPlaysList} kind="all" />
                    {noRowsForList(allPlaysList) && <EmptyState search={search} filter={filter} />}
                    {allPlaysList.status === 'ready' && allPlaysList.rows.length > 0 && (
                      <>
                        {/* Phones: stacked cards, one per play. */}
                        <div className="space-y-2.5 sm:hidden">
                          {allPlaysList.rows.map((row, i) => {
                            const device = formatDevice(row.device);
                            const bonus = isBonusGame(row.game);
                            return (
                              <div
                                key={`${row.playerName}::${row.game}::${row.completedAt}::${i}`}
                                className="aura-card rounded-2xl p-3.5"
                              >
                                <p className="font-bold aura-text">{row.playerName}</p>
                                {filter === 'all' && (
                                  <p className="mt-0.5 text-xs font-semibold aura-muted">{gameLabel(row.game)}</p>
                                )}
                                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold aura-muted">
                                  {bonus ? (
                                    <span>⏱️ {row.elapsedSeconds != null ? `${row.elapsedSeconds}s` : '—'}</span>
                                  ) : (
                                    <>
                                      <span>{formatStars(row.stars, row.totalRounds)}</span>
                                      <span>🔥 {row.peakStreak}</span>
                                    </>
                                  )}
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
                          })}
                        </div>

                        {/* Tablet/desktop: sortable table. */}
                        <div className="aura-card hidden overflow-x-auto rounded-2xl sm:block">
                          <table className="w-full min-w-[480px] text-sm">
                            <thead className="aura-table-head text-xs font-bold uppercase tracking-wide">
                              <tr>
                                <SortHeader label="Player" sortKey="playerName" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="left" />
                                {filter === 'all' && (
                                  <SortHeader label="Game" sortKey="game" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                )}
                                <SortHeader label="Stars" sortKey="stars" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                <SortHeader label={streakOrTimeHeader} sortKey="peakStreak" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                <SortHeader label="Played at" sortKey="completedAt" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                <SortHeader label="Device" sortKey="deviceKind" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                              </tr>
                            </thead>
                            <tbody>
                              {allPlaysList.rows.length === 0 ? (
                                <tr>
                                  <td colSpan={columnCountAll} className="px-4 py-8 text-center font-bold aura-muted">
                                    <EmptyStateInline search={search} filter={filter} />
                                  </td>
                                </tr>
                              ) : (
                                allPlaysList.rows.map((row, i) => {
                                  const device = formatDevice(row.device);
                                  const bonus = isBonusGame(row.game);
                                  return (
                                    <tr
                                      key={`${row.playerName}::${row.game}::${row.completedAt}::${i}`}
                                      className="aura-table-row transition-colors"
                                    >
                                      <td className="px-4 py-3.5 text-left font-bold aura-text">{row.playerName}</td>
                                      {filter === 'all' && (
                                        <td className="px-4 py-3.5 text-center aura-soft">{gameLabel(row.game)}</td>
                                      )}
                                      <td className="px-4 py-3.5 text-center aura-soft">{formatStars(row.stars, row.totalRounds)}</td>
                                      <td className="px-4 py-3.5 text-center aura-soft">
                                        {bonus ? `⏱️ ${row.elapsedSeconds != null ? `${row.elapsedSeconds}s` : '—'}` : `🔥${row.peakStreak}`}
                                      </td>
                                      <td className="px-4 py-3.5 text-center aura-muted">
                                        {new Date(row.completedAt).toLocaleString(undefined, {
                                          dateStyle: 'medium',
                                          timeStyle: 'short',
                                        })}
                                      </td>
                                      <td className="px-4 py-3.5 text-center aura-soft" title={device.title}>
                                        {device.icon} {device.text}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <ListFooter list={allPlaysList} />
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
    </>
  );

  if (embedded) {
    return (
      <div className="aura-card overflow-hidden rounded-3xl">
        {inner}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] aura-card shadow-2xl sm:h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
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
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500/25 px-1.5 text-[10px] font-extrabold text-pink-100"
        >
          ×{timesPlayed}
        </span>
      )}
    </span>
  );
}

function EmptyState({ search, filter }) {
  return (
    <div className="py-8 text-center font-bold aura-muted">
      <EmptyStateInline search={search} filter={filter} />
    </div>
  );
}

function EmptyStateInline({ search, filter }) {
  if (search.trim()) return <>No players found matching "{search.trim()}".</>;
  if (filter === 'all') return <>No plays logged yet — go play a game! 🎮</>;
  return <>No plays logged for {gameLabel(filter)} yet.</>;
}

function formatSeconds(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}s`;
}

// Stylized "which game?" filter — a single dropdown button showing the
// active game's emoji + name, opening a menu of every game that's shown up
// in the data (plus "All games" up top). Replaces the old row of numbered
// pills (game1/game2/b1…), which stopped being readable once there were
// more than a handful of games.
function GameFilterDropdown({ options, value, onChange, counts }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.key === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const handleClickAway = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    // Captured so this beats the panel's own Escape-closes-everything
    // listener — opening the menu should make Escape close just the menu.
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ fontFamily: "'Fredoka', sans-serif" }}
        className={`flex w-full items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 text-left shadow-sm transition-all active:scale-[0.98] ${
          open
            ? 'border-pink-400 bg-white/15'
            : value === 'all'
            ? 'border-white/25 bg-white/10'
            : 'border-pink-400/60 bg-gradient-to-r from-pink-500/15 to-purple-500/15'
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500/25 text-lg leading-none">
          {selected.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold aura-text sm:text-base">{selected.name}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="shrink-0 aura-muted">
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl aura-card p-1.5 shadow-2xl backdrop-blur-xl"
          >
            {options.map((opt) => {
              const active = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
                    active
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                      : 'aura-soft hover:bg-white/10 active:bg-white/10'
                  }`}
                >
                  <span className="w-6 shrink-0 text-center text-lg leading-none">{opt.emoji}</span>
                  <span style={{ fontFamily: "'Fredoka', sans-serif" }} className="min-w-0 flex-1 truncate text-sm font-bold">
                    {opt.name}
                  </span>
                  {typeof counts?.[opt.key] === 'number' && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        active ? 'bg-white/25 text-white' : 'bg-white/10 aura-muted'
                      }`}
                    >
                      {counts[opt.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        className={`flex w-full items-center gap-1 whitespace-nowrap px-4 py-3 font-bold uppercase tracking-wide transition-colors active:bg-white/10 ${justify} ${
          active ? 'aura-text' : 'aura-muted hover:text-indigo-200'
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
    <div className="aura-card rounded-2xl px-3 py-3.5 text-center transition-colors">
      <p
        className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-2xl font-bold text-transparent"
        style={{ fontFamily: "'Fredoka', sans-serif" }}
      >
        {value ?? 0}
      </p>
      <p className="mt-0.5 text-xs font-bold aura-soft">{label}</p>
      {sub && <p className="text-[10px] font-semibold aura-muted">{sub}</p>}
    </div>
  );
}
