import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerStore } from './playerStore';

// Auto-login route: /p/:code
// Extracts the code from the URL, validates it against the server, and logs the
// student in. The store persists only the code and re-resolves the identity
// from the DB, so a removed student no longer stays logged in.
export default function StudentLogin() {
  const { code } = useParams();
  const navigate = useNavigate();
  const signInWithCode = usePlayerStore((s) => s.signInWithCode);

  const [status, setStatus] = useState('checking'); // 'checking' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setError('No student code found in the link.');
      return undefined;
    }

    let cancelled = false;

    async function verify() {
      try {
        const kind = await signInWithCode(code);
        if (cancelled) return;

        if (!kind) {
          setStatus('error');
          setError('That code is not valid. Please check the link and try again.');
          return;
        }

        navigate('/', { replace: true });
      } catch {
        if (cancelled) return;
        setStatus('error');
        setError('Could not connect to the server. Please try again.');
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, signInWithCode]);

  if (status === 'error') {
    return (
      <main className="aura-page flex min-h-[100dvh] items-center justify-center px-4 py-6">
        <div className="aura-panel w-full max-w-sm rounded-[2rem] p-8 text-center">
          <span className="text-5xl">😕</span>
          <h1 className="aura-text mt-4 text-xl font-black">Oops!</h1>
          <p className="aura-soft mt-2 text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="aura-btn aura-btn-violet mt-6 px-6 py-3 text-sm font-black"
          >
            Go to home page
          </button>
        </div>
      </main>
    );
  }

  // Checking / loading state
  return (
    <main className="aura-page flex min-h-[100dvh] items-center justify-center px-4 py-6">
      <div className="flex flex-col items-center gap-4">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-violet-300 border-t-fuchsia-400" />
        <p className="aura-soft text-sm font-bold">Logging you in…</p>
      </div>
    </main>
  );
}
