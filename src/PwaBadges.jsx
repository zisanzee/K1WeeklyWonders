// PwaBadges.jsx
// Every visible piece of the PWA layer, so the entry point renders one element
// and no game has to care. Three independent affordances:
//
//   - OfflineBanner  — a slim top strip while navigator.onLine is false. A
//                      school tablet drops wifi constantly; this explains why a
//                      spinner is spinning instead of leaving it a mystery.
//   - UpdateToast    — "a new version is ready". Shown because the worker uses
//                      registerType 'prompt', so it waits for the user rather
//                      than swapping the app out from under a child mid-game.
//   - OfflineReady   — a one-off "ready to play offline" confirmation.
//
// InstallPrompt is exported separately and rendered on the home route, not
// globally — offering to install the app on the login screen of every game
// would be noise.
//
// DELIBERATELY DEPENDENCY-FREE. This component is rendered from the entry
// graph (main.jsx), so importing `motion` here would pull ~100KB of animation
// runtime into the first-paint bundle that the whole platform works to keep
// small. The entrance motion is a few lines of CSS instead.
import { useEffect } from 'react';
import { usePwaStore, applyUpdate, promptInstall } from './pwa';

// How long the "ready offline" confirmation lingers before hiding itself.
const OFFLINE_READY_MS = 6000;

// One keyframe set, declared once and injected only while a PWA element is on
// screen. Uses a shared class prefix so it cannot collide with game styles.
const PWA_KEYFRAMES = `
@keyframes ezw-pwa-drop { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes ezw-pwa-rise { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.ezw-pwa-drop { animation: ezw-pwa-drop 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
.ezw-pwa-rise { animation: ezw-pwa-rise 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .ezw-pwa-drop, .ezw-pwa-rise { animation: none; }
}
`;

function PwaStyle() {
  return <style>{PWA_KEYFRAMES}</style>;
}

export function OfflineBanner() {
  const online = usePwaStore((s) => s.online);
  if (online) return null;

  return (
    <>
      <PwaStyle />
      <div
        // Above the maintenance ribbon (z-120) — an internet outage outranks it.
        className="ezw-pwa-drop fixed inset-x-0 top-0 z-[130] flex h-8 items-center justify-center gap-2 bg-rose-600 px-3 text-center text-[12px] font-bold text-white sm:text-[13px]"
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">📴</span>
        <span className="truncate">
          You&rsquo;re offline — games you&rsquo;ve already opened will still play.
        </span>
      </div>
    </>
  );
}

// A shared bottom-centre toast shell so the two messages cannot drift apart.
function BottomToast({ children }) {
  return (
    <>
      <PwaStyle />
      <div
        className="ezw-pwa-rise fixed inset-x-3 bottom-3 z-[130] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
        role="status"
        aria-live="polite"
      >
        {children}
      </div>
    </>
  );
}

export function UpdateToast() {
  const needRefresh = usePwaStore((s) => s.needRefresh);
  const setNeedRefresh = usePwaStore((s) => s.setNeedRefresh);
  if (!needRefresh) return null;

  return (
    <BottomToast>
      <span aria-hidden="true" className="text-xl">
        ✨
      </span>
      <p className="flex-1 text-sm font-bold">
        An update is ready. Safe to finish your round first.
      </p>
      <button
        type="button"
        onClick={() => applyUpdate()}
        className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-black text-violet-700 transition hover:-translate-y-0.5 active:translate-y-0"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update"
        className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/80 transition hover:bg-white/20"
      >
        Later
      </button>
    </BottomToast>
  );
}

export function OfflineReadyToast() {
  const offlineReady = usePwaStore((s) => s.offlineReady);
  const dismiss = usePwaStore((s) => s.dismissOfflineReady);

  // Auto-hide; a confirmation this small should not need dismissing. The
  // timeout is the cleanup's responsibility so an unmount cannot fire it.
  useEffect(() => {
    if (!offlineReady) return undefined;
    const id = setTimeout(dismiss, OFFLINE_READY_MS);
    return () => clearTimeout(id);
  }, [offlineReady, dismiss]);

  if (!offlineReady) return null;

  return (
    <BottomToast>
      <span aria-hidden="true" className="text-xl">
        ✅
      </span>
      <p className="flex-1 text-sm font-bold">
        Ready — EZ Wonders can now open without internet.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/80 transition hover:bg-white/20"
      >
        OK
      </button>
    </BottomToast>
  );
}

// Rendered once at the app root. All three read the shared pwa store, so
// nothing here needs props.
export default function PwaBadges() {
  return (
    <>
      <OfflineBanner />
      <UpdateToast />
      <OfflineReadyToast />
    </>
  );
}

// Shown only on the home route. Two very different paths to the same outcome:
//  - Chromium fires beforeinstallprompt and we show a button that triggers it.
//  - iOS Safari never does, so the user has to use Share → Add to Home Screen.
// In both cases it disappears once the app is running standalone.
export function InstallPrompt() {
  const standalone = usePwaStore((s) => s.standalone);
  const iosInstallable = usePwaStore((s) => s.iosInstallable);
  const installEvent = usePwaStore((s) => s.installEvent);

  if (standalone) return null;
  if (!installEvent && !iosInstallable) return null;

  return (
    <div className="aura-card mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl px-4 py-3">
      <span aria-hidden="true" className="text-2xl">
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white">Install EZ Wonders</p>
        <p className="aura-muted text-xs font-semibold leading-snug">
          {installEvent
            ? 'Add it to your home screen or desktop for one-tap play — no browser needed.'
            : 'Tap Share, then “Add to Home Screen” to keep EZ Wonders one tap away.'}
        </p>
      </div>
      {installEvent && (
        <button
          type="button"
          onClick={() => promptInstall()}
          className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-black text-violet-700 transition hover:-translate-y-0.5 active:translate-y-0"
        >
          Install
        </button>
      )}
    </div>
  );
}
