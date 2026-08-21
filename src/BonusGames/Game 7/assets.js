// assets.js
// Asset manifest for Game 7 (Number Bonds). Drop your recorded voice line
// URLs into the AUDIO map below — the keys already match what GameScene.js
// expects. Replace image URLs too if the art changes.

import { NUMBERS_VOICE_MANIFEST } from '../../Phaser/common/numbersVoice';

export const IMAGES = {
  'blue-nest': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408189/blue_nest_mnhmsb.png',
  'background': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408189/background_perkoj.png',
  'robin': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408189/robin_n2faje.png',
  'robin-happy': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408189/robin-happy_unfdf1.png',
  'owl': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408189/owl_ai12ro.png',
  'owl-happy': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408188/owl-happy_b9hy6b.png',
  'egg-basket': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408188/basket_kteadm.png',
  'yellow-nest': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408188/yellow_nest_nd006e.png',
  'egg': 'https://res.cloudinary.com/hijmipga/image/upload/v1785408554/egg_yynq0q.png',
  'gameStart': 'https://res.cloudinary.com/hijmipga/image/upload/v1787309122/gameStart_n4kqmp.png',
};

export const AUDIO = {
  // Background music
  'bgMusic': 'https://res.cloudinary.com/hijmipga/video/upload/v1785408873/bgMusicG7_xsnvum.mp4',

  // Round setup
  'vo-welcome': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-welcome_e9muvj.mp3', // "Let's help Mama Bird organize the eggs!"
  'vo-this-family-has': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410888/vo-this-family-has_pifata.mp3', // "This family has..." (plays right before the number)
  'vo-eggs-altogether': 'https://res.cloudinary.com/hijmipga/video/upload/v1785418644/vo-eggs-altogether_gtctnf.mp3', // "...eggs altogether!" (plays right after the number)
  'vo-split-instruction': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410887/vo-split-instruction_dqwm90.mp3', // "Put the eggs in the two nests to make that many."
  'vo-fill-instruction': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410888/vo-fill-instruction_xbln6k.mp3', // "The blue nest already has some. Add the rest to the yellow nest."

  // Feedback — correct (picked at random)
  'vo-correct-1': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410887/vo-correct-1_u0i6ck.mp3', // "Correct! Great job!"
  'vo-correct-2': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410887/vo-correct-2_ytcsm1.mp3', // "Yay! You did it!"
  'vo-correct-3': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-correct-3_ccc57h.mp3', // "Perfect! Well done!"

  // Feedback — incorrect (picked at random)
  'vo-try-again-1': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-try-again-1_qvkrhx.mp3', // "Not quite! Try again."
  'vo-try-again-2': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-try-again-2_ksvjp2.mp3', // "Oops, let's count again."
  'vo-try-again-3': 'https://res.cloudinary.com/hijmipga/video/upload/v1785418825/vo-try-again-3_belq3r.mp3', // "Both nests need at least 1"

  // Level / game completion
  'vo-level-complete': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-level-complete_tefmmb.mp3', // "Amazing! You finished the level!"
  'vo-game-complete': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-game-complete_sogg07.mp3', // "Wow! You're a number bond superstar!"

  // Hint button
  'vo-hint': 'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-hint_o00v0v.mp3', // "Let's count how many eggs are in the nests already."
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
  { type: 'image', key: 'blue-nest', url: IMAGES['blue-nest'] },
  { type: 'image', key: 'yellow-nest', url: IMAGES['yellow-nest'] },
  { type: 'image', key: 'robin', url: IMAGES.robin },
  { type: 'image', key: 'robin-happy', url: IMAGES['robin-happy'] },
  { type: 'image', key: 'owl', url: IMAGES.owl },
  { type: 'image', key: 'owl-happy', url: IMAGES['owl-happy'] },
  { type: 'image', key: 'egg-basket', url: IMAGES['egg-basket'] },
  { type: 'image', key: 'egg', url: IMAGES.egg },
  { type: 'image', key: 'gameStart', url: IMAGES.gameStart },
  ...Object.entries(AUDIO)
    .filter(([, url]) => url) // skip any voice line you haven't recorded/linked yet
    .map(([key, url]) => {
      const overrideType = AUDIO_TYPE_OVERRIDES[key];
      return {
        type: 'audio',
        key,
        url: overrideType ? [{ type: overrideType, url }] : url,
      };
    }),
  ...NUMBERS_VOICE_MANIFEST,
];