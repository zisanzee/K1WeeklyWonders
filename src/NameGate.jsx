import { useState } from 'react';
import { motion } from 'motion/react';
import { usePlayerStore } from './playerStore';

// Wrap a game's default export with this. It shows a one-time "what's your
// name" card the very first time someone plays ANY game on this device,
// then remembers the name (via playerStore, persisted in localStorage) so
// it never asks again. `children` (the actual game) only mounts once a
// name is set, so the game's own hooks/speech never fire under the prompt.
export default function NameGate({ gameLabel, children }) {
  const playerName = usePlayerStore((s) => s.playerName);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const [draft, setDraft] = useState('');

  if (playerName) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    setPlayerName(draft);
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8] px-4">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />
      <div className="pointer-events-none absolute left-[8%] top-[10%] text-5xl opacity-80">☁️</div>
      <div className="pointer-events-none absolute right-[10%] top-[16%] text-4xl opacity-70">☁️</div>
      <div className="pointer-events-none absolute bottom-[12%] left-[12%] text-3xl opacity-70">✨</div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-[2.5rem] bg-white px-8 py-9 text-center shadow-2xl"
      >
        <span className="text-6xl">👋</span>
        <div>
          <h1 style={{ fontFamily: "'Fredoka', sans-serif" }} className="text-2xl font-bold text-slate-800 sm:text-3xl">
            What's your name?
          </h1>
          <p style={{ fontFamily: "'Nunito', sans-serif" }} className="mt-1 text-sm font-semibold text-slate-500 sm:text-base">
            We'll remember it for every game{gameLabel ? ` — ready for ${gameLabel}?` : '!'}
          </p>
        </div>
        <input
          autoFocus
          type="text"
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your name..."
          style={{ fontFamily: "'Nunito', sans-serif" }}
          className="w-full rounded-full border-4 border-sky-200 bg-sky-50 px-5 py-3 text-center text-lg font-bold text-slate-700 outline-none focus:border-sky-400"
        />
        <button
          type="submit"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
          className="w-full rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-6 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          Let's play! 🎉
        </button>
        <button
          type="button"
          onClick={() => setPlayerName('Guest')}
          style={{ fontFamily: "'Nunito', sans-serif" }}
          className="text-xs font-bold text-slate-400 underline underline-offset-2 hover:text-slate-500"
        >
          Skip, just call me Guest
        </button>
      </motion.form>
    </div>
  );
}
