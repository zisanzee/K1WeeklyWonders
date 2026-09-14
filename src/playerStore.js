import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { postJson as postJsonRequest } from './apiClient';

// "This code doesn't resolve" is a normal outcome here — the store signs the
// user out in response — so a failed request is flattened to null instead of
// being thrown. The shared client's timeout matters more on this path than
// anywhere else: hydrate() runs inside AuthBootstrap and gates the whole app
// render, so without one a hung /api/code-lookup left a child on the loading
// screen indefinitely, with no error and nothing to retry.
async function postJson(path, body) {
  try {
    return await postJsonRequest(path, body);
  } catch {
    return null;
  }
}

// The persisted slice is intentionally tiny: ONLY the credential needed to
// re-resolve the identity from the database on every load. Nothing else — no
// names, class ids, or roles — is cached locally, so if a teacher later removes
// a student (or changes a code), that device is signed out the next time it
// validates its code. All identity data below is derived from the DB at runtime.
//
// Persisted shapes:
//   - mode 'code'  → `code` is a student / teacher / admin code
//   - mode 'light' → `code` is a public class code and `name` is the child's name
export const usePlayerStore = create(
  persist(
    (set, get) => ({
      // ---- persisted (the whole of what we keep on the device) ----
      code: null,
      name: null,
      mode: null,

      // ---- runtime identity (never persisted) ----
      status: 'idle', // 'idle' (no session) | 'loading' | 'ready'
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

      // --- internal appliers (set the runtime identity from a server payload) ---
      _applyTeacher: (teacher, code) =>
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
          isAdmin: teacher.role === 'admin',
          teacherCode: code,
          identityKind: teacher.role === 'admin' ? 'admin' : 'teacher',
          code,
          name: null,
          mode: 'code',
        }),

      _applyStudent: (student, classInfo, mode, name) =>
        set({
          playerName: student?.name || student?.nickname || student?.fullName || name || 'Student',
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
          identityKind: student?.studentId ? 'student-rostered' : 'student-light',
          code: classInfo?.classCode || get().code,
          name: mode === 'light' ? name : null,
          mode,
        }),

      // Re-resolve the stored code into a full identity. If the code no longer
      // resolves (student/teacher removed, class deleted or made private), the
      // session is cleared and the user is signed out.
      hydrate: async () => {
        const { code, name, mode } = get();
        if (!code) {
          set({ status: 'idle' });
          return;
        }

        set({ status: 'loading' });
        try {
          if (mode === 'light') {
            const data = await postJson('/api/student-login', {
              name,
              classCode: code,
            });
            if (data) {
              get()._applyStudent(data.student, data.classInfo, 'light', name);
            } else {
              get().signOut();
            }
          } else {
            const data = await postJson('/api/code-lookup', { code });
            if (!data) {
              get().signOut();
            } else if (data.kind === 'teacherCode' || data.kind === 'adminCode') {
              get()._applyTeacher(data, code);
            } else if (data.kind === 'studentCode') {
              get()._applyStudent(
                { studentId: data.studentId, name: data.studentName, code },
                {
                  classId: data.classId,
                  className: data.className,
                  classAlias: data.classAlias,
                  classCode: data.classCode,
                },
                'code'
              );
            } else {
              // A bare class code can't stand alone as a session.
              get().signOut();
            }
          }
        } catch {
          get().signOut();
        }

        // signOut() clears `code`; otherwise the session is valid.
        set({ status: get().code ? 'ready' : 'idle' });
      },

      // Sign in with a student / teacher / admin code. Returns the resolved
      // identityKind, or null when the code doesn't resolve.
      signInWithCode: async (rawCode) => {
        const trimmed = (rawCode || '').toString().trim();
        if (!trimmed) return null;
        set({ code: trimmed, name: null, mode: 'code' });
        await get().hydrate();
        return get().identityKind;
      },

      // Sign in as a public-class "light" student (name + class code).
      signInLight: async (name, classCode) => {
        const trimmedCode = (classCode || '').toString().trim();
        const trimmedName = (name || '').toString().trim().slice(0, 40);
        if (!trimmedCode || !trimmedName) return false;
        set({ code: trimmedCode, name: trimmedName, mode: 'light' });
        await get().hydrate();
        return Boolean(get().identityKind);
      },

      // Full sign-out: clears both the persisted credential and the identity.
      signOut: () =>
        set({
          code: null,
          name: null,
          mode: null,
          status: 'idle',
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

      // Back-compat alias: several components call resetPlayer() to log out.
      resetPlayer: () => get().signOut(),
    }),
    {
      // ⚠️ DO NOT change `name` or `version` in normal updates. Changing EITHER
      // one makes every device read a missing/older session and logs everyone
      // out again. They are only ever bumped intentionally to force a global
      // reset — which is exactly what happened once, at the overhaul below.
      name: 'ezwonders-player',
      version: 3,
      // Persist ONLY the credential. Everything else is re-fetched on load.
      partialize: (state) => ({
        code: state.code,
        name: state.name,
        mode: state.mode,
      }),
      // v1/v2 sessions (pre-code-only) are discarded a single time so everyone
      // signs in once through the new flow. A session already at v3 is returned
      // untouched, so ordinary deploys never log anyone out.
      migrate: (_persisted, version) => (version < 3 ? {} : _persisted),
    }
  )
);

// True for the two student identity kinds. Kept for callers that reason about
// whether the current identity is a child (e.g. maintenance gating).
export function isStudentIdentity(state) {
  return (
    state?.identityKind === 'student-light' ||
    state?.identityKind === 'student-rostered'
  );
}

// Remove the pre-rebrand session key so it can't linger on returning devices.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('k1weekly-player');
  }
} catch {
  /* ignore private-mode / disabled storage */
}
