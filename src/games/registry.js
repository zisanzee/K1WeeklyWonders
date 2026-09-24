// registry.js
// THE single source of truth for every game.
//
// ---------------------------------------------------------------------------
// ADDING A GAME — the whole process
// ---------------------------------------------------------------------------
//   1. Create src/games/<slug>/  (a GamePage.jsx for a Phaser game, or a single
//      Game.jsx for a React game).
//   2. Add ONE entry to GAME_REGISTRY below.
//   3. Done. The route (main.jsx), the catalogue card + unlock list
//      (GAME_CATALOG in gameAccess.js), and the homepage prefetch (BetaHome)
//      all derive from this list. There is nothing else to wire up.
//
// An admin then has to add the game to a class from the panel's Catalogue for
// a class to see it — that is deliberate (a class only sees games it added).
//
// ---------------------------------------------------------------------------
// FIELDS
// ---------------------------------------------------------------------------
//   key          Stable identity. Drives unlocks, GameAccess rows, stats and
//                progressKey. NEVER change or reuse one — it is the game's
//                primary key across the whole system.
//   slug         The folder under src/games/. For humans only.
//   route        The public URL. OPAQUE 5-digit codes on purpose, so a path
//                never reveals the game number. Must be unique; never reuse a
//                retired one.
//   term         Academic term id (see GAME_TERMS in gameAccess.js).
//   progressKey  Key used by the stats/progress tables ('game1'…'game10',
//                'bonusGame1'). Must match what the game passes to
//                logPlaySession({ game }).
//   isBonus      Optional. Marks a bonus game (affects catalogue grouping).
//   meta         Everything the card renders: emoji, label, title, subtitle,
//                description, hue, tint, gradient, ring.
//   load         `() => import(...)` returning a module whose DEFAULT export is
//                the page component. Both a React game (Game.jsx) and a Phaser
//                game (GamePage.jsx) satisfy that, so this is the only line
//                that differs between the two kinds.
//
// Keep this module DEPENDENCY-FREE except for the lazy import thunks: it is
// imported by the eager entry graph (main.jsx), so a heavy import here would
// land in the first-paint bundle.
// ---------------------------------------------------------------------------

export const GAME_REGISTRY = [
  {
    key: '1',
    slug: 'count-and-win',
    route: '/47182',
    term: 3,
    progressKey: 'game1',
    meta: {
      emoji: '🧶',
      label: 'Count & Win!',
      title: 'Count & Win!',
      subtitle: 'Numeral & Number Word\n(Counting)',
      description: 'Practise reading numerals and number words by counting friendly objects one by one.',
      hue: '#38BDF8',
      tint: '#EFF9FF',
      gradient: 'linear-gradient(135deg, #8FECCB 0%, #36D4B3 55%, #18B79D 100%)',
      ring: 'ring-[#D7FFF3]',
    },
    load: () => import('@/games/count-and-win/Game'),
  },
  {
    key: '2',
    slug: 'comparing-quantities',
    route: '/90365',
    term: 3,
    progressKey: 'game2',
    meta: {
      emoji: '🧸',
      label: 'Comparing Quantities',
      title: 'Comparing Quantities',
      subtitle: 'Comparing 2 Sets\n(More, Fewer, Same)',
      description: 'Compare two groups of objects and decide which has more, fewer or the same.',
      hue: '#A78BFA',
      tint: '#F5F1FF',
      gradient: 'linear-gradient(135deg, #88DAFF 0%, #4AA8FF 55%, #5B7CFF 100%)',
      ring: 'ring-[#D9F2FF]',
    },
    load: () => import('@/games/comparing-quantities/Game'),
  },
  {
    key: '3',
    slug: 'which-number',
    route: '/25814',
    term: 3,
    progressKey: 'game3',
    meta: {
      emoji: '🐙',
      label: 'Which Number?',
      title: 'Which Number?',
      subtitle: 'Numeral & Number Word\n(Before & After Ed.)',
      description: 'Find the number that comes just before or just after the target numeral.',
      hue: '#FB7185',
      tint: '#FFF0F2',
      gradient: 'linear-gradient(135deg, #C7A6FF 0%, #9A7BFF 55%, #FF7AD9 100%)',
      ring: 'ring-[#EAD9FF]',
    },
    load: () => import('@/games/which-number/Game'),
  },
  {
    key: '4',
    slug: 'compare-dice-dominoes',
    route: '/61947',
    term: 3,
    progressKey: 'game4',
    meta: {
      emoji: '🎲',
      label: 'Compare Die and Dominoes',
      title: 'Compare Die and Dominoes',
      subtitle: 'Comparing 2 Sets\n(subitising)',
      description: 'Read dice and dominoes and compare the two amounts using quick subitising.',
      hue: '#FBBF24',
      tint: '#FFF9E8',
      gradient: 'linear-gradient(135deg, #FFD76A 0%, #FFB347 55%, #FF7A59 100%)',
      ring: 'ring-[#FFEBC0]',
    },
    load: () => import('@/games/compare-dice-dominoes/GamePage'),
  },
  {
    key: '5',
    slug: 'making-splitting-groups',
    route: '/83026',
    term: 3,
    progressKey: 'game5',
    meta: {
      emoji: '🚀',
      label: 'Making & Splitting Groups',
      title: 'Making & Splitting Groups',
      subtitle: 'Number Bonds\n(1-5)',
      description: 'Make and split groups up to five to build early number-bond understanding.',
      hue: '#34D399',
      tint: '#EEFCF6',
      gradient: 'linear-gradient(135deg, #A7EE7E 0%, #4DD4A6 55%, #2CB5D8 100%)',
      ring: 'ring-[#DCF8C6]',
    },
    load: () => import('@/games/making-splitting-groups/Game'),
  },
  {
    key: '6',
    slug: 'part-part-whole',
    route: '/14759',
    term: 3,
    progressKey: 'game6',
    meta: {
      emoji: '🗝️',
      label: 'Part-Part-Whole!',
      title: 'Part-Part-Whole!',
      subtitle: 'Number Bonds\n(1-10)',
      description: 'Explore part-part-whole number bonds for totals from one to ten.',
      hue: '#2DD4BF',
      tint: '#EBFBF9',
      gradient: 'linear-gradient(135deg, #FF9AAE 0%, #FF6F91 55%, #FF4D6D 100%)',
      ring: 'ring-[#FFD6DE]',
    },
    load: () => import('@/games/part-part-whole/Game'),
  },
  {
    key: 'b1',
    slug: 'number-pop',
    route: '/20475',
    term: 3,
    progressKey: 'bonusGame1',
    isBonus: true,
    meta: {
      emoji: '9️⃣',
      label: 'Number Pop! (Bonus)',
      title: 'Number Pop!',
      subtitle: 'Numeral & Number Word\n(Ascending & Descending Order)',
      description: 'Pop the numbered bubbles in rising and falling order to master sequencing.',
      hue: '#E879F9',
      tint: '#FDF1FE',
      gradient: 'linear-gradient(135deg, #FF9ED1 0%, #FF6FB1 55%, #9B5CFF 100%)',
      ring: 'ring-[#FFD8EE]',
    },
    load: () => import('@/games/number-pop/GamePage'),
  },
  {
    key: '7',
    slug: 'mama-birds-eggs',
    route: '/59283',
    term: 3,
    progressKey: 'game7',
    meta: {
      emoji: '🥚',
      label: "Mama Bird's Eggs",
      title: "Mama Bird's Eggs",
      subtitle: 'Number Bonds\n(1-10)',
      description: 'Help Mama Bird hatch the right number of eggs to complete each number bond.',
      hue: '#FFBB54',
      tint: '#FFF7EB',
      gradient: 'linear-gradient(135deg, #FFD76A 0%, #FFB347 55%, #FF7A59 100%)',
      ring: 'ring-[#FFEBC0]',
    },
    load: () => import('@/games/mama-birds-eggs/GamePage'),
  },
  {
    key: '8',
    slug: 'pizza-order',
    route: '/36501',
    term: 3,
    progressKey: 'game8',
    meta: {
      emoji: '\uD83C\uDF55',
      label: 'Pizza Order!',
      title: 'Pizza Order!',
      subtitle: 'Number Bonds\n(1-10)',
      description: 'Take pizza orders by matching the correct number of toppings to each bond.',
      hue: '#FB923C',
      tint: '#FFF4E8',
      gradient: 'linear-gradient(135deg, #FFC46B 0%, #FF8A5C 55%, #FF5F6D 100%)',
      ring: 'ring-[#FFE3C0]',
    },
    load: () => import('@/games/pizza-order/GamePage'),
  },
  {
    key: '9',
    slug: 'pollys-treasure-quest',
    route: '/72048',
    term: 3,
    progressKey: 'game9',
    meta: {
      emoji: '\uD83E\uDD9C',
      label: "Polly's Treasure Quest",
      title: "Polly's Treasure Quest",
      subtitle: 'Number Bonds\n(1-10)',
      description: 'Sail with Polly and collect treasure by solving number bonds up to ten.',
      hue: '#F59E0B',
      tint: '#FFF7E6',
      gradient: 'linear-gradient(135deg, #FFD76A 0%, #F59E0B 55%, #D97706 100%)',
      ring: 'ring-[#FFEBC0]',
    },
    load: () => import('@/games/pollys-treasure-quest/GamePage'),
  },
  {
    key: '10',
    slug: 'feed-me-shapes',
    route: '/98416',
    term: 4,
    progressKey: 'game10',
    meta: {
      emoji: '\uD83C\uDF55',
      label: 'Feed Me Shapes',
      title: 'Feed Me Shapes',
      subtitle: '4 Basic Shapes\n(Circle, Square, Triangle, Rectangle)',
      description: 'Feed the monster the shapes it asks for — first by name, then by their properties — by catching the right food as it falls.',
      hue: '#22C55E',
      tint: '#ECFDF5',
      gradient: 'linear-gradient(135deg, #6EE7B7 0%, #22C55E 55%, #15803D 100%)',
      ring: 'ring-[#C7F5DC]',
    },
    load: () => import('@/games/feed-me-shapes/GamePage'),
  },
  {
    // Identity for "Mirror Me!". Change label/title/subtitle only in tandem with
    // GamePage.jsx's gate labels, or the lock screen and the card disagree.
    key: '11',
    slug: 'game-11',
    route: '/51730',
    term: 4,
    progressKey: 'game11',
    meta: {
      emoji: '\uD83E\uDDE9',
      label: 'Mirror Me!',
      title: 'Mirror Me!',
      subtitle: 'Match the mirrored parts',
      description: 'Rebuild each picture by dragging its pieces into the matching spot on its mirror image.',
      hue: '#0EA5E9',
      tint: '#E0F2FE',
      gradient: 'linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 55%, #0369A1 100%)',
      ring: 'ring-[#BAE6FD]',
    },
    load: () => import('@/games/game-11/GamePage'),
  },
];

// The catalogue shape the UI consumes: identity + routing + metadata, flattened.
// `to` is the route (the UI's name for it); everything else is passed through.
export const GAME_CATALOG = GAME_REGISTRY.map((game) => ({
  key: game.key,
  term: game.term,
  to: game.route,
  progressKey: game.progressKey,
  ...(game.isBonus ? { isBonus: true } : {}),
  ...game.meta,
}));

export const GAME_KEYS = GAME_CATALOG.map((game) => game.key);

// Prefetch every game the current player can actually open, so a card click is
// instant. Takes the caller's unlock predicate rather than importing the store,
// keeping this module dependency-free (it is in the eager entry graph).
//
// Deliberately fire-and-forget: a prefetch is an optimisation, so a failed
// import must be swallowed — the real navigation will surface the error.
export function prefetchUnlockedGames(isUnlockedNow, isTeacher) {
  for (const game of GAME_REGISTRY) {
    if (isUnlockedNow(game.key, isTeacher)) {
      game.load().catch(() => {});
    }
  }
}
