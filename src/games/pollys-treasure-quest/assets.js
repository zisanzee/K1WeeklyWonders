// assets.js
// Asset manifest for Game 9 ("Polly's Treasure Quest"). Every image and
// voice clip below is already linked; GameScene.js / levels.js import keys
// by name from here.
//
// This game never speaks numbers aloud — key numbers are baked into the key
// art and chest numbers are text overlays — so NUMBERS_VOICE_MANIFEST is
// deliberately NOT spread in (unlike Game 7/8, which do read numbers).

export const IMAGES = {
  'keyFirstHalf-1': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830268/firstHalf1_venbtq.png', // original size 300x250
  'keyFirstHalf-2': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830269/firstHalf2_mbifhx.png', // original size 300x250
  'keyFirstHalf-3': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830260/firstHalf3_snaplq.png', // original size 300x250
  'keyFirstHalf-4': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830260/firstHalf4_vcxqzb.png', // original size 300x250
  'keyFirstHalf-5': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/firstHalf5_pfrask.png', // original size 300x250
  'keyFirstHalf-6': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/firstHalf6_acknxe.png', // original size 300x250
  'keyFirstHalf-7': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830260/firstHalf7_eeynjy.png', // original size 300x250
  'keyFirstHalf-8': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/firstHalf8_cy5ybk.png', // original size 300x250
  'keyFirstHalf-9': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830260/firstHalf9_pun556.png', // original size 300x250
  'keySecondHalf-1': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830265/secondHalf1_bl4rib.png', // original size 300x250
  'keySecondHalf-2': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830265/secondHalf2_cdrm2a.png', // original size 300x250
  'keySecondHalf-3': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830265/secondHalf3_tx5udi.png', // original size 300x250
  'keySecondHalf-4': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830265/secondHalf4_h8coqb.png', // original size 300x250
  'keySecondHalf-5': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830265/secondHalf5_rxndze.png', // original size 300x250
  'keySecondHalf-6': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830265/secondHalf6_otyiho.png', // original size 300x250
  'keySecondHalf-7': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830266/secondHalf7_iflhr1.png', // original size 300x250
  'keySecondHalf-8': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830266/secondHalf8_wtgxrg.png', // original size 300x250
  'keySecondHalf-9': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830268/secondHalf9_gw2g0h.png', // original size 300x250
  'pearl1':'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/Pearl1_xwxyxl.png', // original size 200x80
  'pearl2':'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/Pearl2_bwhorg.png', // original size 200x80
  'pearl3':'https://res.cloudinary.com/hijmipga/image/upload/v1787830260/Pearl3_jslndc.png', // original size 200x80
  'pearl4':'https://res.cloudinary.com/hijmipga/image/upload/v1787830260/Pearl4_ih7x3h.png', // original size 200x80
  'pearl5':'https://res.cloudinary.com/hijmipga/image/upload/v1787830262/Pearl5_mdwvpg.png', // original size 200x80
  'pearl6':'https://res.cloudinary.com/hijmipga/image/upload/v1787830262/Pearl6_qj5xpt.png', // original size 200x80
  'pearl7':'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/Pearl7_my6a5d.png', // original size 200x80
  'pearl8':'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/Pearl8_ifwxtu.png', // original size 200x80
  'pearl9':'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/Pearl9_ujypzt.png', // original size 200x80
  'pearl10':'https://res.cloudinary.com/hijmipga/image/upload/v1787830262/Pearl10_uurw2m.png', // original size 200x80
  'feather':'https://res.cloudinary.com/hijmipga/image/upload/v1787833589/feather_evirhe.png', // original size 360x360


  'Hint':'https://res.cloudinary.com/hijmipga/image/upload/v1787905537/hint_qlddfb.png', // original size 585x329
  'Hint-button':'https://res.cloudinary.com/hijmipga/image/upload/v1787905537/hint-button_hiifez.png', // original size 538x358
  'Level-1-start':'https://res.cloudinary.com/hijmipga/image/upload/v1787904962/level-1-start_yabmjh.png', // original size 1024x1535
  'Level-2-start':'https://res.cloudinary.com/hijmipga/image/upload/v1787906574/level-2-start_hsrlxr.png', // original size 1023x1535
  'chest-locked': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830268/chestLocked_jsthgk.png', // original size 360x350 [add the appropriate number on it]
  'chest-unlocked': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830268/chestOpen_rv69bf.png', // original size 360x350 [add the appropriate number on it]
  'background': 'https://res.cloudinary.com/hijmipga/image/upload/v1787830261/game9bg_u0kvdp.png', // original size 614x922
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
