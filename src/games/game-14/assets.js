// assets.js
// Choo-Choo to the Zoo! — the single place this game's asset URLs live.
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
  cartLidRed: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791804824/cartLid_bwlvj0.png'),
  cartBodyRed: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791804824/cartBody_wkunvi.png'),
  // The ENDING cart's body — always the LAST cart in the consist. It uses the
  // same lid and the same rider mechanism; only this body image differs.
  cartBodyEndRed: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791889829/cartBodyEnd_kvpvhx.png'),



  cartLidBlue: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984744/cartLid-Blue_nlsgsw.png'),
  cartBodyBlue: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984744/cartBody-Blue_xodhbz.png'),
  // The ENDING cart's body — always the LAST cart in the consist. It uses the
  // same lid and the same rider mechanism; only this body image differs.
  cartBodyEndBlue: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984744/cartBodyEnd-Blue_kcydcc.png'),



  cartLidGreen: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984744/cartLid-Green_bxm0hh.png'),
  cartBodyGreen: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984743/cartBody-Green_lto98j.png'),
  // The ENDING cart's body — always the LAST cart in the consist. It uses the
  // same lid and the same rider mechanism; only this body image differs.
  cartBodyEndGreen: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984743/cartBodyEnd-Green_k2xkfd.png'),









  trainHead: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791809704/trainHead_ystorb.png'),

  // Full-screen countryside backdrop, drawn cover-scaled behind everything.
  background1: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1791901907/Sunny_Storybook_Countryside_Railway_1_ansuhg.png'
  ),
  background2: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1791983508/Whimsical_Autumn_Railway_Station_ak41ga.png'
  ),
  background3: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1791983508/Moonlit_Village_by_the_Tracks_1_yvbsso.png'
  ),

  // The task card frame at the bottom (the animal + spelled position sit on it).
  cardFrame: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791988459/Card-Frame_1_k9kzkg.png'),

  // Fullscreen title / start screen.
  startScreen: cld('https://res.cloudinary.com/hijmipga/image/upload/v1792076551/startscreengame14_x8jsto.png'),

  // The drive arrow button. This art points RIGHT; the left button is the same
  // image flipped horizontally (see GameScene.makeDriveButton).
  arrowButton: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791991315/right-arrow-button_1_zeukod.png'),

  // The small "hear it again" sound button beside the task card.
  soundButton: cld('https://res.cloudinary.com/hijmipga/image/upload/v1792078506/sound_button_eklvja.png'),

  // Riders — the animals the player drags onto each cart.
  riderTurtle: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816238/Rider-Turtle_rpkqmc.png'),
  riderCat: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816238/Rider-Cat_oikzrm.png'),
  riderBunny: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816237/Rider-Bunny_hxvowt.png'),
  riderPenguin: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816237/Rider-Penguin_epi7zg.png'),
  riderDog: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791816237/Rider-Dog_qnj8lq.png'),
  riderElephant: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984263/Rider-Elephant_o14t3u.png'),
  riderFox: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984263/Rider-Fox_t6qtkd.png'),
  riderFrog: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984263/Rider-Frog_txkf0e.png'),
  riderGiraffe: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984263/Rider-Girrafe_gboxvq.png'),
  riderPanda: cld('https://res.cloudinary.com/hijmipga/image/upload/v1791984263/Rider-Panda_ssmziw.png'),
};

// The rider pool, in the order they appear in the tray. Texture keys must match
// the flat IMAGES entries above.
export const RIDER_KEYS = [
  'riderTurtle',
  'riderCat',
  'riderBunny',
  'riderPenguin',
  'riderDog',
  'riderElephant',
  'riderFox',
  'riderFrog',
  'riderGiraffe',
  'riderPanda',
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

  StartscreenVoice: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076589/startVOICE_2_v6kfaw.mp3',
  first: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076589/First_sjh18i.mp3',
  second: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076588/second_efct7q.mp3',
  third: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076588/third_vlsids.mp3',
  fourth: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076588/fourth_rurkqi.mp3',
  fifth: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076587/fifth_nncnhj.mp3',
  sixth: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076587/sixth_spk0fn.mp3',
  seventh: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076587/seventh_xcwp7r.mp3',
  eighth: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076587/eighth_nmsb0j.mp3',
  ninth: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076587/ninth_um85ak.mp3',
  tenth: 'https://res.cloudinary.com/hijmipga/video/upload/v1792076586/tenth_yppdlo.mp3',


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
  // The voice lines are all Cloudinary VIDEO uploads too — force mp3.
  StartscreenVoice: 'mp3',
  first: 'mp3',
  second: 'mp3',
  third: 'mp3',
  fourth: 'mp3',
  fifth: 'mp3',
  sixth: 'mp3',
  seventh: 'mp3',
  eighth: 'mp3',
  ninth: 'mp3',
  tenth: 'mp3',
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
