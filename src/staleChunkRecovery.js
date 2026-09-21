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
// The normal path AVOIDS this entirely: registerType 'prompt' means the old
// worker keeps serving a self-consistent old build until the user accepts the
// update (see src/pwa.js and vite.config.js). This module is only the backstop
// for the moments that model cannot cover — a chunk fetched for the first time
// in the window between a deploy and the user accepting it.

// Matches every phrasing the browsers actually produce for this class of fault.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error) {
  return CHUNK_ERROR_RE.test(String(error?.message || error || ''));
}

// Resolves when the service worker controlling this page changes, or when the
// timeout elapses — whichever comes first. `controllerchange` is what tells us
// the promoted worker has taken over, i.e. the next navigation will be served
// the NEW build's shell instead of the cached stale one. The timeout is a hard
// floor so a worker that never activates cannot leave the user stuck on the
// error screen (a reload that fetches the old shell is still no worse than not
// reloading at all).
function waitForControllerChange(timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener?.('controllerchange', finish);
      resolve();
    };
    try {
      navigator.serviceWorker.addEventListener('controllerchange', finish);
    } catch {
      finish();
      return;
    }
    setTimeout(finish, timeoutMs);
  });
}

// Reloads the app onto the current deploy.
//
// WHY THIS NO LONGER UNREGISTERS EVERY SERVICE WORKER (it used to):
// while the project shipped no worker, blowing away any registration it found
// was the only way to evict the retired vite-plugin-pwa worker. The project now
// ships a LEGITIMATE minimal worker (see vite.config.js): the shell precache and
// the runtime-cached game art are exactly what makes the site installable and
// work offline. Unregistering it here would delete all of that on the first
// stale-chunk blip.
//
// Rather than destroy the worker, this PROMOTES it:
//   1. If a worker is already waiting (the common case — the update toast was
//      just ignored), tell it to take over.
//   2. Otherwise force an update check and poll briefly for a worker that has
//      just installed and moved to `waiting`, then tell that one to take over.
//   3. Wait until a worker actually controls the page before reloading. This is
//      the important part: reloading first would let the OLD worker re-serve
//      its cached stale index.html, and the same chunk would fail again.
export async function hardReload() {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      // Only workers that actually control pages are relevant here.
      const controlling = registrations.filter((r) => r.active);

      let promoted = false;

      // 1. An already-waiting worker can take over immediately.
      for (const registration of controlling) {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          promoted = true;
        }
      }

      // 2. Nothing waiting: the new worker may not have been fetched yet, since
      //    the browser only checks on navigation. Force a check, then poll for
      //    it to install and reach the waiting state.
      if (!promoted && controlling.length) {
        await Promise.all(
          controlling.map((r) => r.update?.().catch(() => {}))
        );
        const deadline = Date.now() + 4000;
        while (Date.now() < deadline) {
          let waitingWorker = null;
          for (const registration of controlling) {
            if (registration.waiting) {
              waitingWorker = registration.waiting;
              break;
            }
          }
          if (waitingWorker) {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            promoted = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      // 3. Let the promoted worker claim this page before navigating, so the
      //    reload fetches the new shell. A device with no worker at all skips
      //    straight to the reload, which is a plain network fetch.
      if (promoted) await waitForControllerChange(3000);
    }
  } catch {
    // Best effort on locked-down school browsers / private mode. Fall through
    // to the reload regardless.
  }
  window.location.reload();
}

// Guards against a reload loop. If the chunk is genuinely MISSING rather than
// merely stale — a bad deploy, a blocked request — then reloading will fail
// again, and again. An infinite reload is far worse for a child than one error
// screen, so recovery is attempted at most once per cooldown window; after that
// the caller should show the normal error UI.
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
