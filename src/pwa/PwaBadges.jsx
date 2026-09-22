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
import { memo, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  usePwaStore,
  useInstallOffer,
  useInstallTarget,
  isInstallRoute,
  shouldShowUpdatePrompt,
  applyUpdate,
  promptInstall,
  installGuideFor,
} from '@/pwa/pwa';

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
      {/* pointer-events-none: this strip sits at top-0 and overlaps the teacher
          bar's row when no maintenance ribbon is present. It is purely
          informational with no controls, so it must never swallow a click meant
          for the "Teacher controls" button underneath it. */}
      <div
        // Above the maintenance ribbon (z-120) — an internet outage outranks it.
        className="ezw-pwa-drop pointer-events-none fixed inset-x-0 top-0 z-[130] flex h-8 items-center justify-center gap-2 bg-rose-600 px-3 text-center text-[12px] font-bold text-white sm:text-[13px]"
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
  // An update is waiting. It stays waiting until the page reloads onto the new
  // build, so `needRefresh` is true for the rest of the session — the toast's
  // visibility is additionally gated on the user not having pressed "Later".
  const needRefresh = usePwaStore((s) => s.needRefresh);
  const refreshSnoozed = usePwaStore((s) => s.refreshSnoozed);
  const snoozeRefresh = usePwaStore((s) => s.snoozeRefresh);
  if (!shouldShowUpdatePrompt({ needRefresh, refreshSnoozed })) return null;

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
      {/* "Later" snoozes rather than dismisses. It must NOT clear needRefresh:
          the worker is still waiting, and a later update() check returns a
          byte-identical script so onNeedRefresh would never fire again —
          clearing it would strand the update until the tab was closed. Snoozing
          hides the toast now and brings it back on its own (or on returning to
          the tab). */}
      <button
        type="button"
        onClick={() => snoozeRefresh()}
        aria-label="Show the update prompt again later"
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

// A compact, top-right install affordance. ALWAYS MOUNTED at the app root and
// self-gating, so it never remounts on navigation (see the memo note below).
//
// It renders nothing on non-entry routes and once installed, and otherwise does
// exactly one of:
//   - a deferred Chromium prompt is ready → fires the native install dialog
//   - no native prompt → opens a small popover with the guide for THIS device
//     (iOS Share → Add to Home Screen, Firefox menu, or the Edge/Chrome menu)
//
// The popover case is why memo() matters. The component is rendered from the
// persistent AppShell, but the `useInstallTarget` / `useInstallOffer` selectors
// can flip in the middle of a click sequence (the browser may emit
// beforeinstallprompt between the tap and the popover opening). A remount would
// discard the popover's own local state; memo keeps one instance alive so the
// state survives. All the store reads inside are already scoped per-slice, so
// memo does not wrongly freeze the offer/target values.
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

export const InstallButton = memo(function InstallButton() {
  const { pathname } = useLocation();
  const offer = useInstallOffer();
  // 'native' | 'ios' | 'firefox' | 'chromium' — decides the label, whether the
  // click fires the native dialog, and which guide the popover shows.
  const target = useInstallTarget();
  const promptReady = target === 'native';
  // Manual guide popover. Local state is safe to keep here because memo() keeps
  // this one instance mounted for the app's lifetime.
  const [showSteps, setShowSteps] = useState(false);
  // The guide is platform-static, so compute it once per target change (not per
  // render) to keep the steps array identity stable.
  const guide = useMemo(() => installGuideFor(target), [target]);

  // Escape closes the manual popover — it is a lightweight disclosure, not a
  // focus trap, but a keyboard user still needs a way out without hunting for
  // the button again.
  useEffect(() => {
    if (!showSteps) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setShowSteps(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSteps]);

  // Deriving (rather than an effect) means a native prompt arriving closes the
  // stale manual steps on the very next render — no setState-in-effect, and no
  // window where both the native dialog and the old instructions are live.
  const stepsOpen = showSteps && !promptReady;

  // Self-hiding on non-entry routes and once installed. `offer` is true whenever
  // the app can be installed here at all (see shouldOfferInstall); the target
  // only chooses WHICH action the button performs, not whether it renders.
  if (!offer || !isInstallRoute(pathname)) return null;

  const handleClick = () => {
    if (promptReady) {
      promptInstall();
      return;
    }
    setShowSteps((open) => !open);
  };

  // LAYOUT: mirrors the teacher nav bar in BetaHome.jsx — same fixed full-width
  // bar, same `mx-auto max-w-4xl px-3 py-3 sm:px-6` container, same button
  // padding/ring — but justified to the END. That puts it on the opposite side
  // of the screen from the "Teacher controls" button while keeping the two on
  // the same horizontal line and content edge (a plain `right-3` would not
  // align with the bar's max-w-4xl grid).
  //
  // `pointer-events-none` on the wrapper is LOAD-BEARING. This bar is
  // full-width and sits at z-[115], ABOVE the teacher bar (z-50). Without it,
  // the (invisible) empty space of this overlay swallowed clicks across the
  // whole header — the "Teacher controls" button on the left stopped working
  // entirely. The container stays full-width so it aligns, but only the button
  // (and the popover) re-enable pointer events, so every other pixel passes
  // clicks through.
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 z-[115]"
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
        {/* relative: anchors the manual-instructions popover under the button. */}
        <div className="relative">
          <button
            type="button"
            onClick={handleClick}
            aria-label={
              promptReady ? 'Install EZ Wonders' : 'How to install EZ Wonders'
            }
            // Only an expand/collapse disclosure when the popover is the action.
            aria-expanded={promptReady ? undefined : stepsOpen}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-black text-violet-700 shadow-md ring-2 ring-white/70 backdrop-blur transition hover:-translate-y-0.5 active:translate-y-0 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base sm:shadow-xl sm:ring-4"
          >
            <span aria-hidden="true" className="text-base sm:text-lg">
              {INSTALL_ICON}
            </span>
            {promptReady ? 'Install app' : 'How to install'}
          </button>

          {stepsOpen && (
            <div
              role="dialog"
              aria-label="How to install EZ Wonders"
              className="pointer-events-auto absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/95 p-3 text-left text-[12px] leading-snug text-white shadow-2xl ring-1 ring-white/15 backdrop-blur"
            >
              <p className="mb-1.5 font-black">{guide.title}</p>
              <ol className="list-decimal space-y-1 pl-4">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {guide.note && (
                <p className="mt-2 text-white/60">{guide.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
