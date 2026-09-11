import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Maintenance mode is a rare, near-never toggle, but the app used to block its
// ENTIRE first paint on a request to learn "maintenance is off" — one of three
// serialised round trips on every load. The flags now live in localStorage:
// the last known value renders immediately and the fetch only ever *corrects*
// it. Worst case a visitor sees the app for the few hundred ms before an
// overlay appears; the alternative was every visitor waiting on a round trip
// to be told nothing changed.
const CACHE_KEY = 'ezw.systemConfig.v1';

function readCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Guard against a hand-edited or corrupted entry poisoning the store.
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      maintenanceMode: Boolean(parsed.maintenanceMode),
      maintenanceMessage:
        typeof parsed.maintenanceMessage === 'string'
          ? parsed.maintenanceMessage
          : '',
      maintenanceEndsAt: parsed.maintenanceEndsAt || null,
    };
  } catch {
    return null;
  }
}

function writeCache(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Quota or private-mode failure is irrelevant here — the cache is an
    // optimisation, and the app works fine without it.
  }
}

const cached = readCache();

// Global system config (currently just maintenance mode). Loaded once on boot
// and then polled so an admin toggle reaches every open client without a
// refresh — the maintenance overlay appears/disappears live.
export const useSystemConfigStore = create((set) => ({
  maintenanceMode: cached?.maintenanceMode ?? false,
  maintenanceMessage: cached?.maintenanceMessage ?? '',
  maintenanceEndsAt: cached?.maintenanceEndsAt ?? null,
  // `loaded` records whether we've heard from the server THIS session. A
  // cached value deliberately does not count: the gate uses it to decide
  // whether a fetch is still worth waiting on, not whether it is safe to render.
  loaded: false,
  error: null,

  fetchConfig: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/system/config`);
      if (!response.ok) throw new Error('Could not load system config');
      const data = await response.json();
      const next = {
        maintenanceMode: Boolean(data.maintenanceMode),
        maintenanceMessage: data.maintenanceMessage || '',
        maintenanceEndsAt: data.maintenanceEndsAt || null,
      };
      writeCache(next);
      set({ ...next, loaded: true, error: null });
      return data;
    } catch (err) {
      // Never block the app on a config failure — assume normal operation.
      // The cached values stay in place rather than being reset, so a blip
      // can't flip a school out of a genuine maintenance state.
      set({ loaded: true, error: err.message });
      return null;
    }
  },

  // Admin-only. Optimistically reflects the response so the admin UI updates
  // immediately without waiting for the next poll.
  patchConfig: async (patch, teacherCode) => {
    const response = await fetch(`${API_BASE}/api/system/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...patch, teacherCode }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Could not update system config');
    }
    const next = {
      maintenanceMode: Boolean(data.maintenanceMode),
      maintenanceMessage: data.maintenanceMessage || '',
      maintenanceEndsAt: data.maintenanceEndsAt || null,
    };
    // Cache the admin's own change too, so the very next page load on this
    // device reflects it without waiting for the poll.
    writeCache(next);
    set({ ...next, loaded: true });
    return data;
  },
}));

let pollTimer = null;

// Kicks off an immediate fetch plus a repeating poll. Safe to call repeatedly —
// only one interval is ever created.
export function startSystemConfigPolling(intervalMs = 45_000) {
  useSystemConfigStore.getState().fetchConfig();
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    useSystemConfigStore.getState().fetchConfig();
  }, intervalMs);
}
