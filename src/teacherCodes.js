// Teacher access codes, shared by the name/code prompt and the stats
// dashboard. A valid code unlocks every game plus the stats button.
// Add new teachers here as "code: name".
export const TEACHER_CODES = {
  '12/10/22': 'Siti Soleha',
  '92702689': 'DEVZee',
};

// Looks up a code and returns the matching teacher's name, or null.
export function lookupTeacher(code) {
  const trimmed = (code || '').toString().trim();
  return TEACHER_CODES[trimmed] || null;
}
