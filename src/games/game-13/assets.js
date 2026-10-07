// assets.js
// Game 13 — the single place this game's asset URLs live.
//
// The road/car/obstacle artwork is loaded here and every loader path picks the
// files up automatically: ASSET_MANIFEST is derived from IMAGES, so it never
// needs editing by hand. Keys are FLAT on purpose — the manifest builder maps
// every value straight to a URL, so a nested object would be handed to Phaser as
// a bogus URL. Obstacles therefore use an `obstacleX` prefix instead of nesting.

// Cloudinary assets are served through `f_auto,q_auto` so the browser gets the
// smallest format it supports (WebP/AVIF) at an auto-selected quality — a large
// download saving over the raw PNGs, with no layout change. Applied once here so
// the table below stays plain URLs.
const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

export const IMAGES = {
  // Fullscreen start/title screen. Drawn scaled-to-cover in GameScene, with the
  // Start button laid over its lower third (see roadTuning.js START_SCREEN).
  startScreen: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1791371328/Lane_Switch__How_to_Play_1_xr4b4j.png'
  ),

  // Looping road backdrop — scrolled top-to-bottom to read as an endless road.
  // It carries the two lanes; the lane GUIDES are drawn from roadTuning.js (see
  // GameScene.js), not baked into this image.
  bgLoop: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794532/road_qwt430.png'
  ),

  // The player's car — parked at the bottom of one lane and tapped to switch.
  playerCar: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794531/playerCar_izyrpt.png'
  ),

  // Obstacles: one drives down each lane at a time (see roadTuning.js). All are
  // flat keys so the manifest derivation below just works.
  obstacleTires: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794530/obstacletires_mvd3jp.png'
  ),
  obstaclePuddle: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794529/obstaclePuddle_pfomvu.png'
  ),
  obstacleCar1: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794528/obstacleCar2_dqrpjf.png'
  ),
  obstacleCone: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794528/obstacleCone_aooaxu.png'
  ),
  obstacleCar2: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794527/obstacleCar_uczmyn.png'
  ),
  obstacleBox: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1790794527/obstacleBox_b9jorn.png'
  ),
};

// The obstacle pool, in one place so the scene can pick a random one per lane.
export const OBSTACLE_KEYS = [
  'obstacleTires',
  'obstaclePuddle',
  'obstacleCar1',
  'obstacleCone',
  'obstacleCar2',
  'obstacleBox',
];

export const AUDIO = {
  // Shared cross-game SFX, referenced by URL exactly like the other games do.
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1791028437/game13bgmusic_ndzjd5.mp4',
  wrong: '/PhaserAssets/wrong.wav',
  // The shared pop_fx bank — used for pick-up/snap/celebrate feedback.
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',
  pop2: '/PhaserAssets/pop_fx/pop-2.mp3',
  pop3: '/PhaserAssets/pop_fx/pop-3.mp3',

  // Game 13's own driving SFX. These are Cloudinary VIDEO uploads served as mp3;
  // each is listed in AUDIO_TYPE_OVERRIDES below so Phaser queues them as mp3
  // (see the note there). The engine loops for the whole run; the skids play on
  // a lane change; the honk sounds just before an obstacle appears.
  engine: 'https://res.cloudinary.com/hijmipga/video/upload/v1790855817/carEngine_mjdu2m.mp3',
  skid1: 'https://res.cloudinary.com/hijmipga/video/upload/v1790855817/skid1_fsicno.mp3',
  skid2: 'https://res.cloudinary.com/hijmipga/video/upload/v1790855817/skid2_v0wioo.mp3',
  honk: 'https://res.cloudinary.com/hijmipga/video/upload/v1790856125/honk_ljlfla.mp3',
  sayLeft: 'https://res.cloudinary.com/hijmipga/video/upload/v1790856421/left_uh86bk.mp3',
  sayRight: 'https://res.cloudinary.com/hijmipga/video/upload/v1790856421/right_uh3vtr.mp3',
  crash: 'https://res.cloudinary.com/hijmipga/video/upload/v1790860564/car_crash_thyqlp.mp3',

  // Start screen voice line — plays once the game is ready and is cut off the
  // moment Start is tapped (see GameScene.buildStartOverlay / beginPlay).
  startVoice: 'https://res.cloudinary.com/hijmipga/video/upload/v1791371575/startvoicegame13_gf5ctf.mp3',
};

// Phaser's audio loader picks a codec/extension to trust from the URL itself,
// and some hosts (Cloudinary video URLs, e.g.) end in an extension it does not
// recognise as audio — with a bare URL string it can then silently skip queuing
// the file. Add any such clip here so it is forced to a real audio type.
const AUDIO_TYPE_OVERRIDES = {
  engine: 'mp3',
  skid1: 'mp3',
  skid2: 'mp3',
  honk: 'mp3',
  sayLeft: 'mp3',
  sayRight: 'mp3',
  crash: 'mp3',
  startVoice: 'mp3',
  bgMusic: 'mp3', 
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
export const ASSET_MANIFEST = [
  ...Object.entries(IMAGES)
    .filter(([, url]) => url) // skip placeholders you haven't filled in yet
    .map(([key, url]) => ({ type: 'image', key, url })),
  ...Object.entries(AUDIO)
    .filter(([, url]) => url)
    .map(([key, url]) => {
      const overrideType = AUDIO_TYPE_OVERRIDES[key];
      return {
        type: 'audio',
        key,
        url: overrideType ? [{ type: overrideType, url }] : url,
      };
    }),
];
