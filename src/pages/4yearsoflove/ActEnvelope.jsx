import { useRef } from 'react';
import { useActScroll } from './useActScroll';
import { useTilt } from './hooks';
import {
  ENVELOPE_HINT_BELOW,
  ENVELOPE_SEAL_LABEL,
  LETTER_PARAGRAPHS,
  LETTER_SIGNOFF,
  LETTER_TITLE,
} from './content';

// ActEnvelope — the second act, and the one the whole page is built around.
//
// One tall scroll track with a single sticky stage. useActScroll writes the
// act's scroll progress to `--p` on the stage; the CSS derives five clamped 0..1
// phases from it (seal, flap, rise, exit, envelope-out) and every visual is a
// pure function of those. Scrolling drives the whole sequence with no React
// re-render at all.
//
// THE SEQUENCE
//   scroll → the seal breaks and the flap swings open
//          → the letter grows up and out of the envelope
//          → it STOPS, fully presented and readable
//          → it is carried away to the left
//          → the envelope fades last, alone
//
// WHY EVERYTHING IS INSIDE `.lv-env`
//   The letter has to be hidden by the envelope while it is inside and visible
//   once it is out. That is done with a plain z-index: the letter sits at z 2 and
//   the pocket at z 4, so the pocket hides it until it rises past the opening
//   line. Nothing here is 3D — no perspective, no translateZ, no preserve-3d.
//
//   The previous revision built this as a 3D scene for "real" layer sorting, and
//   every bug in this act came from that: an opacity wrapper flattened the
//   context and painted the letter over a closed envelope; a translateZ placed
//   after a rotation silently cancelled itself and dropped the flap behind the
//   body; the whole thing had to be held at an angle or the layering was
//   invisible. Flat z-index has none of those failure modes.

// The letter's layer offset, applied on the X/Y axes only.
const PAPER_LIFT = '87%';
const PAPER_EXIT = '-190%';

export default function ActEnvelope() {
  const trackRef = useRef(null);
  const stageRef = useActScroll(trackRef);
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

            {/* THE LETTER. Lives in the same 3D context as the pocket, so it is
                genuinely hidden inside the envelope and genuinely visible once
                it rises past the opening line. It travels up in whole envelope
                heights, then slides left on its way out. */}
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
                  <h2 className="lv-paper__title">{LETTER_TITLE}</h2>
                  <div className="lv-paper__body">
                    {LETTER_PARAGRAPHS.map((paragraph) => (
                      <p className="lv-paper__p" key={paragraph.slice(0, 20)}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <p className="lv-paper__sign">{LETTER_SIGNOFF}</p>
                </div>
              </div>
            </div>

            {/* The front pocket. Its top edge is the opening line — the thing
                that hides the letter until it rises past it. */}
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
          <span className="lv-cue__label lv-cue__label--next">scroll on</span>
        </span>
        <span className="lv-rail" aria-hidden="true" />
      </div>
    </div>
  );
}
