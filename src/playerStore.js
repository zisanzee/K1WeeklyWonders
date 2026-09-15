import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { postJson as postJsonRequest } from './apiClient';

// A failed validation request used to be flattened to null and treated as
// "this code no longer resolves", which signed the user out. That is only
// correct for a DEFINITIVE rejection — the server answered and the code really
// is gone. A timeout, a dropped network, or a 5xx from a cold Render instance
// (which can take longer than the client's 15s budget to wake) says nothing
// about whether the credential is still valid, and signing out on one is what
// logged people out at random, before any deploy. Those transient failures are
// distinguished here so the credential survives them.
export function isTransientFailure(err) {
  if (!err) return false;
  if (err.isTimeout) return true;
  const status = err.status || 0;
  return status === 0 || status >= 500;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

      // Re-resolve the stored code into a full identity.
      //
      //  - A DEFINITIVE rejection (the server answered and the code maps to no
      //    usable session) clears the session and signs the user out.
      //  - A TRANSIENT failure (timeout / network / 5xx) is retried, and if it
      //    still fails, the credential is KEPT and the session is simply left
      //    unresolved — so the next load tries again instead of logging the
      //    user out over a backend that was merely asleep.
      //
      // Returns `{ ok, reason }` so a caller (AuthBootstrap) can tell the two
      // apart. `reason` is one of: 'ok' | 'no-code' | 'invalid' | 'transient'.
      hydrate: async ({ retries = 1, retryDelayMs = 900 } = {}) => {
        const { code, name, mode } = get();
        if (!code) {
          set({ status: 'idle' });
          return { ok: false, reason: 'no-code' };
        }

        set({ status: 'loading' });

        // One validation round trip. Throws on transport/HTTP failure; returns
        // false when the request succeeded but the code is no longer usable.
        const attempt = async () => {
          if (mode === 'light') {
            const data = await postJsonRequest('/api/student-login', {
              name,
              classCode: code,
            });
            get()._applyStudent(data.student, data.classInfo, 'light', name);
            return true;
          }

          const data = await postJsonRequest('/api/code-lookup', { code });
          if (data.kind === 'teacherCode' || data.kind === 'adminCode') {
            get()._applyTeacher(data, code);
            return true;
          }
          if (data.kind === 'studentCode') {
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
            return true;
          }
          // A bare class code can't stand alone as a session.
          return false;
        };

        for (let attemptIndex = 0; attemptIndex <= retries; attemptIndex += 1) {
          try {
            const resolved = await attempt();
            if (resolved) {
              set({ status: 'ready' });
              return { ok: true, reason: 'ok' };
            }
            // Server answered and rejected the code — sign out for real.
            get().signOut();
            return { ok: false, reason: 'invalid' };
          } catch (err) {
            const transient = isTransientFailure(err);
            if (transient && attemptIndex < retries) {
              await delay(retryDelayMs);
              continue;
            }
            if (transient) {
              // Keep the credential; leave the session unresolved so a later
              // load retries. Deliberately NOT signOut().
              set({ status: 'idle' });
              return { ok: false, reason: 'transient', error: err };
            }
            // A definitive HTTP rejection (e.g. 401/404).
            get().signOut();
            return { ok: false, reason: 'invalid' };
          }
        }

        // Unreachable, but keeps the shape consistent if `retries` is negative.
        set({ status: get().code ? 'ready' : 'idle' });
        return { ok: Boolean(get().identityKind), reason: 'ok' };
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
