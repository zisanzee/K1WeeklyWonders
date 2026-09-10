// DEPRECATED. NameGate no longer falls back to this file — the login flow uses
// server endpoints (/api/code-lookup, /api/teacher-login) exclusively, since a
// client-side mirror drifts from the DB and locks out new/edited teachers. Kept
// only so any stray importer still resolves; do not add codes here.
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
