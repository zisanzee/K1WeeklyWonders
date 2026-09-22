// assets.js
// Game 11 — BOILERPLATE ONLY.
//
// One manifest, flattened into the array BasePreloadScene loads. Fill IMAGES
// and AUDIO in when the art/voice clips exist; the loader skips any audio entry
// whose URL is falsy, so a partially-populated manifest is safe.

export const IMAGES = {
  // 'background': '',
  // ...
};

export const AUDIO = {
  // Shared cross-game SFX, referenced by URL exactly like the other games.
  // 'wrong': '/PhaserAssets/wrong.wav',
  // ...
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
