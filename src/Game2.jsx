import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NameGate from './NameGate';
import GameAccessGate from './GameAccessGate';
import { usePlayerStore } from './playerStore';
import { logPlaySession } from './logPlaySession';

const TOTAL_ROUNDS = 12;

const CATEGORIES = [
  { key: 'apple', emoji: '🍎', name: 'apples' },
  { key: 'cookie', emoji: '🍪', name: 'cookies' },
  { key: 'teddy', emoji: '🧸', name: 'teddy bears' },
  { key: 'flower', emoji: '🌸', name: 'flowers' },
  { key: 'balloon', emoji: '🎈', name: 'balloons' },
  { key: 'watermelon', emoji: '🍉', name: 'watermelon slices' },
  { key: 'sandwich', emoji: '🥪', name: 'sandwiches' },
  { key: 'juice', emoji: '🧃', name: 'juice boxes' },
];

// First 6 rounds: the original "compare baskets of objects" game.
// Comparisons appear most; "same" and three-basket rounds are rarer twists.
const OBJECT_ROUND_TYPES = ['more', 'more', 'fewer', 'fewer', 'same', 'three'];

// Last 6 rounds: numeral comparisons — bigger or smaller only, no "same".
const NUMERAL_ROUND_TYPES = ['more', 'more', 'more', 'fewer', 'fewer', 'fewer'];

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

// Quantities creep closer together as rounds progress, so early rounds can
// be solved at a glance while later rounds require real counting.
function difficultyForRound(index) {
  const progress = index / (TOTAL_ROUNDS - 1);
  const maxCount = clamp(Math.round(4 + progress * 5), 4, 9);
  const minDiff = progress > 0.6 ? 1 : progress > 0.3 ? 2 : 3;
  const maxDiff = minDiff + 2;
  return { maxCount, minDiff, maxDiff };
}

function withItems(basket) {
  const items = Array.from({ length: basket.count }, (_, i) => ({
    id: `${basket.id}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    rotation: (Math.random() * 16 - 8).toFixed(1),
  }));
  return { ...basket, items };
}

// Builds the two 6-round decks (objects, then numerals), each shuffled
// internally, and tags every entry with which "half" it belongs to.
function generateRoundPlan() {
  const objectHalf = shuffle(OBJECT_ROUND_TYPES).map((type) => ({ type, mode: 'objects' }));
  const numeralHalf = shuffle(NUMERAL_ROUND_TYPES).map((type) => ({ type, mode: 'numerals' }));
  return [...objectHalf, ...numeralHalf];
}

function generateRound(index, prevCategoryKey, type) {
  const pool = CATEGORIES.length > 1 ? CATEGORIES.filter((c) => c.key !== prevCategoryKey) : CATEGORIES;
  const category = pool[Math.floor(Math.random() * pool.length)];
  const { maxCount, minDiff, maxDiff } = difficultyForRound(index);

  if (type === 'same') {
    const target = randInt(2, maxCount);
    const diff = randInt(minDiff, maxDiff);
    let decoy = Math.random() < 0.5 ? target + diff : target - diff;
    decoy = clamp(decoy, 1, maxCount + maxDiff);
    if (decoy === target) decoy += 1;
    const baskets = shuffle([
      withItems({ id: 'b0', count: target, isMatch: true }),
      withItems({ id: 'b1', count: decoy, isMatch: false }),
    ]);
    const correctId = baskets.find((b) => b.isMatch).id;
    return { index, type, category, target, baskets, correctId };
  }

  if (type === 'three') {
    const subtype = Math.random() < 0.5 ? 'most' : 'fewest';
    const base = randInt(1, Math.max(1, maxCount - 2 * minDiff));
    const spacing1 = minDiff + randInt(0, 1);
    const spacing2 = spacing1 + minDiff + randInt(0, 1);
    const counts = shuffle([base, base + spacing1, base + spacing2]);
    const baskets = counts.map((count, i) => withItems({ id: `b${i}`, count }));
    const targetCount = subtype === 'most' ? Math.max(...counts) : Math.min(...counts);
    const correctId = baskets.find((b) => b.count === targetCount).id;
    return { index, type, subtype, category, baskets, correctId };
  }

  // 'more' or 'fewer': two baskets, never tied
  const diff = randInt(minDiff, maxDiff);
  const base = randInt(2, Math.max(2, maxCount - diff));
  const countA = base;
  const countB = base + diff;
  const baskets = shuffle([
    withItems({ id: 'b0', count: countA }),
    withItems({ id: 'b1', count: countB }),
  ]);
  const higherId = baskets.find((b) => b.count === Math.max(countA, countB)).id;
  const lowerId = baskets.find((b) => b.count === Math.min(countA, countB)).id;
  const correctId = type === 'more' ? higherId : lowerId;
  return { index, type, category, baskets, correctId };
}

// Wraps generateRound and stamps the round with which "half" (object
// baskets vs bare numerals) it belongs to, per the round plan.
function buildRound(index, prevCategoryKey, planEntry) {
  const round = generateRound(index, prevCategoryKey, planEntry.type);
  return { ...round, mode: planEntry.mode };
}

function getPromptParts(round) {
  const name = round.category.name;
  if (round.mode === 'numerals') {
    return round.type === 'more'
      ? { before: 'Which number is', keyword: 'bigger', after: '?' }
      : { before: 'Which number is', keyword: 'smaller', after: '?' };
  }
  switch (round.type) {
    case 'more':
      return { before: 'Which basket has', keyword: 'more', after: `${name}?` };
    case 'fewer':
      return { before: 'Which basket has', keyword: 'fewer', after: `${name}?` };
    case 'same':
      return { before: 'Which basket has the', keyword: 'same number', after: `of ${name} as mine?` };
    default:
      return round.subtype === 'most'
        ? { before: 'Which basket has the', keyword: 'most', after: `${name}?` }
        : { before: 'Which basket has the', keyword: 'fewest', after: `${name}?` };
  }
}

function getSpeechPrompt(round) {
  const name = round.category.name;
  if (round.mode === 'numerals') {
    return round.type === 'more' ? 'Which number is bigger?' : 'Which number is smaller?';
  }
  switch (round.type) {
    case 'more':
      return `Can you find the basket with more ${name}?`;
    case 'fewer':
      return `Can you find the basket with fewer ${name}?`;
    case 'same':
      return `Find the basket with the same number of ${name} as mine!`;
    default:
      return round.subtype === 'most'
        ? `Which basket has the most ${name}?`
        : `Which basket has the fewest ${name}?`;
  }
}

function getResultMessage(round) {
  const name = round.category.name;
  if (round.mode === 'numerals') {
    const counts = round.baskets.map((b) => b.count);
    return round.type === 'more'
      ? `${Math.max(...counts)} is bigger than ${Math.min(...counts)}!`
      : `${Math.min(...counts)} is smaller than ${Math.max(...counts)}!`;
  }
  switch (round.type) {
    case 'more':
      return `You spotted the basket with more ${name}!`;
    case 'fewer':
      return `You spotted the basket with fewer ${name}!`;
    case 'same':
      return `You matched the basket with ${round.target} ${name}!`;
    default:
      return round.subtype === 'most'
        ? `You found the basket with the most ${name}!`
        : `You found the basket with the fewest ${name}!`;
  }
}

function Game2Inner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const planRef = useRef(generateRoundPlan());
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => buildRound(0, null, planRef.current[0]));
  const [phase, setPhase] = useState('playing');
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [muted, setMuted] = useState(false);
  const [wrongBasketId, setWrongBasketId] = useState(null);
  const [hasErred, setHasErred] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const peakStreakRef = useRef(0);
  const hasLoggedRef = useRef(false);
  const hasSpokenRef = useRef(false);
  if (!hasSpokenRef.current) {
    hasSpokenRef.current = true;
    speak(getSpeechPrompt(round), muted);
  }

  const promptParts = getPromptParts(round);
  const isNumeralRound = round.mode === 'numerals';

  const handleBasketTap = (id) => {
    if (phase !== 'playing' || wrongBasketId) return;
    if (id === round.correctId) {
      setPhase('success');
      setStars((s) => s + 1);
      setStreak((s) => {
        const next = hasErred ? 0 : s + 1;
        peakStreakRef.current = Math.max(peakStreakRef.current, next);
        return next;
      });
      speak(getResultMessage(round), muted);
    } else {
      setHasErred(true);
      setStreak(0);
      setWrongBasketId(id);
      speak('Not quite, try again!', muted);
      setTimeout(() => setWrongBasketId(null), 600);
    }
  };

  const nextRound = () => {
    const next = roundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase('complete');
      speak("You're a comparing champion! Great job, friend!", muted);
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true;
        logPlaySession({ game: 'game2', playerName, stars, totalRounds: TOTAL_ROUNDS, peakStreak: peakStreakRef.current });
      }
      return;
    }
    const newRound = buildRound(next, round.category.key, planRef.current[next]);
    setRoundIndex(next);
    setRound(newRound);
    setPhase('playing');
    setWrongBasketId(null);
    setHasErred(false);
    setShowHint(false);
    speak(getSpeechPrompt(newRound), muted);
  };

  const playAgain = () => {
    planRef.current = generateRoundPlan();
    const newRound = buildRound(0, null, planRef.current[0]);
    setRoundIndex(0);
    setRound(newRound);
    setPhase('playing');
    setStars(0);
    setStreak(0);
    setWrongBasketId(null);
    setHasErred(false);
    setShowHint(false);
    peakStreakRef.current = 0;
    hasLoggedRef.current = false;
    speak(getSpeechPrompt(newRound), muted);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#48BFEE] via-[#8FE0FA] to-[#FFE9A8]">
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
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes basket-rock { 0%, 100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
        @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes sun-pulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(255,217,61,0.55)); } 50% { transform: scale(1.06); filter: drop-shadow(0 0 18px rgba(255,217,61,0.85)); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; }
        .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; }
        .animate-confetti-fall { animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: forwards; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-wobble { animation: wobble 0.6s ease-in-out infinite; }
        .animate-glow-pulse { animation: glow-pulse 0.9s ease-in-out infinite; }
        .animate-bob { animation: bob 2.4s ease-in-out infinite; }
        .animate-basket-rock { animation: basket-rock 4s ease-in-out infinite; }
        .animate-breathe { animation: breathe 2.6s ease-in-out infinite; }
        .animate-sun-pulse { animation: sun-pulse 3s ease-in-out infinite; }
        .animate-shimmer { animation: shimmer 2.2s linear infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[6%] text-5xl animate-float-slow">☁️</div>
        <div className="absolute right-[8%] top-[10%] text-4xl animate-float-slower">☁️</div>
        <div className="absolute right-[10%] top-[40%] text-2xl animate-sparkle">✨</div>
        <div className="absolute left-[8%] top-[35%] text-2xl animate-sparkle" style={{ animationDelay: '0.5s' }}>⭐</div>
        <div className="absolute right-[6%] top-[3%] text-6xl opacity-90 animate-sun-pulse">☀️</div>
        <div className="absolute left-[4%] bottom-[10%] text-4xl animate-float-slow" style={{ animationDelay: '1s' }}>🎈</div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center px-4 py-4 sm:py-6">
        <TopBar totalRounds={TOTAL_ROUNDS} stars={stars} muted={muted} onToggleMute={() => setMuted((m) => !m)} />

        {phase === 'complete' ? (
          <CompletionScreen stars={stars} total={TOTAL_ROUNDS} onPlayAgain={playAgain} />
        ) : (
          <>
            <h1 className="font-heading mt-2 text-xl font-bold text-white/95 drop-shadow sm:text-2xl">
              🧺 Teddy's Picnic Adventure!
            </h1>
            <p className="font-body text-sm font-bold text-white/80 sm:text-base">
              Round {roundIndex + 1} of {TOTAL_ROUNDS} {isNumeralRound && <span className="opacity-80">· Numbers round 🔢</span>}
            </p>
            <RoundDots total={TOTAL_ROUNDS} current={roundIndex} halfMark={6} />

            <TeddyPrompt promptParts={promptParts} streak={streak} isWrong={!!wrongBasketId} />

            {round.type === 'same' && <ReferenceBasket category={round.category} target={round.target} />}

            <div className="mt-5 flex w-full flex-1 justify-center px-3 sm:px-4">
  <div
    className={`grid w-full max-w-5xl justify-items-center gap-2  ${
      round.baskets.length === 3
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
    }`}
  >
    {round.baskets.map((basket, index) => {
      const centerLastBasket = round.baskets.length === 3 && index === 2;

      return (
        <div
          key={basket.id}
          className={
            centerLastBasket
              ? 'w-full sm:col-span-2 xl:col-span-1 flex justify-center'
              : 'w-full flex justify-center'
          }
        >
          {isNumeralRound ? (
            <NumeralCard
              value={basket.count}
              category={round.category}
              onTap={() => handleBasketTap(basket.id)}
              disabled={phase !== 'playing'}
              isWrong={wrongBasketId === basket.id}
              isCorrectChosen={phase === 'success' && basket.id === round.correctId}
              isDimmed={phase === 'success' && basket.id !== round.correctId}
              showObjectHint={showHint}
            />
          ) : (
            <BasketCard
              basket={basket}
              category={round.category}
              onTap={() => handleBasketTap(basket.id)}
              disabled={phase !== 'playing'}
              isWrong={wrongBasketId === basket.id}
              isCorrectChosen={phase === 'success' && basket.id === round.correctId}
              isDimmed={phase === 'success' && basket.id !== round.correctId}
              showHintGlow={showHint && phase === 'playing' && basket.id === round.correctId}
            />
          )}
        </div>
      );
    })}
  </div>
</div>

            {phase === 'playing' && (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                disabled={showHint}
                className="font-body mt-5 rounded-full bg-white/85 px-5 py-2 text-sm font-extrabold text-slate-600 shadow-[0_4px_0_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-default disabled:opacity-50 sm:text-base"
              >
                {isNumeralRound
                  ? showHint
                    ? '🔢 Counting shown!'
                    : '🔢 Show as objects'
                  : showHint
                  ? '🔍 Hint shown!'
                  : '🔍 Need a hint?'}
              </button>
            )}

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

export default function Game2() {
  return (
    <NameGate gameLabel="Game 2: Teddy's Picnic Adventure">
      <GameAccessGate gameNumber={2} gameLabel="Game 2: Teddy's Picnic Adventure">
        <Game2Inner />
      </GameAccessGate>
    </NameGate>
  );
}

function TeddyPrompt({ promptParts, streak, isWrong }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="relative">
        <span className={`inline-block text-6xl sm:text-7xl ${isWrong ? 'animate-shake' : 'animate-bob'}`}>🧸</span>
        {streak >= 2 && (
          <span className="font-body animate-pop-in absolute -right-3 -top-2 rounded-full bg-orange-400 px-2 py-0.5 text-xs font-extrabold text-white shadow">
            🔥{streak}
          </span>
        )}
      </div>
      <div className="animate-pop-in relative max-w-xs rounded-3xl bg-white px-5 py-3 text-center shadow-[0_6px_0_rgba(0,0,0,0.1)] sm:max-w-sm">
        <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white" />
        {isWrong ? (
          <p className="font-body text-sm font-bold text-orange-600 sm:text-base">Not quite! Try again 💪</p>
        ) : (
          <p className="font-body text-sm font-bold text-slate-700 sm:text-base">
            {promptParts.before} <span className="text-pink-500">{promptParts.keyword}</span> {promptParts.after}
          </p>
        )}
      </div>
    </div>
  );
}

function ReferenceBasket({ category, target }) {
  const items = useMemo(
    () =>
      Array.from({ length: target }, (_, i) => ({
        id: `ref-${i}`,
        rotation: (Math.random() * 16 - 8).toFixed(1),
      })),
    [target]
  );
  return (
    <div className="animate-pop-in mt-4 flex flex-col items-center gap-1.5">
      <span className="font-body rounded-full bg-white/90 px-3 py-0.5 text-xs font-extrabold text-slate-600 shadow sm:text-sm">
        🧸 Teddy's basket
      </span>
      <div className="relative flex min-h-[4rem] w-full max-w-[10rem] flex-wrap content-start items-start justify-center gap-1 rounded-b-[1.75rem] rounded-t-lg border-4 border-cyan-800/70 bg-gradient-to-b from-cyan-200 to-cyan-400 p-2.5 shadow-inner sm:max-w-[12rem]">
        <span className="absolute -top-2.5 left-1/2 h-3 w-8 -translate-x-1/2 rounded-t-full border-4 border-b-0 border-cyan-800/70" />
        {items.map((it, i) => (
          <span
            key={it.id}
            style={{ rotate: `${it.rotation}deg`, animationDelay: `${(i % 4) * 0.25}s` }}
            className="animate-float-slower flex h-8 w-8 items-center justify-center text-xl sm:h-9 sm:w-9 sm:text-2xl"
          >
            {category.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

function BasketCard({ basket, category, onTap, disabled, isWrong, isCorrectChosen, isDimmed, showHintGlow }) {
  const stateAnim = isWrong
    ? 'animate-shake'
    : isCorrectChosen
    ? 'animate-wobble ring-8 ring-green-300'
    : showHintGlow
    ? 'animate-glow-pulse ring-4 ring-yellow-300'
    : isDimmed
    ? ''
    : 'animate-basket-rock';
  return (
    <button
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
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`group relative flex max-h-48 min-h-[8.5rem] w-full max-w-[14rem] flex-wrap content-start items-start justify-center gap-1.5 rounded-b-[2.25rem] rounded-t-xl border-4 border-lime-700/70 bg-gradient-to-b from-violet-200 to-lime-200 p-3 shadow-[0_8px_0_rgba(0,0,0,0.18)] transition-all duration-200 ease-out sm:min-h-[10.5rem] sm:max-w-[15rem] sm:p-4 ${
        disabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1 active:translate-y-1 active:shadow-[0_3px_0_rgba(0,0,0,0.18)]'
      } ${stateAnim} ${isDimmed ? 'opacity-40 grayscale-[30%]' : ''}`}
    >
      <span className="absolute -top-3 left-1/2 h-4 w-10 -translate-x-1/2 rounded-t-full border-4 border-b-0 border-cyan-800/70" />
      {basket.items.map((it, i) => (
        <span
          key={it.id}
          style={{ rotate: `${it.rotation}deg`, animationDelay: `${(i % 4) * 0.25}s` }}
          className="animate-float-slower flex h-8 w-8 items-center justify-center text-3xl sm:h-9 sm:w-10 sm:text-4xl"
        >
          {category.emoji}
        </span>
      ))}
    </button>
  );
}

function NumeralCard({ value, category, onTap, disabled, isWrong, isCorrectChosen, isDimmed, showObjectHint }) {
  const stateAnim = isWrong
    ? 'animate-shake'
    : isCorrectChosen
    ? 'animate-wobble ring-8 ring-green-300'
    : isDimmed
    ? ''
    : 'animate-basket-rock';
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`group relative flex max-h-48 min-h-[8.5rem] w-full max-w-[14rem] flex-col items-center justify-center gap-2 rounded-b-[2.25rem] rounded-t-xl border-4 border-lime-700/70 bg-gradient-to-b from-violet-200 to-lime-200 p-3 shadow-[0_8px_0_rgba(0,0,0,0.18)] transition-all duration-200 ease-out sm:min-h-[10.5rem] sm:max-w-[15rem] sm:p-4 ${
        disabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1 active:translate-y-1 active:shadow-[0_3px_0_rgba(0,0,0,0.18)]'
      } ${stateAnim} ${isDimmed ? 'opacity-40 grayscale-[30%]' : ''}`}
    >
      <span className="absolute -top-3 left-1/2 h-4 w-10 -translate-x-1/2 rounded-t-full border-4 border-b-0 border-cyan-800/70" />
      <span className="font-heading animate-breathe text-6xl font-bold text-slate-700 drop-shadow sm:text-7xl">{value}</span>
      {showObjectHint && (
        <div className="animate-pop-in flex max-w-[8.5rem] flex-wrap items-center justify-center gap-0.5 rounded-xl bg-white/70 p-1.5">
          {Array.from({ length: value }).map((_, i) => (
            <span key={i} className="text-sm sm:text-base">
              {category.emoji}
            </span>
          ))}
        </div>
      )}
    </button>
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

function RoundDots({ total, current, halfMark }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          {halfMark && i === halfMark && <span className="mx-1 h-3 w-px bg-white/40" />}
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors sm:h-2 sm:w-2 ${
              i < current ? 'bg-white' : i === current ? 'animate-sparkle bg-yellow-300' : 'bg-white/30'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function SuccessOverlay({ message, isLastRound, streak, onNext }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <Confetti pieces={streak >= 3 ? 50 : 30} />
      <div className="animate-pop-in relative flex max-w-sm flex-col items-center rounded-[2.5rem] bg-white px-8 py-8 text-center shadow-2xl">
        <div className="text-6xl">{streak >= 3 ? '🌟' : '🎉'}</div>
        <p className="font-heading mt-2 text-2xl font-bold text-amber-500 sm:text-3xl">
          {streak >= 3 ? 'On a streak!' : 'Well done!'}
        </p>
        <p className="font-body mt-2 text-base font-semibold text-slate-500 sm:text-lg">{message}</p>
        <button
          onClick={onNext}
          className="font-heading mt-6 rounded-full bg-gradient-to-b from-green-400 to-green-500 px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
        >
          {isLastRound ? 'See my results! 🏆' : 'Next round ➡️'}
        </button>
      </div>
    </div>
  );
}

function CompletionScreen({ stars, total, onPlayAgain }) {
  return (
    <div className="relative mt-10 flex flex-col items-center rounded-[2.5rem] bg-white/90 px-6 py-8 text-center shadow-2xl sm:px-14 sm:py-10">
      <Confetti pieces={40} />
      <div className="animate-bob text-7xl">🧺🏆</div>
      <h2 className="font-heading mt-3 text-3xl font-bold text-slate-800 sm:text-4xl">Picnic packed perfectly!</h2>
      <p className="font-body mt-2 text-lg font-semibold text-slate-500">
        You earned {stars} out of {total} stars
      </p>
      <div className="mt-3">
        <StarMeter stars={stars} total={total} dark />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onPlayAgain}
          className="font-heading rounded-full bg-gradient-to-b from-pink-400 to-pink-500 px-6 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
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

function Confetti({ pieces = 24 }) {
  const colors = ['#FF6FA5', '#FFD93D', '#6BCB77', '#4FC3F7', '#9B5DE5', '#FF9F45'];
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: (Math.random() * 0.5).toFixed(2),
        duration: (1.8 + Math.random() * 1.4).toFixed(2),
        color: colors[Math.floor(Math.random() * colors.length)],
        rotate: Math.floor(Math.random() * 360),
        size: 7 + Math.random() * 7,
      })),
    [pieces]
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {items.map((p) => (
        <span
          key={p.id}
          className="animate-confetti-fall absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}