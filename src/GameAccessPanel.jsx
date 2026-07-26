import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlayerStore } from './playerStore';
import { useGameAccessStore, setGameUnlocked } from './gameAccess';

// Metadata for the toggle list. Keep the `key` values in sync with
// GAME_KEYS in gameAccess.js / server.js. Each row also carries a small
// color identity (used only when the game is unlocked) so the list reads
// like a row of little "night lights" — off/grey until switched on.
const GAME_ROWS = [
  { key: '1', emoji: '🧺', label: 'Count & Win!', hue: '#38BDF8', tint: '#EFF9FF' },
  { key: '2', emoji: '🧸', label: 'Comparing Quantities', hue: '#A78BFA', tint: '#F5F1FF' },
  { key: '3', emoji: '🐙', label: 'Which Number?', hue: '#FB7185', tint: '#FFF0F2' },
  { key: '4', emoji: '🎲', label: 'Compare Die and Dominoes', hue: '#FBBF24', tint: '#FFF9E8' },
  { key: '5', emoji: '🚀', label: 'Making & Splitting Groups', hue: '#34D399', tint: '#EEFCF6' },
  { key: '6', emoji: '🗝️', label: 'Part-Part-Whole!', hue: '#2DD4BF', tint: '#EBFBF9' },
  { key: 'b1', emoji: '9️⃣', label: 'Number Pop! (Bonus)', hue: '#E879F9', tint: '#FDF1FE' },
];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
};

// Teacher-only panel, opened from a button on the homepage. Lets a teacher
// flip any game between "coming soon" and "unlocked" for every player —
// the toggle here is what /api/game-access actually stores server-side.
export default function GameAccessPanel({ onClose }) {
  const teacherCode = usePlayerStore((s) => s.teacherCode);
  const unlocked = useGameAccessStore((s) => s.unlocked);
  const loaded = useGameAccessStore((s) => s.loaded);
  const fetchGameAccess = useGameAccessStore((s) => s.fetchGameAccess);

  const [pendingKeys, setPendingKeys] = useState(() => new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loaded) fetchGameAccess();
  }, [loaded, fetchGameAccess]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unlockedCount = useMemo(
    () => GAME_ROWS.filter((row) => Boolean(unlocked[row.key])).length,
    [unlocked]
  );
  const allUnlocked = unlockedCount === GAME_ROWS.length;

  const markPending = (key, isPending) => {
    setPendingKeys((prev) => {
      const next = new Set(prev);
      isPending ? next.add(key) : next.delete(key);
      return next;
    });
  };

  const handleToggle = async (gameKey, nextValue) => {
    setError(null);
    markPending(gameKey, true);
    try {
      await setGameUnlocked(gameKey, nextValue, teacherCode);
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      markPending(gameKey, false);
    }
  };

  const handleBulk = async (nextValue) => {
    setError(null);
    setBulkPending(true);
    const targets = GAME_ROWS.filter((row) => Boolean(unlocked[row.key]) !== nextValue);
    try {
      await Promise.all(targets.map((row) => setGameUnlocked(row.key, nextValue, teacherCode)));
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Game access"
          className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500 px-6 pb-6 pt-6 sm:px-7 sm:pt-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-14 left-6 h-28 w-28 rounded-full bg-white/10"
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">
                  🔓
                </span>
                <div>
                  <h2
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                    className="text-xl font-bold text-white sm:text-2xl"
                  >
                    Game Access
                  </h2>
                  <p
                    style={{ fontFamily: "'Nunito', sans-serif" }}
                    className="mt-0.5 text-sm font-bold text-white/85"
                  >
                    Changes apply to every player right away.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                ✕
              </button>
            </div>

            {loaded && (
              <div className="relative mt-5 flex items-center justify-between gap-3">
                <div
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                  className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-extrabold text-white backdrop-blur-sm sm:text-sm"
                >
                  <span className="flex h-2 w-2 rounded-full bg-emerald-300" />
                  {unlockedCount} of {GAME_ROWS.length} unlocked
                </div>
                <button
                  type="button"
                  disabled={bulkPending}
                  onClick={() => handleBulk(!allUnlocked)}
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-indigo-600 shadow-sm transition hover:bg-white/90 disabled:opacity-60 sm:text-sm"
                >
                  {bulkPending ? 'Working…' : allUnlocked ? 'Lock all' : 'Unlock all'}
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5 sm:px-6">
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500"
                >
                  ⚠️ {error}
                </motion.p>
              )}
            </AnimatePresence>

            {!loaded ? (
              <ul className="flex flex-col gap-2">
                {GAME_ROWS.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-200" />
                    <span className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
                  </li>
                ))}
              </ul>
            ) : (
              <motion.ul
                variants={listVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2"
              >
                {GAME_ROWS.map((row) => {
                  const isOn = Boolean(unlocked[row.key]);
                  const isPending = pendingKeys.has(row.key);
                  return (
                    <motion.li
                      key={row.key}
                      variants={rowVariants}
                      animate={{ backgroundColor: isOn ? row.tint : '#F8FAFC' }}
                      transition={{ backgroundColor: { duration: 0.3 } }}
                      className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 sm:px-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <motion.span
                          animate={{
                            backgroundColor: isOn ? row.hue : '#E2E8F0',
                            filter: isOn ? 'grayscale(0)' : 'grayscale(1)',
                            opacity: isOn ? 1 : 0.55,
                          }}
                          transition={{ duration: 0.3 }}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm"
                        >
                          {row.emoji}
                        </motion.span>
                        <div className="min-w-0">
                          <p
                            style={{ fontFamily: "'Nunito', sans-serif" }}
                            className="truncate text-sm font-extrabold text-slate-700 sm:text-base"
                          >
                            {row.label}
                          </p>
                          <p
                            style={{ fontFamily: "'Nunito', sans-serif" }}
                            className={`text-xs font-bold ${isOn ? 'text-emerald-500' : 'text-slate-400'}`}
                          >
                            {isPending ? 'Saving…' : isOn ? 'Unlocked' : 'Coming soon'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        aria-label={`${isOn ? 'Lock' : 'Unlock'} ${row.label}`}
                        disabled={isPending}
                        onClick={() => handleToggle(row.key, !isOn)}
                        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-60 ${
                          isOn ? 'bg-emerald-400' : 'bg-slate-300'
                        }`}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                          className="absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[0.6rem] shadow-md"
                          style={{ left: isOn ? '1.75rem' : '0.25rem' }}
                        >
                          {isPending ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                          ) : (
                            <span>{isOn ? '🔓' : '🔒'}</span>
                          )}
                        </motion.span>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}