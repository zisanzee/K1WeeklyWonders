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
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

// One-decimal formatting that never prints "NaN" if a field is missing.
function fmt1(n) {
  return Number.isFinite(n) ? n.toFixed(1) : '—';
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// Honour the OS "reduce motion" setting for the chart's draw-in animation.
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// ---------------------------------------------------------------------------
// Derived headline figures. Pure, cheap, and computed once per payload.
//
// - `delta`: this week vs the previous week. The current week is partial (it runs
//   Friday noon → now), so the label says "vs last week" rather than implying a
//   like-for-like comparison.
// - `activeStreak`: consecutive weeks with at least one play, counted backwards.
//   If the current week is still empty we start from last week, so a teacher
//   checking on a Friday afternoon doesn't see the streak reset to zero just
//   because the week has barely begun.
// ---------------------------------------------------------------------------
function deriveHighlights(weeks) {
  if (!weeks?.length) return { delta: null, activeStreak: 0, activeWeeks: 0 };

  const found = weeks.findIndex((w) => w.current);
  const currentIdx = found === -1 ? weeks.length - 1 : found;
  const current = weeks[currentIdx];
  const previous = currentIdx > 0 ? weeks[currentIdx - 1] : null;

  let i = current.plays > 0 ? currentIdx : currentIdx - 1;
  let activeStreak = 0;
  while (i >= 0 && weeks[i].plays > 0) {
    activeStreak += 1;
    i -= 1;
  }

  return {
    delta: previous ? current.plays - previous.plays : null,
    activeStreak,
    activeWeeks: weeks.filter((w) => w.plays > 0).length,
  };
}

// ---------------------------------------------------------------------------
// Trend chart — recharts line (with a soft fill) over the last 8 weeks.
//
// Accessibility: the SVG itself is decorative to assistive tech; the wrapper is
// one `role="img"` with a summary label, and the same numbers are ALSO in the
// week-by-week table beneath it, so nothing is chart-only.
//
// Two metrics share one chart (toggle): plays, and distinct games. Both are
// small integers, so the Y axis never shows decimals.
// ---------------------------------------------------------------------------
const METRICS = {
  plays: { label: 'Plays', noun: 'play' },
  games: { label: 'Different games', noun: 'game' },
};

// Dots: small and violet normally; the current week gets a larger pink dot with
// a halo so it reads as "now" without needing a legend.
function WeekDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  if (payload?.current) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill="#f472b6" opacity={0.25} />
        <circle cx={cx} cy={cy} r={5} fill="#f472b6" stroke="#fff" strokeWidth={2} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3.5} fill="#c4b5fd" stroke="#4338ca" strokeWidth={1.5} />;
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload;
  return (
    <div className="aura-card rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-black aura-text">
        {formatWeekRange(week.start, week.end)}
        {week.current && (
          <span className="ml-1.5 rounded-full bg-pink-500/25 px-1.5 py-0.5 text-[9px] font-black text-pink-100">
            this week
          </span>
        )}
      </p>
      <p className="mt-1 font-bold aura-soft">{plural(week.plays, 'play')}</p>
      <p className="font-semibold aura-muted">{plural(week.games, 'different game')}</p>
    </div>
  );
}

function TrendChart({ weeks, metric }) {
  const data = useMemo(
    () =>
      weeks.map((w) => ({
        label: formatDate(w.start),
        start: w.start,
        end: w.end,
        plays: w.plays,
        games: w.games,
        current: Boolean(w.current),
      })),
    [weeks]
  );
  // Inline arrow, not `useMemo(prefersReducedMotion, [])`: the lint rule
  // (react-hooks/inline-useMemo-callback) requires an inline function, because a
  // bare identifier can shadow or be swapped without the dependency list
  // noticing.
  const reduceMotion = useMemo(() => prefersReducedMotion(), []);
  const total = data.reduce((sum, w) => sum + w[metric], 0);
  const noun = METRICS[metric].noun;

  return (
    <div
      role="img"
      aria-label={`${METRICS[metric].label} per week over the last ${weeks.length} weeks. ${plural(total, noun)} in total. Detailed figures are listed below the chart.`}
      className="h-52 w-full sm:h-60"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
          <defs>
            {/* Stroke runs violet → pink left to right: older → newer. */}
            <linearGradient id="sd-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
            <linearGradient id="sd-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#aab6e2', fontSize: 10, fontWeight: 700 }}
            interval={0}
            dy={6}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={42}
            domain={[0, (max) => Math.max(3, max)]}
            tick={{ fill: '#aab6e2', fontSize: 10, fontWeight: 700 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.35)', strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="url(#sd-stroke)"
            strokeWidth={3}
            fill="url(#sd-fill)"
            dot={<WeekDot />}
            activeDot={{ r: 6, fill: '#fff', stroke: '#a78bfa', strokeWidth: 2 }}
            isAnimationActive={!reduceMotion}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Segmented control. Real buttons with aria-pressed, so it works by keyboard and
// reads correctly in a screen reader.
function MetricToggle({ metric, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-white/10 p-0.5" role="group" aria-label="Chart metric">
      {Object.entries(METRICS).map(([key, { label }]) => {
        const on = metric === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(key)}
            className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
              on ? 'bg-white/90 text-violet-900 shadow' : 'aura-soft hover:text-white'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, sub, delta }) {
  return (
    <div className="aura-card rounded-2xl px-3 py-3.5 text-center">
      <p className="text-base leading-none" aria-hidden="true">{icon}</p>
      <p className="mt-1.5 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
        {value ?? 0}
      </p>
      <p className="mt-0.5 text-xs font-bold aura-soft">{label}</p>
      {delta != null && delta !== 0 && (
        <p
          className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-black ${
            delta > 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'
          }`}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs last week
        </p>
      )}
      {sub && <p className="text-[10px] font-semibold aura-muted">{sub}</p>}
    </div>
  );
}

// A tiny labelled value used inside ranked rows.
function Pill({ children, tone = 'plain' }) {
  const tones = {
    plain: 'bg-white/10 aura-soft',
    good: 'bg-emerald-400/15 text-emerald-100',
    warn: 'bg-rose-400/15 text-rose-100',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tones[tone]}`}>
      {children}
    </span>
  );
}

// One ranked game row. `rank` is 1-based; the pills say WHY this game is in the
// list, so the teacher is never guessing.
function GameRankRow({ rank, game, tone }) {
  const info = gameInfo(game.game);
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
      <span className="w-5 shrink-0 text-center text-xs font-black aura-muted">{rank}</span>
      <GameIcon game={info} size="1.5rem" emojiClassName="text-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold aura-text">{info.label}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <Pill tone={tone}>{fmt1(game.avgMistakes)} wrong / play</Pill>
          {/* A zero-streak game is judged on mistakes alone, so say so rather
              than printing "streak 0.0", which would look like a bug. */}
          <Pill>{game.avgStreak > 0 ? `streak ${fmt1(game.avgStreak)}` : 'no streak yet'}</Pill>
        </span>
      </span>
      <span className="shrink-0 text-[10px] font-black aura-muted">{plural(game.plays, 'play')}</span>
    </li>
  );
}

function SectionTitle({ children, className = 'aura-text', hint }) {
  return (
    <div className="mb-2">
      <h2 className={`text-sm font-black ${className}`}>{children}</h2>
      {hint && <p className="text-[11px] font-semibold aura-muted">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
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
      if (err?.status === 403) setError('You can only view students in your own class.');
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
    <Shell name={displayName} lastPlayedAt={status === 'ready' ? data?.total?.lastPlayedAt : null}>
      <Helmet>
        {/* Per-child data: explicitly not for crawlers. */}
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 aura-muted" role="status">
          <span className="animate-bounce text-4xl">⏳</span>
          <p className="font-bold">Loading {displayName}&apos;s progress…</p>
        </div>
      )}

      {status === 'error' && (
        <ErrorBox title="Could not load this student" body={error} onRetry={load} />
      )}

      {status === 'ready' && data && <DetailBody data={data} name={displayName} />}
    </Shell>
  );
}

// Page chrome: the aurora backdrop, a back link to the panel's Students tab, and
// the child's name as the heading, with an initial avatar for quick scanning.
function Shell({ name, lastPlayedAt, children }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
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

        <header className="aura-panel mb-4 flex items-center gap-4 rounded-3xl px-4 py-4 sm:px-5">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-pink-400 text-2xl font-black text-white shadow-lg sm:h-16 sm:w-16 sm:text-3xl"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wide aura-muted">
              Student progress
            </p>
            <h1
              className="truncate aura-heading text-2xl font-bold sm:text-3xl"
              style={{ fontFamily: "'Fredoka', sans-serif" }}
            >
              {name || 'Student'}
            </h1>
            {lastPlayedAt && (
              <p className="text-[11px] font-semibold aura-soft">
                Last played {formatDate(lastPlayedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

function ErrorBox({ title, body, onRetry }) {
  return (
    <div className="aura-card flex flex-col items-center gap-3 rounded-2xl px-5 py-10 text-center" role="alert">
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
  const [metric, setMetric] = useState('plays');

  // Ranking is pure and unit-tested — see @/games/studentRankings.
  const favourite = useMemo(() => favouriteGame(perGame), [perGame]);
  const strongest = useMemo(() => strongestGames(perGame), [perGame]);
  const hardest = useMemo(() => hardestGames(perGame), [perGame]);
  const highlights = useMemo(() => deriveHighlights(weeks), [weeks]);

  // Most-played first; ties broken by key so the order is stable between renders.
  const sortedGames = useMemo(
    () =>
      [...perGame].sort(
        (a, b) => b.plays - a.plays || String(a.game).localeCompare(String(b.game))
      ),
    [perGame]
  );
  const maxPlays = sortedGames[0]?.plays || 1;
  const firstName = name.split(' ')[0];

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
        <StatCard icon="🎯" label="Total plays" value={total.plays} />
        <StatCard icon="🧩" label="Games played" value={total.games} sub="all time" />
        <StatCard
          icon="📅"
          label="Plays this week"
          value={thisWeek.plays}
          delta={highlights.delta}
        />
        <StatCard
          icon="🔥"
          label="Week streak"
          value={highlights.activeStreak}
          sub={`${highlights.activeWeeks} of ${weeks.length} weeks active`}
        />
      </section>

      {/* 8-week history */}
      <section aria-label="Activity over the last 8 weeks" className="aura-card rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black aura-text">Last {weeks.length} weeks</h2>
            <p className="text-[11px] font-semibold aura-muted">
              {plural(thisWeek.games, 'different game')} this week
            </p>
          </div>
          <MetricToggle metric={metric} onChange={setMetric} />
        </div>

        <TrendChart weeks={weeks} metric={metric} />

        {/* The same numbers as text, so the chart is never the only way to read
            the data. Collapsed by default to keep the page short. */}
        <details className="mt-3">
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
      <section
        aria-label="Favourite game"
        className="aura-card relative overflow-hidden rounded-2xl p-4"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-pink-400/20 blur-2xl"
        />
        <SectionTitle>⭐ Favourite game</SectionTitle>
        {favourite ? (
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <GameIcon game={gameInfo(favourite.game)} size="2.25rem" emojiClassName="text-3xl" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black aura-text">
                {gameInfo(favourite.game).label}
              </p>
              <p className="mt-1 flex flex-wrap gap-1">
                <Pill>Played {plural(favourite.plays, 'time')}</Pill>
                {favourite.avgStreak > 0 && <Pill tone="good">best streak {favourite.bestStreak}</Pill>}
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
          <SectionTitle
            className="text-emerald-200"
            hint="Fewest mistakes and longest streaks"
          >
            💪 Strongest games
          </SectionTitle>
          {strongest.length > 0 ? (
            <ol className="space-y-2">
              {strongest.map((g, i) => (
                <GameRankRow key={g.game} rank={i + 1} game={g} tone="good" />
              ))}
            </ol>
          ) : (
            <p className="text-sm font-semibold aura-muted">No games to rank yet.</p>
          )}
        </section>

        {/* Hardest */}
        <section aria-label="Hardest games" className="aura-card rounded-2xl p-4">
          <SectionTitle
            className="text-rose-200"
            hint="Most mistakes and shortest streaks"
          >
            🧩 Hardest games
          </SectionTitle>
          {hardest.length > 0 ? (
            <ol className="space-y-2">
              {hardest.map((g, i) => (
                <GameRankRow key={g.game} rank={i + 1} game={g} tone="warn" />
              ))}
            </ol>
          ) : (
            // Genuine outcome, not an error: the rule excludes games with no
            // streak, so a child who never built one has nothing to rank here.
            <p className="text-sm font-semibold aura-muted">
              No games to rank yet — this list only counts games where {firstName} has
              built a streak.
            </p>
          )}
        </section>
      </div>

      {/* Everything played, so the page is complete rather than only highlights. */}
      <section aria-label="All games played" className="aura-card rounded-2xl p-4">
        <SectionTitle>All games played</SectionTitle>
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
              {sortedGames.map((g) => (
                <tr key={g.game} className="aura-table-row">
                  <th scope="row" className="px-3 py-2 text-left font-bold aura-text">
                    {gameLabel(g.game)}
                    {/* Share of this child's most-played game: a quick visual of
                        where their time goes, without a second chart. */}
                    <span
                      aria-hidden="true"
                      className="mt-1 block h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-white/10"
                    >
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-violet-400 to-pink-400"
                        style={{ width: `${Math.max(6, Math.round((g.plays / maxPlays) * 100))}%` }}
                      />
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right aura-soft">{g.plays}</td>
                  <td className="px-3 py-2 text-right aura-soft">{fmt1(g.avgMistakes)}</td>
                  <td className="px-3 py-2 text-right aura-soft">
                    {g.avgStreak > 0 ? fmt1(g.avgStreak) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right aura-muted">{formatDate(g.lastPlayedAt)}</td>
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