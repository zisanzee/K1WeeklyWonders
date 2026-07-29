import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted in localStorage so the name/code prompt only ever shows once,
// the very first time someone opens the site on this device.
export const usePlayerStore = create(
  persist(
    (set) => ({
      playerName: null,
      classId: null,
      className: null,
      classType: null,
      isTeacher: false,
      isAdmin: false,
      teacherCode: null,
      setPlayer: (name, classroom) => {
        const trimmed = (name || '').toString().trim().slice(0, 40);
        set({
          playerName: trimmed.length > 0 ? trimmed : 'Guest',
          classId: classroom?.id || null,
          className: classroom?.name || null,
          classType: null,
          isTeacher: false,
          isAdmin: false,
          teacherCode: null,
        });
      },
      // Called once a teacher code has been verified server-side via
      // POST /api/teacher-login. Grants access to every game and the
      // stats dashboard. The code itself is kept so authenticated
      // requests can be re-sent without asking the teacher to type it
      // in again every time. role === 'admin' gates write access.
      setTeacher: (teacher, code) => {
        set({
          playerName: teacher.name,
          classId: teacher.classId,
          className: teacher.className,
          classType: teacher.classType,
          isTeacher: true,
          isAdmin: teacher.role === 'admin',
          teacherCode: code,
        });
      },
      resetPlayer: () => set({
        playerName: null,
        classId: null,
        className: null,
        classType: null,
        isTeacher: false,
        isAdmin: false,
        teacherCode: null,
      }),
    }),
    { name: 'k1weekly-player' }
  )
);
