import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted in localStorage so the name/code prompt only ever shows once,
// the very first time someone opens the site on this device.
export const usePlayerStore = create(
  persist(
    (set) => ({
      playerName: null,
      isTeacher: false,
      teacherCode: null,
      setPlayerName: (name) => {
        const trimmed = (name || '').toString().trim().slice(0, 40);
        set({ playerName: trimmed.length > 0 ? trimmed : 'Guest', isTeacher: false, teacherCode: null });
      },
      // Called once a teacher code has been verified against TEACHER_CODES.
      // Grants access to every game and the stats dashboard. The code
      // itself is kept (not just the name) so authenticated requests —
      // like locking/unlocking a game — can be re-sent to the server
      // without asking the teacher to type it in again every time.
      setTeacher: (name, code) => {
        set({ playerName: name, isTeacher: true, teacherCode: code });
      },
      resetPlayer: () => set({ playerName: null, isTeacher: false, teacherCode: null }),
    }),
    { name: 'k1weekly-player' }
  )
);
