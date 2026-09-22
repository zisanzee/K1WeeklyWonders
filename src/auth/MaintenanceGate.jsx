import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePlayerStore } from '@/auth/playerStore';
import { useSystemConfigStore, startSystemConfigPolling } from '@/api/systemConfig';
import { ICON_URL } from '@/ui/brand';
import ContactStrip from '@/ui/ContactStrip';

// Routes that must render normally even while maintenance mode is ON, and
// regardless of whether anyone is signed in. The teacher guide is documentation
// — it explains how to sign in, so it is useless precisely when it is most
// likely to be needed (a locked-out teacher during an outage). It is read-only
// and reaches nothing privileged, so there is nothing to protect here.
const PUBLIC_DURING_MAINTENANCE = new Set(['/teacher-onboarding']);

// Game routes paint their own top-of-screen chrome inside the canvas, so the
// staff ribbon would sit over it. It is hidden there — the warning is still on
// the home and panel surfaces, where staff actually arrange things, so nothing
// is lost. Covers the opaque 5-digit game codes plus the legacy aliases.
const GAME_ROUTE_RE = /^\/(\d{5}|game\d+|bonus-game\d+)$/;

// Height of the staff maintenance ribbon. Exposed to descendants as the
// `--maint-banner-h` CSS variable so fixed/sticky top bars can offset
// themselves instead of being covered by it. Slim by design: this is an
// advisory strip for staff, not a content block, so it costs as little of the
// screen as it can while staying legible on a phone.
const BANNER_HEIGHT = '1.75rem';

// Counts down to an optional scheduled maintenance end time. Returns null when
// there is no end time or it has already passed.
function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return null;

  const total = Math.floor(diff / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`;
}

// Sits above every route. When maintenance mode is ON:
//  - teachers/admins see the app normally (plus a small amber ribbon that
//    occupies its own space rather than covering the UI),
//  - routes in PUBLIC_DURING_MAINTENANCE render normally for everyone,
//  - EVERYONE else — including visitors who haven't logged in yet — sees the
//    full-screen maintenance page, which also offers a teacher/admin sign-in.
export default function MaintenanceGate({ children }) {
  const { pathname } = useLocation();
  const identityKind = usePlayerStore((state) => state.identityKind);
  const isTeacher = usePlayerStore((state) => state.isTeacher);
  const isAdmin = usePlayerStore((state) => state.isAdmin);

  const maintenanceMode = useSystemConfigStore((state) => state.maintenanceMode);
  const maintenanceMessage = useSystemConfigStore((state) => state.maintenanceMessage);
  const maintenanceEndsAt = useSystemConfigStore((state) => state.maintenanceEndsAt);

  const [staffLoginOpen, setStaffLoginOpen] = useState(false);

  // The initial fetch already fired at module scope (see main.jsx) so it could
  // race the auth hydrate. This call is just to own the polling interval; it is
  // idempotent, so the duplicate initial fetch is skipped rather than wasteful.
  useEffect(() => {
    startSystemConfigPolling();
  }, []);

  const staff =
    isTeacher || isAdmin || identityKind === 'teacher' || identityKind === 'admin';

  // IMPORTANT: useCountdown must be called UNCONDITIONALLY. It used to be
  // `staff ? null : useCountdown(...)`, which skipped the hook for staff — so
  // signing a teacher/admin in or out changed the hook count mid-session and
  // React crashed to a black screen until a manual refresh.
  const countdown = useCountdown(staff ? null : maintenanceEndsAt);

  const isPublicRoute = PUBLIC_DURING_MAINTENANCE.has(pathname);
  const isGameRoute = GAME_ROUTE_RE.test(pathname);

  // Hidden on game routes (see GAME_ROUTE_RE). Used for BOTH the ribbon and the
  // reserved padding, so when it is hidden the page reclaims the space instead
  // of leaving a gap where the ribbon would have been.
  const showBanner = staff && maintenanceMode && !isGameRoute;
  const showOverlay =
    maintenanceMode && !staff && !staffLoginOpen && !isPublicRoute;
  const heading = maintenanceMessage?.trim()
    ? maintenanceMessage.trim()
    : 'EZ Wonders is under maintenance';

  return (
    <div
      style={{
        // Descendants (sticky/fixed headers) offset by this so the ribbon never
        // sits on top of buttons. Padding reserves the space for normal flow.
        '--maint-banner-h': showBanner ? BANNER_HEIGHT : '0px',
        paddingTop: showBanner ? BANNER_HEIGHT : undefined,
      }}
    >
      {showBanner && (
        <>
          {/* Invisible click-through: a fixed overlay must never intercept a tap
              meant for something behind it. This strip carries no controls. */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-7 bg-amber-400"
          />
          <div
            role="status"
            className="pointer-events-none fixed inset-x-0 top-0 z-[121] flex h-7 items-center justify-center gap-1.5 px-3 text-center text-[11px] font-bold text-amber-950 sm:text-[12px]"
          >
            <span aria-hidden="true">⚠</span>
            <span className="truncate">Maintenance mode on</span>
            <span className="hidden shrink-0 font-semibold opacity-70 sm:inline">
              · students see a maintenance screen
            </span>
          </div>
        </>
      )}

      {showOverlay ? (
        <main className="aura-page relative flex min-h-[100dvh] flex-col items-center overflow-x-hidden px-5 py-8">
          {/* Ambient background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
            <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl" />
            <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
            <span className="absolute left-[8%] top-[14%] text-3xl opacity-70 sm:text-4xl">
              ⚙️
            </span>
            <span className="absolute right-[10%] top-[22%] text-2xl opacity-70 sm:text-3xl">
              ✨
            </span>
            <span className="absolute bottom-[12%] left-[12%] text-3xl opacity-60 sm:text-4xl">
              🔧
            </span>
          </div>

          {/* my-auto rather than justify-center: centred when there is room to
              spare, top-aligned (and therefore scrollable-to) when there is
              not. `overflow-hidden` on <main> used to clip the bottom of this
              card with no way to reach it, since html/body never scroll. */}
          <motion.section
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            className="aura-panel relative z-10 my-auto w-full max-w-md overflow-hidden rounded-[2rem] px-6 py-8 text-center sm:px-8 sm:py-10"
          >
            {/* Brand row */}
            <div className="flex items-center justify-center gap-2">
              <img
                src={ICON_URL}
                alt="EZ Wonders"
                className="h-9 w-9 rounded-xl shadow-sm"
              />
              <span className="text-[11px] font-black uppercase tracking-[0.24em] text-white/80">
                EZ Wonders
              </span>
            </div>

            {/* Pulsing tool badge */}
            <motion.div
              animate={{ y: [0, -5, 0], rotate: [-3, 3, -3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] text-4xl shadow-lg ring-4 ring-white/30"
              style={{
                background:
                  'linear-gradient(135deg, #fde68a 0%, #f59e0b 55%, #f97316 100%)',
              }}
            >
              🔧
            </motion.div>

            <h1 className="mt-6 text-2xl font-black leading-tight text-white sm:text-3xl">
              {heading}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-base font-bold text-white/85">
              We&rsquo;re making things even more wonderful. Come back later!
            </p>

            {countdown && (
              <motion.p
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-black text-white"
              >
                <span aria-hidden="true">⏳</span> Back in {countdown}
              </motion.p>
            )}

            {/* Divider */}
            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/20" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                Teachers & admins
              </span>
              <span className="h-px flex-1 bg-white/20" />
            </div>

            <button
              type="button"
              onClick={() => setStaffLoginOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/95 px-5 py-3.5 text-sm font-black text-violet-700 shadow-[0_5px_0_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <span aria-hidden="true">🔑</span> Sign in as teacher / admin
            </button>
            <p className="mt-3 text-[11px] font-semibold text-white/60">
              Students don&rsquo;t need to do anything — just check back soon.
            </p>

            {/* The one place people are most likely to give up and need a human
                — an outage is exactly when this address matters most. */}
            <div className="mt-7 border-t border-white/15 pt-6">
              <ContactStrip
                heading="Need help right now?"
                hint="Email us and we will get back to you as soon as we are back online."
              />
            </div>
          </motion.section>
        </main>
      ) : (
        children
      )}
    </div>
  );
}
