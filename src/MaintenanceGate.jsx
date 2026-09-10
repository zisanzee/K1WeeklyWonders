import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { usePlayerStore } from './playerStore';
import { useSystemConfigStore, startSystemConfigPolling } from './systemConfig';

const LOGO_SRC = '/android-chrome-512x512.png';

// Height of the staff maintenance ribbon. Exposed to descendants as the
// `--maint-banner-h` CSS variable so fixed/sticky top bars can offset
// themselves instead of being covered by it.
const BANNER_HEIGHT = '2rem';

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

// Tiny branded splash shown while the very first maintenance-mode check is in
// flight, so we never flash the app (or the login screen) on top of a
// maintenance lockout.
function BootSplash() {
  return (
    <div className="aura-page flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
      <span className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-white/70 border-t-transparent" />
      <p className="text-sm font-black uppercase tracking-[0.2em] text-white/80">
        EZ Wonders
      </p>
    </div>
  );
}

// Sits above every route. When maintenance mode is ON:
//  - teachers/admins see the app normally (plus a small amber ribbon that
//    occupies its own space rather than covering the UI),
//  - EVERYONE else — including visitors who haven't logged in yet — sees the
//    full-screen maintenance page, which also offers a teacher/admin sign-in.
export default function MaintenanceGate({ children }) {
  const identityKind = usePlayerStore((state) => state.identityKind);
  const isTeacher = usePlayerStore((state) => state.isTeacher);
  const isAdmin = usePlayerStore((state) => state.isAdmin);

  const maintenanceMode = useSystemConfigStore((state) => state.maintenanceMode);
  const maintenanceMessage = useSystemConfigStore((state) => state.maintenanceMessage);
  const maintenanceEndsAt = useSystemConfigStore((state) => state.maintenanceEndsAt);
  const configLoaded = useSystemConfigStore((state) => state.loaded);

  const [staffLoginOpen, setStaffLoginOpen] = useState(false);

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

  if (!configLoaded) return <BootSplash />;

  const showBanner = staff && maintenanceMode;
  const showOverlay = maintenanceMode && !staff && !staffLoginOpen;
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
        <div className="fixed inset-x-0 top-0 z-[120] flex h-8 items-center justify-center gap-1.5 bg-amber-400 px-3 text-center text-[12px] font-bold text-amber-950 sm:text-[13px]">
          <span aria-hidden="true">⚠</span>
          <span className="truncate">
            Maintenance mode is ON — students see a maintenance screen.
          </span>
          <span className="hidden shrink-0 opacity-80 sm:inline">
            Toggle off in admin settings.
          </span>
        </div>
      )}

      {showOverlay ? (
        <main className="aura-page relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5 py-8">
          {/* Ambient background */}
          <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
          <span className="pointer-events-none absolute left-[8%] top-[14%] text-3xl opacity-70 sm:text-4xl">
            ⚙️
          </span>
          <span className="pointer-events-none absolute right-[10%] top-[22%] text-2xl opacity-70 sm:text-3xl">
            ✨
          </span>
          <span className="pointer-events-none absolute bottom-[12%] left-[12%] text-3xl opacity-60 sm:text-4xl">
            🔧
          </span>

          <motion.section
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            className="aura-panel relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] px-6 py-8 text-center sm:px-8 sm:py-10"
          >
            {/* Brand row */}
            <div className="flex items-center justify-center gap-2">
              <img
                src={LOGO_SRC}
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
          </motion.section>
        </main>
      ) : (
        children
      )}
    </div>
  );
}
