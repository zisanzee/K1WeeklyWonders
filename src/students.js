import { create } from 'zustand';
import { usePlayerStore } from './playerStore';

// Copy this file into your React project alongside gameAccess.js, e.g.
// src/students.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const useStudentStore = create((set, get) => ({
  students: [],
  loaded: false,
  loading: false,
  loadedClassId: null,
  error: null,

  fetchStudents: async (teacherCode = usePlayerStore.getState().teacherCode) => {
    if (!teacherCode) return;

    const state = get();
    if (state.loading) return;

    set({ loading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE}/api/students?teacherCode=${encodeURIComponent(teacherCode)}`
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
      console.error(error);
      set({ loading: false, error: error.message });
    }
  },

  addStudentLocal: (student) => {
    set((state) => ({ students: [...state.students, student] }));
  },
}));

export async function addStudent({ fullName, nickname, teacherCode }) {
  const response = await fetch(`${API_BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, nickname, teacherCode }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not add student');
  }

  const student = await response.json();
  useStudentStore.getState().addStudentLocal(student);

  return student;
}
