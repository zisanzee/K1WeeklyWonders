import { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { HelmetProvider } from "react-helmet-async";
import { warmupSpeech } from "./Phaser/common/speech";
import RotateHint from "./RotateHint";
import MaintenanceGate from "./MaintenanceGate";
import BrandLoader from "./BrandLoader";
import { ConfirmHost } from "./confirmDialog";
import { usePlayerStore } from "./playerStore";

// Prime the TTS engine so a game's first utterance plays with no delay — but
// do it at idle time so it never blocks the first paint / loading screen.
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(() => warmupSpeech(), { timeout: 2000 });
} else {
  setTimeout(warmupSpeech, 300);
}

// Each game pulls in its own copy of framer-motion / dnd-kit / confetti and is
// 25-30KB+ of JSX alone. Lazy-loading means a phone only ever downloads and
// parses the one game it's actually playing, instead of all four up front.
const Game1 = lazy(() => import("./Game1"));
const Game2 = lazy(() => import("./Game2"));
const Game3 = lazy(() => import("./Game3"));
const Game6 = lazy(() => import("./Game6"));
const Game5 = lazy(() => import("./Game5"));
const PhaserDemo = lazy(() => import("./BonusGames/BonusGame1/PhaserDemo"));
const Game4 = lazy(() => import("./BonusGames/Game4/PhaserDemo"));
const Game7 = lazy(() => import("./BonusGames/Game 7/PhaserDemo"));
const Game8 = lazy(() => import("./BonusGames/Game 8/PhaserDemo"));
const Game9 = lazy(() => import("./BonusGames/Game 9/PhaserDemo"));
const GameAccessPage = lazy(() => import("./GameAccessPage"));
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <BrowserRouter>
      <RotateHint />
      <ConfirmHost />
      <AuthBootstrap>
        <MaintenanceGate>
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
            <Route path="/game6" element={<Game6 />} />
            <Route path="/bonus-game1" element={<PhaserDemo />} />
            <Route path="/game-access" element={<GameAccessPage />} />
            <Route path="/p/:code" element={<StudentLogin />} />
            </Routes>
          </Suspense>
        </MaintenanceGate>
      </AuthBootstrap>
    </BrowserRouter>
  </HelmetProvider>
);
