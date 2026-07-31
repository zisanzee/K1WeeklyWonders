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
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#eaf8ff] px-4 py-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-[0_24px_70px_rgba(47,111,151,0.22)]">
          <span className="text-5xl">😕</span>
          <h1 className="mt-4 text-xl font-black text-slate-800">Oops!</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:from-sky-600 hover:to-indigo-700"
          >
            Go to home page
          </button>
        </div>
      </main>
    );
  }

  // Checking / loading state
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#eaf8ff] px-4 py-6">
      <div className="flex flex-col items-center gap-4">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-sky-300 border-t-sky-600" />
        <p className="text-sm font-bold text-slate-600">Logging you in…</p>
      </div>
    </main>
  );
}
