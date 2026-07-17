// Copy this file into your React project, e.g. src/lib/logPlaySession.js
//
// Reads the server URL from Vite's env system:
//   .env.local        VITE_API_BASE_URL=http://localhost:4000
//   .env (deployed)   VITE_API_BASE_URL=https://your-server.onrender.com
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

export async function logPlaySession({ game, playerName = 'Guest', stars, totalRounds, peakStreak = 0 }) {
  try {
    await fetch(`${API_BASE}/api/plays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, playerName, stars, totalRounds, peakStreak, device: detectDevice() }),
    });
  } catch (err) {
    // A logging failure should never break the game itself.
    console.warn('Could not log play session', err);
  }
}

// Overall totals + a per-game breakdown (see GET /api/stats on the server).
export async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/stats —`, err);
    throw err;
  }
}

// One row per player+game — times played, best/last score, best streak
// (see GET /api/summary on the server).
export async function fetchSummary() {
  try {
    const res = await fetch(`${API_BASE}/api/summary`);
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/summary —`, err);
    throw err;
  }
}

// Every individual play session, uncollapsed and most recent first — used by
// the "show all plays" view (see GET /api/plays on the server).
export async function fetchAllPlays() {
  try {
    const res = await fetch(`${API_BASE}/api/plays`);
    if (!res.ok) throw new Error(`Server responded ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[stats] Could not reach ${API_BASE}/api/plays —`, err);
    throw err;
  }
}

export async function deletePlayerGame(game, playerName) {
  const res = await fetch(`${API_BASE}/api/plays`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      game,
      playerName,
    }),
  });

  if (!res.ok) {
    throw new Error(`Server responded ${res.status} ${res.statusText}`);
  }

  return await res.json();
}