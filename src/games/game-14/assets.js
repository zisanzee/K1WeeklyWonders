// assets.js
// Game 14 — the single place this game's asset URLs live.
//
// ASSET_MANIFEST is DERIVED from IMAGES/AUDIO, so adding a file is one line in
// the table below and every loader path picks it up automatically. Keys must be
// FLAT: the manifest builder maps each value straight to a URL, so a nested
// object would be handed to Phaser as a bogus URL.
//
// BOILERPLATE: the URL values below are empty on purpose. The scene falls back
// to drawn placeholders when a texture is missing (see GameScene.js), so the
// game runs with no art until you fill these in. Drop in Cloudinary links or
// public/ paths and the loader will pick them up with no other change.

// Cloudinary assets are served through `f_auto,q_auto` so the browser gets the
// smallest format it supports. Wrap a URL with this when you fill the table in.
export const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

export const IMAGES = {
  // Example (uncomment + fill in):
  // background: cld('https://res.cloudinary.com/.../bg.png'),
};

export const AUDIO = {
  // Shared cross-game SFX live under /PhaserAssets/ and can be referenced by
  // URL exactly like the other games do.
  wrong: '/PhaserAssets/wrong.wav',
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',
};

// Phaser picks a codec/extension from the URL itself; some hosts (Cloudinary
// video uploads) end in an extension it does not recognise as audio and the
// file is then silently skipped. Force a real audio type for any such clip.
const AUDIO_TYPE_OVERRIDES = {
  // engine: 'mp3',
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
