import { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { HelmetProvider } from "react-helmet-async";
import { warmupSpeech } from "./Phaser/common/speech";
import RotateHint from "./RotateHint";
import MaintenanceGate from "./MaintenanceGate";

// Prime the TTS engine immediately so every game's first utterance plays
// with zero delay — by the time the player taps a game tile, the
// speechSynthesis engine is already initialised and voice-loaded.
warmupSpeech();

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

function GameLoading() {
  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8]">
      <style>{`
        @keyframes loader-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.92) translateY(0); }
          50% { opacity: 1; transform: scale(1) translateY(-6px); }
        }
        .loader-pulse { animation: loader-pulse 1.3s ease-in-out infinite; }
      `}</style>

      <span className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-white/70 border-t-transparent" />
        <span className="loader-pulse text-5xl drop-shadow-[0_3px_0_rgba(0,0,0,0.12)]">🎈</span>
      </span>

      <p
        className="mt-5 text-xl font-black text-white drop-shadow-sm sm:text-2xl"
        style={{ fontFamily: "'Fredoka', sans-serif" }}
      >
        Loading…
      </p>
      <p
        className="mt-1 text-sm font-bold text-white/85 sm:text-base"
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        Setting everything up for you!
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <BrowserRouter>
      <RotateHint />
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
    </BrowserRouter>
  </HelmetProvider>
);
