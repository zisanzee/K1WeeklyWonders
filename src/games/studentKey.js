// studentKey.js
// The identity key used by the per-student detail route:
//
//   /game-access/student/:classId/:studentKey
//
// WHY A PREFIXED KEY AND NOT JUST :studentId
// ---------------------------------------------------------------------------
// A "student" in this app has three shapes, and they do not share one identifier:
//
//   • rostered student  → has a stable `studentId` (a UUID) and, usually, a code
//   • "light" identity  → a public-class child who only ever gave a name, so the
//                         ONLY thing identifying them is `playerName`
//   • merged identity   → a roster row that was folded into another; still in the
//                         DB, but addressed through its primary
//
// So a route that took a bare id could not tell a UUID from a name without a DB
// lookup first — and a child literally named e.g. "9234..." would be ambiguous.
// Worse, a name is NOT unique: two classes can each have an "Aarav", and one
// class can have two roster rows sharing a display name.
//
// The prefix makes the parse TOTAL and unambiguous, and lets the server reject a
// malformed key with a 400 before touching Mongo:
//
//   s_<studentId>   → rostered student
//   n_<name>        → light identity, name URI-encoded
//
// `classId` is always a SEPARATE path segment, never baked into the key: that is
// what makes the same name in another class a different page, and it is the value
// the server's requireClassAccess compares against.
//
// This module is pure (no imports) so it is safe to unit test and safe to import
// from both the router and the panel.

export const ROSTERED_PREFIX = 's_';
export const NAME_PREFIX = 'n_';

// Names arrive already trimmed from the API, but a panel row can be built from a
// play session whose name has stray whitespace, so trim defensively. Encoding
// happens in the key so a name containing "/" or "#" cannot break the path.
export function makeStudentKey({ studentId, name } = {}) {
  if (studentId) return `${ROSTERED_PREFIX}${studentId}`;
  const trimmed = (name ?? '').toString().trim();
  if (!trimmed) return '';
  return `${NAME_PREFIX}${encodeURIComponent(trimmed)}`;
}

// Returns { kind, studentId, name } or null when the key is unusable.
//
// `kind` is 'rostered' | 'light'. Callers should treat null as a hard 400: it
// means the URL was hand-edited or a caller passed the wrong field.
export function parseStudentKey(key) {
  const raw = (key ?? '').toString();
  if (!raw) return null;

  if (raw.startsWith(ROSTERED_PREFIX)) {
    const studentId = raw.slice(ROSTERED_PREFIX.length).trim();
    // A UUID is never empty; an empty suffix means the key was malformed.
    if (!studentId) return null;
    return { kind: 'rostered', studentId, name: null };
  }

  if (raw.startsWith(NAME_PREFIX)) {
    const encoded = raw.slice(NAME_PREFIX.length);
    let name;
    try {
      name = decodeURIComponent(encoded);
    } catch {
      // A malformed percent-escape would otherwise throw inside the router.
      return null;
    }
    name = name.trim();
    if (!name) return null;
    return { kind: 'light', studentId: null, name };
  }

  // No recognised prefix — not one of ours.
  return null;
}

// Convenience for the panel: build the URL for one identity row.
// `classId` is encoded because it is a path segment, and a class id with a
// slash would otherwise silently address a different route.
export function studentDetailPath(classId, studentKey) {
  if (!classId || !studentKey) return '';
  return `/game-access/student/${encodeURIComponent(classId)}/${studentKey}`;
}
