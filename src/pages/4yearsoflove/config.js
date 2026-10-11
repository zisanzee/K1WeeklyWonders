// ===========================================================================
// config.js — THE ONE FILE TO EDIT
// ===========================================================================
// Every piece of text, every image, every date and every tunable number for the
// /4yearsoflove page lives here. The components (index, HoldGate, ActEnvelope,
// PhotoCard, ReasonWall, HeartCatch, Counter) and the date/milestone helpers all
// import from this file, so you can rewrite the whole page without touching a
// single component.
//
// How to use it:
//   - Copy is plain data, never JSX — edit a string and the page follows.
//   - Templated lines use `${TEACHER_NAME}` / `${AUTHOR_NAME}`; change those two
//     names and every mention updates.
//   - Numbers under a "TUNING" heading change feel (speed, counts, thresholds),
//     not wording. They are safe to tweak but keep them sane.
//   - Anything that looks like a list (REASONS, LETTER_PARAGRAPHS, MILESTONES,
//     PHOTO_SOURCES, GAME_LEGEND, HUG_REPLIES, SHOOTING_STARS) can be added to
//     or trimmed; the layout adapts (a couple of lists pin a fixed count — see
//     the note above each).
// ===========================================================================

// ---------------------------------------------------------------------------
// WHO THIS PAGE IS FOR  (the access gate)
// ---------------------------------------------------------------------------
// The page is a private surprise: it renders only for the viewer signed in as
// the teacher named in GRANTED_TEACHER_NAME; everyone else gets a decoy 404.
// Matching is case- and whitespace-insensitive.
export const GRANTED_TEACHER_NAME = 'Siti Soleha';
export const TEACHER_NAME = 'Eka';
export const AUTHOR_NAME = 'Zisan';

// ---------------------------------------------------------------------------
// PAGE CHROME — the browser title, share card meta and the decoy 404
// ---------------------------------------------------------------------------
export const PAGE_TITLE = 'Four years of love 💗';
export const PAGE_THEME_COLOR = '#4c0f3c';

export const DECOY_CODE = '404';
export const DECOY_TITLE = 'Page not found';
export const DECOY_BODY = 'The page you are looking for does not exist.';

// ---------------------------------------------------------------------------
// SOUND
// ---------------------------------------------------------------------------
export const MUSIC_SRC = '/PhaserAssets/bg_music.m4a';
export const MUSIC_ON_LABEL = 'Music on';
export const MUSIC_OFF_LABEL = 'Music off';
export const SFX_ON_LABEL = 'Sound on';
export const SFX_OFF_LABEL = 'Sound off';

// ---------------------------------------------------------------------------
// ACT 0 — the landing beat, after the heart is full and before scrolling
// ---------------------------------------------------------------------------
export const HERO_EYEBROW = 'For my favourite person';
export const HERO_TITLE = 'Four years with you';
export const HERO_BODY =
  'You filled the heart';
export const LANDING_CUE = 'scroll';
export const LANDING_FOUR = '4'; // the giant glowing numeral behind the title

// ---------------------------------------------------------------------------
// ACT 1 — the heart you have to HOLD
// ---------------------------------------------------------------------------
export const HOLD_EYEBROW = 'A little ritual first';
export const HOLD_HEADING = 'Hold the heart';
export const HOLD_SUBLABEL = 'press and keep holding';
export const HOLD_DONE_MESSAGE = `I love you, ${TEACHER_NAME}. ❤️`;
export const HOLD_FULL_LABEL = 'full'; // shown in the heart once it is full
export const HOLD_EMOJI_IDLE = '💗';
export const HOLD_EMOJI_DONE = '💖';

// The hold ritual speaks as it fills: [progress threshold 0..1, line].
export const HOLD_STAGES = [
  [0, HOLD_SUBLABEL],
  [0.2, 'that’s it… don’t let go'],
  [0.5, 'halfway there, love'],
  [0.8, 'almost… I can feel it'],
];

// TUNING — the hold's timing, haptics and sparks.
export const HOLD_MS = 2600; // ms of continuous holding to fill
export const HOLD_DRAIN_PER_SEC = 1.7; // how fast it empties on release
export const HOLD_SPARK_EVERY_MS = 110; // spacing of the charge sparks
export const HOLD_VIBRATE_FINISH = [30, 50, 30, 50, 90];
export const HOLD_VIBRATE_TICK = 12; // tiny haptic on each heartbeat step
export const HOLD_BEATS = 8; // progress steps that each tick once

// ---------------------------------------------------------------------------
// ACT 2 — the envelope and the letter inside it
// ---------------------------------------------------------------------------
export const ENVELOPE_SEAL_LABEL = 'For Peach';
export const ENVELOPE_HINT_BELOW = 'scroll to open';
export const ENVELOPE_HINT_NEXT = 'scroll on';
export const PAPER_STAMP = '4';
export const PAPER_STAMP_SMALL = 'years';

// Keep the letter SHORT: it lives on a 3:2 card that must fit a phone's viewport
// once the envelope is gone. Two tight paragraphs read better than three long
// ones on a card that size.
export const LETTER_TITLE = 'Four years of us.';
export const LETTER_PARAGRAPHS = [
  `Four years ago you said yes to a boy who had no idea how lucky he was`,
  'Thank you for the giggles, the patience, for making everyday feel special. I love you more than words can say.',
];
export const LETTER_SIGNOFF = `Forever yours, ${AUTHOR_NAME}`;

// TUNING — how far the letter travels during the envelope act (in envelope
// heights). Only change these if you also change the envelope art.
export const PAPER_LIFT = '87%';
export const PAPER_EXIT = '-190%';

// ---------------------------------------------------------------------------
// ACT 3 — the polaroid photo
// ---------------------------------------------------------------------------
// Walked in order with an onError fallback chain: the Cloudinary master first,
// then a same-origin copy so the page still looks right offline.
export const PHOTO_SOURCES = [
  'https://res.cloudinary.com/hijmipga/image/upload/v1790535090/WhatsApp_Image_2026-09-28_at_12.50.05_AM_z12who.jpg',
  '/love/her.jpg',
];
export const PHOTO_ALT = `${TEACHER_NAME} 🌷`;
export const PHOTO_EYEBROW = 'One more thing';
export const PHOTO_TITLE = 'My favourite view';
export const PHOTO_CAPTION = `${TEACHER_NAME}, always 🌷`;
export const PHOTO_HINT = 'tap the photo ♥';
export const PHOTO_HINT_FRONT = 'tap the photo to turn it over ♥';
export const PHOTO_HINT_BACK = 'tap again to turn it back';
export const PHOTO_BACK_KICKER = 'My Peach, my love, my everything.';
export const PHOTO_BACK_TEXT =
  'Every ordinary day is better because you are somewhere in it.';
export const PHOTO_BACK_SIGN = 'always yours ♡';
export const PHOTO_EMPTY_EMOJI = '🌷'; // shown if every photo source fails

// ---------------------------------------------------------------------------
// ACT 4 — "why I love you", revealed as she scrolls and kept when tapped
// ---------------------------------------------------------------------------
export const REASONS_TITLE = 'Why I love you';
export const REASONS_SUBTITLE = '';
export const REASONS_DONE = 'ten reasons… and a thousand more';
export const REASONS_TAP_HINT = 'tap a reason to keep it ♥';

// Add or remove freely — the counter and progress bar use REASONS.length.
export const REASONS = [
  { emoji: '', kind: 'Your smile', text: 'and your eyes that always make me feel loved.' },
  { emoji: '', kind: 'The way you care', text: 'for me, even in the smallest things.' },
  { emoji: '', kind: 'How you notice', text: 'when I don’t eat, don’t sleep, or need someone by my side.' },
  { emoji: '', kind: 'How you’re always there', text: 'when I feel down, and always look for me when something goes wrong.' },
  { emoji: '', kind: 'How you find little ways', text: 'to stay close — like turning your camera on while you sleep.' },
  { emoji: '', kind: 'How much the little things mean', text: 'to you — like the ring and the bear.' },
  { emoji: '', kind: 'How after four years', text: 'you still call me handsome and make me feel special.' },
  { emoji: '', kind: 'How you always see', text: 'and appreciate my efforts.' },
  { emoji: '', kind: 'How you make me feel', text: 'understood, valued, and never alone.' },
  { emoji: '', kind: 'Ten — and most of all', text: 'you’re not just my partner, but my best friend.' },
];
// The "kept" badge once she has tapped at least one reason.
export const reasonsKeptLabel = (n) => `♥ ${n} kept`;

// ---------------------------------------------------------------------------
// ACT 5 — the little game ("Catch my heart")
// ---------------------------------------------------------------------------
export const GAME_EYEBROW = 'A little game';
export const GAME_TITLE = 'Catch my heart';
export const GAME_INTRO = 'Slide the basket. Catch the hearts, dodge the broken ones.';
export const GAME_GOAL = 25; // score at which the win card fires
export const GAME_START = 'Play';
export const GAME_AGAIN = 'Play again';
export const GAME_WIN_TITLE = 'You caught it 💖';
export const GAME_WIN_BODY = `You had my whole heart long before this game, ${TEACHER_NAME}.`;
export const GAME_HUD_EMOJI = '💗';
export const GAME_START_EMOJI = '🧺';
export const GAME_AGAIN_EMOJI = '🔁';
export const GAME_MOVE_HINT =
  'Catch the hearts. Use the left and right arrow keys to move the basket.';
// Floating score pop-ups drawn on the canvas.
export const GAME_PENALTY_TEXT = '−2';
export const GAME_SLOWMO_TEXT = 'slow-mo ✨';
export const gamePointsText = (pts) => `+${pts}`;
// The emoji + size for each falling item.
export const GAME_ITEMS = {
  heart: { emoji: '💗', size: 30 },
  gold: { emoji: '💛', size: 36 },
  ring: { emoji: '💍', size: 32 },
  broken: { emoji: '💔', size: 30 },
};
export const GAME_LEGEND = [
  ['💗', '+1'],
  ['💛', '+5'],
  ['💍', 'slow-mo'],
  ['💔', '−2'],
];

// TUNING — game feel. Speeds are scaled by the field height at runtime, so these
// read as "units per second" and stay put across screen sizes.
export const GAME_TUNING = {
  spawnStart: 0.78, // seconds between spawns at the start
  spawnMin: 0.26, // fastest spawn interval
  spawnScoreFactor: 0.014, // how quickly spawns accelerate with score
  fallBase: 150, // fall speed at score 0
  fallScoreFactor: 4, // extra fall speed per point
  fallJitter: 60, // random fall-speed variance
  basketSpeed: 480, // keyboard / target move speed
  basketFollow: 18, // pointer smoothing
  catchWindow: [8, 26], // vertical catch band around the basket mouth
  comboStep: 5, // catches per multiplier step
  maxMultiplier: 4, // x4 cap
  goldChance: 0.06, // 💛
  ringChance: 0.1, // 💍 (cumulative with gold)
  brokenBaseChance: 0.26, // 💔 base, before the score creep
  brokenScoreCreep: 0.004,
  brokenScoreCreepMax: 0.1,
  brokenPenalty: 2,
  goldPoints: 5,
  slowMoMs: 4000,
};

// ---------------------------------------------------------------------------
// ACT 6 — the elapsed-time counter (NOT a countdown). Past only.
// ---------------------------------------------------------------------------
export const COUNTER_HEADING = 'Together for';
export const COUNTER_SUBLABEL = 'every second since';
export const COUNTER_MONTH_LABEL = 'this month of us';

export const UNIT_LABELS = {
  days: 'days',
  hours: 'hours',
  minutes: 'minutes',
  seconds: 'seconds',
};

// The four odometer cells (labels only; values come from the clock).
export const COUNTER_CELLS = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
];

// Under the big day count.
export const COUNTER_DAYS_LABEL = { one: 'day together', many: 'days together' };

// The "4 years · 11 months · 2 days" line. `unitLabel` pluralises.
export const UNITS = {
  year: ['year', 'years'],
  month: ['month', 'months'],
  day: ['day', 'days'],
};
export const unitLabel = (n, unit) => {
  const pair = UNITS[unit] || [unit, `${unit}s`];
  return n === 1 ? pair[0] : pair[1];
};

export const MILESTONES_TITLE = 'Milestones we have already passed';
export const MILESTONES_TAIL = '…and counting';

// Rounds already passed, in chronological order. `field` reads getAnniversary().
export const MILESTONES = [
  { id: 'd100', emoji: '🌱', label: '100 days', field: 'totalDays', at: 100 },
  { id: 'h10k', emoji: '⏳', label: '10,000 hours', field: 'totalHours', at: 10_000 },
  { id: 'd500', emoji: '🌷', label: '500 days', field: 'totalDays', at: 500 },
  { id: 'm1m', emoji: '💫', label: 'a million minutes', field: 'totalMinutes', at: 1_000_000 },
  { id: 'd1000', emoji: '🌟', label: '1,000 days', field: 'totalDays', at: 1000 },
  { id: 's100m', emoji: '✨', label: '100 million seconds', field: 'totalSeconds', at: 100_000_000 },
  { id: 'y4', emoji: '💍', label: 'four whole years', field: 'years', at: 4 },
];

export const FINALE_MESSAGE = `Four years down, ${TEACHER_NAME}. A lifetime to go.`;
export const HUG_LABEL = 'Send me a hug';
export const HUG_EMOJI = '🫂';
export const REPLAY_LABEL = 'Read it again';
export const REPLAY_EMOJI = '💌';
export const HUG_REPLIES = [
  'Hug received. Delivered with all my love 🫂',
  'Again? Always. 💞',
  'I’m never letting go, you know that 🥹',
  'You can do this forever. So can I. ♾️',
];

// The secret: tap the day-ring N times inside the window for a heart firework.
export const SECRET_TAPS = 5;
export const SECRET_WINDOW_MS = 2000;
export const SECRET_FOUND = '✨ you found a secret ✨';

// The anniversary send-off message, shown whenever the act is reached.
export const yearTurnMessage = (years) =>
  `${years} ${unitLabel(years, 'year')} together. Happy anniversary, ${TEACHER_NAME} 💞`;

// TUNING — the counter's clock and its effects.
export const COUNTER_TICK_MS = 1000; // 1 Hz clock
export const COUNTUP_MS = 2600; // the days figure rolling up from zero
export const REVEAL_BURST = { count: 70, power: 1.5 };
export const SALVO = { count: 4, staggerMs: 240 }; // firework salvo on reveal
export const ROCKET_VOLLEY = { count: 8, staggerMs: 320 }; // sent off with the reveal
export const MINUTE_BURST = { count: 10, power: 0.7 }; // small burst each whole minute
export const HUG_BURST = { count: 90, power: 1.8 };

// ---------------------------------------------------------------------------
// THE START DATE — the one ambiguous input
// ---------------------------------------------------------------------------
// "12/10/22" is ambiguous (US MM/DD vs the rest of the world DD/MM). Resolved
// here, in ONE place, as **12 October 2022** (DD/MM/YY, the couple's timezone).
// If that reading is ever wrong, change it here and the entire page follows.
//
// The anchor is midnight in Asia/Dhaka (UTC+6). Bangladesh has observed no DST
// since 2009, so a FIXED offset is exactly correct and the count can never drift
// by an hour mid-year the way a zone-database lookup might.
export const START_DATE_PARTS = Object.freeze({
  year: 2022,
  month: 10, // 1-based: 10 = October
  day: 12,
  hour: 0,
  minute: 0,
  second: 0,
});
export const START_OFFSET_MINUTES = 360; // Asia/Dhaka = UTC+6

// ---------------------------------------------------------------------------
// AMBIENT BACKDROP — the shooting stars on staggered loops
// ---------------------------------------------------------------------------
// [left, top, delay, duration] — add or remove freely.
export const SHOOTING_STARS = [
  ['8%', '10%', '2s', '11s'],
  ['46%', '4%', '7s', '13s'],
  ['72%', '18%', '12s', '15s'],
];

// ---------------------------------------------------------------------------
// CONFETTI — the one-shot burst over the finale
// ---------------------------------------------------------------------------
export const CONFETTI = { count: 90, replayCount: 120, durationMs: 5600 };
