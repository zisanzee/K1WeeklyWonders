// assetVersion.js
//
// Cache-busting for SAME-ORIGIN assets that have no content hash in their name.
//
// Vite fingerprints everything it bundles (`index-BHdgavyA.js`), so a new build
// produces a new URL for those and no cache can serve the old one. Files in
// `public/` are NOT bundled — they are copied verbatim, so `/PhaserAssets/wrong.wav`
// keeps that exact URL across every deploy, and several layers cache by URL:
//
//   - the service worker's `ezw-phaser-assets` CacheFirst entry;
//   - the browser's own HTTP cache.
//
// Clearing the browser cache does not help, because the service worker cache is
// a separate store that survives it, and the worker keeps being re-installed
// with the SAME asset URLs.
//
// Versioning the URL by build makes a redeploy change the key: the old entry
// simply becomes unreachable and the file is refetched. A query string does not
// affect how a static file is served, only how it is cached.
//
// Deliberately NOT applied to absolute URLs (the Cloudinary media). Cloudinary
// parses query parameters as transformation options, so an unrecognised one
// there risks an error response rather than a cache-busted image — far too
// dangerous a way to fix a caching bug, since a 400 would break every food
// sprite in the game. Cloudinary is handled in the service worker instead, by
// forcing its revalidation fetch to bypass the HTTP cache (see vite.config.js,
// the `ezw-cloudinary-media` rule). The two together cover both origins without
// changing any third-party URL.
//
// Injected by vite.config.js `define`. Falls back to 'dev' so unit tests and any
// non-Vite context still work (they simply never match a cached production URL).
/* global __EZ_BUILD_ID__ */
export const BUILD_ID =
  typeof __EZ_BUILD_ID__ !== 'undefined' ? __EZ_BUILD_ID__ : 'dev';

/**
 * Appends this build's id to a same-origin asset URL.
 *
 * Absolute URLs, protocol-relative URLs and inline (data/blob) URIs are returned
 * untouched — only paths served from this deployment need busting.
 *
 * @param {string} url
 * @returns {string}
 */
export function withAssetVersion(url) {
  if (typeof url !== 'string' || url.length === 0) return url;
  // Must be a root-relative path: '/' but not '//' (protocol-relative).
  if (url[0] !== '/' || url[1] === '/') return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${BUILD_ID}`;
}
