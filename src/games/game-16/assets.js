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
  // ---- SCENE 2 — mirror (three portraits, three axes) ---------------------
  //
  // KEYS ARE FLAT, like everything else in this table. The URLs arrived grouped
  // per round (s2round1: { crab1, crab2, crab3 }) and that shape BREAKS the
  // loader: ASSET_MANIFEST below maps every value straight to a URL, so a nested
  // object is handed to Phaser as one and the preload rejects it. Which round a
  // part belongs to is decided in mirrorRounds.js instead, where it also carries
  // the part id the tuning block is keyed by.
  //
  // Each round needs the PARTS OF ONE PORTRAIT, not three separate pictures:
  // scene 2 assembles them on one side of a mirror axis and reflects the whole
  // group onto the other.
  // round 1 — crab, mirrored across a VERTICAL axis
  s2Crab1: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615282/crab1_nh0mbg.png'),
  s2Crab2: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615283/crab2_ukccws.png'),
  s2Crab3: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615283/crab3_wd0ouv.png'),
  // round 2 — guitar, mirrored across a HORIZONTAL axis
  s2Guitar1: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615284/guitar_1_gkkjkg.png'),
  s2Guitar2: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615284/guitar_2_cz0zy0.png'),
  s2Guitar3: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615284/guitar_3_ul2iyu.png'),
  // round 3 — bird, mirrored across a 45° DIAGONAL axis
  s2Bird1: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615283/bird_1_yahriq.png'),
  s2Bird2: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615282/bird2_c9naxv.png'),
  s2Bird3: cld('https://res.cloudinary.com/hijmipga/image/upload/v1793615283/bird3_pg2rqz.png'),


  // ---- SCENE 3 — positions (four portraits, eight prompts) ----------------
  //
  // FLAT AGAIN, for the same reason as scene 2: the URLs arrived as nested
  // `round1: { bg, cat, … }` objects, and ASSET_MANIFEST below maps every value
  // straight to a URL — a nested object is handed to Phaser as one and the
  // preload rejects it. Round membership lives in tuning.js (`POSITION_PARTS`),
  // where it also carries the id the panel is keyed by.
  //
  // Keys are `s3r<portrait><Name>`: portrait 1-4, then the object.
  //
  // NOTE ON TWO SOURCE FILES, left exactly as supplied:
  //   • s3r4Plate came from a key named `knife` but the URL is a blue-rimmed
  //     PLATE. There is no knife artwork yet, so round 4's pair is fork + plate.
  //     When knife art lands, add s3r4Knife and a part row; nothing else changes.
  //   • s3r3Teddy's URL is "Toy_Box_with_Teddy_and_Red_Car", i.e. the box AND
  //     the teddy in one image. Round 3's prompts are "inside the box" /
  //     "outside the box", so that composite may need splitting into a box and a
  //     teddy before it can read as two placements.
  // portrait 1 — the wall
  s3r1Bg: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793715524/Colorful_Cartoon_Garden_Wall_2_alefoq.png'
  ),
  s3r1Cat: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712744/round1cat_r7xx7f.png'
  ),
  s3r1Flower: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712744/round1flower_acnfq5.png'
  ),
  // portrait 2 — the roadside (top-down)
  s3r2Bg: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793716121/Top-Down_Blue_Car_on_a_Green_Road_1_tycek6.png'
  ),
  s3r2Bike: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712745/round2bike-Photoroom_fbwfci.png'
  ),
  s3r2Truck: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712749/Top-Down_Cartoon_Roadway_Traffic-Photoroom_xhbo1r.png'
  ),
  // portrait 3 — the box
  s3r3Bg: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712743/Empty_Cardboard_Box_on_Wood_Table_xjhtlv.png'
  ),
  s3r3ToyCar: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712747/round3Car-Photoroom_wsrfx5.png'
  ),
  s3r3Teddy: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712750/Toy_Box_with_Teddy_and_Red_Car-Photoroom_wqf8dd.png'
  ),
  // portrait 4 — the table
  s3r4Bg: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712743/Empty_Blue-Rimmed_Plate_on_Wooden_Table_slmbyi.png'
  ),
  s3r4Fork: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712748/round4fork-Photoroom_pfk4qm.png'
  ),
  s3r4Plate: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793712742/Blue-Rimmed_Plate_Place_Setting-Photoroom_lsz1zv.png'
  ),


  // ---- SCENE 4 — stack the rooms on top of each other and create the building in the background by looping the wall assets. -----------------------------------
  wallTop: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797013/top_wall_adufj3.png'
  ),
  wallMiddleLoop: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797013/loopwall_rjew8a.png'
  ),
  wallBottom: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797015/end_wall_t2sdvt.png'
  ),
  roomFrog: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797015/frogroom_wvfrwl.png'
  ),
  roomSheep: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797015/sheeproom_n1dwg6.png'
  ),
  roomGirrafe: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797015/girraferoom_x1o4q8.png'
  ),
  roomPenguin: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797014/Penguinroom_oh7lnz.png'
  ),
  roomDog: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797014/dogroom_ymsazy.png'
  ),
  roomFish: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797014/fishroom_b0hmlm.png'
  ),
  roomLion: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797013/lionroom_feo9pp.png'
  ),
  roomCow: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797013/cowroom_p0tmpd.png'
  ),
  roomElephant: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797013/elephantroom_hmmo2a.png'
  ),
  roomCat: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793797013/catroom_cizq4p.png'
  ),

  // option images for scene 4 
  optionFrog: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805358/optionFrog_ttv9jh.png'
  ),
  optionSheep: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805479/optionsheep_y0jfq2.png'
  ),
  optionGirrafe: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805358/optionGiraffe_zvccp0.png'
  ),
  optionPenguin: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805360/optionPenguin_kpt3r6.png'
  ),
  optionDog: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805357/optionDog_uxettm.png'
  ),
  optionFish: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805358/optionFish_hxalo3.png'
  ),
  optionLion: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805359/optionLion_zkcycs.png'
  ),
  optionCow: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805357/optionCow_iiwluf.png'
  ),
  optionElephant: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805357/optionElephant_szet9l.png'
  ),
  optionCat: cld(
    'https://res.cloudinary.com/hijmipga/image/upload/v1793805357/optionCat_kwrmz4.png'
  )

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
