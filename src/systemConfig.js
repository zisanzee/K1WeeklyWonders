import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Global system config (currently just maintenance mode). Loaded once on boot
// and then polled so an admin toggle reaches every open client without a
// refresh — the maintenance overlay appears/disappears live.
export const useSystemConfigStore = create((set) => ({
  maintenanceMode: false,
  maintenanceMessage: '',
  maintenanceEndsAt: null,
  loaded: false,
  error: null,

  fetchConfig: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/system/config`);
      if (!response.ok) throw new Error('Could not load system config');
      const data = await response.json();
      set({
        maintenanceMode: Boolean(data.maintenanceMode),
        maintenanceMessage: data.maintenanceMessage || '',
        maintenanceEndsAt: data.maintenanceEndsAt || null,
        loaded: true,
        error: null,
      });
      return data;
    } catch (err) {
      // Never block the app on a config failure — assume normal operation.
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
    set({
      maintenanceMode: Boolean(data.maintenanceMode),
      maintenanceMessage: data.maintenanceMessage || '',
      maintenanceEndsAt: data.maintenanceEndsAt || null,
      loaded: true,
    });
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
