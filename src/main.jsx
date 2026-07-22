import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Home from "./Home";
import Game5 from "./Game5";
import { HelmetProvider } from "react-helmet-async";

// Each game pulls in its own copy of framer-motion / dnd-kit / confetti and is
// 25-30KB+ of JSX alone. Lazy-loading means a phone only ever downloads and
// parses the one game it's actually playing, instead of all four up front.
const Game1 = lazy(() => import("./Game1"));
const Game2 = lazy(() => import("./Game2"));
const Game3 = lazy(() => import("./Game3"));
const Game4 = lazy(() => import("./Game4"));
const PhaserDemo = lazy(() => import("./BonusGame1/PhaserDemo"));

function GameLoading() {
  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#FFE9A8]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />
      <style>{`
        @keyframes loader-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-18px) scale(1.05); }
        }
        @keyframes loader-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .loader-emoji { animation: loader-bounce 1s ease-in-out infinite; will-change: transform; }
        .loader-dot { animation: loader-dot 1.2s ease-in-out infinite; }
      `}</style>
      <span className="loader-emoji text-6xl drop-shadow-[0_4px_0_rgba(0,0,0,0.15)] sm:text-7xl">🎈</span>
      <div className="flex items-center gap-2">
        <span className="loader-dot h-3 w-3 rounded-full bg-white/90" style={{ animationDelay: "0s" }} />
        <span className="loader-dot h-3 w-3 rounded-full bg-white/90" style={{ animationDelay: "0.15s" }} />
        <span className="loader-dot h-3 w-3 rounded-full bg-white/90" style={{ animationDelay: "0.3s" }} />
      </div>
      <p className="px-4 text-center font-['Fredoka',sans-serif] text-lg font-bold text-white/95 drop-shadow sm:text-xl">
        Getting the game ready...
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <BrowserRouter>
      <Suspense fallback={<GameLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game1" element={<Game1 />} />
          <Route path="/game2" element={<Game2 />} />
          <Route path="/game3" element={<Game3 />} />
          <Route path="/game4" element={<Game4 />} />
          <Route path="/game5" element={<Game5 />} />
          <Route path="/bonus-game1" element={<PhaserDemo />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </HelmetProvider>
);