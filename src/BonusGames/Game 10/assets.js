// assets.js
// Asset manifest for Game 10 ("Feed the Shapes"). Every image and voice
// clip below is linked; levels.js / GameScene.js reference keys by name.
//
// Note on the round-4 voice clip: rounds 1-4 name the shape, and "VA-I want
// circle" is the round-4 clip. It is wired below — if it is ever missing from
// the manifest, playSound() no-ops rather than substituting the Level 2
// property clip ("shape that is round with no corners"), which would leak the
// Level 2 phrasing into Level 1.

import { MONSTER_IMAGE_URLS } from './monster';

export const IMAGES = {
  'background': 'https://res.cloudinary.com/hijmipga/image/upload/v1789297946/background_2_odlkx2.png', // 2:3 portrait scene backdrop (wood grain + the four foods in the corners) — cover-fit full-screen, not a sprite
  'cookie-circle': 'https://res.cloudinary.com/hijmipga/image/upload/v1789297282/cookie_hjnlx5.png',// original size 250x250
  'pizza-triangle': 'https://res.cloudinary.com/hijmipga/image/upload/v1789297278/pizza_zt7peq.png',// original size 250x225
  'cracker-square': 'https://res.cloudinary.com/hijmipga/image/upload/v1789297278/cracker_eah9fl.png',// original size 250x250
  'juicebox-rectangle': 'https://res.cloudinary.com/hijmipga/image/upload/v1789297278/juicebox_s9r1fb.png',// original size 150x250

  // Monster parts are declared in monster.js next to the code that assembles
  // and poses them, then merged in here so there's still one manifest.
  ...MONSTER_IMAGE_URLS,
};

export const AUDIO = {
  'bgMusic': 'https://res.cloudinary.com/hijmipga/video/upload/v1789298424/background_music_qrfjpf.mp4',
  'throw-whoosh3': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297282/throw_whoosh_3_jhdmhz.wav',
  'throw-whoosh2': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297281/throw_whoosh_2_ccf2mv.wav',
  'throw-whoosh1': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297280/throw_whoosh_1_tthfvc.wav',
  'eating_sound': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297278/eating_sound_kpxszi.wav',
  // Shared cross-game SFX, referenced by URL exactly like BonusGame1 does.
  'wrong': '/PhaserAssets/wrong.wav',
  'VA-I want shape that has 4 corners and 4 equal sides': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297279/I_want_shape_that_has_4_corners_and_4_equal_sides_evltbs.mp3',
  'VA-I want triangle': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297279/I_want_triangle_pakodn.mp3',
  'VA-I want square': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297279/I_want_square_l5s2mm.mp3',
  'VA-I want shape with 3 sides': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297279/I_want_shape_with_3_sides_yvp8tu.mp3',
  'VA-I want rectangle': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297278/I_want_rectangle_k5ntgo.mp3',
  'VA-I want circle': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297277/I_want_circle_bgabrm.mp3',
  'VA-I want shape that is round with no corners': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297278/I_want_shape_that_is_round_with_no_corners_ch5oim.mp3',
  'VA-I want shape that has 4 equal sides': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297278/I_want_shape_that_has_4_equal_sides_pb5eux.mp3',
  'VA-I want shape that has 3 corners': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297277/I_want_shape_that_has_3_corners_pp5atv.mp3',
  'VA-I want shape that has 2 long sides and 2 short sides': 'https://res.cloudinary.com/hijmipga/video/upload/v1789297277/I_want_shape_that_has_2_long_sides_and_2_short_sides_sgg3zj.mp3',
};

// Phaser's audio loader picks a codec/extension to trust from the URL itself,
// and '.mp4' isn't in its default recognized-audio-extension list the way
// '.mp3'/'.m4a'/'.ogg' are — with a bare URL string it can silently skip
// queuing the file. Override the type explicitly for any mp4-hosted clip.
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
