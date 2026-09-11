import { create } from 'zustand';
import { usePlayerStore } from './playerStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
let latestGameAccessRequest = 0;

// Shared abort controller + timeout for the current in-flight fetchGameAccess
// call, so we can cancel a hung request when a new one supersedes it or when
// the network is unresponsive (e.g. Render cold-start).
let activeAbortController = null;
const FETCH_TIMEOUT_MS = 12_000; // 12 s — enough for a Render cold start

export const GAME_CATALOG = [
  {
    key: '1',
    emoji: '🧶',
    label: 'Count & Win!',
    title: 'Count & Win!',
    subtitle: 'Numeral & Number Word\n(Counting)',
    description: 'Practise reading numerals and number words by counting friendly objects one by one.',
    hue: '#38BDF8',
    tint: '#EFF9FF',
    to: '/Game1',
    progressKey: 'game1',
    gradient: 'linear-gradient(135deg, #8FECCB 0%, #36D4B3 55%, #18B79D 100%)',
    ring: 'ring-[#D7FFF3]',
  },
  {
    key: '2',
    emoji: '🧸',
    label: 'Comparing Quantities',
    title: 'Comparing Quantities',
    subtitle: 'Comparing 2 Sets\n(More, Fewer, Same)',
    description: 'Compare two groups of objects and decide which has more, fewer or the same.',
    hue: '#A78BFA',
    tint: '#F5F1FF',
    to: '/Game2',
    progressKey: 'game2',
    gradient: 'linear-gradient(135deg, #88DAFF 0%, #4AA8FF 55%, #5B7CFF 100%)',
    ring: 'ring-[#D9F2FF]',
  },
  {
    key: '3',
    emoji: '🐙',
    label: 'Which Number?',
    title: 'Which Number?',
    subtitle: 'Numeral & Number Word\n(Before & After Ed.)',
    description: 'Find the number that comes just before or just after the target numeral.',
    hue: '#FB7185',
    tint: '#FFF0F2',
    to: '/Game3',
    progressKey: 'game3',
    gradient: 'linear-gradient(135deg, #C7A6FF 0%, #9A7BFF 55%, #FF7AD9 100%)',
    ring: 'ring-[#EAD9FF]',
  },
  {
    key: '4',
    emoji: '🎲',
    label: 'Compare Die and Dominoes',
    title: 'Compare Die and Dominoes',
    subtitle: 'Comparing 2 Sets\n(subitising)',
    description: 'Read dice and dominoes and compare the two amounts using quick subitising.',
    hue: '#FBBF24',
    tint: '#FFF9E8',
    to: '/Game4',
    progressKey: 'game4',
    gradient: 'linear-gradient(135deg, #FFD76A 0%, #FFB347 55%, #FF7A59 100%)',
    ring: 'ring-[#FFEBC0]',
  },
  {
    key: '5',
    emoji: '🚀',
    label: 'Making & Splitting Groups',
    title: 'Making & Splitting Groups',
    subtitle: 'Number Bonds\n(1-5)',
    description: 'Make and split groups up to five to build early number-bond understanding.',
    hue: '#34D399',
    tint: '#EEFCF6',
    to: '/Game5',
    progressKey: 'game5',
    gradient: 'linear-gradient(135deg, #A7EE7E 0%, #4DD4A6 55%, #2CB5D8 100%)',
    ring: 'ring-[#DCF8C6]',
  },
  {
    key: '6',
    emoji: '🗝️',
    label: 'Part-Part-Whole!',
    title: 'Part-Part-Whole!',
    subtitle: 'Number Bonds\n(1-10)',
    description: 'Explore part-part-whole number bonds for totals from one to ten.',
    hue: '#2DD4BF',
    tint: '#EBFBF9',
    to: '/Game6',
    progressKey: 'game6',
    gradient: 'linear-gradient(135deg, #FF9AAE 0%, #FF6F91 55%, #FF4D6D 100%)',
    ring: 'ring-[#FFD6DE]',
  },
  {
    key: 'b1',
    emoji: '9️⃣',
    label: 'Number Pop! (Bonus)',
    title: 'Number Pop!',
    subtitle: 'Numeral & Number Word\n(Ascending & Descending Order)',
    description: 'Pop the numbered bubbles in rising and falling order to master sequencing.',
    hue: '#E879F9',
    tint: '#FDF1FE',
    to: '/bonus-game1',
    progressKey: 'bonusGame1',
    isBonus: true,
    gradient: 'linear-gradient(135deg, #FF9ED1 0%, #FF6FB1 55%, #9B5CFF 100%)',
    ring: 'ring-[#FFD8EE]',
  },
  {
    key: '7',
    emoji: '🥚',
    label: "Mama Bird's Eggs",
    title: "Mama Bird's Eggs",
    subtitle: 'Number Bonds\n(1-10)',
    description: 'Help Mama Bird hatch the right number of eggs to complete each number bond.',
    hue: '#FFBB54',
    tint: '#FFF7EB',
    to: '/Game7',
    progressKey: 'game7',
    gradient: 'linear-gradient(135deg, #FFD76A 0%, #FFB347 55%, #FF7A59 100%)',
    ring: 'ring-[#FFEBC0]',
  },
  {
    key: '8',
    emoji: '\uD83C\uDF55',
    label: 'Pizza Order!',
    title: 'Pizza Order!',
    subtitle: 'Number Bonds\n(1-10)',
    description: 'Take pizza orders by matching the correct number of toppings to each bond.',
    hue: '#FB923C',
    tint: '#FFF4E8',
    to: '/Game8',
    progressKey: 'game8',
    gradient: 'linear-gradient(135deg, #FFC46B 0%, #FF8A5C 55%, #FF5F6D 100%)',
    ring: 'ring-[#FFE3C0]',
  },
  {
    key: '9',
    emoji: '\uD83E\uDD9C',
    label: "Polly's Treasure Quest",
    title: "Polly's Treasure Quest",
    subtitle: 'Number Bonds\n(1-10)',
    description: 'Sail with Polly and collect treasure by solving number bonds up to ten.',
    hue: '#F59E0B',
    tint: '#FFF7E6',
    to: '/Game9',
    progressKey: 'game9',
    gradient: 'linear-gradient(135deg, #FFD76A 0%, #F59E0B 55%, #D97706 100%)',
    ring: 'ring-[#FFEBC0]',
  },
];

export const GAME_KEYS = GAME_CATALOG.map((game) => game.key);

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
  fetchGameAccess: async (classId = usePlayerStore.getState().classId) => {
    if (!classId) return;

    const state = get();

    // If a fetch for this classId is already in flight and hasn't been
    // stuck for too long, let it finish — don't pile on duplicate requests.
    if (state.loading && state.loadingClassId === classId) return;

    // Cancel any in-flight request (different classId or stuck request)
    // so we never have two concurrent fetches racing to update state.
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    const requestId = ++latestGameAccessRequest;
    const controller = new AbortController();
    activeAbortController = controller;

    // Safety timeout: if the server doesn't respond within the window
    // (Render cold-start can take 30-60 s, so we give a reasonable
    // budget), abort the fetch and show an error so the user can retry
    // instead of staring at a forever-spinner.
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Seed from cache BEFORE the request goes out, so the grid is already on
    // screen while the server is still being woken up. `loading` stays true:
    // this is a background refresh, not a first load, and the UI must not
    // claim the data is fresh until the response actually lands.
    const seeded = seedFromCache(classId);
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
      const response = await fetch(
        `${API_BASE}/api/game-access?classId=${encodeURIComponent(classId)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);

      if (requestId !== latestGameAccessRequest) return;

      // Distinguish a deliberate abort (timeout or superseded) from a
      // genuine network / server error so the UI can show a helpful message.
      const isAbort = error.name === 'AbortError';
      const message = isAbort
        ? 'The server is taking too long to respond. Please try again.'
        : (error.message || 'Failed to load game access');

      console.error(isAbort ? 'Game access fetch timed out' : 'Game access fetch failed', error);

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

  return response.json();
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

  return response.json();
}
