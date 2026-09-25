# Server-Side Security Actions

The backend is an Express + Mongoose API that lives **outside this repository**
(at `../../K1 games project/server/`) and is deployed separately on Render. None
of the items below can be done from the frontend repo — they are recorded here so
the operator has an actionable list, each with a priority and a way to verify it.

Priorities: **P0** = do before any further growth; **P1** = do soon; **P2** =
worth doing, lower urgency.

---

## 1. Mongo operator-injection guarding — **P0**

**What:** Every endpoint that takes a `code` from the request body/params must
cast it to a `String` before it reaches a Mongoose query, or the server should
use `express-mongo-sanitize`. Without this, a body like
`{ "code": { "$gt": "" } }` is an object, Mongoose treats it as a query operator,
and a comparison against an empty string can match an arbitrary document — a
login bypass.

**Why:** Code lookups are unauthenticated and are the front door. An injection
here is a full authentication bypass, not a data leak.

**How to verify:** Send `POST /api/code-lookup` (and the other code endpoints)
with `{"code": {"$gt": ""}}` and confirm a `400`/no-match rather than a session.
Grep the route handlers for any `req.body.code` / `req.params.code` used in a
query without `String(...)`.

---

## 2. Raise code entropy and make codes rotatable — **P0**

**What:** Student, teacher and class codes should be generated with a CSPRNG and
be long enough to resist brute force. They must be **rotatable**
(`PATCH /api/classes/:classId/code` exists for class codes; ensure student/teacher
codes have a rotation path too). The global `ADMIN_CODE` — a **single secret that
controls every class** — is the most important: it must be long, random, and
rotatable.

**Why:** Codes are bearer credentials. A short, guessable, or non-rotatable code
is a standing weakness, and rate limiting alone does not fix a guessable secret.

**How to verify:** Confirm the generator is `crypto.randomBytes` (or equivalent),
not `Math.random`. Confirm the code length is well above the brute-force threshold
for the rate limit. Confirm each code type can be changed without recreating the
account.

---

## 3. Rotate the admin code and document the procedure — **P0**

**What:** If the `ADMIN_CODE` has ever been shared in plaintext (chat, ticket,
screenshot, commit), rotate it. Document how: the value comes from the
`ADMIN_CODE` env var and is applied by a **boot migration** that runs in the
`mongoose.connect().then()` chain before `app.listen`. There is an enum/role
replay path that applies role changes to existing documents — make sure the new
code is what lands after rotation.

**Why:** One secret controls every class. A leaked admin code is the worst case
in the system, and an undocumented rotation is one nobody will perform correctly
under pressure.

**How to verify:** Change `ADMIN_CODE`, redeploy, and confirm the old code no
longer resolves to an admin identity while the new one does.

---

## 4. Harden rate limiting — **P1**

**What:** The current limits are per-IP on a **single instance**. Move to a
store-backed limiter (e.g. Redis) that keys on **code + IP** and survives multiple
instances and restarts. Confirm limits exist on all five unauthenticated routes:
`/api/code-lookup`, `/api/teacher-login`, `/api/student-login`, `/api/plays`,
`/api/feedback`.

**Why:** Per-IP in-memory limiting is defeated by restart (fine here) and by
horizontal scaling (limits multiply per instance). Keying on code+IP also slows a
distributed guess against one code, which pure per-IP misses.

**Do not** add limits to authenticated write paths — a whole class legitimately
bursts through `/api/plays`, and a per-IP cap would throttle everyone behind one
school NAT.

**How to verify:** Trigger each of the five routes past the limit and confirm a
`429`; confirm the limiter state is shared when more than one instance runs.

---

## 5. Failed-auth logging and alerting — **P1**

**What:** Log failed code attempts — the route, the source IP, and a **redacted**
identifier (never the full code), so brute force is visible after the fact.

**Why:** Without logs, an attack against the code space is invisible; rate limits
slow it but do not reveal it.

**How to verify:** Make a failing login and confirm a log line appears that does
**not** contain the full code, and that alerts fire on a burst.

---

## 6. CORS is not an authorization boundary — **P1**

**What:** Keep `ALLOWED_ORIGINS` tight to `https://ezwonders.com`, but treat it as
a convenience, not security.

**Why:** CORS stops a browser from *reading* a cross-origin response; it does not
stop the request from being *made*, and it does not apply to non-browser clients
like `curl`. Any endpoint relying on CORS to be safe is not safe.

**How to verify:** Call a protected endpoint with `curl` (no `Origin`) and confirm
the server still enforces auth on its own.

---

## 7. MongoDB deployment hardening — **P1**

**What:** Confirm the deployment requires **auth + TLS**, the database user is
**least-privilege** (read/write the app database only — not `admin`, no
`dbAdmin`), and Atlas network access is restricted (IP allowlist / private
endpoint), not `0.0.0.0/0`.

**Why:** The database holds children's names and is the last line of defence if
the API is bypassed.

**How to verify:** Check the Atlas connection string includes `tls=true` and
credentials; check the DB user's roles; check the network access list.

---

## 8. Legacy default class fallback — **P1**

**What:** `POST /api/plays` falls back to the legacy class
(`classId: 'k12026-pny'`) when `classId` is absent client-side. Confirm this
fallback cannot be used to write into an unintended class.

**Why:** A write that lands in the wrong class pollutes stats and could associate
a child's play with the wrong roster.

**How to verify:** Post to `/api/plays` with no `classId` and confirm the record
lands in the intended legacy class only; post with a `classId` for a class the
caller does not belong to and confirm it is rejected.

---

## Checklist

- [ ] **P0** Operator-injection guarding on every code-taking endpoint.
- [ ] **P0** CSPRNG-generated, sufficiently long, rotatable codes, incl. a long
      random rotatable `ADMIN_CODE`.
- [ ] **P0** Admin code rotated (if ever shared) and rotation documented.
- [ ] **P1** Store-backed, code+IP rate limiting on the five unauthenticated
      routes.
- [ ] **P1** Failed-auth logging (redacted) with alerting.
- [ ] **P1** `ALLOWED_ORIGINS` tight, and understood as non-authoritative.
- [ ] **P1** Mongo auth + TLS, least-privilege user, restricted network access.
- [ ] **P1** Legacy class fallback confirmed non-exploitable.
