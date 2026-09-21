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
// InstallButton is the one install affordance. It is exported separately and
// rendered by main.jsx. It self-hides unless the browser can install natively
// right now and the route is an entry surface (not inside a game).
//
// DELIBERATELY DEPENDENCY-FREE. This component is rendered from the entry
// graph (main.jsx), so importing `motion` here would pull ~100KB of animation
// runtime into the first-paint bundle that the whole platform works to keep
// small. The entrance motion is a few lines of CSS instead.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  usePwaStore,
  useInstallOffer,
  isInstallRoute,
  applyUpdate,
  promptInstall,
} from './pwa';

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

// A compact, top-right install affordance.
//
// It renders NOTHING unless the browser can install natively right now:
//   - already installed (standalone, or a recorded install) → hidden
//   - Chromium with a deferred prompt ready → a button that fires it
//   - Safari / Firefox / any browser without beforeinstallprompt → hidden
//   - Chromium that supports it but has not granted it yet → hidden
// That last case is deliberate. A visible-but-dead "Install" button is worse
// than none; useInstallOffer() is true only when the button will do something.
const INSTALL_ICON = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v11" />
    <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </svg>
);

export function InstallButton() {
  const { pathname } = useLocation();
  const offer = useInstallOffer();

  // Self-hiding: `offer` is true only when the browser can install natively and
  // a prompt is ready. No local state is needed — the component unmounts on
  // navigation and renders null once the app is installed or the prompt is
  // consumed.
  if (!offer || !isInstallRoute(pathname)) return null;

  // LAYOUT: this mirrors the teacher nav bar in BetaHome.jsx EXACTLY — same
  // fixed full-width bar, same `mx-auto max-w-4xl px-3 py-3 sm:px-6` container,
  // same button padding/ring — but justified to the END. That puts it on the
  // opposite side of the screen from the "Teacher controls" button while
  // keeping the two buttons on the same horizontal line and the same content
  // edge (a plain `right-3` would not have lined up with the bar's grid).
  return (
    <div
      className="fixed left-0 right-0 z-[115]"
      style={{
        // Same offset the teacher bar uses, plus the phone status bar when
        // running installed. The bar itself is not rendered for non-teachers,
        // but the maths is identical, so the two always share a baseline.
        top:
          'calc(var(--maint-banner-h, 0px) + env(safe-area-inset-top, 0px))',
        fontFamily: "'Fredoka', system-ui, sans-serif",
      }}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center justify-end px-3 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => promptInstall()}
          aria-label="Install EZ Wonders"
          className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-black text-violet-700 shadow-md ring-2 ring-white/70 backdrop-blur transition hover:-translate-y-0.5 active:translate-y-0 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base sm:shadow-xl sm:ring-4"
        >
          <span aria-hidden="true" className="text-base sm:text-lg">
            {INSTALL_ICON}
          </span>
          Install app
        </button>
      </div>
    </div>
  );
}
