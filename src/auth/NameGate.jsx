import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from '@/auth/playerStore';
import ContactStrip from '@/ui/ContactStrip';
import { requestJson } from '@/api/apiClient';

const inputClass =
  'aura-input w-full rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-60';

const spring = { type: 'spring', stiffness: 260, damping: 24 };

// Reads a code from the URL (?code / ?studentCode / ?classCode / ?teacherCode)
// so links like ezwonders.com/?code=ABC123 auto-run the classify flow.
function codeFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('code') ||
    params.get('studentCode') ||
    params.get('classCode') ||
    params.get('teacherCode') ||
    ''
  );
}

// Code-first login. Step 1 asks for any code; the server classifies it and the
// gate then either signs the user straight in (student/teacher/admin code) or
// advances to step 2 (name for a public class, student code for a private one).
export default function NameGate({ gameLabel, children }) {
  const location = useLocation();
  const identityKind = usePlayerStore((state) => state.identityKind);
  const signInWithCode = usePlayerStore((state) => state.signInWithCode);
  const signInLight = usePlayerStore((state) => state.signInLight);

  const [step, setStep] = useState('code'); // 'code' | 'name' | 'studentcode'
  const [code, setCode] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [studentCodeDraft, setStudentCodeDraft] = useState('');
  const [classCtx, setClassCtx] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // A stored session only counts if it carries an identityKind, which every
  // path in the new code-first flow sets. Old pre-overhaul sessions are wiped
  // (see playerStore), so this reliably forces one fresh login per device.
  const signedIn = Boolean(identityKind);

  // Applies a code-lookup result: moves to step 2 for a class code, otherwise
  // signs in directly (the store re-validates and stores only the code).
  const applyLookup = async (data, rawCode) => {
    if (data.kind === 'classCode') {
      setClassCtx(data);
      setStep(data.isPublic ? 'name' : 'studentcode');
      return;
    }
    const kind = await signInWithCode(rawCode);
    if (!kind) {
      throw new Error(
        "That code wasn't recognized. Try again or ask your teacher."
      );
    }
  };

  const classify = async (rawCode) => {
    try {
      return await requestJson('/api/code-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: rawCode }),
        timeoutMs: 12_000,
      });
    } catch (err) {
      // /api/code-lookup is rate limited, and a 429 is NOT a bad code. Falling
      // back to the generic message told a child their code was wrong and sent
      // them off to find a teacher — when all they had to do was wait a minute.
      if (err.status === 429) {
        throw new Error('Too many tries just now. Please wait a minute and try again.', {
          cause: err,
        });
      }
      if (err.isTimeout) {
        throw new Error('The server is taking too long. Please try again.', { cause: err });
      }
      throw new Error(
        err?.body?.error || "That code wasn't recognized. Try again or ask your teacher.",
        { cause: err }
      );
    }
  };

  // Auto-run the flow once when a code is present in the URL.
  useEffect(() => {
    const urlCode = codeFromUrl();
    if (!urlCode) return undefined;
    setCode(urlCode);
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const data = await classify(urlCode);
        if (!cancelled) await applyLookup(data, urlCode);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run whenever the URL's query string changes so an in-app ?code= link
    // (not just a fresh page load) signs the matching user in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  if (signedIn) return children;

  const submitCode = async (event) => {
    event.preventDefault();
    const raw = code.trim();
    if (!raw || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyLookup(await classify(raw), raw);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitName = async (event) => {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name || busy || !classCtx) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await signInLight(name, classCtx.classCode);
      if (!ok) throw new Error('Could not sign in. Please check your details.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitStudentCode = async (event) => {
    event.preventDefault();
    const sc = studentCodeDraft.trim();
    if (!sc || busy) return;
    setBusy(true);
    setError(null);
    try {
      const kind = await signInWithCode(sc);
      if (!kind) throw new Error('That student code was not recognised.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const header = {
    code: { emoji: '🔑', eyebrow: 'EZ Wonders', title: 'Welcome!', blurb: 'Enter your code to get started.' },
    name: { emoji: '🙋', eyebrow: 'Public class', title: "What's your name?", blurb: classCtx?.className ? `Joining ${classCtx.className}.` : 'Tell us who you are.' },
    studentcode: { emoji: '🎫', eyebrow: 'Private class', title: 'Enter your student code', blurb: classCtx?.className ? `Enter your student code for ${classCtx.className}.` : 'Your class needs an individual code.' },
  }[step];

  return (
    // `overflow-x-hidden` rather than `overflow-hidden`: the decorative blobs
    // are clipped by their own wrapper below, leaving vertical overflow
    // reachable. With `overflow-hidden` here, a short viewport (or a taller
    // form) silently clipped the contact strip off the bottom — and since
    // html/body don't scroll, it was unreachable rather than merely off-screen.
    <main className="aura-page relative flex min-h-[100dvh] flex-col items-center overflow-x-hidden px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-16 h-48 w-48 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute -right-12 bottom-6 h-52 w-52 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="absolute left-[7%] top-[12%] text-4xl opacity-70 sm:text-5xl">&#9729;&#65039;</div>
        <div className="absolute right-[8%] top-[20%] text-3xl opacity-60 sm:text-4xl">&#10024;</div>
        <div className="absolute bottom-[9%] left-[10%] text-3xl opacity-55">&#127800;</div>
      </div>

      {/* `my-auto` on one wrapper rather than `justify-center` on the main:
          centred when there is room, but starting at the top when there is
          not, so tall content can never overflow past the top edge where
          scrolling cannot reach it. */}
      <div className="relative z-10 my-auto flex w-full max-w-md flex-col items-center gap-5">
      <AnimatePresence mode="wait">
        <motion.form
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={spring}
          onSubmit={
            step === 'code'
              ? submitCode
              : step === 'name'
                ? submitName
                : submitStudentCode
          }
          className="aura-panel relative z-10 w-full max-w-md overflow-hidden rounded-[2rem]"
        >
          <div className="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 px-6 pb-6 pt-7 text-center text-white sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/45 bg-white/20 text-3xl shadow-lg">
              {header.emoji}
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
              {header.eyebrow}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-[2rem]">
              {header.title}
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-relaxed text-white/90">
              {gameLabel ? `Get ready for ${gameLabel}` : header.blurb}
            </p>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-7">
            {step === 'code' && (
              <div>
                <label htmlFor="entry-code" className="aura-soft mb-2 block text-sm font-extrabold">
                  Enter your code
                </label>
                <input
                  id="entry-code"
                  autoFocus
                  autoComplete="off"
                  type="text"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(null);
                  }}
                  placeholder="Class code, student code, or teacher code"
                  className={inputClass}
                />
              </div>
            )}

            {step === 'name' && (
              <div>
                <label htmlFor="entry-name" className="aura-soft mb-2 block text-sm font-extrabold">
                  Your name
                </label>
                <input
                  id="entry-name"
                  autoFocus
                  autoComplete="name"
                  type="text"
                  value={nameDraft}
                  maxLength={40}
                  onChange={(event) => {
                    setNameDraft(event.target.value);
                    setError(null);
                  }}
                  placeholder="Type your name"
                  className={inputClass}
                />
              </div>
            )}

            {step === 'studentcode' && (
              <div>
                <label htmlFor="entry-student-code" className="aura-soft mb-2 block text-sm font-extrabold">
                  Student code
                </label>
                <input
                  id="entry-student-code"
                  autoFocus
                  autoComplete="off"
                  type="text"
                  value={studentCodeDraft}
                  onChange={(event) => {
                    setStudentCodeDraft(event.target.value);
                    setError(null);
                  }}
                  placeholder="Your 6-character code"
                  className={inputClass}
                />
              </div>
            )}

            {error && (
              <p
                className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-bold text-rose-100"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={
                busy ||
                (step === 'code' && !code.trim()) ||
                (step === 'name' && !nameDraft.trim()) ||
                (step === 'studentcode' && !studentCodeDraft.trim())
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-4 text-lg font-black text-white shadow-[0_6px_0_rgba(190,24,93,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(190,24,93,0.24)] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  Checking…
                </>
              ) : (
                <>
                  {step === 'code' ? 'Next' : "Let's play"}{' '}
                  <span aria-hidden="true">&rarr;</span>
                </>
              )}
            </button>

            {step !== 'code' && (
              <button
                type="button"
                onClick={() => {
                  setStep('code');
                  setError(null);
                  setClassCtx(null);
                }}
                disabled={busy}
                className="aura-soft mx-auto block text-sm font-extrabold transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                &larr; Use a different code
              </button>
            )}
          </div>
        </motion.form>
      </AnimatePresence>

      <ContactStrip
        heading="Need help? Reach out"
        className="w-full"
        hint="Stuck with your code, or need a class set up? Email us any time."
      />
      </div>
    </main>
  );
}
