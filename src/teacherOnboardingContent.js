// ---------------------------------------------------------------------------
// Teacher onboarding content
// ---------------------------------------------------------------------------
// All copy and imagery for the /teacher-onboarding guide lives here so the page
// component stays a pure renderer.
//
// NOTE ON THE FILENAME: this is deliberately NOT called `teacherOnboarding`,
// which would differ from `TeacherOnboarding.jsx` only by case. On a
// case-insensitive filesystem (Windows/macOS) an extension-less import of
// `./TeacherOnboarding` can resolve to this file instead of the component,
// yielding a module with no default export and a "lazy element type is invalid"
// crash at runtime. Keep the two names clearly distinct.
//
// >>> TO ADD A GIF: paste the URL against the matching section id below. <<<
// Any section whose entry is an empty string automatically falls back to a
// dashed "animation coming soon" placeholder, so this file is safe to ship with
// everything blank and fill in one at a time. No other code changes are needed.

export const ONBOARDING_GIFS = {
  login: 'https://res.cloudinary.com/hijmipga/image/upload/v1789398022/login_iry4yh.gif',
  games: 'https://res.cloudinary.com/hijmipga/image/upload/v1789398030/GAMES_zyz7qf.gif',
  catalogue: 'https://res.cloudinary.com/hijmipga/image/upload/v1789398456/catalogue_mbdf1i.gif',
  students: 'https://res.cloudinary.com/hijmipga/image/upload/v1789398022/Students_gu2xpy.gif',
  stats: 'https://res.cloudinary.com/hijmipga/image/upload/v1789398021/Stats_ka45p6.gif',
  settings: 'https://res.cloudinary.com/hijmipga/image/upload/v1789398022/settings_wtwcdd.gif',
};

// Human-readable titles used for the placeholder caption + image alt text, so
// the two stay in sync with the sections below.
export const ONBOARDING_GIF_LABELS = {
  login: 'Signing in with your teacher code',
  games: 'Locking, unlocking and scheduling a game',
  catalogue: 'Adding and removing games',
  students: 'Managing students, codes and badges',
  stats: 'Reading your class statistics',
  settings: 'Changing class privacy and your class code',
};

// Block types consumed by the renderer in TeacherOnboarding.jsx:
//   'p'       — a paragraph
//   'bullets' — a list of strings, or { label, text } pairs for emphasis-first rows
//   'cards'   — a grid of { icon, title, text } tiles
//   'sub'     — a titled sub-section, optionally with its own text/bullets/cards
//   'callout' — a highlighted note { icon, title, text }
export const ONBOARDING_SECTIONS = [
  {
    id: 'login',
    number: 1,
    icon: '🔑',
    eyebrow: 'Step 1',
    title: 'Log in',
    summary: 'Sign in with your teacher code and find your Control Panel.',
    accent: 'from-sky-400 to-blue-600',
    blocks: [
      { type: 'p', text: 'Log in using your unique teacher code.' },
      {
        type: 'p',
        text: 'Once you are signed in, the homepage will show the games that have been added to your class.',
      },
      {
        type: 'bullets',
        items: [
          {
            label: 'A lock icon',
            text: 'shows whether a game is currently locked or unlocked. Locked games cannot be played by students until you unlock them.',
          },
          {
            label: 'Teacher Controls',
            text: 'opens your Control Panel, where you manage your class and games.',
          },
        ],
      },
      {
        type: 'callout',
        icon: '💡',
        title: 'Your code is all you need',
        text: 'There is no username or password — just your teacher code. Keep it to yourself, since it gives full access to your class.',
      },
    ],
  },
  {
    id: 'games',
    number: 2,
    icon: '🎮',
    eyebrow: 'Step 2',
    title: 'Games',
    summary: 'Decide what your students can play, and when they can play it.',
    accent: 'from-violet-400 to-fuchsia-600',
    blocks: [
      {
        type: 'p',
        text: 'The Games tab lets you control which games your students can play. From here, you can:',
      },
      {
        type: 'cards',
        items: [
          {
            icon: '🔒',
            title: 'Lock a game',
            text: 'Stop students from playing it.',
          },
          {
            icon: '🔓',
            title: 'Unlock a game',
            text: 'Make it available immediately.',
          },
          {
            icon: '⏰',
            title: 'Schedule an unlock',
            text: 'Choose a future date and time for the game to open.',
          },
        ],
      },
      {
        type: 'p',
        text: 'Scheduled games will unlock automatically when the scheduled time arrives — you do not need to be online or logged in.',
      },
      {
        type: 'p',
        text: 'You can also change the order of the games to organise them the way you want your class to see them.',
      },
      {
        type: 'sub',
        title: 'How scheduling works',
        bullets: [
          'A scheduled game stays locked until its time arrives.',
          'Students see a countdown on the homepage showing which game is coming next.',
          'Unlocking a game early cancels its schedule — you have simply done what the schedule was going to do.',
          'If you change your mind, tap the clock button again to set a new time.',
        ],
      },
      {
        type: 'callout',
        icon: '👆',
        title: 'Remember to save',
        text: 'Locking, unlocking and reordering are staged as a draft. Press Confirm changes when you are done — scheduling saves on its own.',
      },
    ],
  },
  {
    id: 'catalogue',
    number: 3,
    icon: '📚',
    eyebrow: 'Step 3',
    title: 'Catalogue',
    summary: 'Choose which games appear in your class.',
    accent: 'from-amber-400 to-orange-600',
    blocks: [
      {
        type: 'p',
        text: 'The Catalogue is where you choose which games are available in your class.',
      },
      {
        type: 'p',
        text: 'Browse or search through the available games, then add the games you want your students to play.',
      },
      {
        type: 'callout',
        icon: '🔒',
        title: 'New games start locked',
        text: 'Games you add to your class start locked. This lets you decide when students should gain access to them.',
      },
      {
        type: 'p',
        text: 'You can also remove games from your class at any time.',
      },
      {
        type: 'sub',
        title: 'A good order to work in',
        bullets: [
          'Add the games you want from the Catalogue.',
          'Switch to the Games tab and arrange them in the order your class should see.',
          'Unlock the first game, and schedule the rest for the weeks ahead.',
        ],
      },
    ],
  },
  {
    id: 'students',
    number: 4,
    icon: '🧑‍🎓',
    eyebrow: 'Step 4',
    title: 'Students',
    summary: 'Add your class, share login details, and tidy up duplicates.',
    accent: 'from-emerald-400 to-teal-600',
    blocks: [
      {
        type: 'p',
        text: 'The Students tab lets you manage the students in your class. You can add or remove students and manage their login details.',
      },
      { type: 'p', text: 'For each student, you can:' },
      {
        type: 'cards',
        items: [
          {
            icon: '🔗',
            title: 'Copy their login link',
            text: 'Share the student’s personal link for quick access.',
          },
          {
            icon: '🔢',
            title: 'Copy their student code',
            text: 'Use their unique code to log in.',
          },
          {
            icon: '🖨️',
            title: 'Print their Game Pass',
            text: 'Print an individual badge with their QR code.',
          },
        ],
      },
      {
        type: 'p',
        text: 'You can also print all student badges together for your whole class.',
      },
      {
        type: 'sub',
        title: 'Public and private classes',
        text: 'Your class can be set to Public or Private. You can change this at any time in Settings.',
        cards: [
          {
            icon: '🌐',
            title: 'Public class',
            text: 'Students can enter the class code and join simply by entering their name.',
          },
          {
            icon: '🔒',
            title: 'Private class',
            text: 'Only students you have added to the class, who have the required student code, can join.',
          },
        ],
      },
      {
        type: 'sub',
        title: 'Merge duplicate students',
        text: 'Sometimes the same student may appear more than once — for example, because they played using different names or devices.',
      },
      {
        type: 'p',
        text: 'You can merge these identities so they are treated as one student. This keeps their play history together and makes sure their activity is counted as one student in your class list and statistics.',
      },
    ],
  },
  {
    id: 'stats',
    number: 5,
    icon: '📊',
    eyebrow: 'Step 5',
    title: 'Stats',
    summary: 'See how your class is really using the games.',
    accent: 'from-rose-400 to-pink-600',
    blocks: [
      {
        type: 'p',
        text: 'The Stats tab gives you an overview of how your class is using the games. You can see:',
      },
      {
        type: 'bullets',
        items: [
          'How many students have been playing',
          'How many times the games have been played',
          'Which games students have played',
          'When the games were played',
        ],
      },
      {
        type: 'sub',
        title: 'Summary or all plays',
        text: 'The Summary view gives you a quick overview of each student’s activity. Choose Show All Plays to see every individual play session, including when it happened.',
      },
      {
        type: 'sub',
        title: 'View a specific game',
        text: 'Use the game filter to switch from All Games to a specific game and view statistics for that game only.',
      },
      {
        type: 'sub',
        title: 'Mission Heroes',
        text: 'Open Mission Heroes to see which students have completed the weekly mission of playing 4 different games.',
      },
      {
        type: 'callout',
        icon: '🗑️',
        title: 'Removing a single result',
        text: 'In the Summary view you can delete an individual student’s result for one game — useful after a test run or a mis-typed name.',
      },
    ],
  },
  {
    id: 'settings',
    number: 6,
    icon: '⚙️',
    eyebrow: 'Step 6',
    title: 'Settings',
    summary: 'Class privacy, your class code, and signing out.',
    accent: 'from-indigo-400 to-slate-600',
    blocks: [
      {
        type: 'p',
        text: 'The Settings tab is where you manage your class details. Here you can:',
      },
      {
        type: 'bullets',
        items: [
          { label: 'Change your class privacy', text: 'Switch your class between Public and Private.' },
          { label: 'Change your class code', text: 'Update the code students use to join your class.' },
          { label: 'Sign out', text: 'Sign out of your teacher account when you are finished.' },
        ],
      },
      {
        type: 'callout',
        icon: '⚠️',
        title: 'Changing your class code',
        text: 'Any printed badges or shared links containing the old code will stop working. Regenerate and reprint them if you make this change.',
      },
    ],
  },
];
