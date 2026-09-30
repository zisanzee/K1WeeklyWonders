// content.js
// All words, names and imagery for the /4yearsoflove keepsake live here.
//
// Same convention as teacherOnboardingContent.js: copy is data, not JSX, so the
// page component stays about behaviour and the wording can be edited without
// touching layout. Keep the *page* free of stray prose — put it here.

// ---------------------------------------------------------------------------
// WHO THIS PAGE IS FOR
// ---------------------------------------------------------------------------
// The page is a private surprise. It is gated on the viewer being signed in as
// the teacher named below; everyone else gets a decoy "404" so the URL reveals
// nothing. Matching is case- and whitespace-insensitive.
export const GRANTED_TEACHER_NAME = 'Siti Soleha';
export const TEACHER_NAME = 'Siti';
export const AUTHOR_NAME = 'Zisan';

// The photo of her. The Cloudinary URL is the master; a same-origin copy in
// public/ is the offline/precache fallback (Cloudinary is a third party, and
// this page must still be gorgeous if it is unreachable). PhotoCard walks the
// list in order with an onError fallback chain.
export const PHOTO_SOURCES = [
  'https://res.cloudinary.com/hijmipga/image/upload/v1790535090/WhatsApp_Image_2026-09-28_at_12.50.05_AM_z12who.jpg',
  '/love/her.jpg',
];

export const PHOTO_ALT = `${TEACHER_NAME} 🌷`;

// ---------------------------------------------------------------------------
// ACT 1 — the heart you have to HOLD
// ---------------------------------------------------------------------------
export const HOLD_HEADING = 'Hold the heart';
export const HOLD_SUBLABEL = 'press and keep holding';
export const HOLD_DONE_MESSAGE = `I love you, ${TEACHER_NAME}. ❤️`;
export const HOLD_PEEK_HINT = 'Scroll up to fill the heart first ♥';

// ---------------------------------------------------------------------------
// ACT 2 — the envelope and the letter inside it
// ---------------------------------------------------------------------------
export const ENVELOPE_SEAL_LABEL = 'For Siti';
export const ENVELOPE_HINT_BELOW = 'scroll to open';

// Kept deliberately SHORT: the letter lives on a 3:2 card that must fit a
// phone's viewport height once the envelope is gone, and three long paragraphs
// overflowed it (clipped by the card's own overflow). Two tight ones read
// better on a card that size anyway.
export const LETTER_TITLE = 'Four years of us.';
export const LETTER_PARAGRAPHS = [
  `Four years ago you said yes to a boy who had no idea how lucky he was — and he is still finding out.`,
  'Thank you for the giggles, the patience, and for making even a Monday feel like a small celebration.',
];
export const LETTER_SIGNOFF = `Forever yours, ${AUTHOR_NAME}`;

// ---------------------------------------------------------------------------
// ACT 0 — the short landing beat, after the heart is full and before scrolling
// ---------------------------------------------------------------------------
export const HERO_EYEBROW = 'For my favourite person';
export const HERO_TITLE = 'Four years with you';
export const HERO_BODY =
  'You filled the heart. Now scroll — there is a letter waiting inside the envelope.';

// ---------------------------------------------------------------------------
// ACT 3 — "why I love you", revealed two at a time as she scrolls
// ---------------------------------------------------------------------------
// Each entry appears one after another, two per screen, as the wall is scrolled.
export const REASONS = [
  { emoji: '😊', kind: 'Your smile', text: 'and your eyes that always make me feel loved.' },
  { emoji: '🫶', kind: 'The way you care', text: 'for me, even in the smallest things.' },
  { emoji: '🍚', kind: 'How you notice', text: 'when I don’t eat, don’t sleep, or need someone by my side.' },
  { emoji: '🌧️', kind: 'How you’re always there', text: 'when I feel down, and always look for me when something goes wrong.' },
  { emoji: '📹', kind: 'How you find little ways', text: 'to stay close — like turning your camera on while you sleep.' },
  { emoji: '💍', kind: 'How much the little things mean', text: 'to you — like the ring and the bear.' },
  { emoji: '✨', kind: 'How after four years', text: 'you still call me handsome and make me feel special.' },
  { emoji: '🌱', kind: 'How you always see', text: 'and appreciate my efforts.' },
  { emoji: '🫂', kind: 'How you make me feel', text: 'understood, valued, and never alone.' },
  { emoji: '💞', kind: 'Ten — and most of all', text: 'you’re not just my partner, but my best friend.' },
];

export const REASONS_TITLE = 'Why I love you';
export const REASONS_SUBTITLE = 'keep scrolling';

// ---------------------------------------------------------------------------
// ACT 4 — the elapsed-time counter (NOT a countdown). Past only.
// ---------------------------------------------------------------------------
export const COUNTER_HEADING = 'Together for';
export const COUNTER_SUBLABEL = 'every second since';

export const UNIT_LABELS = {
  days: 'days',
  hours: 'hours',
  minutes: 'minutes',
  seconds: 'seconds',
};

export const FINALE_MESSAGE = `Four years down, ${TEACHER_NAME}. A lifetime to go.`;

// ---------------------------------------------------------------------------
// MUSIC
// ---------------------------------------------------------------------------
// A gentle looping track, shared with the rest of the app (same public file the
// Phaser games use). No new asset is shipped for this page.
export const MUSIC_SRC = '/PhaserAssets/bg_music.m4a';
