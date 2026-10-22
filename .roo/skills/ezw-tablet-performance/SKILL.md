---
name: ezw-tablet-performance
description: Use when an EZ Wonders game or page is slow, janky, crashes on low-end tablets/Chromebooks, loads slowly on school Wi-Fi, has a large bundle, or when optimizing Phaser rendering, memory, chunking, first paint, Render cold starts or service worker caching.
---

# Performance on school hardware

Assume low-end Chromebooks/tablets, cold Wi-Fi, a sleeping Render backend, and 20-30 kids starting a game at the same minute. Measure before optimizing; change one thing at a time.

## Diagnose first
1. Reproduce with Chrome DevTools: Performance tab with CPU throttling 4x-6x and Network "Fast 3G"/"Slow 4G".
2. Classify: slow **load** (bundle, assets, API cold start) vs slow **runtime** (frame drops) vs **memory** (crash/reload on tablets).
3. Check Phaser FPS and draw calls via the debug options used in existing games or DevTools; don't guess.

## Load speed
- Games are `lazy()`-loaded from the registry; keep it that way. Don't statically import a game or Phaser from shared/home code.
- `manualChunks` in `vite.config.js` is a **function** (Vite 8 / rolldown rejects the object form). Don't switch forms.
- Phaser (~1.4 MB) is excluded from precache and cached at runtime on first real play. Don't precache it, don't import it on non-game pages.
- Home grid paints from a localStorage cache (`ezw.gameAccess.v1`) before the Render backend wakes; keep API calls on the shared `apiClient` timeout and never block first render on a new request. Do not add boot-time requests that `AuthBootstrap` would wait for.
- Fonts: Fredoka only, loaded once in `index.html`; no extra font requests.
- `/api/health` keeps Atlas/Render warm; don't call it from every game.

## Phaser runtime
- Keep textures small (GPU memory is the usual crash cause); use atlases to cut draw calls; avoid giant backdrops (see `ezw-game-assets`).
- No per-frame allocations in `update()`; reuse objects, pool particles, cap particle counts.
- Avoid many simultaneous tweens/timers on low-end devices; clean up on scene shutdown.
- Avoid `setBlendMode`/heavy filters/shadows on many objects; prefer pre-rendered art.
- Respect the 2:3 fit box and base resolution from `BaseGame`/`config.js`; don't raise resolution to "look sharper" without measuring.
- Stop update work for off-screen/idle states (e.g. paused between rounds).

## React side
- Memoize expensive lists (stats tables, identity lists); the stats panel is server-paginated with infinite scroll (PAGE_SIZE 50), keep it that way.
- Avoid putting high-frequency state (timers ticking every frame) in zustand stores that many components subscribe to; `NextGameTimer` ticks once per second in its own component only.
- Subscribe with selectors (`useStore(s => s.x)`), not whole-store reads.

## Service worker
- API is never cached (`navigateFallbackDenylist`); DevOptions off in dev. After deploy, `staleChunkRecovery.js` handles stale lazy chunks; if users report "failed to fetch dynamically imported module", check that first.

## Report format
When you optimize, report: baseline number -> after number, what changed, and the device/throttle used. If unmeasured, say so.
