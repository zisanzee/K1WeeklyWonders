// assetVersion.js
//
// Cache-busting for game assets, which have NO content hash in their names.
//
// Vite fingerprints everything it bundles (`index-BHdgavyA.js`), so a new build
// produces a new URL and no cache can serve the old one. Game media is not
// bundled — it is either copied verbatim from `public/` or fetched from
// Cloudinary — so its URL is identical across every deploy:
//
//   /PhaserAssets/wrong.wav
//   https://res.cloudinary.com/hijmipga/image/upload/v1789297282/cookie_hjnlx5.png
//
// That URL stability is the entire bug. Several layers cache by URL:
//
//   - the service worker's CacheFirst / StaleWhileRevalidate entries;
//   - the browser's own HTTP cache;
//   - Cloudinary's CDN edge.
//
// Critically, Cloudinary serves uploads with:
//
//   Cache-Control: public, no-transform, immutable, max-age=2592000
//
// The **immutable** directive means the browser must NOT revalidate that URL,
// even on a normal reload — Chrome enforces this strictly, which is why this
// only ever reproduced on Chrome and why clearing the browser cache and
// reopening did not help. Only a hard reload bypasses it. That directive lives
// on Cloudinary's response, so the only fix available to us is to request a
// DIFFERENT URL: a cache cannot serve a response for a URL it has never seen,
// and `immutable` cannot protect a URL that has not been fetched yet.
//
// Versioning every asset URL by build does exactly that. Appending a query
// string changes nothing about how the file is served — confirmed against the
// live CDN, which returns 200 with byte-identical content for the versioned URL
// — only how it is cached.
//
// Injected by vite.config.js `define`. Falls back to 'dev' so unit tests and any
// non-Vite context still work (they simply never match a cached production URL).
/* global __EZ_BUILD_ID__ */
export const BUILD_ID =
  typeof __EZ_BUILD_ID__ !== 'undefined' ? __EZ_BUILD_ID__ : 'dev';

/**
 * Appends this build's id to an asset URL.
 *
 * Applied to absolute URLs as well as same-origin paths, because Cloudinary's
 * `immutable` header is precisely the thing that cannot be worked around from
 * our side — see the header comment.
 *
 * Skipped only for inline (`data:`/`blob:`) URIs, which carry their bytes and are
 * never fetched, so there is nothing to cache and nothing to bust.
 *
 * @param {string} url
 * @returns {string}
 */
export function withAssetVersion(url) {
  if (typeof url !== 'string' || url.length === 0) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${BUILD_ID}`;
}
