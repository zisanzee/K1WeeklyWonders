// Copy this file into your React project, e.g. src/lib/logPlaySession.js
//
// Reads the server URL from Vite's env system:
//   .env.local        VITE_API_BASE_URL=http://localhost:4000
//   .env (deployed)   VITE_API_BASE_URL=https://your-server.onrender.com
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export async function logPlaySession({ game, playerName = 'Guest', stars, totalRounds, peakStreak = 0 }) {
  try {
    await fetch(`${API_BASE}/api/plays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, playerName, stars, totalRounds, peakStreak }),
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