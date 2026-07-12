import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted in localStorage so the name/code prompt only ever shows once,
// the very first time someone opens the site on this device.
export const usePlayerStore = create(
  persist(
    (set) => ({
      playerName: null,
      isTeacher: false,
      setPlayerName: (name) => {
        const trimmed = (name || '').toString().trim().slice(0, 40);
        set({ playerName: trimmed.length > 0 ? trimmed : 'Guest', isTeacher: false });
      },
      // Called once a teacher code has been verified against TEACHER_CODES.
      // Grants access to every game and the stats dashboard.
      setTeacher: (name) => {
        set({ playerName: name, isTeacher: true });
      },
      resetPlayer: () => set({ playerName: null, isTeacher: false }),
    }),
    { name: 'k1weekly-player' }
  )
);
