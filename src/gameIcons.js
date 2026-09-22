// gameIcons.js
// Single source of truth for the optional per-game ICON IMAGES.
//
// WHY THIS IS SEPARATE FROM gameAccess.js: these are plain static files under
// public/game-icons/, so each is a URL string rather than an import the bundler
// tracks. Keeping the map out of the catalogue lets the heavy card renderer
// import only this tiny module, and lets tests read the map without pulling in
// the whole game-access store.
//
// SERVED FROM public/, NOT src/assets/ — deliberately. The catalogue is imported
// by the eager home bundle, so a bundler import would drag every game icon into
// that chunk and (because the files would then be content-hashed) the botched
// manualChunks rule is not the only way to make them eager. A public/ file is
// fetched lazily by the browser only where <img> actually renders it.

// Maps a catalog `key` to its icon file, relative to the app origin.
//
// A key with NO entry here simply renders the catalogue emoji instead, so
// adding icons is purely additive — drop a file in and add one line, and every
// surface that shows a game icon picks it up.
export const GAME_ICON_FILES = {
  '10': 'https://res.cloudinary.com/hijmipga/image/upload/v1790064611/game10_icon_1_pi3qad.png',
  // '10': '/game-icons/game10.png',
};

// Resolves a game (or a bare key) to its icon URL, or '' when it has no icon.
export function gameIconSrc(gameOrKey) {
  const key =
    typeof gameOrKey === 'string' ? gameOrKey : gameOrKey?.key;
  if (!key) return '';
  return GAME_ICON_FILES[key] || '';
}
