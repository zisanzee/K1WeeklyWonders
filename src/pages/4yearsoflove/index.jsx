import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePlayerStore } from '@/auth/playerStore';
import HeartCanvas from './HeartCanvas';
import HoldGate from './HoldGate';
import ActEnvelope from './ActEnvelope';
import PhotoCard from './PhotoCard';
import ReasonWall from './ReasonWall';
import HeartCatch from './HeartCatch';
import Counter from './Counter';
import Confetti from './Confetti';
import { sfx, setSoundEnabled } from './sfx';
import { useSavedFlag, usePointerLight, useScrollProgress } from './hooks';
import {
  CONFETTI,
  DECOY_BODY,
  DECOY_CODE,
  DECOY_TITLE,
  GRANTED_TEACHER_NAME,
  HERO_BODY,
  HERO_EYEBROW,
  HERO_TITLE,
  LANDING_CUE,
  LANDING_FOUR,
  MUSIC_OFF_LABEL,
  MUSIC_ON_LABEL,
  MUSIC_SRC,
  MUSIC_VOLUME,
  PAGE_THEME_COLOR,
  PAGE_TITLE,
  SFX_OFF_LABEL,
  SFX_ON_LABEL,
  SHOOTING_STARS,
} from './config';
import './love.css';
import './love-extras.css';
import './love-fx.css';

// ---------------------------------------------------------------------------
// ACCESS — unchanged. A private surprise: only the named teacher sees the story;
// everyone else gets an indistinguishable decoy 404. A *display* gate only.
// ---------------------------------------------------------------------------
function normalizeName(value) {
  return (value || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
}

function Decoy() {
  return (
    <main className="lv-404">
      <Helmet>
        <title>{`${DECOY_CODE} — ${DECOY_TITLE}`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div>
        <p className="lv-404__code">{DECOY_CODE}</p>
        <p style={{ fontWeight: 700, marginTop: '0.5rem' }}>{DECOY_TITLE}</p>
        <p style={{ opacity: 0.6, marginTop: '0.4rem', fontSize: '0.9rem' }}>
          {DECOY_BODY}
        </p>
      </div>
    </main>
  );
}

// Splits a title into words and letters so each letter can fly in on its own.
// The accessible name stays the plain string.
function Letters({ text }) {
  let n = 0;
  return (
    <span aria-label={text}>
      {text.split(' ').map((word, w) => (
        <Fragment key={`${word}-${w}`}>
          {w > 0 && ' '}
          <span className="lv-word" aria-hidden="true">
            {[...word].map((ch) => {
              const i = n;
              n += 1;
              return (
                <span key={i} className="lv-letter" style={{ '--i': i }}>
                  {ch}
                </span>
              );
            })}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// THE STORY
//   HoldGate → hold the heart to full (scroll locked) — it now CHARGES UP in
//              sound, a rising pentatonic arpeggio, and finishes with a fanfare
//   Landing  → letter-by-letter title over a giant glowing "4" that parallaxes
//   Envelope → trembles, cracks, glows, the letter writes itself word by word
//   Photo    → a polaroid that develops, and turns over
//   Reasons  → ten reasons you can keep, with a live counter
//   Game     → catch my heart
//   Counter  → elapsed time, rolling count, milestones, fireworks, hug, replay
// ---------------------------------------------------------------------------
function LoveStory() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const barRef = useRef(null);
  const lightRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [counterReached, setCounterReached] = useState(false);
  const [confettiRun, setConfettiRun] = useState(0);
  const [musicOn, setMusicOn] = useSavedFlag('ezw-love-music', false);
  const [soundOn, setSoundOn] = useSavedFlag('ezw-love-sfx', true);

  useScrollProgress(barRef);
  usePointerLight(lightRef);

  useEffect(() => {
    setSoundEnabled(soundOn);
  }, [soundOn]);

  // Every effect goes through these wrappers so the picture and the sound can
  // never drift apart: children just ask for a burst / firework / rocket.
  const burstAt = useCallback((x, y, opts) => {
    canvasRef.current?.burst(x, y, opts);
  }, []);
  const fireworkAt = useCallback((x, y, kind) => {
    canvasRef.current?.firework(x, y, kind);
    sfx.boom();
  }, []);
  const rocketAt = useCallback((x, y, kind) => {
    canvasRef.current?.rocket(x, y, kind);
    sfx.whoosh();
    // The rocket takes ~0.8 s to climb; the bang follows it.
    setTimeout(() => sfx.boom(), 820);
  }, []);

  // The hold gate speaks through its own burst calls: each spark is a "charge"
  // note whose pitch follows progress (its `power` is 0.3 + progress * 0.5), and
  // the big finishing burst (count >= 60) plays the fanfare.
  const gateBurst = useCallback((x, y, opts = {}) => {
    canvasRef.current?.burst(x, y, opts);
    if ((opts.count || 0) >= 60) sfx.fanfare();
    else sfx.tick(Math.max(0, Math.min(1, ((opts.power || 0.3) - 0.3) / 0.5)));
  }, []);

  const onReveal = useCallback(() => setCounterReached(true), []);
  const onHug = useCallback(() => setConfettiRun((n) => n + 1), []);

  // Anywhere she taps in the story sends a few hearts (buttons keep their own).
  const onTap = useCallback(
    (event) => {
      sfx.unlock(); // any first touch is the gesture that lets audio start
      if (!started || event.target.closest?.('button, a, [role="button"], canvas')) return;
      burstAt(event.clientX, event.clientY, { count: 9, power: 0.55 });
      sfx.pop();
    },
    [started, burstAt]
  );

  // Lock scrolling while the heart is held; the class lives on <html> because
  // #root is the app's real scroll container (see love.css).
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

  // Music starts only after the hold — that gesture is what unblocks autoplay.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = MUSIC_VOLUME;
    if (musicOn && started) {
      audio.play().catch(() => {
        /* still blocked — the next tap will start it */
      });
    } else {
      audio.pause();
    }
  }, [musicOn, started]);

  return (
    <div className="lv-root" onPointerDown={onTap}>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="theme-color" content={PAGE_THEME_COLOR} />
      </Helmet>

      {/* Ambient backdrop: gradient, aurora, blobs, stars, shooting stars,
          the heart canvas, and a light that follows the cursor. */}
      <div className="lv-bg" aria-hidden="true" />
      <div className="lv-aurora" aria-hidden="true" />
      <div className="lv-blob lv-blob--a" aria-hidden="true" />
      <div className="lv-blob lv-blob--b" aria-hidden="true" />
      <div className="lv-stars" aria-hidden="true" />
      {SHOOTING_STARS.map(([x, y, d, dur]) => (
        <span
          key={x}
          className="lv-shoot"
          aria-hidden="true"
          style={{ '--x': x, '--y': y, '--d': d, '--dur': dur }}
        />
      ))}
      <HeartCanvas ref={canvasRef} />
      <div className="lv-light" ref={lightRef} aria-hidden="true" />

      {/* Thin gradient bar showing how far through the story she is. */}
      <div className={`lv-pagebar${started ? ' is-on' : ''}`} ref={barRef} aria-hidden="true">
        <span />
      </div>

      {started && (
        <div className="lv-toggles">
          <button
            type="button"
            className="lv-ghost"
            onClick={() => setSoundOn(!soundOn)}
            aria-pressed={soundOn}
          >
            <span aria-hidden="true">{soundOn ? '🔔' : '🔕'}</span>
            {soundOn ? SFX_ON_LABEL : SFX_OFF_LABEL}
          </button>
          <button
            type="button"
            className="lv-ghost"
            onClick={() => setMusicOn(!musicOn)}
            aria-pressed={musicOn}
          >
            <span aria-hidden="true">{musicOn ? '🔊' : '🔈'}</span>
            {musicOn ? MUSIC_ON_LABEL : MUSIC_OFF_LABEL}
          </button>
        </div>
      )}
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="none" />

      {!started ? (
        <HoldGate onComplete={() => setStarted(true)} burstAt={gateBurst} fireworkAt={fireworkAt} />
      ) : (
        <>
          <header className="lv-landing">
            <p className="lv-eyebrow">{HERO_EYEBROW}</p>
            <h1
              style={{
                fontSize: 'clamp(1.9rem, 8vw, 3.4rem)',
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              <Letters text={HERO_TITLE} />
            </h1>
            <p className="lv-note">{HERO_BODY}</p>
            <span className="lv-cue">{LANDING_CUE}</span>
            {/* Last child on purpose: the CSS addresses the first three by index. */}
            <span className="lv-landing__four" aria-hidden="true">
              <span>{LANDING_FOUR}</span>
            </span>
          </header>

          <main>
            <ActEnvelope burstAt={burstAt} fireworkAt={fireworkAt} rocketAt={rocketAt} />
            <PhotoCard burstAt={burstAt} />
            <ReasonWall burstAt={burstAt} />
            <HeartCatch burstAt={burstAt} fireworkAt={fireworkAt} rocketAt={rocketAt} />
            <Counter
              onReveal={onReveal}
              onHug={onHug}
              burstAt={burstAt}
              fireworkAt={fireworkAt}
              rocketAt={rocketAt}
            />
          </main>

          {counterReached && (
            <Confetti
              key={confettiRun}
              count={confettiRun ? CONFETTI.replayCount : CONFETTI.count}
              durationMs={CONFETTI.durationMs}
            />
          )}
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
