import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || undefined;

  if (!isTeacher) {
    return (
      <div className="aura-page flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 px-4 text-center">
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
        />
        <span className="text-7xl drop-shadow-[0_2px_8px_rgba(76,29,149,0.18)]">🔒</span>
        <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="aura-text text-2xl font-bold sm:text-3xl">
          Teachers only
        </h1>
        <p style={{ fontFamily: "'Nunito', sans-serif" }} className="aura-soft max-w-xs text-sm font-semibold sm:text-base">
          This page is for teacher accounts only.
        </p>
        <Link
          to="/"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
          className="aura-btn aura-btn-violet mt-2 px-6 py-3 text-base font-black"
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
  return <GameAccessPanel onClose={() => navigate('/')} initialTab={initialTab} />;
}
