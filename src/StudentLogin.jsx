import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerStore } from './playerStore';
import { lookupStudentByCode } from './students';

// Auto-login route: /p/:code
// Extracts the code from the URL, validates it against the server, and
// logs the student in automatically. Redirects to home on success, shows
// an error on failure.
export default function StudentLogin() {
  const { code } = useParams();
  const navigate = useNavigate();
  const setStudentPlayer = usePlayerStore((s) => s.setStudentPlayer);
  const playerName = usePlayerStore((s) => s.playerName);

  const [status, setStatus] = useState('checking'); // 'checking' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setError('No student code found in the link.');
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const result = await lookupStudentByCode(code);

        if (cancelled) return;

        if (!result) {
          setStatus('error');
          setError('That code is not valid. Please check the link and try again.');
          return;
        }

        // result = { student: { studentId, nickname, fullName, code, group, ... }, classInfo: { classId, className, classType } }
        setStudentPlayer(result.student, result.classInfo);

        // Navigate home — the NameGate will see playerName is set and let them through
        navigate('/', { replace: true });
      } catch {
        if (cancelled) return;
        setStatus('error');
        setError('Could not connect to the server. Please try again.');
      }
    }

    // If the player is already logged in with this student code, just go home
    if (playerName && playerName !== 'Guest') {
      navigate('/', { replace: true });
      return;
    }

    verify();

    return () => { cancelled = true; };
  }, [code, navigate, setStudentPlayer, playerName]);

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
