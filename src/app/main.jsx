import { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { HelmetProvider } from "react-helmet-async";
import { warmupSpeech } from "@/phaser/common/speech";
import { recoverFromStaleChunk } from "@/pwa/staleChunkRecovery";
import RotateHint from "@/ui/RotateHint";
import MaintenanceGate from "@/auth/MaintenanceGate";
import BrandLoader from "@/ui/BrandLoader";
import ErrorBoundary from "@/ui/ErrorBoundary";
import RouteSeo from "@/seo/seo";
import { ConfirmHost } from "@/ui/confirmDialog";
import { usePlayerStore } from "@/auth/playerStore";
import { startSystemConfigPolling } from "@/api/systemConfig";
import PwaBadges, { InstallButton } from "@/pwa/PwaBadges";
import { initPwa } from "@/pwa/pwa";
import { GAME_REGISTRY } from "@/games/registry";

// Vite fires `vite:preloadError` when a lazy chunk fails to load, BEFORE React
// ever sees the error — so this is the earliest and most reliable place to catch
// the stale-deploy case (see staleChunkRecovery.js). Waiting for an
// ErrorBoundary alone misses the module-preload path entirely.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    // Stop Vite rethrowing; recovery is handled here.
    event.preventDefault();
    recoverFromStaleChunk();
  });
}

// Registers the (minimal) service worker that makes the app installable and
// offline-capable, and wires up the online/offline and install-prompt listeners.
// Safe to call unconditionally: initPwa() is a no-op outside the browser, and
// the heavy `virtual:pwa-register` runtime is dynamically imported inside it, so
// none of it lands in the first-paint bundle. See src/pwa.js and vite.config.js.
initPwa();

// Fires at module scope, before React has rendered anything, so the maintenance
// config request races the auth hydrate in parallel instead of queueing behind
// it. These two round trips are independent, and running them in sequence used
// to double the wait on every load — worst of all against a cold backend, where
// the second request paid its own share of the wake-up.
startSystemConfigPolling();

// Prime the TTS engine so a game's first utterance plays with no delay — but
// do it at idle time so it never blocks the first paint / loading screen.
// The landing route's chunk is prefetched in the same window: `/` is the route
// almost every visitor starts on, so having BetaHome already downloaded turns
// the Suspense boundary into a no-op instead of a visible second wait.
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(
    () => {
      warmupSpeech();
      import("@/pages/BetaHome").catch(() => {});
    },
    { timeout: 2000 }
  );
} else {
  setTimeout(() => {
    warmupSpeech();
    import("@/pages/BetaHome").catch(() => {});
  }, 300);
}

// Every game is lazy: each one pulls in its own copy of framer-motion / dnd-kit
// / confetti and is 25-30KB+ of JSX alone, so a phone should only download the
// single game it is actually playing.
//
// The game list is NOT declared here. It comes from games/registry.js, so
// adding a game is one registry entry and zero edits to this file. Each
// registry `load` thunk (a dynamic import) is wrapped in lazy().
const GAME_ROUTES = GAME_REGISTRY.map((game) => ({
  key: game.key,
  route: game.route,
  Component: lazy(game.load),
}));

const GameAccessPage = lazy(() => import("@/pages/GameAccessPage"));
const TeacherOnboarding = lazy(() => import("@/pages/TeacherOnboarding"));
const StudentLogin = lazy(() => import("@/pages/StudentLogin"));
const BetaHome = lazy(() => import("@/pages/BetaHome"));

// Single shared loading screen (see BrandLoader.jsx) so every wait — route
// suspense and auth hydration — looks identical to the HTML first-paint loader.
function GameLoading() {
  return <BrandLoader />;
}

// Resolves the stored code into a full identity BEFORE the app renders, so a
// logged-in user never flashes the login screen and a login/logout takes effect
// immediately (no manual refresh). Only the code is stored locally; the rest is
// fetched here from the DB.
function AuthBootstrap({ children }) {
  const hydrate = usePlayerStore((s) => s.hydrate);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(hydrate()).finally(() => {
      if (!cancelled) setBooted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  if (!booted) return <GameLoading />;
  return children;
}

// The router body, extracted so the per-route boundary below can remount it.
// `resetKey` changing forces React to discard the failed subtree and try
// again — without it, "Try again" would re-render the same broken element.
function AppRoutes({ resetKey }) {
  return (
    <>
      <RouteSeo />
      <Suspense fallback={<GameLoading />}>
        <Routes>
          {/* BetaHome is now the real production home at the root path. */}
          <Route path="/" element={<BetaHome />} />
          {/* Keep the old URL working as an alias, but never as the primary. */}
          <Route path="/beta-ezwonders" element={<Navigate to="/" replace />} />
          {/* Game routes, built from games/registry.js — the route, component
              and catalogue entry for a game all come from its single registry
              entry, so this block never changes when a game is added.
              The paths are opaque 5-digit codes so a URL never reveals the game
              number (the on-screen labels still do). */}
          {GAME_ROUTES.map(({ key, route, Component }) => (
            <Route key={key} path={route} element={<Component />} />
          ))}
          {/* Legacy /gameN paths stay as redirects so existing bookmarks and
              printed links keep working instead of hitting the SPA catch-all.
              Derived from the registry, but only for NUMERIC keys — the bonus
              game's key is 'b1', and a naive `/game${key}` would emit a
              nonsense `/gameb1`. Its real historic alias is added explicitly. */}
          {GAME_REGISTRY.flatMap(({ key, route }) => {
            const aliases = /^\d+$/.test(key) ? [`/game${key}`] : [];
            if (key === 'b1') aliases.push('/bonus-game1');
            return aliases.map((path) => (
              <Route key={path} path={path} element={<Navigate to={route} replace />} />
            ));
          })}
          <Route path="/game-access" element={<GameAccessPage />} />
          <Route path="/teacher-onboarding" element={<TeacherOnboarding />} />
          <Route path="/p/:code" element={<StudentLogin />} />
        </Routes>
      </Suspense>
      {/* resetKey is unused inside, but keying the fragment on it is what
          makes the retry actually re-run the lazy imports. */}
      <span key={resetKey} className="hidden" aria-hidden="true" />
    </>
  );
}

// Two boundaries, deliberately:
//  - INNER, around the routes, so a single broken game chunk costs only that
//    page and the surrounding chrome (maintenance gate, rotate hint) survives.
//  - OUTER, around everything, so nothing can ever unmount the whole app and
//    leave a blank screen.
function AppShell() {
  const [retryNonce, setRetryNonce] = useState(0);

  return (
    <ErrorBoundary>
      {/* Offline strip + update/offline-ready toasts. Rendered above everything
          so a route-level crash cannot take the offline indicator with it. */}
      <PwaBadges />
      <RotateHint />
      <ConfirmHost />
      <AuthBootstrap>
        <MaintenanceGate>
          <>
            {/* Install button lives INSIDE the maintenance gate, not out in
                AppShell. The gate's wrapper sets `--maint-banner-h`, which the
                button (like the teacher bar) uses to drop clear of the staff
                ribbon. Rendered outside the gate it inherited nothing, fell
                back to 0px, and sat behind the banner. */}
            <InstallButton />
            <ErrorBoundary
              homeHref="/"
              onDismiss={() => setRetryNonce((n) => n + 1)}
            >
              <AppRoutes resetKey={retryNonce} />
            </ErrorBoundary>
          </>
        </MaintenanceGate>
      </AuthBootstrap>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </HelmetProvider>
);
