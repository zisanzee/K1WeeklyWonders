import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { fetchStats, fetchSummary } from './logPlaySession';

const GAME_LABELS = {
  game1: '🧺 Week 1',
  game2: '🧸 Week 2',
  game3: '🐙 Week 3',
};

function gameLabel(key) {
  return GAME_LABELS[key] || key;
}

export default function StatsPanel({ onClose }) {
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState([]);

  const load = async () => {
    setStatus('loading');
    try {
      const [statsData, summaryData] = await Promise.all([fetchStats(), fetchSummary()]);
      setStats(statsData);
      setSummary(summaryData);
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-xl font-bold text-slate-800 sm:text-2xl">
            📊 Who's been playing?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ fontFamily: "'Nunito', sans-serif" }}>
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <span className="animate-bounce text-4xl">⏳</span>
              <p className="font-bold">Loading stats…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400">
              <span className="text-4xl">😕</span>
              <p className="font-bold">Couldn't reach the stats server.</p>
              <p className="max-w-xs text-xs">
                Make sure VITE_API_BASE_URL is set and your server is running/deployed.
              </p>
              <button
                onClick={load}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && stats && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Total plays" value={stats.totalPlays} />
                <StatCard label="Players" value={stats.uniquePlayers} />
                {stats.perGame.map((g) => (
                  <StatCard
                    key={g._id}
                    label={gameLabel(g._id)}
                    value={g.plays}
                    sub={`avg ${g.avgStars.toFixed(1)}★ · best 🔥${g.bestStreak}`}
                  />
                ))}
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Player</th>
                      <th className="px-4 py-2.5">Game</th>
                      <th className="px-4 py-2.5">Plays</th>
                      <th className="px-4 py-2.5">Best score</th>
                      <th className="px-4 py-2.5">Last score</th>
                      <th className="px-4 py-2.5">Best streak</th>
                      <th className="px-4 py-2.5">Last played</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center font-bold text-slate-400">
                          No plays logged yet — go play a game! 🎮
                        </td>
                      </tr>
                    ) : (
                      summary.map((row) => (
                        <tr key={`${row.playerName}-${row.game}`} className="border-t border-slate-100">
                          <td className="px-4 py-2.5 font-bold text-slate-700">{row.playerName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{gameLabel(row.game)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{row.playCount}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {row.bestStars}/{row.totalRounds}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {row.lastStars}/{row.totalRounds}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">🔥{row.bestStreak}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {new Date(row.lastPlayedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
      <p className="text-2xl font-bold text-slate-800">{value ?? 0}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-400">{sub}</p>}
    </div>
  );
}
