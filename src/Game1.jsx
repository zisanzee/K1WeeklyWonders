import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';

const TOTAL_ROUNDS = 5;
const ROUND_RANGES = [
  [3, 5],
  [4, 6],
  [5, 7],
  [6, 8],
  [7, 9],
];

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

function generateRound(roundIndex, prevCategoryKey) {
  const pool = CATEGORIES.length > 1 ? CATEGORIES.filter((c) => c.key !== prevCategoryKey) : CATEGORIES;
  const category = pool[Math.floor(Math.random() * pool.length)];
  const item = category.items[Math.floor(Math.random() * category.items.length)];
  const [min, max] = ROUND_RANGES[roundIndex] || [5, 8];
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const objects = Array.from({ length: count }, (_, i) => ({
    id: `r${roundIndex}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    counted: false,
    order: null,
    rotation: (Math.random() * 16 - 8).toFixed(1),
  }));
  return { category, item, count, objects };
}

function generateQuizOptions(correct) {
  const options = new Set([correct]);
  const deltas = shuffle([-2, -1, 1, 2]);
  let i = 0;
  while (options.size < 3 && i < deltas.length) {
    const val = correct + deltas[i];
    if (val > 0) options.add(val);
    i += 1;
  }
  let extra = 3;
  while (options.size < 3) {
    if (!options.has(extra)) options.add(extra);
    extra += 1;
  }
  return shuffle([...options]);
}

function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  utterance.pitch = 1.3;
  window.speechSynthesis.speak(utterance);
}

export default function Game1() {
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => generateRound(0, null));
  const [countSoFar, setCountSoFar] = useState(0);
  const [phase, setPhase] = useState('counting');
  const [quizOptions, setQuizOptions] = useState([]);
  const [wrongPicks, setWrongPicks] = useState([]);
  const [stars, setStars] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleObjectTap = (obj) => {
    if (obj.counted || phase !== 'counting') return;
    const newCount = countSoFar + 1;
    setRound((r) => ({
      ...r,
      objects: r.objects.map((o) => (o.id === obj.id ? { ...o, counted: true, order: newCount } : o)),
    }));
    setCountSoFar(newCount);
    speak(String(newCount), muted);
    if (newCount === round.count) {
      setTimeout(() => {
        setPhase('reveal');
       
      }, 700);
    }
  };

  const startQuiz = () => {
    setQuizOptions(generateQuizOptions(round.count));
    setWrongPicks([]);
    setPhase('quiz');
    speak(`How many ${round.item.name} were there altogether?`, muted);
  };

  const handleQuizPick = (value) => {
    if (value === round.count) {
      setPhase('correct');
      setStars((s) => s + 1);
      speak(`Yes! Great counting! There are ${round.count} ${round.item.name} altogether!`, muted);
    } else {
      setWrongPicks((w) => [...w, value]);
      speak('Not quite, try again!', muted);
    }
  };

  const nextRound = () => {
    const next = roundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase('complete');
      speak("Amazing job! You're a counting star!", muted);
      return;
    }
    const newRound = generateRound(next, round.category.key);
    setRoundIndex(next);
    setRound(newRound);
    setCountSoFar(0);
    setPhase('counting');
    speak(`Let's count the ${newRound.item.name}!`, muted);
  };

  const playAgain = () => {
    const newRound = generateRound(0, null);
    setRoundIndex(0);
    setRound(newRound);
    setCountSoFar(0);
    setStars(0);
    setWrongPicks([]);
    setPhase('counting');
    speak(`Let's count the ${newRound.item.name}!`, muted);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-yellow-200">
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
        .font-heading { font-family: 'Fredoka', sans-serif; }
        .font-body { font-family: 'Nunito', sans-serif; }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 8s ease-in-out infinite; }
        .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .animate-sparkle { animation: sparkle 1.8s ease-in-out infinite; }
        .animate-confetti-fall { animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: forwards; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[8%] text-5xl animate-float-slow">☁️</div>
        <div className="absolute right-[8%] top-[14%] text-4xl animate-float-slower">☁️</div>
        <div className="absolute left-[12%] bottom-[10%] text-4xl animate-float-slower">☁️</div>
        <div className="absolute right-[10%] top-[55%] text-2xl animate-sparkle">✨</div>
        <div className="absolute left-[8%] top-[45%] text-2xl animate-sparkle" style={{ animationDelay: '0.5s' }}>⭐</div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center px-4 py-6 sm:py-10">
        <TopBar totalRounds={TOTAL_ROUNDS} stars={stars} muted={muted} onToggleMute={() => setMuted((m) => !m)} />

        {phase === 'complete' ? (
          <CompletionScreen stars={stars} total={TOTAL_ROUNDS} onPlayAgain={playAgain} />
        ) : (
          <>
            <h1 className="font-heading mt-3 text-xl font-bold text-white/95 drop-shadow sm:text-2xl">
              🔢 Counting Time!
            </h1>
            <p className="font-body text-sm font-bold text-white/80 sm:text-base">
              Round {roundIndex + 1} of {TOTAL_ROUNDS}
            </p>

            <div className="mt-4 text-center">
              {phase === 'counting' && (
                <>
                  <h2 className="font-heading text-3xl font-bold text-white drop-shadow sm:text-4xl">
                    Let's count the {round.item.name}! {round.item.emoji}
                  </h2>
                  <div
                    aria-live="polite"
                    className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-[0_6px_0_rgba(0,0,0,0.15)]"
                  >
                    <span key={countSoFar} className="font-heading animate-pop-in text-4xl font-bold text-pink-500">
                      {countSoFar}
                    </span>
                  </div>
                </>
              )}
              {phase === 'reveal' && (
                <>
                  <h2 className="font-heading text-3xl font-bold text-white drop-shadow sm:text-4xl">
                    🎉 There are <span className="text-yellow-300">{round.count}</span> {round.item.name} altogether!
                  </h2>
                  <p className="font-body mt-2 text-base font-semibold text-white/90 sm:text-lg">
                    The last number we counted tells us how many!
                  </p>
                </>
              )}
              {(phase === 'quiz' || phase === 'correct') && (
                <h2 className="font-heading text-2xl font-bold text-white drop-shadow sm:text-3xl">
                  {phase === 'correct' ? `🌟 Yes! ${round.count} is right!` : `How many ${round.item.name} were there altogether?`}
                </h2>
              )}
            </div>

            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3 rounded-[2rem] bg-white/30 p-6 shadow-inner backdrop-blur-sm sm:gap-5 sm:p-10">
              {phase === 'reveal' && <Confetti pieces={18} />}
              {phase === 'correct' && <Confetti pieces={28} />}
              {round.objects.map((obj) => (
                <ObjectButton
                  key={obj.id}
                  obj={obj}
                  item={round.item}
                  onTap={() => handleObjectTap(obj)}
                  disabled={phase !== 'counting' || obj.counted}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col items-center">
              {phase === 'counting' && (
                <p className="font-body animate-pulse text-base font-bold text-white/90 sm:text-lg">
                  Tap each one as you count! 👆
                </p>
              )}
              {phase === 'reveal' && (
                <button
                  onClick={startQuiz}
                  className="font-heading rounded-full bg-gradient-to-b from-purple-400 to-purple-500 px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
                >
                  Let's check! ➡️
                </button>
              )}
              {phase === 'quiz' && (
                <div className="flex gap-4">
                  {quizOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleQuizPick(opt)}
                      disabled={wrongPicks.includes(opt)}
                      className={`font-heading flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold shadow-[0_5px_0_rgba(0,0,0,0.15)] transition-transform sm:h-20 sm:w-20 sm:text-3xl ${
                        wrongPicks.includes(opt)
                          ? 'animate-shake bg-slate-200 text-slate-400'
                          : 'bg-white text-purple-600 hover:-translate-y-1 active:translate-y-1 active:shadow-none'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {phase === 'correct' && (
                <button
                  onClick={nextRound}
                  className="font-heading rounded-full bg-gradient-to-b from-green-400 to-green-500 px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
                >
                  {roundIndex + 1 >= TOTAL_ROUNDS ? 'See my results! 🏆' : 'Next round ➡️'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
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
        <div className="flex gap-1" aria-label={`${stars} out of ${totalRounds} stars earned`}>
          {Array.from({ length: totalRounds }).map((_, i) => (
            <span key={i} className={`text-xl sm:text-2xl ${i < stars ? '' : 'opacity-30 grayscale'}`}>⭐</span>
          ))}
        </div>
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

function ObjectButton({ obj, item, onTap, disabled }) {
  return (
    <div style={{ transform: `rotate(${obj.rotation}deg)` }} className="inline-block">
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={obj.counted ? `Counted, number ${obj.order}` : 'Tap to count this one'}
        className={`relative flex h-20 w-20 items-center justify-center rounded-3xl text-5xl transition-all duration-300 sm:h-24 sm:w-24 sm:text-6xl ${
          obj.counted
            ? 'scale-105 bg-white/80 shadow-inner ring-4 ring-yellow-300'
            : 'cursor-pointer bg-white/40 shadow-[0_6px_0_rgba(0,0,0,0.15)] hover:-translate-y-1 hover:bg-white/60 active:translate-y-0.5 active:shadow-none'
        }`}
      >
        <span>{item.emoji}</span>
        {obj.counted && (
          <span className="font-heading animate-pop-in absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-pink-500 text-sm font-extrabold text-white shadow">
            {obj.order}
          </span>
        )}
      </button>
    </div>
  );
}

function CompletionScreen({ stars, total, onPlayAgain }) {
  return (
    <div className="relative mt-10 flex flex-col items-center rounded-[2.5rem] bg-white/90 px-8 py-10 text-center shadow-2xl sm:px-14">
      <Confetti pieces={40} />
      <div className="text-7xl">🏆</div>
      <h2 className="font-heading mt-3 text-3xl font-bold text-slate-800 sm:text-4xl">Amazing counting!</h2>
      <p className="font-body mt-2 text-lg font-semibold text-slate-500">
        You earned {stars} out of {total} stars
      </p>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`text-3xl ${i < stars ? 'animate-pop-in' : 'opacity-20 grayscale'}`}>⭐</span>
        ))}
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