// assets.js
// Asset manifest for Game 9 ("Polly's Treasure Quest"). Every image and
// voice clip below is already linked; GameScene.js / levels.js import keys
// by name from here.
//
// This game never speaks numbers aloud — key numbers are baked into the key
// art and chest numbers are text overlays — so NUMBERS_VOICE_MANIFEST is
// deliberately NOT spread in (unlike Game 7/8, which do read numbers).

export const IMAGES = {
  'keyFirstHalf-1': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144581/firstHalf1_pqr5o3.png', // original size 300x250
  'keyFirstHalf-2': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144582/firstHalf2_piy1jl.png', // original size 300x250
  'keyFirstHalf-3': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144581/firstHalf3_vzhwqg.png', // original size 300x250
  'keyFirstHalf-4': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144581/firstHalf4_jehsiw.png', // original size 300x250
  'keyFirstHalf-5': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144581/firstHalf5_g5djvm.png', // original size 300x250
  'keyFirstHalf-6': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144582/firstHalf6_aqi1sh.png', // original size 300x250
  'keyFirstHalf-7': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144582/firstHalf7_fon5v1.png', // original size 300x250
  'keyFirstHalf-8': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144582/firstHalf8_ycs6bs.png', // original size 300x250
  'keyFirstHalf-9': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144582/firstHalf9_urnssn.png', // original size 300x250
  'keySecondHalf-1': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144582/secondHalf1_u0rgzy.png', // original size 300x250
  'keySecondHalf-2': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144583/secondHalf2_dgcccz.png', // original size 300x250
  'keySecondHalf-3': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144583/secondHalf3_hwbmpv.png', // original size 300x250
  'keySecondHalf-4': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144583/secondHalf4_r5tevu.png', // original size 300x250
  'keySecondHalf-5': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144583/secondHalf5_qpdxkr.png', // original size 300x250
  'keySecondHalf-6': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144583/secondHalf6_u1us4c.png', // original size 300x250
  'keySecondHalf-7': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144584/secondHalf7_eduhri.png', // original size 300x250
  'keySecondHalf-8': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144585/secondHalf8_fszuvf.png', // original size 300x250
  'keySecondHalf-9': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144585/secondHalf9_m3rx7c.png', // original size 300x250
  'chest-locked': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144581/chestLocked_g3wcyg.png', // original size 350x310 [add the appropriate number on it]
  'chest-unlocked': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144581/chestOpen_ddrxqs.png', // original size 350x310 [add the appropriate number on it]
  'background': 'https://res.cloudinary.com/hijmipga/image/upload/v1787144583/game9bg_ciju8l.png', // original size 614x922
  'Polly': 'https://res.cloudinary.com/hijmipga/image/upload/v1787151620/polly_fhxtn9.png', // original size 500x600 [character that asks questions — Polly the pirate parrot]
  'PollyHappy': 'https://res.cloudinary.com/hijmipga/image/upload/v1787151621/pollyHappy_peifqb.png', // original size 500x600
};

export const AUDIO = {
  ahoyKey: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349845/Ahoy_choose_the_key_that_this_chest_needs_ulbett.mp3',
  ahoyChest: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349844/Ahoy_These_two_keys_go_in_the_same_chest_Which_chest_holds_them_both_l7qn7u.mp3',
  treasureFound: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349843/Treasure_found_poehnq.mp3',
  correct: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349844/Correct_krypie.mp3',
  wrongKey: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349843/Not_quite_try_another_key_bdeqwg.mp3',
  wrongChest: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349843/Not_quite_try_another_chest_u2rxjd.mp3',
  treasureHunter: 'https://res.cloudinary.com/hijmipga/video/upload/v1785349842/ye_be_a_true_treasure_hunter_eaqwzi.mp3',
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1785408873/bgMusicG7_xsnvum.mp4',
  chestOpening: 'https://res.cloudinary.com/hijmipga/video/upload/v1787146580/chestOpening_mcrgpw.mp3',
};

// Phaser's audio loader picks a codec/extension to trust from the URL
// itself, and '.mp4' isn't in its default recognized-audio-extension list
// the way '.mp3'/'.m4a'/'.ogg' are — with a bare URL string it can
// silently skip queuing the file. Override the type explicitly for any
// mp4-hosted clip so Phaser trusts it as mp3-compatible.
const AUDIO_TYPE_OVERRIDES = {
  bgMusic: 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
export const ASSET_MANIFEST = [
  ...Object.entries(IMAGES).map(([key, url]) => ({ type: 'image', key, url })),
  ...Object.entries(AUDIO)
    .filter(([, url]) => url) // skip any clip you haven't recorded/linked yet
    .map(([key, url]) => {
      const overrideType = AUDIO_TYPE_OVERRIDES[key];
      return {
        type: 'audio',
        key,
        url: overrideType ? [{ type: overrideType, url }] : url,
      };
    }),
];
