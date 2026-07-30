import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { getNumberVoiceUrl } from './Phaser/common/numbersVoice';

const TOTAL_ROUNDS = 15;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// ---------------------------------------------------------------------------
// Pre-recorded voice-over audio clips replacing speechSynthesis.
// ---------------------------------------------------------------------------
const GAME3_AUDIO = {
  whatNumberBefore: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349243/What_number_comes_right_before_blbbby.mp3',
  whatNumberAfter: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349243/What_number_comes_right_after_hbgthx.mp3',
  comesRightBefore: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349243/comes_right_before_pafkn9.mp3',
  comesRightAfter: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349242/comes_right_after_pyvinm.mp3',
  notQuite: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349242/Not_quite_try_again_oyopho.mp3',
  completion: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349242/You_re_a_number-line_explorer_Amazing_job_hivx6k.mp3',
};

// Lazily populated audio cache — preloading happens inside the component
// (see Game3Inner's useEffect) so nothing loads until the user actually
// navigates to this game.
const _audioCache = {};
function preloadAll(urlMap) {
  Object.values(urlMap).forEach((url) => {
    if (!_audioCache[url]) {
      const a = new Audio(url);
      a.preload = 'auto';
      _audioCache[url] = a;
    }
  });
}

// Also preload number voices 1-10 so dynamic number clips play instantly.
function preloadNumberVoices() {
  for (let n = 1; n <= 10; n++) {
    const url = getNumberVoiceUrl(n);
    if (url && !_audioCache[url]) {
      const a = new Audio(url);
      a.preload = 'auto';
      _audioCache[url] = a;
    }
  }
}

let _currentAudio = null;

/** Cancel any currently playing audio immediately. */
function cancelAudio() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

/** Play a single audio URL; if onComplete is given, call it when the clip ends. */
function playUrl(url, onComplete) {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }

  const audio = _audioCache[url] || new Audio(url);

  // Always clear the previous onended handler first — cached Audio objects
  // may carry a stale handler from an earlier call that had onComplete,
  // which would fire unexpectedly (and potentially restart the chain) the
  // next time this URL is played without onComplete.
  audio.onended = null;

  _currentAudio = audio;
  if (onComplete) {
    audio.onended = () => {
      if (_currentAudio === audio) _currentAudio = null;
      onComplete();
    };
  }
  audio.currentTime = 0;
  audio.play().catch(() => {
    if (onComplete) onComplete();
  });
}

/** Play a number-word voice clip (e.g. "seven") and call onComplete when done. */
function playNumberWord(word, onComplete) {
  const url = getNumberVoiceUrl(word);
  if (!url) {
    if (onComplete) onComplete();
    return;
  }
  playUrl(url, onComplete);
}
const TILE_WIDTH = 64; // px, keep in sync with slider drag math below
const WINDOW_SIZE = 5;
const MIN_NUM = 1;
const MAX_NUM = 10;

// Three difficulty blocks of 5 rounds each. Block 0 is the easiest combo
// (numeral prompt, but fewer slider word-hints); block 1 is the original
// "easy" configuration (spelled prompt, every slider number spelled out);
// block 2 is the original "hard" configuration (spelled prompt, only the
// highlighted number spelled out) -- the hardest combination, saved for last.
const LEVEL_THEMES = [
  {
    label: 'Level 1 · Shallow Waters',
    emoji: '🐚',
    pill: 'border-white bg-sky-200/90 text-teal-700',
    accent: 'from-teal-400 to-teal-500',
  },
  {
    label: 'Level 2 · Coral Garden',
    emoji: '🪸',
    pill: 'border-white bg-green-200/90 text-sky-700',
    accent: 'from-sky-400 to-sky-500',
  },
  {
    label: 'Level 3 · Deep Trench',
    emoji: '🦑',
    pill: 'border-white bg-red-200/90 text-indigo-700',
    accent: 'from-indigo-400 to-indigo-500',
  },
];

function getBlockIndex(roundIndex) {
  return Math.floor(roundIndex / 5);
}

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
  if (typeof window === 'undefined') return;

  // Muting means cancel any currently playing audio and stop.
  if (muted) {
    cancelAudio();
    return;
  }

  cancelAudio();

  // ─── Static lines ──────────────────────────────────────────────
  if (text === "Not quite, try again!") {
    playUrl(GAME3_AUDIO.notQuite);
    return;
  }
  if (text === "You're a number-line explorer! Amazing job!") {
    playUrl(GAME3_AUDIO.completion);
    return;
  }

  // ─── "What number comes right before/after {word}?" ────────────
  const beforePrompt = text.match(/^What number comes right before (\w+)\?$/i);
  if (beforePrompt) {
    const word = beforePrompt[1].toLowerCase();
    playUrl(GAME3_AUDIO.whatNumberBefore, () => playNumberWord(word));
    return;
  }
  const afterPrompt = text.match(/^What number comes right after (\w+)\?$/i);
  if (afterPrompt) {
    const word = afterPrompt[1].toLowerCase();
    playUrl(GAME3_AUDIO.whatNumberAfter, () => playNumberWord(word));
    return;
  }

  // ─── "{correctWord} comes right before/after {refWord}!" ───────
  const resultBefore = text.match(/^(\w+) comes right before (\w+)!$/i);
  if (resultBefore) {
    const correct = resultBefore[1].toLowerCase();
    const ref = resultBefore[2].toLowerCase();
    playNumberWord(correct, () => {
      playUrl(GAME3_AUDIO.comesRightBefore, () => playNumberWord(ref));
    });
    return;
  }
  const resultAfter = text.match(/^(\w+) comes right after (\w+)!$/i);
  if (resultAfter) {
    const correct = resultAfter[1].toLowerCase();
    const ref = resultAfter[2].toLowerCase();
    playNumberWord(correct, () => {
      playUrl(GAME3_AUDIO.comesRightAfter, () => playNumberWord(ref));
    });
    return;
  }
}

function getWindowStart(highlighted) {
  return clamp(highlighted - 2, MIN_NUM, MAX_NUM - WINDOW_SIZE + 1);
}

// Builds 3 rounds worth of before/after type per block, shuffled within
// each block so each 5-round level gets its own balanced mix.
function buildPlan() {
  const patterns = [
    ['before', 'before', 'before', 'after', 'after'],
    ['before', 'before', 'after', 'after', 'after'],
    ['before', 'before', 'before', 'after', 'after'],
  ];
  return patterns.flatMap((p) => shuffle(p));
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
  const promptNumeral = getBlockIndex(index) === 0;
  return { index, type, reference, correct, options, promptNumeral };
}

function getPromptParts(round) {
  const refDisplay = round.promptNumeral ? String(round.reference) : NUMBER_WORDS[round.reference];
  return round.type === 'before'
    ? { before: 'What comes right', keyword: 'before', after: `${refDisplay}?` }
    : { before: 'What comes right', keyword: 'after', after: `${refDisplay}?` };
}

function getSpeechPrompt(round) {
  const refWord = NUMBER_WORDS[round.reference];
  return `What number comes right ${round.type} ${refWord}?`;
}

function getResultMessage(round) {
  const refWord = NUMBER_WORDS[round.reference];
  const correctWord = NUMBER_WORDS[round.correct];
  return round.type === 'before'
    ? `${correctWord} comes right before ${refWord}!`
    : `${correctWord} comes right after ${refWord}!`;
}

function getSliderPrompt(blockIndex) {
  switch (blockIndex) {
    case 0:
      return '🐚 Slide to find the shell';
    case 1:
      return '🪸 Slide to find the coral';
    case 2:
      return '🦑 Slide to find the squid';
    default:
      return '🐚 Slide to find the shell';
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);

    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

/**
 * Returns a scale factor (≥1) so the game content fills larger viewports
 * proportionally. Phones stay at 1× (they're narrower than either design
 * width below, so the formula naturally floors them there — mobile layout
 * is left completely untouched).
 *
 * Two design references are used:
 *  - Below 1080px wide (iPad portrait, iPad landscape, and similar tablets)
 *    we scale against a smaller 700×640 reference. The old single 1024×640
 *    reference meant anything narrower than 1024px (i.e. basically every
 *    iPad in portrait, and some in landscape) fell back to scaleX < 1 and
 *    got floored at 1×, which is why tablets looked too small.
 *  - 1080px and up (laptops/desktops) keep the original 1024×640 reference,
 *    since that tier was already looking good.
 * Both take the smaller of the width- and height-based ratios so the scaled
 * content always fits the viewport without clipping.
 */
function useContentScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const isTabletRange = w < 1080;
      const DESIGN_W = isTabletRange ? 700 : 1024;
      const DESIGN_H = 640;
      const CAP = isTabletRange ? 2.2 : 2.5;

      const scaleX = w / DESIGN_W;
      const scaleY = h / DESIGN_H;
      const s = Math.min(scaleX, scaleY);

      // Never shrink below 1× (phones untouched), cap per tier above.
      setScale(Math.max(1, Math.min(s, CAP)));
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return scale;
}

/**
 * Returns true when the viewport is at least 768px wide — used to detect
 * tablet-class screens for JS-controlled element sizing (e.g. slider tiles).
 */
function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsTablet(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isTablet;
}

function Game3Inner() {
  const playerName = usePlayerStore((s) => s.playerName);
  const [audioReady, setAudioReady] = useState(false);
  const planRef = useRef(buildPlan());
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
  const contentScale = useContentScale();

  // Preload audio assets the moment the user enters this game — starts
  // fetching all audio files so they play instantly when speak() is called.
  useEffect(() => {
    preloadAll(GAME3_AUDIO);
    preloadNumberVoices();
    setAudioReady(true);

    // Cleanup: cancel any in-flight audio when the player navigates away,
    // so voice lines don't keep playing on the homepage or another game.
    return () => cancelAudio();
  }, []);

  const peakStreakRef = useRef(0);
  const hasLoggedRef = useRef(false);
  const hasSpokenRef = useRef(false);
  if (!hasSpokenRef.current) {
    hasSpokenRef.current = true;
    speak(getSpeechPrompt(round), muted);
  }

  const blockIndex = getBlockIndex(roundIndex);
  const levelTheme = LEVEL_THEMES[blockIndex];
  const showAllWords = blockIndex === 1;
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
    planRef.current = buildPlan();
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

  if (!audioReady) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-gradient-to-b from-[#8FE9E4] via-[#2FA8C9] to-[#123A6B]">
        <div className="flex flex-col items-center gap-4">
          <span className="text-6xl animate-pulse">🐚</span>
          <p className="font-heading text-xl font-bold text-white drop-shadow-lg">Loading audio...</p>
        </div>
      </div>
    );
  }

  // ── Shared content fragment (rendered inside both mobile & scaled wrappers) ──
  const gameArea = (
    <>
      {phase === 'complete' ? (
        <div className="flex w-full flex-1 min-h-0 items-center justify-center overflow-y-auto">
          <CompletionScreen stars={stars} total={TOTAL_ROUNDS} onPlayAgain={playAgain} />
        </div>
      ) : (
        <div className="flex w-full flex-1 min-h-0 flex-col items-center justify-center overflow-y-auto">
          <h1 className="font-heading mt-1 flex-none text-lg font-bold text-white/95 drop-shadow [@media(min-width:640px)_and_(min-height:560px)]:mt-2 [@media(min-width:640px)_and_(min-height:560px)]:text-2xl">
            🐙 Ollie's Number Reef
          </h1>
          <p className="font-body flex-none text-xs font-bold text-white/80 [@media(min-width:640px)_and_(min-height:560px)]:text-base">
            Round {roundIndex + 1} of {TOTAL_ROUNDS}
          </p>
          <span className="font-body mt-0.5 flex-none rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white/85 [@media(min-width:640px)_and_(min-height:560px)]:text-xs">
            {levelTheme.label}
          </span>
          <RoundDots total={TOTAL_ROUNDS} current={roundIndex} />

          <OllieBubble promptParts={promptParts} isWrong={!!wrongValue} />

          <div className="mt-2 flex flex-none flex-col items-center gap-1.5 [@media(min-width:640px)_and_(min-height:560px)]:mt-5 [@media(min-width:640px)_and_(min-height:560px)]:gap-2">
            <span className="font-body rounded-full bg-white/85 px-3 py-0.5 text-xs font-extrabold text-teal-700 shadow [@media(min-width:640px)_and_(min-height:560px)]:text-sm">
              {getSliderPrompt(blockIndex)}
            </span>
            <NumberSlider
              highlighted={highlighted}
              onChange={setHighlighted}
              showAllWords={showAllWords}
              referenceNumber={round.reference}
              disabled={phase !== 'playing'}
            />
          </div>

          <div className="mt-3 flex flex-none flex-wrap items-center justify-center gap-2 [@media(min-width:640px)_and_(min-height:560px)]:mt-6 [@media(min-width:640px)_and_(min-height:560px)]:gap-4">
            {round.options.map((opt) => (
              <AnswerPill
                key={opt.value}
                option={opt}
                emoji={levelTheme.emoji}
                baseClass={levelTheme.pill}
                onTap={() => handleAnswer(opt.value)}
                disabled={phase !== 'playing'}
                isWrong={wrongValue === opt.value}
                isCorrectChosen={phase === 'success' && opt.value === round.correct}
                isDimmed={phase === 'success' && opt.value !== round.correct}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#8FE9E4] via-[#2FA8C9] to-[#123A6B]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap"
      />
      <Helmet>
        <title>Around the Number | K1 Weekly Wonders</title>

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
        .font-body { font-family: 'Fredoka', sans-serif; }
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

      {/* fixed-position overlays live OUTSIDE the scale transform so they
          still cover the viewport correctly. */}
      <TopBar
        totalRounds={TOTAL_ROUNDS}
        stars={stars}
        muted={muted}
        onToggleMute={() => { cancelAudio(); setMuted((m) => !m); }}
      />
      {celebrate && <Celebration onDone={() => setCelebrate(false)} />}

      {phase === 'complete' && (
        <Confetti
          numberOfPieces={160}
          recycle={false}
          gravity={0.2}
          colors={['#5EEAD4', '#38BDF8', '#A78BFA', '#FCD34D', '#FB7185']}
          style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
        />
      )}

      {phase === 'success' && (
        <SuccessOverlay
          message={getResultMessage(round)}
          isLastRound={roundIndex + 1 >= TOTAL_ROUNDS}
          streak={streak}
          accent={levelTheme.accent}
          onNext={nextRound}
        />
      )}

      {contentScale > 1 ? (
        /* ── Scaled layout for large screens ────────────────────────── */
        <div className="relative z-10 flex h-full w-full items-center justify-center overflow-visible">
          <div
            style={{ transform: `scale(${contentScale})`, transformOrigin: 'center center' }}
          >
            <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-2 pt-14 [@media(min-width:640px)_and_(min-height:560px)]:pb-4 [@media(min-width:640px)_and_(min-height:560px)]:pt-16">
              {gameArea}
            </div>
          </div>
        </div>
      ) : (
        /* ── Original mobile / tablet layout (scale === 1) ──────────── */
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center overflow-hidden px-4 pb-2 pt-14 [@media(min-width:640px)_and_(min-height:560px)]:pb-4 [@media(min-width:640px)_and_(min-height:560px)]:pt-16">
          {gameArea}
        </div>
      )}
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
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const tileWidth = isMobile ? 54 : isTablet ? 80 : TILE_WIDTH;
  const windowStart = getWindowStart(highlighted);
  const offsetPx = (windowStart - MIN_NUM) * tileWidth;
  const dragRef = useRef({ dragging: false, startX: 0, startHighlighted: highlighted });

  const handlePointerDown = (e) => {
    if (disabled) return;
    dragRef.current = { dragging: true, startX: e.clientX, startHighlighted: highlighted };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const deltaTiles = Math.round(-dx / tileWidth);
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
    <div className="flex origin-center scale-[0.82] items-center gap-0.5 sm:scale-100 sm:gap-2">
      <SliderArrow
        direction="left"
        onClick={() => onChange(clamp(highlighted - 1, MIN_NUM, MAX_NUM))}
        disabled={disabled || highlighted <= MIN_NUM}
      />

      <div
        className="relative touch-none select-none overflow-hidden rounded-3xl border-4 border-white/70 bg-white/20 shadow-inner"
        style={{
          width: tileWidth * WINDOW_SIZE,
          height: 82,
        }}
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
              width={tileWidth}
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

function SliderTile({ width, n, isHighlighted, isReference, showWord, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      style={{ width }}
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
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/85 text-lg font-bold text-teal-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform active:translate-y-0.5 active:shadow-none disabled:opacity-30 [@media(min-width:768px)_and_(min-height:600px)]:h-12 [@media(min-width:768px)_and_(min-height:600px)]:w-12"
    >
      {direction === 'left' ? '◀' : '▶'}
    </button>
  );
}

function AnswerPill({ option, emoji, baseClass, onTap, disabled, isWrong, isCorrectChosen, isDimmed }) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={clsx(
        'font-heading rounded-full border-4 px-6 py-3 text-lg font-bold shadow-[0_6px_0_rgba(0,0,0,0.15)] transition-all duration-200 [@media(min-width:640px)_and_(min-height:560px)]:text-xl',
        disabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.15)]',
        isWrong && 'animate-shake border-red-300 bg-red-100 text-red-500',
        isCorrectChosen && 'animate-wobble border-green-300 bg-green-100 text-green-600 ring-8 ring-green-200',
        isDimmed && 'opacity-40',
        !isWrong && !isCorrectChosen && !isDimmed && baseClass
      )}
    >
      {emoji} {option.word}
    </button>
  );
}

function OllieBubble({ promptParts, isWrong }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <motion.span
        className="inline-block text-6xl [@media(min-width:640px)_and_(min-height:560px)]:text-7xl"
        animate={isWrong ? { x: [0, -6, 6, -6, 6, 0] } : { rotate: [-4, 4, -4], y: [0, -6, 0] }}
        transition={isWrong ? { duration: 0.4 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🐙
      </motion.span>
      <div className="animate-pop-in relative max-w-xs rounded-3xl bg-white px-5 py-3 text-center shadow-[0_6px_0_rgba(0,0,0,0.1)] [@media(min-width:640px)_and_(min-height:560px)]:max-w-sm">
        <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white" />
        {isWrong ? (
          <p className="font-body text-sm font-bold text-orange-600 [@media(min-width:640px)_and_(min-height:560px)]:text-base">Not quite! Try again 💪</p>
        ) : (
          <p className="font-body text-sm font-bold text-slate-700 [@media(min-width:640px)_and_(min-height:560px)]:text-base">
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
          className="animate-swim-fish absolute text-3xl [@media(min-width:640px)_and_(min-height:560px)]:text-4xl"
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
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 [@media(min-width:640px)_and_(min-height:560px)]:h-24 [@media(min-width:768px)_and_(min-height:620px)]:h-32">
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="h-full w-full">
        <path fill="#0B2C52" fillOpacity="0.85" d="M0,110 C 240,190 480,30 720,90 C 960,150 1200,50 1440,110 L1440,200 L0,200 Z" />
        <path fill="#082243" d="M0,150 C 260,90 500,190 760,140 C 1020,90 1260,180 1440,140 L1440,200 L0,200 Z" />
      </svg>
      <span className="absolute bottom-2 left-[16%] animate-sway text-2xl [@media(min-width:640px)_and_(min-height:560px)]:bottom-4 [@media(min-width:640px)_and_(min-height:560px)]:text-3xl">🌿</span>
      <span className="absolute bottom-3 left-[42%] animate-sway text-xl [@media(min-width:640px)_and_(min-height:560px)]:bottom-5 [@media(min-width:640px)_and_(min-height:560px)]:text-2xl" style={{ animationDelay: '0.6s' }}>
        🪸
      </span>
      <span className="absolute bottom-2 right-[20%] animate-sway text-2xl [@media(min-width:640px)_and_(min-height:560px)]:bottom-4 [@media(min-width:640px)_and_(min-height:560px)]:text-3xl" style={{ animationDelay: '1.1s' }}>
        🌿
      </span>
      <span className="absolute bottom-3 right-[6%] text-xl [@media(min-width:640px)_and_(min-height:560px)]:bottom-5 [@media(min-width:640px)_and_(min-height:560px)]:text-2xl">🐚</span>
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
    <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-2 pt-2 [@media(min-width:640px)_and_(min-height:560px)]:px-4 [@media(min-width:640px)_and_(min-height:560px)]:pt-4">
      <Link
        to="/"
        className="font-body flex items-center gap-1 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none [@media(min-width:640px)_and_(min-height:560px)]:text-base"
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
      <span className="text-xl [@media(min-width:640px)_and_(min-height:560px)]:text-2xl">⭐</span>
      <div className={`h-2.5 w-16 overflow-hidden rounded-full [@media(min-width:640px)_and_(min-height:560px)]:w-24 ${dark ? 'bg-slate-200' : 'bg-white/40'}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-body text-xs font-extrabold [@media(min-width:640px)_and_(min-height:560px)]:text-sm ${dark ? 'text-slate-700' : 'text-white drop-shadow'}`}>
        {stars}/{total}
      </span>
    </div>
  );
}

function RoundDots({ total, current }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && i % 5 === 0 && <span className="mx-0.5 h-2 w-px self-center bg-white/40" />}
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors [@media(min-width:640px)_and_(min-height:560px)]:h-2 [@media(min-width:640px)_and_(min-height:560px)]:w-2 ${
              i < current ? 'bg-white' : i === current ? 'animate-sparkle bg-yellow-300' : 'bg-white/30'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function SuccessOverlay({ message, isLastRound, streak, accent, onNext }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="animate-pop-in relative flex max-w-sm flex-col items-center rounded-[2.5rem] bg-white px-8 py-8 text-center shadow-2xl">
        <div className="text-6xl">{streak >= 3 ? '🌟' : '🎉'}</div>
        <h2 className="font-heading mt-2 text-2xl font-bold text-slate-800 [@media(min-width:640px)_and_(min-height:560px)]:text-3xl">
          {streak >= 3 ? 'Reef streak!' : 'Well done!'}
        </h2>
        <p className="font-body mt-2 text-base font-semibold text-slate-500 [@media(min-width:640px)_and_(min-height:560px)]:text-lg">{message}</p>
        <button
          onClick={onNext}
          className={`font-heading mt-6 rounded-full bg-gradient-to-b ${accent} px-7 py-3 text-lg font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none`}
        >
          {isLastRound ? 'See my treasure! 🏆' : 'Next round ➡️'}
        </button>
      </div>
    </div>
  );
}

function CompletionScreen({ stars, total, onPlayAgain }) {
  return (
    <div className="relative mt-10 flex flex-col items-center rounded-[2.5rem] bg-white/90 px-8 py-10 text-center shadow-2xl [@media(min-width:640px)_and_(min-height:560px)]:px-14">
      <div className="text-7xl">🐚🏆</div>
      <h2 className="font-heading mt-3 text-3xl font-bold text-slate-800 [@media(min-width:640px)_and_(min-height:560px)]:text-4xl">Reef treasure collected!</h2>
      <p className="font-body mt-2 text-lg font-semibold text-slate-500">
        You earned {stars} out of {total} stars
      </p>
      <div className="mt-3">
        <StarMeter stars={stars} total={total} dark />
      </div>
      <div className="mt-8 flex flex-col gap-3 [@media(min-width:640px)_and_(min-height:560px)]:flex-row">
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