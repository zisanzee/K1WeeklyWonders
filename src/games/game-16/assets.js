// assets.js
// Game 16 (in works) — the single place this game's asset URLs will live.
//
// A boilerplate ships an EMPTY IMAGES table on purpose: there is no mechanic
// yet, so there is no art to invent. Adding a file is one line in the table
// below and the derived manifest picks it up — no other file changes.
//
// Keys must be FLAT. The manifest builder maps each value straight to a URL, so
// a nested object would be handed to Phaser as a bogus URL and never load.

// Cloudinary assets are served through `f_auto,q_auto` so the browser gets the
// smallest format it supports. Wrap a URL with this when you fill IMAGES in.
export const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

// ---------------------------------------------------------------------------
// IMAGES — empty until the mechanic exists.
//
// Shape: `key: cld('https://…')`. The key is the Phaser texture key the scene
// asks for; anything falsy is skipped by the manifest, so a placeholder entry
// can sit here without breaking the preload.
// ---------------------------------------------------------------------------
export const IMAGES = {};

// ---------------------------------------------------------------------------
// AUDIO — only the shared background-music clip.
//
// `bgMusic` is looked up by that exact fixed key inside
// @/phaser/common/audioState's ensureBgMusic(), so it is the one clip a scaffold
// needs. This is the same track the other games use, referenced by URL rather
// than copied into the repo. Add SFX keys as the mechanic needs them.
// ---------------------------------------------------------------------------
export const AUDIO = {
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1790786420/game12bg_vhxokd.mp4',
};

// Phaser picks a codec from the URL. A Cloudinary `/video/upload/` URL ends in
// `.mp4`, which Phaser does NOT treat as audio, so the type must be forced or
// the clip is silently never queued and the music never plays.
export const AUDIO_TYPE_OVERRIDES = {
  bgMusic: 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
// Both tables are filtered, so an empty IMAGES / a half-filled AUDIO still
// produces a valid (possibly empty) manifest rather than a loader error.
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
        // Phaser accepts an explicit [{ type, url }] list for the source, which
        // is how the codec override above is applied.
        url: overrideType ? [{ type: overrideType, url }] : url,
      };
    }),
];
