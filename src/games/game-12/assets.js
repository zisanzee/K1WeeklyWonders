// assets.js
// Position Mission! — the single place this game's asset URLs live.
//
// The artwork is organised as four full-screen SCENES. Each scene ships one
// background image plus a handful of character cut-outs. Texture keys are FLAT
// and self-describing so the whole file can be derived from them without a
// second table:
//
//   scene<N>Background        the full-screen backdrop for scene N
//   scene<N>Character<I>      the I-th character placed in scene N (1-based)
//
//   e.g. scene3Background, scene3Character2
//
// This module owns the URLs + the key grammar ONLY. Which characters appear in
// which scene (structure) lives in scenes.js; where each one sits on the canvas
// (the numbers you tune by eye) lives in sceneTuning.js. Keep the three in step:
// a character listed in scenes.js but not here never loads, and one loaded here
// but missing from the tuning table still draws (dead centre — see sceneTuning.js).

// Convenience re-export of the scene ids we ship, so callers can iterate scenes
// without re-deriving the list from the key grammar themselves.
export const SCENE_IDS = [1, 2, 3, 4, 5, 6];

// The start screen: a full-bleed title image and the "play" button image. These
// are NOT scene art, so they are excluded from sceneCharacterKeys() by the key
// grammar below.

// Every image is a Cloudinary asset. Serving it through `f_auto,q_auto` lets
// Cloudinary pick the smallest format the browser supports (WebP/AVIF) at an
// auto-selected quality — a large download saving over the raw PNGs, with no
// change to dimensions or layout. Applied once below so the table stays plain
// URLs.
const cld = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');

const RAW_IMAGES = {
  // ===========================================================================
  // START SCREEN
  // ===========================================================================
  startScreen:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790782298/startimage_a7d3zn.png',
  startButton:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790782296/startbtn_1_cteduh.png',

  // ===========================================================================
  // SCENE 1
  // ===========================================================================
  scene1Background:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/scene1bg_rnzdpm.png',
  
  scene1Character2:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601314/scene1Woman-Photoroom_vmyppp.png',
  scene1Character3:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/scene1Guy-Photoroom_yc5qva.png',
  scene1Character4:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/scene1dog-Photoroom_hqfpp1.png',

  // ===========================================================================
  // SCENE 2
  // ===========================================================================
  scene2Background:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601316/scene2bg_jcxiwo.png',
  scene2Character1:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/scene2cat-Photoroom_xmjvj5.png',
  scene2Character2:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/scene1dog-Photoroom_hqfpp1.png',

  // ===========================================================================
  // SCENE 3 — same cast as scene 1, posed against a different backdrop
  // ===========================================================================
  scene3Background:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601317/scene3bg_tsj3iw.png',
  scene3Character1:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/Scene1Child-Photoroom_urjnx5.png',
  scene3Character2:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601314/scene1Woman-Photoroom_vmyppp.png',
  scene3Character3:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/scene1Guy-Photoroom_yc5qva.png',

  // ===========================================================================
  // SCENE 4
  // ===========================================================================
  scene4Background:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790604217/scene4bg_ciyxmm.png',
  scene4Character1:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601315/Scene4girl-Photoroom_waj5cy.png',
  scene4Character2:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790601316/Scene4boypng-Photoroom_jbnwkj.png',

  // ===========================================================================
  // SCENE 5
  // ===========================================================================
  scene5Background:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790878308/scene5bg_d7w9my.png',
  scene5Character1:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790705163/scene5pot-Photoroom_mkvagu.png',
  scene5Character2:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790705163/scene5plate-Photoroom_cerh9d.png',

  // ===========================================================================
  // SCENE 6
  // ===========================================================================
  scene6Background:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790852255/Sunny_Backyard_Treescape_1_wbaja1.png',
  scene6Character1:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790705163/scene6bird_abrdar.png',
  scene6Character2:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790705164/scene6dog-Photoroom_etcznd.png',

  // ===========================================================================
  // PROMPT IMAGES — not scene art; the little inline pictures shown inside the
  // round prompts (props that have no character cut-out of their own).
  // ===========================================================================
  promptSlide:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790878266/slide_1_fmvpur.png',
  promptBed:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790777550/bed_uttrmq.png',
  promptChef:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790777771/chef_virz8f.png',
  promptTree:
    'https://res.cloudinary.com/hijmipga/image/upload/v1790778257/tree_yv1dm3.png',
};

export const IMAGES = Object.fromEntries(
  Object.entries(RAW_IMAGES).map(([key, url]) => [key, cld(url)])
);

// ---------------------------------------------------------------------------
// Key grammar helpers — the one place the <scene><kind><index> shape is parsed.
// ---------------------------------------------------------------------------

const BACKGROUND_RE = /^scene(\d+)Background$/;
const CHARACTER_RE = /^scene(\d+)Character(\d+)$/;

// The background texture key for a scene id.
export function sceneBackgroundKey(scene) {
  return `scene${scene}Background`;
}

// The character texture keys for a scene id, in their numeric order (so
// character 2 never draws before character 1 just because of key ordering).
// Derived from IMAGES, so adding a character here needs no second edit.
export function sceneCharacterKeys(scene) {
  const keys = [];
  for (const key of Object.keys(IMAGES)) {
    const m = CHARACTER_RE.exec(key);
    if (m && Number(m[1]) === scene) keys.push({ key, index: Number(m[2]) });
  }
  return keys.sort((a, b) => a.index - b.index).map((e) => e.key);
}

// Parse any scene texture key back into { scene, kind, index }, or null for a
// key that is not scene artwork (e.g. an audio key). `index` is undefined for a
// background. Mirrors the grammar above so callers never hand-slice key strings.
export function parseSceneKey(key) {
  if (typeof key !== 'string') return null;
  const bg = BACKGROUND_RE.exec(key);
  if (bg) return { scene: Number(bg[1]), kind: 'background', index: undefined };
  const ch = CHARACTER_RE.exec(key);
  if (ch) return { scene: Number(ch[1]), kind: 'character', index: Number(ch[2]) };
  return null;
}

// Scene ids that actually have artwork right now, ascending. SCENE_IDS is the
// intended list; this is the guaranteed-present one (a scene with no background
// key yet simply won't appear), which is what the scene builders should read.
export function presentSceneIds() {
  const ids = [];
  for (const key of Object.keys(IMAGES)) {
    const m = BACKGROUND_RE.exec(key);
    if (m) ids.push(Number(m[1]));
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

export const AUDIO = {
  // Shared cross-game SFX, referenced by URL exactly like the other games do.
  bgMusic: 'https://res.cloudinary.com/hijmipga/video/upload/v1790786420/game12bg_vhxokd.mp4',
  wrong: '/PhaserAssets/wrong.wav',
  // Round-complete jingle — plays with the confetti when a piece is placed.
  success:
    'https://res.cloudinary.com/hijmipga/video/upload/v1790786703/success_-_Sound_Effect_n4qnDaSidJs_-cut-1790786683179_paqgqf.mp3',
  // The shared pop_fx bank — used for pick-up/snap/celebrate feedback.
  pop1: '/PhaserAssets/pop_fx/pop-1.mp3',
  pop2: '/PhaserAssets/pop_fx/pop-2.mp3',
  pop3: '/PhaserAssets/pop_fx/pop-3.mp3',
// instructions voice for start screen
instructions: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785801/Instructions_q24dp9.mp3',
// voice lines for prompts
1: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785473/1_xmnivd.mp3',
2: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785473/2_cgmez0.mp3',
3: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785473/3_lih1hi.mp3',
4: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785472/4_kevrh9.mp3',
5: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785472/5_jg1tkm.mp3',
6: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785474/6_nnjvha.mp3',
7: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785473/7_eggfed.mp3',
8: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785472/8_kxuiny.mp3',
9: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785472/9_rkb1zf.mp3',
10: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785473/10_zrxfhg.mp3',
11: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785472/11_ij51um.mp3',
12: 'https://res.cloudinary.com/hijmipga/video/upload/v1790785472/12_c4ce8k.mp3',
};

// Phaser's audio loader picks a codec/extension to trust from the URL itself,
// and some hosts (Cloudinary video URLs, e.g.) end in an extension it does not
// recognise as audio — with a bare URL string it can then silently skip queuing
// the file. Add any such clip here so it is forced to a real audio type.
const AUDIO_TYPE_OVERRIDES = {
  // bgMusic is a Cloudinary `.mp4` (audio-only). `.mp4` is not in Phaser's
  // default recognised-audio-extension list, so without this it silently fails
  // to queue and the music never plays.
  bgMusic: 'mp3',
};

// Flattened manifest for BasePreloadScene({ assets: ASSET_MANIFEST, ... }).
// IMAGES is already a flat key -> url map, so it maps 1:1 (the nested-table
// shape this used to have silently produced { key, url: {...} } entries that
// Phaser could not load — keep this flat).
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
