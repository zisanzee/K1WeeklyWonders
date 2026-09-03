import { usePlayerStore } from './playerStore';

// Copy this file into your React project, e.g. src/lib/logPlaySession.js
//
// Reads the server URL from Vite's env system:
//   .env.local        VITE_API_BASE_URL=http://localhost:4000
//   .env (deployed)   VITE_API_BASE_URL=https://your-server.onrender.com
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Same default class NameGate.jsx falls back to for players who never see
// a class picker. Anyone whose classId is missing — a very old cached
// session, a play logged before setPlayer/setTeacher ever ran, etc. — gets
// attributed here instead of the server rejecting the session outright.
const LEGACY_CLASS_ID = 'k12026-pny';

function withQuery(path, params) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== '')
  );
  return `${API_BASE}${path}?${query.toString()}`;
}

// Coarse, dependency-free device fingerprint — good enough to spot "this
// game lags on Android tablets" patterns, not meant to be precise. Runs
// client-side since the server never sees the browser directly.
function detectDevice() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';

  let os = 'Unknown OS';
  // Modern iPadOS Safari reports itself as "Macintosh" — the touch-points
  // check is the standard way to tell it apart from an actual Mac.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) os = 'iPadOS';
  else if (/iPhone|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/CriOS\//.test(ua)) browser = 'Chrome (iOS)';
  else if (/FxiOS\//.test(ua)) browser = 'Firefox (iOS)';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  let kind = 'desktop';
  if (os === 'iPadOS' || /Tablet/.test(ua) || (os === 'Android' && !/Mobile/.test(ua))) kind = 'tablet';
  else if (os === 'iOS' || /Mobile/.test(ua)) kind = 'mobile';

  return { kind, os, browser, userAgent: ua.slice(0, 300) };
}

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
    const classId = usePlayerStore.getState().classId || LEGACY_CLASS_ID;
    const res = await fetch(`${API_BASE}/api/plays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game,
        playerName,
        classId,
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

// Shared helper: fetch with a timeout so a hung request (Render cold-start,
// network partition) doesn't leave the stats panel spinning forever.
async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
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