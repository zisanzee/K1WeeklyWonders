import { describe, it, expect } from 'vitest';
import {
  NAME_PREFIX,
  ROSTERED_PREFIX,
  makeStudentKey,
  parseStudentKey,
  studentDetailPath,
} from '@/games/studentKey';

// The key is the security-relevant half of the per-student route: the server
// trusts it to decide WHICH child a teacher is asking about. A parse that
// silently guessed would let a wrong-but-valid URL show another child's history,
// so every branch is pinned here.

describe('makeStudentKey', () => {
  it('prefers studentId when both are present', () => {
    // A rostered row always has a name too; the id must win, because the name is
    // not unique and the id is.
    expect(makeStudentKey({ studentId: 'abc-123', name: 'Aarav' })).toBe('s_abc-123');
  });

  it('falls back to the name for a light identity', () => {
    expect(makeStudentKey({ name: 'Aarav' })).toBe(`${NAME_PREFIX}Aarav`);
  });

  it('trims the name before encoding it', () => {
    expect(makeStudentKey({ name: '  Aarav K  ' })).toBe(`${NAME_PREFIX}Aarav%20K`);
  });

  it('encodes characters that would break a URL path', () => {
    // "/" and "#" would otherwise split the path or start a fragment.
    expect(makeStudentKey({ name: 'A/B#C' })).toBe(`${NAME_PREFIX}A%2FB%23C`);
  });

  it('returns an empty string when it has nothing to address', () => {
    expect(makeStudentKey({})).toBe('');
    expect(makeStudentKey()).toBe('');
    expect(makeStudentKey({ name: '   ' })).toBe('');
  });
});

describe('parseStudentKey', () => {
  it('parses a rostered key', () => {
    expect(parseStudentKey('s_abc-123')).toEqual({
      kind: 'rostered',
      studentId: 'abc-123',
      name: null,
    });
  });

  it('parses and decodes a light key', () => {
    expect(parseStudentKey(`${NAME_PREFIX}Aarav%20K`)).toEqual({
      kind: 'light',
      studentId: null,
      name: 'Aarav K',
    });
  });

  it('round-trips both kinds through make → parse', () => {
    const names = ['Aarav', 'A/B#C', 'Zoë', '名字', 'A B  C'];
    for (const name of names) {
      const parsed = parseStudentKey(makeStudentKey({ name }));
      expect(parsed, name).toEqual({ kind: 'light', studentId: null, name });
    }

    const parsedRoster = parseStudentKey(makeStudentKey({ studentId: 'uuid-1' }));
    expect(parsedRoster).toEqual({ kind: 'rostered', studentId: 'uuid-1', name: null });
  });

  // These are the cases the server turns into a 400. Returning null (rather than
  // a best-effort guess) is what makes that possible.
  it('rejects anything it cannot interpret', () => {
    expect(parseStudentKey('')).toBeNull();
    expect(parseStudentKey(undefined)).toBeNull();
    expect(parseStudentKey(null)).toBeNull();
    // No recognised prefix.
    expect(parseStudentKey('abc-123')).toBeNull();
    expect(parseStudentKey('Aarav')).toBeNull();
    // Recognised prefix but no payload.
    expect(parseStudentKey(ROSTERED_PREFIX)).toBeNull();
    expect(parseStudentKey(NAME_PREFIX)).toBeNull();
    expect(parseStudentKey(`${NAME_PREFIX}   `)).toBeNull();
    // A malformed percent-escape must not throw.
    expect(parseStudentKey(`${NAME_PREFIX}%E0%A4%A`)).toBeNull();
  });

  it('does not confuse a name that looks like an id', () => {
    // The whole reason for the prefix: a child named like a UUID is still a
    // NAME, and this must not be parsed as a rostered lookup.
    const key = makeStudentKey({ name: '123e4567-e89b-12d3-a456-426614174000' });
    expect(parseStudentKey(key)).toEqual({
      kind: 'light',
      studentId: null,
      name: '123e4567-e89b-12d3-a456-426614174000',
    });
  });
});

describe('studentDetailPath', () => {
  it('builds the route with the class id as its own segment', () => {
    expect(studentDetailPath('k12026-pny', 's_abc')).toBe('/game-access/student/k12026-pny/s_abc');
  });

  it('encodes the class id so it cannot escape its segment', () => {
    expect(studentDetailPath('a/b', 'n_X')).toBe('/game-access/student/a%2Fb/n_X');
  });

  it('returns an empty string when either part is missing', () => {
    expect(studentDetailPath('', 's_a')).toBe('');
    expect(studentDetailPath('c', '')).toBe('');
    expect(studentDetailPath(null, null)).toBe('');
  });
});
