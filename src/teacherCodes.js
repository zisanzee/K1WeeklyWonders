// Teacher access codes, shared by the name/code prompt and the stats
// dashboard. A valid code unlocks every game plus the stats button.
// Keep this UI mirror in sync with the server. The server remains the
// authority for protected requests.
export const TEACHER_CODES = {
  '12/10/22': {
    name: 'Siti Soleha',
    className: 'Kindergarten 1',
    classId: 'k12026-pny',
  },
  '92702689': {
    name: 'DEVZee',
    className: 'Test class',
    classId: 'test2026-jyx',
  },
};

// Looks up a code and returns the matching teacher's name, or null.
export function lookupTeacher(code) {
  const trimmed = (code || '').toString().trim();
  return TEACHER_CODES[trimmed] || null;
}
