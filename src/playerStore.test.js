import { describe, it, expect, beforeEach, vi } from 'vitest';

// Control the one network call hydrate() makes, so the tests exercise the
// store's real decision logic (sign out vs. keep the credential) rather than a
// reimplementation of it.
vi.mock('./apiClient', () => ({
  postJson: vi.fn(),
}));

import { postJson } from './apiClient';
import { usePlayerStore, isTransientFailure } from './playerStore';

// A successful /api/code-lookup payload for a teacher code.
const teacherPayload = {
  kind: 'teacherCode',
  name: 'Ms Teacher',
  classId: 'k12026-pny',
  className: 'Sunshine',
  classAlias: 'SUN',
  classCode: 'SUN123',
  role: 'teacher',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  usePlayerStore.setState({
    code: null,
    name: null,
    mode: null,
    status: 'idle',
    playerName: null,
    classId: null,
    isTeacher: false,
    isAdmin: false,
    identityKind: null,
    teacherCode: null,
  });
});

describe('isTransientFailure', () => {
  it('treats timeouts, network failures and 5xx as transient', () => {
    // These say nothing about whether the credential is still valid, so they
    // must NOT be allowed to sign the user out.
    expect(isTransientFailure({ isTimeout: true })).toBe(true);
    expect(isTransientFailure({ status: 0 })).toBe(true); // no status = never completed
    expect(isTransientFailure({ status: 500 })).toBe(true);
    expect(isTransientFailure({ status: 503 })).toBe(true);
  });

  it('treats a definitive 4xx rejection as non-transient', () => {
    // These mean the server answered and the code is genuinely unusable.
    expect(isTransientFailure({ status: 401 })).toBe(false);
    expect(isTransientFailure({ status: 404 })).toBe(false);
    expect(isTransientFailure(null)).toBe(false);
  });
});

describe('hydrate — the regression that logged people out at random', () => {
  it('KEEPS the credential when validation times out', async () => {
    postJson.mockRejectedValueOnce({ isTimeout: true });
    usePlayerStore.setState({ code: 'ABC123', mode: 'code' });

    const result = await usePlayerStore.getState().hydrate({ retries: 0 });

    // The whole point: a merely-sleepy backend must not clear the session.
    expect(result.reason).toBe('transient');
    expect(usePlayerStore.getState().code).toBe('ABC123');
    expect(usePlayerStore.getState().isTeacher).toBe(false);
  });

  it('KEEPS the credential when the server returns a 5xx', async () => {
    postJson.mockRejectedValueOnce({ status: 503 });
    usePlayerStore.setState({ code: 'ABC123', mode: 'code' });

    const result = await usePlayerStore.getState().hydrate({ retries: 0 });

    expect(result.reason).toBe('transient');
    expect(usePlayerStore.getState().code).toBe('ABC123');
  });

  it('retries a transient failure before giving up', async () => {
    postJson
      .mockRejectedValueOnce({ isTimeout: true })
      .mockResolvedValueOnce(teacherPayload);
    usePlayerStore.setState({ code: 'ABC123', mode: 'code' });

    const result = await usePlayerStore
      .getState()
      .hydrate({ retries: 1, retryDelayMs: 0 });

    expect(result).toMatchObject({ ok: true, reason: 'ok' });
    expect(postJson).toHaveBeenCalledTimes(2);
    expect(usePlayerStore.getState().isTeacher).toBe(true);
  });

  it('SIGNS OUT when the server definitively rejects the code', async () => {
    postJson.mockRejectedValueOnce({ status: 401 });
    usePlayerStore.setState({ code: 'GONE', mode: 'code' });

    const result = await usePlayerStore.getState().hydrate({ retries: 1, retryDelayMs: 0 });

    expect(result.reason).toBe('invalid');
    expect(usePlayerStore.getState().code).toBeNull();
    expect(usePlayerStore.getState().identityKind).toBeNull();
    // A definitive rejection must not be retried.
    expect(postJson).toHaveBeenCalledTimes(1);
  });

  it('SIGNS OUT when the code resolves to nothing usable', async () => {
    // A bare class code can't stand alone as a session.
    postJson.mockResolvedValueOnce({ kind: 'classCode' });
    usePlayerStore.setState({ code: 'CLASS1', mode: 'code' });

    const result = await usePlayerStore.getState().hydrate({ retries: 0 });

    expect(result.reason).toBe('invalid');
    expect(usePlayerStore.getState().code).toBeNull();
  });

  it('applies the identity and clears name on a successful code login', async () => {
    postJson.mockResolvedValueOnce(teacherPayload);
    usePlayerStore.setState({ code: 'ABC123', mode: 'code', name: 'stale' });

    const result = await usePlayerStore.getState().hydrate({ retries: 0 });
    const state = usePlayerStore.getState();

    expect(result.reason).toBe('ok');
    expect(state.status).toBe('ready');
    expect(state.isTeacher).toBe(true);
    expect(state.classId).toBe('k12026-pny');
    expect(state.name).toBeNull();
  });
});
