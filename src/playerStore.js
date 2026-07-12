import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted in localStorage so the name prompt only ever shows once,
// the very first time someone plays any game on this device.
export const usePlayerStore = create(
  persist(
    (set) => ({
      playerName: null,
      setPlayerName: (name) => {
        const trimmed = (name || '').toString().trim().slice(0, 40);
        set({ playerName: trimmed.length > 0 ? trimmed : 'Guest' });
      },
      resetPlayerName: () => set({ playerName: null }),
    }),
    { name: 'k1weekly-player' }
  )
);
