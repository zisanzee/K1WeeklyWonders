import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  fetchStats,
  fetchSummary,
  fetchPlaysPage,
  deletePlayerGame,
  fetchAdminClassStats,
  fetchAdminClassDetail,
  fetchLeaderboardHistory,
} from '@/api/logPlaySession';
import { usePlayerStore } from '@/auth/playerStore';
import { GAME_CATALOG } from '@/games/registry';

// Compact "emoji name" labels for the stats chrome (dropdown trigger, row
// captions). These are deliberately text-only: the per-game ICON IMAGES are
// ~medium/large art, and loading a dozen of them into the stats tables and
// filter dropdown would cost far more than the clarity it buys. Game CARDS use
// GameIcon; these compact labels stay as emoji.
//
// DERIVED from the game registry rather than hand-listed, so a new game needs
// no edit here — and a renamed game can't leave the stats showing the old name.
const GAME_LABELS = Object.fromEntries(
  GAME_CATALOG.map((game) => [game.progressKey, `${game.emoji} ${game.label}`])
);

// Anything not in the registry (a retired slug still present in old play rows)
// falls back to a generic "🎮 Game N" derived from the key.
function gameLabel(key) {
  if (GAME_LABELS[key]) return GAME_LABELS[key];
  const num = key.match(/\d+/)?.[0];
  return num ? `🎮 Game ${num}` : key;
}

// How many rounds each game runs, so the panel can show it beside the game's
// name. Games 1-6 and 8/10 use a fixed TOTAL_ROUNDS; 7, Game4 and bonusGame1
// are level-based, so the number is what a full successful run accumulates
// (Game4 and bonusGame1 report totalRounds as the level index, so a completed
// run ends at the level count).
//
// Hardcoded here on purpose: the frontend has no way to read another game's
// TOTAL_ROUNDS without importing every game's levels module into the stats
// bundle. If a game's round count changes, change it here too.
const GAME_ROUNDS = {
  game1: 10,
  game2: 12,
  game3: 15,
  game4: 2,
  game5: 10,
  game6: 10,
  game7: 12, // 2 levels x 6 rounds
  game8: 10,
  game9: 10,
  game10: 10,
  game11: 10,
  bonusGame1: 4, // 4 levels
};

// Compact "· 10 rounds" hint, or '' when the game has no known round count so
// the label stays clean rather than showing a wrong number.
function roundsHint(key) {
  const n = GAME_ROUNDS[key];
  return n ? `· ${n} rounds` : '';
}

// Creation order of every game, straight from the registry array (which is
// ordered oldest-first). Used to sort the game filter NEWEST FIRST: the filter is
// a chronological catalogue, so the game that shipped most recently belongs at
// the top instead of wherever the stats query happened to return it.
const GAME_ORDER = new Map(
  GAME_CATALOG.map((game, index) => [game.progressKey, index])
);

// Newest-to-oldest comparator for two game progressKeys.
//
// Known games sort by reverse registry position, so the highest index (latest
// game) comes first. A key with no registry entry — a retired slug still present
// in old play rows — has no creation date, so it sorts AFTER every known game
// rather than being presented as the newest.
function compareGamesNewestFirst(a, b) {
  const ai = GAME_ORDER.has(a) ? GAME_ORDER.get(a) : -1;
  const bi = GAME_ORDER.has(b) ? GAME_ORDER.get(b) : -1;
  if (ai !== bi) return bi - ai;
  return String(a).localeCompare(String(b));
}

// Splits a "🧺 Count & Win"-style label into its emoji and name, so the filter
// can show the emoji beside the name in each option. Every entry in GAME_LABELS
// follows "emoji name", and the gameLabel() fallback ("🎮 Game N") does too, so a
// plain first-space split is all this needs.
function splitLabel(label) {
  const idx = label.indexOf(' ');
  if (idx === -1) return { emoji: '', name: label };
  return { emoji: label.slice(0, idx), name: label.slice(idx + 1) };
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
  // Fewest wrong per play first — a teacher opening this column wants the
  // children who are struggling, not the ones who are fine.
  avgMistakes: 'asc',
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

// Formats one completed week's [start, end) window for the folder header, e.g.
// "Fri 12 Sep – Fri 19 Sep". Both ends fall on Friday noon, so the weekday is
// implied by the feature itself; the dates are what a teacher scans for.
function formatWeekRange(startISO, endISO) {
  const opts = { day: 'numeric', month: 'short' };
  const start = new Date(startISO).toLocaleDateString(undefined, opts);
  const end = new Date(endISO).toLocaleDateString(undefined, opts);
  return `${start} – ${end}`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

// "Past winners" — an accordion (folder) list of the top 3 players for each of
// the last few completed weeks. Rows are fetched once from
// /api/leaderboard/history; because that endpoint reconstructs each week from
// play history, this record survives the Friday reset rather than needing to be
// captured at reset time.
function WeeklyWinners({ refetchToken = 0 }) {
  const teacherCode = usePlayerStore((s) => s.teacherCode);
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [weeks, setWeeks] = useState([]);
  // Open folders by index. The newest week starts expanded so the panel has
  // something to show immediately; the rest stay collapsed until tapped.
  const [openSet, setOpenSet] = useState(() => new Set([0]));

  const load = useCallback(async () => {
    if (!teacherCode) return;
    setStatus('loading');
    const data = await fetchLeaderboardHistory(teacherCode);
    if (!data) {
      setStatus('error');
      return;
    }
    setWeeks(data.weeks || []);
    setStatus('ready');
  }, [teacherCode]);

  useEffect(() => {
    load();
  }, [load, refetchToken]);

  const toggle = (index) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="font-body flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      {status === 'loading' && <LoadingBlock label="Loading past winners…" />}
      {status === 'error' && (
        <ErrorBlock label="Couldn't load past winners." onRetry={load} />
      )}
      {status === 'ready' && weeks.length === 0 && (
        <div className="py-10 text-center font-bold aura-muted sm:py-16">
          <p className="text-4xl">🏆</p>
          <p className="mt-2">No completed weeks to show yet.</p>
          <p className="mt-1 text-xs font-semibold">
            Once a week wraps up, its top 3 players will be listed here.
          </p>
        </div>
      )}
      {status === 'ready' && weeks.length > 0 && (
        <div className="mx-auto max-w-2xl space-y-2.5">
         
          {weeks.map((week, i) => {
            const open = openSet.has(i);
            return (
              <div key={week.start} className="aura-card overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/10 sm:hover:bg-white/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/80 to-orange-500/80 text-lg shadow-sm">
                    📁
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black aura-text sm:text-base">
                      {formatWeekRange(week.start, week.end)}
                    </span>
                    <span className="block text-[11px] font-semibold aura-muted">
                      {week.winners[0]?.playerName
                        ? `${week.winners[0].playerName} came 1st`
                        : 'No players'}
                    </span>
                  </span>
                  <motion.span
                    animate={{ rotate: open ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="shrink-0 text-lg aura-muted"
                  >
                    ›
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <ol className="border-t border-white/10 px-3 py-2">
                        {week.winners.map((w, rank) => (
                          <li
                            key={w.playerName}
                            className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                          >
                            <span className="w-7 shrink-0 text-center text-xl">
                              {MEDALS[rank] || `#${rank + 1}`}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-bold aura-text">
                              {w.playerName}
                            </span>
                            <span className="shrink-0 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-black text-amber-100">
                              🏆 {w.trophies}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// `onSwitchView` (optional) renders a labelled switch inside the header, so the
// teacher moves between Stats and Mission Heroes from WITHIN the panel instead
// of from two pills floating above it. Only the embedded teacher view passes it:
// the modal and the admin view have no sibling view to switch to.
function TeacherStatsPanel({ onClose, embedded = false, onSwitchView = null }) {
  // Access to this panel is already decided at the name/code prompt (Home
  // only renders the Stats button for teachers) — this just reads who's in.
  const teacherName = usePlayerStore((s) => s.playerName);
  const teacherCode = usePlayerStore((s) => s.teacherCode);

  const [statsStatus, setStatsStatus] = useState('loading'); // loading | error | ready
  const [slow, setSlow] = useState(false);
  const [stats, setStats] = useState(null);
  // Which surface the panel shows: the live stats tables, or the folder list of
  // past weekly winners. Purely a view toggle — both read the same teacherCode.
  const [view, setView] = useState('stats'); // stats | winners

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

  // Options for the game-filter select: "All games" plus one entry per game
  // that's actually shown up in the data, sorted NEWEST GAME FIRST.
  //
  // The sort is applied here rather than trusting the server's order: the stats
  // query groups by game and returns whatever order Mongo aggregated in, which
  // is unrelated to when a game shipped. Ordering by registry position (then
  // newest-first) means the filter reads as a timeline of the curriculum, so the
  // game a teacher just added is at the top of the list instead of buried.
  // Counts are per-game play totals from the (small) stats payload.
  const filterOptions = useMemo(() => {
    const opts = [{ key: 'all', emoji: '🎯', name: 'All games' }];
    const games = [...(stats?.perGame || [])].sort((a, b) =>
      compareGamesNewestFirst(a._id, b._id)
    );
    games.forEach((g) => {
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
  // Player + [Game] + Wrong + Best streak + Last played + Actions.
  const columnCount = filter === 'all' ? 6 : 5;
  // The all-plays table swaps the Actions column for Wrong *and* adds a
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
          <div className="flex shrink-0 items-center gap-2">
            {/* Switch to Mission Heroes, from inside the panel. Sits first so the
                icon buttons (past winners / refresh / close) keep their familiar
                positions on the right. Hidden on the narrowest screens by text
                length only — it is a text button, not an icon, because "Mission
                heroes" is a destination, not a mode a glyph can convey. */}
            {onSwitchView && (
              <button
                type="button"
                onClick={onSwitchView}
                className="aura-ghost h-9 gap-1.5 whitespace-nowrap px-3 text-xs font-black active:scale-95 sm:h-11 sm:px-4 sm:text-sm"
              >
                <span aria-hidden="true">🏆</span>
                Mission heroes
              </button>
            )}
            <button
              onClick={() => setView((v) => (v === 'winners' ? 'stats' : 'winners'))}
              aria-label={view === 'winners' ? 'Back to stats' : 'Past weekly winners'}
              title={view === 'winners' ? 'Back to stats' : 'Past weekly winners'}
              aria-pressed={view === 'winners'}
              className={`aura-icon-btn h-9 w-9 text-lg active:scale-90 sm:h-11 sm:w-11 ${
                view === 'winners' ? 'ring-2 ring-pink-400' : ''
              }`}
            >
              {view === 'winners' ? '📊' : '🏆'}
            </button>
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

        {view === 'winners' && <WeeklyWinners refetchToken={version} />}

        {view === 'stats' && (
          <>
        {/* ONE toolbar for the three controls, instead of three stacked
            full-width bands. The old layout used a filter row, then a search
            row, then a hint line — on a phone that pushed the first data row
            below the fold. Grouping them keeps the same controls, labels them
            for screen readers, and lets the panel start sooner. */}
        {statsStatus === 'ready' && stats && (
          <div className="border-b border-white/10 px-4 py-3 sm:px-6">
            <div
              role="group"
              aria-label="Filter and search plays"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <GameFilterSelect
                options={filterOptions}
                value={filter}
                onChange={setFilter}
                counts={filterCounts}
              />

              <div className="w-full sm:max-w-xs">
                <label
                  htmlFor="stats-player-search"
                  className="mb-1 block text-[11px] font-black uppercase tracking-wide aura-muted"
                >
                  Player
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm aura-muted" aria-hidden="true">
                    🔍
                  </span>
                  <input
                    id="stats-player-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search a player…"
                    className="font-body aura-input h-11 py-0 pl-9 pr-9 text-sm font-semibold"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear player search"
                      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full aura-muted transition-colors hover:bg-white/10 hover:text-indigo-200 active:bg-white/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* A real toggle, so its state is announced. `aria-pressed` tells a
                  screen reader "pressed" rather than leaving the checked state
                  implied by a colour change only. */}
              <button
                type="button"
                onClick={handleToggleShowAll}
                aria-pressed={showAll}
                className={`font-body flex h-11 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-4 text-sm font-bold transition-all active:scale-95 sm:w-auto ${
                  showAll
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                    : 'bg-white/10 text-white active:bg-white/20 sm:hover:bg-white/20'
                }`}
              >
                {showAll ? '📋 Show summary' : '🧾 Show all plays'}
              </button>
            </div>

            
          </div>
        )}

        <div className="font-body flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
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

          {/* No <AnimatePresence mode="wait"> around this block any more.
              It keyed on `${filter}-${showAll}`, so every filter change had to
              play a 180ms exit, unmount the whole results tree (stat cards,
              tables, the scroll container), then mount a fresh one and play a
              180ms entrance. That read as jank: the panel went empty, the
              scrollbar jumped, and the new rows arrived after a visible gap.
              The lists already signal their own loading state, so a plain
              opacity fade on mount is enough — content stays mounted and the
              filter simply swaps the rows underneath it. */}
          {statsStatus === 'ready' && stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
                {/* A labelled <section> rather than a bare grid, so the summary
                    numbers are announced as a group ("Headline numbers") instead
                    of a stream of disconnected values before the table. */}
                <section
                  aria-label={filter === 'all' ? 'Headline numbers for all games' : `Numbers for ${gameLabel(filter)}`}
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
                      {/* Wrong answers replace the old average-score card: stars
                          always reached the maximum (you can't advance without
                          a correct answer), so it carried no signal. */}
                      <StatCard
                        label="Wrong / play"
                        value={(activeGameStats.avgMistakes ?? 0).toFixed(1)}
                        sub="❌ average"
                      />
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
                </section>

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
                                      <p className="mt-0.5 text-xs font-semibold aura-muted">
                                        {gameLabel(row.game)}
                                        <span className="ml-1 opacity-70">{roundsHint(row.game)}</span>
                                      </p>
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
                                  <span>❌ {(row.avgMistakes ?? 0).toFixed(1)} wrong/play</span>
                                  <span>🔥 {row.bestStreak} best</span>
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
                            {/* A caption names the table for a screen reader. It
                                is visually hidden because the panel's heading
                                already says this on screen. */}
                            <caption className="sr-only">
                              Player summary — one row per player
                              {filter === 'all' ? ' and game' : ` in ${gameLabel(filter)}`}. Sortable columns.
                            </caption>
                            <thead className="aura-table-head text-xs font-bold uppercase tracking-wide">
                              <tr>
                                <SortHeader label="Player" sortKey="playerName" current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                                {filter === 'all' && (
                                  <SortHeader label="Game" sortKey="game" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                                )}
                                <SortHeader label="Wrong / play" sortKey="avgMistakes" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                                <SortHeader label="Best streak" sortKey="bestStreak" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                                <SortHeader label="Last played" sortKey="lastPlayedAt" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                                <th scope="col" className="px-3 py-1">
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
                                        <td className="px-4 py-3.5 text-center aura-soft">
                                          {gameLabel(row.game)}
                                          <span className="ml-1 text-[10px] font-bold opacity-70">
                                            {roundsHint(row.game)}
                                          </span>
                                        </td>
                                      )}
                                      <td className="px-4 py-3.5 text-center aura-soft">
                                        {(row.avgMistakes ?? 0).toFixed(1)}
                                      </td>
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
                                  {/* Wrong answers and streak per play. `stars`
                                      is gone from here: it always hit the max,
                                      so it told the teacher nothing. */}
                                  <span>❌ {row.mistakes ?? 0} wrong</span>
                                  <span>🔥 {row.peakStreak}</span>
                                  {bonus && (
                                    <span>⏱️ {row.elapsedSeconds != null ? `${row.elapsedSeconds}s` : '—'}</span>
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
                            <caption className="sr-only">
                              All plays — one row per session
                              {filter === 'all' ? '' : ` for ${gameLabel(filter)}`}. Sortable columns.
                            </caption>
                            <thead className="aura-table-head text-xs font-bold uppercase tracking-wide">
                              <tr>
                                <SortHeader label="Player" sortKey="playerName" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="left" />
                                {filter === 'all' && (
                                  <SortHeader label="Game" sortKey="game" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
                                )}
                                <SortHeader label="Wrong" sortKey="mistakes" current={sortKeyAll} dir={sortDirAll} onSort={handleSortAll} align="center" />
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
                                      <td className="px-4 py-3.5 text-center aura-soft">❌{row.mistakes ?? 0}</td>
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
          )}
        </div>
          </>
        )}
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

// "Which game?" filter — a fully themed listbox.
//
// WHY NOT A NATIVE <select>: it cannot be restyled. The closed field takes the
// glass, but the OPEN list is drawn by the OS on its own white panel — white text
// on white (the field's `color:#fff` is inherited by <option>), no rounding, no
// glass, no emoji chips. That list is the part a teacher actually looks at, so a
// native select can only ever look like a system widget dropped into the card.
//
// So the list is rendered here, in the page's own idiom: an `aura-card` panel
// with the same rounding, blur and shadow as everything else, options carrying
// the game's emoji and play count, and the selected one on the pink→purple
// gradient used by every other "active" control on this panel.
//
// ACCESSIBILITY IS IMPLEMENTED, NOT ASSUMED — the combobox pattern from the
// ARIA Authoring Practices, which is exactly what a native select gave us:
//
//   • button[role=combobox] with aria-expanded / aria-controls /
//     aria-labelledby / aria-activedescendant
//   • ul[role=listbox] + li[role=option] with aria-selected
//   • ArrowUp/ArrowDown (open AND move, wrapping), Home/End, Enter/Space to
//     commit, Escape and Tab to dismiss without changing the value
//   • type-ahead on the option name, so "c" jumps to Comparing Quantities
//   • focus never leaves the button; the active option is conveyed by
//     aria-activedescendant and kept scrolled into view
//
// Escape is handled in the CAPTURE phase and stops propagation, so it closes the
// list rather than the whole stats panel.
function GameFilterSelect({ options, value, onChange, counts }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  // Type-ahead buffer: consecutive printable keys typed within 600ms are treated
  // as one prefix, and the timer resets on the first key of a new search.
  const typeaheadRef = useRef({ buffer: '', at: 0 });

  const selectedIndex = Math.max(0, options.findIndex((o) => o.key === value));
  const selected = options[selectedIndex] || options[0];

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const commit = (index) => {
    const opt = options[index];
    if (opt) onChange(opt.key);
    setOpen(false);
  };

  // Dismiss on outside click and on Escape. Both listeners only exist while the
  // list is open, so a closed filter costs nothing.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // Keep the keyboard-active option in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + delta + options.length) % options.length);
      return;
    }
    if (open && e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (open && e.key === 'End') {
      e.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) commit(activeIndex);
      else openList();
      return;
    }
    if (open && e.key === 'Tab') {
      // Let focus move on, but don't leave a list floating behind it.
      setOpen(false);
      return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const ta = typeaheadRef.current;
      ta.buffer = now - ta.at > 600 ? e.key : ta.buffer + e.key;
      ta.at = now;
      const needle = ta.buffer.toLowerCase();
      const found = options.findIndex((o) => o.name.toLowerCase().startsWith(needle));
      if (found >= 0) {
        if (!open) setOpen(true);
        setActiveIndex(found);
      }
    }
  };

  const selectedCount = counts?.[selected.key];

  return (
    <div className="w-full sm:max-w-xs">
      <span
        id="stats-game-filter-label"
        className="mb-1 block text-[11px] font-black uppercase tracking-wide aura-muted"
      >
        Game
      </span>

      <div ref={rootRef} className="relative">
        <button
          type="button"
          role="combobox"
          aria-labelledby="stats-game-filter-label"
          aria-controls="stats-game-filter-list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-activedescendant={open ? `stats-game-option-${activeIndex}` : undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          style={{ fontFamily: "'Fredoka', sans-serif" }}
          className={`flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 pr-9 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.99] focus-visible:border-violet-300/90 focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(167,139,250,0.28)] ${
            value === 'all'
              ? 'border-white/25 bg-white/10 hover:bg-white/15'
              : 'border-pink-400/60 bg-gradient-to-r from-pink-500/25 to-purple-500/25 hover:from-pink-500/30 hover:to-purple-500/30'
          } ${open ? 'border-violet-300/90 bg-white/20' : ''}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/25 text-sm leading-none">
            {selected.emoji}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{selected.name}</span>
          {typeof selectedCount === 'number' && (
            <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-extrabold aura-soft">
              {selectedCount}
            </span>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
            className="absolute right-3 text-[10px] aura-muted"
          >
            ▾
          </motion.span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              ref={listRef}
              id="stats-game-filter-list"
              role="listbox"
              aria-labelledby="stats-game-filter-label"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl aura-card p-1.5 shadow-2xl"
            >
              {options.map((opt, index) => {
                const count = counts?.[opt.key];
                const isSelected = opt.key === value;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={opt.key}
                    id={`stats-game-option-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    // mousedown (not click) so the option commits before the
                    // document-level outside-click handler can close the list.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(index);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                        : isActive
                          ? 'bg-white/15 text-white'
                          : 'aura-soft'
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center text-base leading-none">{opt.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                    {typeof count === 'number' && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-white/10 aura-muted'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// A sortable column header.
//
// Accessibility notes:
//   • `scope="col"` ties the header to its column for a screen reader.
//   • `aria-sort` on the <th> is the standard way to announce which column is
//     sorted and in which direction. Without it the little ▲/▼ is invisible to
//     assistive tech, so "sorted by last played" would be unhearable.
//   • The arrow is `aria-hidden` because `aria-sort` already conveys it;
//     announcing both would say "descending" twice.
function SortHeader({ label, sortKey: key, current, dir, onSort, align = 'left' }) {
  const active = key === current;
  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="p-0"
    >
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`flex w-full items-center gap-1 whitespace-nowrap px-4 py-3 font-bold uppercase tracking-wide transition-colors active:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pink-300 ${justify} ${
          active ? 'aura-text' : 'aura-muted hover:text-indigo-200'
        }`}
      >
        {label}
        <span aria-hidden="true" className={`text-[9px] ${active ? 'text-pink-500 opacity-100' : 'opacity-0'}`}>
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

// ---------------------------------------------------------------------------
// Admin mode — all-classes summary that drills into one class's detail.
// Both endpoints dedupe merged identities server-side, so this view just
// renders totals and never has to reason about merges itself.
// ---------------------------------------------------------------------------
function AdminStatsView({ onClose, embedded }) {
  const teacherCode = usePlayerStore((s) => s.teacherCode);
  const [status, setStatus] = useState('loading');
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);

  const loadClasses = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await fetchAdminClassStats(teacherCode);
      setClasses(Array.isArray(rows) ? rows : []);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [teacherCode]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const openClass = useCallback(
    async (row) => {
      setSelected(row);
      setDetail(null);
      setDetailError(null);
      setDetailStatus('loading');
      try {
        const data = await fetchAdminClassDetail(row.classId, teacherCode);
        setDetail(data);
        setDetailStatus('ready');
      } catch (err) {
        console.error(err);
        setDetailError(err.message || 'Could not load class stats.');
        setDetailStatus('error');
      }
    },
    [teacherCode]
  );

  const backToSummary = () => {
    setSelected(null);
    setDetail(null);
    setDetailStatus('idle');
    setDetailError(null);
  };

  // Modal variant: lock background scroll and let Escape step back a level.
  // Embedded (the panel's tab) skips both.
  useEffect(() => {
    if (embedded) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (selected) backToSummary();
        else onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose, embedded, selected]);

  const totalPlaysAll = classes.reduce((sum, c) => sum + (c.totalPlays || 0), 0);

  const inner = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-indigo-500/15 via-white/5 to-cyan-500/15 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-lg shadow-md sm:h-11 sm:w-11 sm:text-xl">
            📊
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-black uppercase tracking-wide aura-muted">
              {selected ? 'Class detail' : 'All classes'}
            </span>
            <span
              style={{ fontFamily: "'Fredoka', sans-serif" }}
              className="truncate text-lg font-bold aura-heading sm:text-2xl"
            >
              {selected ? selected.className : "Who has been playing?"}
            </span>
          </span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {selected ? (
            <button
              type="button"
              onClick={backToSummary}
              className="aura-ghost h-9 shrink-0 gap-1 px-3 text-xs font-black sm:h-11 sm:text-sm"
            >
              ← All classes
            </button>
          ) : (
            <button
              onClick={loadClasses}
              disabled={status === 'loading'}
              aria-label="Refresh stats"
              title="Refresh"
              className="aura-icon-btn h-9 w-9 text-lg active:scale-90 disabled:opacity-50 sm:h-11 sm:w-11"
            >
              <span className={status === 'loading' ? 'inline-block animate-spin' : ''}>🔄</span>
            </button>
          )}
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

      <div className="font-body flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {!selected && (
          <>
            {status === 'loading' && <LoadingBlock label="Loading classes…" />}
            {status === 'error' && (
              <ErrorBlock label="Couldn't load class stats." onRetry={loadClasses} />
            )}
            {status === 'ready' && (
              <>
                <div className="mx-auto mb-4 grid max-w-md grid-cols-2 gap-3">
                  <StatCard label="Classes" value={classes.length} />
                  <StatCard label="Total plays" value={totalPlaysAll} />
                </div>
                {classes.length === 0 ? (
                  <p className="py-10 text-center font-bold aura-muted">No classes yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {classes.map((c) => (
                      <li key={c.classId}>
                        <button
                          type="button"
                          onClick={() => openClass(c)}
                          className="aura-card flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 active:scale-[0.99]"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/40 to-cyan-500/40 text-lg">
                            🏫
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="truncate text-sm font-black aura-text sm:text-base">
                                {c.className}
                              </span>
                              {c.classAlias && c.classAlias !== c.className && (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold aura-soft">
                                  {c.classAlias}
                                </span>
                              )}
                              {!c.active && (
                                <span className="rounded-full bg-rose-500/25 px-2 py-0.5 text-[10px] font-black text-rose-100">
                                  Inactive
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block font-mono text-[11px] font-bold aura-muted">
                              {c.classCode || c.classId}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="rounded-full bg-indigo-500/25 px-2.5 py-1 text-[11px] font-black text-indigo-100">
                              {c.totalPlays ?? 0} plays
                            </span>
                            <span className="rounded-full bg-cyan-500/25 px-2.5 py-1 text-[11px] font-black text-cyan-100">
                              {c.totalPlayers ?? 0} players
                            </span>
                          </span>
                          <span className="shrink-0 text-lg aura-muted">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}

        {selected && (
          <>
            {detailStatus === 'loading' && <LoadingBlock label="Loading class stats…" />}
            {detailStatus === 'error' && (
              <ErrorBlock
                label={detailError || "Couldn't load class stats."}
                onRetry={() => openClass(selected)}
              />
            )}
            {detailStatus === 'ready' && detail && (
              <>
                <div className="mx-auto mb-5 grid max-w-sm grid-cols-2 gap-3">
                  <StatCard label="Total plays" value={detail.totalPlays} />
                  <StatCard label="Players" value={detail.uniquePlayers} />
                </div>
                {!detail.perGame || detail.perGame.length === 0 ? (
                  <p className="py-8 text-center font-bold aura-muted">
                    No plays logged for this class yet.
                  </p>
                ) : (
                  <div className="aura-card overflow-x-auto rounded-2xl">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead className="aura-table-head text-xs font-bold uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3 text-left">Game</th>
                          <th className="px-4 py-3 text-center">Plays</th>
                          <th className="px-4 py-3 text-center">Players</th>
                          <th className="px-4 py-3 text-center">Wrong / play</th>
                          <th className="px-4 py-3 text-center">Streak / Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.perGame.map((g) => (
                          <tr key={g._id} className="aura-table-row">
                            <td className="px-4 py-3.5 text-left font-bold aura-text">
                              {gameLabel(g._id)}
                              <span className="ml-1 text-[10px] font-bold opacity-70">
                                {roundsHint(g._id)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center aura-soft">{g.plays ?? 0}</td>
                            <td className="px-4 py-3.5 text-center aura-soft">{g.players ?? 0}</td>
                            <td className="px-4 py-3.5 text-center aura-soft">
                              {g.avgMistakes != null ? `❌ ${Number(g.avgMistakes).toFixed(1)}` : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center aura-soft">
                              {isBonusGame(g._id)
                                ? `⏱️ ${formatSeconds(g.avgElapsedSeconds)}`
                                : `🔥 ${Number(g.avgBestStreak ?? g.bestStreak ?? 0).toFixed(1)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="aura-card overflow-hidden rounded-3xl">{inner}</div>;
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

// Small shared loading/error blocks for the admin stats view.
function LoadingBlock({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 aura-muted sm:py-16">
      <span className="animate-bounce text-4xl">⏳</span>
      <p className="font-bold">{label}</p>
    </div>
  );
}

function ErrorBlock({ label, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center aura-muted sm:py-16">
      <span className="text-4xl">😕</span>
      <p className="font-bold aura-soft">{label}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-violet-500/25 px-5 py-2.5 text-sm font-bold text-violet-100 active:scale-95 hover:bg-violet-500/40"
      >
        Try again
      </button>
    </div>
  );
}

// Public entry: picks the admin or teacher implementation. The branch lives in
// a wrapper (not inside one component) so each mode keeps its own stable hook
// order.
//
// `onSwitchView` swaps the teacher's panel for Mission Heroes and back. It is
// only meaningful next to that sibling view, so the admin branch ignores it.
export default function StatsPanel({
  onClose,
  embedded = false,
  adminMode = false,
  onSwitchView = null,
}) {
  if (adminMode) {
    return <AdminStatsView onClose={onClose} embedded={embedded} />;
  }
  return <TeacherStatsPanel onClose={onClose} embedded={embedded} onSwitchView={onSwitchView} />;
}
