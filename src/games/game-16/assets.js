// assets.js
// Game 16 — the single place this game's asset URLs live.
//
// Keys must be FLAT. The manifest builder maps each value straight to a URL, so
// a nested object would be handed to Phaser as a bogus URL and never load. That
// is why the character's frame animation below is a flat array of URLs rather
// than an object of frame names — the ORDER is the identity, and the loader
// derives `${key}-${i}` from it.

// Cloudinary assets are served through `f_auto,q_auto` so the browser gets the
// smallest format it supports. Wrap a URL with this when you fill IMAGES in.
export const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

// ---------------------------------------------------------------------------
// IMAGES
//
// Shape: `key: cld('https://…')`. The key is the Phaser texture key the scene
// asks for; anything falsy is skipped by the manifest, so a placeholder entry
// can sit here without breaking the preload.
//
// Keys are prefixed per scene (`s1…` for scene 1) because five mini-games will
// each bring their own art and a bare `bg` would collide the moment scene 2
// lands.
// ---------------------------------------------------------------------------
export const IMAGES = {
  // ---- SCENE 1 — shapes (the factory) -----------------------------------
  // Full-bleed workshop backdrop. Drawn COVER-style (scaled to fill, cropped)
  // rather than stretched, so it never distorts on a different aspect ratio.
  s1Background: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793450671/Colorful_Cartoon_Factory_Workshop_aqvb7k.png'
  ),

  // The conveyor belt segment. Horizontally LOOPABLE: drawn as a tileSprite and
  // scrolled via tilePositionX, so one narrow strip fills the whole width and
  // keeps moving forever without a long texture.
  s1Conveyor: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793451486/image-Photoroom_idacbc.png'
  ),
};

// ---------------------------------------------------------------------------
// FRAME ANIMATIONS — a sequence of individual PNGs, played by index
// ---------------------------------------------------------------------------
// Each entry is ONE animation built from separate images (not a spritesheet).
// They are loaded as ordinary images under derived keys (`${key}-${i}`) and
// played back in array order, so:
//   • paste URLs in the order they should play
//   • leave a slot as '' if a frame is missing — it is skipped by the loader
//   • the count is not fixed; the array length is whatever you paste
//
// THE ONE RULE: once frames are in use, don't reorder or delete mid-list — a
// frame's POSITION is its identity. Append new frames at the end.
//
// ---------------------------------------------------------------------------
// NOTE ON THE SOURCE ORDER: the supplied URLs interleave two Cloudinary upload
// batches, and `frame_002` / `frame_003` in the file names arrive in the reverse
// of their numeric order. The array below is the animation's PLAY order, taken
// from the file-name numbering (000, 001, 002, 003, …), so the roll reads
// forwards. Do not "tidy" these back into the order they were pasted.
// ---------------------------------------------------------------------------
export const FRAME_ANIMATIONS = {
  // The robot's roll-in. Played once at the start of every round.
  characterRoll: [
    // 000
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451836/frame_000_tsgwtn.png'),
    // 001
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451837/frame_001_ohvy4d.png'),
    // 002
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451837/frame_002_aplar5.png'),
    // 003
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451837/frame_003_wqtjzm.png'),
    // 004
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451838/frame_004_i5jbb2.png'),
    // 005
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451840/frame_005_gcd2w4.png'),
    // 006
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451841/frame_006_zuu39h.png'),
    // 007
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451842/frame_007_mlja9r.png'),
    // 008
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451843/frame_008_xowfbl.png'),
    // 009
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451844/frame_009_sruznl.png'),
    // 010
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451844/frame_010_oryplu.png'),
    // 011
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451845/frame_011_hveroj.png'),
    // 012
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451846/frame_012_kso0va.png'),
    // 013
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793451893/frame_013_heyzrd.png'),
    // 014
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452023/frame_014_qhsn9i.png'),
    // 015
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452044/frame_015_jmerp7.png'),
    // 016
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452046/frame_016_dwogtg.png'),
    // 017
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452048/frame_017_pqkcgp.png'),
    // 018
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452049/frame_018_ccwxoc.png'),
    // 019
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452050/frame_019_fbe3pr.png'),
    // 020
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452052/frame_020_qzec9j.png'),
    // 021
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452053/frame_021_ap7cxm.png'),
    // 022
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452054/frame_022_w116nq.png'),
    // 023
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452055/frame_023_d8owsz.png'),
    // 024
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452056/frame_024_coc86y.png'),
    // 025
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452057/frame_025_w2k6so.png'),
    // 026
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452059/frame_026_hsygsx.png'),
    // 027
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452060/frame_027_pqadro.png'),
    // 028
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452061/frame_028_vlnlvq.png'),
    // 029
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452062/frame_029_jqgrqi.png'),
    // 030
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452063/frame_030_dkjnf2.png'),
    // 031
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452065/frame_031_kbrfza.png'),
    // 032
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452066/frame_032_thay9u.png'),
    // 033
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452067/frame_033_nuslhj.png'),
    // 034
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452074/frame_034_cdcy6c.png'),
    // 035
    cld('https://res.cloudinary.com/hijmipga/image/upload/v1793452075/frame_035_vahrna.png'),
  ],
};

// Texture key for one frame. Single source of truth, so the manifest and the
// scene can never disagree about a frame's key.
export function frameKey(animationKey, index) {
  return `${animationKey}-${index}`;
}

// Every non-empty frame of one animation, in play order, as { key, url, index }.
// Used by the manifest below and to build the Phaser animation.
export function animationFrames(animationKey) {
  const urls = FRAME_ANIMATIONS[animationKey] || [];
  return urls
    .map((url, index) => ({ key: frameKey(animationKey, index), url, index }))
    .filter((frame) => Boolean(frame.url));
}

// The still frame shown when the animation is NOT playing (the robot at rest).
// The FIRST frame is the neutral pose by convention, so this is derived rather
// than a second URL to keep in sync.
export function animationStill(animationKey) {
  return animationFrames(animationKey)[0]?.key || null;
}

// ---------------------------------------------------------------------------
// AUDIO — the shared background music plus the shared wrong-answer buzzer.
//
// `bgMusic` is looked up by that exact fixed key inside
// @/phaser/common/audioState's ensureBgMusic(), so it is the one clip a scaffold
// needs. This is the same track the other games use, referenced by URL rather
// than copied into the repo.
//
// `wrong` is the same key and the same file every other game uses
// (`/PhaserAssets/wrong.wav`), so `scene.sound.play('wrong')` behaves and sounds
// identically here. A key that is not in this manifest is never queued, and
// playing it then fails SILENTLY — which is exactly the kind of bug that looks
// like "the buzzer just doesn't work".
// ---------------------------------------------------------------------------
export const AUDIO = {
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1790786420/game12bg_vhxokd.mp4',
  wrong: '/PhaserAssets/wrong.wav',
  // The shared pop_fx bank. This game needs TWO distinct cues:
  //
  //   pop1 — placing a shape on the belt, which happens on a right OR wrong answer
  //   pop2 — the success chime, correct answers only
  //
  // They must be different sounds: using one clip for both is what made a correct
  // answer indistinguishable from a wrong one, because the placement pop fired in
  // both cases and there was no second cue to mark the win.
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',
  pop2: 'https://res.cloudinary.com/hijmipga/video/upload/v1790786703/success_-_Sound_Effect_n4qnDaSidJs_-cut-1790786683179_paqgqf.mp3',
  // The slot machine whirr, played when the roll animation starts.
  //
  // A Cloudinary `/video/upload/` URL ends in `.mp3`, but Phaser infers the codec
  // from the URL and treats that path as video — so the type is forced in
  // AUDIO_TYPE_OVERRIDES below. Without it the clip is silently never queued.
  slotSpin: 'https://res.cloudinary.com/hijmipga/video/upload/v1793532328/slot_machine_a2bq2x.mp3',
};

// Phaser picks a codec from the URL. A Cloudinary `/video/upload/` URL ends in
// `.mp4`, which Phaser does NOT treat as audio, so the type must be forced or
// the clip is silently never queued and the music never plays.
export const AUDIO_TYPE_OVERRIDES = {
  bgMusic: 'mp3',
  slotSpin: 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
// Every table is filtered, so an empty IMAGES / a half-filled AUDIO still
// produces a valid (possibly empty) manifest rather than a loader error.
export const ASSET_MANIFEST = [
  ...Object.entries(IMAGES)
    .filter(([, url]) => url) // skip placeholders not filled in yet
    .map(([key, url]) => ({ type: 'image', key, url })),
  // One image per animation frame, keyed `${animationKey}-${index}`. Empty slots
  // are dropped by animationFrames(), so a half-filled animation still loads.
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
        // Phaser accepts an explicit [{ type, url }] list for the source, which
        // is how the codec override above is applied.
        url: overrideType ? [{ type: overrideType, url }] : url,
      };
    }),
];
