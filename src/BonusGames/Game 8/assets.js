// assets.js
// Asset manifest for Game 8. Fill in IMAGES / AUDIO once the design is
// finalized (see instructions.md) — keep the same shape as Game 7's
// assets.js so GameScene.js / LevelSelectScene.js can import keys by name.
//
// If the game speaks numbers 1-10, also import NUMBERS_VOICE_MANIFEST from
// '../../Phaser/common/numbersVoice' and spread it into ASSET_MANIFEST below
// (see Game 7's assets.js for the exact pattern).

import { NUMBERS_VOICE_MANIFEST } from '../../Phaser/common/numbersVoice';

export const IMAGES = {
  'chefEka': 'https://res.cloudinary.com/hijmipga/image/upload/v1786959144/Chef-Eka_tx3fuh.png', //original image size 329x705
  'chefZee': 'https://res.cloudinary.com/hijmipga/image/upload/v1786959144/Chef-Zee_yfoyfz.png', //original image size 300x694, flip this in Phaser to face the other direction
  'chefEkaCelebrating': 'https://res.cloudinary.com/hijmipga/image/upload/v1786959145/Chef-Eka-celebrating_irj506.png', //original image size 446x703
  'chefZeeCelebrating': 'https://res.cloudinary.com/hijmipga/image/upload/v1786959145/Chef-Zee-celebrating_mztdl0.png', //original image size 433x710, flip this in Phaser to face the other direction
  'gameBackground': 'https://res.cloudinary.com/hijmipga/image/upload/v1786959145/background_sjh40j.jpg', //original image size 848x1264
  'emptyPizza': 'https://res.cloudinary.com/hijmipga/image/upload/v1786959145/Empty-Pizza_qzieir.png', // original image size 680x680
  'container-pepperoni':'https://res.cloudinary.com/hijmipga/image/upload/v1786966208/container-pepperoni_x8cxx4.png', // original image size 540x614
  'container-tomatoes':'https://res.cloudinary.com/hijmipga/image/upload/v1786966208/container-tomatoes_v9ks2w.png', // original image size 540x614
  'container-olives':'https://res.cloudinary.com/hijmipga/image/upload/v1786966208/container-olives_pogdly.png', // original image size 540x614
  'container-mushrooms':'https://res.cloudinary.com/hijmipga/image/upload/v1786966208/container-mushrooms_msebs3.png', // original image size 540x614
  'container-bellPepper':'https://res.cloudinary.com/hijmipga/image/upload/v1786966208/container-bellpepper_hyp5cc.png', // original image size 540x614
    'pepperoni':'https://res.cloudinary.com/hijmipga/image/upload/v1786966207/pepperoni_dmy911.png', // original image size 307x307
    'tomato':'https://res.cloudinary.com/hijmipga/image/upload/v1786966209/tomato_ddxlni.png', // original image size 307x307
    'olives':'https://res.cloudinary.com/hijmipga/image/upload/v1786966207/olives_y9oxmb.png', // original image size 307x307
    'mushrooms':'https://res.cloudinary.com/hijmipga/image/upload/v1786966207/mushrooms_s3w6pb.png', // original image size 307x307
    'bellPepper':'https://res.cloudinary.com/hijmipga/image/upload/v1786966208/bell-pepper_mxte2f.png', // original image size 307x307
    'deliver-button': 'https://res.cloudinary.com/hijmipga/image/upload/v1786973869/deliver-button_aj6f9d.png', // original image size 808x409
};

export const AUDIO = {
  'bgMusic': 'https://res.cloudinary.com/hijmipga/video/upload/v1786963247/bgMusic_jqvugi.mp4',
  'grab-fx':'https://res.cloudinary.com/hijmipga/video/upload/v1786969011/grab-fx_fe9mvy.mp3',
  'paste-fx':'https://res.cloudinary.com/hijmipga/video/upload/v1786969011/paste-fx_dhth1q.mp4',

  // below are voice lines
   'vo-1':'https://res.cloudinary.com/hijmipga/video/upload/v1786969949/Help_the_Chefs_complete_the_pizza_by_adding_toppings_etjapw.mp3', // Help the Chefs complete the pizza by adding toppings
   'vo-2':'https://res.cloudinary.com/hijmipga/video/upload/v1786969948/chef_Eka_wants_c1dpcp.mp3', // chef Eka wants
    'vo-3':'https://res.cloudinary.com/hijmipga/video/upload/v1786969948/chef_Zee_wants_hqxi4e.mp3', // chef Zee wants
    'vo-4':'https://res.cloudinary.com/hijmipga/video/upload/v1786969948/chef_Eka_has_put_llrzqe.mp3', // chef Eka has put
    'vo-5':'https://res.cloudinary.com/hijmipga/video/upload/v1786972996/the_order_needs_hjqlcd.mp3', // The order needs [this will on the level 2]
    'vo-6':'https://res.cloudinary.com/hijmipga/video/upload/v1786969948/Help_chef_Zee_put_the_remaining_toppings_pavrnh.mp3', // Help chef Zee put the remaining toppings
    'vo-7':'https://res.cloudinary.com/hijmipga/video/upload/v1786972996/what_is_the_missing_number_mckrba.mp3', // What is the missing number? [this will be when the number bond phase starts]

    // Feedback — correct / try again
    'vo-correct':'https://res.cloudinary.com/hijmipga/video/upload/v1785410887/vo-correct-2_ytcsm1.mp3', // "Yay! You did it!"
    'vo-try-again':'https://res.cloudinary.com/hijmipga/video/upload/v1785410886/vo-try-again-1_qvkrhx.mp3', // "Not quite! Try again."
};

// Phaser's audio loader picks a codec/extension to trust from the URL
// itself, and '.mp4' isn't in its default recognized-audio-extension list
// the way '.mp3'/'.m4a'/'.ogg' are — with a bare URL string it can
// silently skip queuing the file. Override the type explicitly for any
// mp4-hosted clip so Phaser trusts it as mp3-compatible.
const AUDIO_TYPE_OVERRIDES = {
  bgMusic: 'mp3',
  'paste-fx': 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
export const ASSET_MANIFEST = [
  ...Object.entries(IMAGES).map(([key, url]) => ({ type: 'image', key, url })),
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
