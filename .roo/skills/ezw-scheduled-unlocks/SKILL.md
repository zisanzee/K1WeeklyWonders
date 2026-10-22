---
name: ezw-scheduled-unlocks
description: Use when working on game unlock scheduling in EZ Wonders - GameAccess.unlockAt, resolveDueUnlocks, getGameAccessRows, pendingUnlockCache/invalidateUnlockCache, the schedule endpoint, ScheduleUnlockDialog, NextGameTimer, formatUnlockCountdown, or any lock/unlock/catalogue add-remove logic.
---

# Scheduled unlocks (lazy, no cron)

## Invariants
- `GameAccess.unlockAt` (Date, nullable) is the only field the feature added. A row with `unlockAt` set is **always `unlocked: false`**; the schedule is a promise to flip later, not a parallel state.
- Unlock-early clears `unlockAt`. Removing or re-adding a game also clears it.
- Due unlocks are applied **lazily on read** by `resolveDueUnlocks(classId)` at the top of `getGameAccessRows()`. There is **no cron**, so a schedule still fires after the server slept through the exact minute (Render cold starts).
- **Every read path returning game rows MUST call `getGameAccessRows()`.** Never query `GameAccess` directly for reads.
- Due filter must be `{ $ne: null, $lte: now }`; a bare `$lte` matches every unscheduled row because null sorts below dates.

## Cache
Module-scope `pendingUnlockCache` records the soonest pending unlock per class so the sweep can be skipped when it is comfortably in the future (re-checked at least every 30 s). It only *skips work*, never serves truth; Mongo is re-read each request.
**Any write that can change `unlockAt` MUST call `invalidateUnlockCache(classId)`**: schedule, lock/unlock, catalogue add/remove (and any new write you add).

## Endpoint
`PUT /api/game-access/:gameKey/schedule` (guarded by `requireClassAccess`):
- past time -> 400; already unlocked -> 409.
- `unlockAt: null` **cancels** (clears the field, game stays locked; 404 if nothing was scheduled). A cancel is deliberately not a past time; "unlock it now" is a different, destructive intent via `PUT /api/game-access/:gameKey`.
- Declared above `/:gameKey` (route order).

## Frontend
- `NextGameTimer.jsx` is schedule-driven, not calendar-driven. It renders **nothing** with no pending schedule; callers gate on `useNextScheduledGame()` so layout collapses. Weekly Champions always shows. Admin has no class, so it self-hides. At zero it calls `fetchGameAccess()` to let the server apply the unlock.
- Panel: clock button (hidden once unlocked) opens `ScheduleUnlockDialog`; scheduled rows show an "Unlocks ..." badge; a separate cancel button clears the schedule while leaving the game locked. Scheduling writes through immediately (own confirm) so it can't discard unsaved reorder/lock drafts.
- `GameAccessGate` uses `formatUnlockCountdown()` for a coarse "Ready in 2d 4h".
- Pure helpers (`mergeRows`, `nextScheduledGame`, `formatUnlockCountdown`) should stay pure and Vitest-tested; add a test when you change them.
- Do not reintroduce a hardcoded "new game every Friday" cadence.
