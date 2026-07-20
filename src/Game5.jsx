import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Helmet } from 'react-helmet-async';

const TOTAL_ROUNDS = 10;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// One consistent "big, highlighted number" treatment used everywhere a value
// appears — keys, chests, choices — so numbers are always the loudest thing
// on screen for little eyes to land on.
const NumberChip = React.memo(function NumberChip({ value, size = 'md', tone = 'amber' }) {
  const sizeClasses =
    size === 'lg'
      ? 'min-w-[3.25rem] px-3 py-1.5 text-4xl sm:min-w-[4rem] sm:px-4 sm:py-2 sm:text-5xl'
      : 'min-w-[2.5rem] px-2 py-1 text-2xl sm:min-w-[3rem] sm:px-2.5 sm:py-1.5 sm:text-3xl';
  const toneClasses =
    tone === 'white'
      ? 'bg-white text-amber-900 shadow-[0_3px_0_rgba(0,0,0,0.15)]'
      : 'bg-gradient-to-b from-yellow-200 to-amber-300 text-amber-950 shadow-[0_3px_0_rgba(146,64,14,0.3)]';
  return (
    <span
      className={cn(
        'font-heading inline-flex items-center justify-center rounded-2xl border-[3px] border-amber-700 font-extrabold leading-none',
        sizeClasses,
        toneClasses
      )}
    >
      {value}
    </span>
  );
});

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatNumber(value, format) {
  return format === 'word' ? capitalize(NUMBER_WORDS[value]) : String(value);
}

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

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.15;
  window.speechSynthesis.speak(utterance);
}

// First 5 rounds are numerals, last 5 are spelled words. Exactly one round
// in each half is a "find the whole" round (tap the matching chest);
// everything else is a "find the missing key" round (drag the right part).
function generateRoundPlan() {
  const wholeIdxA = randInt(0, 4);
  const wholeIdxB = 5 + randInt(0, 4);
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({
    format: i < 5 ? 'numeral' : 'word',
    isWholeRound: i === wholeIdxA || i === wholeIdxB,
  }));
}

// Correct value plus up to two distractors: the fixed part itself (a classic
// "just repeats a number I can see" trap) and the whole itself, falling back
// to nearby random values so there are always exactly 3 distinct choices.
function buildPartChoices(whole, fixedPart, correctPart) {
  const values = new Set([correctPart]);
  if (fixedPart !== correctPart) values.add(fixedPart);
  if (whole !== correctPart && whole <= 9) values.add(whole);
  let guard = 0;
  while (values.size < 3 && guard < 30) {
    guard += 1;
    values.add(randInt(1, Math.max(1, whole - 1)));
  }
  return shuffle(Array.from(values).slice(0, 3)).map((value, i) => ({
    id: `choice-${i}-${Math.random().toString(36).slice(2, 7)}`,
    value,
  }));
}

function buildWholeChoices(whole) {
  const values = new Set([whole]);
  let guard = 0;
  while (values.size < 3 && guard < 30) {
    guard += 1;
    const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
    values.add(clamp(whole + delta, 2, 10));
  }
  return shuffle(Array.from(values).slice(0, 3)).map((value, i) => ({
    id: `chest-${i}-${Math.random().toString(36).slice(2, 7)}`,
    value,
  }));
}

function generateRound(index, planEntry, prevWhole) {
  const { format, isWholeRound } = planEntry;

  if (!isWholeRound) {
    let whole;
    let guard = 0;
    do {
      whole = randInt(3, 10);
      guard += 1;
    } while (whole === prevWhole && guard < 10);
    const fixedPart = randInt(1, whole - 1);
    const correctPart = whole - fixedPart;
    const choices = buildPartChoices(whole, fixedPart, correctPart);
    return { index, type: 'part', format, whole, fixedPart, correctPart, choices };
  }

  let partA;
  let partB;
  let whole;
  let guard = 0;
  do {
    partA = randInt(1, 6);
    partB = randInt(1, 6);
    whole = partA + partB;
    guard += 1;
  } while ((whole > 10 || whole === prevWhole) && guard < 20);
  const chestOptions = buildWholeChoices(whole);
  return { index, type: 'whole', format, partA, partB, whole, chestOptions };
}

function roundSpeech(round) {
  if (round.type === 'part') {
    return `Ahoy! This chest needs ${round.whole} in all. One key shows ${round.fixedPart}. Find the matching key!`;
  }
  return `Ahoy! These two keys go in the same chest. Which chest holds them both?`;
}

function successSpeech(round, value) {
  if (round.type === 'part') {
    return `Treasure found! ${round.fixedPart} and ${value} together make ${round.whole}!`;
  }
  return `Correct! ${round.partA} and ${round.partB} together make ${round.whole}!`;
}

function Game5Inner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const planRef = useRef(generateRoundPlan());
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => generateRound(0, planRef.current[0], null));
  const [phase, setPhase] = useState('playing');
  const [filled, setFilled] = useState(false);
  const [chosenValue, setChosenValue] = useState(null);
  const [chosenChestId, setChosenChestId] = useState(null);
  const [wrongChoiceId, setWrongChoiceId] = useState(null);
  const [wrongChestId, setWrongChestId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hasErred, setHasErred] = useState(false);
  const [muted, setMuted] = useState(false);

  const hasLoggedRef = useRef(false);
  const peakStreakRef = useRef(0);
  const hasSpokenRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!hasSpokenRef.current) {
    hasSpokenRef.current = true;
    speak(roundSpeech(round), muted);
  }

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2600);
    return () => clearTimeout(t);
  }, [feedback]);

  const bumpStreak = () => {
    setStreak((s) => {
      const next = hasErred ? 0 : s + 1;
      peakStreakRef.current = Math.max(peakStreakRef.current, next);
      return next;
    });
  };

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || over.id !== 'slot' || filled || phase !== 'playing') return;
    const choice = round.choices.find((c) => c.id === active.id);
    if (!choice) return;

    if (choice.value === round.correctPart) {
      setFilled(true);
      setChosenValue(choice.value);
      setPhase('success');
      setStars((s) => s + 1);
      bumpStreak();
      speak(successSpeech(round, choice.value), muted);
    } else {
      setWrongChoiceId(choice.id);
      setHasErred(true);
      setStreak(0);
      setFeedback({ msg: 'Not quite! Try another key. 🗝️' });
      speak('Not quite, try another key!', muted);
      setTimeout(() => setWrongChoiceId(null), 500);
    }
  };

  const handleChestSelect = (chest) => {
    if (filled || phase !== 'playing') return;
    if (chest.value === round.whole) {
      setFilled(true);
      setChosenChestId(chest.id);
      setPhase('success');
      setStars((s) => s + 1);
      bumpStreak();
      speak(successSpeech(round), muted);
    } else {
      setWrongChestId(chest.id);
      setHasErred(true);
      setStreak(0);
      setFeedback({ msg: 'Not quite! Try another chest. 🏴‍☠️' });
      speak('Not quite, try another chest!', muted);
      setTimeout(() => setWrongChestId(null), 500);
    }
  };

  const nextRound = () => {
    const next = roundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase('complete');
      speak(`Ye be a true treasure hunter, ${playerName}!`, muted);
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true;
        logPlaySession({ game: 'game5', playerName, stars, totalRounds: TOTAL_ROUNDS, peakStreak: peakStreakRef.current });
      }
      return;
    }
    const newRound = generateRound(next, planRef.current[next], round.whole);
    setRoundIndex(next);
    setRound(newRound);
    setFilled(false);
    setChosenValue(null);
    setChosenChestId(null);
    setHasErred(false);
    setFeedback(null);
    setPhase('playing');
    speak(roundSpeech(newRound), muted);
  };

  const playAgain = () => {
    planRef.current = generateRoundPlan();
    const newRound = generateRound(0, planRef.current[0], null);
    setRoundIndex(0);
    setRound(newRound);
    setFilled(false);
    setChosenValue(null);
    setChosenChestId(null);
    setStars(0);
    setStreak(0);
    setHasErred(false);
    setFeedback(null);
    setPhase('playing');
    hasLoggedRef.current = false;
    peakStreakRef.current = 0;
    speak(roundSpeech(newRound), muted);
  };

  const activeChoice = round.type === 'part' ? round.choices.find((c) => c.id === activeId) : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#3FB6EA] via-[#8FE0FA] to-[#F4D9A0]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />
        <Helmet>
          <title>Part-Part-Whole | K1 Weekly Wonders</title>
      
          <meta
            name="description"
            content="Practice counting through an interactive game designed for Kindergarten students."
          />
        </Helmet>

      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-14px) translateX(8px); } }
        @keyframes bob-slow { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-8px) rotate(2deg); } }
        @keyframes pop-in { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
        @keyframes wobble { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2deg) scale(1.03); } 75% { transform: rotate(2deg) scale(1.03); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        @keyframes mascot-idle { 0%, 100% { transform: rotate(-4deg) translateY(0); } 50% { transform: rotate(4deg) translateY(-5px); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; will-change: transform; }
        .animate-bob-slow { animation: bob-slow 4.5s ease-in-out infinite; will-change: transform; }
        .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-wobble { animation: wobble 0.5s ease-in-out infinite; will-change: transform; }
        .animate-shimmer { animation: shimmer 2.2s linear infinite; will-change: transform; }
        .animate-mascot-idle { animation: mascot-idle 3s ease-in-out infinite; will-change: transform; }
        .animate-twinkle { animation: twinkle 2.2s ease-in-out infinite; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce) {
          .animate-float-slow, .animate-bob-slow, .animate-wobble, .animate-shimmer,
          .animate-mascot-idle, .animate-twinkle {
            animation-duration: 0.001s !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <PirateBackdrop />

      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center overflow-y-auto px-3 py-2 sm:px-4 sm:py-3">
        <TopBar totalRounds={TOTAL_ROUNDS} stars={stars} muted={muted} onToggleMute={() => setMuted((m) => !m)} />

        {phase === 'complete' ? (
          <CompletionScreen stars={stars} total={TOTAL_ROUNDS} playerName={playerName} onPlayAgain={playAgain} />
        ) : (
          <>
            <div className="mt-1 flex flex-col items-center gap-0.5 sm:mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl">🏴‍☠️</span>
                <p className="font-heading text-sm font-bold text-amber-900/90 drop-shadow-sm sm:text-base">
                  Polly's Treasure Quest
                </p>
              </div>
              <p className="font-body text-[11px] font-bold text-amber-900/70 sm:text-xs">
                Round {roundIndex + 1} of {TOTAL_ROUNDS}
              </p>
              <RoundDots total={TOTAL_ROUNDS} current={roundIndex} markers={[5]} />
            </div>

            <PollyPrompt round={round} streak={streak} isWrong={!!feedback} />

            {round.type === 'part' ? (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <PartRoundContent
                  round={round}
                  filled={filled}
                  chosenValue={chosenValue}
                  wrongChoiceId={wrongChoiceId}
                  disabled={phase !== 'playing'}
                />
                <DragOverlay>
                  {activeChoice ? (
                    <div className="pointer-events-none flex scale-110 flex-col items-center gap-1.5 rounded-2xl border-4 border-amber-700 bg-gradient-to-b from-yellow-100 to-amber-200 px-3 py-2.5 shadow-2xl">
                      <span className="text-2xl">🗝️</span>
                      <NumberChip value={formatNumber(activeChoice.value, round.format)} tone="white" />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <WholeRoundContent
                round={round}
                chosenChestId={chosenChestId}
                wrongChestId={wrongChestId}
                disabled={phase !== 'playing'}
                onSelect={handleChestSelect}
              />
            )}

            <div className="mt-2 flex min-h-[2.5rem] flex-col items-center gap-1.5 pb-2 sm:mt-3">
              {feedback && (
                <p className="font-body animate-pop-in rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-amber-800 shadow sm:text-sm">
                  {feedback.msg}
                </p>
              )}
            </div>

            {phase === 'success' && (
              <SuccessOverlay
                round={round}
                value={chosenValue}
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

export default function Game5() {
  return (
    <NameGate gameLabel="Game 5: Polly's Treasure Quest">
      <GameAccessGate gameNumber={5} gameLabel="Game 5: Polly's Treasure Quest">
        <Game5Inner />
      </GameAccessGate>
    </NameGate>
  );
}

function PirateBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[8%] top-[8%] animate-float-slow text-3xl opacity-90 sm:text-4xl">☁️</div>
      <div className="absolute right-[10%] top-[14%] animate-float-slow text-2xl opacity-80 sm:text-3xl" style={{ animationDelay: '1.5s' }}>
        ☁️
      </div>
      <div className="absolute right-[14%] top-[26%] animate-bob-slow text-3xl opacity-90 sm:text-4xl">⛵</div>
      <div className="absolute left-[6%] top-[36%] text-2xl opacity-80 sm:text-3xl">🦅</div>
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-amber-200/80 to-transparent" />
      <div className="absolute bottom-2 left-[10%] text-4xl opacity-90 sm:bottom-3 sm:text-5xl">🌴</div>
      <div className="absolute bottom-2 right-[8%] text-3xl opacity-80 sm:bottom-3 sm:text-4xl">🏝️</div>
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

const StarMeter = React.memo(function StarMeter({ stars, total, dark }) {
  const pct = total > 0 ? Math.round((stars / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2" aria-label={`${stars} out of ${total} stars earned`}>
      <span className="text-xl sm:text-2xl">⭐</span>
      <div className={`h-2.5 w-16 overflow-hidden rounded-full sm:w-24 ${dark ? 'bg-slate-200' : 'bg-white/50'}`}>
        <div
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        >
          <span className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
      </div>
      <span className={`font-body text-xs font-extrabold sm:text-sm ${dark ? 'text-slate-700' : 'text-amber-900 drop-shadow-sm'}`}>
        {stars}/{total}
      </span>
    </div>
  );
});

const RoundDots = React.memo(function RoundDots({ total, current, markers = [] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          {markers.includes(i) && <span className="mx-1 h-3 w-px bg-amber-900/30" />}
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors sm:h-2 sm:w-2 ${
              i < current ? 'bg-amber-800' : i === current ? 'animate-twinkle bg-yellow-400' : 'bg-amber-900/25'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
});

function PollyPrompt({ round, streak, isWrong }) {
  return (
    <div className="mt-1 flex flex-col items-center gap-1 sm:mt-2">
      <div className="relative">
        <span className={cn('inline-block text-4xl sm:text-5xl', isWrong ? 'animate-shake' : 'animate-mascot-idle')}>
          🦜
        </span>
        {streak >= 2 && (
          <span className="font-body animate-pop-in absolute -right-2 -top-1 rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow">
            🔥{streak}
          </span>
        )}
      </div>
      <div className="animate-pop-in relative max-w-xs rounded-2xl bg-white px-4 py-2 text-center shadow-[0_5px_0_rgba(0,0,0,0.12)] sm:max-w-sm">
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
        {isWrong ? (
          <p className="font-body text-xs font-bold text-orange-600 sm:text-sm">Arr, not that one! 🦜</p>
        ) : round.type === 'part' ? (
          <p className="font-body text-xs font-bold text-slate-700 sm:text-sm">
            Find the key that makes <span className="text-amber-600">{formatNumber(round.whole, round.format)}</span>!
          </p>
        ) : (
          <p className="font-body text-xs font-bold text-slate-700 sm:text-sm">Which chest holds both keys?</p>
        )}
      </div>
    </div>
  );
}

const DotRow = React.memo(function DotRow({ value, small }) {
  if (value == null) return null;
  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-0.5', small ? 'max-w-[3.2rem]' : 'max-w-[4.5rem]')}
      aria-hidden="true"
    >
      {Array.from({ length: value }).map((_, i) => (
        <span key={i} className={cn('rounded-full bg-amber-800/70', small ? 'h-1.5 w-1.5' : 'h-2 w-2 sm:h-2.5 sm:w-2.5')} />
      ))}
    </div>
  );
});

function PartRoundContent({ round, filled, chosenValue, wrongChoiceId, disabled }) {
  const wholeLabel = formatNumber(round.whole, round.format);
  const fixedLabel = formatNumber(round.fixedPart, round.format);
  const targetLabel = filled ? formatNumber(chosenValue, round.format) : '?';

  return (
    <div className="mt-1 flex w-full flex-1 flex-col items-center gap-2.5 sm:mt-2 sm:gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-body flex items-center gap-1.5 rounded-full bg-white/90 py-1 pl-3 pr-1.5 text-xs font-extrabold text-amber-800 shadow sm:text-base">
          Chest needs <NumberChip value={wholeLabel} tone="white" /> keys!
        </span>
        <img
          src={filled ? '/chest_open.png' : '/chest_closed.png'}
          alt={filled ? 'Open treasure chest' : 'Closed treasure chest'}
          className="w-[clamp(5rem,17vw,7.5rem)] select-none drop-shadow-lg"
          decoding="async"
          draggable={false}
        />
        <DotRow value={round.whole} />
      </div>

      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <FixedKeySlot label="This key" value={fixedLabel} dotValue={round.fixedPart} />
        <span className="font-body rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700 sm:text-sm">
          and
        </span>
        <TargetKeySlot label="Mystery key" value={targetLabel} dotValue={filled ? chosenValue : null} filled={filled} />
      </div>

      {!filled && (
        <KeyTray choices={round.choices} format={round.format} disabled={disabled} wrongChoiceId={wrongChoiceId} />
      )}
    </div>
  );
}

const FixedKeySlot = React.memo(function FixedKeySlot({ label, value, dotValue }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-body text-[9px] font-extrabold uppercase tracking-wide text-amber-800/70 sm:text-xs">
        {label}
      </span>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-amber-700 bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_4px_0_rgba(0,0,0,0.2)] sm:h-16 sm:w-16">
        <span className="text-2xl sm:text-3xl">🗝️</span>
      </div>
      <NumberChip value={value} />
      <DotRow value={dotValue} />
    </div>
  );
});

function TargetKeySlot({ label, value, dotValue, filled }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'slot' });
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-body text-[9px] font-extrabold uppercase tracking-wide text-amber-800/70 sm:text-xs">
        {label}
      </span>
      <div
        ref={setNodeRef}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-dashed shadow-inner transition-colors sm:h-16 sm:w-16',
          filled ? 'border-emerald-500 bg-emerald-100' : isOver ? 'border-yellow-400 bg-white/70' : 'border-amber-500/60 bg-white/30'
        )}
      >
        <span className="text-2xl sm:text-3xl">{filled ? '🗝️' : '❓'}</span>
      </div>
      <NumberChip value={value} tone={filled ? 'amber' : 'white'} />
      <DotRow value={dotValue} />
    </div>
  );
}

function KeyTray({ choices, format, disabled, wrongChoiceId }) {
  return (
    <div className="mt-1 flex w-full flex-wrap items-end justify-center gap-2.5 rounded-[1.5rem] border-4 border-dashed border-amber-400/60 bg-white/25 p-2.5 sm:gap-4 sm:p-4">
      {choices.map((c) => (
        <DraggableKey
          key={c.id}
          id={c.id}
          value={formatNumber(c.value, format)}
          dotValue={c.value}
          disabled={disabled}
          isWrong={wrongChoiceId === c.id}
        />
      ))}
    </div>
  );
}

const DraggableKey = React.memo(function DraggableKey({ id, value, dotValue, disabled, isWrong }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        touchAction: 'none',
      }}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl border-4 border-amber-700 bg-gradient-to-b from-yellow-100 to-amber-200 px-2.5 py-2.5 shadow-[0_5px_0_rgba(0,0,0,0.2)] transition-opacity sm:px-3.5 sm:py-3',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-0',
        isWrong && 'animate-shake'
      )}
    >
      <span className="text-2xl sm:text-3xl">🗝️</span>
      <NumberChip value={value} tone="white" />
      <DotRow value={dotValue}  />
    </div>
  );
});

function WholeRoundContent({ round, chosenChestId, wrongChestId, disabled, onSelect }) {
  const partALabel = formatNumber(round.partA, round.format);
  const partBLabel = formatNumber(round.partB, round.format);
  return (
    <div className="mt-1 flex w-full flex-1 flex-col items-center gap-3 sm:mt-2 sm:gap-5">
      <div className="flex items-center justify-center gap-2 rounded-[1.5rem] bg-white/90 px-4 py-3 shadow-[0_6px_0_rgba(0,0,0,0.15)] sm:gap-3.5 sm:px-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl sm:text-3xl">🗝️</span>
          <NumberChip value={partALabel} tone="white" />
          <DotRow value={round.partA} />
        </div>
        <span className="font-body rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700 sm:text-sm">
          and
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl sm:text-3xl">🗝️</span>
          <NumberChip value={partBLabel} tone="white" />
          <DotRow value={round.partB} />
        </div>
        <span className="text-xl text-amber-700/60 sm:text-2xl">➡️</span>
        <span className="text-3xl sm:text-4xl">❓</span>
      </div>

      <p className="font-body text-[11px] font-bold text-amber-900/80 sm:text-sm">Tap the chest with the right number!</p>

      <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-6">
        {round.chestOptions.map((c) => (
          <ChestOption
            key={c.id}
            value={formatNumber(c.value, round.format)}
            dotValue={c.value}
            isChosen={chosenChestId === c.id}
            isWrong={wrongChestId === c.id}
            disabled={disabled}
            onTap={() => onSelect(c)}
          />
        ))}
      </div>
    </div>
  );
}

const ChestOption = React.memo(function ChestOption({ value, dotValue, isChosen, isWrong, disabled, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled || isChosen}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl p-1 transition-transform',
        !disabled && !isChosen && 'hover:-translate-y-1 active:translate-y-0.5',
        isWrong && 'animate-shake'
      )}
    >
      {!isChosen && <NumberChip value={value} tone="white" />}
      <img
        src={isChosen ? '/chest_open.png' : '/chest_closed.png'}
        alt="Treasure chest"
        className="w-[clamp(3.75rem,13vw,5.5rem)] select-none drop-shadow-lg"
        decoding="async"
        draggable={false}
      />
      <DotRow value={dotValue} small />
    </button>
  );
});

function SuccessOverlay({ round, value, isLastRound, streak, onNext }) {
  const { width, height } = useWindowSize();
  const message =
    round.type === 'part'
      ? `${round.fixedPart} and ${value} together make ${round.whole}!`
      : `${round.partA} and ${round.partB} together make ${round.whole}!`;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <Confetti
        width={width}
        height={height}
        numberOfPieces={streak >= 3 ? 130 : 80}
        recycle={false}
        gravity={0.24}
        colors={['#F59E0B', '#FBBF24', '#34D399', '#60A5FA', '#F472B6']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <motion.div
        initial={{ scale: 0.7, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="relative flex max-w-sm flex-col items-center rounded-[2.5rem] bg-white px-8 py-6 text-center shadow-2xl sm:py-8"
      >
        <img src="/chest_open.png" alt="Open treasure chest" className="w-24 select-none drop-shadow-lg sm:w-28" draggable={false} />
        <p className="font-heading mt-1 text-2xl font-bold text-amber-500 sm:text-3xl">
          {streak >= 3 ? 'Treasure streak!' : 'Chest unlocked!'}
        </p>
        <p className="font-body mt-2 text-base font-semibold text-slate-500 sm:text-lg">{message}</p>
        <button
          onClick={onNext}
          className="font-heading mt-6 rounded-full bg-gradient-to-b from-green-400 to-green-500 px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {isLastRound ? 'See my results! 🏆' : 'Next chest ➡️'}
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
        numberOfPieces={130}
        recycle={false}
        gravity={0.2}
        colors={['#F59E0B', '#FBBF24', '#34D399', '#60A5FA', '#F472B6']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <img src="/chest_open.png" alt="Open treasure chest" className="w-20 select-none drop-shadow-lg sm:w-28" draggable={false} />
      <h2 className="font-heading mt-2 text-2xl font-bold text-slate-800 sm:mt-3 sm:text-4xl">
        Quest complete, {playerName}!
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