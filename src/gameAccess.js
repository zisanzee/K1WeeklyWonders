import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const GAME_CATALOG = [
  {
    key: '1',
    emoji: '🧶',
    label: 'Count & Win!',
    title: 'Count & Win!',
    subtitle: 'Numeral & Number Word\n(Counting)',
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
    hue: '#E879F9',
    tint: '#FDF1FE',
    to: '/bonus-game1',
    progressKey: 'bonusGame1',
    isBonus: true,
    gradient: 'linear-gradient(135deg, #FF9ED1 0%, #FF6FB1 55%, #9B5CFF 100%)',
    ring: 'ring-[#FFD8EE]',
  },
];

export const GAME_KEYS = GAME_CATALOG.map((game) => game.key);

function normalizeKey(gameKey) {
  return String(gameKey);
}

function mergeRows(rows) {
  const rowsByKey = new Map(rows.map((row) => [row.gameKey, row]));

  return GAME_CATALOG
    .map((game, defaultOrder) => {
      const row = rowsByKey.get(game.key);

      return {
        ...game,
        unlocked: Boolean(row?.unlocked),
        shiny: Boolean(row?.shiny),
        order: Number.isInteger(row?.order) ? row.order : defaultOrder,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export const useGameAccessStore = create((set, get) => ({
  unlocked: {},
  games: GAME_CATALOG.map((game, order) => ({
    ...game,
    order,
    unlocked: false,
    shiny: false,
  })),
  loaded: false,
  loading: false,
  error: null,

  fetchGameAccess: async () => {
    if (get().loading) return;

    set({ loading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/game-access`);

      if (!response.ok) {
        throw new Error('Failed to load game access');
      }

      const rows = await response.json();
      const games = mergeRows(rows);

      set({
        games,
        unlocked: Object.fromEntries(
          games.map((game) => [game.key, game.unlocked])
        ),
        loaded: true,
        loading: false,
      });
    } catch (error) {
      console.error(error);

      set({
        loading: false,
        error: error.message,
      });
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

export async function setGameUnlocked(gameKey, unlocked, teacherCode) {
  const key = normalizeKey(gameKey);

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlocked, teacherCode }),
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

export async function setGameShiny(gameKey, shiny, teacherCode) {
  const key = normalizeKey(gameKey);

  const response = await fetch(
    `${API_BASE}/api/game-access/${encodeURIComponent(key)}/shiny`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiny, teacherCode }),
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

export async function setGameOrder(gameKeys, teacherCode) {
  const response = await fetch(`${API_BASE}/api/game-access/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameKeys, teacherCode }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not save game order');
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