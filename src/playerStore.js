import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisted in localStorage so the login prompt only ever shows once, the very
// first time someone opens the site on this device. The key was intentionally
// CHANGED to 'ezwonders-player' so the overhaul signs everyone out once: the
// old 'k1weekly-player' session is ignored (and deleted below) rather than
// migrated, forcing one clean login through the new code-first flow.
//
// `identityKind` is the single field the rest of the app branches on:
//   'student-light'    → public class, name + class code only, no Student record
//   'student-rostered' → a per-student code backed by a Student record
//   'teacher'          → a teacher code
//   'admin'            → the single global admin code
export const usePlayerStore = create(
  persist(
    (set) => ({
      playerName: null,
      classId: null,
      className: null,
      classAlias: null,
      classCode: null,
      classType: null,
      studentCode: null,
      studentId: null,
      isTeacher: false,
      isAdmin: false,
      teacherCode: null,
      identityKind: null,

      // Legacy player sign-in (name only, default class). Retained for any
      // caller that still signs a child in without a class/student context.
      setPlayer: (name, classroom) => {
        const trimmed = (name || '').toString().trim().slice(0, 40);
        set({
          playerName: trimmed.length > 0 ? trimmed : 'Guest',
          classId: classroom?.id || null,
          className: classroom?.name || null,
          classAlias: classroom?.alias || classroom?.name || null,
          classCode: classroom?.classCode || null,
          classType: classroom?.classType || null,
          studentCode: null,
          studentId: null,
          isTeacher: false,
          isAdmin: false,
          teacherCode: null,
          identityKind: 'student-light',
        });
      },

      // Teacher / admin sign-in via POST /api/teacher-login (or code-lookup).
      // The code is kept so authenticated requests can be re-sent without
      // asking again; role === 'admin' drives the admin-only UI.
      setTeacher: (teacher, code) => {
        const isAdmin = teacher.role === 'admin';
        set({
          playerName: teacher.name,
          classId: teacher.classId || null,
          className: teacher.className || null,
          classAlias: teacher.classAlias || null,
          classCode: teacher.classCode || null,
          classType: teacher.classType || null,
          studentCode: null,
          studentId: null,
          isTeacher: true,
          isAdmin,
          teacherCode: code,
          identityKind: isAdmin ? 'admin' : 'teacher',
        });
      },

      // Rostered student sign-in (per-student code, any class type).
      setStudentPlayer: (student, classInfo) => {
        set({
          playerName: student?.name || student?.nickname || student?.fullName || 'Student',
          classId: classInfo?.classId || null,
          className: classInfo?.className || null,
          classAlias: classInfo?.classAlias || classInfo?.className || null,
          classCode: classInfo?.classCode || null,
          classType: classInfo?.classType || null,
          studentCode: student?.code || null,
          studentId: student?.studentId || null,
          isTeacher: false,
          isAdmin: false,
          teacherCode: null,
          identityKind: 'student-rostered',
        });
      },

      // Public-class "light" sign-in (name + class code, no Student record).
      setStudentLight: (name, classInfo) => {
        const trimmed = (name || '').toString().trim().slice(0, 40);
        set({
          playerName: trimmed.length > 0 ? trimmed : 'Guest',
          classId: classInfo?.classId || null,
          className: classInfo?.className || null,
          classAlias: classInfo?.classAlias || classInfo?.className || null,
          classCode: classInfo?.classCode || null,
          classType: classInfo?.classType || null,
          studentCode: null,
          studentId: null,
          isTeacher: false,
          isAdmin: false,
          teacherCode: null,
          identityKind: 'student-light',
        });
      },

      resetPlayer: () =>
        set({
          playerName: null,
          classId: null,
          className: null,
          classAlias: null,
          classCode: null,
          classType: null,
          studentCode: null,
          studentId: null,
          isTeacher: false,
          isAdmin: false,
          teacherCode: null,
          identityKind: null,
        }),
    }),
    {
      name: 'ezwonders-player',
      version: 2,
      // Any stored session from an older version is discarded (returns a clean
      // slate) instead of migrated. To force another global sign-out in future,
      // just bump `version` below.
      migrate: (persisted, version) => (version < 2 ? {} : persisted),
    }
  )
);

// Remove the pre-rebrand session key so it can't linger (or be restored by an
// older cached bundle) on returning devices. Wrapped because localStorage can
// throw in private mode or when storage is disabled.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('k1weekly-player');
  }
} catch {
  /* ignore */
}

// True for the two student identity kinds — used by the maintenance gate to
// decide whether a not-yet-logged-in visitor should be treated as a student.
export function isStudentIdentity(state) {
  return (
    state.identityKind === 'student-light' ||
    state.identityKind === 'student-rostered'
  );
}
