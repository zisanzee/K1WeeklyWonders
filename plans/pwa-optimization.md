# Making EZ Wonders "fully PWA optimized"

## Where the project stands today

Already done (do not redo):

- `public/site.webmanifest` exists and is linked from `index.html:111`. Has name,
  `theme_color`, `background_color`, `display: standalone`, 48/96/192/512 icons.
- Icon set generated (favicons, `apple-touch-icon.png`, `android-chrome-*`).
- `public/_headers` gives `/assets/*` a year `immutable`, `/PhaserAssets/*` and
  `/game-icons/*` a week. This is the correct cache policy and is *independent*
  of the service worker.
- `public/_redirects` SPA fallback.
- Code-splitting: Phaser is its own chunk (`vite.config.js`), every game is
  `lazy()` in `main.jsx`.
- HTTPS on Netlify (a hard installability requirement).

Deliberately absent:

- **There is no service worker.** `public/sw.js` is a self-destructing kill
  switch that evicts the old `vite-plugin-pwa` registration. `vite.config.js`
  documents why at length: full precache re-downloaded ~3MB on every install and
  update, and a build-specific precached `index-<hash>.js` left devices serving a
  dead shell that clearing site data did not fix.
- No install prompt (`beforeinstallprompt`), no iOS A2HS guidance.
- No offline fallback, no update-available UI.
- `vite-plugin-pwa` is still in `devDependencies` but unused.

The tension: **installability requires a service worker with a fetch handler, but
this repo deliberately removed one.** The whole plan below is "get back the PWA
features *without* re-triggering the two failures in that comment."

---

## 1. Reintroduce a service worker — minimally (the core step)

This is the only change that is strictly *required* to be installable. The
`vite.config.js` comment already prescribes the safe shape:

- `registerType: 'prompt'` — never auto-`skipWaiting`, so a new worker can't
  seize control mid-lesson.
- **Precache only the shell**: `index.html` + the entry `index-*.js`/`*.css`.
  Do NOT precache Phaser, game chunks, the jsPDF/html-to-image badge exporter,
  `PhaserAssets` audio, or brand logos.
- Runtime-cache the heavy stuff **on first real use** (`CacheFirst`, so the
  second play is instant) with a size cap so it can't grow unbounded.
- Never call `location.reload()` from an install/activate handler — a reload
  resets any "already reloaded" guard and can loop forever.
- `manifest: false` — `VitePWA` must not emit a second manifest; the
  hand-maintained `public/site.webmanifest` stays the single source.
- `devOptions.enabled: false` — a stale dev SW once masked the module graph.
- **Retire the kill switch at the same time.** `public/sw.js` and the generated
  worker want the same path. Decide explicitly: either let the generated worker
  overwrite it (correct once the fleet is felt to be clean) or keep the kill
  switch at a different path. Do not ship both fighting over `/sw.js`.

### Critical integration hazard

`src/staleChunkRecovery.js:31` `hardReload()` calls
`getRegistrations()` and **unregisters every service worker**, then deletes all
caches. That was correct when there was no legitimate worker; it will now
destroy the PWA worker and its cache on every stale-chunk recovery. This must be
rewritten before the worker ships — either target only a legacy registration, or
drop the unregister step and instead let the update prompt handle a new worker.

---

## 2. Manifest completeness

`public/site.webmanifest` is valid but sparse. For a "fully optimized" (rich
install, correct identity) manifest add:

- `"id": "/"` — stable identity. Without it, a future `start_url` change creates
  a *duplicate* install instead of updating.
- `"display_override": ["standalone", "minimal-ui"]`.
- `"orientation": "any"` — the app runs in landscape for Phaser games
  (`RotateHint.jsx` exists), so a locked orientation would be wrong.
- **Split the maskable icon.** The 512 currently says
  `"purpose": "any maskable"`. Android mask-crops it, so unless the art sits
  inside the ~80% safe zone it loses edges. Provide a separate maskable 512 with
  deliberate padding, and keep a clean `"any"` 512.
- `"screenshots": [...]` (one narrow, one wide) — unlocks the richer Android
  install dialog and required for some desktop install UI.
- `"shortcuts": [...]` — e.g. "Open EZ Wonders" (`/`) and "Teacher onboarding"
  (`/teacher-onboarding`). Do NOT shortcut to a game route (opaque `/47182`
  etc.), and not to `/p/:code` (private).
- `"launch_handler": { "client_mode": "navigate-existing" }` — re-launching the
  installed app focuses the existing window instead of opening duplicates. Good
  for a shared classroom tablet.
- `"prefer_related_applications": false`.
- `"categories": ["education", "kids", "games"]` already present.

---

## 3. `index.html` head additions

iOS and some Android install paths read these instead of / in addition to the
manifest:

- `<meta name="mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="EZ Wonders">`
- Split `theme-color` by scheme:
  `<meta name="theme-color" media="(prefers-color-scheme: light)" ...>` and a
  dark variant, instead of the single tag at `index.html:73`.
- Optional for polish: `apple-touch-startup-image` splash links for the common
  iPhone/iPad resolutions. These are per-device and verbose; only worth it if
  iOS installs are a real audience.

---

## 4. Install experience (A2HS)

- Capture `beforeinstallprompt` at module scope into a small store, `preventDefault()`
  it, and expose an `InstallButton` that calls the saved `prompt()`.
- **iOS Safari never fires `beforeinstallprompt`.** Detect
  `navigator.standalone === false` + iOS UA and show a "tap Share → Add to Home
  Screen" hint instead of a button.
- Hide the button when already installed: match
  `window.matchMedia('(display-mode: standalone)')`.
- Place it on `BetaHome.jsx` (and optionally `PublicLanding.jsx`) — one shared
  component, one store, per the project's "one store per domain" convention.

---

## 5. Offline UX

Precaching gives an offline *shell*; that is not the same as a usable offline
app:

- Add an offline fallback route/page and precache it, so a navigation with no
  network lands on something branded rather than the browser error page.
- Add a lightweight "You're offline" banner driven by `online`/`offline` events.
- **Do not cache the API.** `AuthBootstrap` blocks the whole render on
  `hydrate()` (`main.jsx:94`), and maintenance mode is polled live
  (`systemConfig.js`). A cached auth/maintenance response would sign a student
  into a stale class or hide a live maintenance lockout. At most, cache
  `GET /api/game-access` network-first so the last-known game list renders
  offline — and only if that is explicitly wanted.
- Because `AuthBootstrap` gates render, offline boot will show the branded loader
  and then need to resolve to *something*. Decide the offline-boot behaviour
  deliberately (e.g. cached identity → home with an offline banner).

---

## 6. Update flow — "prompt" registerType (IMPLEMENTED)

Because this project deploys often, the update model is the part that matters
most. The chosen model, end to end:

1. **Periodic check.** The browser only checks for a new worker on navigation
   by default, so an open tab would play yesterday's build for hours.
   `src/pwa.js` polls `registration.update()` **hourly, foreground-only**
   (`document.visibilityState === 'visible'`) and again on every return to the
   tab. Hidden-only would miss a tab that is reopened; never checking would let
   a stale tab linger.
2. **No mid-game takeover.** The new worker installs and precaches the new
   shell, then sits in `waiting`. `skipWaiting` is deliberately **left off**, so
   the old worker keeps serving a self-consistent old build — in-flight games
   finish on the build they started on.
3. **Prompt.** `waiting` → `onNeedRefresh` → the toast in `src/PwaBadges.jsx`
   ("An update is ready. Safe to finish your round first.").
4. **Apply.** `applyUpdate()` → `updateSW(true)` → `messageSkipWaiting()` → the
   generated worker calls `self.skipWaiting()` (verified present in `dist/sw.js`)
   → `clientsClaim` makes it control the page → the library reloads on
   `controlling`. We never call `location.reload()` ourselves.
5. **Backstop.** `staleChunkRecovery.js` handles the one window the model cannot
   cover: a chunk fetched for the first time between deploy and acceptance. It
   promotes the new worker and **waits for `controllerchange` before reloading**
   — reloading first would let the old worker re-serve the stale shell and the
   same chunk would fail again. The 60s cooldown bounds a genuinely missing
   chunk.
6. **Cache hygiene.** `cleanupOutdatedCaches` deletes the previous build's
   precache on every activation, so precaches do not accumulate across the many
   deploys; the runtime caches (`ezw-assets`, `ezw-phaser-assets`,
   `ezw-game-icons`, `ezw-google-fonts`) are all bounded by `ExpirationPlugin`.

---

## 7. Headers / deployment

- Add an explicit `/sw.js` entry in `public/_headers` with
  `Cache-Control: no-cache` (must revalidate) — a year-cached worker would pin
  old behaviour. Netlify's default already revalidates, but be explicit.
- Add `Service-Worker-Allowed: /` only if the worker's scope must exceed its
  directory.
- Confirm the manifest is served as `application/manifest+json` and is not
  long-cached (it changes when icons/identity change).
- Keep `/index.html` at `must-revalidate` (already in `_headers:56`).

---

## 8. Verify / test

- DevTools → Application → Manifest: no errors, icons resolve, maskable
  previews correctly cropped.
- DevTools → Application → Service Workers: registration scope, precache list is
  *small* (shell only), update prompt appears on a new build.
- Lighthouse PWA/installability audit passes.
- Offline test: toggle offline, reload — branded shell, no infinite spinner.
- Install test on real Android Chrome **and** iOS Safari (iOS is the strict
  one); verify `display: standalone` and that the status bar reads correctly.
- Re-confirm the two original regressions stay fixed: (a) a fresh install does
  NOT re-download Phaser/music/logos, and (b) a hard reload across a deploy does
  not serve a dead shell.

---

## 9. Housekeeping

- `vite-plugin-pwa` is currently an unused `devDependency`. Either use it (this
  plan) or remove it; leaving it installed-but-unused is how it gets silently
  re-enabled later.
- Update the long `vite.config.js` comment — its "NO SERVICE WORKER" preamble
  becomes the rationale for a *minimal* worker, not for having none. Leaving it
  as-is would make the next engineer think the worker was never intentionally
  re-added.

---

## Suggested order

1. Rewrite `staleChunkRecovery.js` so it stops unregistering a legitimate worker
   (prerequisite — nothing else is safe until this lands).
2. Reintroduce the minimal Workbox config in `vite.config.js`; retire the kill
   switch.
3. Enrich `site.webmanifest` + `index.html` head tags + split maskable icon.
4. Add the install-prompt component + iOS hint.
5. Add offline fallback + offline banner + update toast.
6. Add `/sw.js` header, then run the verification checklist above.

Steps 1–3 are the substance; 4–6 are the difference between "installable" and
"fully optimized".
