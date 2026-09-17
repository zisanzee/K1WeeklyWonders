import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ---------------------------------------------------------------------------
// NO SERVICE WORKER. This is deliberate — please read before re-adding one.
//
// `vite-plugin-pwa` used to precache the whole build: 65 files / ~3.0 MB,
// downloaded eagerly on every service-worker install *and update*. That
// included things most visitors never touch — the jsPDF/html2canvas badge
// exporter (613 KB combined), the background music (388 KB) and the brand
// logos (187 KB). A hard reload triggers the update check, so the browser
// re-downloaded all of it every time: that was the "loads super slow on
// Ctrl+Shift+R" symptom.
//
// It also caused a worse, intermittent failure. A worker precaching a
// build-specific `index-<hash>.js` keeps serving that filename from its cache.
// When a new deploy replaced it, devices that still had the old worker went
// into a state where the shell could not boot — a permanent loading screen
// that clearing the browser cache did NOT fix, because the worker and its
// caches are a separate store that survives it. That is what made the site
// appear "broken on Firefox, stale on Chrome". Only unregistering the worker
// rescued those devices.
//
// The cost of removing it is losing offline play. That is a far smaller
// problem than either of the above.
//
// Removing the worker does NOT automatically make repeat loads cheap, because
// Netlify's default header is `max-age=0, must-revalidate` for everything —
// so without a worker the browser revalidated all ~69 build files on every
// navigation. `public/_headers` now marks `/assets/*` immutable (safe: Vite
// content-hashes those filenames) and gives `/PhaserAssets/*` a week.
//
// `public/sw.js` is a self-destructing worker kept only to evict the old
// registration from devices that still have it — see that file. Nothing in
// the app calls register(); the browser's own service-worker update check
// refetches that URL on navigation, and the copy it finds deletes its caches
// and unregisters itself. That keeps the cleanup off the critical path and
// avoids installing a worker on devices that never had one.
//
// If offline support is ever wanted back:
//   - precache ONLY `index.html` and the entry chunk, never the game chunks,
//     the badge exporter, the music or the logos;
//   - use `registerType: 'prompt'` with an explicit in-app update button, so
//     a new worker never seizes control mid-session;
//   - never call `location.reload()` from a worker lifecycle event. A reload
//     reconstructs the page, so any "already reloaded" guard resets and the
//     page can reload forever.
// ---------------------------------------------------------------------------
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // SPA fallback — lets direct URL access to /p/:code work in dev and
  // preview by serving index.html for any path the router handles.
  appType: "spa",

  build: {
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
