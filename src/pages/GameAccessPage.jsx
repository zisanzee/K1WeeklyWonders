import { lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import NameGate from '@/auth/NameGate';
import { usePlayerStore } from '@/auth/playerStore';
import BrandLoader from '@/ui/BrandLoader';

// The panel is a ~120KB source module. Keeping it behind its own import() means
// the route's own chunk (the small gated shell below) resolves instantly, and
// BetaHome warms the panel chunk on hover — so by the time the teacher taps
// "Teacher controls" there is usually nothing left to download. See the
// matching dynamic import in the teacher nav bar on BetaHome.
//
// Both sites MUST use the identical specifier ('./GameAccessPanel') or the
// bundler emits two chunks and the prefetch warms the wrong one.
const GameAccessPanel = lazy(() => import('@/pages/GameAccessPanel'));

// Standalone route for the game access panel (was previously a modal
// toggled from Home). Still gated behind NameGate so classId/teacherCode
// are available if someone lands here directly (bookmark, refresh, etc.),
// and additionally checks isTeacher — this page has no purpose for players
// and shouldn't be reachable by them even if they guess the URL.
export default function GameAccessPage() {
  return (
    <>
      <Helmet>
        <title>Game Access | EZ Wonders</title>
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
        <span className="text-7xl drop-shadow-[0_2px_8px_rgba(76,29,149,0.18)]">🔒</span>
        <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="aura-text text-2xl font-bold sm:text-3xl">
          Teachers only
        </h1>
        <p className="font-body aura-soft max-w-xs text-sm font-semibold sm:text-base">
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
  return (
    <Suspense fallback={<BrandLoader />}>
      <GameAccessPanel onClose={() => navigate('/')} initialTab={initialTab} />
    </Suspense>
  );
}
