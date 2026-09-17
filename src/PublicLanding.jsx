import { Link } from 'react-router-dom';
import { GAME_CATALOG } from './gameAccess';
import { ICON_URL, LOGO_URL } from './brand';
import GameIcon from './GameIcon';

// Public, crawlable page copy rendered UNDER the sign-in card on the root
// route for signed-out visitors.
//
// Why it exists: every route is served the same static shell, and the gate
// used to hide ALL descriptive copy behind a successful login — so a search
// engine (or an AI crawler) fetching https://ezwonders.com/ saw nothing but a
// form, and had no reason to rank the site for anything. This section sits
// below the fold, so the sign-in experience above it is untouched, but the
// page now has a real H1, headings, a game list and an FAQ to read.
//
// The FAQ answers are duplicated verbatim in index.html as FAQPage structured
// data (that copy is raw HTML, so it is visible to crawlers that never execute
// JavaScript). Keep the two in sync — Google drops the rich result when the
// markup and the visible answer disagree.
const FAQS = [
  {
    q: 'What is EZ Wonders?',
    a: 'EZ Wonders is a free web platform of short, playful numeracy games for Kindergarten children, with a control panel that lets teachers manage games, student codes and progress.',
  },
  {
    q: 'Is EZ Wonders suitable for Singapore kindergartens?',
    a: 'Yes. EZ Wonders fits Singapore kindergarten and preschool classes working at Kindergarten 1 (K1) and Kindergarten 2 (K2) level. Games are arranged into a K1 set and a K2 set, and a class only sees the games its teacher has unlocked for that level. The same activities suit Reception, Pre-K, nursery and prep classes elsewhere.',
  },
  {
    q: 'Is EZ Wonders free?',
    a: 'Yes. EZ Wonders is completely free to play in the browser and works on phones, tablets and computers.',
  },
  {
    q: 'What age is EZ Wonders for?',
    a: 'It is designed for Kindergarten / Reception-aged children (roughly 4 to 6 years old) and focuses on early numeracy.',
  },
  {
    q: 'How do students log in?',
    a: 'A student joins their own class using either a class code plus their name (public classes) or an individual student code provided by their teacher (private classes).',
  },
  {
    q: 'What maths skills does EZ Wonders cover?',
    a: 'Counting and numeral recognition, comparing quantities (more, fewer, the same), subitising with dice and dominoes, number bonds and part-part-whole, and ascending/descending number order.',
  },
];

const SKILLS = [
  'Counting and numeral recognition — one-to-one counting and number words',
  'Comparing quantities — more, fewer and the same',
  'Subitising — recognising quantities on dice and dominoes without counting',
  'Number bonds and part–part–whole, from 1–5 up to 1–10',
  'Number order — before, after and missing numbers, ascending and descending',
];

// Rendered from GAME_CATALOG so the public list can never drift from the games
// the app actually ships. Each row is a game card, so it shows the game's icon
// image where one exists (GameIcon falls back to the emoji otherwise).
function GameList() {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {GAME_CATALOG.map((game) => (
        <li key={game.key}>
          <Link
            to={game.to}
            className="aura-card flex h-full items-start gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5"
          >
            <GameIcon
              game={game}
              alt=""
              size="1.75rem"
              className="mt-0.5 shrink-0"
              emojiClassName="text-2xl"
            />
            <span className="min-w-0">
              <span className="block text-sm font-black text-white">{game.title}</span>
              <span className="aura-muted mt-0.5 block text-xs font-semibold leading-snug">
                {game.subtitle.replace(/\s*\n\s*/g, ' · ')}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Faq() {
  return (
    <div className="mt-4 space-y-2">
      {FAQS.map((item) => (
        <details key={item.q} className="aura-card rounded-2xl px-4 py-3">
          <summary className="cursor-pointer text-sm font-black text-white">{item.q}</summary>
          <p className="aura-muted mt-2 text-sm font-semibold leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function PublicLanding() {
  return (
    /* No background of its own: NameGate's `.aura-page::before` is a FIXED,
       viewport-locked backdrop, so the aurora stays behind this section too.
       `z-10` keeps the copy above that negative-z-index layer. */
    <section
      aria-labelledby="public-info-heading"
      className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-2 sm:px-6"
    >
      <div className="aura-panel rounded-[2rem] px-5 py-7 sm:px-9 sm:py-9">
        <div className="flex items-center gap-3">
          <img src={ICON_URL} alt="" width={44} height={44} className="h-11 w-11 rounded-2xl" />
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/80">
            EZ Wonders
          </p>
        </div>

        <h1
          id="public-info-heading"
          className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl"
        >
          Free interactive numeracy games for Kindergarten and preschool
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-indigo-100 sm:text-base">
          EZ Wonders is a browser-based early-years maths platform for children
          aged roughly 4 to 6. It maps to Kindergarten 1 (K1) and Kindergarten 2
          (K2) — the levels used in Singapore kindergartens — and fits Reception,
          Pre-K, nursery and prep classes just as well. Every game is short,
          replayable and playable on a phone, tablet or laptop, and there is
          nothing to install and no advertising.
        </p>

        <h2 className="mt-8 text-lg font-black text-white sm:text-xl">
          What children practise
        </h2>
        <ul className="mt-3 space-y-2">
          {SKILLS.map((skill) => (
            <li key={skill} className="flex gap-2.5 text-sm font-semibold text-indigo-100">
              <span aria-hidden="true" className="text-emerald-300">
                ✓
              </span>
              <span>{skill}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 text-lg font-black text-white sm:text-xl">
          The game library
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-indigo-100">
          Ten short numeracy games, each focused on one skill. Teachers choose
          which games a class can see, so a Kindergarten 1 class and a
          Kindergarten 2 class can run completely different arrangements.
        </p>
        <GameList />

        <h2 className="mt-8 text-lg font-black text-white sm:text-xl">
          Made for K1 and K2 classrooms
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-indigo-100">
          Teachers sign in with their own code to arrange games, add students to
          their roster and follow class progress. Children sign in with a class
          code and their name, or with a personal six-character code — the same
          code that prints onto a QR badge for the classroom wall. Progress is
          saved automatically, so results reach the teacher without anyone
          writing anything down.
        </p>

        <h2 className="mt-8 text-lg font-black text-white sm:text-xl">
          Frequently asked questions
        </h2>
        <Faq />

        <div className="mt-9 flex items-center gap-3 border-t border-white/15 pt-5">
          <img
            src={LOGO_URL}
            alt="EZ Wonders"
            className="h-9 w-auto"
            loading="lazy"
            decoding="async"
          />
          <p className="aura-muted text-xs font-semibold">
            Free interactive numeracy games for joyful early learning.
          </p>
        </div>
      </div>
    </section>
  );
}
