import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { Helmet } from "react-helmet-async";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import NameGate from "./NameGate";
import NextGameTimer from "./NextGameTimer";
import { usePlayerStore } from "./playerStore";
import { useGameAccessStore, isGameUnlockedNow } from "./gameAccess";
import { fetchSummary, fetchLeaderboard } from "./logPlaySession";

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const LOGO_URL =
  "https://res.cloudinary.com/hijmipga/image/upload/v1786543371/ChatGPT_Image_Aug_12_2026_07_59_59_PM-Photoroom_hzlh8v.png";

const FONT = "'Fredoka', system-ui, sans-serif";

// "Aurora dusk" — one deep indigo scene melting through violet into magenta.
// Every corner glow stays inside that indigo → violet → magenta family
// (with a single cool cyan accent), so the page reads as one curated
// jewel-tone wash instead of a rainbow of unrelated blobs. Layers are sized
// 100% 100% no-repeat so they stretch the full page height once — no tiling
// seams however long the page grows.
const PAGE_BACKGROUND_LAYERS = [
  "radial-gradient(48% 40% at 12% 6%, rgba(167,139,250,0.55) 0%, transparent 66%)",
  "radial-gradient(44% 36% at 90% 12%, rgba(244,114,182,0.45) 0%, transparent 66%)",
  "radial-gradient(46% 38% at 14% 50%, rgba(129,140,248,0.5) 0%, transparent 68%)",
  "radial-gradient(42% 34% at 90% 58%, rgba(216,180,254,0.42) 0%, transparent 68%)",
  "radial-gradient(46% 38% at 12% 88%, rgba(34,211,238,0.24) 0%, transparent 68%)",
  "radial-gradient(42% 34% at 88% 96%, rgba(232,121,249,0.34) 0%, transparent 68%)",
];
const PAGE_BASE_GRADIENT =
  "linear-gradient(160deg, #191338 0%, #2a1b5e 26%, #3b1f8f 50%, #5b21b6 72%, #7c2d9e 88%, #86198f 100%)";

const PAGE_BACKGROUND_IMAGE = [...PAGE_BACKGROUND_LAYERS, PAGE_BASE_GRADIENT].join(", ");
const PAGE_BACKGROUND_REPEAT =
  PAGE_BACKGROUND_LAYERS.map(() => "no-repeat").join(", ") + ", no-repeat";
const PAGE_BACKGROUND_SIZE =
  PAGE_BACKGROUND_LAYERS.map(() => "100% 100%").join(", ") + ", 100% 100%";

// Small library of cheap, transform-only keyframes for ambient background
// motion. CSS animations (rather than JS-driven Framer Motion loops) so
// the browser can run them off the main thread — important on older
// phones where the JS thread is already busy during scroll.
const DECOR_KEYFRAMES = `
@keyframes bh-drift-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(24px,-18px); } }
@keyframes bh-drift-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-24px,20px); } }
@keyframes bh-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes bh-spin-bob { 0% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(8px) rotate(180deg); } 100% { transform: translateY(0) rotate(360deg); } }
@keyframes bh-spin-bob-rev { 0% { transform: translateY(0) rotate(360deg); } 50% { transform: translateY(-8px) rotate(180deg); } 100% { transform: translateY(0) rotate(0deg); } }
@keyframes bh-twinkle-bob { 0%,100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-9px); opacity: 1; } }
@keyframes bh-sway { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-13px) rotate(3deg); } }
@keyframes bh-rock { 0%,100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(6deg) translateY(-6px); } }
@keyframes bh-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes bh-shine { 0% { transform: translateX(-20%); opacity: 0; } 15% { opacity: .9; } 55% { transform: translateX(220%); opacity: 0; } 100% { transform: translateX(220%); opacity: 0; } }
@keyframes bh-sparkle { 0% { transform: scale(0) rotate(0deg); opacity: 0; } 18% { transform: scale(1) rotate(90deg); opacity: 1; } 38% { transform: scale(.4) rotate(180deg); opacity: .6; } 58% { transform: scale(1) rotate(270deg); opacity: 1; } 100% { transform: scale(0) rotate(360deg); opacity: 0; } }
@keyframes bh-card-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
`;

// Glossy 3D card colors lifted straight from the logo's lettering and
// icons (green "ez", blue "wonders.com" bar, purple controller, pink/
// magenta "wonders", gold stars & numbers, cyan letters, orange dots,
// indigo sky, coral accent) so every card reads as part of one badge.
const CARD_GRADIENTS = [
  "linear-gradient(145deg, #6ee7b7 0%, #34d399 45%, #0d9488 100%)",
  "linear-gradient(145deg, #7dd3fc 0%, #38bdf8 45%, #2563eb 100%)",
  "linear-gradient(145deg, #c4b5fd 0%, #a78bfa 45%, #7c3aed 100%)",
  "linear-gradient(145deg, #f9a8d4 0%, #f472b6 45%, #db2777 100%)",
  "linear-gradient(145deg, #fde68a 0%, #fbbf24 45%, #f59e0b 100%)",
  "linear-gradient(145deg, #a5f3fc 0%, #22d3ee 45%, #0e7490 100%)",
  "linear-gradient(145deg, #d8b4fe 0%, #c084fc 45%, #9333ea 100%)",
  "linear-gradient(145deg, #a5b4fc 0%, #818cf8 45%, #4f46e5 100%)",
  "linear-gradient(145deg, #fda4af 0%, #fb7185 45%, #e11d48 100%)",
];

const LOCKED_GRADIENT = "linear-gradient(145deg, #97a8d4 0%, #6f7fc4 45%, #333e7a 100%)";

const TEXT_DARK = "#f8fafc";
const TEXT_SOFT = "#c7d2fe";
const TEXT_MUTED = "#8795cf";

// Frosted glass shared by the non-card chrome (hero, timer card, loading
// state, footer). A faint white veil over the aurora so every panel feels
// cut from the same dark scene, with just enough luminance for light text.
const PANEL_BACKGROUND =
  "linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)";

const MotionLink = motion.create(Link);

// ---------------------------------------------------------------------------
// Time-based greeting
// ---------------------------------------------------------------------------
function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState(timeGreeting);

  useEffect(() => {
    const refresh = () => setGreeting(timeGreeting());
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    // A long-open tab never re-renders on its own, so without this the
    // greeting sticks to the time-of-day period it was first shown in.
    const id = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    // pageshow also fires on back-forward cache restores, where React state
    // is brought back without a fresh render.
    window.addEventListener("pageshow", refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  return greeting;
}

// ---------------------------------------------------------------------------
// Vector icon library — replaces every emoji with a consistent SVG glyph.
// Filled icons use `currentColor`; outline icons use stroke.
// ---------------------------------------------------------------------------

function Icon({ name, size = "1em", className, style, strokeWidth = 2 }) {
  const base = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className,
    style,
    "aria-hidden": true,
    focusable: false,
  };
  const filled = { ...base, fill: "currentColor" };
  const stroked = {
    ...base,
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "sparkle":
      return (
        <svg {...filled}>
          <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
        </svg>
      );
    case "star":
      return (
        <svg {...filled}>
          <path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.5 6.8L12 16.9 5.9 20.2l1.5-6.8L2.2 8.9l6.9-.6L12 2z" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...filled}>
          <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
        </svg>
      );
    case "crown":
      return (
        <svg {...filled}>
          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3H5v2h14v-2z" />
        </svg>
      );
    case "medal":
      return (
        <svg {...filled}>
          <path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V22l4-2 4 2v-7.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5zm-1 3.6l-1.4 1.4.3 2-2.1-1.1-2.1 1.1.3-2-1.4-1.4 2-.3.9-1.8.9 1.8 2 .3z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...filled}>
          <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" />
        </svg>
      );
    case "unlock":
      return (
        <svg {...stroked}>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0" />
        </svg>
      );
    case "fire":
      return (
        <svg {...filled}>
          <path d="M13.5 2c0 3-2.5 4.5-2.5 7.5 0 2 1 3.5 3 3.5 1.5 0 2.5-1 2.5-2.5 0-1-1-1.5-1.5-2.5 1.5.5 4 1.5 4 5.5 0 3.5-2.8 6.5-6.5 6.5S6 17 6 13.5C6 8.5 10 6 13.5 2z" />
        </svg>
      );
    case "gamepad":
      return (
        <svg {...filled}>
          <path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0 0 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
        </svg>
      );
    case "play":
      return (
        <svg {...filled}>
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    case "arrowRight":
      return (
        <svg {...stroked}>
          <path d="M4 12h14m-6-6 6 6-6 6" />
        </svg>
      );
    case "switch":
      return (
        <svg {...filled}>
          <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
        </svg>
      );
    case "dice":
      return (
        <svg {...filled}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="#fff" />
          <circle cx="15.5" cy="8.5" r="1.5" fill="#fff" />
          <circle cx="12" cy="12" r="1.5" fill="#fff" />
          <circle cx="8.5" cy="15.5" r="1.5" fill="#fff" />
          <circle cx="15.5" cy="15.5" r="1.5" fill="#fff" />
        </svg>
      );
    case "puzzle":
      return (
        <svg {...filled}>
          <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...filled}>
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      );
    case "balloon":
      return (
        <svg {...stroked}>
          <path d="M12 3c3.3 0 6 2.9 6 6 0 3.5-2.6 6-6 6s-6-2.5-6-6c0-3.1 2.7-6 6-6z" />
          <path d="M12 15v5M9.5 22h5" />
        </svg>
      );
    case "sad":
      return (
        <svg {...filled}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="8.5" cy="9.5" r="1.3" fill="#fff" />
          <circle cx="15.5" cy="9.5" r="1.3" fill="#fff" />
          <path d="M8 17c1.5-2 6.5-2 8 0" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...filled}>
          <path d="M12 2c3 2.2 5 5.5 5 9.5l-2.2 2.2-.8-1.6-1 3.4 2 2.2V22l-3-2.6L9 22v-4.3l2-2.2-1-3.4-.8 1.6L7 11.5c0-4 2-7.3 5-9.5zm-1.5 9.5l1.5 1 1.5-1-1-3-1-1-1 1-1 3z" />
        </svg>
      );
    case "target":
      return (
        <svg {...stroked}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "book":
      return (
        <svg {...filled}>
          <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zM19 17.1c-1.6-.4-3.2-.6-5-.6v-10c1.8 0 3.4.2 5 .6v10z" />
        </svg>
      );
    case "abacus":
      return (
        <svg {...stroked}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 12h8M8 17h8" />
          <circle cx="11" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="11" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "palette":
      return (
        <svg {...filled}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.2 0-.8.7-1.4 1.5-1.4H18c2.2 0 4-1.8 4-4 0-5.5-4.5-10-10-10zm-5.5 9c-.8 0-1.5-.7-1.5-1.5S5.7 8 6.5 8s1.5.7 1.5 1.5S7.3 11 6.5 11zm3-4C8.7 7 8 6.3 8 5.5S8.7 4 9.5 4s1.5.7 1.5 1.5S10.3 7 9.5 7zm5 0c-.8 0-1.5-.7-1.5-1.5S13.7 4 14.5 4s1.5.7 1.5 1.5S15.3 7 14.5 7zm3 4c-.8 0-1.5-.7-1.5-1.5S16.7 8 17.5 8s1.5.7 1.5 1.5S18.3 11 17.5 11z" />
        </svg>
      );
    case "rainbow":
      return (
        <svg {...filled}>
          <path d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-12 0H3a9 9 0 0 1 9-9zm0 4a5 5 0 0 1 5 5h-2a3 3 0 0 0-6 0H7a5 5 0 0 1 5-5zm0 4a1 1 0 0 1 1 1h-2a1 1 0 0 1 1-1z" />
        </svg>
      );
    case "planet":
      return (
        <svg {...stroked}>
          <circle cx="12" cy="12" r="5" />
          <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)" />
        </svg>
      );
    case "user":
      return (
        <svg {...filled}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6v1H4v-1z" />
        </svg>
      );
    case "key":
      return (
        <svg {...stroked}>
          <circle cx="8" cy="15" r="4" />
          <path d="M11 12l9-9M16 7l2 2M13 10l2 2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...filled}>
          <path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" />
        </svg>
      );
    case "yarn":
      return (
        <svg {...stroked}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.5 8c3 2 3 6 6.5 6s4-4 6.5-6M5.5 16c3-2 3-6 6.5-6s4 4 6.5 6" />
        </svg>
      );
    case "teddy":
      return (
        <svg {...stroked}>
          <circle cx="12" cy="14" r="6" />
          <circle cx="8.5" cy="7" r="2.5" />
          <circle cx="15.5" cy="7" r="2.5" />
          <circle cx="9.5" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
          <path d="M10 16.5c1.2.8 2.8.8 4 0" />
        </svg>
      );
    case "octopus":
      return (
        <svg {...stroked}>
          <circle cx="12" cy="9" r="5" />
          <circle cx="10.5" cy="8" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="8" r="0.8" fill="currentColor" stroke="none" />
          <path d="M6 12c-1.5 3-2 5-1.5 8M9.5 13c-.5 3-.5 5.5 0 8M12 14v7M14.5 13c.5 3 .5 5.5 0 8M18 12c1.5 3 2 5 1.5 8" />
        </svg>
      );
    case "egg":
      return (
        <svg {...stroked}>
          <ellipse cx="12" cy="13" rx="7" ry="9" />
        </svg>
      );
    case "nine":
      return (
        <svg {...base}>
          <text
            x="12"
            y="17"
            textAnchor="middle"
            fontSize="15"
            fontWeight="800"
            fill="currentColor"
            fontFamily="inherit"
          >
            9
          </text>
        </svg>
      );
    default:
      return (
        <svg {...filled}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}


// ---------------------------------------------------------------------------
// Sparkle — tiny animated starburst (sm+ only, SVG)
// ---------------------------------------------------------------------------
function Sparkle({ delay = 0, className }) {
  // Pure CSS transform/opacity animation so the browser can run every
  // sparkle off the main thread — keeps dozens of concurrent loops off
  // the JS thread on older phones.
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("hidden sm:block h-4 w-4", className)}
      style={{ animation: `bh-sparkle 3s ease-in-out ${delay}s infinite`, fill: "#ffca28" }}
    >
      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ProgressBadge — colourful pills with vector icons
// ---------------------------------------------------------------------------
function ProgressBadge({ progress }) {
  if (!progress) return null;
  const stars = progress.stars ?? 0;
  const streak = progress.peakStreak ?? 0;
  if (!stars && !streak) return null;

  return (
    <div className="mt-2 sm:mt-3 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
      {stars > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-black text-white shadow-md sm:shadow-lg ring-2 ring-white/50"
          style={{
            fontFamily: FONT,
            background: "linear-gradient(135deg, #ffe486 0%, #ffca28 50%, #ff8a3d 100%)",
          }}
        >
          <Icon name="star" size="0.8em" />
          <span className="drop-shadow-sm">{stars}</span>
        </motion.span>
      )}
      {streak > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-black text-white shadow-md sm:shadow-lg ring-2 ring-white/50"
          style={{
            fontFamily: FONT,
            background: "linear-gradient(135deg, #ff9ecb 0%, #ff4fa3 50%, #d6127a 100%)",
          }}
        >
          <Icon name="fire" size="0.8em" />
          <span className="drop-shadow-sm">{streak}</span>
        </motion.span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockOverlay — vector lock with sparkles
// ---------------------------------------------------------------------------
function LockOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-[inherit] overflow-hidden"
      style={{ background: "linear-gradient(165deg, rgba(11,30,70,0.66) 0%, rgba(24,44,92,0.76) 100%)" }}
    >
      <Sparkle delay={0} className="absolute top-4 sm:top-6 left-5 sm:left-8 h-4 w-4 sm:h-5 sm:w-5" />
      <Sparkle delay={0.6} className="absolute top-7 sm:top-10 right-6 sm:right-10 h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <Sparkle delay={1.1} className="absolute bottom-8 sm:bottom-10 left-7 sm:left-12 h-3.5 w-3.5 sm:h-4 sm:w-4" />

      <motion.span
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white to-slate-100 text-2xl sm:text-3xl text-slate-700 shadow-lg sm:shadow-2xl ring-2 sm:ring-4 ring-white/60"
      >
        <Icon name="lock" size="1em" />
      </motion.span>

      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-full px-3 py-1 sm:px-4 sm:py-1.5 text-[11px] sm:text-xs font-black shadow-md sm:shadow-lg ring-2 ring-white/70"
        style={{
          fontFamily: FONT,
          color: "#1e293b",
          background: "linear-gradient(135deg, #ffe486 0%, #ffca28 50%, #ff8a3d 100%)",
        }}
      >
        Coming soon
      </motion.span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WobbleEmoji — playful game emoji with a gentle bob. Game cards keep their
// catalog emoji (more expressive than generic glyphs); vector icons are used
// everywhere else in the chrome.
// ---------------------------------------------------------------------------
function WobbleEmoji({ emoji, size = "text-5xl sm:text-6xl", isOpen = true }) {
  // The perpetual bob is a CSS transform animation (compositor-driven, one
  // per card but off the JS thread); hover/tap stay as transient Framer
  // gestures on an inner element so they don't fight the idle bob.
  return (
    <span className={cn("inline-block", isOpen && "animate-[bh-card-bob_4s_ease-in-out_infinite]")}>
      <motion.span
        className={cn(size, "drop-shadow-[0_4px_6px_rgba(0,0,0,0.16)] sm:drop-shadow-[0_8px_12px_rgba(0,0,0,0.18)]")}
        whileHover={isOpen ? { scale: 1.15, rotate: [0, -6, 6, 0] } : {}}
        whileTap={isOpen ? { scale: 0.92 } : {}}
      >
        {emoji}
      </motion.span>
    </span>
  );
}

// ===========================================================================
// TIMER + LEADERBOARD — compact infographic podium card
// ===========================================================================

function TimerLeaderboardCard({ classId, playerName }) {
  const [state, setState] = useState({
    classId: null,
    leaderboard: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchLeaderboard(classId);
      if (!cancelled) {
        setState({ classId, leaderboard: data, loading: false });
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [classId]);

  const loading = state.classId !== classId || state.loading;
  const leaderboard = state.classId === classId ? state.leaderboard : [];
  const top3 = leaderboard.slice(0, 3);

  const playerRank = leaderboard.findIndex((e) => e.playerName === playerName);
  const playerEntry =
    playerRank >= 0 ? { ...leaderboard[playerRank], rank: playerRank + 1 } : null;

  const medalColors = ["#a78bfa", "#67e8f9", "#f472b6"];
  const podiumBg = [
    "linear-gradient(180deg, #c4b5fd 0%, #8b5cf6 55%, #6d28d9 100%)",
    "linear-gradient(180deg, #a5f3fc 0%, #22d3ee 55%, #0891b2 100%)",
    "linear-gradient(180deg, #f9a8d4 0%, #ec4899 55%, #db2777 100%)",
  ];
  const podiumHeights = ["h-20 sm:h-28", "h-14 sm:h-20", "h-12 sm:h-16"];

  return (
    <div
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] border-[3px] sm:border-4 border-white/25 shadow-xl sm:shadow-2xl"
      style={{
        background: PANEL_BACKGROUND,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* Timer strip */}
      <div className="relative px-3 pt-4 sm:px-6 sm:pt-5">
        <NextGameTimer withTopOffset={false} />
      </div>

      <div className="mx-4 sm:mx-6 mt-3 sm:mt-4 h-1 rounded-full bg-gradient-to-r from-pink-400 via-violet-400 to-cyan-400" />

      {/* Leaderboard */}
      <div className="px-3 py-4 sm:px-6 sm:py-6" style={{ fontFamily: FONT }}>
        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3">
          <motion.span
            animate={{ rotate: [-6, 8, -6], scale: [1, 1.1, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-3xl sm:text-4xl md:text-5xl text-fuchsia-300"
          >
            <Icon name="trophy" size="1em" />
          </motion.span>
          <h2
            className="text-lg sm:text-xl md:text-2xl font-black"
            style={{
              fontFamily: FONT,
              color: TEXT_DARK,
              background: "linear-gradient(135deg, #c4b5fd 0%, #f9a8d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Weekly Champions
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 py-4 sm:py-6">
            <span className="h-7 w-7 sm:h-8 sm:w-8 animate-spin rounded-full border-[3px] sm:border-4 border-blue-400 border-t-transparent border-l-pink-400 border-b-cyan-400" />
            <p className="text-xs sm:text-sm font-bold" style={{ color: TEXT_SOFT }}>
              Loading champions…
            </p>
          </div>
        ) : top3.length === 0 ? (
          <div className="py-4 sm:py-6 text-center">
            <motion.div
              animate={{ rotate: [0, 6, -6, 0], y: [0, -3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="text-4xl sm:text-5xl text-violet-500"
            >
              <Icon name="gamepad" size="1em" />
            </motion.div>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base font-bold" style={{ color: TEXT_SOFT }}>
              Play games to appear on the leaderboard!
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs font-semibold" style={{ color: TEXT_MUTED }}>
              Top players earn a special trophy each week
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Podium */}
            <div className="flex items-end justify-center gap-1.5 sm:gap-4 pt-2 sm:pt-4">
              {/* 2nd place */}
              {top3[1] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 22 }}
                  className="flex flex-1 max-w-[4.8rem] sm:max-w-[7rem] flex-col items-center"
                >
                  <div className="mb-1 sm:mb-2 text-xl sm:text-3xl" style={{ color: medalColors[1] }}>
                    <Icon name="medal" size="1em" />
                  </div>
                  <div
                    className="w-full truncate text-center text-[10px] sm:text-xs font-black px-0.5"
                    style={{ color: TEXT_DARK }}
                    title={top3[1].playerName}
                  >
                    {top3[1].playerName}
                  </div>
                  <div className="mt-0.5 sm:mt-1 flex items-center gap-0.5 rounded-full bg-cyan-100 px-1.5 sm:px-2 py-0.5 text-xs sm:text-sm font-black ring-1 ring-cyan-200" style={{ color: "#155e75" }}>
                    <span className="text-sm sm:text-base">{top3[1].trophies}</span>
                    <Icon name="trophy" size="1.1em" className="text-cyan-600" />
                  </div>
                  <div className="mt-1.5 sm:mt-2 w-full flex flex-col items-center">
                    <div
                      className={cn(
                        "w-full rounded-t-xl sm:rounded-t-2xl rounded-b-md shadow-md sm:shadow-lg ring-1 sm:ring-2 ring-white/70 flex flex-col-reverse items-center justify-end pb-1 sm:pb-2",
                        podiumHeights[1]
                      )}
                      style={{ background: podiumBg[1] }}
                    >
                      <span className="text-xl sm:text-3xl font-black text-white drop-shadow-sm leading-none">
                        2<span className="text-[10px] sm:text-sm align-super">nd</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 1st place */}
              {top3[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 28, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 20 }}
                  className="flex flex-1 max-w-[5.8rem] sm:max-w-[9rem] flex-col items-center -mt-3 sm:-mt-6"
                >
                  <motion.div
                    animate={{ y: [0, -3, 0], rotate: [-4, 4, -4] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    className="mb-0.5 text-2xl sm:text-5xl text-fuchsia-300"
                  >
                    <Icon name="crown" size="1em" />
                  </motion.div>
                  <div className="mb-1 sm:mb-2 text-2xl sm:text-4xl" style={{ color: medalColors[0] }}>
                    <Icon name="medal" size="1em" />
                  </div>
                  <div
                    className="w-full truncate text-center text-[10px] sm:text-sm font-black px-0.5"
                    style={{ color: TEXT_DARK }}
                    title={top3[0].playerName}
                  >
                    {top3[0].playerName}
                  </div>
                  <div className="mt-0.5 sm:mt-1 flex items-center gap-0.5 rounded-full bg-violet-200/80 px-1.5 sm:px-2.5 py-0.5 text-xs sm:text-sm font-black ring-1 sm:ring-2 ring-violet-300" style={{ color: "#4c1d95" }}>
                    <span className="text-sm sm:text-base">{top3[0].trophies}</span>
                    <Icon name="trophy" size="1.1em" className="text-violet-600" />
                  </div>
                  <div className="mt-1.5 sm:mt-2 w-full flex flex-col items-center">
                    <div
                      className={cn(
                        "w-full rounded-t-2xl sm:rounded-t-3xl rounded-b-md sm:rounded-b-lg shadow-lg sm:shadow-2xl ring-2 sm:ring-4 ring-violet-300/70 flex flex-col-reverse items-center justify-end pb-1 sm:pb-2",
                        podiumHeights[0]
                      )}
                      style={{ background: podiumBg[0] }}
                    >
                      <span className="text-2xl sm:text-4xl font-black text-violet-50 drop-shadow-sm leading-none">
                        1<span className="text-xs sm:text-base align-super">st</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 3rd place */}
              {top3[2] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 280, damping: 22 }}
                  className="flex flex-1 max-w-[4.8rem] sm:max-w-[7rem] flex-col items-center"
                >
                  <div className="mb-1 sm:mb-2 text-xl sm:text-3xl" style={{ color: medalColors[2] }}>
                    <Icon name="medal" size="1em" />
                  </div>
                  <div
                    className="w-full truncate text-center text-[10px] sm:text-xs font-black px-0.5"
                    style={{ color: TEXT_DARK }}
                    title={top3[2].playerName}
                  >
                    {top3[2].playerName}
                  </div>
                  <div className="mt-0.5 sm:mt-1 flex items-center gap-0.5 rounded-full bg-pink-100 px-1.5 sm:px-2 py-0.5 text-xs sm:text-sm font-black ring-1 ring-pink-200" style={{ color: "#9d174d" }}>
                    <span className="text-sm sm:text-base">{top3[2].trophies}</span>
                    <Icon name="trophy" size="1.1em" className="text-pink-500" />
                  </div>
                  <div className="mt-1.5 sm:mt-2 w-full flex flex-col items-center">
                    <div
                      className={cn(
                        "w-full rounded-t-xl sm:rounded-t-2xl rounded-b-md shadow-md sm:shadow-lg ring-1 sm:ring-2 ring-white/70 flex flex-col-reverse items-center justify-end pb-1 sm:pb-2",
                        podiumHeights[2]
                      )}
                      style={{ background: podiumBg[2] }}
                    >
                      <span className="text-xl sm:text-3xl font-black text-white drop-shadow-sm leading-none">
                        3<span className="text-[10px] sm:text-sm align-super">rd</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Player's own rank */}
            {playerEntry && playerEntry.rank > 3 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 320, damping: 24 }}
                className="relative overflow-hidden rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-md sm:shadow-lg ring-1 sm:ring-2 ring-violet-200"
                style={{
                  background: "linear-gradient(135deg, rgba(155,81,224,0.16) 0%, rgba(34,211,238,0.16) 100%)",
                }}
              >
                <div className="absolute -right-5 -top-5 text-5xl sm:text-7xl opacity-10 text-violet-500">
                  <Icon name="target" size="1em" />
                </div>
                <div className="relative flex items-center justify-between gap-2 sm:gap-3">
                  <span
                    className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl text-xs sm:text-base font-black text-white shadow-md sm:shadow-lg ring-1 sm:ring-2 ring-white/60"
                    style={{ background: "linear-gradient(135deg, #9b51e0 0%, #6d28d9 100%)" }}
                  >
                    #{playerEntry.rank}
                  </span>
                  <span className="flex-1 truncate text-xs sm:text-sm md:text-base font-black" style={{ color: TEXT_DARK }}>
                    {playerEntry.playerName}
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-black text-white shadow-sm sm:shadow-md ring-1 sm:ring-2 ring-white/60"
                    style={{ background: "linear-gradient(135deg, #ffca28 0%, #f59e0b 100%)" }}
                  >
                    <span className="text-sm sm:text-base">{playerEntry.trophies}</span>
                    <Icon name="trophy" size="1em" />
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-1.5">
          <span className="text-[10px] sm:text-[0.65rem] font-black tracking-[0.14em] sm:tracking-[0.18em] uppercase" style={{ color: TEXT_MUTED }}>
            Resets every Friday at noon
          </span>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// GAME CARD
// ===========================================================================

const GameCard = motion.create(function GameCard({
  game,
  index,
  progress,
  isTeacher,
  isFeatured,
  onOpen,
  reduceMotion,
}) {
  const isOpen = isTeacher || game.unlocked;
  const displayNumber = game.displayNumber ?? "";
  const gradient = isOpen
    ? game.cardGradient || CARD_GRADIENTS[index % CARD_GRADIENTS.length]
    : LOCKED_GRADIENT;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.92, rotate: -2 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ delay: 0.04 + index * 0.07, type: "spring", stiffness: 280, damping: 22 }}
      whileHover={isOpen ? { y: -10, rotate: [0, -0.8, 0.8, 0] } : {}}
      className="relative"
      style={{ fontFamily: FONT }}
    >
      {isOpen && (
        <div
          className="hidden sm:block absolute -inset-3 rounded-[2rem] opacity-35 blur-2xl -z-10 transition-opacity duration-300 group-hover:opacity-60"
          style={{ background: gradient }}
        />
      )}

      <MotionLink
        to={isOpen ? game.to : "#"}
        aria-disabled={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={(e) => {
          if (!isOpen) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          onOpen?.(game.to);
        }}
        whileHover={isOpen ? { y: -2 } : {}}
        whileTap={isOpen ? { y: 0, scale: 0.97 } : {}}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 md:p-7 shadow-lg sm:shadow-2xl ring-[3px] sm:ring-4 ring-white/70 transition-all duration-200",
          isOpen ? "cursor-pointer" : "cursor-not-allowed"
        )}
        style={{ background: gradient }}
      >
        {!isOpen && <LockOverlay />}

        {/* Pattern overlay */}
        <div
          className="hidden sm:block pointer-events-none absolute inset-0 opacity-18"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0 2px, transparent 2.5px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.7) 0 1.5px, transparent 2px), radial-gradient(circle at 40% 85%, rgba(255,255,255,0.8) 0 2px, transparent 2.5px), radial-gradient(circle at 85% 15%, rgba(255,255,255,0.7) 0 1.5px, transparent 2px)",
            backgroundSize: "120px 120px, 90px 90px, 140px 140px, 100px 100px",
          }}
        />

        {/* Inner shine */}
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/30 via-white/8 to-black/15 sm:from-white/40 sm:via-white/10 sm:to-black/20" />

        {/* Corner blurs */}
        <div className="hidden sm:block pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/18 blur-2xl" />
        <div className="hidden sm:block pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-black/8 blur-2xl" />

        {/* Game number badge — bonus games get a "BONUS" pill instead of a digit */}
        {displayNumber !== "" &&
          (game.isBonus ? (
            <motion.div
              whileHover={isOpen ? { scale: 1.06 } : {}}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-1 rounded-full px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs font-black uppercase tracking-wider text-white shadow-lg sm:shadow-xl ring-2 sm:ring-4 ring-white/60"
              style={{ fontFamily: FONT, background: "linear-gradient(145deg, rgba(11,30,70,0.55) 0%, rgba(11,30,70,0.75) 100%)" }}
            >
              <Icon name="star" size="0.8em" className="text-amber-300" />
              BONUS
            </motion.div>
          ) : (
            <motion.div
              whileHover={isOpen ? { scale: 1.1, rotate: 10 } : {}}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl text-sm sm:text-lg font-black text-white shadow-lg sm:shadow-xl ring-2 sm:ring-4 ring-white/60"
              style={{ fontFamily: FONT, background: "linear-gradient(145deg, rgba(11,30,70,0.4) 0%, rgba(11,30,70,0.6) 100%)" }}
            >
              {displayNumber}
            </motion.div>
          ))}

        {/* Teacher-only: player-facing lock state indicator */}
        {isTeacher && (
          <div className="absolute bottom-3 right-3 z-10">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm shadow-md ring-2 ring-white/70",
                game.unlocked ? "bg-emerald-500 text-white" : "bg-slate-600 text-white"
              )}
              title={game.unlocked ? "Unlocked for players" : "Locked for players"}
              aria-label={game.unlocked ? "Unlocked for players" : "Locked for players"}
            >
              <Icon name={game.unlocked ? "unlock" : "lock"} size="0.9em" />
            </span>
          </div>
        )}

        {/* Featured badge — simple pill, not a hanging banner */}
        {isFeatured && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10"
          >
            <div className="relative">
              <div
                className="absolute -inset-1 -z-10 rounded-full opacity-70"
                style={{ background: "radial-gradient(circle, rgba(103,232,249,0.5) 0%, transparent 72%)" }}
              />
              <div
                className="relative flex items-center gap-1 rounded-full px-2.5 py-1 sm:px-3 sm:py-1 text-[9px] sm:text-xs font-black tracking-wide text-indigo-950 ring-1 ring-white/80 shadow-md"
                style={{
                  fontFamily: FONT,
                  background: "linear-gradient(135deg, #a5f3fc 0%, #c4b5fd 100%)",
                }}
              >
                <Icon name="star" size="0.8em" className="text-fuchsia-500" />
                FEATURED
              </div>
            </div>
          </motion.div>
        )}

        {/* Sparkles */}
        {isOpen && (
          <>
            {!isFeatured && (
              <Sparkle delay={index * 0.15} className="absolute top-3 left-3 sm:top-4 sm:left-4 h-3 w-3 sm:h-3.5 sm:w-3.5 z-10" />
            )}
            <Sparkle delay={0.4 + index * 0.1} className="absolute bottom-20 sm:bottom-24 right-3 sm:right-4 h-2.5 w-2.5 sm:h-3 sm:w-3 z-10" />
          </>
        )}

        {/* Icon stage */}
        <div className="relative z-10 mb-3 sm:mb-4 flex h-16 sm:h-24 items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 sm:h-28 sm:w-28 rounded-full bg-white/20 sm:bg-white/25 blur-xl sm:blur-2xl" />
          </div>
          <WobbleEmoji emoji={game.emoji} size="text-5xl sm:text-6xl md:text-7xl" isOpen={isOpen} />
        </div>

        {/* Title */}
        <h3
          className="relative z-10 text-center text-base sm:text-lg md:text-xl leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] sm:drop-shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
          style={{ fontFamily: FONT, fontWeight: 800 }}
        >
          {game.title}
        </h3>

        {/* Subtitle */}
        <p
          className="relative z-10 mt-1 sm:mt-1.5 text-center text-[11px] sm:text-sm leading-snug text-white/92 drop-shadow-sm font-medium sm:font-semibold"
          style={{ fontFamily: FONT, fontWeight: 500 }}
        >
          {game.subtitle.split("\n")[0]}
        </p>

        {/* Progress badges */}
        <div className="relative z-10">
          <ProgressBadge progress={progress} />
        </div>

        {/* Play button */}
        {isOpen && (
          <div className="relative z-10 mt-4 sm:mt-5 flex justify-center">
            <motion.span
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              className="group/btn inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-4 py-2 sm:px-7 sm:py-3 text-xs sm:text-base font-black text-white shadow-md sm:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.35)] ring-2 sm:ring-4 ring-white/60 transition-all"
              style={{
                fontFamily: FONT,
                background: "linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.22) 100%)",
              }}
            >
              <Icon name="play" size="0.8em" />
              Play now
              <Icon name="arrowRight" size="0.9em" />
            </motion.span>
          </div>
        )}
      </MotionLink>
    </motion.div>
  );
});

// ===========================================================================
// Divider — polished gradient underline replacing the squiggle
// ===========================================================================

function Divider() {
  return (
    <div className="mt-1.5 sm:mt-2 flex items-center justify-center">
      <span
        className="h-1.5 sm:h-2 w-36 sm:w-56 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #f9a8d4 0%, #c4b5fd 24%, #93c5fd 48%, #86efac 72%, #fde047 100%)",
          boxShadow: "0 2px 10px -2px rgba(167,139,250,0.55)",
        }}
      />
    </div>
  );
}

// ===========================================================================
// SectionHeader
// ===========================================================================

function SectionHeader({ icon, eyebrow, title, accent, icon2, reduceMotion }) {
  return (
    <div className="mb-5 sm:mb-8 md:mb-10 flex flex-col items-center gap-1.5 sm:gap-2 text-center">
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-1 sm:gap-2 rounded-full px-3 py-0.5 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-black tracking-[0.18em] sm:tracking-[0.22em] uppercase shadow-sm sm:shadow-md ring-2 ring-white/70"
          style={{ fontFamily: FONT, color: "#1e1b4b", background: accent }}
        >
          <span className="text-xs sm:text-sm"><Icon name={icon2 || "sparkle"} size="1em" /></span>
          {eyebrow}
        </motion.span>
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex items-center gap-2 sm:gap-3 md:gap-4"
      >
        <motion.span
          animate={reduceMotion ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl md:text-4xl drop-shadow-sm sm:drop-shadow-md"
          style={{ color: "#ff4fa3" }}
        >
          <Icon name={icon} size="1em" />
        </motion.span>
        <h2
          className="text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight tracking-tight"
          style={{
            fontFamily: FONT,
            color: TEXT_DARK,
            fontWeight: 900,
            background: accent,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {title}
        </h2>
        <motion.span
          animate={reduceMotion ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="text-2xl sm:text-3xl md:text-4xl drop-shadow-sm sm:drop-shadow-md"
          style={{ color: "#22d3ee" }}
        >
          <Icon name={icon} size="1em" />
        </motion.span>
      </motion.div>
      <Divider />
    </div>
  );
}

// ===========================================================================
// PlayerName — big bold name (enlarged)
// ===========================================================================

function PlayerName({ playerName, roleLabel, roleIcon }) {
  const greeting = useTimeGreeting();
  return (
    <div className="flex min-w-0 flex-col items-start">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.14em] sm:tracking-[0.18em] shadow-sm sm:shadow-md ring-1 sm:ring-2 ring-white/70"
        style={{
          background: "linear-gradient(135deg, rgba(34,211,238,0.3) 0%, rgba(244,114,182,0.3) 100%)",
          color: "#a5f3fc",
        }}
      >
        {greeting}
        {roleLabel && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-white/70 px-1.5 py-px text-[9px] sm:text-[10px]" style={{ color: "#6d28d9" }}>
            <Icon name={roleIcon || "key"} size="0.9em" />
            {roleLabel}
          </span>
        )}
      </span>
      <span
        className="mt-1 sm:mt-2 block max-w-full break-words text-2xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] font-black"
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          background: "linear-gradient(135deg, #a7f3d0 0%, #67e8f9 25%, #f9a8d4 50%, #c4b5fd 75%, #fde68a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 1px 4px rgba(167,139,250,0.45))",
        }}
      >
        {playerName}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SwitchPlayerButton — far-right, responsive (icon + full text on sm+)
// ---------------------------------------------------------------------------
function SwitchPlayerButton({ onReset }) {
  return (
    <motion.button
      type="button"
      onClick={onReset}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className="flex shrink-0 items-center gap-1 sm:gap-2 rounded-full px-3 py-1.5 sm:px-5 sm:py-2.5 text-[10px] sm:text-sm font-black text-white shadow-md sm:shadow-lg ring-2 sm:ring-4 ring-white/70"
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        background: "linear-gradient(135deg, #9b51e0 0%, #6d28d9 50%, #2563eb 100%)",
      }}
    >
      <Icon name="switch" size="1.1em" />
      <span className="hidden sm:inline">Switch Player</span>
      <span className="sm:hidden">Switch</span>
    </motion.button>
  );
}

// ===========================================================================
// FloatingDecor — background vector shapes (no emoji)
// ===========================================================================

function FloatingDecor() {
  // Positioned `absolute` inside the full-height page shell (not `fixed`
  // to the viewport), so these shapes scroll naturally with the content —
  // spread across the ENTIRE page instead of just the first screenful.
  // Colour comes entirely from PAGE_BACKGROUND now (a single coordinated
  // system); this layer only adds small figurative icon accents on top,
  // so the two don't compete or fall out of sync with each other.
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0 select-none">
      <span className="absolute left-[7%] top-[9%] text-2xl sm:text-4xl md:text-5xl opacity-60 text-white animate-[bh-bob_10s_ease-in-out_infinite]">
        <Icon name="cloud" size="1em" />
      </span>
      <span className="absolute right-[9%] top-[17%] text-2xl sm:text-3xl md:text-4xl opacity-90 text-amber-300 animate-[bh-spin-bob_9s_ease-in-out_infinite]">
        <Icon name="star" size="1em" />
      </span>
      <span className="absolute left-[11%] top-[27%] text-2xl sm:text-3xl md:text-4xl opacity-85 text-pink-300 animate-[bh-twinkle-bob_7s_ease-in-out_infinite]">
        <Icon name="sparkle" size="1em" />
      </span>
      <span className="absolute right-[7%] top-[37%] text-3xl sm:text-4xl md:text-5xl opacity-80 text-rose-300 animate-[bh-sway_10s_ease-in-out_infinite]">
        <Icon name="balloon" size="1em" />
      </span>
      <span className="absolute left-[9%] top-[63%] text-2xl sm:text-3xl md:text-4xl opacity-80 text-cyan-300 animate-[bh-twinkle-bob_8s_ease-in-out_infinite] [animation-delay:-3s]">
        <Icon name="sparkle" size="1em" />
      </span>
      <span className="absolute right-[10%] top-[82%] text-2xl sm:text-3xl md:text-4xl opacity-80 text-rose-300 animate-[bh-sway_11s_ease-in-out_infinite] [animation-delay:-4s]">
        <Icon name="balloon" size="1em" />
      </span>

      <div className="hidden sm:block">
        <span className="absolute right-[14%] top-[47%] text-3xl md:text-4xl opacity-55 text-white animate-[bh-bob_12s_ease-in-out_infinite] [animation-delay:-5s]">
          <Icon name="cloud" size="1em" />
        </span>
        <span className="absolute left-[14%] top-[52%] text-2xl md:text-3xl opacity-85 text-violet-300 animate-[bh-spin-bob-rev_10s_ease-in-out_infinite] [animation-delay:-2s]">
          <Icon name="star" size="1em" />
        </span>
        <div className="absolute right-[22%] top-[71%] text-4xl md:text-5xl opacity-80 text-fuchsia-300 animate-[bh-rock_10s_ease-in-out_infinite]">
          <Icon name="rainbow" size="1em" />
        </div>
        <span className="absolute left-[22%] top-[87%] text-3xl md:text-4xl opacity-75 text-indigo-200 animate-[bh-spin-slow_60s_linear_infinite]">
          <Icon name="planet" size="1em" />
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// BetaHomeContent — main page
// ===========================================================================

function BetaHomeContent() {
  const navigate = useNavigate();
  const playerName = usePlayerStore((s) => s.playerName);
  const classId = usePlayerStore((s) => s.classId);
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const isAdmin = usePlayerStore((s) => s.isAdmin);
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);
  const reduceMotion = useReducedMotion();

  const [progressByGame, setProgressByGame] = useState({});
  const [loadingTo, setLoadingTo] = useState(null);

  const gameAccessLoaded = useGameAccessStore((s) => s.loaded);
  const gameAccessLoadedClassId = useGameAccessStore((s) => s.loadedClassId);
  const gameAccessError = useGameAccessStore((s) => s.error);
  const fetchGameAccess = useGameAccessStore((s) => s.fetchGameAccess);
  const gameAccessReady = gameAccessLoaded && gameAccessLoadedClassId === classId;

  const unlocked = useGameAccessStore((s) => s.unlocked);
  const orderedGames = useGameAccessStore((s) => s.games);

  useEffect(() => {
    if (!classId) return;
    if (gameAccessReady) return;
    fetchGameAccess(classId);
  }, [classId, gameAccessReady, fetchGameAccess]);

  useEffect(() => {
    let cancelled = false;
    if (!classId || !playerName) return undefined;
    fetchSummary({ classId, playerName })
      .then((rows) => {
        if (cancelled) return;
        const mine = {};
        rows.forEach((row) => {
          if (row.playerName === playerName) mine[row.game] = row;
        });
        setProgressByGame(mine);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [classId, playerName]);

  useEffect(() => {
    if (!gameAccessReady) return undefined;
    const prefetch = () => {
      if (isGameUnlockedNow(1, isTeacher)) import("./Game1");
      if (isGameUnlockedNow(2, isTeacher)) import("./Game2");
      if (isGameUnlockedNow(3, isTeacher)) import("./Game3");
      if (isGameUnlockedNow(4, isTeacher)) import("./BonusGames/Game4/PhaserDemo");
      if (isGameUnlockedNow(5, isTeacher)) import("./Game5");
      if (isGameUnlockedNow(6, isTeacher)) import("./Game6");
      if (isGameUnlockedNow(7, isTeacher)) import("./BonusGames/Game 7/PhaserDemo");
      if (isGameUnlockedNow(8, isTeacher)) import("./BonusGames/Game 8/PhaserDemo");
      if (isGameUnlockedNow(9, isTeacher)) import("./BonusGames/Game 9/PhaserDemo");
      if (isGameUnlockedNow("b1", isTeacher)) import("./BonusGames/BonusGame1/PhaserDemo");
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(prefetch, 800);
    return () => clearTimeout(t);
  }, [gameAccessReady, isTeacher, unlocked]);

  const openGame = useCallback(
    (to) => {
      setLoadingTo(to);
      requestAnimationFrame(() => {
        navigate(to);
      });
    },
    [navigate]
  );

  // Replicate Home.jsx game order: sequential numbers in the database order
  // (bonus games labelled "B"). Featured (shiny) games are pulled out into
  // their own spotlight section, which is sorted highest-number-first and so
  // intentionally does not follow the database order.
  const { featuredGames, regularGames } = useMemo(() => {
    if (!orderedGames.length) return { featuredGames: [], regularGames: [] };

    let nextGameNumber = 0;
    const numbered = orderedGames.map((game, index) => ({
      ...game,
      displayNumber: game.isBonus ? "B" : String(++nextGameNumber),
      cardGradient: CARD_GRADIENTS[index % CARD_GRADIENTS.length],
    }));

    const isFeaturedGame = (g) => g.shiny && (isTeacher || g.unlocked);
    const featured = numbered.filter(isFeaturedGame);
    const regular = numbered.filter((g) => !isFeaturedGame(g));

    // Spotlight section has its own ordering (highest number first, bonus last).
    const sortValue = (g) => (g.isBonus ? 0 : parseInt(g.key, 10) || 0);
    featured.sort((a, b) => sortValue(b) - sortValue(a));

    return { featuredGames: featured, regularGames: regular };
  }, [orderedGames, isTeacher]);

  const roleLabel = isTeacher ? (isAdmin ? "Admin" : "Teacher") : null;
  const roleIcon = isAdmin ? "shield" : "key";

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden"
      style={{
        backgroundImage: PAGE_BACKGROUND_IMAGE,
        backgroundRepeat: PAGE_BACKGROUND_REPEAT,
        backgroundSize: PAGE_BACKGROUND_SIZE,
        fontFamily: FONT,
        colorScheme: "light",
      }}
    >
      <style>{DECOR_KEYFRAMES}</style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700;800;900&display=swap"
      />

      {/* Subtle dot pattern over the gradient for texture. `absolute`
          (not `fixed`) so it scrolls with the page — one less fixed
          layer for the browser to keep re-pinning to the viewport
          during a fast scroll. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.35) 1.2px, transparent 1.4px), radial-gradient(rgba(255,255,255,0.28) 1.2px, transparent 1.4px), radial-gradient(rgba(255,202,40,0.3) 2px, transparent 2.2px)",
          backgroundSize: "30px 30px, 30px 30px, 90px 90px",
          backgroundPosition: "0 0, 15px 15px, 45px 30px",
        }}
      />

      <FloatingDecor />

      {/* ================================================================
          TEACHER NAV BAR
          ================================================================ */}
      {isTeacher && (
        <div className="fixed left-0 right-0 top-0 z-50" style={{ fontFamily: FONT }}>
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
            <motion.button
              type="button"
              onClick={() => navigate("/game-access")}
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ y: 0, scale: 0.98 }}
              className="flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-base font-black text-white shadow-md sm:shadow-xl ring-2 sm:ring-4 ring-white/70"
              style={{ background: "linear-gradient(135deg, #4ade80 0%, #16a34a 50%, #0891b2 100%)", fontWeight: 800 }}
            >
              <Icon name="shield" size="1em" />
              Teacher controls
            </motion.button>

            <motion.button
              type="button"
              onClick={() => navigate("/")}
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ y: 0, scale: 0.98 }}
              className="flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-base font-black text-white shadow-md sm:shadow-xl ring-2 sm:ring-4 ring-white/70"
              style={{ background: "linear-gradient(135deg, #9b51e0 0%, #6d28d9 50%, #2563eb 100%)", fontWeight: 800 }}
            >
              <Icon name="gamepad" size="1em" />
              Classic Home
            </motion.button>
          </div>
        </div>
      )}

      {/* ================================================================
          HEADER / HERO
          ================================================================ */}
      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-4xl px-3 sm:px-6",
          isTeacher ? "pt-16 sm:pt-20 md:pt-24" : "pt-8 sm:pt-12 md:pt-14"
        )}
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] border-[3px] sm:border-4 border-white/25 shadow-xl sm:shadow-2xl px-4 py-4 sm:px-7 sm:py-6"
          style={{
            background: PANEL_BACKGROUND,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div className="pointer-events-none absolute -top-4 -right-4 text-[4.5rem] sm:text-[7rem] opacity-[0.09] text-indigo-200">
            <Icon name="dice" size="1em" />
          </div>
          <div className="pointer-events-none absolute -bottom-6 -left-2 text-[5rem] sm:text-[8rem] opacity-[0.08] text-indigo-200">
            <Icon name="puzzle" size="1em" />
          </div>

          <div className="relative flex flex-row items-center gap-3 sm:gap-6 md:gap-8">
            {/* Logo */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: -14, rotate: -3 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              className="relative flex-shrink-0"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
                className="hidden sm:block absolute -inset-4 md:-inset-5 rounded-full opacity-40"
                style={{
                  background: "conic-gradient(from 0deg, #ff4fa3, #9b51e0, #2563eb, #4ade80, #ffca28, #ff4fa3)",
                  filter: "blur(12px)",
                }}
              />
              <motion.img
                src={LOGO_URL}
                alt="EZ Wonders"
                animate={{ y: reduceMotion ? 0 : [0, -3, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative h-auto w-20 sm:w-40 md:w-48 lg:w-56 drop-shadow-xl sm:drop-shadow-2xl"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </motion.div>

            {/* Name */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 240, damping: 22 }}
              className="flex-1 min-w-0"
            >
              <PlayerName playerName={playerName} roleLabel={roleLabel} roleIcon={roleIcon} />
            </motion.div>

            {/* Switch player — far right */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14, type: "spring", stiffness: 240, damping: 22 }}
              className="shrink-0 self-center"
            >
              <SwitchPlayerButton onReset={resetPlayer} />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ================================================================
          TIMER + LEADERBOARD CARD
          ================================================================ */}
      <div className="relative z-10 px-3 pt-6 sm:px-6 sm:pt-8 md:pt-9">
        <TimerLeaderboardCard classId={classId} playerName={playerName} />
      </div>

      {/* ================================================================
          LOADING / ERROR STATE
          ================================================================ */}
      {!gameAccessReady && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative z-10 mx-auto mb-10 mt-8 flex w-full max-w-lg flex-col items-center gap-3 sm:gap-4 rounded-[1.75rem] sm:rounded-[2.25rem] border-[3px] sm:border-4 border-white/25 px-5 py-10 sm:px-8 sm:py-14 text-center shadow-xl sm:shadow-2xl"
          style={{
            fontFamily: FONT,
            background: PANEL_BACKGROUND,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <Sparkle delay={0} className="absolute top-4 left-5 sm:top-5 sm:left-6 h-4 w-4 sm:h-5 sm:w-5" />
          <Sparkle delay={0.5} className="absolute top-6 right-6 sm:top-7 sm:right-8 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {gameAccessError ? (
            <>
              <motion.span
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="text-5xl sm:text-6xl md:text-7xl text-slate-400"
              >
                <Icon name="sad" size="1em" />
              </motion.span>
              <p className="max-w-xs text-sm sm:text-base md:text-lg font-bold" style={{ color: TEXT_SOFT }}>
                {gameAccessError}
              </p>
              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.04 }}
                whileTap={{ y: 0, scale: 0.98 }}
                onClick={() => fetchGameAccess(classId)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 sm:px-7 sm:py-3 text-sm sm:text-base font-black text-white shadow-lg sm:shadow-xl ring-2 sm:ring-4 ring-white/70"
                style={{ fontFamily: FONT, fontWeight: 800, background: "linear-gradient(135deg, #9b51e0 0%, #6d28d9 50%, #2563eb 100%)" }}
              >
                <Icon name="switch" size="1em" />
                Try again
              </motion.button>
            </>
          ) : (
            <>
              <div className="relative">
                <span className="h-11 w-11 sm:h-14 sm:w-14 animate-spin rounded-full border-4 sm:border-[5px] border-blue-400 border-t-transparent border-l-pink-400 border-b-cyan-400 border-r-emerald-400" />
                <Sparkle delay={0.3} className="absolute -top-2 -right-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <p
                className="text-base sm:text-lg md:text-xl font-black"
                style={{ fontFamily: FONT, background: "linear-gradient(135deg, #c4b5fd 0%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                Loading your games…
              </p>
              <p className="text-xs sm:text-sm font-semibold" style={{ color: TEXT_SOFT }}>
                Getting all the fun ready for you!
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* ================================================================
          FEATURED GAMES
          ================================================================ */}
      {gameAccessReady && featuredGames.length > 0 && (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="relative z-10 px-3 pt-7 sm:px-6 sm:pt-10 md:pt-14 pb-6 sm:pb-10 md:pb-12"
        >
          <SectionHeader
            icon="star"
            eyebrow="Spotlight"
            title="This Week's Wonders"
            accent="linear-gradient(135deg, #67e8f9 0%, #c4b5fd 100%)"
            icon2="sparkle"
            reduceMotion={reduceMotion}
          />

          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:gap-6 md:gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
            {featuredGames.map((game, i) => (
              <GameCard
                key={game.key}
                game={game}
                index={i}
                progress={progressByGame[game.progressKey]}
                isTeacher={isTeacher}
                isFeatured
                onOpen={openGame}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* ================================================================
          ALL GAMES — database order
          ================================================================ */}
      {gameAccessReady && regularGames.length > 0 && (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="relative z-10 px-3 pt-2 sm:px-6 sm:pt-2 pb-14 sm:pb-20 md:pb-28"
        >
          <SectionHeader
            icon="gamepad"
            eyebrow="Pick a game"
            title="All Games"
            accent="linear-gradient(135deg, #f9a8d4 0%, #c4b5fd 100%)"
            icon2="dice"
            reduceMotion={reduceMotion}
          />

          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:gap-6 md:gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
            {regularGames.map((game, i) => (
              <GameCard
                key={game.key}
                game={game}
                index={i + featuredGames.length}
                progress={progressByGame[game.progressKey]}
                isTeacher={isTeacher}
                onOpen={openGame}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Fully empty state */}
      {gameAccessReady && orderedGames.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="relative z-10 flex flex-col items-center gap-3 sm:gap-4 py-14 sm:py-20 text-center px-3 sm:px-4"
          style={{ fontFamily: FONT }}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-5xl sm:text-7xl md:text-8xl text-pink-300"
          >
            <Icon name="balloon" size="1em" />
          </motion.div>
          <h3
            className="text-xl sm:text-2xl md:text-3xl font-black"
            style={{ fontFamily: FONT, background: "linear-gradient(135deg, #f9a8d4 0%, #c4b5fd 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            No games yet!
          </h3>
          <p className="text-sm sm:text-base font-semibold max-w-sm" style={{ color: "rgba(255,255,255,0.92)" }}>
            Your teacher will add games soon. Check back later for lots of fun!
          </p>
        </motion.div>
      )}

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="relative z-10 mt-auto w-full px-3 pb-8 sm:px-6 sm:pb-12 md:pb-14 pt-2 sm:pt-4">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] border-[3px] sm:border-4 border-white/25 shadow-xl sm:shadow-2xl px-4 py-4 sm:px-7 sm:py-6 md:px-9 md:py-8 text-center relative"
          style={{
            background: PANEL_BACKGROUND,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div className="pointer-events-none absolute -top-4 -right-4 text-5xl sm:text-7xl opacity-[0.09] text-indigo-200">
            <Icon name="sparkle" size="1em" />
          </div>
          <div className="pointer-events-none absolute -bottom-3 -left-2 text-5xl sm:text-7xl opacity-[0.08] text-indigo-200">
            <Icon name="rainbow" size="1em" />
          </div>
          <Sparkle delay={0.2} className="absolute top-4 left-5 sm:top-5 sm:left-6 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <Sparkle delay={0.7} className="absolute top-5 right-5 sm:top-6 sm:right-8 h-3.5 w-3.5 sm:h-4 sm:w-4" />

          <p
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-black tracking-[0.18em] sm:tracking-[0.24em] uppercase shadow-sm sm:shadow-md ring-2 ring-white/70"
            style={{ fontFamily: FONT, color: "#fff", background: "linear-gradient(135deg, #2563eb 0%, #ff4fa3 50%, #ffca28 100%)" }}
          >
            <Icon name="sparkle" size="0.9em" />
            EZ WONDERS
            <Icon name="sparkle" size="0.9em" />
          </p>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg font-bold" style={{ fontFamily: FONT, color: TEXT_DARK }}>
            © {new Date().getFullYear()} · Created by{" "}
            <span className="font-black" style={{ color: "#a78bfa" }}>
              Towhid Hossain
            </span>{" "}
            &{" "}
            <span className="font-black" style={{ color: "#f472b6" }}>
              Siti Soleha
            </span>
          </p>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base font-semibold" style={{ color: TEXT_SOFT }}>
            A collaborative numeracy project for joyful early learning
          </p>
          <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 sm:gap-3 text-xl sm:text-2xl md:text-3xl">
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, repeat: Infinity }} className="text-pink-300"><Icon name="palette" size="1em" /></motion.span>
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.2 }} className="text-violet-300"><Icon name="abacus" size="1em" /></motion.span>
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.4 }} className="text-cyan-300"><Icon name="book" size="1em" /></motion.span>
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.6 }} className="text-emerald-300"><Icon name="target" size="1em" /></motion.span>
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.8 }} className="text-amber-300"><Icon name="star" size="1em" /></motion.span>
          </div>
        </motion.div>
      </footer>

      {/* ================================================================
          LOADING OVERLAY
          ================================================================ */}
      <AnimatePresence>
        {loadingTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="relative overflow-hidden rounded-3xl border-4 border-white/25 px-8 py-7 shadow-2xl"
              style={{
                fontFamily: FONT,
                background: PANEL_BACKGROUND,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <Sparkle delay={0} className="absolute top-3 left-3 h-4 w-4" />
              <Sparkle delay={0.4} className="absolute top-4 right-5 h-4 w-4" />
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className="h-9 w-9 animate-spin rounded-full border-[4px] border-blue-400 border-t-transparent border-l-pink-400 border-b-cyan-400" />
                  <span className="absolute inset-0 flex items-center justify-center text-lg text-violet-300">
                    <Icon name="gamepad" size="1em" />
                  </span>
                </div>
                <div className="flex flex-col">
                  <p className="text-base sm:text-lg font-black" style={{ fontFamily: FONT, background: "linear-gradient(135deg, #c4b5fd 0%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    Loading game…
                  </p>
                  <p className="text-xs font-semibold" style={{ color: TEXT_SOFT }}>
                    The fun is on its way!
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================================================
// Public export
// ===========================================================================

export default function BetaHome() {
  return (
    <>
      <Helmet>
        <title>EZ Wonders | Interactive Learning Games for Kids</title>
        <meta
          name="description"
          content="EZ Wonders offers fun, interactive numeracy and learning games for young children. Practice counting, numbers, and more through playful activities."
        />
      </Helmet>

      <NameGate gameLabel="EZ Wonders">
        <BetaHomeContent />
      </NameGate>
    </>
  );
}