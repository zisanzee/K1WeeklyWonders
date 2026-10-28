// StudentDetail.jsx
// One child's own data page, reached from the teacher panel's Students tab:
//
//   /game-access/student/:classId/:studentKey
//
// Everything on this page is derived from that child's play sessions. The page
// fetches nothing else, and caches nothing — per-child data must not sit in
// localStorage on a shared school tablet.
//
// The identity key is prefixed (see @/games/studentKey): 's_<studentId>' for a
// rostered child, 'n_<name>' for a "light" public-class child who has no roster
// record. Two classes can each hold a child with the same name; the classId is a
// separate path segment and the server filters on it, so they are genuinely
// different pages.
//
// ACCESS: TeacherClassGate wraps this route, and the server's requireClassAccess
// is the real boundary. This page additionally treats a 403 as "not yours" and a
// 404 as "no such child in this class", because those are different facts and
// collapsing them into one error message would be misleading.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { usePlayerStore } from '@/auth/playerStore';
import { fetchStudentStats } from '@/api/students';
import { GAME_CATALOG } from '@/games/registry';
import { parseStudentKey } from '@/games/studentKey';
import { favouriteGame, strongestGames, hardestGames } from '@/games/studentRankings';
import { GameIcon } from '@/ui/GameIcon';

// Compact "emoji name" labels, derived from the registry so a renamed game can't
// leave this page showing an old name. Same approach as StatsPanel.
const GAME_INFO = Object.fromEntries(
  GAME_CATALOG.map((game) => [game.progressKey, game])
);

function gameInfo(key) {
  return (
    GAME_INFO[key] || {
      key,
      emoji: '🎮',
      label: `Game ${String(key).match(/\d+/)?.[0] || key}`,
      title: '',
    }
  );
}

function gameLabel(key) {
  const info = gameInfo(key);
  return `${info.emoji} ${info.label}`;
}

// Local Friday-noon boundary, matching the server's weekStartFridayNoon() and the
// frontend's NextGameTimer. Computed HERE rather than server-side so the chart
// reflects the child's own timezone — a session played Friday morning in Dhaka
// must fall in the week Dhaka considers current.
function localWeekStart(now = new Date()) {
  const d = new Date(now);
  const daysSinceFriday = (d.getDay() + 2) % 7; // Fri→0, Sat→1 … Thu→6
  d.setDate(d.getDate() - daysSinceFriday);
  d.setHours(12, 0, 0, 0);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 7);
  return d;
}

function formatDate(iso, opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, opts);
}

// "12 Sep – 19 Sep"
function formatWeekRange(startISO, endISO) {
  return `${formatDate(startISO)} – ${formatDate(endISO)}`;
}

// ---------------------------------------------------------------------------
// 8-week bar chart — hand-rolled SVG.
//
// No chart library: this is one series of eight integers. A dependency would add
// hundreds of KB to a page a teacher opens on a school tablet, and canvas would
// need rescaling logic that SVG gets for free.
//
// Accessibility: the whole chart is one `role="img"` with a summary label, and
// each bar carries a <title> so a pointer user can hover for the exact number.
// The same data is ALSO in the table below it, so nothing is chart-only.
// ---------------------------------------------------------------------------
function WeeklyChart({ weeks }) {
  const peak = Math.max(1, ...weeks.map((w) => w.plays));
  const total = weeks.reduce((sum, w) => sum + w.plays, 0);
  // viewBox units; the SVG scales to its container.
  const H = 120;
  const barW = 26;
  const gap = 14;
  const W = weeks.length * barW + (weeks.length - 1) * gap;

  return (
    <figure className="mt-1">
      <svg
        viewBox={`0 0 ${W} ${H + 26}`}
        className="h-40 w-full"
        role="img"
        aria-label={`Plays per week over the last ${weeks.length} weeks. Total ${total} plays. Detailed figures are listed below the chart.`}
        preserveAspectRatio="none"
      >
        {weeks.map((week, i) => {
          const h = Math.round((week.plays / peak) * H);
          const x = i * (barW + gap);
          const y = H - h;
          return (
            <g key={week.start}>
              {/* Track, so an empty week still shows a slot on the axis. */}
              <rect
                x={x}
                y={0}
                width={barW}
                height={H}
                rx={barW / 3}
                fill="rgba(255,255,255,0.06)"
              />
              {week.plays > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={barW / 3}
                  fill={week.current ? 'url(#g16-cur)' : 'url(#g16-past)'}
                >
                  <title>
                    {formatWeekRange(week.start, week.end)}: {week.plays}{' '}
                    {week.plays === 1 ? 'play' : 'plays'}
                  </title>
                </rect>
              )}
              <text
                x={x + barW / 2}
                y={H + 16}
                textAnchor="middle"
                className="fill-current text-[9px]"
                style={{ fill: week.current ? '#f9a8d4' : 'rgba(199,210,254,0.75)' }}
              >
                {formatDate(week.start)}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="g16-past" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="g16-cur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
        </defs>
      </svg>
      <figcaption className="sr-only">
        Current week highlighted. Total across the period: {total}.
      </figcaption>
    </figure>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="aura-card rounded-2xl px-3 py-3.5 text-center">
      <p className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
        {value ?? 0}
      </p>
      <p className="mt-0.5 text-xs font-bold aura-soft">{label}</p>
      {sub && <p className="text-[10px] font-semibold aura-muted">{sub}</p>}
    </div>
  );
}

// One ranked game row. `rank` is 1-based; `metric` is the sentence that explains
// WHY this game is in the list, so the teacher is never guessing.
function GameRankRow({ rank, game, metric }) {
  const info = gameInfo(game.game);
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
      <span className="w-5 shrink-0 text-center text-xs font-black aura-muted">{rank}</span>
      <GameIcon game={info} size="1.5rem" emojiClassName="text-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold aura-text">{info.label}</span>
        <span className="block text-[11px] font-semibold aura-muted">{metric}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black aura-soft">
        {game.plays} {game.plays === 1 ? 'play' : 'plays'}
      </span>
    </li>
  );
}

export default function StudentDetail() {
  const { classId, studentKey } = useParams();
  const teacherCode = usePlayerStore((s) => s.teacherCode);

  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const parsed = useMemo(() => parseStudentKey(studentKey), [studentKey]);

  const load = useCallback(async () => {
    if (!classId || !teacherCode || !parsed) return;
    setStatus('loading');
    setError(null);
    try {
      // weekStart is the caller's LOCAL boundary — see localWeekStart().
      const payload = await fetchStudentStats(
        classId,
        studentKey,
        teacherCode,
        localWeekStart().toISOString()
      );
      setData(payload);
      setStatus('ready');
    } catch (err) {
      // Keep the two refusals distinguishable: they mean different things.
      if (err?.status === 403) setError("You can only view students in your own class.");
      else if (err?.status === 404) setError('That student was not found in this class.');
      else setError(err?.message || 'Could not load this student.');
      setStatus('error');
    }
  }, [classId, teacherCode, studentKey, parsed]);

  useEffect(() => {
    load();
  }, [load]);

  // A hand-edited URL fails here, before any request.
  if (!parsed) {
    return (
      <Shell>
        <ErrorBox
          title="That link is not valid"
          body="The student reference in this address could not be read. Open the student from the Students tab instead."
        />
      </Shell>
    );
  }

  const identity = data?.identity;
  const displayName = identity?.name || parsed.name || 'This student';

  return (
    <Shell name={displayName}>
      <Helmet>
        {/* Per-child data: explicitly not for crawlers. */}
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 aura-muted">
          <span className="animate-bounce text-4xl">⏳</span>
          <p className="font-bold">Loading {displayName}'s progress…</p>
        </div>
      )}

      {status === 'error' && (
        <ErrorBox title="Could not load this student" body={error} onRetry={load} />
      )}

      {status === 'ready' && data && <DetailBody data={data} name={displayName} classId={classId} />}
    </Shell>
  );
}

// Page chrome: the aurora backdrop, a back link to the panel's Students tab, and
// the child's name as the heading.
function Shell({ name, children }) {
  return (
    <div className="aura-page min-h-[100dvh] w-full">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            to="/game-access?tab=students"
            className="aura-ghost h-10 gap-1.5 px-3 text-xs font-black sm:text-sm"
          >
            <span aria-hidden="true">←</span> Students
          </Link>
        </div>

        <header className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-wide aura-muted">
            Student progress
          </p>
          <h1
            className="truncate aura-heading text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            {name || 'Student'}
          </h1>
        </header>

        {children}
      </div>
    </div>
  );
}

function ErrorBox({ title, body, onRetry }) {
  return (
    <div className="aura-card flex flex-col items-center gap-3 rounded-2xl px-5 py-10 text-center">
      <span className="text-4xl">😕</span>
      <p className="font-black aura-text">{title}</p>
      {body && <p className="max-w-sm text-sm font-semibold aura-soft">{body}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-full bg-violet-500/30 px-5 py-2.5 text-sm font-bold text-violet-100 active:scale-95 hover:bg-violet-500/45"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function DetailBody({ data, name }) {
  const { total, thisWeek, weeks, perGame } = data;

  // Ranking is pure and unit-tested — see @/games/studentRankings.
  const favourite = useMemo(() => favouriteGame(perGame), [perGame]);
  const strongest = useMemo(() => strongestGames(perGame), [perGame]);
  const hardest = useMemo(() => hardestGames(perGame), [perGame]);

  const hasPlays = (total?.plays ?? 0) > 0;

  if (!hasPlays) {
    return (
      <div className="aura-card rounded-2xl px-5 py-12 text-center">
        <span className="text-4xl">🎮</span>
        <p className="mt-2 font-black aura-text">No plays recorded yet</p>
        <p className="mt-1 text-sm font-semibold aura-soft">
          Once {name} plays a game, their progress will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline numbers. aria-label groups them for a screen reader rather
          than announcing four loose values. */}
      <section aria-label={`${name}'s totals`} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total plays" value={total.plays} />
        <StatCard label="Games played" value={total.games} sub="all time" />
        <StatCard label="Plays this week" value={thisWeek.plays} />
        <StatCard label="Games this week" value={thisWeek.games} />
      </section>

      {/* 8-week history */}
      <section aria-label="Plays per week, last 8 weeks" className="aura-card rounded-2xl p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-black aura-text">Last 8 weeks</h2>
          <p className="text-[11px] font-semibold aura-muted">
            {total.lastPlayedAt ? `Last played ${formatDate(total.lastPlayedAt)}` : ''}
          </p>
        </div>
        <WeeklyChart weeks={weeks} />

        {/* The same numbers as text, so the chart is never the only way to read
            the data. Collapsed by default to keep the page short. */}
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-bold aura-muted">
            Show week-by-week figures
          </summary>
          <table className="mt-2 w-full text-xs">
            <caption className="sr-only">Plays and distinct games for each of the last 8 weeks</caption>
            <thead className="aura-table-head">
              <tr>
                <th scope="col" className="px-2 py-1.5 text-left font-black">Week</th>
                <th scope="col" className="px-2 py-1.5 text-right font-black">Plays</th>
                <th scope="col" className="px-2 py-1.5 text-right font-black">Games</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.start} className="aura-table-row">
                  <th scope="row" className="px-2 py-1.5 text-left font-bold aura-soft">
                    {formatWeekRange(week.start, week.end)}
                    {week.current && (
                      <span className="ml-1.5 rounded-full bg-pink-500/25 px-1.5 py-0.5 text-[9px] font-black text-pink-100">
                        this week
                      </span>
                    )}
                  </th>
                  <td className="px-2 py-1.5 text-right aura-soft">{week.plays}</td>
                  <td className="px-2 py-1.5 text-right aura-muted">{week.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* Favourite */}
      <section aria-label="Favourite game" className="aura-card rounded-2xl p-4">
        <h2 className="mb-2 text-sm font-black aura-text">Favourite game</h2>
        {favourite ? (
          <div className="flex items-center gap-3">
            <GameIcon game={gameInfo(favourite.game)} size="2.25rem" emojiClassName="text-3xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black aura-text">
                {gameInfo(favourite.game).label}
              </p>
              <p className="text-[11px] font-semibold aura-muted">
                Played {favourite.plays} {favourite.plays === 1 ? 'time' : 'times'}
                {favourite.avgStreak > 0 ? ` · best streak ${favourite.bestStreak}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold aura-muted">Not enough plays to tell yet.</p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Strongest */}
        <section aria-label="Strongest games" className="aura-card rounded-2xl p-4">
          <h2 className="text-sm font-black text-emerald-200">💪 Strongest games</h2>
          <p className="mb-2 text-[11px] font-semibold aura-muted">
            Fewest mistakes and longest streaks
          </p>
          {strongest.length > 0 ? (
            <ol className="space-y-2">
              {strongest.map((g, i) => (
                <GameRankRow
                  key={g.game}
                  rank={i + 1}
                  game={g}
                  metric={
                    // A zero-streak game is judged on mistakes alone, so say so
                    // rather than printing "· 0 streak", which would look wrong.
                    g.avgStreak === 0
                      ? `${g.avgMistakes.toFixed(1)} wrong per play · no streak yet`
                      : `${g.avgMistakes.toFixed(1)} wrong per play · streak ${g.avgStreak.toFixed(1)}`
                  }
                />
              ))}
            </ol>
          ) : (
            <p className="text-sm font-semibold aura-muted">No games to rank yet.</p>
          )}
        </section>

        {/* Hardest */}
        <section aria-label="Hardest games" className="aura-card rounded-2xl p-4">
          <h2 className="text-sm font-black text-rose-200">🧩 Hardest games</h2>
          <p className="mb-2 text-[11px] font-semibold aura-muted">
            Most mistakes and shortest streaks
          </p>
          {hardest.length > 0 ? (
            <ol className="space-y-2">
              {hardest.map((g, i) => (
                <GameRankRow
                  key={g.game}
                  rank={i + 1}
                  game={g}
                  metric={`${g.avgMistakes.toFixed(1)} wrong per play · streak ${g.avgStreak.toFixed(1)}`}
                />
              ))}
            </ol>
          ) : (
            // Genuine outcome, not an error: the rule excludes games with no
            // streak, so a child who never built one has nothing to rank here.
            <p className="text-sm font-semibold aura-muted">
              No games to rank yet — this list only counts games where{' '}
              {name.split(' ')[0]} has built a streak.
            </p>
          )}
        </section>
      </div>

      {/* Everything played, so the page is complete rather than only highlights. */}
      <section aria-label="All games played" className="aura-card rounded-2xl p-4">
        <h2 className="mb-2 text-sm font-black aura-text">All games played</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Every game {name} has played, with plays and averages</caption>
            <thead className="aura-table-head text-[11px] font-bold uppercase tracking-wide">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">Game</th>
                <th scope="col" className="px-3 py-2 text-right">Plays</th>
                <th scope="col" className="px-3 py-2 text-right">Wrong / play</th>
                <th scope="col" className="px-3 py-2 text-right">Avg streak</th>
                <th scope="col" className="px-3 py-2 text-right">Last played</th>
              </tr>
            </thead>
            <tbody>
              {[...perGame]
                .sort((a, b) => b.plays - a.plays || String(a.game).localeCompare(String(b.game)))
                .map((g) => (
                  <tr key={g.game} className="aura-table-row">
                    <th scope="row" className="px-3 py-2 text-left font-bold aura-text">
                      {gameLabel(g.game)}
                    </th>
                    <td className="px-3 py-2 text-right aura-soft">{g.plays}</td>
                    <td className="px-3 py-2 text-right aura-soft">
                      {g.avgMistakes.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right aura-soft">
                      {g.avgStreak > 0 ? g.avgStreak.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right aura-muted">
                      {formatDate(g.lastPlayedAt)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// NOTE: the URL shape deliberately is NOT re-exported from here. A module that
// exports both a component and a plain function breaks Fast Refresh
// (react-refresh/only-export-components), and the panel imports the path helper
// straight from @/games/studentKey — the one place it is defined.
