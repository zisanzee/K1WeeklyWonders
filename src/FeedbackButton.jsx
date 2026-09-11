import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayerStore } from './playerStore';
import { ICON_URL } from './brand';

// Netlify's form name. Every piece of this component keys off it: the hidden
// `form-name` field below, the matching static declaration in index.html (which
// is what lets Netlify *register* the form at deploy time), and the endpoint we
// POST to.
const FORM_NAME = 'feedback';

// Netlify accepts AJAX submissions when the body is form-urlencoded and the
// request goes to a path on the site (not to an /api route), which is why this
// posts to '/' rather than somewhere else. The page is never left — the modal
// shows a thank-you instead, so nobody loses their place in the app.
function encodeForm(data) {
  return Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key] ?? '')}`)
    .join('&');
}

// Best-effort public IP. Netlify already logs the submitter's IP server-side,
// but it was explicitly asked for in the payload, so we attach it when the
// lookup succeeds. It must never delay or block a submission: school networks
// and ad-blockers routinely drop this kind of request, hence the 4s cap and the
// silent empty-string fallback.
async function lookupIp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = await res.json().catch(() => null);
    return data?.ip || '';
  } catch {
    return '';
  }
}

// A compact, human-readable device fingerprint. The raw user-agent string goes
// along too (it is the ground truth); this line is just the part a person can
// actually read when triaging feedback.
function deviceSummary() {
  if (typeof window === 'undefined') return '';
  const nav = window.navigator || {};
  const platform = nav.userAgentData?.platform || nav.platform || '';
  const screen = window.screen
    ? `${window.screen.width}x${window.screen.height}`
    : '';
  const dpr = window.devicePixelRatio ? `${window.devicePixelRatio}x` : '';
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  })();
  return [platform, screen && `${screen}${dpr ? ` @${dpr}` : ''}`, nav.language, tz]
    .filter(Boolean)
    .join(' | ');
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FeedbackButton() {
  const playerName = usePlayerStore((s) => s.playerName);
  const classId = usePlayerStore((s) => s.classId);
  const className = usePlayerStore((s) => s.className);
  const classType = usePlayerStore((s) => s.classType);
  const identityKind = usePlayerStore((s) => s.identityKind);
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const isAdmin = usePlayerStore((s) => s.isAdmin);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const [ip, setIp] = useState('');
  const textareaRef = useRef(null);

  // Fetch the IP once the form is actually opened, not on page load — no point
  // making a third-party request for a visitor who never sends feedback.
  useEffect(() => {
    if (!open || ip) return;
    let cancelled = false;
    lookupIp().then((value) => {
      if (!cancelled) setIp(value);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ip]);

  // Escape closes, and the page behind the modal is locked so a long feedback
  // message can be scrolled inside the dialog instead of scrolling the app away.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Autofocus the textarea (not the first hidden input) so a phone keyboard
  // opens straight onto the thing the person came here to write.
  useEffect(() => {
    if (open && status !== 'sent') textareaRef.current?.focus();
  }, [open, status]);

  const close = () => {
    setOpen(false);
    // Reset only after the exit animation has finished, so the dialog doesn't
    // visibly empty itself while it is still on screen.
    window.setTimeout(() => {
      setStatus('idle');
      setError('');
      setMessage('');
    }, 250);
  };

  const role = isAdmin ? 'admin' : isTeacher ? 'teacher' : identityKind || 'student';

  const submit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || status === 'sending') return;

    setStatus('sending');
    setError('');

    const now = new Date();
    const payload = {
      'form-name': FORM_NAME,
      // Honeypot travels empty on every real submission. A bot that scrapes
      // this page and auto-fills the trap will post a value here instead, and
      // Netlify discards the entry before it reaches the inbox.
      'bot-field': '',
      message: text,
      name: playerName || '(not signed in)',
      class: className || classId || '(no class)',
      classId: classId || '',
      classType: classType || '',
      role,
      submittedAt: now.toISOString(),
      submittedAtLocal: now.toLocaleString(),
      page: typeof window !== 'undefined' ? window.location.href : '',
      ip: ip || 'unavailable',
      device: deviceSummary(),
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm(payload),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(
        "We couldn't send that just now. Please check your connection and try again."
      );
      // Keep the message visible in the console for support — the on-screen
      // copy stays friendly and non-technical for a child to read.
      console.error('[feedback] submit failed:', err);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: -2 }}
        whileTap={{ y: 0, scale: 0.98 }}
        className="mx-auto flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white shadow-lg ring-2 ring-white/40 sm:text-base"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 55%, #2563eb 100%)',
        }}
      >
        <ChatIcon />
        Send feedback
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] flex items-center justify-center overflow-y-auto bg-slate-900/60 px-3 py-6 backdrop-blur-sm sm:px-4"
            onClick={close}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-title"
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 18 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
              className="aura-panel relative my-auto w-full max-w-lg overflow-hidden rounded-[1.75rem] p-5 text-left sm:p-7"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close feedback form"
                className="absolute right-3 top-3 rounded-full p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
              >
                <CloseIcon />
              </button>

              <div className="flex items-center gap-3 pr-10">
                <img
                  src={ICON_URL}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-2xl"
                />
                <div className="min-w-0">
                  <h2
                    id="feedback-title"
                    className="text-lg font-black leading-tight text-white sm:text-xl"
                  >
                    {status === 'sent' ? 'Thank you!' : 'Send feedback'}
                  </h2>
                  <p className="aura-muted text-xs font-semibold">
                    EZ Wonders
                  </p>
                </div>
              </div>

              {status === 'sent' ? (
                <div className="mt-5 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/25 text-3xl ring-4 ring-emerald-300/30"
                  >
                    ✅
                  </motion.div>
                  <p className="aura-soft mt-4 text-sm font-semibold leading-relaxed">
                    Your feedback is on its way. It helps make EZ Wonders
                    better for everyone.
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-base font-black text-white shadow-[0_6px_0_rgba(6,95,70,0.3)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form
                  name={FORM_NAME}
                  method="POST"
                  data-netlify="true"
                  netlify-honeypot="bot-field"
                  onSubmit={submit}
                  className="mt-5 space-y-4"
                >
                  {/* Required by Netlify for JS-rendered forms: React never puts
                      this form in the served HTML, so the name has to travel in
                      the body for Netlify to route the submission. */}
                  <input type="hidden" name="form-name" value={FORM_NAME} />

                  {/* Spam trap. `netlify-honeypot` names this input as the trap:
                      it has to exist, stay empty, and never be filled by a
                      person. A submission that arrives with it populated is
                      dropped as spam. */}
                  <input type="hidden" name="bot-field" />

                  {/* Auto-captured context. Hidden inputs (not state) because the
                      values must be serialised with the form, and the sender
                      should never have to type what the app already knows. */}
                  <input type="hidden" name="name" value={playerName || '(not signed in)'} />
                  <input type="hidden" name="class" value={className || classId || '(no class)'} />
                  <input type="hidden" name="classId" value={classId || ''} />
                  <input type="hidden" name="classType" value={classType || ''} />
                  <input type="hidden" name="role" value={role} />
                  <input type="hidden" name="submittedAt" value={new Date().toISOString()} />
                  <input type="hidden" name="submittedAtLocal" value={new Date().toLocaleString()} />
                  <input
                    type="hidden"
                    name="page"
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                  />
                  <input type="hidden" name="ip" value={ip || 'unavailable'} />
                  <input type="hidden" name="device" value={deviceSummary()} />
                  <input
                    type="hidden"
                    name="userAgent"
                    value={typeof navigator !== 'undefined' ? navigator.userAgent : ''}
                  />

                  <div>
                    <label
                      htmlFor="feedback-message"
                      className="aura-soft mb-2 block text-sm font-extrabold"
                    >
                      What would you like us to know?
                    </label>
                    <textarea
                      ref={textareaRef}
                      id="feedback-message"
                      name="message"
                      required
                      rows={5}
                      maxLength={1200}
                      value={message}
                      onChange={(event) => {
                        setMessage(event.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      placeholder="Tell us what you loved, or what went wrong…"
                      className="aura-input w-full resize-y rounded-2xl px-4 py-3 text-base font-semibold"
                    />
                    <p className="aura-muted mt-1 text-right text-xs font-semibold">
                      {message.length}/1200
                    </p>
                  </div>

                  {status === 'error' && (
                    <p
                      role="alert"
                      className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-bold text-rose-100"
                    >
                      {error}
                    </p>
                  )}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="aura-ghost justify-center rounded-2xl px-5 py-3 text-base font-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!message.trim() || status === 'sending'}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-600 px-5 py-3 text-base font-black text-white shadow-[0_6px_0_rgba(49,46,129,0.35)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
                    >
                      {status === 'sending' ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                          Sending…
                        </>
                      ) : (
                        'Send feedback'
                      )}
                    </button>
                  </div>

                  <p className="aura-muted text-center text-[11px] font-semibold leading-relaxed">
                    Your name, class, device and network details are attached
                    automatically so we can follow up.
                  </p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
