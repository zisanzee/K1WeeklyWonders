import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import clsx from 'clsx';
import NameGate from './NameGate';
import GameAccessGate from './GameAccessGate';
import { usePlayerStore } from './playerStore';
import { logPlaySession } from './logPlaySession';
import { Helmet } from 'react-helmet-async';

const TOTAL_ROUNDS = 10;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const TILE_WIDTH = 64; // px, keep in sync with slider drag math below
const WINDOW_SIZE = 5;
const MIN_NUM = 1;
const MAX_NUM = 10;

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  utterance.rate = 0.85;
  utterance.pitch = 1.3;
  window.speechSynthesis.speak(utterance);
}

function getWindowStart(highlighted) {
  return clamp(highlighted - 2, MIN_NUM, MAX_NUM - WINDOW_SIZE + 1);
}

// Builds three spelled-out options: the correct answer, the "wrong direction"
// trap (before vs after swapped), and the reference number itself (the
// classic "just repeats the number" trap). Falls back to a random distractor
// near the edges of the 1-10 range where those tricks aren't valid.
function generateOptions(reference, type, correct) {
  const otherDirectionValue = type === 'after' ? reference - 1 : reference + 1;
  const candidates = [];
  if (reference !== correct) candidates.push(reference);
  if (otherDirectionValue >= MIN_NUM && otherDirectionValue <= MAX_NUM && otherDirectionValue !== correct) {
    candidates.push(otherDirectionValue);
  }
  let guard = 0;
  while (candidates.length < 2 && guard < 30) {
    guard += 1;
    const rand = randInt(MIN_NUM, MAX_NUM);
    if (rand !== correct && !candidates.includes(rand)) candidates.push(rand);
  }
  const values = shuffle([correct, ...candidates.slice(0, 2)]);
  return values.map((v) => ({ value: v, word: NUMBER_WORDS[v] }));
}

function generateRound(index, type, prevReference) {
  let reference;
  let attempts = 0;
  do {
    reference = type === 'before' ? randInt(2, MAX_NUM) : randInt(MIN_NUM, 9);
    attempts += 1;
  } while (reference === prevReference && attempts < 8);
  const correct = type === 'before' ? reference - 1 : reference + 1;
  const options = generateOptions(reference, type, correct);
  return { index, type, reference, correct, options };
}

function getPromptParts(round) {
  const refWord = NUMBER_WORDS[round.reference];
  return round.type === 'before'
    ? { before: 'What comes right', keyword: 'before', after: `${refWord}?` }
    : { before: 'What comes right', keyword: 'after', after: `${refWord}?` };
}

function getSpeechPrompt(round) {
  const refWord = NUMBER_WORDS[round.reference];
  return `What number comes right ${round.type}${refWord}?`;
}

function getResultMessage(round) {
  const refWord = NUMBER_WORDS[round.reference];
  const correctWord = NUMBER_WORDS[round.correct];
  return round.type === 'before'
    ? `${correctWord} comes right before ${refWord}!`
    : `${correctWord} comes right after ${refWord}!`;
}

function Game3Inner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const planRef = useRef(shuffle([...Array(5).fill('before'), ...Array(5).fill('after')]));
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => generateRound(0, planRef.current[0], null));
  const [highlighted, setHighlighted] = useState(round.reference);
  const [phase, setPhase] = useState('playing');
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [muted, setMuted] = useState(false);
  const [wrongValue, setWrongValue] = useState(null);
  const [hasErred, setHasErred] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const peakStreakRef = useRef(0);
  const hasLoggedRef = useRef(false);
  const hasSpokenRef = useRef(false);
  if (!hasSpokenRef.current) {
    hasSpokenRef.current = true;
    speak(getSpeechPrompt(round), muted);
  }

  const showAllWords = roundIndex < 5;
  const promptParts = getPromptParts(round);

  const handleAnswer = (value) => {
    if (phase !== 'playing' || wrongValue !== null) return;
    if (value === round.correct) {
      setPhase('success');
      setStars((s) => s + 1);
      setStreak((s) => {
        const next = hasErred ? 0 : s + 1;
        peakStreakRef.current = Math.max(peakStreakRef.current, next);
        return next;
      });
      setCelebrate(true);
      speak(getResultMessage(round), muted);
    } else {
      setHasErred(true);
      setStreak(0);
      setWrongValue(value);
      speak('Not quite, try again!', muted);
      setTimeout(() => setWrongValue(null), 600);
    }
  };

  const nextRound = () => {
    const next = roundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase('complete');
      speak("You're a number-line explorer! Amazing job!", muted);
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true;
        logPlaySession({ game: 'game3', playerName, stars, totalRounds: TOTAL_ROUNDS, peakStreak: peakStreakRef.current });
      }
      return;
    }
    const newRound = generateRound(next, planRef.current[next], round.reference);
    setRoundIndex(next);
    setRound(newRound);
    setHighlighted(newRound.reference);
    setPhase('playing');
    setWrongValue(null);
    setHasErred(false);
    speak(getSpeechPrompt(newRound), muted);
  };

  const playAgain = () => {
    planRef.current = shuffle([...Array(5).fill('before'), ...Array(5).fill('after')]);
    const newRound = generateRound(0, planRef.current[0], null);
    setRoundIndex(0);
    setRound(newRound);
    setHighlighted(newRound.reference);
    setPhase('playing');
    setStars(0);
    setStreak(0);
    setWrongValue(null);
    setHasErred(false);
    peakStreakRef.current = 0;
    hasLoggedRef.current = false;
    speak(getSpeechPrompt(newRound), muted);
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#8FE9E4] via-[#2FA8C9] to-[#123A6B]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Nunito:wght@600;800&display=swap"
      />
        <Helmet>
          <title>Counting Game | K1 Weekly Wonders</title>
      
          <meta
            name="description"
            content="Practice counting through an interactive game designed for Kindergarten students."
          />
        </Helmet>

      <style>{`
        @keyframes pop-in { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes sparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
        @keyframes wobble { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2deg) scale(1.03); } 75% { transform: rotate(2deg) scale(1.03); } }
        @keyframes sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes rise-bubble { 0% { transform: translateY(0); opacity: 0; } 8% { opacity: 0.8; } 92% { opacity: 0.8; } 100% { transform: translateY(-115vh); opacity: 0; } }
        @keyframes swim-fish { 0% { transform: translateX(110vw); } 100% { transform: translateX(-110vw); } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; will-change: transform, opacity; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-wobble { animation: wobble 0.6s ease-in-out infinite; }
        .animate-sway { animation: sway 3.4s ease-in-out infinite; transform-origin: bottom center; will-change: transform; }
        .animate-rise-bubble { animation-name: rise-bubble; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform, opacity; }
        .animate-swim-fish { animation-name: swim-fish; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform; }
      `}</style>

      <RisingBubbles />
      <SwimmingFish />
      <SeaFloor />

      {celebrate && <Celebration onDone={() => setCelebrate(false)} />}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col items-center px-4 py-5 sm:py-8">
        <TopBar totalRounds={TOTAL_ROUNDS} stars={stars} muted={muted} onToggleMute={() => setMuted((m) => !m)} />

        {phase === 'complete' ? (
          <CompletionScreen stars={stars} total={TOTAL_ROUNDS} onPlayAgain={playAgain} />
        ) : (
          <>
            <h1 className="font-heading mt-2 text-xl font-bold text-white/95 drop-shadow sm:text-2xl">
              🐙 Ollie's Number Reef
            </h1>
            <p className="font-body text-sm font-bold text-white/80 sm:text-base">
              Round {roundIndex + 1} of {TOTAL_ROUNDS}
            </p>
            <RoundDots total={TOTAL_ROUNDS} current={roundIndex} />

            <OllieBubble promptParts={promptParts} isWrong={!!wrongValue} />

            <div className="mt-5 flex flex-col items-center gap-2">
              <span className="font-body rounded-full bg-white/85 px-3 py-0.5 text-xs font-extrabold text-teal-700 shadow sm:text-sm">
                {showAllWords ? '🪸 Slide to explore the reef' : '🫧 Slide to find the glowing pearl'}
              </span>
              <NumberSlider
                highlighted={highlighted}
                onChange={setHighlighted}
                showAllWords={showAllWords}
                referenceNumber={round.reference}
                disabled={phase !== 'playing'}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {round.options.map((opt) => (
                <AnswerPill
                  key={opt.value}
                  option={opt}
                  onTap={() => handleAnswer(opt.value)}
                  disabled={phase !== 'playing'}
                  isWrong={wrongValue === opt.value}
                  isCorrectChosen={phase === 'success' && opt.value === round.correct}
                  isDimmed={phase === 'success' && opt.value !== round.correct}
                />
              ))}
            </div>

            {phase === 'success' && (
              <SuccessOverlay
                message={getResultMessage(round)}
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

export default function Game3() {
  return (
    <NameGate gameLabel="Game 3: Ollie's Number Reef">
      <GameAccessGate gameNumber={3} gameLabel="Game 3: Ollie's Number Reef">
        <Game3Inner />
      </GameAccessGate>
    </NameGate>
  );
}

function NumberSlider({ highlighted, onChange, showAllWords, referenceNumber, disabled }) {
  const windowStart = getWindowStart(highlighted);
  const offsetPx = (windowStart - MIN_NUM) * TILE_WIDTH;
  const dragRef = useRef({ dragging: false, startX: 0, startHighlighted: highlighted });

  const handlePointerDown = (e) => {
    if (disabled) return;
    dragRef.current = { dragging: true, startX: e.clientX, startHighlighted: highlighted };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const deltaTiles = Math.round(-dx / TILE_WIDTH);
    const next = clamp(dragRef.current.startHighlighted + deltaTiles, MIN_NUM, MAX_NUM);
    if (next !== highlighted) onChange(next);
  };

  const handlePointerUp = (e) => {
    dragRef.current.dragging = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released; safe to ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      <SliderArrow
        direction="left"
        onClick={() => onChange(clamp(highlighted - 1, MIN_NUM, MAX_NUM))}
        disabled={disabled || highlighted <= MIN_NUM}
      />
      <div
        className="relative touch-none select-none overflow-hidden rounded-3xl border-4 border-white/70 bg-white/20 shadow-inner"
        style={{ width: TILE_WIDTH * WINDOW_SIZE, height: 96 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <motion.div
          className="absolute left-0 top-0 flex h-full"
          animate={{ x: -offsetPx }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        >
          {Array.from({ length: MAX_NUM }, (_, i) => i + 1).map((n) => (
            <SliderTile
              key={n}
              n={n}
              isHighlighted={n === highlighted}
              isReference={n === referenceNumber && n !== highlighted}
              showWord={showAllWords || n === highlighted}
              onTap={() => !disabled && onChange(n)}
            />
          ))}
        </motion.div>
      </div>
      <SliderArrow
        direction="right"
        onClick={() => onChange(clamp(highlighted + 1, MIN_NUM, MAX_NUM))}
        disabled={disabled || highlighted >= MAX_NUM}
      />
    </div>
  );
}

function SliderTile({ n, isHighlighted, isReference, showWord, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      style={{ width: TILE_WIDTH }}
      className="relative flex h-full flex-shrink-0 flex-col items-center justify-center"
    >
      {showWord && (
        <span
          className={clsx(
            'font-body mb-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[12px] font-extrabold tracking-wide',
            isHighlighted ? 'bg-yellow-300 text-slate-700' : 'bg-white/70 text-teal-700'
          )}
        >
          {NUMBER_WORDS[n]}
        </span>
      )}
      <span
        className={clsx(
          'font-heading flex items-center justify-center rounded-full font-bold transition-all duration-200',
          isHighlighted
            ? 'h-12 w-12 scale-110 bg-gradient-to-b from-yellow-300 to-orange-400 text-2xl text-white shadow-[0_4px_0_rgba(0,0,0,0.25)]'
            : 'h-10 w-10 bg-white/60 text-lg text-teal-800'
        )}
      >
        {n}
      </span>
      {isReference && <span className="absolute -bottom-1 text-[10px]">📍</span>}
    </button>
  );
}

function SliderArrow({ direction, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Slide to previous number' : 'Slide to next number'}
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/85 text-lg font-bold text-teal-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform active:translate-y-0.5 active:shadow-none disabled:opacity-30"
    >
      {direction === 'left' ? '◀' : '▶'}
    </button>
  );
}

function AnswerPill({ option, onTap, disabled, isWrong, isCorrectChosen, isDimmed }) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={clsx(
        'font-heading rounded-full border-4 px-6 py-3 text-lg font-bold shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-all duration-200 sm:text-xl',
        disabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.15)]',
        isWrong && 'animate-shake border-red-300 bg-red-100 text-red-500',
        isCorrectChosen && 'animate-wobble border-green-300 bg-green-100 text-green-600 ring-8 ring-green-200',
        isDimmed && 'opacity-40',
        !isWrong && !isCorrectChosen && !isDimmed && 'border-white bg-white/90 text-teal-700'
      )}
    >
      🐚 {option.word}
    </button>
  );
}

function OllieBubble({ promptParts, isWrong }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <motion.span
        className="inline-block text-6xl sm:text-7xl"
        animate={isWrong ? { x: [0, -6, 6, -6, 6, 0] } : { rotate: [-4, 4, -4], y: [0, -6, 0] }}
        transition={isWrong ? { duration: 0.4 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🐙
      </motion.span>
      <div className="animate-pop-in relative max-w-xs rounded-3xl bg-white px-5 py-3 text-center shadow-[0_6px_0_rgba(0,0,0,0.1)] sm:max-w-sm">
        <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white" />
        {isWrong ? (
          <p className="font-body text-sm font-bold text-orange-600 sm:text-base">Not quite! Try again 💪</p>
        ) : (
          <p className="font-body text-sm font-bold text-slate-700 sm:text-base">
            {promptParts.before} <span className="text-teal-600">{promptParts.keyword}</span> {promptParts.after}
          </p>
        )}
      </div>
    </div>
  );
}

function RisingBubbles() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 10 + Math.random() * 20,
        duration: 7 + Math.random() * 7,
        delay: Math.random() * 6,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="animate-rise-bubble absolute bottom-0 rounded-full border border-white/40 bg-white/20"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function SwimmingFish() {
  const fish = useMemo(
    () => [
      { emoji: '🐠', top: 16, duration: 19, delay: 0 },
      { emoji: '🐟', top: 52, duration: 24, delay: 3 },
      { emoji: '🐡', top: 34, duration: 28, delay: 7 },
    ],
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {fish.map((f, i) => (
        <span
          key={i}
          className="animate-swim-fish absolute text-3xl sm:text-4xl"
          style={{
            top: `${f.top}%`,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

function SeaFloor() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-24 md:h-32">
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="h-full w-full">
        <path fill="#0B2C52" fillOpacity="0.85" d="M0,110 C 240,190 480,30 720,90 C 960,150 1200,50 1440,110 L1440,200 L0,200 Z" />
        <path fill="#082243" d="M0,150 C 260,90 500,190 760,140 C 1020,90 1260,180 1440,140 L1440,200 L0,200 Z" />
      </svg>
      <span className="absolute bottom-2 left-[16%] animate-sway text-2xl sm:bottom-4 sm:text-3xl">🌿</span>
      <span className="absolute bottom-3 left-[42%] animate-sway text-xl sm:bottom-5 sm:text-2xl" style={{ animationDelay: '0.6s' }}>
        🪸
      </span>
      <span className="absolute bottom-2 right-[20%] animate-sway text-2xl sm:bottom-4 sm:text-3xl" style={{ animationDelay: '1.1s' }}>
        🌿
      </span>
      <span className="absolute bottom-3 right-[6%] text-xl sm:bottom-5 sm:text-2xl">🐚</span>
    </div>
  );
}

function Celebration({ onDone }) {
  const { width, height } = useWindowSize();
  return (
    <Confetti
      width={width}
      height={height}
      numberOfPieces={140}
      recycle={false}
      gravity={0.22}
      colors={['#5EEAD4', '#38BDF8', '#A78BFA', '#FCD34D', '#FB7185']}
      style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none' }}
      onConfettiComplete={(confetti) => {
        onDone();
        if (confetti) confetti.reset();
      }}
    />
  );
}

function TopBar({ totalRounds, stars, muted, onToggleMute }) {
  return (
    <div className="flex w-full items-center justify-between">
      <Link
        to="/"
        className="font-body flex items-center gap-1 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:text-base"
      >
        ⬅️ Home
      </Link>

      <div className="flex items-center gap-3">
        <StarMeter stars={stars} total={totalRounds} />
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-[0_4px_0_rgba(0,0,0,0.15)] active:translate-y-0.5 active:shadow-none"
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
          className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-body text-xs font-extrabold sm:text-sm ${dark ? 'text-slate-700' : 'text-white drop-shadow'}`}>
        {stars}/{total}
      </span>
    </div>
  );
}

function RoundDots({ total, current }) {
  return (
    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
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

function SuccessOverlay({ message, isLastRound, streak, onNext }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="animate-pop-in relative flex max-w-sm flex-col items-center rounded-[2.5rem] bg-white px-8 py-8 text-center shadow-2xl">
        <div className="text-6xl">{streak >= 3 ? '🌟' : '🎉'}</div>
        <h2 className="font-heading mt-2 text-2xl font-bold text-slate-800 sm:text-3xl">
          {streak >= 3 ? 'Reef streak!' : 'Well done!'}
        </h2>
        <p className="font-body mt-2 text-base font-semibold text-slate-500 sm:text-lg">{message}</p>
        <button
          onClick={onNext}
          className="font-heading mt-6 rounded-full bg-gradient-to-b from-teal-400 to-teal-500 px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {isLastRound ? 'See my treasure! 🏆' : 'Next round ➡️'}
        </button>
      </div>
    </div>
  );
}

function CompletionScreen({ stars, total, onPlayAgain }) {
  const { width, height } = useWindowSize();
  return (
    <div className="relative mt-10 flex flex-col items-center rounded-[2.5rem] bg-white/90 px-8 py-10 text-center shadow-2xl sm:px-14">
      <Confetti
        width={width}
        height={height}
        numberOfPieces={160}
        recycle={false}
        gravity={0.2}
        colors={['#5EEAD4', '#38BDF8', '#A78BFA', '#FCD34D', '#FB7185']}
        style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
      />
      <div className="text-7xl">🐚🏆</div>
      <h2 className="font-heading mt-3 text-3xl font-bold text-slate-800 sm:text-4xl">Reef treasure collected!</h2>
      <p className="font-body mt-2 text-lg font-semibold text-slate-500">
        You earned {stars} out of {total} stars
      </p>
      <div className="mt-3">
        <StarMeter stars={stars} total={total} dark />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onPlayAgain}
          className="font-heading rounded-full bg-gradient-to-b from-teal-400 to-teal-500 px-6 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          🔁 Play again
        </button>
        <Link
          to="/"
          className="font-heading rounded-full bg-gradient-to-b from-sky-400 to-sky-500 px-6 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          🏠 Back home
        </Link>
      </div>
    </div>
  );
}