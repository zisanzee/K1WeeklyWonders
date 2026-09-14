import { usePlayerStore } from './playerStore';
import { API_BASE, withQuery, fetchWithTimeout } from './apiClient';
import { detectDevice } from './deviceFingerprint';

// The API origin, query-string building and the fetch timeout all come from
// apiClient.js — this file used to redeclare its own copy of the first two and
// a third, differently-timed version of the last.

// Same default class NameGate.jsx falls back to for players who never see
// a class picker. Anyone whose classId is missing — a very old cached
// session, a play logged before setPlayer/setTeacher ever ran, etc. — gets
// attributed here instead of the server rejecting the session outright.
const LEGACY_CLASS_ID = 'k12026-pny';

// The fingerprint itself lives in deviceFingerprint.js so it can be unit
// tested against real user-agent strings without a DOM.

export async function logPlaySession({
  game,
  playerName = 'Guest',
  stars,
  totalRounds,
  peakStreak = 0,
  elapsedSeconds,
  mistakes,
}) {
  try {
    const state = usePlayerStore.getState();
    const classId = state.classId || LEGACY_CLASS_ID;
    // Rostered players carry a studentId so the server can attribute (and
    // merge) the session even when the display name changes.
    const studentId = state.studentId || undefined;
    const res = await fetch(`${API_BASE}/api/plays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game,
        playerName,
        classId,
        studentId,
        stars,
        totalRounds,
        peakStreak,
        elapsedSeconds,
        mistakes,
        device: detectDevice(),
      }),
    });
    if (!res.ok) {
      // A non-2xx response (e.g. an unrecognized `game` slug) still counts
      // as a "successful" fetch as far as try/catch is concerned — this is
      // what actually surfaces a rejected save instead of it vanishing
      // silently the way it did before.
      const body = await res.text().catch(() => '');
      console.warn(`[logPlaySession] Server rejected the play session: ${res.status} ${res.statusText}`, body);
    }
  } catch (err) {
    // A logging failure should never break the game itself.
    console.warn('Could not log play session', err);
  }
}

// Admin-only: one summary row per class (total plays + post-merge unique
// players) for the all-classes stats grid (GET /api/admin/stats/classes).
export async function fetchAdminClassStats(teacherCode) {
  try {
    const res = await fetchWithTimeout(
      withQuery('/api/admin/stats/classes', { teacherCode })
    );
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/admin/stats/classes —`, err);
    throw err;
  }
}

// Admin-only: detailed stats for one class (same shape as the teacher
// endpoint), used by the drill-down view.
export async function fetchAdminClassDetail(classId, teacherCode) {
  try {
    const res = await fetchWithTimeout(
      withQuery(`/api/admin/stats/classes/${encodeURIComponent(classId)}`, {
        teacherCode,
      })
    );
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(
      `[stats] Could not reach ${API_BASE}/api/admin/stats/classes/${classId} —`,
      err
    );
    throw err;
  }
}

// Overall totals + a per-game breakdown (see GET /api/stats on the server).
export async function fetchStats(teacherCode) {
  try {
    const res = await fetchWithTimeout(withQuery('/api/stats', { teacherCode }));
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/stats —`, err);
    throw err;
  }
}

// One row per player+game — times played, best/last score, best streak
// (see GET /api/summary on the server). The response shape follows who asks:
//  - teacher code → class-wide, server-paginated object
//    { rows, total, page, limit, hasMore } for the streaming teacher panel.
//  - classId + playerName → a single player's plain array (Home/student
//    progress view); the server returns that unpaginated since it's tiny.
// The extra list params (page/limit/sortKey/sortDir/game/q) are only sent by
// the teacher panel; withQuery drops any that are null/empty.
export async function fetchSummary({
  classId,
  playerName,
  teacherCode,
  page,
  limit,
  sortKey,
  sortDir,
  game,
  q,
}) {
  try {
    const res = await fetchWithTimeout(
      withQuery('/api/summary', {
        classId,
        playerName,
        teacherCode,
        page,
        limit,
        sortKey,
        sortDir,
        game,
        q,
      })
    );
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/summary —`, err);
    throw err;
  }
}

// One page of individual play sessions, uncollapsed — the "show all plays"
// view streams pages as the teacher scrolls (see GET /api/plays on the
// server). Returns { rows, total, page, limit, hasMore }.
export async function fetchPlaysPage({ teacherCode, page, limit, sortKey, sortDir, game, q }) {
  try {
    const res = await fetchWithTimeout(
      withQuery('/api/plays', {
        teacherCode,
        page,
        limit,
        sortKey,
        sortDir,
        game,
        q,
      })
    );
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/plays —`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Weekly leaderboard — one trophy per completed play since the most recent
// Friday noon (same Friday→Friday window as NextGameTimer). The client sends
// its local week start as `since` so the boundary matches the player's
// timezone; the server aggregates and sorts. Returns
// [{ playerName, trophies }] or [] on any failure (leaderboard should never
// block the rest of the home page).
// ---------------------------------------------------------------------------

function getWeekStart() {
  const now = new Date();
  const daysSinceFriday = (now.getDay() + 2) % 7; // Fri→0, Sat→1 … Thu→6
  const lastFriday = new Date(now);
  lastFriday.setDate(now.getDate() - daysSinceFriday);
  lastFriday.setHours(12, 0, 0, 0);
  if (lastFriday.getTime() > now.getTime()) {
    lastFriday.setDate(lastFriday.getDate() - 7);
  }
  return lastFriday;
}

export async function fetchLeaderboard(classId) {
  try {
    const res = await fetchWithTimeout(
      withQuery('/api/leaderboard', {
        classId,
        since: getWeekStart().toISOString(),
      })
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Weekly mission + player home strip
// ---------------------------------------------------------------------------
// Drives the student's "trophies / days learning / play-4-games mission" UI
// and the teacher's mission-completers view. Both use the same Friday→Friday
// `since` (getWeekStart) so they stay in sync with the weekly champions.

// A single player's plays since the last Friday (GET /api/player/weekly).
// Returns null on failure so the home widgets can hide gracefully. Trophies,
// distinct games and distinct learning days are derived from `plays` by the
// caller so every badge reads from one source of truth.
export async function fetchPlayerWeekly(classId, playerName) {
  try {
    const res = await fetchWithTimeout(
      withQuery('/api/player/weekly', {
        classId,
        playerName,
        since: getWeekStart().toISOString(),
      })
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Teacher-only: everyone in the class who has played 4+ different games this
// week (GET /api/weekly-mission). Returns { target, completers } or null.
export async function fetchWeeklyMission(teacherCode) {
  try {
    const res = await fetchWithTimeout(
      withQuery('/api/weekly-mission', {
        teacherCode,
        since: getWeekStart().toISOString(),
      })
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deletePlayerGame(game, playerName, teacherCode) {
  const res = await fetch(`${API_BASE}/api/plays`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      game,
      playerName,
      teacherCode,
    }),
  });

  if (!res.ok) {
    throw new Error(`Server responded ${res.status} ${res.statusText}`);
  }

  return await res.json();
}