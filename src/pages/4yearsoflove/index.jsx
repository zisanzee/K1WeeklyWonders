import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePlayerStore } from '@/auth/playerStore';
import HeartCanvas from './HeartCanvas';
import HoldGate from './HoldGate';
import ActEnvelope from './ActEnvelope';
import ReasonWall from './ReasonWall';
import Counter from './Counter';
import Confetti from './Confetti';
import { useSavedFlag } from './hooks';
import {
  HERO_BODY,
  HERO_EYEBROW,
  HERO_TITLE,
  GRANTED_TEACHER_NAME,
  MUSIC_SRC,
} from './content';
import './love.css';

// ---------------------------------------------------------------------------
// ACCESS
// ---------------------------------------------------------------------------
// This is a private surprise, not a public page. It renders only for a viewer
// signed in as the teacher below; EVERYONE else — a signed-out visitor, another
// teacher, a student, a search engine — gets a plain decoy "404" that is
// indistinguishable from a dead link. The URL itself is unguessable enough to be
// effectively unlisted, and even knowing it reveals nothing without the right
// name on the session.
//
// The name is compared case- and whitespace-insensitively so "siti  soleha"
// still opens it. This is intentionally a *display* gate — the page reaches
// nothing private, so it should never fail over a flaky network.
function normalizeName(value) {
  return (value || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
}

// The decoy. Static, unbranded, and no hint that the real page exists.
function Decoy() {
  return (
    <main className="lv-404">
      <Helmet>
        <title>404 — Page not found</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div>
        <p className="lv-404__code">404</p>
        <p style={{ fontWeight: 700, marginTop: '0.5rem' }}>Page not found</p>
        <p style={{ opacity: 0.6, marginTop: '0.4rem', fontSize: '0.9rem' }}>
          The page you are looking for does not exist.
        </p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// THE STORY
// ---------------------------------------------------------------------------
// The page is a linear, scroll-driven story with a locked prologue:
//
//   HoldGate      → the heart must be HELD to full (the only thing on screen)
//   ActEnvelope   → scrolling opens the envelope, the paper rises and settles,
//                   the envelope dissolves
//   ReasonWall    → the ten reasons, arriving two at a time
//   Counter       → the elapsed time, then confetti — the end
//
// Scrolling is frozen for the whole prologue so the story cannot be skipped by
// scrolling past it, and released once the heart is full.
function LoveStory() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [started, setStarted] = useState(false);
  // Set when the counter act is reached — this is what arms the confetti, so the
  // finale lands with the closing act rather than playing over the envelope.
  const [counterReached, setCounterReached] = useState(false);
  const [musicOn, setMusicOn] = useSavedFlag('ezw-love-music', false);

  // The single burst entry point every act uses. A stable callback, so the
  // particles start the instant it is pressed.
  const burstAt = useCallback((x, y, opts) => {
    canvasRef.current?.burst(x, y, opts);
  }, []);

  // Lock scrolling while the heart is being held. The class lives on <html>
  // because #root is the app's real scroll container — see love.css.
  useEffect(() => {
    const root = document.documentElement;
    if (started) {
      root.classList.remove('lv-locked');
      return undefined;
    }
    root.classList.add('lv-locked');
    window.scrollTo(0, 0);
    return () => root.classList.remove('lv-locked');
  }, [started]);

  // Music only starts after the story begins: the browser blocks autoplay until
  // a gesture, and the hold that opens the story IS that gesture.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.34;
    if (musicOn && started) {
      audio.play().catch(() => {
        /* still blocked — the next tap will start it */
      });
    } else {
      audio.pause();
    }
  }, [musicOn, started]);

  return (
    <div className="lv-root">
      <Helmet>
        <title>Four years of love 💗</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="theme-color" content="#4c0f3c" />
      </Helmet>

      {/* Ambient backdrop. */}
      <div className="lv-bg" aria-hidden="true" />
      <div className="lv-blob lv-blob--a" aria-hidden="true" />
      <div className="lv-blob lv-blob--b" aria-hidden="true" />
      <div className="lv-stars" aria-hidden="true" />
      <HeartCanvas ref={canvasRef} />

      {/* Music toggle — only offered once she is into the story. */}
      {started && (
        <button
          type="button"
          className="lv-ghost"
          onClick={() => setMusicOn(!musicOn)}
          aria-pressed={musicOn}
          style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 90 }}
        >
          <span aria-hidden="true">{musicOn ? '🔊' : '🔈'}</span>
          {musicOn ? 'Music on' : 'Music off'}
        </button>
      )}
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="none" />

      {/* The prologue. The story below is a genuinely separate branch, so the
          whole scroll graph mounts at once when the heart fills — which is also
          what lets the opening line glide in from the top. */}
      {!started ? (
        <HoldGate onComplete={() => setStarted(true)} burstAt={burstAt} />
      ) : (
        <>
          {/* A short landing beat, so the envelope doesn't start mid-scroll. */}
          <header className="lv-landing">
            <p className="lv-eyebrow">{HERO_EYEBROW}</p>
            <h1
              className="lv-grad"
              style={{ fontSize: 'clamp(1.9rem, 8vw, 3.4rem)', fontWeight: 700, margin: 0, lineHeight: 1.1 }}
            >
              {HERO_TITLE}
            </h1>
            <p className="lv-note">{HERO_BODY}</p>
            <span className="lv-cue">scroll</span>
          </header>

          <main>
            <ActEnvelope />
            <ReasonWall />
            <Counter onReveal={() => setCounterReached(true)} burstAt={burstAt} />
          </main>

          {/* The ending: confetti falls over everything once, when the counter is
              reached, and removes itself when it lands. */}
          {counterReached && <Confetti count={90} />}
        </>
      )}
    </div>
  );
}

export default function FourYearsOfLove() {
  const playerName = usePlayerStore((state) => state.playerName);
  const isTeacher = usePlayerStore((state) => state.isTeacher);
  const isAdmin = usePlayerStore((state) => state.isAdmin);

  const granted =
    (isTeacher || isAdmin) &&
    normalizeName(playerName) === normalizeName(GRANTED_TEACHER_NAME);

  if (!granted) return <Decoy />;
  return <LoveStory />;
}
