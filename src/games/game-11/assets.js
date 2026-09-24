// assets.js
// Game 11 — portrait puzzle.
//
// Every portrait is assembled from a handful of independent PNGs (a base plus
// overlays). The URLs live here ONLY; where each part sits on the canvas is in
// portraitPositions.js and the layer order is in portraits.js. Keep those three
// files in step: a part that is positioned but not listed here never loads, and
// a part that is loaded but not positioned never draws.

// Part keys are `p<portrait><variant><part>` so they are globally unique inside
// Phaser's texture manager (texture keys are global, not per-scene).
//
//   portrait index (1-9)   variant (1-4)   part (1-3)
//
// Portrait 4 (boat) and 7 (rocket) have four frames; every other portrait has
// three.
export const IMAGES = {
  // 1 — boat
  p111: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191510/boat1_sk5buu.png',
  p112: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191508/boat2_pulypg.png',
  p113: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191507/boat3_wqhgas.png',
  p121: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191506/boat4_jkpuqs.png',

  // 2 — butterfly
  p211: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191505/butterfly1_d0jtby.png',
  p212: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191504/butterfly2_fjxphj.png',
  p213: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191503/butterfly3_aaxgkv.png',
  p221: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191503/butterfly4_nnwbdh.png',

  // 3 — flower
  p311: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191487/flower1_xfo3ma.png',
  p312: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191487/flower2_hmi5aa.png',
  p313: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191487/flower3_v5sj19.png',
  p321: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191489/flower4_o1m5di.png',

  // 4 — sun
  p411: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191495/sun1_qkwuly.png',
  p412: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191494/sun2_kbzg6o.png',
  p413: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191494/sun3_z4xi5v.png',

  // 5 — frog
  p511: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191501/frog1_omt8wb.png',
  p512: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191500/frog2_tne4pt.png',
  p513: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191499/frog3_e7tvef.png',

  // 6 — kite
  p611: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191489/kite1_s2qty8.png',
  p612: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191490/kite2_oxyzfz.png',
  p613: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191491/kite3_gwkc4z.png',

  // 7 — rocket
  p711: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191492/rocket1_c9om5t.png',
  p712: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191498/rocket2_rzmkwd.png',
  p713: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191497/rocket3_n5xnij.png',
  p721: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191496/rocket4_nlm73q.png',

  // 8 — plane
  p811: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191509/plane1_o8nmw0.png',
  p812: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191486/plane2_ob3aaf.png',
  p813: 'https://res.cloudinary.com/hijmipga/image/upload/v1790191486/plane3_gppahu.png',
};

// Kept as a convenience view of the same URLs grouped per portrait, so tools or
// future code can iterate portraits without re-parsing the flat keys. This is
// derived from IMAGES, not a second source of truth.
export const portraits = Object.entries(IMAGES).reduce((acc, [key, url]) => {
  const portrait = Number(key[1]);
  if (!acc[portrait]) acc[portrait] = {};
  acc[portrait][key] = url;
  return acc;
}, {});

export const AUDIO = {
  // Shared cross-game SFX, referenced by URL exactly like the other games do.
  bgMusic: '/PhaserAssets/bg_music.m4a',
  wrong: '/PhaserAssets/wrong.wav',
  // The shared pop_fx bank — used for pick-up/snap/celebrate feedback.
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',
  pop2: '/PhaserAssets/pop_fx/pop-2.mp3',
  pop3: '/PhaserAssets/pop_fx/pop-3.mp3',
};

// Phaser's audio loader picks a codec/extension to trust from the URL itself,
// and '.mp4' (the format Cloudinary video URLs end in) is not in its default
// recognized-audio-extension list the way '.mp3'/'.m4a'/'.ogg' are — with a
// bare URL string it can silently skip queuing the file. Add any mp4-hosted
// clip here so it is forced to a real audio type.
const AUDIO_TYPE_OVERRIDES = {
  // bgMusic: 'mp3',
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
