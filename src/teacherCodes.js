// Teacher codes — local fallback for when the server-side login endpoint
// (POST /api/teacher-login) isn't deployed yet. NameGate.jsx tries the
// API first, falls back to this lookup if the server is unavailable.
//
// Once the server migration (Phases 1-4) is complete, this file should
// be deleted — the server becomes the single source of truth.
export const TEACHER_CODES = {
  '12/10/22': {
    name: 'Siti Soleha',
    className: 'Kindergarten 1',
    classId: 'k12026-pny',
    classType: 'k1',
    role: 'admin',
  },
  '92702689': {
    name: 'DEVZee',
    className: 'Test class',
    classId: 'test2026-jyx',
    classType: 'k1',
    role: 'teacher',
  },
};

// Temporary mapping: each classType maps to a classId used for game-access
// storage, and the teacher code whose auth resolves to that classId on the
// server. The server derives the classId from the teacher code, so K2
// writes must use a code that resolves to test2026-jyx (92702689).
// Once the server supports classType-scoped writes (Phases 1-4), delete this.
export const CLASS_TYPE_CONFIG = {
  k1: { classId: 'k12026-pny', writeCode: '12/10/22' },
  k2: { classId: 'test2026-jyx', writeCode: '92702689' },
};

// Looks up a code and returns the matching teacher object, or null.
export function lookupTeacher(code) {
  const trimmed = (code || '').toString().trim();
  return TEACHER_CODES[trimmed] || null;
}
