import { useEffect, useState } from 'react';
import { usePlayerStore } from './playerStore';
import { useSystemConfigStore, startSystemConfigPolling } from './systemConfig';

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
//  - teachers/admins see the app normally (plus a small amber ribbon),
//  - students (and not-yet-identified visitors) see a full-screen overlay.
// Not-yet-identified visitors also get an "I'm a teacher / admin" escape hatch
// so staff can still reach the login form during maintenance.
export default function MaintenanceGate({ children }) {
  const identityKind = usePlayerStore((state) => state.identityKind);
  const isTeacher = usePlayerStore((state) => state.isTeacher);
  const isAdmin = usePlayerStore((state) => state.isAdmin);

  const maintenanceMode = useSystemConfigStore((state) => state.maintenanceMode);
  const maintenanceMessage = useSystemConfigStore((state) => state.maintenanceMessage);
  const maintenanceEndsAt = useSystemConfigStore((state) => state.maintenanceEndsAt);

  const [escapeHatch, setEscapeHatch] = useState(false);

  useEffect(() => {
    startSystemConfigPolling();
  }, []);

  const staff =
    isTeacher || isAdmin || identityKind === 'teacher' || identityKind === 'admin';

  // IMPORTANT: useCountdown must be called UNCONDITIONALLY. It used to be
  // `staff ? null : useCountdown(...)`, which skipped the hook for staff — so
  // signing a teacher/admin in or out changed the hook count mid-session and
  // React crashed to a black screen until a manual refresh. Passing null simply
  // disables the timer instead.
  const countdown = useCountdown(staff ? null : maintenanceEndsAt);

  const showOverlay = maintenanceMode && !staff && !escapeHatch;

  const heading = maintenanceMessage?.trim()
    ? maintenanceMessage.trim()
    : 'EZ Wonders is under maintenance 🔧';

  return (
    <>
      {staff && maintenanceMode && (
        <div className="sticky top-0 z-[60] w-full bg-amber-400 px-4 py-1.5 text-center text-[13px] font-bold text-amber-950">
          ⚠ Maintenance mode is ON — students see a maintenance screen. Toggle
          off in admin settings.
        </div>
      )}

      {showOverlay ? (
        <main className="aura-page relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div className="pointer-events-none absolute -left-16 top-16 h-48 w-48 rounded-full bg-amber-400/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-12 bottom-6 h-52 w-52 rounded-full bg-violet-500/30 blur-3xl" />

          <div className="aura-panel relative z-10 w-full max-w-md rounded-[2rem] px-7 py-9">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/20 text-4xl">
              🔧
            </div>
            <h1 className="mt-5 text-2xl font-black text-white sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-3 text-base font-bold text-white/85">Come back later!</p>

            {countdown && (
              <p className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-sm font-black text-white">
                Back in {countdown}
              </p>
            )}

            <button
              type="button"
              onClick={() => setEscapeHatch(true)}
              className="aura-soft mt-8 block w-full text-sm font-extrabold transition hover:text-white"
            >
              I&rsquo;m a teacher / admin
            </button>
          </div>
        </main>
      ) : (
        children
      )}
    </>
  );
}
