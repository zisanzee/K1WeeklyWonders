import { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { HelmetProvider } from "react-helmet-async";
import { warmupSpeech } from "./Phaser/common/speech";
import RotateHint from "./RotateHint";
import MaintenanceGate from "./MaintenanceGate";
import BrandLoader from "./BrandLoader";
import ErrorBoundary from "./ErrorBoundary";
import RouteSeo from "./seo";
import { ConfirmHost } from "./confirmDialog";
import { usePlayerStore } from "./playerStore";
import { startSystemConfigPolling } from "./systemConfig";

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
      import("./BetaHome").catch(() => {});
    },
    { timeout: 2000 }
  );
} else {
  setTimeout(() => {
    warmupSpeech();
    import("./BetaHome").catch(() => {});
  }, 300);
}

// Each game pulls in its own copy of framer-motion / dnd-kit / confetti and is
// 25-30KB+ of JSX alone. Lazy-loading means a phone only ever downloads and
// parses the one game it's actually playing, instead of all four up front.
const Game1 = lazy(() => import("./Game1"));
const Game2 = lazy(() => import("./Game2"));
const Game3 = lazy(() => import("./Game3"));
const Game6 = lazy(() => import("./Game6"));
const Game5 = lazy(() => import("./Game5"));
const BonusGame1 = lazy(() => import("./BonusGames/BonusGame1/GamePage"));
const Game4 = lazy(() => import("./BonusGames/Game4/GamePage"));
const Game7 = lazy(() => import("./BonusGames/Game 7/GamePage"));
const Game8 = lazy(() => import("./BonusGames/Game 8/GamePage"));
const Game9 = lazy(() => import("./BonusGames/Game 9/GamePage"));
const Game10 = lazy(() => import("./BonusGames/Game 10/GamePage"));
const GameAccessPage = lazy(() => import("./GameAccessPage"));
const TeacherOnboarding = lazy(() => import("./TeacherOnboarding"));
const StudentLogin = lazy(() => import("./StudentLogin"));
const BetaHome = lazy(() => import("./BetaHome"));

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
          <Route path="/game1" element={<Game1 />} />
          <Route path="/game2" element={<Game2 />} />
          <Route path="/game3" element={<Game3 />} />
          <Route path="/game4" element={<Game4 />} />
          <Route path="/game5" element={<Game5 />} />
          <Route path="/game7" element={<Game7 />} />
          <Route path="/game8" element={<Game8 />} />
          <Route path="/game9" element={<Game9 />} />
          <Route path="/game10" element={<Game10 />} />
          <Route path="/game6" element={<Game6 />} />
          <Route path="/bonus-game1" element={<BonusGame1 />} />
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
      <RotateHint />
      <ConfirmHost />
      <AuthBootstrap>
        <MaintenanceGate>
          <ErrorBoundary
            homeHref="/"
            onDismiss={() => setRetryNonce((n) => n + 1)}
          >
            <AppRoutes resetKey={retryNonce} />
          </ErrorBoundary>
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
