// Reach-out links shared by the login gate and the home footer, so the same
// three contact routes appear everywhere from one source. Rendered as real
// anchors (mailto: / wa.me) so a tap opens the mail app or WhatsApp directly.
const CONTACT_EMAILS = ['contact@ezwonders.com', 'admin@ezwonder.com'];
const WHATSAPP_URL = 'https://wa.me/towhidzee';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const pillBase =
  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 active:translate-y-0 sm:text-[13px]';

// `tone="light"` for use on the vivid aurora (default); kept as a prop so a
// future dark-on-white surface can reuse the same markup.
export default function ContactStrip({ heading = 'Reach out to us', className = '', tone = 'light' }) {
  const headingCls =
    tone === 'light' ? 'text-white/65' : 'text-slate-500';
  const mailCls =
    tone === 'light'
      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      {heading && (
        <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${headingCls}`}>
          {heading}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
        {CONTACT_EMAILS.map((email) => (
          <a
            key={email}
            href={`mailto:${email}`}
            aria-label={`Email ${email}`}
            className={`${pillBase} ${mailCls}`}
          >
            <span className="text-sky-300">
              <MailIcon />
            </span>
            <span className="break-all">{email}</span>
          </a>
        ))}

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message us on WhatsApp"
          className={`${pillBase} border-emerald-300/35 bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30`}
        >
          <span className="text-emerald-300">
            <WhatsAppIcon />
          </span>
          WhatsApp
        </a>
      </div>
    </div>
  );
}
