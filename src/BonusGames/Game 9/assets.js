// assets.js
// Asset manifest for Game 9. IMAGES / AUDIO are intentionally empty until
// the design is finalized — fill them in the same shape as Game 7's / Game 8's
// assets.js so GameScene.js (and any future LevelSelectScene) can import keys
// by name.
//
// If the game speaks numbers 1-10, also import NUMBERS_VOICE_MANIFEST from
// '../../Phaser/common/numbersVoice' and spread it into ASSET_MANIFEST below
// (see Game 7's assets.js for the exact pattern).

export const IMAGES = {};

export const AUDIO = {};

// Phaser's audio loader picks a codec/extension to trust from the URL
// itself, and '.mp4' isn't in its default recognized-audio-extension list
// the way '.mp3'/'.m4a'/'.ogg' are. If any clip is mp4-hosted, add a
// `key: 'mp3'` entry here (see Game 7/8's AUDIO_TYPE_OVERRIDES).
const AUDIO_TYPE_OVERRIDES = {};

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
];
