import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// A value that changes on every deploy, folded into asset URLs at build time so
// unhashed `public/` files (see src/assetVersion.js) get a new cache key each
// release. Netlify/Render/Railway all expose a commit SHA; the timestamp is the
// fallback for local builds. `Date.now()` is here deliberately — this runs in
// the build process, not in the browser, so it is evaluated once per build.
// Read through globalThis rather than a bare `process`: this file is linted with
// the browser-ish default globals, where `process` is undefined.
const env = globalThis.process?.env ?? {};
const BUILD_ID =
  env.COMMIT_REF ||
  env.GITHUB_SHA ||
  env.VERCEL_GIT_COMMIT_SHA ||
  `local-${Date.now()}`;

export default defineConfig({
  // Surfaced to the app as a compile-time constant rather than an env var, so it
  // is inlined into the bundle and can't be missing at runtime.
  define: {
    __EZ_BUILD_ID__: JSON.stringify(BUILD_ID),
  },

  plugins: [
    react(),
    tailwindcss(),

    // Offline-capable service worker. The audience is largely 4-6 year olds on
    // school tablets and shared wifi, replaying the same handful of games — so
    // caching the heavy, rarely-changing assets (Phaser chunks, textures,
    // sound effects) turns repeat plays from "download everything again" into
    // "instant", and keeps them working when the connection drops.
    VitePWA({
      registerType: "autoUpdate",
      // Precaching the full app shell is safe here: it is a small SPA and the
      // point is that a warm visit needs no network at all.
      workbox: {
        // Raised above the 2MiB default so no individual asset is silently
        // skipped.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,m4a,wav,mp3}"],
        // Phaser (~1.4MB, the single largest asset) is deliberately NOT
        // precached. Precaching happens eagerly on service-worker install, so
        // including it would push a multi-megabyte background download onto
        // every visitor — including a phone on cellular who opens the landing
        // page and leaves. Instead it is cached at runtime the first time a
        // child actually opens a game (see runtimeCaching below), which still
        // gives instant, offline-capable repeat plays for the kids who
        // genuinely use it.
        globIgnores: ["**/phaser-*.js"],
        // The API is deliberately NOT cached: play results and unlock state
        // must always be live, and a stale cached 5xx is exactly the failure
        // the server's own `Cache-Control: no-store` exists to prevent.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // The Phaser engine chunk, cached the first time any game is
            // opened. CacheFirst is safe because the filename is content
            // hashed — a new build produces a new URL, so a cache hit can
            // never serve stale code.
            urlPattern: /\/assets\/phaser-[^/]+\.js$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-phaser-engine",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            // Game art/audio are immutable per deploy and identical across
            // users — ideal cache-first candidates.
            //
            // The trailing `(?:[?#].*)?$` is load-bearing: these assets are
            // requested with a `?v=<build id>` cache-buster (src/assetVersion.js),
            // and an anchored `/\.png$/` would fail to match a URL ending in
            // `?v=…` — the rule would silently stop applying and every asset
            // would fall through to an uncached network fetch.
            urlPattern: /\/PhaserAssets\/.*\.(?:m4a|wav|mp3|png|jpg|jpeg|webp)(?:[?#].*)?$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-phaser-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Brand/font art is similarly static.
            urlPattern: /\.(?:png|svg|woff2?)(?:[?#].*)?$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ezw-static-images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // The Cloudinary-hosted game media (every food sprite, monster part,
            // voice clip and hint illustration — the bulk of this game's art).
            //
            // This is the rule whose ABSENCE caused "some users still see the old
            // audio and images": those files were uncached by workbox, so they
            // were served from the browser's own HTTP cache, and Cloudinary
            // serves uploads with a long max-age. Replacing a file keeps its
            // version path, so a device that had fetched it once kept serving its
            // own copy regardless of what was deployed.
            //
            // StaleWhileRevalidate, not CacheFirst: the same `/v1789…/` path is
            // reused for new bytes when a file is re-uploaded, so CacheFirst
            // would pin the old bytes forever.
            //
            // `fetchOptions.cache: 'reload'` is the load-bearing part, and the
            // reason the first version of this fix did not work: workbox's
            // revalidation is an ordinary `fetch()`, which is allowed to answer
            // from the browser's HTTP cache. With Cloudinary's long max-age that
            // means the "fresh" response is the stale bytes, which then get
            // written INTO the workbox cache — turning a transient HTTP-cache
            // problem into a sticky one. Forcing `reload` bypasses the HTTP cache
            // so the revalidation genuinely hits the network.
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\/upload\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              // `-v2` is load-bearing, not cosmetic. The previous version of this
              // rule (no `fetchOptions`) let workbox's revalidation read the
              // browser's HTTP cache, so the STALE bytes were written into the
              // `ezw-cloudinary-media` cache — every affected device now has a
              // poisoned copy that a corrected rule would keep serving, because
              // StaleWhileRevalidate returns the cached response first.
              //
              // Bumping the name abandons that cache entirely and workbox deletes
              // it as outdated, so devices start from a clean one. Without this,
              // the fix would take a second load (or never land, for a user who
              // only opens the game once per session).
              cacheName: "ezw-cloudinary-media-v2",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              fetchOptions: { cache: "reload" },
            },
          },
        ],
      },
      // The manifest already lives in public/site.webmanifest and is linked
      // from index.html — don't let the plugin generate a second one.
      manifest: false,
      // Disabled in dev so the service worker can never serve a stale chunk
      // while developing. (A stale module graph is a mistake we already hit
      // once in this project.)
      devOptions: { enabled: false },
    }),
  ],

  // SPA fallback — lets direct URL access to /p/:code work in dev and
  // preview by serving index.html for any path the router handles.
  appType: "spa",

  build: {
    rollupOptions: {
      output: {
        // Split the two genuinely heavy, route-specific dependencies into
        // their own chunks. Both are already lazy-loaded, so this mainly
        // prevents them being duplicated into multiple game chunks and gives
        // each a stable filename that stays cached across deploys.
        //
        // NOTE: this MUST be a function. Vite 8 bundles with rolldown, which
        // only supports the function form — the object form accepted by
        // Rollup throws "manualChunks is not a function" at build time.
        manualChunks(id) {
          // Paths can arrive with either separator depending on platform.
          const path = id.replace(/\\/g, "/");
          if (!path.includes("node_modules/")) return undefined;
          if (path.includes("node_modules/phaser/")) return "phaser";
          // jsPDF + html-to-image are used ONLY by StudentBadge (the QR badge
          // PNG/PDF export), which most visitors never open.
          if (
            path.includes("node_modules/jspdf/") ||
            path.includes("node_modules/html-to-image/")
          ) {
            return "badge-export";
          }
          return undefined;
        },
      },
    },
  },
});
