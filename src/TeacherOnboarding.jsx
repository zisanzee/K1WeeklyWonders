import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { usePlayerStore } from './playerStore';
import ContactStrip from './ContactStrip';
import {
  ONBOARDING_GIFS,
  ONBOARDING_GIF_LABELS,
  ONBOARDING_SECTIONS,
} from './teacherOnboardingContent';
import { ICON_URL } from './brand';

// A short teacher-facing guide to the control panel, readable BEFORE signing in
// — the panel it links to is the gate, so there is nothing here worth guarding.

// Every section id is a compile-time constant, so this is computed once at
// module scope. It must NOT be derived per render: the active-section hook
// depends on it, and a fresh array identity on each render would tear down and
// re-register the scroll listener continuously.
const SECTION_IDS = ONBOARDING_SECTIONS.map((section) => section.id);

// index.css makes #root the one scroll container (html/body are
// `overflow: hidden`), so window.scrollY is permanently 0 and the window never
// fires a scroll event. Everything here must read the offset from #root.
function getScrollParent() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('root');
}

// Height of the sticky header, measured rather than hardcoded so the jump
// offset stays correct as the nav wraps to two rows on narrow screens.
function useStickyOffset(ref) {
  const [height, setHeight] = useState(96);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setHeight(el.offsetHeight || 96);
    measure();
    // ResizeObserver catches font-load reflow and nav wrapping, which a window
    // resize listener would miss (the window itself never resizes when the
    // viewport is throttled or the nav rewraps).
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}

export default function TeacherOnboarding() {
  return (
    <>
      <Helmet>
        <title>Teacher Guide | EZ Wonders</title>
        <meta
          name="description"
          content="A step-by-step guide to the EZ Wonders teacher control panel: logging in, managing games, your catalogue, students, statistics and settings."
        />
      </Helmet>

      <TeacherOnboardingContent />
    </>
  );
}

function TeacherOnboardingContent() {
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const headerRef = useRef(null);
  const stickyOffset = useStickyOffset(headerRef);
  const activeId = useActiveSection(SECTION_IDS, stickyOffset);

  const scrollToSection = useCallback(
    (id, behavior = 'smooth') => {
      const target = document.getElementById(id);
      const scroller = getScrollParent();
      if (!target || !scroller) return;
      // -8px of breathing room above the heading.
      const top =
        scroller.scrollTop +
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        stickyOffset -
        8;
      scroller.scrollTo({ top: Math.max(0, top), behavior });
    },
    [stickyOffset]
  );

  return (
    <div className="aura-page min-h-[100dvh] w-full">
      {/* ---------------- Sticky header ---------------- */}
      <header
        ref={headerRef}
        className="sticky top-[var(--maint-banner-h,0px)] z-30 border-b border-white/15 bg-gradient-to-br from-[#315ed8]/95 via-[#5a3fc4]/95 to-[#972aa8]/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_14px_40px_-28px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:px-6 sm:pt-5 lg:px-10"
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 pb-2.5 sm:gap-4 sm:pb-4">
          <Link
            to="/"
            aria-label="Back home"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-base leading-none text-white shadow-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:h-11 sm:w-11 sm:text-xl"
          >
            ←
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            {/* The square app mark, rather than a generic emoji — this page is
                part of the product chrome, not a game. */}
            <img
              src={ICON_URL}
              alt=""
              width={40}
              height={40}
              className="hidden h-10 w-10 shrink-0 rounded-2xl shadow-sm ring-1 ring-white/25 sm:block sm:h-11 sm:w-11"
            />
            <div className="min-w-0">
              <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.16em] text-white/70 sm:text-[11px]">
                EZ Wonders
              </p>
              <h1 className="mt-1 truncate text-base font-black leading-tight tracking-tight text-white sm:mt-1.5 sm:text-2xl">
                Teacher guide
              </h1>
              <p className="mt-0.5 hidden truncate text-xs font-semibold leading-snug text-white/80 sm:block">
                Everything you need to run your class, in six short steps.
              </p>
            </div>
          </div>

          {isTeacher && (
            <Link
              to="/game-access"
              aria-label="Open the control panel"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-2.5 text-xs font-black text-white shadow-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:h-11 sm:px-4 sm:text-sm"
            >
              <span aria-hidden="true" className="text-base leading-none">
                🏫
              </span>
              <span className="hidden md:inline">Control Panel</span>
              <span className="md:hidden">Panel</span>
            </Link>
          )}
        </div>

        {/* Section jump nav — a single scrollable row on every breakpoint.
            Wrapping five items onto two lines pushed the content down and made
            the header jump in height mid-scroll, so it stays one row and
            scrolls horizontally on narrow screens instead. */}
        <nav
          aria-label="Guide sections"
          className="mx-auto max-w-5xl overflow-x-auto pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:pb-3 [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex min-w-max items-center gap-1.5">
            {ONBOARDING_SECTIONS.map((section) => {
              const isActive = section.id === activeId;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:px-3.5 sm:py-2 ${
                      isActive
                        ? 'bg-white text-[#5a3fc4] shadow-sm'
                        : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">
                      {section.icon}
                    </span>
                    {section.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3.5 py-7 pb-16 sm:px-6 sm:py-12 lg:px-8">
        {/* ---------------- Intro ---------------- */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative overflow-hidden rounded-[1.5rem] aura-panel px-4 py-5 sm:rounded-[2.25rem] sm:px-8 sm:py-9"
        >
          <div className="pointer-events-none absolute -right-5 -top-5 text-[5rem] opacity-10 sm:text-[9rem]">
            📘
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200 sm:text-[11px]">
            Getting started
          </p>
          <h2 className="mt-2 font-heading text-[1.6rem] font-black leading-tight text-white sm:text-4xl">
            Welcome to your teacher guide
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed aura-soft sm:text-base">
            This guide walks through every part of the Control Panel, in the order you will
            use it. It takes about five minutes to read — and you can jump back to any
            section from the menu above.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3">
            {[
              { icon: '🔑', title: 'Log in', text: 'Find your class and open the panel.' },
              { icon: '🎮', title: 'Set up games', text: 'Choose what to add, lock and unlock.' },
              { icon: '📊', title: 'Follow progress', text: 'See who is playing and how they do.' },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 px-3.5 py-3 sm:px-4 sm:py-3.5"
              >
                <span aria-hidden="true" className="text-xl leading-none sm:text-2xl">
                  {item.icon}
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-black aura-text">{item.title}</p>
                  <p className="mt-0.5 text-xs font-semibold leading-snug aura-muted">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ---------------- Sections ---------------- */}
        <ol className="mt-6 flex flex-col gap-4 sm:mt-12 sm:gap-8 lg:gap-10">
          {ONBOARDING_SECTIONS.map((section, index) => (
            <OnboardingSection key={section.id} section={section} flip={index % 2 === 1} />
          ))}
        </ol>

        {/* ---------------- Footer CTA ---------------- */}
        <section className="mt-8 overflow-hidden rounded-[1.5rem] aura-panel sm:mt-14 sm:rounded-[2rem]">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300" />
          <div className="px-5 py-7 text-center sm:px-8 sm:py-10">
            <span aria-hidden="true" className="text-4xl sm:text-5xl">
              🎉
            </span>
            <h2 className="mt-3 font-heading text-xl font-black text-white sm:text-3xl">
              That is everything
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed aura-soft sm:text-base">
              Open your Control Panel to put it all into practice, and come back here
              whenever you need a reminder.
            </p>

            <div className="mt-5 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              {isTeacher ? (
                <Link
                  to="/game-access"
                  className="aura-btn aura-btn-violet min-h-12 px-6 text-sm font-black sm:min-h-11"
                >
                  🏫 Open Control Panel
                </Link>
              ) : (
                <Link
                  to="/"
                  className="aura-btn aura-btn-violet min-h-12 px-6 text-sm font-black sm:min-h-11"
                >
                  🔑 Sign in to get started
                </Link>
              )}
              <Link
                to="/"
                className="aura-ghost min-h-12 justify-center px-6 text-sm font-black sm:min-h-11"
              >
                🏠 Back home
              </Link>
            </div>

            {/* Contact sits with the closing CTA — it is the natural moment to
                ask, and it avoids a stray block floating below the page end. */}
            <div className="mt-7 border-t border-white/15 pt-6 sm:mt-8 sm:pt-7">
              <ContactStrip
                heading="Need help?"
                hint="Questions about your class, codes or badges? Email us any time."
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Tracks which section heading has passed under the sticky header. Reads from
// the #root scroll container (not window) and is throttled a frame at a time,
// since getBoundingClientRect forces layout on every read.
function useActiveSection(ids, stickyOffset) {
  const [activeId, setActiveId] = useState(ids[0] || null);

  useEffect(() => {
    const scroller = getScrollParent();
    if (!scroller) return undefined;

    let frame = 0;
    const measure = () => {
      frame = 0;
      // A section counts as "current" a little past the header, so the
      // highlight doesn't sit a whole section behind while reading.
      const anchor = scroller.getBoundingClientRect().top + stickyOffset + 24;
      let current = ids[0] || null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= anchor) current = id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids, stickyOffset]);

  return activeId;
}

// One half-and-half row. On lg the two columns sit side by side and alternate
// sides; below lg everything stacks. The visual is written FIRST in the DOM so
// the stacked order is image-then-text on mobile, and `lg:order-*` moves it to
// the right when flipped.
function OnboardingSection({ section, flip }) {
  return (
    <li id={section.id} className="scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="overflow-hidden rounded-[1.5rem] aura-panel sm:rounded-[1.75rem]"
      >
        {/* Accent strip doubles as a colour cue, so each section stays
            identifiable while scrolling past quickly. */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${section.accent}`} />

        <div className="flex flex-col gap-5 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-start lg:gap-9 lg:p-7">
          <div
            className={`w-full lg:w-[45%] lg:shrink-0 ${flip ? 'lg:order-2' : ''}`}
          >
            <GifFrame section={section} />
          </div>

          <div className={`min-w-0 flex-1 ${flip ? 'lg:order-1' : ''}`}>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${section.accent} text-lg font-black shadow-sm sm:h-10 sm:w-10 sm:text-xl`}
              >
                {section.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200">
                  {section.eyebrow}
                </p>
                <h3 className="text-lg font-black leading-tight aura-text sm:text-2xl">
                  {section.title}
                </h3>
              </div>
            </div>

            <p className="mt-3 text-sm font-bold leading-snug aura-soft sm:text-base">
              {section.summary}
            </p>

            <div className="mt-4 flex flex-col gap-3.5">
              {section.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </li>
  );
}

function Block({ block }) {
  if (block.type === 'p') {
    return (
      <p className="text-sm font-semibold leading-relaxed aura-soft">{block.text}</p>
    );
  }

  if (block.type === 'bullets') {
    return (
      <ul className="flex flex-col gap-2">
        {block.items.map((item, index) => {
          const isPair = typeof item === 'object';
          return (
            <li key={index} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300"
              />
              <span className="min-w-0 text-sm font-semibold leading-relaxed aura-soft">
                {isPair ? (
                  <>
                    <strong className="font-black aura-text">{item.label}</strong>
                    {item.text ? ` ${item.text}` : ''}
                  </>
                ) : (
                  item
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (block.type === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {block.items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/15 bg-white/5 px-3.5 py-3"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-lg leading-none">
                {item.icon}
              </span>
              <p className="text-sm font-black aura-text">{item.title}</p>
            </div>
            <p className="mt-1 text-xs font-semibold leading-snug aura-muted">{item.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'sub') {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5 sm:p-4">
        <p className="text-sm font-black aura-text sm:text-base">{block.title}</p>
        {block.text && (
          <p className="mt-1.5 text-sm font-semibold leading-relaxed aura-soft">{block.text}</p>
        )}
        {block.cards && (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {block.cards.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                  <p className="text-sm font-black aura-text">{item.title}</p>
                </div>
                <p className="mt-1 text-xs font-semibold leading-snug aura-muted">{item.text}</p>
              </div>
            ))}
          </div>
        )}
        {block.bullets && (
          <ul className="mt-2.5 flex flex-col gap-2">
            {block.bullets.map((item, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300"
                />
                <span className="min-w-0 text-sm font-semibold leading-relaxed aura-soft">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (block.type === 'callout') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/35 bg-amber-400/15 px-3.5 py-3">
        <span aria-hidden="true" className="text-xl leading-none">
          {block.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-amber-100">{block.title}</p>
          <p className="mt-0.5 text-xs font-semibold leading-relaxed text-amber-50/85">
            {block.text}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// The visual half. Renders the GIF from ONBOARDING_GIFS when one is present and
// a dashed placeholder otherwise, so the layout is already correct before any
// artwork exists.
function GifFrame({ section }) {
  const src = ONBOARDING_GIFS[section.id];
  const label = ONBOARDING_GIF_LABELS[section.id] || section.title;
  const [failed, setFailed] = useState(false);

  // A broken/expired URL degrades to the placeholder rather than leaving the
  // section with an empty box or a broken-image glyph.
  if (!src || failed) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-white/25 bg-white/5 px-4 text-center sm:gap-3">
        <span aria-hidden="true" className="text-3xl opacity-70 sm:text-4xl">
          {section.icon}
        </span>
        <div>
          <p className="text-sm font-black aura-text">Animation coming soon</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-xs font-semibold leading-snug aura-muted">
            {label}
          </p>
        </div>
        <p className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] font-bold aura-muted">
          ONBOARDING_GIFS.{section.id}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="w-full rounded-2xl border border-white/15 bg-white/5 object-cover shadow-[0_10px_30px_-18px_rgba(0,0,0,0.5)]"
    />
  );
}
