import { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Home from "./Home";
import { HelmetProvider } from "react-helmet-async";
import { warmupSpeech } from "./Phaser/common/speech";
import RotateHint from "./RotateHint";

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
          0%, 100% { opacity: 0.35; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1); }
        }
        .loader-pulse { animation: loader-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <span className="loader-pulse text-4xl drop-shadow-[0_2px_0_rgba(0,0,0,0.10)]">🎈</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <BrowserRouter>
      <RotateHint />
      <Suspense fallback={<GameLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/beta-ezwonders" element={<BetaHome />} />
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
    </BrowserRouter>
  </HelmetProvider>
);
