import { create } from 'zustand';
import { usePlayerStore } from './playerStore';
import { API_BASE, fetchWithTimeout } from './apiClient';

// Generates a short, kid-friendly login code: 6 uppercase alphanumeric chars.
// Collision probability is negligible for typical class sizes.
function generateStudentCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/1/O/0 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const useStudentStore = create((set, get) => ({
  students: [],
  loaded: false,
  loading: false,
  loadedClassId: null,
  error: null,

  fetchStudents: async (teacherCode = usePlayerStore.getState().teacherCode) => {
    if (!teacherCode) return;

    const state = get();
    // If a fetch is already in flight, don't stack another one — but if the
    // previous fetch has been stuck for >15 s (server timeout), allow a retry.
    if (state.loading) return;

    const classId = usePlayerStore.getState().classId;

    // The roster is class-scoped. If the store still holds a different class's
    // students (e.g. after logging in as a different teacher), drop them before
    // fetching so the stale list never flashes for the new class.
    if (state.loadedClassId && state.loadedClassId !== classId) {
      set({ students: [], loaded: false, loadedClassId: null, error: null });
    }

    set({ loading: true, error: null });

    // Same 12 s window the game-access fetch uses, so a hung request can never
    // permanently block the student roster tab.
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/students?teacherCode=${encodeURIComponent(teacherCode)}`,
        {},
        12_000
      );

      if (!response.ok) throw new Error('Failed to load students');

      const students = await response.json();

      set({
        students,
        loaded: true,
        loadedClassId: usePlayerStore.getState().classId,
        loading: false,
      });
    } catch (error) {
      const message = error.message || 'Failed to load students';
      console.error(error);
      set({ loading: false, error: message });
    }
  },

  // Clears the cached roster — used when the logged-in teacher's class changes
  // so a previous class's students never leak into the new session.
  reset: () => set({ students: [], loaded: false, loading: false, error: null, loadedClassId: null }),

  addStudentLocal: (student) => {
    set((state) => ({ students: [...state.students, student] }));
  },

  // Inline update after the server confirms the edit — avoids a full re-fetch.
  updateStudentLocal: (studentId, updates) => {
    set((state) => ({
      students: state.students.map((s) =>
        s.studentId === studentId ? { ...s, ...updates } : s
      ),
    }));
  },

  removeStudentLocal: (studentId) => {
    set((state) => ({
      students: state.students.filter((s) => s.studentId !== studentId),
    }));
  },
}));

// POST — add a new student. The server stores nickname, group, and the
// generated code. `fullName` is still sent for compatibility but the UI
// now emphasises nickname.
export async function addStudent({ fullName, nickname, group, teacherCode }) {
  const code = generateStudentCode();

  const response = await fetch(`${API_BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, nickname, group, code, teacherCode }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not add student');
  }

  const student = await response.json();
  useStudentStore.getState().addStudentLocal(student);

  return student;
}

// PUT — update an existing student's nickname and/or group. Code cannot be
// changed through this endpoint.
export async function updateStudent({ studentId, nickname, group, teacherCode }) {
  const response = await fetch(
    `${API_BASE}/api/students/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, group, teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not update student');
  }

  const updated = await response.json();
  useStudentStore.getState().updateStudentLocal(studentId, updated);

  return updated;
}

// DELETE — remove a student from the roster.
export async function deleteStudent({ studentId, teacherCode }) {
  const response = await fetch(
    `${API_BASE}/api/students/${encodeURIComponent(studentId)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherCode }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not delete student');
  }

  useStudentStore.getState().removeStudentLocal(studentId);
}

// Validate a student code and return { student, classInfo } for login. Uses the
// v2 code-lookup so merged codes resolve to the primary identity. Returns null
// if the code isn't a (valid) student code or the request times out.
export async function lookupStudentByCode(code) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${API_BASE}/api/code-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.kind !== 'studentCode') return null;

    return {
      student: {
        studentId: data.studentId,
        name: data.studentName,
        code: (code || '').toString().trim().toUpperCase(),
      },
      classInfo: {
        classId: data.classId,
        className: data.className,
        classAlias: data.classAlias,
        classCode: data.classCode,
      },
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Class-scoped roster + player-identity merge (teacher own class, admin any)
// ---------------------------------------------------------------------------

async function jsonRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// The merge UI's source list: roster students ∪ distinct play-session names.
export async function fetchClassIdentities(classId, teacherCode) {
  return jsonRequest(
    `/api/classes/${encodeURIComponent(classId)}/identities?teacherCode=${encodeURIComponent(teacherCode)}`
  );
}

// Merge 2+ identities into a primary. Accepts either names or roster ids.
export async function mergeIdentities(classId, payload, teacherCode) {
  return jsonRequest(`/api/classes/${encodeURIComponent(classId)}/students/merge`, {
    method: 'POST',
    body: { ...payload, teacherCode },
  });
}

// Unmerge a single identity. `memberName` identifies record-less "light" names;
// a roster student can instead pass its studentId via `studentId`.
export async function unmergeIdentity(classId, { memberName, studentId }, teacherCode) {
  const target = studentId || 'name';
  return jsonRequest(
    `/api/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(target)}/unmerge`,
    { method: 'POST', body: { memberName, teacherCode } }
  );
}

// Class-scoped student CRUD used by the redesigned panel.
export async function addStudentToClass(classId, { nickname, fullName, group, code }, teacherCode) {
  return jsonRequest(`/api/classes/${encodeURIComponent(classId)}/students`, {
    method: 'POST',
    body: { nickname, fullName, group, code, teacherCode },
  });
}

export async function updateStudentInClass(classId, studentId, patch, teacherCode) {
  return jsonRequest(
    `/api/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    { method: 'PUT', body: { ...patch, teacherCode } }
  );
}

export async function deleteStudentInClass(classId, studentId, teacherCode) {
  return jsonRequest(
    `/api/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    { method: 'DELETE', body: { teacherCode } }
  );
}

// Deletes a name-only ("light") identity — a public-class kid with no Student
// record. There is nothing to delete but their play history, so this hits the
// identity endpoint rather than the student one.
export async function deleteIdentityInClass(classId, name, teacherCode) {
  return jsonRequest(
    `/api/classes/${encodeURIComponent(classId)}/identities/${encodeURIComponent(name)}`,
    { method: 'DELETE', body: { teacherCode } }
  );
}

// Generator is exported so the panel can prefill a fresh 6-char code.
export { generateStudentCode };
