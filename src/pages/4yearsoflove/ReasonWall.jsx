import { REASONS, REASONS_SUBTITLE, REASONS_TITLE } from './content';
import { useInView } from './hooks';

// One reason. It reveals itself the moment it enters the viewport, so the ten
// arrive two at a time as she scrolls rather than all at once.
function Reason({ reason, index }) {
  const [ref, inView] = useInView({ threshold: 0.2 });

  return (
    <article
      ref={ref}
      className={`lv-reason${inView ? ' is-in' : ''}`}
      style={{ transitionDelay: `${(index % 2) * 90}ms` }}
    >
      <span className="lv-reason__num" aria-hidden="true">
        {index + 1}
      </span>
      <span>
        <span className="lv-reason__kind">{reason.kind}</span>
        <span className="lv-reason__text">{reason.text}</span>
      </span>
      <span className="lv-reason__emoji" aria-hidden="true">
        {reason.emoji}
      </span>
    </article>
  );
}

export default function ReasonWall() {
  return (
    <section className="lv-act">
      <h2 className="lv-act__title lv-grad">{REASONS_TITLE}</h2>
      <p className="lv-eyebrow" style={{ letterSpacing: '0.24em' }}>
        {REASONS_SUBTITLE}
      </p>
      <div className="lv-reasons">
        {REASONS.map((reason, index) => (
          <Reason key={reason.kind} reason={reason} index={index} />
        ))}
      </div>
    </section>
  );
}
