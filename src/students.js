import { create } from 'zustand';
import { usePlayerStore } from './playerStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

    // Abort if the server doesn't respond within 12 s — same window the
    // game-access fetch uses. This prevents a hung request from permanently
    // blocking the student roster tab.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(
        `${API_BASE}/api/students?teacherCode=${encodeURIComponent(teacherCode)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to load students');

      const students = await response.json();

      set({
        students,
        loaded: true,
        loadedClassId: usePlayerStore.getState().classId,
        loading: false,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error.name === 'AbortError'
        ? 'The server is taking too long. Please try again.'
        : error.message;
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

// GET — validate a student code and return the student + class info for login.
// Used by the /p/:code auto-login route. Returns null if invalid or timed out.
export async function lookupStudentByCode(code) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `${API_BASE}/api/student-login/${encodeURIComponent(code)}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    return response.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
