// assets.js
// Game 15 — the single place this game's asset URLs live.
//
// ASSET_MANIFEST is DERIVED from IMAGES / SPRITESHEETS / FRAME_ANIMATIONS / AUDIO,
// so adding a file is one line in the table below and every loader path picks it
// up. Keys must be FLAT: the manifest builder maps each value straight to a URL,
// so a nested object would be handed to Phaser as a bogus URL.

// Cloudinary assets are served through `f_auto,q_auto` so the browser gets the
// smallest format it supports. Wrap a URL with this when you fill IMAGES in.
export const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

export const IMAGES = {
  // The character's IDLE pose, shown when the joystick is at rest. Used as a
  // single still image (no idle animation — stopping just swaps to this frame).
  heroIdle: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1792593173/idle_mrdddv.png'
  ),

  // The supermarket backdrop. 720x1080 and horizontally loopable, so it is drawn
  // as a tiled sprite scaled to the canvas height and repeated across the full
  // world width — it therefore covers the scene at any aspect, and keeps
  // repeating as the camera pans.
  backdrop: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1792647551/supermarket_background_loopable_720x1080_1_lci5iy.png'
  ),

  // The shop shelving. `end` is the left-hand upright; the RIGHT end is the same
  // image flipped horizontally in the scene, so only one file ships. `main` is
  // looped between them to make the shelf arbitrarily long.
  // Both are 170x1080 and share the same shelf levels, so they tile seam-free.
  shelfEnd: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1792583447/Shelf-end_akfo6x.png'
  ),
  shelfMain: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1792583447/Shelf-middle_s9qsgc.png'
  ),

};

// ---------------------------------------------------------------------------
// PRODUCTS — the shelf items, as a LIST whose order IS the shelf order.
//
// Kept separate from IMAGES because it is an ORDERED sequence, not a set of
// named textures: slot 0 is the first product on the shelf. Texture keys are
// derived as `product-N` by productKey() below, so nothing is written by hand.
//
// NOTE: this must be a flat list, not a nested object inside IMAGES. The manifest
// builder maps every IMAGES value straight to a URL, so a nested object would be
// handed to Phaser as a bogus URL and the products would never load.
// ---------------------------------------------------------------------------
export const PRODUCT_IMAGES = [
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651530/product1_aidh5r.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651530/product2_ssqwfw.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651530/product3_y7zoqp.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651530/product4_kb6nse.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651530/product5_gycd9j.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651530/product6_uirfkg.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651531/product7_vcyrbb.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651531/product8_tg0btk.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651531/product9_bfqkyh.png'),
  cld('https://res.cloudinary.com/hijmipga/image/upload/v1792651531/product10_qoki8e.png'),
];

// Texture key for one product slot. Single source of truth so the manifest and
// the scene can never disagree about a product's key.
export function productKey(index) {
  return `product-${index}`;
}

// The texture key for a shelf slot, wrapped so a shelf with MORE products than
// the list simply cycles the art instead of asking for a missing texture.
export function productKeyFor(index) {
  const count = PRODUCT_IMAGES.length;
  return count > 0 ? productKey(index % count) : '';
}

// ---------------------------------------------------------------------------
// FRAME ANIMATIONS — paste the 27 frame URLs in here.
// ---------------------------------------------------------------------------
// Each entry is ONE animation built from a sequence of individual PNG frames
// (rather than a single spritesheet image). Frames are loaded as ordinary
// images under derived keys and played by index order, so:
//   • paste URLs in the order they should play,
//   • leave a slot as '' if a frame is missing — it is skipped by the loader,
//   • the count is NOT fixed at 27; the list length is whatever you paste, so a
//     12-frame or 40-frame animation works with no other change.
//
// THE ONE RULE: once frames are in use, don't reorder or delete them mid-list —
// the frame's position IS its identity. Append new frames at the end instead.
//
// Derived texture key for a frame is `${animationKey}-${index}` (e.g. 'hero-0'),
// so no keys are written by hand here.
export const FRAME_ANIMATIONS = {
  // The character's animation. Rename the key freely until it is used in code;
  // after that the key is identity (see .roorules) and must not change.
  hero: [
    // 0
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587814/frame_01_jkfhve.png',
    // 1
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587817/frame_02_rmintf.png',
    // 2
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587814/frame_03_c7it3s.png',
    // 3
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587813/frame_04_eb0u1c.png',
    // 4
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587814/frame_05_wlg1iy.png',
    // 5
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587815/frame_06_lkgl1c.png',
    // 6
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587816/frame_07_uni6gd.png',
    // 7
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587816/frame_08_gpyto0.png',
    // 8
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587815/frame_09_g3cycb.png',
    // 9
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587815/frame_10_zrnnz7.png',
    // 10
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587817/frame_11_toofbg.png',
    // 11
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587815/frame_12_uregfd.png',
    // 12
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587817/frame_13_j6mcfq.png',
    // 13
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587816/frame_14_t4ihgx.png',
    // 14
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587818/frame_15_bbzz1n.png',
    // 15
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587817/frame_16_j22te1.png',
    // 16
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587818/frame_17_tuwglt.png',
    // 17
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587818/frame_18_bcqvd4.png',
    // 18
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587818/frame_19_wcdfq2.png',
    // 19
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587819/frame_20_jjmp9a.png',
    // 20
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587819/frame_21_w6dp1d.png',
    // 21
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587820/frame_22_qvbcpj.png',
    // 22
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587820/frame_23_ds9zis.png',
    // 23
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587821/frame_24_cdfjdc.png',
    // 24
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587821/frame_25_thipzm.png',
    // 25
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587821/frame_26_dt5btq.png',
    // 26
    'https://res.cloudinary.com/hijmipga/image/upload/v1792587822/frame_27_zbyck4.png',
  ],
};

// Texture key for one frame of a FRAME_ANIMATIONS entry. Single source of truth
// so the manifest and the scene can never disagree about a frame's key.
export function frameKey(animationKey, index) {
  return `${animationKey}-${index}`;
}

// Every non-empty frame of one animation, in play order, as { key, url }.
// Used by the manifest below and, later, to build the Phaser animation.
export function animationFrames(animationKey) {
  const urls = FRAME_ANIMATIONS[animationKey] || [];
  return urls
    .map((url, index) => ({ key: frameKey(animationKey, index), url, index }))
    .filter((frame) => Boolean(frame.url));
}

export const AUDIO = {
  // Shared cross-game audio, referenced by URL exactly like the other games do.
  // bgMusic is looked up by that fixed key in ensureBgMusic(), so it is the one
  // clip a scaffold needs. Add SFX keys as the mechanic needs them.
  bgMusic: '/PhaserAssets/bg_music.m4a',

  // Wrong product dropped in the cart.
  wrong: '/PhaserAssets/wrong.wav',

  // A product successfully seated / a prompt completed.
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',

  // Round or level completion fanfare. A Cloudinary VIDEO upload served as mp3,
  // so it needs an explicit type override (see AUDIO_TYPE_OVERRIDES).
  success:
    'https://res.cloudinary.com/hijmipga/video/upload/v1790786703/success_-_Sound_Effect_n4qnDaSidJs_-cut-1790786683179_paqgqf.mp3',
};

// Phaser picks a codec/extension from the URL. A host that serves audio under
// an extension Phaser does not treat as audio (e.g. a Cloudinary video upload)
// would be silently skipped, so force a real type for any such clip here.
const AUDIO_TYPE_OVERRIDES = {
  // '/PhaserAssets/bg_music.m4a' ends in a recognised audio extension, so no
  // override is needed. The Cloudinary success clip is a VIDEO upload whose URL
  // Phaser will not trust as audio without being told.
  success: 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
export const ASSET_MANIFEST = [
  ...Object.entries(IMAGES)
    .filter(([, url]) => url) // skip placeholders not filled in yet
    .map(([key, url]) => ({ type: 'image', key, url })),
  // One image per product, keyed `product-N` by productKey().
  ...PRODUCT_IMAGES.filter(Boolean).map((url, index) => ({
    type: 'image',
    key: productKey(index),
    url,
  })),
  // One image per frame, keyed `${animationKey}-${index}`. Empty slots are
  // dropped by animationFrames(), so a half-filled animation still loads.
  ...Object.keys(FRAME_ANIMATIONS).flatMap((animationKey) =>
    animationFrames(animationKey).map(({ key, url }) => ({ type: 'image', key, url }))
  ),
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
