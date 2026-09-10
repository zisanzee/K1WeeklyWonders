# EZ Wonders Home + Class System Overhaul

Read this file together with `d:\Phaser\games\PROJECT_CONTEXT.md` before touching code. The frontend lives in `d:\Phaser\games`. The backend lives in `D:\K1 games project\server`.

This brief replaces the older class-type plan AND supersedes the earlier version of this same brief. The target system is now **class-based with optional per-student codes**, not curriculum-based. Student roster and codes are **kept** and augmented with a public/private class toggle.

---

## 1. Non-negotiable goals

1. `BetaHome.jsx` becomes the real main home experience at `/`. Do not do a shallow route swap that loses existing game, stats, or login behavior.
2. The auth model is a **hybrid** (not student-code-only, not class-code-only):
   - Every class has a unique class code.
   - A class can be **Public** or **Private** (teacher-controlled toggle).
     - **Private class**: students join only via an assigned per-student code (the existing system is preserved exactly).
     - **Public class**: students join with `name + class code` (no per-student code required), OR they can still use a per-student code if one exists.
   - Teachers log in with `teacher code` only.
   - Admin logs in with a dedicated admin code only.
   - Per-student adding/management (Students tab) is **kept**, not removed.
   - Badge/QR system for student codes is **kept** (it ties directly to the student-code flow).
3. Game access is no longer managed by curriculum/class type. It must become per-class.
4. Teachers can manage only their own class's games, students, and stats.
5. Admin can manage all classes, see all classes, drill into any class's stats, and edit any class/teacher/code.
6. Admin has a global **maintenance mode toggle**. When ON, every route shows a maintenance screen to **students only**. Teachers and admins see the app normally.
7. Teachers get a new **student merge** feature: select 2+ students in the same class and merge them into one identity (their play data and stats combine).
8. Code uniqueness must be enforced across the whole system. No duplicate class codes, teacher codes, or student codes. No cross-conflicts between them either (a class code cannot equal a teacher code, etc.).
9. Legacy classes, legacy students, and legacy play-session data must **stay exactly as they are**. Only role semantics (who is admin vs teacher) and the new fields get added — existing records do not get rewritten or deleted.
10. Be faithful to the user's intent even if the current codebase uses different concepts such as `classType`, legacy student-only login, or `/p/:code`.

---

## 2. Product decisions to lock in

These decisions fill the gaps so implementation is consistent and low-risk.

### 2.1 Home behavior

- `BetaHome` replaces `Home` as the primary screen at `/`.
- `BetaHome` must preserve all real home functionality: login gate, game loading, game access checks, teacher/admin entry points, progress fetching, leaderboard/timer behavior.
- Remove the idea of "classic home" as the primary path. If a temporary fallback route is kept during migration, it must not be exposed as the main experience.

### 2.2 Roles

- `student`: local device session. May be backed by a `Student` record (if the class is private or the student has an assigned code) OR may be a "light" session identified by name + classId (public-class flow). Either way, play sessions record the name and classId.
- `teacher`: database-backed, belongs to exactly one class, can manage only that class.
- `admin`: database-backed, global access to every class.

### 2.3 Codes

Namespace rule (the "big five" buckets must never overlap):

1. Admin code — exactly one global admin code.
2. Teacher codes — one per teacher, globally unique.
3. Class codes — one per class, globally unique.
4. Student codes — one per student record, globally unique.
5. Any reserved internal keys.

A code in bucket A cannot equal a code in bucket B, and duplicates within a bucket are rejected.

Specific values:

- Add the new admin code exactly as provided:
  - code: `ezadmin12/10/22`
  - name: `Admin`
- Existing codes that currently act as admins **become normal teacher codes** (their `role` changes from `admin` → `teacher`) unless they are intentionally retired. The new admin code above is the **only** admin code after migration.
- Existing student codes and class codes stay untouched.

### 2.4 Classes (creation + editing)

**Admin** class creation must collect:

- `className`
- `classYear`
- `classAlias`
- `classCode`
- `teachers[]` — each teacher has: `name`, `teacherCode`

**Admin** can edit **any** field on **any** class after creation, including:

- class metadata
- class code
- teacher list, teacher names, teacher codes
- public/private flag
- active flag
- anything else on the class record

**Teacher** can edit only their own class's:

- public/private toggle
- game access (order, add/remove, feature, lock/unlock)
- students (add, edit, remove student name/code; merge students)
- badge generation

### 2.5 Class public / private toggle

- Boolean field on `ClassInfo`: `isPublic` (default for NEW classes: up to admin to choose at creation time).
- **Default for EXISTING/LEGACY classes: `false` (private)**. This preserves their current behavior exactly — existing students still log in with their individual codes, nothing changes for them.
- The toggle lives in the teacher's Settings tab (and also in admin's class editor for any class).

Behavior table:

| Scenario | Private class (`isPublic=false`) | Public class (`isPublic=true`) |
|---|---|---|
| Student enters a **class code** in login → | Reject it. Prompt for a **student code** instead. | Accept it. Ask the student for their **name** only. |
| Student enters a **student code** in login → | Log them in directly. Name is taken from `Student` record. Save student code locally. | Same — log them in directly. Student codes always work regardless of the toggle. |
| Student uses a URL with a **class code** → | Classify it as a class code, then since the class is private, ask for student code. | Classify it as a class code, then since the class is public, ask for name only. |
| Student uses a URL with a **student code** → | Look up the student, log them in, redirect to home. | Same — student codes are always valid. |
| Can teacher add/edit/remove student codes? | Yes, and it's the primary way students join. | Yes — still supported. A public class may still want rostered students with assigned codes (e.g. for tracking or badges). |

### 2.6 Students (kept, not removed)

- Students tab stays. Teachers can add/edit/remove individual student records with names and codes for their class.
- Badge generation stays.
- `/p/:code` student deep-link flow stays and continues to work exactly as today (plus it now works for public-class students too if the student has a code).
- For public-class students who join via `name + class code` (no assigned student record):
  - The device stores `{ name, classCode, classId }` locally.
  - Play sessions log under that name + classId.
  - If the teacher later creates a `Student` record with the **exact same name** in that class, the historical sessions for that name are already grouped with it (they share the same `studentName` field). No backfill required.

### 2.7 Student merge (new teacher feature)

Goal: if a teacher recognizes that 2+ different student names/codes actually belong to the same real child (different devices, typos, etc.), they can merge them.

Product rules:

- Only within the same class.
- Teacher selects N students (2+) from the Students list and clicks "Merge".
- The UI prompts the teacher to pick a **primary / canonical student** (the name that will appear in stats going forward). The other(s) become "merged into" the primary.
- After merge:
  - All historical `PlaySession` records belonging to any of the merged students are re-associated (or treated equivalently) to the primary student for stats queries.
  - The non-primary `Student` records are **not deleted**. They are marked as `mergedInto = <primaryStudentId>`, so the merge is reversible and no data is lost.
  - Student codes of merged students **still work** for login. When a merged student code is used, the session resolves to the primary identity.
  - In the Students list UI, merged records are hidden by default (collapsed under the primary), with an expand toggle and an "Unmerge" action if the teacher needs to undo.
  - Stats everywhere (teacher stats, admin drill-down) count the merged students as **one unique player**, with combined totals.

### 2.8 Maintenance mode (admin-only global toggle)

- One boolean flag, stored globally (not per class). Recommendation: a `SystemConfig` singleton document in the DB with key `maintenanceMode = true/false`.
- Default value after migration: `false` (off).
- Only admin can toggle it (in admin Settings tab or a dedicated maintenance control).
- **When ON:**
  - **Student** visits any route → full-screen maintenance overlay replaces content. Text: **"EZ Wonders is under maintenance currently. Come back later."** No app chrome, no navigation, no login beyond what is required to determine the role.
  - **Teacher / Admin** → app works normally. No maintenance screen. They should see a small unobtrusive indicator (e.g. amber banner at top) that maintenance mode is currently active so they don't forget it's on.
- **How it is enforced:**
  - Backend: every student-facing endpoint should optionally be aware, but the **primary enforcement is in the frontend**, because it's a UX overlay, not a data-access block. The frontend, after resolving the current identity, checks maintenance mode via an API and conditionally renders the overlay for students.
  - A backend endpoint `GET /api/system/maintenance` returns the current flag so the frontend doesn't need a hard refresh to see a change after admin toggles it.

### 2.9 Stats

- **Teachers** see stats only for their own class — same level of detail as today, but stats now honor student merges (merged students count as one).
- **Admin** first sees all classes summarized as cards/rows with:
  - class name
  - class alias
  - total plays
  - total unique players (after merges, not raw student records)
- Clicking a class opens that class's detailed stats view (same depth as teacher view, but admin sees it for any class).
- "Total players" means unique player identities recorded in play sessions for that class, **post-merge** (i.e. merged students count as 1, not N).

### 2.10 URL code behavior

Support code-driven entry from the main site.

Canonical behavior (accept all of these, they are equivalent for lookup):

- `https://ezwonders.com/?code=...`
- `https://ezwonders.com/?classCode=...`
- `https://ezwonders.com/?teacherCode=...`
- `https://ezwonders.com/?studentCode=...`
- The legacy path format `/p/:code` continues to work exactly as today (student-code deep link).

Lookup decision tree:

1. Send the code to `POST /api/code-lookup` (backend classifies it).
2. Based on returned `kind`:
   - **`kind: 'studentCode'`**:
     - Resolve the student + class.
     - Save student code, class info, and name locally.
     - Redirect to home (auto login, no form shown).
   - **`kind: 'classCode'`**:
     - Read class's `isPublic` flag from the lookup response.
     - If class is **public**:
       - Show the login form with only the **name** field. The class code is prefilled and hidden.
       - On submit, save name + class code + class info locally, redirect home.
     - If class is **private**:
       - Show the login form with only the **student code** field. (Because a private class requires an individual code; the class code alone isn't enough.)
       - The class context is known, so the UI can hint which class it is (e.g. "Enter your student code for Class X").
   - **`kind: 'teacherCode'`**:
     - Auto-login as that teacher, save teacher code locally, redirect straight to home, no form.
   - **`kind: 'adminCode'`**:
     - Auto-login as admin, save code locally, redirect straight to home, no form.
   - **invalid / not found**:
     - Fall back to the normal login screen with a clear inline error (e.g. "That code wasn't recognized. Try again or ask your teacher.").

### 2.11 Normal (non-URL) login flow

When the user lands on the site with NO code in the URL, the `NameGate` login screen works as follows:

**Step 1 — Single code field:**
- Label: "Enter your code"
- Placeholder hint covers all cases: "Class code, student code, or teacher code"
- User types a code and clicks Next (or Enter).

**Step 2 — Backend classifies via `code-lookup`, then:**
- If **student code**: done — log them in, save locally, go home.
- If **teacher code**: done — log them in, save locally, go home.
- If **admin code**: done — log them in, save locally, go home.
- If **class code + class is public**: show a **name** field, prefill/hide the class code. Submit → save name + class code locally → go home.
- If **class code + class is private**: show a **student code** field (the class code is memorized so the UI can say "Enter your student code for Class X"). Submit → validate student code against the class → log in, save student code locally → go home.
- If invalid code: show inline error on step 1 and let them retype.

This "code-first, then second-step if needed" flow keeps it simple for students while still supporting all 4 code kinds and the public/private split.

---

## 3. Current implementation facts that matter

The current app already does some things that will need to be adapted, not removed:

- `src/main.jsx` currently renders `Home` at `/` and `BetaHome` at `/beta-ezwonders`
- `src/BetaHome.jsx` is already a fully functional home variant, not just a mock
- `src/NameGate.jsx` currently supports player name + teacher code only
- `src/StudentLogin.jsx` handles `/p/:code` student-code deep link — **this must stay and work**, not be removed
- `src/StudentBadge.jsx` exists for badge printing — **keep it**, it's part of the kept student-code flow
- `src/GameAccessPanel.jsx` currently has:
  - admin editing by `classType`
  - teacher read-only game list
  - a Students tab (keep + enhance with merge)
- Backend `GameAccess` is currently class-type based, not class-based
- Backend and frontend both still carry student-related APIs and UI (mostly keep; adapt where needed)

Do not assume the older "class-type overhaul" plan is still correct. This brief supersedes it.

---

## 4. Target data model

Keep the model simple, additive, and non-destructive.

### 4.1 `SystemConfig` (new singleton collection/table)

For global flags. One single document with a fixed `_id` so it's easy to find.

Fields:

- `_id`: fixed (e.g. `"system"`)
- `maintenanceMode`: boolean, default `false`
- `updatedAt`: timestamp
- `updatedBy`: teacherId or admin code identifier

### 4.2 `ClassInfo`

Target fields (additive — existing records keep all old fields):

- `classId` (existing identifier, **do not change it**)
- `className`
- `classYear`
- `classAlias`
- `classCode` (unique across codes namespace)
- `isPublic` (boolean, default `false` for existing classes, required for new classes)
- `image` (optional, keep)
- `active` (boolean, default `true`)

Notes on legacy:

- `classType` may remain as legacy data but **must stop driving game access or permissions**. All live logic uses `classId`.
- **Existing class records are not rewritten** beyond backfilling missing new fields with safe defaults.

### 4.3 `Teacher`

Target fields:

- `code` (unique across codes namespace)
- `name`
- `classId`
- `role` enum: `teacher | admin`
- `active` (boolean, default `true`)

Migration rule for role:

- After creating the new admin record (`ezadmin12/10/22`, role `admin`), any **other** existing record that currently has `role=admin` must be downgraded to `role=teacher`. The user's intent is that only the new code is admin.

### 4.4 `Student`

Student records are **kept and active**.

Existing fields stay. Add these new fields for merging:

- `mergedInto`: `ObjectId | null` — references another `Student` (the primary) when this student has been merged away. Null for primary / non-merged students.
- `mergedAt`: `Date | null`
- `mergedBy`: `Teacher.code | null` (who performed the merge, for audit)

Rules:

- Merges are only within the same `classId`.
- Merge chains (A merged into B merged into C) are allowed but the backend should resolve to the final primary recursively, so the frontend never sees chains.
- Codes of merged students **remain valid** for login. The login resolver must chase `mergedInto` to find the primary and use the primary's identity for the session.

### 4.5 `GameAccess`

Per-class. Target fields:

- `classId`
- `gameKey`
- `added`
- `unlocked`
- `order`
- `shiny`
- `updatedBy`
- `updatedAt`

Unique key: `{ classId, gameKey }`

The current `{ classType, gameKey }` shape is no longer the target for live logic.

### 4.6 `PlaySession`

Keep class-scoped play logs. Already fit the model.

When computing stats (unique player counts, totals per student):

- A `PlaySession` that was recorded against a now-merged student should be attributed to the **primary** student. Two approaches are both acceptable; pick the cleaner one:
  1. **At query time**: stats aggregation queries join through the `Student` table and chase `mergedInto` up to the primary, grouping by primary identity.
  2. **At merge time**: atomically re-tag all `PlaySession` records of the merged-in student to point to the primary. This is simpler for queries but requires a bulk write at merge time. Either is fine; keep it consistent.

Approach 2 (re-tag at merge time) is recommended because it keeps stats queries simple and fast. But be sure to store `mergedInto` too so unmerge can restore the tags.

### 4.7 Code uniqueness — the unified rule

All codes (student code, teacher code, class code, admin code) must be in one global conflict-free namespace.

Practical enforcement:

- On any create or update that changes a code, the backend checks **all four** tables for the code.
- Indexes should be set per-collection unique as before, plus the application-level cross-check, because MongoDB can't enforce uniqueness across collections.
- The `POST /api/codes/check` endpoint (§5.6) encapsulates this check for the UI.

---

## 5. Required backend changes

### 5.1 System config / maintenance mode

- `GET /api/system/config` — public-ish, returns `{ maintenanceMode }` (and any other global flags later). Used by frontend on every route change / mount to decide if maintenance overlay should show.
- `PATCH /api/system/config` — **admin only**. Accepts `{ maintenanceMode: boolean }`. Toggles the flag.
- Store these in the `SystemConfig` singleton.

### 5.2 Auth and code lookup (v2)

Add or refactor endpoints so the frontend can classify codes cleanly and get all info needed for the step-2 flow.

Recommended endpoints:

- `POST /api/code-lookup`
  - input: `{ code }`
  - output variants:
    - `{ kind: 'adminCode', name, role }`
    - `{ kind: 'teacherCode', name, classId, className, classAlias, role }`
    - `{ kind: 'classCode', classId, className, classAlias, classCode, isPublic }`
    - `{ kind: 'studentCode', studentId, studentName, classId, className, classAlias, classCode, mergedInto? }` (include resolved primary identity info if merged)
    - or `404` / `{ kind: 'invalid' }`
  - Crucially, for `classCode` the response includes `isPublic` so the frontend knows whether step 2 is "name" (public) or "student code" (private).

- `POST /api/student-login`
  - Supports both student-login modes:
    - mode A: `{ studentCode }` → private-class or rostered student login. Validates student code. Returns full student + class identity, with mergedInto resolved.
    - mode B: `{ name, classCode }` → public-class "light" login. Validates class code, checks class.isPublic === true, returns class identity. Returns the session payload (no Student record required).
  - Device still stores the successful identity locally.

- `POST /api/teacher-login` (existing pattern, keep and adapt)
  - input: `{ code }`
  - returns teacher/admin identity + class info.

You may keep a single polymorphic login endpoint if it's cleaner, but the frontend behavior above must remain possible.

### 5.3 Class management

Admin-only class management endpoints (teacher's own class info is read via a separate teacher-self endpoint):

- `GET /api/classes`
  - admin: returns all classes with summary info (name, alias, code, isPublic, active, teacher count, student count, total plays/players stub if cheap).
  - teacher: if reused, returns ONLY the teacher's own class. Or keep separate endpoints per role to avoid confusion.
- `GET /api/classes/:classId`
  - admin: full detail.
  - teacher: only if `teacher.classId === classId`.
- `POST /api/classes`
  - admin-only. Creates class plus its teachers.
  - Validates: classCode uniqueness across namespace, each teacherCode uniqueness, and no cross-conflicts.
- `PUT /api/classes/:classId`
  - admin-only. Updates **any** class field: className, classYear, classAlias, classCode, isPublic, active, AND the full teacher list (add/remove/rename/change-code teachers).
  - Teacher edits: when a teacher's code changes, validate against global namespace. When a teacher is removed, consider soft-deactivate (set active=false) rather than deleting, so stats rows that reference the teacher don't break.
- `PATCH /api/classes/:classId/public`
  - teacher OR admin. Teacher must own the class. Toggles `isPublic`.

### 5.4 Student management (kept, plus merge)

Teacher-scoped endpoints for their class:

- `GET /api/classes/:classId/students`
  - teacher: only own class.
  - admin: any class.
  - Returns student list, including `mergedInto` info so the UI can render merged/hidden students correctly.
- `POST /api/classes/:classId/students` — add a student (name + code). Validate code global uniqueness.
- `PUT /api/classes/:classId/students/:studentId` — edit name/code. Validate code global uniqueness.
- `DELETE /api/classes/:classId/students/:studentId` — remove student record.
- `POST /api/classes/:classId/students/badge` — generate badges for given student IDs (kept from existing).

**New — student merge:**

- `POST /api/classes/:classId/students/merge`
  - teacher: only own class.
  - admin: any class.
  - input: `{ primaryStudentId, mergedStudentIds: [id1, id2, ...] }`
  - behavior:
    1. Validate all IDs belong to `classId`, primary is not in merged list, no duplicates.
    2. For each `mergedStudentId`:
       - Set `Student.mergedInto = primaryStudentId`, `mergedAt = now`, `mergedBy = actor`.
       - If you chose approach 2 for play-session re-tagging: re-tag all PlaySessions matching that student to `studentId = primaryStudentId`, `studentName = primaryStudent.name`. Also remember what was changed so unmerge can restore it.
    3. Resolve any chains: if primary itself was merged into someone else, first collapse to the ultimate primary before doing work.
    4. Return updated student list.

- `POST /api/classes/:classId/students/:studentId/unmerge`
  - Reverts a single merged student back to being its own identity.
  - Clears `mergedInto`, restores PlaySession tags if you stored the pre-merge state, returns updated student list.

### 5.5 Game access

Move all game access reads and writes to `classId`, not `classType`.

- Teacher permissions: fetch and mutate (reorder / add / remove / feature / unlock) only for own class.
- Admin permissions: fetch and mutate for any class.

Recommended endpoints:

- `GET /api/game-access?classId=...`
- `PUT /api/game-access/order` (with `classId` in body)
- `PUT /api/game-access/:gameKey`
- `PUT /api/game-access/:gameKey/shiny`
- `POST /api/game-access/:gameKey`
- `DELETE /api/game-access/:gameKey`

All write endpoints accept a target `classId` and enforce role checks.

### 5.6 Code conflict validation

- `POST /api/codes/check`
  - input: `{ code, excludeTeacherId?, excludeClassId?, excludeStudentId? }`
  - exclusions let the admin/teacher re-save an existing code without it "conflicting with itself" during edit.
  - output: `{ available: true }` or `{ available: false, reason: 'duplicate-teacher' | 'duplicate-class' | 'duplicate-student' | 'conflicts-with-admin' }`

Even with this endpoint, the create/update endpoints must still hard-reject duplicates.

### 5.7 Stats

Teacher stats endpoint (same spirit as today, ensure it respects merges):

- `GET /api/stats?teacherCode=...` or `GET /api/classes/:classId/stats`

Admin stats:

- `GET /api/admin/stats/classes` — one row per class with: classId, className, classAlias, totalPlays, totalPlayers (post-merge unique count).
- `GET /api/admin/stats/classes/:classId` — drill-down. Same as teacher detailed stats, but admin can call for any classId.

All stats endpoints deduplicate merged students.

---

## 6. Backend migration plan

Idempotent. Non-destructive. Legacy-preserving.

### 6.1 System config

- Ensure `SystemConfig` singleton exists with `maintenanceMode: false`.

### 6.2 Preserve classes, enrich (no rewrites)

For every existing `ClassInfo`:

- keep `classId` exactly as-is.
- keep all existing fields exactly as-is.
- backfill if missing:
  - `classYear` → if missing, set to `null` / empty string (admin can fill in later; **don't guess**).
  - `classAlias` → if missing, copy `className` as a safe default (admin can rename; preserves meaning).
  - `classCode` → if missing, this is a problem: a class must have a code. Generate one (e.g. short random uppercase string) and **record it in an admin-visible notice list** (so admin knows which classes got auto-generated codes and can fix them to the desired values later). Do NOT leave it null.
  - `isPublic` → **default to `false` (private)** on every existing class, so existing classes retain their current behavior (students must use individual codes).
- Keep `classType` on the document if present, but mark it deprecated in comments — no live logic reads it anymore.

### 6.3 Teacher/admin migration

- Create the new admin user exactly once:
  - code: `ezadmin12/10/22`
  - name: `Admin`
  - role: `admin`
  - `classId`: null (admin is global, not class-bound)
- For every OTHER existing teacher record:
  - if `role === 'admin'`, downgrade it to `role === 'teacher'`.
  - leave all other fields (name, code, classId) exactly as they are.
- Ensure each teacher has a classId (if somehow a non-admin teacher has no classId, flag it — admin needs to fix; don't silently reassign).

### 6.4 GameAccess migration: classType → classId

Goal: every class ends up with its OWN independent set of `GameAccess` rows.

Rule:

1. Detect whether `GameAccess` documents still use `classType`.
2. For each class in `ClassInfo`:
   - Find its legacy `classType` value (k1 / k2 / ...).
   - Clone the current GameAccess rows for that `classType` into rows for this class's `classId`.
3. After cloning every class, now you have per-class rows. Build the new unique index `{ classId, gameKey }`.
4. **Do not delete** the old `classType` rows in the same migration run — leave them as a backup. A follow-up clean-up migration can drop them after the system is verified live.
5. **Critical:** ensure the clone produces **separate documents per class** — no sharing, no accidental shared `_id`s.

### 6.5 Student migration

- **DO NOT delete or rewrite any `Student` documents.**
- Add `mergedInto`, `mergedAt`, `mergedBy` fields (null defaults).
- `/p/:code` flow continues to work — leave routes and lookups intact.

### 6.6 Code uniqueness backfill check

After all fields are in place, run a one-time check script that scans for:

- duplicate class codes
- duplicate teacher codes
- duplicate student codes
- cross-conflicts (e.g. a class code equals a teacher code)

Report any duplicates to admin (via a log / admin dashboard warning). Do NOT auto-rename user-assigned codes during migration — flag them and let admin decide, because changing codes would break printed badges and shared links.

---

## 7. Required frontend changes

### 7.1 Routing

Update `src/main.jsx`:

- render `BetaHome` at `/`
- retire or redirect `/beta-ezwonders` (301 to `/` or keep as alias but render same component)
- remove or demote `Home.jsx` from the main experience (it can wrap `BetaHome` temporarily for safety but don't maintain two divergent home shells)
- **keep** `/p/:code` → `StudentLogin` route (it still works for student-code deep links)

### 7.2 Session store (`src/playerStore.js`)

Update persisted fields to cover all login modes:

- `playerName`
- `classId`
- `className`
- `classAlias`
- `classCode`
- `studentCode` | null (present if student used / was rostered with a per-student code)
- `studentId` | null (present if backed by Student record)
- `isTeacher`
- `isAdmin`
- `teacherCode` | null
- `identityKind` — one of `'student-light' | 'student-rostered' | 'teacher' | 'admin'` (useful for UI decisions and maintenance-mode gating)

Behavior:

- student-light (public class, name only): stores `playerName + classCode + classId`, `studentCode=null`, `identityKind='student-light'`.
- student-rostered (per-student code): stores `studentCode + studentId + playerName + classId`, `identityKind='student-rostered'`.
- teacher: stores `teacherCode + classId + role`, `identityKind='teacher'`.
- admin: stores `teacherCode` (or admin code field), `identityKind='admin'`.
- reset clears ALL of the above.

### 7.3 Maintenance gate

Add a frontend-level maintenance check. Mechanism:

- A small hook or context (`useSystemConfig`) that:
  - Loads `GET /api/system/config` on app boot and on route changes (cheap).
  - Polls every 30–60 seconds so the maintenance overlay appears/disappears without refresh after admin toggles it.
- A top-level `<MaintenanceGate>` wrapper in the app tree (or inside `NameGate` / `BetaHome`) that:
  - If the current identity is a STUDENT (`identityKind` is student-light or student-rostered) AND `maintenanceMode === true`:
    - Render a full-screen, centered, kid-friendly maintenance screen:
      - Heading: "EZ Wonders is under maintenance 🔧"
      - Subtext: "Come back later!"
      - No app chrome, no navigation, no login form (if already logged in).
      - If student is NOT logged in yet and hits the site during maintenance, still show the same overlay (code-first login is skipped for students).
  - If the current identity is TEACHER or ADMIN:
    - Render the app normally.
    - Show a small, non-intrusive amber ribbon at the very top of the page when maintenance mode is active: "⚠ Maintenance mode is ON — students see a maintenance screen. Toggle off in admin settings."

Determining "is student" before login: if there is a stored session, use it. If there is no stored session AND we are showing the login gate, the app has to assume "could be student OR teacher/admin". In this ambiguous case, still render the maintenance overlay AND a small escape hatch: a link/button "I'm a teacher / admin" that bypasses the overlay and shows the code-first login form so teachers/admins can still get in during maintenance.

### 7.4 Login gate (`src/NameGate.jsx` overhauled)

Implement the "code-first, then second step if needed" flow from §2.10 and §2.11.

States:

1. **`step-1-code`** — single field "Enter your code". Submit → calls `code-lookup`.
2. **`step-2-name-for-public-class`** — shown when code was a public class code. Single field "Your name". Submit → calls `student-login` with name + classCode → saves → go home.
3. **`step-2-student-code-for-private-class`** — shown when code was a private class code. Single field "Enter your student code for Class X". Submit → calls `student-login` with studentCode → saves → go home.
4. **`auto`** — for teacher/admin/student-code recognition in step 1: directly save session and go home, no extra screen.

Rules:

- Store successful logins locally so repeat visitors skip the gate.
- If a stored session exists, skip the gate as today.
- Do NOT fall back to local hardcoded teacher code files. Use only server APIs.
- Handle URL codes: if a code is present in `?code` / `?classCode` / `?teacherCode` / `?studentCode`, treat it as if the user typed it into step 1 — call code-lookup, then branch.

### 7.5 Home screen (`src/BetaHome.jsx`)

Becomes the real home shell. Required changes:

- keep all game-card and loading behavior.
- update branding and metadata from `k1weekly.netlify.app` / `K1 Weekly Wonders` to `ezwonders.com` / `EZ Wonders`.
- remove "Classic Home" CTA.
- ensure teacher/admin controls point to the new panel behavior.
- wrap with `<MaintenanceGate>` or hook into the maintenance system so students see the overlay when active.

### 7.6 Game access client logic (`src/gameAccess.js`)

Update so active logic is class-based:

- reads by `classId`
- writes by `classId`
- remove live reliance on `classType`

Restore teacher write permissions (for their own class only — enforced by backend anyway).

### 7.7 Management panel (`src/GameAccessPanel.jsx`) redesign

Split the navigation by role.

#### Teacher experience (tabs):

**1. Games**
- Reorder games
- Add / remove games
- Feature / unfeature games
- Lock / unlock games
- (All scoped to their class.)

**2. Students** (kept + enhanced)
- Table of students: name, code, badge button, edit, delete
- "Add student" button (name + code; live code availability check)
- **Merge UI** (new):
  - Multi-select checkboxes on student rows
  - "Merge selected (N)" button, disabled until N ≥ 2
  - Clicking opens a dialog:
    - Lists the selected students
    - Asks teacher to pick the primary (radio buttons, defaults to first selected)
    - Shows a preview: "After merge, all play time and stats will be combined into [Primary Name]."
    - Confirm button triggers merge API call; closes dialog and refreshes list.
  - In the list: merged students are hidden by default. An "X merged students hidden — show" toggle reveals them, each with a badge "Merged into [Primary]" and an "Unmerge" action.
- Badge printing stays.

**3. Stats**
- Same detail level as today. Stats reflect merges (single unique player per merged group).

**4. Settings**
- Class info display (name, alias, year, code — teacher sees these read-only because admin edits them per §3 clarification? Actually per §2.4: admin edits class metadata, teacher only toggles public/private here).
- **"Class privacy" toggle:**
  - Label: "Allow anyone to join with the class code (public) vs. require individual student codes (private)."
  - Values: [Private / Public] — saved immediately on toggle.
  - Shows a short confirmation description under each option.

#### Admin experience (tabs):

**1. Classes**
- Class list view (each row: name, alias, code, isPublic badge, active state, teacher count, student count, quick stats).
- "+ New class" button opens class creation form with:
  - class name, year, alias, class code (with live uniqueness check)
  - teachers list: add/remove rows of (name, teacher code), each code with live uniqueness check.
- Clicking a row opens class detail editor:
  - all class metadata editable (including code — warn admin that changing a code breaks printed badges / shared links)
  - teacher list editor (add, edit name/code, remove, change which classId the teacher belongs to)
  - class public/private toggle (admin can override)
  - class active toggle
  - "Games for this class" sub-panel (admin can manage games for the selected class)
- Live global code-conflict validation on every save (§5.6).

**2. Stats**
- Default: all-classes summary grid/list with total plays + total players per class (as cards or rows).
- Click a class → drill into detailed stats (same depth as teacher view).
- Breadcrumb / back button to return to all-classes summary.

**3. Settings**
- Admin identity display.
- **Maintenance mode toggle** (big, obvious, with warning text):
  - "When ON, students see a maintenance screen on all pages. Teachers and admins see normally."
  - Label reflects current state: "Maintenance mode: OFF / ON".
  - Amber indicator in the admin panel header reflects live state.
- Any other global admin settings.

### 7.8 Stats UI (`src/StatsPanel.jsx`)

Extend carefully:

- Teacher mode: keep similar detailed behavior; ensure it's driven by `classId` and deduplicates merged identities.
- Admin mode:
  - First render all-class totals grid/list.
  - On class click, open class detail stats.
  - Allow returning to all-class summary via breadcrumb.

### 7.9 Student login & badge files (kept, not removed)

Keep and adapt:

- `src/StudentLogin.jsx` — stays as `/p/:code` handler. It now calls the v2 endpoints (code-lookup or student-login with studentCode) and stores session via the unified player store.
- `src/StudentBadge.jsx` — stays, still generates badges for student codes.
- Badge printing actions in the Students tab stay.

### 7.10 Minor

- Update any leftover `k1weekly.netlify.app` references in metadata/copy → `ezwonders.com`.
- Keep API base the same (already handled by env config per the user's note).

---

## 8. Domain and branding updates

- Primary domain is now `ezwonders.com`.
- Backend API base stays the same unless env config already abstracts it.
- Update metadata, copy, and any generated links that still point to `k1weekly.netlify.app`.
- `k1weekly.netlify.app` already redirects at Netlify level — do not build app logic that depends on the old domain.

---

## 9. Guardrails

1. Do not break existing play-session logging.
2. Do not delete historical data in the first pass unless absolutely necessary.
3. Do not rewrite or reassign existing class IDs, student IDs, or student codes.
4. Do not change existing classes' `isPublic` to `true` — default legacy classes to `false` so behavior is unchanged.
5. Do not auto-rename conflicting legacy codes during migration; flag them for admin.
6. Do not keep `classType` as an active permission/config dimension in live logic (storage-only is fine).
7. Do not remove student roster UI, student codes, or badges — they are part of the live product now.
8. Any code-conflict check in the UI must also be enforced by the backend.
9. Maintenance mode must not block teachers or admins — ever. There must always be an "I'm a teacher/admin" escape hatch on the maintenance screen for pre-login users.
10. Student merge must not lose data: always write `mergedInto` references; if retagging sessions, save enough info to unmerge cleanly.

---

## 10. Suggested implementation order

1. Backend model additions + SystemConfig + fields (ClassInfo.isPublic, Student.mergedInto/At/By, Teacher.role audit, SystemConfig singleton).
2. Idempotent migration script: backfill class fields (default isPrivate=false), create admin code, downgrade other role=admin to teacher, clone GameAccess classType→classId, code-conflict audit report.
3. Backend endpoints: `/api/system/config` (maintenance), `/api/code-lookup` v2, `/api/student-login` v2, `/api/codes/check`.
4. Backend class management endpoints + teacher endpoints + student endpoints + student merge/unmerge.
5. Backend game-access endpoints (class-based).
6. Backend stats endpoints: teacher class-stats + admin all-class summary + admin class-drill-down, all merge-aware.
7. Frontend: playerStore rewrite (identityKind, all new fields).
8. Frontend: MaintenanceGate + system config hook.
9. Frontend: NameGate v2 (code-first step flow + URL code handling).
10. Frontend: route switch — BetaHome becomes `/`.
11. Frontend: panel redesign (teacher: Games / Students / Stats / Settings with merge + public/private; admin: Classes / Stats / Settings with maintenance toggle + class editor).
12. Frontend: Stats UI redesign (admin all-class summary, drill-down, post-merge dedup).
13. Frontend: StudentLogin / StudentBadge keep + adapt to new store.
14. Final branding sweep, acceptance checklist.

---

## 11. Acceptance checklist

- [ ] `/` uses `BetaHome` as the real production home.
- [ ] Student login — code-first flow works end-to-end:
  - [ ] Entering a **student code** logs the student in directly (any class public/private).
  - [ ] Entering a **class code of a PUBLIC class** → asks for name → logs in with name + class code.
  - [ ] Entering a **class code of a PRIVATE class** → asks for student code (shows class name hint) → logs in.
  - [ ] Entering a **teacher code** → logs teacher in directly.
  - [ ] Entering **admin code `ezadmin12/10/22`** → logs admin in directly.
  - [ ] Invalid code shows clear inline error.
- [ ] URL code behavior:
  - [ ] `?code=<studentCode>` → auto-login student, save locally.
  - [ ] `?code=<classCode>` (public class) → only asks for name.
  - [ ] `?code=<classCode>` (private class) → asks for student code.
  - [ ] `?code=<teacherCode>` → auto-login teacher, no form.
  - [ ] `?code=<adminCode>` → auto-login admin, no form.
  - [ ] `/p/:studentCode` still works exactly as today.
- [ ] Legacy preservation:
  - [ ] Existing classes keep their data, students, codes, play history unchanged.
  - [ ] Existing classes default to PRIVATE (their current behavior is preserved).
  - [ ] Old admin codes become teacher role; only `ezadmin12/10/22` is admin.
- [ ] Teacher permissions:
  - [ ] Teacher can edit only their own class's games (order, add/remove, feature, lock/unlock).
  - [ ] Teacher can toggle their class public/private.
  - [ ] Teacher can add/edit/remove students in their class.
  - [ ] Teacher can generate badges.
  - [ ] Teacher cannot access another class's stats or settings.
  - [ ] Teacher sees only their own class's stats.
- [ ] Admin permissions:
  - [ ] Admin sees all classes in list.
  - [ ] Admin can create classes with name, year, alias, class code, and teacher list (name + code each).
  - [ ] Admin can edit **any** field on **any** class: name, alias, year, code, public/private, active, teacher list (add/remove/rename/change-code).
  - [ ] Admin can edit games for any class.
  - [ ] Admin sees all-class stats summary (total plays / total players per class).
  - [ ] Admin can click a class and drill into its detailed stats.
- [ ] Code uniqueness:
  - [ ] Duplicate class codes are rejected.
  - [ ] Duplicate teacher codes are rejected.
  - [ ] Duplicate student codes are rejected.
  - [ ] Cross-conflicts (class code = teacher code, etc.) are rejected.
  - [ ] Admin UI shows live "code available" indicators.
- [ ] Maintenance mode:
  - [ ] Admin can toggle maintenance mode ON/OFF.
  - [ ] When ON, student on any route sees the maintenance screen.
  - [ ] When ON, teacher/admin sees the app normally, with a small banner that maintenance is active.
  - [ ] Pre-login users are shown the maintenance overlay PLUS an "I'm a teacher / admin" escape hatch.
- [ ] Student merge:
  - [ ] Teacher can select 2+ students and merge them.
  - [ ] Teacher picks which is primary during merge.
  - [ ] Merged students count as 1 unique player in all stats (plays and totals combined).
  - [ ] Merged student codes still work for login, resolving to the primary identity.
  - [ ] UI can show merged students (hidden by default, toggle to reveal).
  - [ ] Unmerge restores the student as its own identity (stats split back out).
- [ ] Badge generation and student code printouts still work.
- [ ] Play sessions still log correctly for all login modes (student-light, rostered, teacher).
- [ ] Old class-type game access has been migrated into per-class game access.
- [ ] Branding sweep: app metadata/copy refers to `ezwonders.com` / `EZ Wonders`.

---

## 12. Nice-to-have polish after the core migration

- Dedicated `useCodeLookup` hook on the frontend for cleaner URL-driven login.
- Admin search/filter for large class lists.
- Archived/inactive classes hidden by default with a toggle.
- Inline "code available" indicators while typing in admin and student forms.
- Admin dashboard showing the migration-time list of classes that received auto-generated codes, so admin can fix them.
- "Maintenance mode ends at (optional time)" field on the system config, with a countdown on the maintenance overlay.
- Merge history/audit log visible to teacher (when, who merged whom).

---

## 13. Open questions for the user

These are areas where I made reasonable default decisions to keep logic consistent, but you may want different behavior. Review and answer before the agent starts executing, or the defaults below will be built.

**Q1 — Merged student codes: keep them all working, or deactivate non-primary codes?**
Default decision (built if you don't answer): All merged student codes CONTINUE TO WORK (login resolves to the primary identity). Reason: so printed badges and shared links for the non-primary students don't break overnight.
Answer: the merging is for students that did not log in through the code system. they just put the class code and their names. so this doesn't apply to codes that were generated for them.

**Q2 — Student merge unmerge: should it fully restore play sessions to each original student, or is it OK if historical sessions from before the merge stay attributed to the primary?**
Default decision: Full restore — unmerge puts each student's play sessions back exactly where they were pre-merge (requires storing the pre-merge mapping). Reason: it's the intuitive "undo" behavior for a teacher who merges by mistake.
Answer: yeah sure. if it's not too resource heavy. 

**Q3 — Default for NEW classes when admin creates them: should the form pre-select Private or Public?**
Default decision: Form pre-selects **Private**, and admin can flip to Public before saving. Reason: safer default (class starts locked down until admin/teacher explicitly opens it).
Answer: yup that's good.

**Q4 — Maintenance screen: do you want the exact text fixed as written, or should it support a custom admin-editable message (and optionally a scheduled end time / countdown)?**
Default decision: Fixed text exactly as specified — "EZ Wonders is under maintenance currently. Come back later." — plus a small system-config field for an optional custom message that overrides it if filled. Reason: gives flexibility without requiring the custom message.
Answer: editable message with an optional end time / countdown. would be good. just make sure to implement that properly for the admin so it's not clustured or confusing.

**Q5 — Can a teacher change a class's code, or is class code strictly admin-only?**
Per §2.4 I assumed: admin can edit class code (and teacher code, student code, etc.). Teacher canNOT edit their class code — they see it read-only in Settings. Only the public/private toggle is teacher-editable on the class itself.
Confirm or override: If you also want teachers to be able to change their own class code, say so and the brief will be updated.
Answer: teacher can edit their own class code but only to an available code not taken already.
