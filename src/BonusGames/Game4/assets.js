// assets.js
// Static asset manifest for the Compare Dice/Domino game, transcribed from
// the Assets.json handed off for this game. Kept as a real JS module
// (rather than importing the JSON directly) so it can export both the raw
// key->url maps (handy for anything that wants a URL by name) and the
// flattened ASSET_MANIFEST array BasePreloadScene expects.
//
// Note: Assets.json's `ui.panel`, `ui.correctGlow`, `ui.wrongGlow` and both
// `particles` entries were empty strings — those are intentionally left
// out here. Correct/wrong feedback and level-complete celebration are done
// with code-drawn shapes/tweens in CompareDiceScene.js instead. If real
// assets for those show up later, add them here and swap the relevant
// code-drawn bits.

export const IMAGES = {
  background: 'https://res.cloudinary.com/hijmipga/image/upload/v1784991636/bg_iwwnnb.png',
  dice: {
    1: 'https://res.cloudinary.com/hijmipga/image/upload/v1784989338/Dice-1_eebwrt.png',
    2: 'https://res.cloudinary.com/hijmipga/image/upload/v1784989339/Dice-2_nh0zyq.png',
    3: 'https://res.cloudinary.com/hijmipga/image/upload/v1784989339/Dice-3_spuyyo.png',
    4: 'https://res.cloudinary.com/hijmipga/image/upload/v1784989339/Dice-4_qic139.png',
    5: 'https://res.cloudinary.com/hijmipga/image/upload/v1784989339/Dice-5_lpxqwl.png',
  },
  domino: {
    2: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990894/Domino-2_grgttw.png',
    3: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990895/Domino-3_ukk34y.png',
    4: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990896/Domino-4_zgk3mp.png',
    5: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990897/Domino-5_jw15he.png',
    6: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990898/Domino-6_gypwcb.png',
    7: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990899/Domino-7_u1s3v2.png',
    8: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990900/Domino-8_pss7yr.png',
    9: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990901/Domino-9_mpvtzh.png',
    10: 'https://res.cloudinary.com/hijmipga/image/upload/v1784990903/Domino-10_nzrkkh.png',
  },
  rollDiceButton: 'https://res.cloudinary.com/hijmipga/image/upload/v1784989547/Roll-button-1_zsms4g.png',
  rollDominoButton: 'https://res.cloudinary.com/hijmipga/image/upload/v1784991202/Roll-button-2_s8a1ch.png',
};

export const AUDIO = {
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1784991848/bgMusic_uxk0fy.mp4',
  rollVoice: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992857/roll_fzmhog.mp3',
  correctVoice: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992855/correct_qbtbkr.mp3',
  wrongVoice: 'https://res.cloudinary.com/hijmipga/video/upload/v1785085334/wrong_irekpp.mp3',
  introBiggerDice: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992850/biggerDice_oft3hg.mp3',
  introSmallerDice: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992848/smallerDice_ukxt9s.mp3',
  introBiggerDomino: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992852/biggerDomino_kcltnq.mp3',
  introSmallerDomino: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992847/smallerDomino_qh4qn3.mp3',
  winGoodJob: 'https://res.cloudinary.com/hijmipga/video/upload/v1784992846/goodJob_ltpu6t.mp3',
};

// Phaser's audio loader picks a codec/extension to trust from the URL
// itself, and '.mp4' isn't in its default recognized-audio-extension list
// the way '.mp3'/'.m4a'/'.ogg' are — with a bare URL string, it can
// silently skip queuing the file entirely (no error, it just never loads,
// which is why bgMusic never played). Overriding the type explicitly like
// this forces Phaser to trust it as mp3-compatible regardless of the
// URL's actual extension.
const AUDIO_TYPE_OVERRIDES = { bgMusic: 'mp3' };

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
export const ASSET_MANIFEST = [
  { type: 'image', key: 'background', url: IMAGES.background },
  ...Object.entries(IMAGES.dice).map(([value, url]) => ({ type: 'image', key: `dice${value}`, url })),
  ...Object.entries(IMAGES.domino).map(([value, url]) => ({ type: 'image', key: `domino${value}`, url })),
  { type: 'image', key: 'rollDiceButton', url: IMAGES.rollDiceButton },
  { type: 'image', key: 'rollDominoButton', url: IMAGES.rollDominoButton },
  ...Object.entries(AUDIO).map(([key, url]) => {
    const overrideType = AUDIO_TYPE_OVERRIDES[key];
    return {
      type: 'audio',
      key,
      url: overrideType ? [{ type: overrideType, url }] : url,
    };
  }),
];
