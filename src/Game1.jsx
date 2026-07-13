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

const TOTAL_ROUNDS = 10;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CATEGORIES = [
  {
    key: 'fruit',
    items: [
      { emoji: '🍎', name: 'apples' },
      { emoji: '🍌', name: 'bananas' },
      { emoji: '🍇', name: 'grapes' },
      { emoji: '🍊', name: 'oranges' },
      { emoji: '🍓', name: 'strawberries' },
    ],
  },
  {
    key: 'animal',
    items: [
      { emoji: '🐶', name: 'puppies' },
      { emoji: '🐱', name: 'kittens' },
      { emoji: '🐰', name: 'bunnies' },
      { emoji: '🐻', name: 'bears' },
      { emoji: '🐼', name: 'pandas' },
    ],
  },
  {
    key: 'toy',
    items: [
      { emoji: '🧸', name: 'teddy bears' },
      { emoji: '🚗', name: 'cars' },
      { emoji: '🎈', name: 'balloons' },
      { emoji: '🪀', name: 'yoyos' },
      { emoji: '🎲', name: 'dice' },
    ],
  },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRoundPlan() {
  const numbers = shuffle(Array.from({ length: 10 }, (_, i) => i + 1));
  const formats = shuffle([...Array(5).fill('numeral'), ...Array(5).fill('word')]);
  return numbers.map((target, i) => ({ target, format: formats[i] }));
}

function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.3;
  window.speechSynthesis.speak(utterance);
}

function generateRound(roundIndex, prevCategoryKey, target, format) {
  const pool = CATEGORIES.length > 1 ? CATEGORIES.filter((c) => c.key !== prevCategoryKey) : CATEGORIES;
  const category = pool[Math.floor(Math.random() * pool.length)];
  const item = category.items[Math.floor(Math.random() * category.items.length)];
  const extra = 2 + Math.floor(Math.random() * 3); // 2-4 decoy items beyond the target
  const poolCount = target + extra;
  const items = Array.from({ length: poolCount }, (_, i) => ({
    id: `r${roundIndex}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    location: 'pool',
    rotation: (Math.random() * 20 - 10).toFixed(1),
  }));
  return { category, item, target, format, items };
}

function Game1Inner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const [roundPlan, setRoundPlan] = useState(() => generateRoundPlan());
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => generateRound(0, null, roundPlan[0].target, roundPlan[0].format));
  const [phase, setPhase] = useState('playing');
  const [feedback, setFeedback] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hasErred, setHasErred] = useState(false);
  const [muted, setMuted] = useState(false);
  const [basketPulse, setBasketPulse] = useState(false);
  const [basketShake, setBasketShake] = useState(false);
  const [poolPulse, setPoolPulse] = useState(false);

  const prevBasketCountRef = useRef(0);
  const hasLoggedRef = useRef(false);
  const peakStreakRef = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const basketCount = useMemo(() => round.items.filter((it) => it.location === 'basket').length, [round.items]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    speak(`Fill the basket with ${round.target} ${round.item.name}!`, muted);
    // Runs once, on mount, to announce the very first round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (basketCount !== prevBasketCountRef.current) {
      if (basketCount > 0 && phase === 'playing') speak(String(basketCount), muted);
      prevBasketCountRef.current = basketCount;
      if (basketCount > 0) {
        setBasketPulse(true);
        const t = setTimeout(() => setBasketPulse(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [basketCount, muted, phase]);

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
    setRound((r) => {
      const current = r.items.find((it) => it.id === active.id);
      if (!current || current.location === zone) return r;
      return { ...r, items: r.items.map((it) => (it.id === active.id ? { ...it, location: zone } : it)) };
    });
  };

  const handleCheck = () => {
    if (basketCount === round.target) {
      setPhase('success');
      setStars((s) => s + 1);
      setStreak((s) => {
        const next = hasErred ? 0 : s + 1;
        peakStreakRef.current = Math.max(peakStreakRef.current, next);
        return next;
      });
      speak(`Perfect! You counted ${round.target} ${round.item.name}!`, muted);
    } else if (basketCount > round.target) {
      const diff = basketCount - round.target;
      setFeedback({ over: true, diff });
      setHasErred(true);
      setStreak(0);
      setBasketShake(true);
      setTimeout(() => setBasketShake(false), 500);
      speak(`Too many! Take out ${diff}.`, muted);
    } else {
      const diff = round.target - basketCount;
      setFeedback({ over: false, diff });
      setHasErred(true);
      setStreak(0);
      setPoolPulse(true);
      setTimeout(() => setPoolPulse(false), 900);
      speak(`Not enough! Add ${diff} more.`, muted);
    }
  };

  const nextRound = () => {
    const next = roundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase('complete');
      speak(`Amazing job, ${playerName}! You're a counting champion!`, muted);
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true;
        logPlaySession({ game: 'game1', playerName, stars, totalRounds: TOTAL_ROUNDS, peakStreak: peakStreakRef.current });
      }
      return;
    }
    const newRound = generateRound(next, round.category.key, roundPlan[next].target, roundPlan[next].format);
    setRoundIndex(next);
    setRound(newRound);
    prevBasketCountRef.current = 0;
    setFeedback(null);
    setHasErred(false);
    setPhase('playing');
    speak(`Fill the basket with ${newRound.target} ${newRound.item.name}!`, muted);
  };

  const playAgain = () => {
    const newPlan = generateRoundPlan();
    const newRound = generateRound(0, null, newPlan[0].target, newPlan[0].format);
    setRoundPlan(newPlan);
    setRoundIndex(0);
    setRound(newRound);
    prevBasketCountRef.current = 0;
    setStars(0);
    setStreak(0);
    setHasErred(false);
    setFeedback(null);
    setPhase('playing');
    hasLoggedRef.current = false;
    peakStreakRef.current = 0;
    speak(`Fill the basket with ${newRound.target} ${newRound.item.name}!`, muted);
  };

  const poolItems = round.items.filter((it) => it.location === 'pool');
  const basketItems = round.items.filter((it) => it.location === 'basket');

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-lime-100">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />

      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-20px) translateX(10px); } }
        @keyframes float-slower { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes pop-in { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes sparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(360deg); opacity: 0.9; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
        @keyframes wobble { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2deg) scale(1.03); } 75% { transform: rotate(2deg) scale(1.03); } }
        @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 0 rgba(255,217,61,0); } 50% { box-shadow: 0 0 0 10px rgba(255,217,61,0.35); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        @keyframes basket-rock { 0%, 100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; }
        .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; }
        .animate-confetti-fall { animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: forwards; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-wobble { animation: wobble 0.4s ease-in-out; }
        .animate-glow-pulse { animation: glow-pulse 0.9s ease-in-out 2; }
        .animate-shimmer { animation: shimmer 2.2s linear infinite; }
        .animate-basket-rock { animation: basket-rock 4s ease-in-out infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[6%] text-4xl sm:text-5xl animate-float-slow">☁️</div>
        <div className="absolute right-[8%] top-[10%] text-3xl sm:text-4xl animate-float-slower">☁️</div>
        <div className="absolute right-[10%] top-[40%] text-2xl animate-sparkle">✨</div>
        <div className="absolute left-[8%] top-[35%] text-2xl animate-sparkle" style={{ animationDelay: '0.5s' }}>⭐</div>
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col items-center overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex w-full flex-none items-center justify-between">
          <TopBar totalRounds={TOTAL_ROUNDS} stars={stars} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
        </div>

        {phase === 'complete' ? (
          <div className="flex w-full flex-1 min-h-0 items-center justify-center overflow-y-auto">
            <CompletionScreen stars={stars} total={TOTAL_ROUNDS} playerName={playerName} onPlayAgain={playAgain} />
          </div>
        ) : (
          <div className="flex w-full flex-1 min-h-0 flex-col items-center overflow-y-auto">
            <p className="font-heading mt-1 text-lg font-bold text-white/95 drop-shadow sm:text-xl md:text-2xl">
              🧺 Harvest Challenge!
            </p>
            <p className="font-body text-xs font-bold text-white/80 sm:text-sm">
              Round {roundIndex + 1} of {TOTAL_ROUNDS}
            </p>
            <RoundDots total={TOTAL_ROUNDS} current={roundIndex} />

            <FarmerPrompt target={round.target} item={round.item} streak={streak} isWrong={!!feedback} />

            <TargetCard target={round.target} item={round.item} format={round.format} />

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="relative mt-2 flex w-full flex-1 min-h-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
                <PoolZone items={poolItems} item={round.item} disabled={phase !== 'playing'} pulse={poolPulse} />
                <BasketZone
                  items={basketItems}
                  item={round.item}
                  count={basketCount}
                  disabled={phase !== 'playing'}
                  pulse={basketPulse}
                  shake={basketShake}
                />
              </div>

              <DragOverlay>
                {activeId ? (
                  <div className="pointer-events-none flex h-14 w-14 scale-125 items-center justify-center rounded-2xl bg-white/50 text-3xl shadow-2xl sm:h-20 sm:w-20 sm:text-5xl">
                    {round.item.emoji}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <div className="mt-2 flex flex-none flex-col items-center gap-1.5 pb-1">
              {feedback && (
                <p
                  className={`font-body animate-pop-in rounded-full px-4 py-1.5 text-sm font-bold shadow sm:text-base ${
                    feedback.over ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {feedback.over ? `Too many! Take out ${feedback.diff} 🧺` : `Add ${feedback.diff} more! 🌟`}
                </p>
              )}
              {phase === 'playing' && (
                <button
                  onClick={handleCheck}
                  className="font-heading rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-7 py-2.5 text-base font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-8 sm:py-3 sm:text-lg"
                >
                  Check my basket! ✅
                </button>
              )}
            </div>

            {phase === 'success' && (
              <SuccessOverlay
                target={round.target}
                item={round.item}
                format={round.format}
                isLastRound={roundIndex + 1 >= TOTAL_ROUNDS}
                streak={streak}
                onNext={nextRound}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Game1() {
  return (
    <NameGate gameLabel="Game 1: Harvest Challenge">
      <GameAccessGate gameNumber={1} gameLabel="Game 1: Harvest Challenge">
        <Game1Inner />
      </GameAccessGate>
    </NameGate>
  );
}

function TopBar({ totalRounds, stars, muted, onToggleMute }) {
  return (
    <div className="flex w-full items-center justify-between">
      <Link
        to="/"
        className="font-body flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-4 sm:py-2 sm:text-sm md:text-base"
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
      <span className="text-lg sm:text-2xl">⭐</span>
      <div className={`h-2 w-14 overflow-hidden rounded-full sm:h-2.5 sm:w-24 ${dark ? 'bg-slate-200' : 'bg-white/40'}`}>
        <div
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        >
          <span className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
      </div>
      <span
        className={`font-body text-xs font-extrabold sm:text-sm ${dark ? 'text-slate-700' : 'text-white drop-shadow'}`}
      >
        {stars}/{total}
      </span>
    </div>
  );
}

function RoundDots({ total, current }) {
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors sm:h-2 sm:w-2 ${
            i < current ? 'bg-white' : i === current ? 'animate-sparkle bg-yellow-300' : 'bg-white/30'
          }`}
        />
      ))}
    </div>
  );
}

function FarmerPrompt({ target, item, streak, isWrong }) {
  return (
    <div className="mt-2 flex flex-col items-center gap-1.5">
      <div className="relative">
        <motion.span
          className="inline-block text-5xl sm:text-6xl"
          animate={isWrong ? { x: [0, -6, 6, -6, 6, 0] } : { rotate: [-4, 4, -4], y: [0, -6, 0] }}
          transition={isWrong ? { duration: 0.4 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          👨‍🌾
        </motion.span>
        {streak >= 2 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="font-body absolute -right-3 -top-2 rounded-full bg-orange-400 px-2 py-0.5 text-xs font-extrabold text-white shadow"
          >
            🔥{streak}
          </motion.span>
        )}
      </div>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative max-w-xs rounded-3xl bg-white px-3 py-1 text-center shadow-[0_6px_0_rgba(0,0,0,0.1)] sm:max-w-sm"
      >
        <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white" />
        {isWrong ? (
          <p className="font-body text-sm font-bold text-orange-600 sm:text-base">Let's fix the count! </p>
        ) : (
          <p className="font-body text-sm font-bold text-slate-700 sm:text-base">
            Farmer Finn needs {target} {item.name}!
          </p>
        )}
      </motion.div>
    </div>
  );
}

function TargetCard({ target, item, format }) {
  const dots = Array.from({ length: 10 }, (_, i) => i < target);
  const rows = [dots.slice(0, 5), dots.slice(5, 10)];
  const isWord = format === 'word';
  const label = isWord ? NUMBER_WORDS[target] : String(target);
  return (
    <div className="animate-pop-in mt-2 flex flex-col items-center gap-2 rounded-[1.5rem] bg-white/80 p-2 shadow-[0_6px_0_rgba(0,0,0,0.1)] sm:flex-row sm:gap-3 sm:px-5 md:px-4 md:py-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span
            className={`font-heading whitespace-nowrap font-bold leading-none text-pink-500 ${
              isWord ? 'md:text-[clamp(1.5rem,4vw,2.5rem)] text-base' : 'md:text-4xl text-3xl'
            }`}
          >
            {label}
          </span>
          
        </div>
        <div className="flex flex-col gap-1">
          {rows.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map((filled, ci) => (
                <span
                  key={ci}
                  className={`h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${filled ? 'bg-pink-400' : 'border border-pink-200 bg-white'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="font-body text-center text-sm font-bold text-slate-700 sm:text-left sm:text-base md:text-lg px-2">
        Fill the basket with {label} {item.name}! {item.emoji}
      </p>
    </div>
  );
}

function PoolZone({ items, item, disabled, pulse }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'pool' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex min-h-[6.5rem] flex-1 basis-0 flex-wrap content-start items-start justify-center gap-1.5 overflow-y-auto rounded-[1.75rem] border-4 border-dashed border-white/60 bg-white/25 p-3 shadow-inner backdrop-blur-sm transition-shadow sm:min-h-[8rem] sm:gap-2 sm:p-4',
        isOver && 'border-yellow-300 bg-white/40',
        pulse && 'animate-glow-pulse'
      )}
    >
      <span className="font-body absolute top-1 left-4 rounded-full bg-white/90 px-3 py-0.5 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
        🌳 Orchard
      </span>
      {items.length === 0 && (
        <span className="font-body mt-6 text-sm font-bold text-white/80">All picked!</span>
      )}
      {items.map((it) => (
        <DraggableFruit key={it.id} id={it.id} emoji={item.emoji} rotation={it.rotation} disabled={disabled} />
      ))}
    </div>
  );
}

function BasketZone({ items, item, count, disabled, pulse, shake }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'basket' });
  return (
    <div
      style={{
        backgroundColor: '#d3f395',
        backgroundImage: `
          linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(0,0,0,0.12)),
          repeating-linear-gradient(
            0deg,
            rgba(255,255,255,0.12) 0px,
            rgba(255,255,255,0.12) 4px,
            transparent 4px,
            transparent 14px
          ),
          repeating-linear-gradient(
            90deg,
            rgba(110,65,20,0.09) 0px,
            rgba(110,65,20,0.09) 4px,
            transparent 4px,
            transparent 14px
          )
        `,
      }}
      ref={setNodeRef}
      className={cn(
        'relative flex min-h-[6.5rem] flex-1 basis-0 flex-wrap content-start items-start justify-center gap-1.5 overflow-y-auto rounded-b-[2.5rem] rounded-t-2xl border-4 border-amber-700/70 bg-gradient-to-b from-amber-300 to-amber-500 p-3 shadow-inner transition-shadow sm:min-h-[8rem] sm:gap-2 sm:p-4',
        isOver && 'ring-4 ring-yellow-200',
        pulse && 'animate-wobble',
        shake && 'animate-shake',
        !pulse && !shake && !disabled && 'animate-basket-rock'
      )}
    >
      <span className="font-body absolute top-1 left-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-0.5 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
        🧺 Basket: {count}
      </span>
      {items.length === 0 && (
        <span className="font-body mt-6 text-base font-bold text-amber-900/60 sm:text-lg">Drag {item.name} here!</span>
      )}
      {items.map((it) => (
        <DraggableFruit key={it.id} id={it.id} emoji={item.emoji} rotation={it.rotation} disabled={disabled} />
      ))}
    </div>
  );
}

function DraggableFruit({ id, emoji, rotation, disabled }) {
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
      className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-opacity duration-150 sm:h-14 sm:w-14 sm:text-3xl md:h-16 md:w-16 md:text-4xl ${
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-0' : 'opacity-100'}`}
    >
      {emoji}
    </div>
  );
}

function SuccessOverlay({ target, item, format, isLastRound, streak, onNext }) {
  const { width, height } = useWindowSize();
  const label = format === 'word' ? capitalize(NUMBER_WORDS[target]) : String(target);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <Confetti
        width={width}
        height={height}
        numberOfPieces={streak >= 3 ? 160 : 90}
        recycle={false}
        gravity={0.24}
        colors={['#FF6FA5', '#FFD93D', '#6BCB77', '#4FC3F7', '#9B5DE5', '#FF9F45']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <motion.div
        initial={{ scale: 0.7, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative flex max-h-[90dvh] max-w-sm flex-col items-center overflow-y-auto rounded-[2.5rem] bg-white px-6 py-6 text-center shadow-2xl sm:px-8 sm:py-8"
      >
        <div className="text-5xl text-center sm:text-6xl">{streak >= 3 ? '🌟' : '🎉'}</div>
        <p className="font-heading mt-2 text-xl font-bold text-amber-500 sm:text-2xl md:text-3xl">
          {streak >= 3 ? 'On a streak!' : 'Perfect!'}
        </p>
        <p className="font-body mt-1.5 text-sm font-semibold text-slate-500 sm:text-base md:text-lg">
          You counted {label} {item.name} {item.emoji}
        </p>
        <button
          onClick={onNext}
          className="font-heading mt-4 rounded-full bg-gradient-to-b from-green-400 to-green-500 px-6 py-2.5 text-base font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:mt-6 sm:px-7 sm:py-3 sm:text-lg"
        >
          {isLastRound ? 'See my results! 🏆' : 'Next round ➡️'}
        </button>
      </motion.div>
    </div>
  );
}

function CompletionScreen({ stars, total, playerName, onPlayAgain }) {
  const { width, height } = useWindowSize();
  return (
    <div className="relative flex max-h-full w-full flex-col items-center overflow-y-auto rounded-[2rem] bg-white/90 px-6 py-6 text-center shadow-2xl sm:px-10 sm:py-8">
      <Confetti
        width={width}
        height={height}
        numberOfPieces={160}
        recycle={false}
        gravity={0.2}
        colors={['#FF6FA5', '#FFD93D', '#6BCB77', '#4FC3F7', '#9B5DE5']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-5xl sm:text-6xl md:text-7xl"
      >
        🏆
      </motion.div>
      <h2 className="font-heading mt-2 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
        Amazing counting, {playerName}!
      </h2>
      <p className="font-body mt-1.5 text-base font-semibold text-slate-500 sm:text-lg">
        You earned {stars} out of {total} stars
      </p>
      <div className="mt-2 sm:mt-3">
        <StarMeter stars={stars} total={total} dark />
      </div>
      <div className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
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