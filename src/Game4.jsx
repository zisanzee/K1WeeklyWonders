import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'motion/react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import NameGate from './NameGate';
import GameAccessGate from './GameAccessGate';
import { usePlayerStore } from './playerStore';
import { logPlaySession } from './logPlaySession';

const TOTAL_ROUNDS = 12; // 3 free-split + 5 even-split + 4 target-split rounds
const FREE_TOTALS = [3, 4, 5];
const HALF_TOTALS = [4, 6, 8, 10, 8];
const TARGET_TOTALS = [7, 8, 9, 10];

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const CARGO_TYPES = [
  { key: 'alien', emoji: '👽', name: 'aliens' },
  { key: 'star', emoji: '⭐', name: 'stars' },
  { key: 'moonrock', emoji: '🪨', name: 'moon rocks' },
  { key: 'comet', emoji: '☄️', name: 'comets' },
  { key: 'ufo', emoji: '🛸', name: 'mini UFOs' },
  { key: 'planet', emoji: '🪐', name: 'mini planets' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.3;
  window.speechSynthesis.speak(utterance);
}

// Rounds 0-2: any two-way split. Rounds 3-7: split exactly in half (Red and
// Blue must match). Rounds 8-11: load a specific target pair with totals kept
// inside the friendly 1-10 range.
function modeForRound(index) {
  if (index < 3) return 'free';
  if (index < 8) return 'half';
  return 'target';
}

// Totals are chosen from friendly 1-10 values and kept as distinct as
// possible within each phase so the game stays varied and predictable.
function totalForRound(index, mode) {
  if (mode === 'free') {
    return FREE_TOTALS[index];
  }
  if (mode === 'half') {
    return HALF_TOTALS[index - 3];
  }
  return TARGET_TOTALS[index - 8];
}

function generateRound(index, prevCargoKey) {
  const pool = CARGO_TYPES.filter((c) => c.key !== prevCargoKey);
  const cargo = (pool.length ? pool : CARGO_TYPES)[Math.floor(Math.random() * (pool.length || CARGO_TYPES.length))];
  const mode = modeForRound(index);
  const total = totalForRound(index, mode);
  let targetA = null;
  let targetB = null;
  if (mode === 'half') {
    targetA = total / 2;
    targetB = total / 2;
  } else if (mode === 'target') {
    targetA = randInt(1, total - 1);
    targetB = total - targetA;
  }
  const items = Array.from({ length: total }, (_, i) => ({
    id: `r${index}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    location: 'pool',
    rotation: (Math.random() * 20 - 10).toFixed(1),
  }));
  return { index, mode, cargo, total, targetA, targetB, items };
}

// One shared source of truth for what Nova should say at the start of a
// round, so the mount effect, nextRound, and playAgain never drift apart.
function missionSpeech(round) {
  if (round.mode === 'free') {
    return `Split the ${round.total} ${round.cargo.name} between the two rockets, any way you like!`;
  }
  if (round.mode === 'half') {
    return `Split the ${round.total} ${round.cargo.name} evenly. Red and Blue Need the same amount!`;
  }
  return `Load ${round.targetA} into Red, and ${round.targetB} into Blue!`;
}

function Game4Inner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => generateRound(0, null));
  const [phase, setPhase] = useState('playing');
  const [feedback, setFeedback] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hasErred, setHasErred] = useState(false);
  const [muted, setMuted] = useState(false);
  const [redShake, setRedShake] = useState(false);
  const [blueShake, setBlueShake] = useState(false);
  const [bayPulse, setBayPulse] = useState(false);

  const hasLoggedRef = useRef(false);
  const peakStreakRef = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const leftCount = useMemo(() => round.items.filter((it) => it.location === 'left').length, [round.items]);
  const rightCount = useMemo(() => round.items.filter((it) => it.location === 'right').length, [round.items]);
  const poolCount = round.items.length - leftCount - rightCount;

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    speak(missionSpeech(round), muted);
    // Runs once, on mount, to announce the very first round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const zone = over.id;
    const current = round.items.find((it) => it.id === active.id);
    if (!current || current.location === zone) return;

    const updatedItems = round.items.map((it) => (it.id === active.id ? { ...it, location: zone } : it));
    setRound((r) => ({ ...r, items: updatedItems }));

    // Say the count and rocket color the moment the piece lands or leaves —
    // e.g. "4 blue" — nothing more, so it stays quick and easy to follow.
    if (zone === 'left' || zone === 'right') {
      const newCount = updatedItems.filter((it) => it.location === zone).length;
      const color = zone === 'left' ? 'red' : 'blue';
      speak(`${newCount} ${color}`, muted);
    } else if (zone === 'pool' && (current.location === 'left' || current.location === 'right')) {
      const newCount = updatedItems.filter((it) => it.location === current.location).length;
      const color = current.location === 'left' ? 'red' : 'blue';
      speak(`${newCount} ${color}`, muted);
    }
  };

  const bumpStreak = () => {
    setStreak((s) => {
      const next = hasErred ? 0 : s + 1;
      peakStreakRef.current = Math.max(peakStreakRef.current, next);
      return next;
    });
  };

  const handleCheck = () => {
    if (poolCount > 0) {
      setFeedback({ type: 'incomplete', poolCount });
      setHasErred(true);
      setStreak(0);
      setBayPulse(true);
      setTimeout(() => setBayPulse(false), 900);
      speak(`Place the last ${poolCount} cargo first!`, muted);
      return;
    }

    if (round.mode === 'free') {
      if (leftCount === 0 || rightCount === 0) {
        setFeedback({ type: 'empty-side' });
        setHasErred(true);
        setStreak(0);
        setRedShake(leftCount === 0);
        setBlueShake(rightCount === 0);
        setTimeout(() => {
          setRedShake(false);
          setBlueShake(false);
        }, 500);
        speak('Every rocket needs at least one!', muted);
        return;
      }
      setPhase('success');
      setStars((s) => s + 1);
      bumpStreak();
      speak(`Great splitting! Red ${leftCount}, Blue ${rightCount}!`, muted);
      return;
    }

    if (round.mode === 'half') {
      if (leftCount !== rightCount) {
        setFeedback({ type: 'uneven' });
        setHasErred(true);
        setStreak(0);
        setRedShake(true);
        setBlueShake(true);
        setTimeout(() => {
          setRedShake(false);
          setBlueShake(false);
        }, 500);
        speak('Not even yet — make Red and Blue match!', muted);
        return;
      }
      setPhase('success');
      setStars((s) => s + 1);
      bumpStreak();
      speak(`Perfectly balanced! Red and Blue both have ${leftCount}!`, muted);
      return;
    }

    // 'target' mode — the goal shown on each rocket is now specific to that
    // rocket, so the match must be exact rather than either-order.
    const matches = leftCount === round.targetA && rightCount === round.targetB;
    if (!matches) {
      setFeedback({ type: 'mismatch' });
      setHasErred(true);
      setStreak(0);
      setRedShake(true);
      setBlueShake(true);
      setTimeout(() => {
        setRedShake(false);
        setBlueShake(false);
      }, 500);
      speak(`Not quite! Red needs ${round.targetA}, Blue needs ${round.targetB}.`, muted);
      return;
    }
    setPhase('success');
    setStars((s) => s + 1);
    bumpStreak();
    speak(`Perfect! Red ${round.targetA}, Blue ${round.targetB}!`, muted);
  };

  const nextRound = () => {
    const next = roundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase('complete');
      speak(`Mission complete, ${playerName}! You're a splitting superstar!`, muted);
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true;
        logPlaySession({ game: 'game4', playerName, stars, totalRounds: TOTAL_ROUNDS, peakStreak: peakStreakRef.current });
      }
      return;
    }
    const newRound = generateRound(next, round.cargo.key);
    setRoundIndex(next);
    setRound(newRound);
    setFeedback(null);
    setHasErred(false);
    setPhase('playing');
    speak(missionSpeech(newRound), muted);
  };

  const playAgain = () => {
    const newRound = generateRound(0, null);
    setRoundIndex(0);
    setRound(newRound);
    setStars(0);
    setStreak(0);
    setHasErred(false);
    setFeedback(null);
    setPhase('playing');
    hasLoggedRef.current = false;
    peakStreakRef.current = 0;
    speak(missionSpeech(newRound), muted);
  };

  const poolItems = round.items.filter((it) => it.location === 'pool');
  const leftItems = round.items.filter((it) => it.location === 'left');
  const rightItems = round.items.filter((it) => it.location === 'right');
  const activeItem = round.items.find((it) => it.id === activeId);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#0B1130] via-[#1B1F52] to-[#3A2A6B]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />

      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes drift { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(10px,-12px); } }
        @keyframes pop-in { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
        @keyframes wobble { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2deg) scale(1.03); } 75% { transform: rotate(2deg) scale(1.03); } }
        @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 0 rgba(139,92,246,0); } 50% { box-shadow: 0 0 0 10px rgba(139,92,246,0.35); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        @keyframes flicker { 0%, 100% { transform: scaleY(1) translateY(0); opacity: 1; } 50% { transform: scaleY(1.25) translateY(2px); opacity: 0.8; } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-twinkle { animation: twinkle 2.4s ease-in-out infinite; }
        .animate-drift { animation: drift 7s ease-in-out infinite; }
        .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-wobble { animation: wobble 0.4s ease-in-out; }
        .animate-glow-pulse { animation: glow-pulse 0.9s ease-in-out 2; }
        .animate-shimmer { animation: shimmer 2.2s linear infinite; }
        .animate-flicker { animation: flicker 0.5s ease-in-out infinite; transform-origin: top center; }
      `}</style>

      <Starfield />

      <div className="pointer-events-none absolute inset-0">
        <div className="animate-drift absolute right-[8%] top-[8%] text-5xl opacity-90 sm:text-6xl">🪐</div>
        <div className="animate-drift absolute left-[6%] top-[18%] text-3xl opacity-80 sm:text-4xl" style={{ animationDelay: '2s' }}>
          🌙
        </div>
        <div className="animate-drift absolute bottom-[16%] right-[10%] text-2xl opacity-70 sm:text-3xl" style={{ animationDelay: '1s' }}>
          ☄️
        </div>
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center overflow-y-auto px-3 py-2 sm:px-4 sm:py-3">
        <TopBar totalRounds={TOTAL_ROUNDS} stars={stars} muted={muted} onToggleMute={() => setMuted((m) => !m)} />

        {phase === 'complete' ? (
          <CompletionScreen stars={stars} total={TOTAL_ROUNDS} playerName={playerName} onPlayAgain={playAgain} />
        ) : (
          <>
            <div className="mt-1 flex flex-col items-center gap-0.5 sm:mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl">🚀</span>
                <p className="font-heading text-sm font-bold text-white/95 drop-shadow sm:text-base">
                  Captain Nova's Cargo Split
                </p>
              </div>
              <p className="font-body text-[11px] font-bold text-white/80 sm:text-xs">
                Mission {roundIndex + 1} of {TOTAL_ROUNDS}
              </p>
              <RoundDots total={TOTAL_ROUNDS} current={roundIndex} markers={[3, 8]} />
            </div>

            <div className="mt-1 flex items-center justify-center gap-3 sm:mt-2 sm:gap-4">
              <NovaPrompt round={round} streak={streak} isWrong={!!feedback} />
              <MissionHeader round={round} />
            </div>

            {round.mode === 'half' && <BalanceScale leftCount={leftCount} rightCount={rightCount} />}

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <CargoBay items={poolItems} count={poolCount} cargo={round.cargo} disabled={phase !== 'playing'} pulse={bayPulse} />

              <div className="mt-3 flex w-full flex-1 flex-col gap-3 sm:mt-4 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
                <RocketZone
                  id="left"
                  label="Red Rocket"
                  color="red"
                  count={leftCount}
                  items={leftItems}
                  cargo={round.cargo}
                  disabled={phase !== 'playing'}
                  shake={redShake}
                  goal={round.mode === 'target' ? round.targetA : null}
                  matched={round.mode === 'target' && leftCount === round.targetA}
                />
                <RocketZone
                  id="right"
                  label="Blue Rocket"
                  color="blue"
                  count={rightCount}
                  items={rightItems}
                  cargo={round.cargo}
                  disabled={phase !== 'playing'}
                  shake={blueShake}
                  goal={round.mode === 'target' ? round.targetB : null}
                  matched={round.mode === 'target' && rightCount === round.targetB}
                />
              </div>

              <DragOverlay>
                {activeItem ? (
                  <div className="pointer-events-none flex h-12 w-12 scale-125 items-center justify-center rounded-2xl bg-white/50 text-3xl shadow-2xl sm:h-16 sm:w-16 sm:text-4xl">
                    {round.cargo.emoji}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <div className="mt-2 flex flex-col items-center gap-1.5 pb-2 sm:mt-3">
              {feedback && (
                <p className="font-body animate-pop-in rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-indigo-700 shadow sm:text-sm">
                  {feedback.type === 'incomplete' && `🛰️ ${feedback.poolCount} more cargo to place!`}
                  {feedback.type === 'empty-side' && '🚀 Every rocket needs at least one!'}
                  {feedback.type === 'uneven' && '⚖️ Not even yet — keep balancing!'}
                  {feedback.type === 'mismatch' && `Try Red ${round.targetA} and Blue ${round.targetB}!`}
                </p>
              )}
              {phase === 'playing' && (
                <button
                  onClick={handleCheck}
                  className="font-heading rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-7 py-2.5 text-base font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-8 sm:py-3 sm:text-lg"
                >
                  Check my split! 🚀
                </button>
              )}
            </div>

            {phase === 'success' && (
              <SuccessOverlay
                leftCount={leftCount}
                rightCount={rightCount}
                total={round.total}
                cargo={round.cargo}
                mode={round.mode}
                isLastRound={roundIndex + 1 >= TOTAL_ROUNDS}
                streak={streak}
                onNext={nextRound}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Game4() {
  return (
    <NameGate gameLabel="Game 4: Cargo Split">
      <GameAccessGate gameNumber={4} gameLabel="Game 4: Cargo Split">
        <Game4Inner />
      </GameAccessGate>
    </NameGate>
  );
}

function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 90,
        size: 4 + Math.random() * 6,
        delay: Math.random() * 2.4,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <span
          key={s.id}
          className="animate-twinkle absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function TopBar({ totalRounds, stars, muted, onToggleMute }) {
  return (
    <div className="flex w-full items-center justify-between">
      <Link
        to="/"
        className="font-body flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-4 sm:py-2 sm:text-base"
      >
        ⬅️ Home
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <StarMeter stars={stars} total={totalRounds} />
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base shadow-[0_4px_0_rgba(0,0,0,0.15)] active:translate-y-0.5 active:shadow-none sm:h-9 sm:w-9 sm:text-lg"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}

function StarMeter({ stars, total, dark }) {
  const pct = total > 0 ? Math.round((stars / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2" aria-label={`${stars} out of ${total} stars earned`}>
      <span className="text-xl sm:text-2xl">⭐</span>
      <div className={`h-2.5 w-16 overflow-hidden rounded-full sm:w-24 ${dark ? 'bg-slate-200' : 'bg-white/40'}`}>
        <div
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        >
          <span className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
      </div>
      <span className={`font-body text-xs font-extrabold sm:text-sm ${dark ? 'text-slate-700' : 'text-white drop-shadow'}`}>
        {stars}/{total}
      </span>
    </div>
  );
}

function RoundDots({ total, current, markers = [] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          {markers.includes(i) && <span className="mx-1 h-3 w-px bg-white/40" />}
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors sm:h-2 sm:w-2 ${
              i < current ? 'bg-white' : i === current ? 'animate-twinkle bg-yellow-300' : 'bg-white/30'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function NovaPrompt({ round, streak, isWrong }) {
  return (
    <div className="relative shrink-0">
      <motion.span
        className="inline-block text-4xl sm:text-5xl"
        animate={isWrong ? { x: [0, -6, 6, -6, 6, 0] } : { rotate: [-4, 4, -4], y: [0, -4, 0] }}
        transition={isWrong ? { duration: 0.4 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🧑‍🚀
      </motion.span>
      {streak >= 2 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="font-body absolute -right-2 -top-1 rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow"
        >
          🔥{streak}
        </motion.span>
      )}
    </div>
  );
}

// A big, bouncy number — the one shared "language" used everywhere instead
// of any +/= notation: the bay's count, and each rocket's count.
function BigNumber({ value, className }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 16 }}
      className={cn('font-heading text-4xl font-bold drop-shadow sm:text-5xl', className)}
    >
      {value}
    </motion.span>
  );
}

function MissionHeader({ round }) {
  return (
    <div className="animate-pop-in flex flex-col items-center gap-0.5 rounded-[1.5rem] bg-white/90 px-4 py-2 text-center shadow-[0_6px_0_rgba(0,0,0,0.15)] sm:px-5 sm:py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="font-heading text-3xl font-bold text-indigo-600 sm:text-4xl">{round.total}</span>
        <span className="text-2xl sm:text-3xl">{round.cargo.emoji}</span>
      </div>
      <p className="font-body text-xs font-bold text-slate-600 sm:text-sm">
  {round.mode === 'free' && `${round.cargo.name} — split any way you like!`}

  {round.mode === 'half' && `${round.cargo.name} — split evenly!`}

  {round.mode === 'target' && (
    <>
      Red needs{' '}
      <span className="text-lg font-extrabold text-red-500 sm:text-xl">
        {round.targetA}
      </span>
      , Blue needs{' '}
      <span className="text-lg font-extrabold text-blue-500 sm:text-xl">
        {round.targetB}
      </span>
      
    </>
  )}
</p>
    </div>
  );
}

// A literal seesaw: it visibly tilts toward whichever rocket has more, and
// levels out the moment Red and Blue match — no numbers needed to "get" it.
function BalanceScale({ leftCount, rightCount }) {
  const diff = Math.max(-4, Math.min(4, rightCount - leftCount));
  const angle = diff * 6;
  const balanced = leftCount === rightCount && leftCount > 0;
  return (
    <div className="animate-pop-in mt-1 flex flex-col items-center sm:mt-2">
      <svg viewBox="0 0 160 90" className="h-11 w-24 sm:h-14 sm:w-28">
        <line x1="80" y1="88" x2="80" y2="30" stroke="#C4B5FD" strokeWidth="6" strokeLinecap="round" />
        <polygon points="80,10 66,30 94,30" fill="#A78BFA" />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '80px 30px', transition: 'transform 0.4s ease' }}>
          <line x1="20" y1="30" x2="140" y2="30" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round" />
          <circle cx="20" cy="42" r="11" fill="#F87171" />
          <circle cx="140" cy="42" r="11" fill="#60A5FA" />
        </g>
      </svg>
      <p className={cn('font-body mt-1 text-xs font-bold', balanced ? 'text-emerald-300' : 'text-white/70')}>
        {balanced ? '⚖️ Balanced!' : 'Make them match!'}
      </p>
    </div>
  );
}

function CargoBay({ items, count, cargo, disabled, pulse }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'pool' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative mt-3 flex min-h-[clamp(4.5rem,15vh,7rem)] w-full flex-col items-center gap-1.5 rounded-[1.75rem] border-4 border-dashed border-indigo-300/50 bg-white/10 p-3 pt-7 shadow-inner backdrop-blur-sm transition-shadow sm:mt-4 sm:gap-2 sm:p-4 sm:pt-8',
        isOver && 'border-yellow-300 bg-white/20',
        pulse && 'animate-glow-pulse'
      )}
    >
      <span className="font-body absolute -top-3 left-4 rounded-full bg-white/90 px-3 py-0.5 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
        🛰️ Cargo Bay
      </span>
      <BigNumber value={count} className="text-indigo-100" />
      <div className="flex flex-wrap content-start items-start justify-center gap-1.5 sm:gap-2">
        {items.length === 0 && <span className="font-body text-sm font-bold text-white/70">All loaded!</span>}
        {items.map((it) => (
          <DraggableCargo key={it.id} id={it.id} emoji={cargo.emoji} rotation={it.rotation} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

const ROCKET_THEME = {
  red: {
    label: '🔴 Red Rocket',
    body: 'from-rose-300 to-rose-500 border-rose-800/70',
    ring: 'ring-rose-200',
  },
  blue: {
    label: '🔵 Blue Rocket',
    body: 'from-sky-300 to-sky-500 border-sky-800/70',
    ring: 'ring-sky-200',
  },
};

function RocketZone({ id, count, items, cargo, disabled, shake, color, goal, matched }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const theme = ROCKET_THEME[color];
  return (
    <div className="flex flex-1 flex-col items-center">
      <div
        ref={setNodeRef}
        className={cn(
          'relative flex min-h-[clamp(5.5rem,19vh,8.5rem)] w-full flex-col items-center gap-1.5 rounded-t-[2.5rem] rounded-b-2xl border-4 bg-gradient-to-b p-3 pt-7 shadow-inner transition-shadow sm:gap-2 sm:p-4 sm:pt-8',
          theme.body,
          isOver && `ring-4 ${theme.ring}`,
          shake && 'animate-shake',
          matched && 'ring-4 ring-emerald-300'
        )}
      >
        <span className="font-body absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3 py-0.5 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
          {theme.label}
        </span>
        <BigNumber value={count} className="text-white" />
        {goal != null && (
          <span
            className={cn(
              'font-body rounded-full px-2.5 py-0.5 text-xs font-extrabold shadow',
              matched ? 'bg-emerald-400 text-white' : 'bg-white/80 text-slate-600'
            )}
          >
            {matched ? '✅ Goal met!' : `🎯 Goal: ${goal}`}
          </span>
        )}
        <div className="flex flex-wrap content-start items-start justify-center gap-1.5 sm:gap-2">
          {items.length === 0 && <span className="font-body text-xs font-bold text-white/80 sm:text-sm">Drop cargo here!</span>}
          {items.map((it) => (
            <DraggableCargo key={it.id} id={it.id} emoji={cargo.emoji} rotation={it.rotation} disabled={disabled} />
          ))}
        </div>
      </div>
      <span className="animate-flicker -mt-1 text-2xl">🔥</span>
    </div>
  );
}

function DraggableCargo({ id, emoji, rotation, disabled }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        rotate: `${rotation}deg`,
        touchAction: 'none',
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-2xl text-lg transition-opacity duration-150 sm:h-12 sm:w-12 sm:text-2xl ${
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-0' : 'opacity-100'}`}
    >
      {emoji}
    </div>
  );
}

function SuccessOverlay({ leftCount, rightCount, total, cargo, isLastRound, streak, onNext }) {
  const { width, height } = useWindowSize();
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <Confetti
        width={width}
        height={height}
        numberOfPieces={streak >= 3 ? 160 : 90}
        recycle={false}
        gravity={0.24}
        colors={['#F87171', '#60A5FA', '#FCD34D', '#A78BFA', '#34D399']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <motion.div
        initial={{ scale: 0.7, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative flex max-w-sm flex-col items-center rounded-[2.5rem] bg-white px-8 py-8 text-center shadow-2xl"
      >
        <div className="text-6xl">{streak >= 3 ? '🌟' : '🚀'}</div>
        <p className="font-heading mt-2 text-2xl font-bold text-amber-500 sm:text-3xl">
          {streak >= 3 ? 'On a streak!' : 'Blast off!'}
        </p>
        <p className="font-body mt-2 text-base font-semibold text-slate-500 sm:text-lg">
          You split {total} {cargo.name} into {leftCount} and {rightCount}!
        </p>
        <button
          onClick={onNext}
          className="font-heading mt-6 rounded-full bg-gradient-to-b from-green-400 to-green-500 px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {isLastRound ? 'See my results! 🏆' : 'Next mission ➡️'}
        </button>
      </motion.div>
    </div>
  );
}

function CompletionScreen({ stars, total, playerName, onPlayAgain }) {
  const { width, height } = useWindowSize();
  return (
    <div className="relative mt-3 flex flex-col items-center rounded-[2.5rem] bg-white/90 px-6 py-6 text-center shadow-2xl sm:mt-6 sm:px-14 sm:py-10">
      <Confetti
        width={width}
        height={height}
        numberOfPieces={160}
        recycle={false}
        gravity={0.2}
        colors={['#F87171', '#60A5FA', '#FCD34D', '#A78BFA', '#34D399']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-5xl sm:text-7xl"
      >
        🚀
      </motion.div>
      <h2 className="font-heading mt-2 text-2xl font-bold text-slate-800 sm:mt-3 sm:text-4xl">
        Mission complete, {playerName}!
      </h2>
      <p className="font-body mt-1 text-base font-semibold text-slate-500 sm:mt-2 sm:text-lg">
        You earned {stars} out of {total} stars
      </p>
      <div className="mt-2 sm:mt-3">
        <StarMeter stars={stars} total={total} dark />
      </div>
      <div className="mt-5 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
        <button
          onClick={onPlayAgain}
          className="font-heading rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-6 py-2.5 text-base font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:py-3 sm:text-lg"
        >
          🔁 Play again
        </button>
        <Link
          to="/"
          className="font-heading rounded-full bg-gradient-to-b from-sky-400 to-sky-500 px-6 py-2.5 text-base font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:py-3 sm:text-lg"
        >
          🏠 Back home
        </Link>
      </div>
    </div>
  );
}