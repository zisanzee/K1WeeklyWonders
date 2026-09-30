// assets.js
// Game 13 — BOILERPLATE ONLY.
//
// The single place this game's asset URLs live. Nothing is wired up yet: the
// gameplay brief and artwork arrive later, so IMAGES ships empty and the scene
// copes with the missing start card / backdrop (see GameScene.js). Fill IMAGES
// in and every loader path below picks the files up automatically —
// ASSET_MANIFEST is derived from it, so it never needs editing by hand.

export const IMAGES = {
  // startScreen: 'https://res.cloudinary.com/.../game13-Start.png',
  // background:  'https://res.cloudinary.com/.../game13-Background.png',
};

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
// and some hosts (Cloudinary video URLs, e.g.) end in an extension it does not
// recognise as audio — with a bare URL string it can then silently skip queuing
// the file. Add any such clip here so it is forced to a real audio type.
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
