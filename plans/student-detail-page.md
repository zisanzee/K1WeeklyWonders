# Student detail page — implementation plan

A per-student data page reached from the teacher panel's **Students** tab, showing
one child's own numbers. This document is the spec; the code follows it.

---

## 1. The identity problem (solve this first)

A "student" in this app is one of **three different shapes**, and the same display
name can legitimately belong to several of them — including across classes.

| Shape | Has `studentId`? | Has `code`? | Lives in |
| --- | --- | --- | --- |
| Rostered student | yes (UUID) | maybe | `Student` + `PlaySession` |
| "Light" public-class player | **no** | no | `PlaySession.playerName` only |
| Merged-away identity | yes, but `mergedInto` set | — | `Student` (kept, reversible) |

Consequences that drive the whole design:

- **A name is NOT a key.** Two classes can each have "Aarav", and one class can
  have two roster rows both called "Aarav" (different `studentId`s, possibly one
  with a code and one without). Resolving by name alone would merge strangers.
- **`studentId` is the only unambiguous key** for a rostered child.
- **Light identities have no `studentId`**, so they can only be addressed by
  name — and that name is only unique *within a class*.
- **Merges** fold several names into one primary; the detail page must show the
  combined history for the primary, exactly like the stats panel does.

### Route key

One route, self-describing key, so there is never a "which kind is this?" guess:

```
/game-access/student/:classId/:studentKey
```

`:studentKey` is a **prefixed** key:

| Prefix | Meaning | Example |
| --- | --- | --- |
| `s_` | rostered student, value = `studentId` | `s_9f2c…` |
| `n_` | light identity, value = `encodeURIComponent(name)` | `n_Aarav%20K` |

Why a prefix rather than two route shapes: a bare `studentId` and a bare name are
both arbitrary strings, so a single-param route could not tell them apart without
a DB lookup first, and a name that happened to look like a UUID would be
ambiguous. The prefix makes the parse total and the server can reject anything
else with a 400 before touching Mongo.

`classId` is **always** in the path. That is what makes the same name in another
class a different page, and it is what the access guard needs.

---

## 2. Security model

The requirement is strict: **only a teacher of that student's class** may see the
page. This is enforced in three independent places, because the URL is
guessable.

### 2.1 Server (the only real boundary)

```
GET /api/classes/:classId/students/:studentKey/stats
```

1. `requireClassAccess(req, res, classId)` — admin passes for any class, a
   teacher only for `actor.classId === classId`. **403 otherwise.**
2. Parse `:studentKey`. Unknown prefix → **400**.
3. `s_` → `Student.findOne({ studentId, classId, deletedAt: null })`. The
   `classId` in the filter is what stops a teacher of class A reading class B's
   student by pasting a UUID. No match → **404** (not 403: do not confirm that
   the id exists elsewhere).
4. `n_` → resolve the name within `classId` only. Reject `Guest` and empty.
5. Respond `{ error }` with a non-2xx on every failure, per house rules.

The endpoint is **read-only** and **not rate-limited** (it is an authenticated
staff read; the school-NAT rule forbids limiting those).

### 2.2 Frontend route guard

The page is wrapped so an unauthenticated visitor never reaches the fetch:

```
NameGate → TeacherClassGate → ErrorBoundary → StudentDetail
```

`TeacherClassGate` (new, small): requires `isTeacher`, and for a non-admin
requires `playerStore.classId === :classId`. Otherwise redirects to `/`. This is
UI convenience only — §2.1 is the boundary, and `isTeacher` is zustand UI state
that must never be trusted on its own.

### 2.3 Not indexable

Do **not** add the route to `INDEXABLE_ROUTES` in `src/seo/seo.jsx`, and do not
add it to `public/sitemap.xml`. It stays `noindex` by default, which is correct
for per-child data.

---

## 3. Data the page shows

All of it is derived from `PlaySession` rows for the resolved identity, filtered
`{ classId, deletedAt: null }` and, for a rostered student, `studentId` **or**
their merged names.

| Metric | Definition |
| --- | --- |
| Total plays | count of all sessions |
| Games played | distinct `game` values, all time |
| Plays this week | count since the current Friday-noon boundary |
| Games this week | distinct `game` values since that boundary |
| Last 8 weeks | play count per week, 8 buckets, current week last |

### Week boundaries

Weeks are Friday **12:00** → next Friday 12:00, matching
`weekStartFridayNoon()` on the server and `NextGameTimer` on the client. The
client computes *its own* local current-week start and sends it as `weekStart`,
so a child in a different timezone sees their local weeks rather than the
server's. The server derives the other 7 boundaries by subtracting 7 days each
and `$bucket`s `completedAt` against them. Weeks with zero plays are still
returned as 0 so the chart has a continuous x-axis.

---

## 4. Ranking rules (strongest / hardest / favourite)

Per game, for this student, from an aggregate of their plays:

- `plays` — how many times
- `avgMistakes` — wrong answers per play (lower is better)
- `avgStreak` — mean `peakStreak` per play (higher is better)

### Favourite game

Highest `plays`. Ties broken by better strongest-score, then by game key, so the
result is deterministic rather than dependent on aggregation order.

### Strongest — top 3

As specified:

> least mistakes and most streaks. **If the streak count is 0 for a game, that
> data is ignored and the game is judged solely on mistakes.**

So a game with `avgStreak === 0` is **still eligible**, but its streak component
does not contribute — it is scored on mistakes alone.

### Hardest — top 3

> most mistakes and least streaks. **0 streak games are to be ignored.**

Note the deliberate asymmetry: here a `avgStreak === 0` game is **excluded from
the ranking entirely.**

> ⚠️ **Flagged for confirmation.** This means the genuinely struggling case — a
> game the child never built a streak in — cannot appear in "hardest". If the
> intent was "don't *reward* streak", not "exclude the game", the rule should be
> the mirror of Strongest instead. Implemented exactly as written; changing it is
> a one-line predicate.

### Score formula

Raw mistakes and streak are on incomparable scales, so both are min-max
normalised **across this student's own games** (not across the class — the scale
is per-child, which is what makes a young child's numbers meaningful):

```
norm(v, min, max) = max === min ? 0.5 : (v - min) / (max - min)

mistakeScore = 1 - norm(avgMistakes, minM, maxM)   // fewer mistakes ⇒ higher
streakScore  =     norm(avgStreak,   minS, maxS)   // more streak   ⇒ higher

strongest = avgStreak === 0 ? mistakeScore
                            : 0.5 * mistakeScore + 0.5 * streakScore

hardest   = 0.5 * (1 - mistakeScore) + 0.5 * (1 - streakScore)
            // only for games with avgStreak > 0
```

`norm` returns `0.5` when every game shares a value, so a student whose games are
all equally clean ranks them evenly rather than dividing by zero.

---

## 5. Backend work (`D:\K1 games project\server` — separate folder)

| # | Change | Why |
| --- | --- | --- |
| B1 | `GET /api/classes/:classId/students/:studentKey/stats` | the endpoint |
| B2 | Helper `resolveStudentIdentity(classId, studentKey)` | one place that turns a key into `{ name, studentId, names[] }`, incl. merge folding |
| B3 | Aggregate: totals, this-week, per-game, 8-week buckets in **one** `$facet` | one round-trip instead of four |

No model change, no index change, no migration. The existing
`{ classId, playerName, game }` and `{ classId, completedAt }` indexes already
cover these queries.

**A server redeploy IS required** before the page works in production.

---

## 6. Frontend work

| # | File | Change |
| --- | --- | --- |
| F1 | `src/api/studentStats.js` | `fetchStudentStats(classId, studentKey, teacherCode, weekStart)` via `requestJson` from `apiClient` |
| F2 | `src/games/studentKey.js` | `makeStudentKey({studentId,name})` / `parseStudentKey(key)` — pure, unit-tested |
| F3 | `src/pages/StudentDetail.jsx` | the page |
| F4 | `src/pages/TeacherClassGate.jsx` | route guard |
| F5 | `src/app/main.jsx` | one `<Route>` |
| F6 | `src/pages/GameAccessPanel.jsx` | a **Details** button per identity row |
| F7 | `src/games/studentKey.test.js` | tests for the prefix round-trip |

Chart: hand-rolled SVG bars — no new dependency, no canvas, works on the
low-end tablets this app targets.

---

## 7. Build order

1. `studentKey.js` + its test (pure, no dependencies).
2. Backend endpoint + redeploy note.
3. `studentStats.js` API helper.
4. `TeacherClassGate` + route.
5. `StudentDetail` page: header → headline cards → 8-week chart → favourite →
   strongest/hardest lists.
6. Details button in `StudentsTab`.
7. `npm run lint` + `npm run build`.

## 8. Explicitly out of scope

- No editing or deleting from the detail page (that stays in Students).
- No comparison against class averages.
- No export/print.
- No caching of per-child data in localStorage.
