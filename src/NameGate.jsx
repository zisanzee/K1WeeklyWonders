import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from './playerStore';
import { lookupTeacher } from './teacherCodes';

const inputClass =
  'w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60';

// Everyone who comes in through the name prompt lands in the original K1
// class — there's no class picker anymore. Teachers still get their own
// class via their teacher code (see handleCodeSubmit below).
const DEFAULT_CLASS = { id: 'k12026-pny', name: 'Kindergarten 1' };

export default function NameGate({ gameLabel, children }) {
  const playerName = usePlayerStore((state) => state.playerName);
  const setPlayer = usePlayerStore((state) => state.setPlayer);
  const setTeacher = usePlayerStore((state) => state.setTeacher);

  const [mode, setMode] = useState('player');
  const [draft, setDraft] = useState(playerName || '');
  const [codeDraft, setCodeDraft] = useState('');
  const [codeError, setCodeError] = useState(null);

  // Once a name is stored, never prompt again — no class check needed
  // since everyone shares the same default class now.
  const hasValidPlayer = playerName && playerName.trim().toLowerCase() !== 'guest';

  if (hasValidPlayer) return children;

  const handleNameSubmit = (event) => {
    event.preventDefault();
    const name = draft.trim();

    if (!name || name.toLowerCase() === 'guest') return;
    setPlayer(name, DEFAULT_CLASS);
  };

  const handleCodeSubmit = (event) => {
    event.preventDefault();
    const teacher = lookupTeacher(codeDraft);

    if (!teacher) {
      setCodeError("That code doesn't match. Please check it and try again.");
      return;
    }

    setTeacher(teacher, codeDraft.trim());
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#eaf8ff] px-4 py-6 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#bcecff_0%,_transparent_35%),radial-gradient(circle_at_bottom_right,_#fde6a8_0%,_transparent_36%),linear-gradient(145deg,_#edfaff_0%,_#d9f4ff_46%,_#fff4cf_100%)]" />
      <div className="pointer-events-none absolute -left-16 top-16 h-48 w-48 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-6 h-52 w-52 rounded-full bg-amber-200/55 blur-3xl" />
      <div className="pointer-events-none absolute left-[7%] top-[12%] text-4xl opacity-70 sm:text-5xl">&#9729;&#65039;</div>
      <div className="pointer-events-none absolute right-[8%] top-[20%] text-3xl opacity-60 sm:text-4xl">&#10024;</div>
      <div className="pointer-events-none absolute bottom-[9%] left-[10%] text-3xl opacity-55">&#127800;</div>

      <AnimatePresence mode="wait">
        {mode === 'player' ? (
          <motion.form
            key="player"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onSubmit={handleNameSubmit}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(47,111,151,0.22)] backdrop-blur"
          >
            <div className="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 px-6 pb-6 pt-7 text-center text-white sm:px-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/45 bg-white/20 text-3xl shadow-lg">
                &#127922;
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
                K1 Weekly Wonders
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-[2rem]">
                Ready to play?
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-relaxed text-white/90">
                Tell us who you are to see today&apos;s games.
              </p>
            </div>

            <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex items-center gap-3 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-800">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs text-white">1</span>
                <span>{gameLabel ? `Get ready for ${gameLabel}` : 'Tell us your name'}</span>
              </div>

              <div>
                <label htmlFor="player-name" className="mb-2 block text-sm font-extrabold text-slate-700">
                  Your name
                </label>
                <input
                  id="player-name"
                  autoFocus
                  autoComplete="name"
                  type="text"
                  value={draft}
                  maxLength={40}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type your name"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={!draft.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-4 text-lg font-black text-white shadow-[0_6px_0_rgba(190,24,93,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(190,24,93,0.24)] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
              >
                Let&apos;s play <span aria-hidden="true">&rarr;</span>
              </button>

              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setCodeError(null);
                  setMode('teacher');
                }}
                className="mx-auto flex items-center gap-2 text-sm font-extrabold text-slate-500 transition hover:text-sky-700"
              >
                <span aria-hidden="true">&#128273;</span> I have a teacher code
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.form
            key="teacher"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onSubmit={handleCodeSubmit}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(47,111,151,0.22)] backdrop-blur"
          >
            <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 px-6 pb-6 pt-7 text-center text-white sm:px-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/45 bg-white/20 text-3xl shadow-lg">
                &#128273;
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
                Teacher access
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-[2rem]">
                Welcome back
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-relaxed text-white/90">
                Use your code to manage game access and view class progress.
              </p>
            </div>

            <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-7">
              <div>
                <label htmlFor="teacher-code" className="mb-2 block text-sm font-extrabold text-slate-700">
                  Teacher code
                </label>
                <input
                  id="teacher-code"
                  autoFocus
                  autoComplete="off"
                  type="password"
                  value={codeDraft}
                  onChange={(event) => {
                    setCodeDraft(event.target.value);
                    setCodeError(null);
                  }}
                  placeholder="Enter your code"
                  className={inputClass}
                />
                {codeError && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600" role="alert">
                    {codeError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!codeDraft.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-lg font-black text-white shadow-[0_6px_0_rgba(67,56,202,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(67,56,202,0.24)] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
              >
                Open teacher controls <span aria-hidden="true">&rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCodeError(null);
                  setMode('player');
                }}
                className="mx-auto block text-sm font-extrabold text-slate-500 transition hover:text-indigo-700"
              >
                &larr; Back to player sign in
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  );
}