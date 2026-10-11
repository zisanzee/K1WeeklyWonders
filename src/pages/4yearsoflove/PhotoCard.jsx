import { useState } from 'react';
import {
  PHOTO_ALT,
  PHOTO_BACK_KICKER,
  PHOTO_BACK_SIGN,
  PHOTO_BACK_TEXT,
  PHOTO_CAPTION,
  PHOTO_EMPTY_EMOJI,
  PHOTO_EYEBROW,
  PHOTO_HINT_BACK,
  PHOTO_HINT_FRONT,
  PHOTO_SOURCES,
  PHOTO_TITLE,
} from './config';
import { useInView, useTilt } from './hooks';
import { sfx } from './sfx';

// PhotoCard — her picture as a polaroid that "develops" when it scrolls into
// view (dark, sepia and blurred → full colour). It tilts toward the pointer,
// carries a moving glint, and — new — TURNS OVER when tapped, to a handwritten
// note on the back. Each tap bursts hearts and rings a chime.
//
// PHOTO_SOURCES is walked in order: if the first URL fails (Cloudinary down,
// offline) the same-origin copy is tried, and if every source fails a tulip
// placeholder shows, so the act never breaks.
export default function PhotoCard({ burstAt }) {
  const [sectionRef, inView] = useInView({ threshold: 0.3 });
  const tiltRef = useTilt({ max: 9 });
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const failed = index >= PHOTO_SOURCES.length;

  const onTap = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    burstAt?.(r.left + r.width / 2, r.top + r.height * 0.4, { count: 30, power: 1 });
    sfx.chime(flipped ? 4 : 7, 0.14);
    sfx.sparkle();
    setFlipped((f) => !f);
  };

  return (
    <section className="lv-act lv-photo" ref={sectionRef}>
      <p className="lv-eyebrow">{PHOTO_EYEBROW}</p>
      <h2 className="lv-act__title lv-grad">{PHOTO_TITLE}</h2>

      <button
        type="button"
        ref={tiltRef}
        className={`lv-polaroid lv-tiltable${inView ? ' is-in' : ''}${
          loaded || failed ? ' is-developed' : ''
        }${flipped ? ' is-flipped' : ''}`}
        onClick={onTap}
        aria-label={`${PHOTO_ALT} — tap to turn over`}
        aria-pressed={flipped}
      >
        <span className="lv-polaroid__flip">
          <span className="lv-polaroid__frame">
            <span className="lv-polaroid__photo">
              {failed ? (
                <span className="lv-polaroid__empty" aria-hidden="true">{PHOTO_EMPTY_EMOJI}</span>
              ) : (
                <img
                  key={index}
                  src={PHOTO_SOURCES[index]}
                  alt={PHOTO_ALT}
                  draggable={false}
                  onLoad={() => setLoaded(true)}
                  onError={() => setIndex((i) => i + 1)}
                />
              )}
              <span className="lv-glint" aria-hidden="true" />
            </span>
            <span className="lv-polaroid__caption">{PHOTO_CAPTION}</span>
          </span>

          <span className="lv-polaroid__back" aria-hidden={!flipped}>
            <span className="lv-polaroid__back-kicker">{PHOTO_BACK_KICKER}</span>
            <span className="lv-polaroid__back-text">{PHOTO_BACK_TEXT}</span>
            <span className="lv-polaroid__back-sign">{PHOTO_BACK_SIGN}</span>
            <span className="lv-polaroid__back-stamp" aria-hidden="true">♥</span>
          </span>
        </span>
        <span className="lv-polaroid__tape" aria-hidden="true" />
      </button>

      <p className="lv-note">{flipped ? PHOTO_HINT_BACK : PHOTO_HINT_FRONT}</p>
    </section>
  );
}
