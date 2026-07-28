import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlayerStore } from './playerStore';
import { lookupTeacher } from './teacherCodes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const CARD_CLASS =
  'relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-[2.5rem] bg-white px-8 py-9 text-center shadow-2xl';

// Nothing underneath mounts until this device has both a player and class.
// Old localStorage entries with just a name deliberately reopen this card with
// that name filled in, so the child only needs to choose their class once.
export default function NameGate({ gameLabel, children }) {
  const playerName = usePlayerStore((s) => s.playerName);
  const classId = usePlayerStore((s) => s.classId);
  const setPlayer = usePlayerStore((s) => s.setPlayer);
  const setTeacher = usePlayerStore((s) => s.setTeacher);

  const [mode, setMode] = useState('name');
  const [draft, setDraft] = useState(playerName || '');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classesStatus, setClassesStatus] = useState('loading');
  const [codeDraft, setCodeDraft] = useState('');
  const [codeError, setCodeError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/classes`)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load classes');
        return response.json();
      })
      .then((rows) => {
        if (cancelled) return;
        setClasses(Array.isArray(rows) ? rows : []);
        setClassesStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setClassesStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  const hasValidPlayer =
    playerName && playerName.trim().toLowerCase() !== 'guest' && classId;

  if (hasValidPlayer) return children;

  const handleNameSubmit = (event) => {
    event.preventDefault();
    const name = draft.trim();
    const classroom = classes.find((item) => item.id === selectedClassId);
    if (!name || name.toLowerCase() === 'guest' || !classroom) return;
    setPlayer(name, classroom);
  };

  const handleCodeSubmit = (event) => {
    event.preventDefault();
    const teacher = lookupTeacher(codeDraft);
    if (!teacher) {
      setCodeError("That code doesn't match — check with the office and try again.");
      return;
    }
    setTeacher(teacher, codeDraft.trim());
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap" />
      <div className="pointer-events-none absolute left-[8%] top-[10%] text-5xl opacity-80">☁️</div>
      <div className="pointer-events-none absolute right-[10%] top-[16%] text-4xl opacity-70">☁️</div>
      <div className="pointer-events-none absolute bottom-[12%] left-[12%] text-3xl opacity-70">✨</div>

      <AnimatePresence mode="wait">
        {mode === 'name' ? (
          <motion.form key="name" onSubmit={handleNameSubmit} initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className={CARD_CLASS}>
            <span className="text-6xl">👋</span>
            <div>
              <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-2xl font-bold text-slate-800 sm:text-3xl">What's your name?</h1>
              <p style={{ fontFamily: "'Nunito', sans-serif" }} className="mt-1 text-sm font-semibold text-slate-500 sm:text-base">
                {playerName && !classId ? 'Choose your class to continue.' : `We'll remember it for every game${gameLabel ? ` — ready for ${gameLabel}?` : '!'}`}
              </p>
            </div>
            <input autoFocus type="text" value={draft} maxLength={40} onChange={(event) => setDraft(event.target.value)} placeholder="Type your name..." style={{ fontFamily: "'Nunito', sans-serif" }} className="w-full rounded-full border-4 border-sky-200 bg-sky-50 px-5 py-3 text-center text-lg font-bold text-slate-700 outline-none focus:border-sky-400" />
            <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} disabled={classesStatus !== 'ready'} aria-label="Choose your class" style={{ fontFamily: "'Nunito', sans-serif" }} className="w-full appearance-none rounded-full border-4 border-violet-200 bg-violet-50 px-5 py-3 text-center text-lg font-bold text-slate-700 outline-none focus:border-violet-400 disabled:opacity-60">
              <option value="">{classesStatus === 'loading' ? 'Loading classes…' : classesStatus === 'error' ? 'Could not load classes' : 'Choose your class…'}</option>
              {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
            <button type="submit" disabled={!draft.trim() || !selectedClassId || classesStatus !== 'ready'} style={{ fontFamily: "'Fredoka', sans-serif" }} className="w-full rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-6 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50">Let's play! 🎉</button>
            <button type="button" onClick={() => { setCodeError(null); setMode('code'); }} style={{ fontFamily: "'Nunito', sans-serif" }} className="text-xs font-bold text-slate-400 underline underline-offset-2 hover:text-slate-500">🔑 Have a teacher's code?</button>
          </motion.form>
        ) : (
          <motion.form key="code" onSubmit={handleCodeSubmit} initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className={CARD_CLASS}>
            <span className="text-6xl">🔑</span>
            <div>
              <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-2xl font-bold text-slate-800 sm:text-3xl">Teacher code</h1>
              <p style={{ fontFamily: "'Nunito', sans-serif" }} className="mt-1 text-sm font-semibold text-slate-500 sm:text-base">Unlocks your class's games and statistics dashboard.</p>
            </div>
            <input autoFocus type="password" value={codeDraft} onChange={(event) => { setCodeDraft(event.target.value); setCodeError(null); }} placeholder="Enter your code" style={{ fontFamily: "'Nunito', sans-serif" }} className="w-full rounded-full border-4 border-sky-200 bg-sky-50 px-5 py-3 text-center text-lg font-bold text-slate-700 outline-none focus:border-sky-400" />
            {codeError && <p style={{ fontFamily: "'Nunito', sans-serif" }} className="-mt-2 text-xs font-bold text-rose-500">{codeError}</p>}
            <button type="submit" disabled={!codeDraft.trim()} style={{ fontFamily: "'Fredoka', sans-serif" }} className="w-full rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-6 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-50">Unlock ✨</button>
            <button type="button" onClick={() => { setCodeError(null); setMode('name'); }} style={{ fontFamily: "'Nunito', sans-serif" }} className="text-xs font-bold text-slate-400 underline underline-offset-2 hover:text-slate-500">‹ Back to name</button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
