// staleChunkRecovery.js
// Recovery for the one failure that a page left open across a deploy cannot
// survive on its own.
//
// The mechanism: the browsed HTML references the previous deploy's hashed chunk
// filenames. A new deploy ships new hashes, so any lazy import the still-open
// page has not yet made now goes to the network, misses, and fails with
// "Failed to fetch dynamically imported module". It is per-device, because it
// depends on which build that device had loaded — which is why the same teacher
// saw it on her phone and not her laptop.
//
// This still unregisters any service worker it finds, and that is now the main
// reason to keep it: the project no longer ships a worker (see vite.config.js),
// so on a device that still has the old one this is what removes it. A stale
// worker serves its own precached shell and chunks, so without this the page
// would keep requesting dead filenames no matter how many times it was reloaded.
// For a device with no worker this is a complete no-op and it just reloads.

// Matches every phrasing the browsers actually produce for this class of fault.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error) {
  return CHUNK_ERROR_RE.test(String(error?.message || error || ''));
}

// Reloads the app from the network, discarding the service worker and every
// cache first. Every step is best-effort: on a locked-down school browser (or in
// private mode) `caches` and the SW API may be unavailable, and a reload that
// works is strictly better than one that silently does nothing.
export async function hardReload() {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch {
    // Fall through to the reload regardless.
  }
  window.location.reload();
}

// Guards against a reload loop. If the chunk is genuinely MISSING rather than
// merely stale — a bad deploy, a blocked request — then unregistering and
// reloading will fail again, and again. An infinite reload is far worse for a
// child than one error screen, so recovery is attempted at most once per
// cooldown window; after that the caller should show the normal error UI.
const RELOAD_KEY = 'ezw.chunk-reload-at';
const RELOAD_COOLDOWN_MS = 60_000;

export function canAttemptChunkRecovery(now = Date.now()) {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    return now - last >= RELOAD_COOLDOWN_MS;
  } catch {
    // Storage unavailable — permit a single attempt rather than never trying.
    return true;
  }
}

function markChunkRecoveryAttempt(now = Date.now()) {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    /* non-fatal */
  }
}

// The single entry point for both callers (the vite:preloadError listener and
// the ErrorBoundary). Returns true when a recovery was started.
export async function recoverFromStaleChunk() {
  if (!canAttemptChunkRecovery()) return false;
  markChunkRecoveryAttempt();
  await hardReload();
  return true;
}
