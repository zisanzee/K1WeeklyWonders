# Security Policy

EZ Wonders is a small, independent kids' numeracy platform. This document
describes how to report a vulnerability and, accurately, what the application
does and does not protect. It is deliberately modest: it describes the code that
exists, not an aspiration.

## Reporting a vulnerability

**Contact:** [contact@ezwonders.com](mailto:contact@ezwonders.com)

This is the same single inbox the product itself surfaces
(`src/ui/ContactStrip.jsx`) — there is no separate security address, and
inventing one would just split reports across two places.

Please include enough to reproduce: the affected URL/route, the steps taken, and
what you observed versus expected. If a live code (student, teacher or admin) is
involved, **do not paste the full code or a working login link** — describe it
instead (e.g. "a 6-character student code"). A code is a bearer credential: it is
the login.

What you can expect from a solo-maintained project:

- An acknowledgement of receipt, best-effort, within a few days.
- A good-faith assessment and, if the report is valid, a fix as soon as is
  practical for a small project.
- Credit in the fix notes if you would like it.

Please practise **responsible disclosure**: give a reasonable window for a fix
before publishing details, and do not access, modify, or exfiltrate other users'
data, or degrade the service for real classrooms, while investigating. Testing
against your own class/student data is welcome; testing against others' is not.

Because the app is used by young children, reports involving the exposure of a
child's name, a live login code, or the ability to sign in as another class are
treated as the highest priority.

## What the app protects, and how

The backend is an Express + Mongoose API. **Auth is not JWT- or session-based**;
there is no HttpOnly cookie. A code is submitted and re-validated against the
database **on every write request** by `requireTeacher` / `requireAdmin`
middleware. The client cannot assert its own privileges.

- **Credentials live in the URL/localStorage, not in a cookie.** The persisted
  credential is stored in `localStorage['ezwonders-player']` and is used on the
  `/p/:code` auto-login route — a live credential in the URL path, printed into
  QR codes. This is a known trade-off of the code-based model. Header rules
  (below) reduce its blast radius; it cannot be eliminated without moving to
  cookie or token sessions, which is a server-side change.
- **Only the credential is persisted.** `src/auth/playerStore.js` persists
  exactly `{ code, name, mode }` and nothing else. Names, class ids and roles are
  runtime-only, re-derived from the database on every load. This is what makes
  **revocation work**: if a teacher removes a student or changes a code, that
  device is signed out on its next validation.
- **The client `isTeacher` / `isAdmin` flags are UI state only — not a security
  boundary.** They decide what the interface shows; the server is the authority
  and re-checks every write. Do not treat a client flag as a permission check.
- **Security headers** are set in `public/_headers` for the static frontend:
  a restrictive CSP (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options:
  nosniff`, a default `Referrer-Policy` of `strict-origin-when-cross-origin`, a
  tighter `no-referrer` on the credential-bearing `/p/*` route, a
  `Permissions-Policy` disabling unused device APIs, `X-Frame-Options: DENY`, and
  `Cross-Origin-Opener-Policy: same-origin`.
- **Supply chain:** `npm audit` is run as a blocking CI step, Dependabot is
  configured (`.github/dependabot.yml`), and production source maps are disabled
  (`vite.config.js`).
- **Rate limiting** exists on the unauthenticated, abuse-prone API routes
  (`/api/code-lookup`, `/api/teacher-login`, `/api/student-login`, `/api/plays`,
  `/api/feedback`). It is per-IP on a single instance; see
  [`docs/SERVER_SECURITY_ACTIONS.md`](docs/SERVER_SECURITY_ACTIONS.md) for the
  known limits of that approach.

What this app does **not** claim: it is not end-to-end audited, it does not use
cryptographic session tokens, and the client-side auth model is defence-in-depth
around a code-based scheme, not a replacement for one.

## Scope

**In scope**

- The frontend at `ezwonders.com` (this repository).
- The API contract it depends on: code lookup/login, game-access, plays/stats,
  class and roster management.
- Exposure of child data (names), live login codes, or cross-class access.
- Bypass of a server-side authorisation check, or any path where a client flag
  alone grants a write.

**Out of scope**

- The backend source repository itself is not in this repo; report backend issues
  to the same address, but know that fixes require access to the server project.
- Denial-of-service and volumetric attacks, and anything requiring physical
  access to a device.
- Missing "best practice" headers with no demonstrated impact, and reports from
  automated scanners with no proof of exploitability.
- Social engineering, and issues in third-party platforms (Netlify, Render,
  MongoDB Atlas, Cloudinary).

## Security controls in place — reviewer checklist

- [ ] Code-based auth re-validated server-side per write request
      (`requireTeacher` / `requireAdmin`).
- [ ] Client persists only `{ code, name, mode }`; identity re-derived from the
      DB every load so revocation is effective.
- [ ] `isTeacher` / `isAdmin` documented and treated as UI-only, not a boundary.
- [ ] Restrictive CSP with `script-src 'self'`, `object-src 'none'`,
      `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- [ ] HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
      `X-Frame-Options: DENY`, COOP set in `public/_headers`.
- [ ] `/p/*` overrides the referrer policy to `no-referrer` for the
      credential-bearing login route.
- [ ] Rate limiting on all five unauthenticated routes.
- [ ] Blocking `npm audit` step in CI; Dependabot configured.
- [ ] Production source maps disabled.
- [ ] Child-data retention policy documented
      ([`docs/DATA_RETENTION.md`](docs/DATA_RETENTION.md)).
- [ ] Backend-only hardening tracked and actionable for the operator
      ([`docs/SERVER_SECURITY_ACTIONS.md`](docs/SERVER_SECURITY_ACTIONS.md)).
