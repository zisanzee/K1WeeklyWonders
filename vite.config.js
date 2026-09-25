import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// ---------------------------------------------------------------------------
// THE SERVICE WORKER IS DELIBERATELY MINIMAL — read before expanding it.
//
// `vite-plugin-pwa` once precached the WHOLE build: 65 files / ~3.0 MB,
// downloaded eagerly on every install *and update*. That included things most
// visitors never touch — the jsPDF/html2canvas badge exporter (447 KB chunk +
// 613 KB of deps), Phaser (1.4 MB), the background music (388 KB) and the
// brand logos (187 KB). A hard reload triggers the update check, so the browser
// re-downloaded all of it every time: the "loads super slow on Ctrl+Shift+R"
// symptom.
//
// It also caused a worse, intermittent failure. A worker precaching a
// build-specific `index-<hash>.js` keeps serving that filename from its cache.
// When a new deploy replaced it, devices that still had the old worker went
// into a state where the shell could not boot — a permanent loading screen that
// clearing the browser cache did NOT fix, because the worker and its caches are
// a separate store that survives it. Only unregistering the worker rescued
// those devices.
//
// The fix is NOT "no worker" (that costs installability and offline). It is a
// worker that precaches ONLY the app shell and caches everything else on first
// real use:
//   - precache = index.html + the entry JS/CSS + the two vendor chunks the
//     entry imports synchronously (react, rolldown-runtime). Nothing else.
//   - Phaser, the games, the badge exporter and the audio are runtime-cached
//     (CacheFirst) so the SECOND play is instant but nobody downloads them up
//     front. A classroom that never opens a game never downloads a game.
//   - registerType 'prompt' (never auto skipWaiting) so a new worker cannot
//     seize control mid-lesson.
//   - NO API is ever cached. Auth hydrate and maintenance polling are live
//     reads; a cached auth/maintenance response would sign a student into a
//     stale class or hide a live maintenance lockout.
//
// The glob below is deliberately exhaustive rather than a bare `**/*` with
// ignores: an allow-list cannot silently start precaching a new heavy chunk the
// way a deny-list can. If you add a synchronously-imported vendor chunk to the
// entry, add its glob here or offline boot will break.
//
// `public/sw.js` (the old self-destructing kill switch) was REMOVED, because
// the generated worker now owns that exact path. `cleanupOutdatedCaches` makes
// the transition safe for devices that still carry the retired worker: on first
// activation the new worker deletes every stale workbox cache it finds.
//
// DO NOT call `location.reload()` from a worker lifecycle event. A reload
// reconstructs the page, so any "already reloaded" guard resets and the page
// can reload forever. Update handling lives in src/pwa.js instead.
// ---------------------------------------------------------------------------
export default defineConfig({
  // `@` → src, so no import has to count `../` levels, and moving a file
  // between folders never breaks its imports. This is what makes the games/
  // reorganisation surgical: files are grouped by concern without any import
  // churn beyond the one-time codemod. Mirrored in vitest.config.js and
  // jsconfig.json (editor IntelliSense) — all three must agree.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // 'prompt': a new worker waits until the user accepts an in-app update
      // (see src/pwa.js). It never auto-activates mid-session.
      registerType: "prompt",

      // The hand-maintained public/site.webmanifest is the ONLY manifest.
      manifest: false,

      // Registration is owned by src/pwa.js (via the virtual React hook), not
      // injected as a separate <script>. One registration path, not two.
      injectRegister: null,

      workbox: {
        // --- how a deploy reaches an open tab (READ BEFORE CHANGING) ---------
        //
        // This project deploys often, so the update model matters more than the
        // caching. What happens when a push lands while someone is mid-game:
        //
        //   1. The network check fetches the new /sw.js (see the periodic
        //      registration.update() in src/pwa.js). It differs, so the new
        //      worker INSTALLS and PRECACHES the new shell, then moves to
        //      `waiting`. Nothing the user sees changes.
        //   2. `waiting` fires onNeedRefresh -> the "update ready" toast.
        //   3. The user taps Refresh -> messageSkipWaiting() -> the new worker
        //      activates -> clientsClaim makes it control THIS page -> the
        //      updater reloads onto the new build.
        //
        // The point of 'prompt' is step 1: the OLD worker keeps serving the
        // OLD index.html and the OLD (still-runtime-cached) chunks, which are
        // mutually consistent. In-flight games finish on the build they
        // started on. The app is never a mix of old and new code, and nothing
        // reloads itself out from under a child.
        //
        // clientsClaim: the new worker takes over the page the moment it
        // activates, so the reload in step 3 lands on the NEW build instead of
        // waiting for a second navigation.
        clientsClaim: true,

        // Drop stale workbox precaches on activation. This is what makes
        // re-introducing a worker safe for any device still carrying the
        // retired one, AND what stops precaches accumulating across the many
        // deploys: each activation removes the previous build's precache.
        cleanupOutdatedCaches: true,

        // THE WHOLE POINT: shell only. Keep this list tiny.
        globPatterns: [
          "index.html",
          "assets/index-*.js",
          "assets/index-*.css",
          "assets/react-*.js",
          "assets/rolldown-runtime-*.js",
        ],

        // SPA fallback: any in-scope navigation with no network still boots the
        // shell. Cross-origin API calls never reach the worker (scope is
        // same-origin), so this cannot serve a stale API response.
        navigateFallback: "/index.html",

        runtimeCaching: [
          {
            // Every OTHER build chunk (games, Phaser, BetaHome, the badge
            // exporter). These are content-hashed, so CacheFirst is safe: the
            // URL changes whenever the bytes do. This is what makes a game that
            // has been opened once playable OFFLINE — the shell precache alone
            // cannot cover a route chunk the child has not visited yet.
            //
            // Bounded rather than unbounded so a device that plays a dozen games
            // cannot grow its cache without limit; the entries are re-fetched
            // from the network once evicted, which online is a normal request.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-assets",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Phaser game art + audio (public/PhaserAssets/**). Not
            // content-hashed, so this is a bounded TTL rather than immutable.
            // CacheFirst because these bytes are stable across a session and
            // re-fetching them mid-game stutters the canvas.
            urlPattern: ({ url }) => url.pathname.startsWith("/PhaserAssets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-phaser-assets",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Per-game icon art (src/gameIcons.js). Same reasoning as above.
            urlPattern: ({ url }) => url.pathname.startsWith("/game-icons/"),
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-game-icons",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // The Google Fonts stylesheet + font files. Without this an
            // offline boot renders the fallback face and text re-flows.
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // fonts are immutable
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // A stale dev worker once served an outdated module graph and masked
      // real edits. Never generate or register a worker while developing.
      devOptions: { enabled: false },
    }),
  ],

  // SPA fallback — lets direct URL access to /p/:code work in dev and
  // preview by serving index.html for any path the router handles.
  appType: "spa",

  build: {
    // Explicit, even though `false` is the production default: a future Vite
    // change must not silently turn sourcemaps on. This app is static-hosted
    // and its auth credential sits in localStorage, so publishing the original
    // source (and anything embedded in it) is needless exposure — the browser
    // must never be handed readable source for the running bundle.
    sourcemap: false,

    rollupOptions: {
      output: {
        // Split Phaser out of the entry graph. It is the single heaviest
        // dependency (~1.4MB) and is only needed once a game is opened, so
        // giving it its own content-hashed chunk keeps it out of the bundle
        // every visitor downloads and lets it stay cached across deploys.
        //
        // NOTE: this MUST be a function. Vite 8 bundles with rolldown, which
        // only supports the function form — the object form accepted by
        // Rollup throws "manualChunks is not a function" at build time.
        manualChunks(id) {
          // Paths can arrive with either separator depending on platform.
          const path = id.replace(/\\/g, "/");
          if (!path.includes("node_modules/")) return undefined;
          if (path.includes("node_modules/phaser/")) return "phaser";
          return undefined;
        },
      },
    },
  },
});
