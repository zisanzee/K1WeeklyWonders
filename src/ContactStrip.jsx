// The one reach-out link, shared by the login gate, the home footer and the
// teacher guide. Deliberately a single address: support is handled from one
// inbox, so offering several emails plus a WhatsApp link just left people
// guessing which one to use.
const CONTACT_EMAIL = 'contact@ezwonders.com';

function MailIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 7.5l8 5.2 8-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// `tone="light"` is for the vivid aurora (default); kept as a prop so a
// dark-on-white surface can reuse the same markup.
export default function ContactStrip({
  heading = 'Reach out to us',
  className = '',
  tone = 'light',
  hint = 'Questions about your class? Email us any time.',
}) {
  const isLight = tone === 'light';

  return (
    <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
      {heading && (
        <p
          className={`text-[10px] font-black uppercase tracking-[0.22em] ${
            isLight ? 'text-white/60' : 'text-slate-500'
          }`}
        >
          {heading}
        </p>
      )}

      {/* A real mailto anchor, so a tap opens the mail app directly. The label
          is split into a small cap + the address itself, which keeps the email
          legible at a glance instead of being one long bold string. */}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        aria-label={`Email ${CONTACT_EMAIL}`}
        className={`group inline-flex max-w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:translate-y-0 sm:gap-3 sm:rounded-full sm:px-5 sm:py-3 ${
          isLight
            ? 'border-white/25 bg-white/12 text-white hover:bg-white/20'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 sm:rounded-full ${
            isLight
              ? 'bg-white/15 text-sky-200 group-hover:bg-white/25'
              : 'bg-sky-50 text-sky-600'
          }`}
        >
          <MailIcon className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]" />
        </span>

        <span className="min-w-0 text-left">
          <span
            className={`block text-[9px] font-black uppercase tracking-[0.14em] ${
              isLight ? 'text-white/55' : 'text-slate-400'
            }`}
          >
            Email us
          </span>
          <span
            className={`block truncate text-[13px] font-black tracking-tight sm:text-sm ${
              isLight ? 'text-white' : 'text-slate-800'
            }`}
          >
            {CONTACT_EMAIL}
          </span>
        </span>
      </a>

      {hint && (
        <p
          className={`max-w-xs text-[11px] font-semibold leading-snug ${
            isLight ? 'text-white/55' : 'text-slate-500'
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
