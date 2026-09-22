import { useMemo } from 'react';
import { create } from 'zustand';
import { usePlayerStore } from '@/auth/playerStore';
import { API_BASE, fetchWithTimeout } from '@/api/apiClient';
// The catalogue itself lives in games/registry.js — the single place a game is
// declared. Re-exported here so every existing `from '@/games/gameAccess'`
// import keeps working and this file stays the store-side entry point.
import { GAME_CATALOG, GAME_KEYS } from '@/games/registry';

export { GAME_CATALOG, GAME_KEYS };

let latestGameAccessRequest = 0;

// Shared abort controller for the current in-flight fetchGameAccess call, so we
// can cancel a hung request when a new one supersedes it. The timeout itself now
// comes from the shared client; this path keeps the tighter 12 s budget because
// the homepage grid is the thing waiting on it.
let activeAbortController = null;
const FETCH_TIMEOUT_MS = 12_000; // 12 s — enough for a Render cold start

// Academic terms a game can belong to, in the order they should be presented.
// `term` on each catalogue entry is the numeric id here. Kept as a single
// source of truth so the catalogue grouping and any future term badge never
// drift from each other.
export const GAME_TERMS = [
  { id: 3, label: 'Term 3' },
  { id: 4, label: 'Term 4' },
];

// Groups a list of games by term for a grouped catalogue view. Preserves the
// input order within each term (GAME_CATALOG order when called with the full
// catalogue) and drops terms that have no games.
export function groupGamesByTerm(games = GAME_CATALOG) {
  const list = Array.isArray(games) ? games : [];
  return GAME_TERMS.map((term) => ({
    ...term,
    games: list.filter((game) => game.term === term.id),
  })).filter((group) => group.games.length > 0);
}

function normalizeKey(gameKey) {
  return String(gameKey);
}

// Merges raw server rows (with gameKey, unlocked, shiny, order) with
// GAME_CATALOG entries to produce full game objects with emoji, label,
// hue, etc. Only includes games that have a server row (i.e. "added").
export function mergeRows(rows) {
  const rowsByKey = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [row.gameKey, row])
  );

  return GAME_CATALOG
    .filter((game) => rowsByKey.has(game.key))
    .map((game, defaultOrder) => {
      const row = rowsByKey.get(game.key);

      return {
        ...game,
        unlocked: Boolean(row?.unlocked),
        shiny: Boolean(row?.shiny),
        order: Number.isInteger(row?.order) ? row.order : defaultOrder,
        // ISO string while a teacher-scheduled unlock is still pending, else
        // null. The server only ever reports a future time here, so the
        // countdown can trust it without re-validating against the clock.
        unlockAt: row?.unlockAt || null,
      };
    })
    .sort(
      (a, b) =>
        a.order - b.order ||
        GAME_CATALOG.findIndex((game) => game.key === a.key) -
          GAME_CATALOG.findIndex((game) => game.key === b.key)
    );
}

// Last-known arrangement per classId, so a returning visitor sees their games
// on the first frame instead of waiting on a round trip (which, against a
// cold Render instance, was the single longest wait in the boot sequence).
//
// Only the SERVER's own row data is cached — never the rendered game objects —
// so GAME_CATALOG stays the source of truth for names, icons and routes and a
// catalog edit in a new deploy is reflected immediately rather than being
// overridden by a stale cache.
const ACCESS_CACHE_KEY = 'ezw.gameAccess.v1';
const ACCESS_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readAccessCache() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ACCESS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeAccessCache(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota / private-mode failures — the cache is only an optimisation.
  }
}

// `let`, not `const` — cacheRowSet replaces the whole map when it prunes.
let accessCache = readAccessCache();

// Drops one class's cached rows.
//
// MUST be called after every successful panel write. This cache is what makes
// the homepage paint instantly on a warm load, but a stale entry wins over the
// network response — `seedFromCache` paints first, and if the follow-up fetch
// fails (a Render cold start is the normal case) the stale rows STAY on screen.
// Without this, a teacher who locked/unlocked or added a game in the panel
// would keep seeing their previous arrangement on the homepage for up to
// ACCESS_CACHE_MAX_AGE_MS — which is exactly the "the lock list keeps being
// wrong" and "the new game never shows up" report.
export function invalidateClassAccessCache(classId) {
  if (!classId || !accessCache[classId]) return;
  const next = { ...accessCache };
  delete next[classId];
  accessCache = next;
  writeAccessCache(next);
}

function cacheRowSet(classId, rows) {
  const next = {
    ...accessCache,
    [classId]: { rows, savedAt: Date.now() },
  };
  // Drop anything that has aged out so the entry can't grow without bound as
  // classes come and go.
  const cutoff = Date.now() - ACCESS_CACHE_MAX_AGE_MS;
  Object.keys(next).forEach((key) => {
    if (!next[key] || next[key].savedAt < cutoff) delete next[key];
  });
  accessCache = next;
  writeAccessCache(next);
}

function cachedRowsFor(classId) {
  const entry = accessCache[classId];
  if (!entry || !Array.isArray(entry.rows)) return null;
  return entry.rows;
}

// Seeds one class's games from the cache. Returns the games array, or null when
// there is nothing cached for that class.
function seedFromCache(classId) {
  const rows = cachedRowsFor(classId);
  if (!rows || rows.length === 0) return null;
  const games = mergeRows(rows);
  if (games.length === 0) return null;
  return games;
}

export const useGameAccessStore = create((set, get) => ({
  unlocked: {},
  games: [],
  loaded: false,
  loading: false,
  loadingClassId: null,
  error: null,

  loadedClassId: null,
  fetchGameAccess: async (
    classId = usePlayerStore.getState().classId,
    { force = false } = {}
  ) => {
    if (!classId) return;

    const state = get();

    // If a fetch for this classId is already in flight and hasn't been
    // stuck for too long, let it finish — don't pile on duplicate requests.
    // A forced refresh (e.g. leaving the panel) deliberately bypasses this so
    // its stale rows can never be what a returning user is left looking at.
    if (!force && state.loading && state.loadingClassId === classId) return;

    // Cancel any in-flight request (different classId or stuck request)
    // so we never have two concurrent fetches racing to update state.
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    const requestId = ++latestGameAccessRequest;
    const controller = new AbortController();
    activeAbortController = controller;

    // Seed from cache BEFORE the request goes out, so the grid is already on
    // screen while the server is still being woken up. `loading` stays true:
    // this is a background refresh, not a first load, and the UI must not
    // claim the data is fresh until the response actually lands.
    const seeded = force ? null : seedFromCache(classId);
    if (seeded) {
      set({
        games: seeded,
        unlocked: Object.fromEntries(
          seeded.map((game) => [game.key, game.unlocked])
        ),
        loaded: true,
        loadedClassId: classId,
        loading: true,
        loadingClassId: classId,
        error: null,
      });
    } else {
      set({ loading: true, loadingClassId: classId, error: null });
    }

    // The server returns this class's own game arrangement for the classId.
    // The client passes the player's classId as-is — game config is per-class
    // now, so there is no classType mapping anywhere in the read path.
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/game-access?classId=${encodeURIComponent(classId)}`,
        { signal: controller.signal },
        FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${response.status})`);
      }

      const rows = await response.json();
      const games = mergeRows(rows);

      // Ignore an older response after the player has switched classes.
      if (requestId !== latestGameAccessRequest) return;

      // Remember the server rows (not the merged games) so the next visit can
      // paint instantly. GAME_CATALOG stays the source of truth for labels,
      // icons and routes, so a catalog change in a new deploy shows up at once.
      cacheRowSet(classId, Array.isArray(rows) ? rows : []);

      set({
        games,
        unlocked: Object.fromEntries(
          games.map((game) => [game.key, game.unlocked])
        ),
        loaded: true,
        loadedClassId: classId,
        loading: false,
        loadingClassId: null,
        error: null,
      });
    } catch (error) {
      // A superseded request is not a failure — a newer fetch owns the state
      // now, and reporting its predecessor's error would clobber good data.
      if (requestId !== latestGameAccessRequest) return;

      // fetchWithTimeout reports an outlived budget as ApiError.isTimeout and
      // everything else passes through with the server's own message, so the
      // text below is already human-readable in both cases.
      const message = error.message || 'Failed to load game access';

      console.error(error.isTimeout ? 'Game access fetch timed out' : 'Game access fetch failed', error);

      // If we already painted from cache, a failed refresh must NOT wipe the
      // games off the screen — the stale arrangement is far more useful than an
      // error page, and the next successful load reconciles it. The error is
      // still logged above so a background-refresh failure stays diagnosable.
      set((state) => ({
        loading: false,
        loadingClassId: null,
        error: state.games.length > 0 ? null : message,
      }));
    } finally {
      // Clean up the shared controller reference only if it still
      // belongs to this request (a newer request may have replaced it).
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }
  },

  setUnlockedLocal: (gameKey, unlocked) => {
    const key = normalizeKey(gameKey);

    set((state) => ({
      unlocked: {
        ...state.unlocked,
        [key]: unlocked,
      },
      games: state.games.map((game) =>
        game.key === key ? { ...game, unlocked } : game
      ),
    }));
  },

  setShinyLocal: (gameKey, shiny) => {
    const key = normalizeKey(gameKey);

    set((state) => ({
      games: state.games.map((game) =>
        game.key === key ? { ...game, shiny } : game
      ),
    }));
  },

  // Patches a game's pending unlock time in place. Used by the panel after a
  // schedule is saved so the row shows its countdown without a full refetch
  // (a refetch would discard any unsaved reorder/lock drafts on screen).
  setUnlockAtLocal: (gameKey, unlockAt) => {
    const key = normalizeKey(gameKey);

    set((state) => ({
      games: state.games.map((game) =>
        game.key === key ? { ...game, unlockAt } : game
      ),
    }));
  },

  setOrderLocal: (gameKeys) => {
    set((state) => ({
      games: gameKeys
        .map((key, order) => {
          const game = state.games.find((item) => item.key === key);
          return game ? { ...game, order } : null;
        })
        .filter(Boolean),
    }));
  },

  replaceRows: (rows) => {
    const games = mergeRows(rows);

    set({
      games,
      unlocked: Object.fromEntries(
        games.map((game) => [game.key, game.unlocked])
      ),
    });
  },
}));

export async function setGameUnlocked(gameKey, unlocked, teacherCode, classId) {
  const key = normalizeKey(gameKey);
  const body = { unlocked, teacherCode };
  if (classId) body.classId = classId;

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not update game access');
  }

  const data = await response.json();

  useGameAccessStore.getState().setUnlockedLocal(key, data.unlocked);

  return data;
}

export async function setGameShiny(gameKey, shiny, teacherCode, classId) {
  const key = normalizeKey(gameKey);
  const body = { shiny, teacherCode };
  if (classId) body.classId = classId;

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}/shiny`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not update featured game');
  }

  const data = await response.json();

  useGameAccessStore.getState().setShinyLocal(key, data.shiny);

  return data;
}

export async function setGameOrder(gameKeys, teacherCode, classId) {
  const body = { gameKeys, teacherCode };
  if (classId) body.classId = classId;

  const response = await fetch(`${API_BASE}/api/game-access/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not save game order');
  }

  const data = await response.json();

  useGameAccessStore.getState().replaceRows(data.rows);

  return data.rows;
}

export async function addGameToClass(gameKey, teacherCode, classId) {
  const key = normalizeKey(gameKey);
  const body = { teacherCode };
  if (classId) body.classId = classId;

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not add game to this class');
  }

  const data = await response.json();
  useGameAccessStore.getState().replaceRows(data.rows);
  return data.rows;
}

export async function removeGameFromClass(gameKey, teacherCode, classId) {
  const key = normalizeKey(gameKey);
  const body = { teacherCode };
  if (classId) body.classId = classId;

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not remove game from this class');
  }

  const data = await response.json();
  useGameAccessStore.getState().replaceRows(data.rows);
  return data.rows;
}

export function useIsGameUnlocked(gameNumber, isTeacher) {
  const unlocked = useGameAccessStore(
    (state) => state.unlocked[normalizeKey(gameNumber)]
  );

  return Boolean(isTeacher) || Boolean(unlocked);
}

// The merged game object for one catalog key, or undefined while the current
// class's arrangement is still loading. Callers use the `unlockAt` on it to
// tell a merely-locked game apart from one the teacher has actually scheduled.
export function useGameByKey(gameNumber) {
  const key = normalizeKey(gameNumber);
  return useGameAccessStore((state) =>
    state.games.find((game) => game.key === key)
  );
}

// "2d 4h" / "4h 12m" / "12m" / "under a minute", or null when the time is
// missing, unparseable or already past.
//
// Deliberately coarse: the only question a child (or the teacher standing next
// to them) is asking is "is this today or later?", and a seconds ticker on a
// locked screen is noise. The banner's precise countdown already lives in
// NextGameTimer; this is the one-line summary.
export function formatUnlockCountdown(unlockAt, now = Date.now()) {
  const target = Date.parse(unlockAt);
  if (!Number.isFinite(target)) return null;

  const remaining = target - now;
  if (remaining <= 0) return null;

  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'under a minute';
}

export function isGameUnlockedNow(gameNumber, isTeacher) {
  const unlocked =
    useGameAccessStore.getState().unlocked[normalizeKey(gameNumber)];

  return Boolean(isTeacher) || Boolean(unlocked);
}

// ---------------------------------------------------------------------------
// Class-scoped panel mutators (teacher OR admin)
// ---------------------------------------------------------------------------
// Keyed by classId. The backend lets an admin target any class and a teacher
// only their own, so the same calls work for both roles.

export async function fetchGameAccessForClass(classId, teacherCode) {
  const params = new URLSearchParams({ classId });
  if (teacherCode) params.set('teacherCode', teacherCode);

  const response = await fetch(`${API_BASE}/api/game-access?${params.toString()}`);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load game access');
  }

  return response.json();
}

export async function setGameUnlockedForClass(gameKey, unlocked, classId, teacherCode) {
  const key = normalizeKey(gameKey);

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlocked, classId, teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not update game access');
  }

  invalidateClassAccessCache(classId);
  return response.json();
}

export async function setGameShinyForClass(gameKey, shiny, classId, teacherCode) {
  const key = normalizeKey(gameKey);

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}/shiny`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiny, classId, teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not update featured game');
  }

  invalidateClassAccessCache(classId);
  return response.json();
}

export async function setGameOrderForClass(gameKeys, classId, teacherCode) {
  const response = await fetch(`${API_BASE}/api/game-access/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameKeys, classId, teacherCode }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not save game order');
  }

  invalidateClassAccessCache(classId);
  return response.json();
}

export async function addGameForClass(gameKey, classId, teacherCode) {
  const key = normalizeKey(gameKey);
  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not add game to this class');
  }

  // The single most important invalidation: adding a game is what makes a
  // newly shipped game appear on the homepage, and a stale cache is precisely
  // what made it look like it was never added.
  invalidateClassAccessCache(classId);
  return response.json();
}

// Schedules a locked game to unlock at an ISO time, OR cancels a pending
// schedule by passing `null`.
//
// A cancel is NOT sent as a past time — the server rejects past times, and
// "unlock it now" is a different intent that also unlocks the game. Passing
// null clears `unlockAt` and leaves the game locked exactly as it was.
//
// The server rejects an already-unlocked game and a past time, so those errors
// are surfaced as-is.
export async function setGameUnlockScheduleForClass(
  gameKey,
  unlockAt,
  classId,
  teacherCode
) {
  const key = normalizeKey(gameKey);
  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}/schedule`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlockAt, classId, teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error ||
        (unlockAt ? 'Could not schedule this unlock' : 'Could not cancel this schedule')
    );
  }

  invalidateClassAccessCache(classId);
  return response.json();
}

// The soonest still-locked game with a pending unlock time, or null. Drives the
// student-facing "next game" banner — with nothing scheduled it returns null
// and the banner stays hidden entirely (there is no default weekly timer).
export function nextScheduledGame(games) {
  const pending = (Array.isArray(games) ? games : [])
    .filter((game) => !game.unlocked && game.unlockAt)
    .map((game) => ({ ...game, unlockTime: Date.parse(game.unlockAt) }))
    .filter((game) => Number.isFinite(game.unlockTime))
    .sort((a, b) => a.unlockTime - b.unlockTime);

  return pending[0] || null;
}

// Convenience selector over the read store's game list. Falls back to the
// last-known arrangement while a refresh is in flight, exactly like the grid.
export function useNextScheduledGame() {
  const games = useGameAccessStore((state) => state.games);
  return useMemo(() => nextScheduledGame(games), [games]);
}

export async function removeGameForClass(gameKey, classId, teacherCode) {
  const key = normalizeKey(gameKey);
  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not remove game from this class');
  }

  invalidateClassAccessCache(classId);
  return response.json();
}
