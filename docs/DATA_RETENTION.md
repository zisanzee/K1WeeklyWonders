# Data Retention Policy — TEMPLATE

> **This is a template / recommendation, not legal advice.** It describes what
> the application stores today and suggests a policy the operator should adopt.
> The operator is responsible for choosing and ratifying the actual retention
> window, and for confirming it against the laws that apply to their users.

## Why this document exists

This application stores the **names of minors**. A parent, school, or regulator
can reasonably ask how long that data is kept and how it is removed. This
document records what is stored, and states a concrete recommended policy so the
operator can adopt it rather than improvising under pressure.

## What personal data is stored, by entity

All entities live in MongoDB behind the Express API. None of the records are
deleted by the frontend.

### `Student`

| Field       | Notes                                                        |
| ----------- | ------------------------------------------------------------ |
| `studentId` | Server-generated UUID (not a Mongo `_id`).                  |
| `classId`   | Scopes the record to one class.                             |
| `fullName`  | **Personal data — the child's real name.**                   |
| `nickname`  | Free-text display name; may also identify the child.        |
| `group`     | Freeform classroom label; no behavioural meaning.           |
| `code`      | 6-char unique login code — **a bearer credential.**          |

Merge bookkeeping: `mergedInto`, `mergedAt`, `mergedBy`.

### `PlaySession`

One row per completed round: `playerName` (**personal data**), `studentId`,
`classId`, `game`, `stars`, `totalRounds`, `peakStreak`, optional
`elapsedSeconds` / `mistakes`, and `device` (a fingerprint object). Play history
for a name-only ("light") identity is the only thing that makes that identity
exist at all.

### `PlayerMerge`

Merge/link records binding a name-only identity to a rostered `studentId` after
the fact.

### `ClassInfo`

`className`, `classAlias`, `classYear`, `classCode`, `isPublic`, `active`,
`image`. `active` is a **soft-retire flag — a class is never hard-deleted**, so
that historical stats rows still resolve.

## The deliberate "never delete" behaviours (do not "fix" these)

- **Merged-away `Student` records are never deleted.** A merge records
  `mergedInto` and keeps the original row, so a merge stays **reversible**.
- **`ClassInfo.active` soft-retires rather than deletes**, so old play/stats
  rows still resolve to a class.
- **`Teacher.active` soft-deactivates**, for the same reason.

These exist so that history is not silently destroyed. They also mean retention
is a *policy decision*, not something deletion does automatically.

## Recommended retention (K-12 context)

The following is a starting recommendation, **not** a default the code enforces:

1. **End of academic year** — purge or anonymise `Student` records
   (`fullName`, `nickname`) that belong to a class whose `classYear` has passed,
   and anonymise `PlaySession.playerName` for the same class. Anonymise rather
   than delete where the row is needed for aggregate stats (replace the name with
   a stable pseudonym or blank it).
2. **On class retirement** — when a class is soft-retired (`active: false`), the
   operator should decide a purge date for its personal data. Retiring is not
   deleting; it must be followed by an explicit purge.
3. **Light identities** — a name-only identity with no remaining play sessions
   should not persist. Deleting its sessions removes it (see below).
4. **Merge history** — retain only as long as the merge needs to remain
   reversible; it contains identifiers, not raw names, but still links to them.
5. **Never retain beyond need** — the shortest window that satisfies the
   classroom use case is the right one.

**The operator must choose the actual window** (e.g. "purge one academic year
after the class year ends") and write it here once decided. Leaving it
unstated is itself a compliance risk.

## How a deletion request is fulfilled

A parent/teacher request to remove a child's data is served by the existing
endpoints — no new code is required:

- **Remove a rostered student** —
  `DELETE /api/students/:studentId` (or
  `DELETE /api/classes/:classId/students/:studentId`). Removes the roster
  record. Decide separately whether that student's `PlaySession` rows should be
  purged or anonymised (retention window above).
- **Remove a name-only ("light") identity** —
  `DELETE /api/classes/:classId/identities/:name`. This identity exists only
  because of its play sessions, so this endpoint removes those sessions. It
  409s if the name still matches a rostered student — in that case delete the
  student instead.
- **Remove specific play history** — `DELETE /api/plays` deletes one player's
  records for one game.
- **Reverse a merge** — `POST /api/classes/:classId/students/unmerge` undoes a
  merge using the retained `PlayerMerge` / merge bookkeeping.

## Compliance context (which laws may apply)

- **COPPA (US)** — children under 13; collection of a child's name and play data
  requires parental consent and a stated retention limit.
- **GDPR-K (EU/UK)** — children's personal data is a special category in
  practice; requires a lawful basis, data minimisation, and a defined retention
  period.
- **PDPA (Singapore)** — personal data must not be kept longer than necessary and
  must be removable on request.

Which of these applies depends on where the operator's users are. This document
does not determine that; the operator must.

## Action for the operator

- [ ] Choose and record a concrete retention window in this file.
- [ ] Decide the purge/anonymisation procedure for retired classes.
- [ ] Confirm a process for handling deletion requests via the endpoints above.
- [ ] Confirm the legal context (COPPA / GDPR-K / PDPA) that applies.
- [ ] Re-read this template and confirm it matches reality before relying on it.
