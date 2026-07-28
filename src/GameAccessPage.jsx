import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import NameGate from './NameGate';
import GameAccessPanel from './GameAccessPanel';
import { usePlayerStore } from './playerStore';

// Standalone route for the game access panel (was previously a modal
// toggled from Home). Still gated behind NameGate so classId/teacherCode
// are available if someone lands here directly (bookmark, refresh, etc.),
// and additionally checks isTeacher — this page has no purpose for players
// and shouldn't be reachable by them even if they guess the URL.
export default function GameAccessPage() {
  return (
    <>
      <Helmet>
        <title>Game Access | K1 Weekly Wonders</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <NameGate gameLabel="Game Access">
        <GameAccessPageContent />
      </NameGate>
    </>
  );
}

function GameAccessPageContent() {
  const navigate = useNavigate();
  const isTeacher = usePlayerStore((s) => s.isTeacher);

  if (!isTeacher) {
    return (
      <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4 text-center">
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
        />
        <span className="text-7xl">🔒</span>
        <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-2xl font-bold text-slate-800 sm:text-3xl">
          Teachers only
        </h1>
        <p style={{ fontFamily: "'Nunito', sans-serif" }} className="max-w-xs text-sm font-semibold text-slate-600 sm:text-base">
          This page is for teacher accounts only.
        </p>
        <Link
          to="/"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
          className="mt-2 rounded-full bg-white px-6 py-3 text-base font-bold text-slate-700 shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          🏠 Back home
        </Link>
      </div>
    );
  }

  // GameAccessPanel already renders as a full-screen fixed overlay, which
  // works fine as a page body too. Its close button / backdrop click /
  // Escape key all call onClose, so routing that to "/" instead of a
  // setState toggle is the only change needed to make it feel like a page.
  return <GameAccessPanel onClose={() => navigate('/')} />;
}
