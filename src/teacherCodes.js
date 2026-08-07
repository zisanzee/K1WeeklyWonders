// Local fallback for teacher-code authentication. NameGate.jsx tries the
// server first (POST /api/teacher-login); this lookup is only used when the
// server is unreachable. Keep in sync with the DB — the server is the
// single source of truth for roles and class assignments.
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
    role: 'admin',
  },
};

// Looks up a code and returns the matching teacher object, or null.
export function lookupTeacher(code) {
  const trimmed = (code || '').toString().trim();
  return TEACHER_CODES[trimmed] || null;
}
