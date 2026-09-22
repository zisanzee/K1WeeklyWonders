// Single source of truth for the EZ Wonders brand art, so nothing has to
// hardcode a Cloudinary URL again.
//
// Two distinct assets — never swap them:
//   ICON — the square app mark (favicon, app icon, badge header, loader chip)
//   LOGO — the wide wordmark (home hero, social preview, structured data)
//
// The Cloudinary assets are the masters. Same-origin copies live in public/
// for two reasons: brand art then loads over the app's own connection (no
// third-party TLS on first paint), and rasterizing it into a <canvas> — the
// StudentBadge PNG/PDF export does exactly that — taints the canvas if the
// image is cross-origin. Keep the public/ files in sync with the masters.
export const ICON_SOURCE =
  'https://res.cloudinary.com/hijmipga/image/upload/v1789110164/ezwondersICON_fdwqmt.png';
export const LOGO_SOURCE =
  'https://res.cloudinary.com/hijmipga/image/upload/v1788778681/ChatGPT_Image_Aug_12_2026_07_59_59_PM-Photoroom_hzlh8v.png';

// In-app brand marks. ICON_URL is a 96px square, so it stays crisp at the
// ~40-48px sizes the chrome actually renders it at on retina screens.
export const ICON_URL = '/favicon-96.png';
export const LOGO_URL = '/logo.png';

// 1200x630 card used for social/OG previews.
export const SOCIAL_IMAGE_URL = '/og-image.png';
