// assets.js
// Game 14 — the single place this game's asset URLs live.
//
// ASSET_MANIFEST is DERIVED from IMAGES/AUDIO, so adding a file is one line in
// the table below and every loader path picks it up automatically. Keys must be
// FLAT: the manifest builder maps each value straight to a URL, so a nested
// object would be handed to Phaser as a bogus URL — hence the riders are listed
// as flat `rider*` keys with a separate RIDER_KEYS array rather than nested.

// Cloudinary assets are served through `f_auto,q_auto` so the browser gets the
// smallest format it supports. Wrap a URL with this when you fill the table in.
export const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

export const IMAGES = {
  // A single train cart. The scene lays five of these back to back to build the
  // train (see GameScene.js) and scales them so three fill the screen width.
  cartLid: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791804824/cartLid_bwlvj0.png'),
  cartBody: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791804824/cartBody_wkunvi.png'),
  // The ENDING cart's body — always the LAST cart in the consist. It uses the
  // same lid and the same rider mechanism; only this body image differs.
  cartBodyEnd: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791889829/cartBodyEnd_kvpvhx.png'),
  trainHead: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791809704/trainHead_ystorb.png'),

  // Full-screen countryside backdrop, drawn cover-scaled behind everything.
  background: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1791901907/Sunny_Storybook_Countryside_Railway_1_ansuhg.png'
  ),

  // Riders — the animals the player drags onto each cart.
  riderTurtle: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816238/Rider-Turtle_rpkqmc.png'),
  riderCat: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816238/Rider-Cat_oikzrm.png'),
  riderBunny: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816237/Rider-Bunny_hxvowt.png'),
  riderPenguin: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816237/Rider-Penguin_epi7zg.png'),
  riderDog: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816237/Rider-Dog_qnj8lq.png'),
};

// The rider pool, in the order they appear in the tray. Texture keys must match
// the flat IMAGES entries above.
export const RIDER_KEYS = [
  'riderTurtle',
  'riderCat',
  'riderBunny',
  'riderPenguin',
  'riderDog',
];

export const AUDIO = {
  // Background music (shared across games). Loaded + looped by ensureBgMusic()
  // in the scene.
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1790786420/game12bg_vhxokd.mp4',

  // Shared cross-game SFX live under /PhaserAssets/ and can be referenced by
  // URL exactly like the other games do.
  wrong: '/PhaserAssets/wrong.wav',
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',

  // The looping train-running bed. Its playback rate + volume track the train's
  // speed in GameScene (see TRAIN_SOUND in tuning.js).
  trainRunning:
    'https://res.cloudinary.com/hijmipga/video/upload/v1791811411/train_running__1-1791811325786_quxtes.mp3',
};

// Phaser picks a codec/extension from the URL itself; some hosts (Cloudinary
// video uploads) end in an extension it does not recognise as audio and the
// file is then silently skipped. Force a real audio type for any such clip.
const AUDIO_TYPE_OVERRIDES = {
  // A Cloudinary VIDEO upload ends in .mp3 but Phaser would not trust that
  // extension on its own — force the type so it is actually queued.
  trainRunning: 'mp3',
  // bgMusic is an audio-only Cloudinary .mp4 — not in Phaser's recognised-audio
  // extension list, so without this it silently fails to queue and never plays.
  bgMusic: 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
export const ASSET_MANIFEST = [
  ...Object.entries(IMAGES)
    .filter(([, url]) => url) // skip placeholders not filled in yet
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
