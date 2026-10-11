import { Fragment, useRef } from 'react';
import { useActScroll } from './useActScroll';
import { useTilt } from './hooks';
import { sfx } from './sfx';
import {
  ENVELOPE_HINT_BELOW,
  ENVELOPE_HINT_NEXT,
  ENVELOPE_SEAL_LABEL,
  LETTER_PARAGRAPHS,
  LETTER_SIGNOFF,
  LETTER_TITLE,
  PAPER_EXIT,
  PAPER_LIFT,
  PAPER_STAMP,
  PAPER_STAMP_SMALL,
} from './config';

// ActEnvelope — the second act, and the one the whole page is built around.
//
// One tall scroll track with a single sticky stage. useActScroll writes the
// act's scroll progress to `--p` on the stage; the CSS derives clamped 0..1
// phases from it and every visual is a pure function of those. Scrolling drives
// the whole sequence with no React re-render at all.
//
// THE SEQUENCE
//   scroll → the envelope trembles, the seal cracks and the flap swings open
//          → light pours out and the letter grows up and out of the envelope
//          → it STOPS, fully presented, and WRITES ITSELF word by word
//          → it is carried away to the left
//          → the envelope fades last, alone
//
// UPGRADE: the letter text is "inked" — each word fades and settles in as a
// function of scroll (see .lv-ink in love-fx.css), so reading is something she
// does with her thumb. The phases that drive it (--t-ink-*) live in love-fx.css.
//
// Flat z-index layering, no 3D — see love.css for why that rule exists.

// One line of the letter whose words appear one after another as `--phase`
// (a 0..1 CSS variable on the stage) climbs. The accessible name is the plain
// string; the per-word spans are decoration.
function Inked({ text, phase }) {
  const words = text.split(' ');
  return (
    <span
      className="lv-ink"
      aria-label={text}
      style={{ '--n': words.length, '--tt': `var(${phase})` }}
    >
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 && ' '}
          <span className="lv-ink__w" aria-hidden="true" style={{ '--i': i }}>
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export default function ActEnvelope({ burstAt, fireworkAt, rocketAt }) {
  const trackRef = useRef(null);
  // One-shot moments, re-armed when she scrolls back up. They read live geometry
  // so the effects land on the objects.
  const fired = useRef({ seal: false, letter: false, finale: false });
  const stageRef = useActScroll(trackRef, {
    onProgress: (p) => {
      const stage = stageRef.current;
      if (!stage) return;
      const f = fired.current;
      if (p > 0.06 && !f.seal) {
        f.seal = true;
        sfx.seal();
        const r = stage.querySelector('.lv-env__seal')?.getBoundingClientRect();
        if (r) burstAt?.(r.left + r.width / 2, r.top + r.height / 2, { count: 28, power: 0.9 });
      } else if (p < 0.02) f.seal = false;

      if (p > 0.52 && !f.letter) {
        f.letter = true;
        sfx.sparkle();
        const r = stage.querySelector('.lv-env__paper')?.getBoundingClientRect();
        if (r) {
          fireworkAt?.(r.left + r.width * 0.1, r.top + r.height * 0.15);
          fireworkAt?.(r.right - r.width * 0.1, r.top + r.height * 0.15);
          burstAt?.(r.left + r.width / 2, r.top + r.height / 2, { count: 30, power: 1.1 });
        }
      } else if (p < 0.4) f.letter = false;

      // When the last word has been written, a heart-shaped rocket goes up.
      if (p > 0.76 && !f.finale) {
        f.finale = true;
        rocketAt?.(window.innerWidth / 2, window.innerHeight * 0.26, 'heart');
      } else if (p < 0.6) f.finale = false;
    },
  });
  const tiltRef = useTilt({ max: 15 });

  return (
    <div className="lv-track lv-track--envelope" ref={trackRef}>
      <div className="lv-stage" ref={stageRef}>
        <div className="lv-scene lv-tiltable" ref={tiltRef}>
          <div className="lv-env">
            {/* The outer body — furthest back. */}
            <div className="lv-env__back" />

            {/* The interior, glimpsed through the opening mouth. */}
            <div className="lv-env__gap" />

            {/* THE LETTER. It travels up in whole envelope heights, then slides
                left on its way out. */}
            <div
              className="lv-env__paper-layer"
              style={{
                transform: `translate(
                  calc(var(--t-exit) * ${PAPER_EXIT}),
                  calc(0px - var(--t-rise) * ${PAPER_LIFT}))`,
              }}
            >
              <div className="lv-env__paper">
                <div className="lv-env__paper-face">
                  <span className="lv-paper__stamp" aria-hidden="true">
                    {PAPER_STAMP}
                    <small>{PAPER_STAMP_SMALL}</small>
                  </span>
                  <h2 className="lv-paper__title">
                    <Inked text={LETTER_TITLE} phase="--t-ink-title" />
                  </h2>
                  <div className="lv-paper__body">
                    {LETTER_PARAGRAPHS.map((paragraph, index) => (
                      <p className="lv-paper__p" key={paragraph.slice(0, 20)}>
                        <Inked text={paragraph} phase={`--t-ink-p${index + 1}`} />
                      </p>
                    ))}
                  </div>
                  <p className="lv-paper__sign">
                    <Inked text={LETTER_SIGNOFF} phase="--t-ink-sign" />
                  </p>
                </div>
              </div>
            </div>

            {/* The front pocket. Its top edge is the opening line. */}
            <div className="lv-env__pocket">
              <span className="lv-glint" aria-hidden="true" />
            </div>

            {/* The hinged flap. */}
            <div className="lv-env__flap-wrap">
              <span className="lv-env__flap" />
            </div>

            {/* The wax seal, on top of everything. */}
            <span className="lv-env__seal" aria-hidden="true">
              {ENVELOPE_SEAL_LABEL}
            </span>
          </div>
        </div>

        <span className="lv-cue">
          <span className="lv-cue__label lv-cue__label--open">{ENVELOPE_HINT_BELOW}</span>
          <span className="lv-cue__label lv-cue__label--next">{ENVELOPE_HINT_NEXT}</span>
        </span>
        <span className="lv-rail" aria-hidden="true" />
      </div>
    </div>
  );
}
