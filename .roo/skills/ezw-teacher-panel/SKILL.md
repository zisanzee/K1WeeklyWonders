---
name: ezw-teacher-panel
description: Use when changing the teacher/admin control panel or stats in EZ Wonders - GameAccessPanel.jsx, GameAccessEditor, Catalogue, StudentsTab, merge/unmerge identities, StudentBadge QR Game Pass and PDF printing, StatsPanel, MissionHeroes, role-split tabs, light (name-only) identities.
---

# Teacher / admin panel

`GameAccessPanel.jsx` is a full-screen overlay; `GameAccessPage.jsx` maps `onClose` to `navigate('/')` and supports `?tab=`. Read the file before editing; it is large.

## Role-split tabs (keep them split)
- **Teacher**: Games, Catalogue, Students, Stats, Settings, all scoped to their own `classId`.
- **Admin**: Classes, Catalogue, Stats, Settings. Admin picks a class in Classes and manages its games inline. Admin `classId` is null.
- Header has a "Teacher guide" button -> `/teacher-onboarding`.

## Games editor
Draft-snapshot pattern: fetch with `fetchGameAccessForClass` into `draftGames`; "Confirm changes" batches **only the deltas** (order -> `setGameOrderForClass`, then unlock/shiny per change); Reset restores the last-saved snapshot. Reorder uses `@dnd-kit` sortable (pointer + keyboard); bonus games labelled "BONUS". `@dnd-kit` is used only here. Scheduling rules: skill `ezw-scheduled-unlocks`.

## Catalogue
Searchable list of `GAME_CATALOG` (matches title, subtitle, description). `addGameForClass` / `removeGameForClass`, then re-fetch.

## Students and identities
- Use the class-scoped helpers in `@/api/students.js` (`fetchClassIdentities`, `addStudentToClass`, `updateStudentInClass`, `deleteStudentInClass`, `deleteIdentityInClass`, `mergeIdentities`, `unmergeIdentity`, `generateStudentCode`). Do not use the legacy `/api/students` helpers for new work.
- Rostered students are editable; name-only "light" identities (kids who joined a public class by name) are selectable and deletable but **not editable**.
- Deleting a light identity removes their play sessions (the only thing that makes them exist); the server returns 409 if the name matches a roster student (delete the student instead).
- Merges are reversible: merged-away rows are never deleted. Authoritative merge record is `PlayerMerge` (name-based); `Student.mergedInto` is also written when a merged name maps to a roster student. For unmerge of a light identity pass the literal `name` as `:studentId`.
- Destructive actions need the existing two-tap "Confirm?" or `confirmDialog` pattern.

## Badges
`StudentBadge.jsx`: 410x580 px card rendered to 300 DPI PNG with true alpha corners; "Print all badges" builds a multi-page A4 PDF (3x3) via `html-to-image` + `jsPDF`. QR URL is `${SITE_URL}/p/<code>`. `html-to-image` / `jspdf` are used for badges only; don't pull them elsewhere.

## Stats
`StatsPanel.jsx`: header cards from `fetchStats`, game filter, debounced search, Summary (`fetchSummary`) and All plays (`fetchPlaysPage`, includes device column). The **server owns filtering/sorting/paging** (PAGE_SIZE 50) with infinite scroll via `usePaginatedList`. `GAME_LABELS` derive from the registry; don't hardcode game names.

## Settings
Teacher: class info, privacy toggle (`isPublic`), editable class code (check availability with `/api/codes/check`), sign-out. Admin: identity + global maintenance mode (message + end time).

If a panel change needs a new endpoint, use skill `ezw-backend-server`, and remember the server is a separate folder.
