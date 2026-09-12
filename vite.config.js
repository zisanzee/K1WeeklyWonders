import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
            urlPattern: /\/PhaserAssets\/.*\.(?:m4a|wav|mp3|png|jpg|jpeg|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "ezw-phaser-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Brand/font art is similarly static.
            urlPattern: /\.(?:png|svg|woff2?)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ezw-static-images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
