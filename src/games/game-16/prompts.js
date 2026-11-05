// prompts.js
// GAME 16 — EVERY PROMPT AND ITS VOICE LINE, in one editable place.
//
// HOW TO USE THIS FILE
// ---------------------------------------------------------------------------
// Each round of each scene has a row. To change what a child is asked, edit
// `text`. To give it a voice, paste a URL into `voice`.
//
//   { text: 'Complete the character by matching the other side.',
//     voice: 'https://res.cloudinary.com/…/mirror.mp3' }
//
// Leave `voice` as `null` (or '') and the round plays silently — nothing breaks,
// nothing warns, the prompt is still shown. That is deliberate: the voice files
// arrive later than the text, and a missing recording must never be a crash or a
// console warning on every round.
//
// WHY THE TEXT LIVES HERE AND NOT ONLY IN tuning.js
// ---------------------------------------------------------------------------
// Scenes 3 and 4 build their sentences from tuning tables (POSITION_PARTS,
// PROMPT_TEMPLATE) because those sentences contain a variable the rest of the
// game needs — the emphasised word is styled differently. This file is the one
// place a HUMAN edits the wording and attaches audio; the tables stay the machine
// copy. `voiceFor()` below is therefore keyed on the sentence's IDENTITY (scene +
// round, or scene + floor), not on the string, so re-wording a prompt does not
// silently detach its voice line.
//
// THE ONE RULE: a key here must match what the scene actually asks. If you add a
// round to scenes.js, add its row here too, or it simply plays no voice.
//
// HOW A VOICE IS PLAYED
// ---------------------------------------------------------------------------
// The hub owns playback (see GameScene.js `playPromptVoice`):
//   • every time a prompt is SET, its voice plays;
//   • the moment a round completes, the voice STOPS immediately;
//   • the 🔊-style button at the top right replays the CURRENT round's line.
//
// Voice audio is declared in assets.js from this table, so the preload screen
// covers it — never loaded mid-round.

// ---------------------------------------------------------------------------
// SCENE 1 — SHAPES (the factory).
// ---------------------------------------------------------------------------
// ONE CLIP PER CLUE, and the clip says the WHOLE sentence.
//
// The ON-SCREEN text stays generic — "Put the shape on the belt." or "Put 2
// shapes on the belt." — because it is the same instruction every round. But the
// AUDIO is the only place the clue is spoken aloud, so each clue has its own
// recording that names it:
//
//     '3 corners'  →  "Put the shape with 3 corners on the belt."
//     'no corners' →  "Put the shape with no corners on the belt."
//
// The child hears the requirement they have to act on; a child who cannot read the
// reel still hears the question.
//
// KEYED BY THE CLUE TEXT, NOT BY ROUND. The first three rounds are SHUFFLED per
// run, so "round 2" is not a fixed clue — a round-keyed table would play the wrong
// sentence. The clue string IS the identity, so shuffling or re-wording a round
// cannot detach a recording.
//
//   say    what the recording should SAY — for whoever records it. Not read by
//          any code; it exists so the voice can be written from this file alone.
//   voice  the audio URL. null = silent.
const SHAPES_CLUES = {
  '3 corners': {
    say: 'Put the shape with 3 corners on the belt.',
    voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793885852/3_corners_hg7inv.mp3',
  },
  'no corners': {
    say: 'Put the shape with no corners on the belt.',
    voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793885852/no_corners_uj9jax.mp3',
  },
  '4 equal sides': {
    say: 'Put the shape with 4 equal sides on the belt.',
    voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793885852/4_equal_sides_ng2m33.mp3',
  },
  // The only TWO-shape round, so its line asks for two.
  '4 corners': {
    say: 'Put 2 shapes with 4 corners on the belt.',
    voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793885852/4_corners_yaweis.mp3',
  },
};

// ---------------------------------------------------------------------------
// SCENE 2 — MIRROR. Three rounds, ONE sentence, and it is SPOKEN ONCE.
// ---------------------------------------------------------------------------
// All three rounds ask the same thing; only the ANGLE of the mirror line changes,
// and that is visible on screen. So:
//
//   • the TEXT is on screen every round (unchanged — it is the instruction)
//   • the VOICE plays only on ROUND 1
//
// WHY ONLY ONCE. Repeating an identical sentence at every round transition is
// noise, and it talks over the very thing that DID change (the line moving to a
// new angle). The instruction is learned on round 1; after that the child is
// doing the same task with a different divider.
//
// HOW THAT IS EXPRESSED: `voice` is null on rounds 2 and 3. That is the existing
// "this row has no recording" mechanism — no special case in the player, and the
// replay button on rounds 2-3 falls back to the most recent line that does exist
// (round 1's), so a child who needs to hear it again still can.
const MIRROR_TEXT = 'Complete the character by matching the other side.';

const MIRROR = {
  // The one clip. Paste its URL here and it plays at the start of the scene.
  1: { text: MIRROR_TEXT, voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793886818/mirror_prompt_dbsikx.mp3' },
  // Text only: same sentence on screen, deliberately silent.
  2: { text: MIRROR_TEXT, voice: null },
  3: { text: MIRROR_TEXT, voice: null },
};

// ---------------------------------------------------------------------------
// SCENE 3 — POSITIONS. Four portraits, TWO prompts each (slot A then slot B).
// ---------------------------------------------------------------------------
// The wording here must match POSITION_PARTS in tuning.js: the emphasised word is
// marked with [square brackets] in tuning, and the voice should say the sentence
// without them.
//
// `slot` is 'A' or 'B', in the order the portrait asks them.
const POSITIONS = {
  1: {
    A: { text: 'Put the cat on top of the wall', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887235/Put_the_cat_on_top_of_the_wall_kmh4oy.mp3' },
    B: { text: 'Put the flower at the bottom of the wall', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887235/Put_the_flower_at_the_bottom_of_the_wall_fhaylt.mp3' },
  },
  2: {
    A: { text: 'Put the bike in front of the car', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887235/Put_the_bike_in_front_of_the_car_dodyzs.mp3' },
    B: { text: 'Put the truck behind the car', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887235/Put_the_truck_behind_the_car_e2cg7f.mp3' },
  },
  3: {
    A: { text: 'Put the toy car inside the box', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887234/Put_the_toy_car_inside_the_box_cemgsb.mp3' },
    B: { text: 'Put the teddy bear outside the box', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887234/Put_the_teddy_bear_outside_the_box_qmyc0t.mp3' },
  },
  4: {
    A: { text: 'Put the fork to the left of the plate', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887234/Put_the_fork_to_the_left_of_the_plate_lnajfc.mp3' },
    B: { text: 'Put the knife to the right of the plate', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793887234/Put_the_knife_to_the_right_of_the_plate_dl3ldf.mp3' },
  },
};

// ---------------------------------------------------------------------------
// SCENE 4 — THE BUILDING. FIVE questions per run, one per floor.
// ---------------------------------------------------------------------------
// THE SAME FIVE CLIPS SERVE EVERY RUN, even though the floors asked about are
// picked at random. So this table has a row for ALL TEN FLOORS, keyed 1-10
// (1 = the ground floor), and the scene looks up the one its current question
// happens to be about. Ten clips cover every possible run; a run uses five of them.
//
// That is why this cannot be keyed by round: the round number carries no
// information about which floor is being asked.
//
// The sentence spells the ordinal ("third", never "3") because the floor numbers
// are painted on the wall as DIGITS — the child matches a word to a digit, which
// is the whole exercise.
const BUILDING = {
  // `say` is what the recording should contain; `voice` is the URL.
  // Each line is the same question with a different ordinal.
  1: { say: 'Which animal is on the first floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889538/1st_jnhw9d.mp3' },
  2: { say: 'Which animal is on the second floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889536/2nd_xmosmf.mp3' },
  3: { say: 'Which animal is on the third floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889535/3rd_qldfiy.mp3' },
  4: { say: 'Which animal is on the fourth floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889535/4th_jah06i.mp3' },
  5: { say: 'Which animal is on the fifth floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889535/5th_pgxupz.mp3' },
  6: { say: 'Which animal is on the sixth floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889535/6th_hwpdyv.mp3' },
  7: { say: 'Which animal is on the seventh floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889534/7th_jsipy6.mp3' },
  8: { say: 'Which animal is on the eighth floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889533/8th_v5axgl.mp3' },
  9: { say: 'Which animal is on the ninth floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889533/9th_p8rpqm.mp3' },
  10: { say: 'Which animal is on the tenth floor?', voice: 'https://res.cloudinary.com/hijmipga/video/upload/v1793889534/10th_jggcks.mp3' },
};

// The on-screen sentence is DERIVED from the row's `say`, so the text a child
// reads and the voice they hear can never say different ordinals. Building one
// from the other means there is only one place to edit.
Object.keys(BUILDING).forEach((floor) => {
  BUILDING[floor].text = BUILDING[floor].say;
});

export const PROMPTS = {
  mirror: MIRROR,
  positions: POSITIONS,
  building: BUILDING,
};

// Scene 1's table is exported separately because it is looked up by CLUE, not by
// round — see the comment above it.
export const SHAPES_AUDIO = SHAPES_CLUES;

// ---------------------------------------------------------------------------
// LOOKUP
// ---------------------------------------------------------------------------

/**
 * The prompt row for one moment of the run.
 *
 * `round` IS ALREADY 1-BASED. Every caller passes `position.round + 1`, because
 * the tables are written the way a human reads them ("round 3's axis") while the
 * hub counts from 0.
 *
 * This used to add another +1 here, which shifted every lookup up by one: scene 2
 * showed no prompt at all on its LAST round, and scene 3's fourth portrait looked
 * up a missing row. The conversion happens at the CALL SITE, exactly once.
 *
 * @param {string} sceneId   'shapes' | 'mirror' | 'positions' | 'building'
 * @param {number} round     1-based round (portrait), as the tables are keyed
 * @param {object} [extra]
 * @param {'A'|'B'} [extra.slot]  scene 3 only: which of the portrait's two prompts
 * @param {number} [extra.floor]  scene 4 only: the 1-based floor being asked about
 * @returns {{text: string, voice: string|null}|null}
 */
export function promptRow(sceneId, round, extra = {}) {
  const table = PROMPTS[sceneId];
  if (!table) return null;

  // Scene 3 is keyed by portrait, then by slot; scene 4 by floor.
  if (sceneId === 'positions') {
    const portrait = table[round];
    if (!portrait) return null;
    return portrait[extra.slot] ?? portrait.A ?? null;
  }

  if (sceneId === 'building') {
    return table[extra.floor] ?? null;
  }

  return table[round] ?? null;
}

/**
 * The voice URL for a moment of the run, or null when there isn't one.
 *
 * A null here is NORMAL, not an error: the text ships before the recordings do.
 */
export function voiceFor(sceneId, round, extra = {}) {
  // Scene 1's clip is chosen by the CLUE the reel landed on — the on-screen text is
  // the same instruction every round, but the recording names the clue.
  if (sceneId === 'shapes') return clueVoiceFor(extra.clue);

  // THE ROW'S OWN CLIP ONLY — never a neighbour's. This is the "a prompt appeared,
  // speak it if it has a recording" path, and scene 2 relies on it being strictly
  // per-row so that rounds 2 and 3 stay silent.
  //
  // The fallback for a MANUAL replay lives in `voiceKeyAndUrlFor`; routing this
  // function through that was a bug: every scene-2 round replayed round 1's clip
  // automatically.
  const url = promptRow(sceneId, round, extra)?.voice;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/**
 * The audio KEY and URL for a row, which may be an EARLIER row's clip.
 *
 * WHY THIS IS NOT JUST `round`: a scene that asks the same thing every round
 * records it ONCE (scene 2), leaving `voice: null` on the later rows. Playing
 * nothing on round 2 would be correct; playing nothing when the child presses
 * "say it again" is not — they are asking to hear the instruction they are
 * currently following, and that instruction is round 1's clip.
 *
 * So a missing URL walks BACKWARDS to the nearest earlier row that has one. That
 * is only ever the same sentence by construction (a scene that changed its wording
 * per round would have a recording per round), so the fallback cannot speak the
 * wrong instruction.
 *
 * Scene 3 is excluded: its rows change every prompt, so there is nothing to fall
 * back to — a prompt with no recording is simply silent.
 *
 * @returns {{key: string|null, url: string|null, fromRound: number|null}}
 */
export function voiceKeyAndUrlFor(sceneId, round, extra = {}) {
  if (sceneId === 'shapes') {
    const clue = extra.clue;
    const url = clueVoiceFor(clue);
    return { key: clue ? clueVoiceKey(clue) : null, url, fromRound: null };
  }

  // Scene 3 changes its sentence every prompt: no fallback, or it would speak a
  // different instruction from the one on screen.
  if (sceneId === 'positions') {
    const key = voiceKeyFor(sceneId, round, extra);
    const row = promptRow(sceneId, round, extra);
    const url = typeof row?.voice === 'string' && row.voice.length > 0 ? row.voice : null;
    return { key, url, fromRound: url ? round : null };
  }

  // Scene 4 is keyed by FLOOR, so its "row" is not a run position and cannot be
  // walked; one clip per floor, always.
  if (sceneId === 'building') {
    const key = voiceKeyFor(sceneId, round, extra);
    const row = promptRow(sceneId, round, extra);
    const url = typeof row?.voice === 'string' && row.voice.length > 0 ? row.voice : null;
    return { key, url, fromRound: url ? round : null };
  }

  // Mirror: walk backwards from this round to the nearest recorded one.
  for (let r = round; r >= 1; r -= 1) {
    const url = promptRow(sceneId, r, extra)?.voice;
    if (typeof url === 'string' && url.length > 0) {
      return { key: voiceKeyFor(sceneId, r, extra), url, fromRound: r };
    }
  }
  return { key: null, url: null, fromRound: null };
}

/**
 * The voice URL for ONE CLUE CARD — scene 1 only.
 *
 * @param {string} clue  the clue text, exactly as rounds.js writes it
 * @returns {string|null}
 */
export function clueVoiceFor(clue) {
  const url = SHAPES_CLUES[clue]?.voice;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/** The audio key for one clue card. */
export function clueVoiceKey(clue) {
  return `voice-shapes-clue-${slugFor(clue)}`;
}

/**
 * A stable, URL-safe fragment for a clue.
 *
 * Derived from the clue's TEXT (not its position), so re-ordering ROUND_PLAN
 * cannot orphan a recording — the clue IS the identity here.
 */
function slugFor(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The prompt TEXT for a moment of the run, or '' when there isn't one.
 *
 * Scene 1 has no entry here on purpose: its on-screen sentence comes from
 * rounds.js (`PROMPT_ONE` / `PROMPT_TWO`, via `roundData.prompt`), because it is
 * the same generic instruction every round. Only the AUDIO varies.
 */
export function textFor(sceneId, round, extra = {}) {
  if (sceneId === 'shapes') return '';
  return promptRow(sceneId, round, extra)?.text ?? '';
}

/**
 * Every voice URL in the file, as Phaser audio manifest entries.
 *
 * Imported by assets.js so the preload screen covers every voice line. Only rows
 * that actually have a URL produce an entry, so the table can be half-filled
 * while the recordings are being made.
 *
 * Keys are derived from the row's identity (`voice-shapes-1`, `voice-building-7`,
 * `voice-positions-3-A`), NOT from the text — so editing a sentence does not
 * orphan its audio. That derivation is shared with `voiceKeyFor()` below.
 */
export function voiceManifest() {
  const out = [];

  const push = (key, url) => {
    if (typeof url === 'string' && url.length > 0) {
      out.push({ type: 'audio', key, url });
    }
  };

  // Scene 1: ONE entry per clue card — each clip says the whole sentence.
  Object.entries(SHAPES_CLUES).forEach(([clue, row]) => push(clueVoiceKey(clue), row.voice));

  Object.entries(MIRROR).forEach(([round, row]) => push(voiceKeyFor('mirror', round), row.voice));

  Object.entries(POSITIONS).forEach(([portrait, pair]) => {
    push(voiceKeyFor('positions', portrait, { slot: 'A' }), pair.A?.voice);
    push(voiceKeyFor('positions', portrait, { slot: 'B' }), pair.B?.voice);
  });

  Object.entries(BUILDING).forEach(([floor, row]) =>
    push(voiceKeyFor('building', floor, { floor: Number(floor) }), row.voice)
  );

  return out;
}

/**
 * The Phaser audio KEY for a prompt row.
 *
 * Derived from IDENTITY (scene + round/floor/slot), never from the text, so
 * re-wording a prompt leaves its recording attached. The manifest above and the
 * hub's playback both go through this, so the two cannot disagree.
 *
 * Note the 0-based/1-based split: rounds are passed here 1-BASED, because that is
 * how the tables are written and read by a human.
 */
export function voiceKeyFor(sceneId, roundOrFloor, extra = {}) {
  if (sceneId === 'positions') return `voice-positions-${roundOrFloor}-${extra.slot ?? 'A'}`;
  if (sceneId === 'building') return `voice-building-${roundOrFloor}`;
  // Scene 1's instruction half is keyed by shape COUNT, not by round — the rounds
  // are shuffled, so a round-keyed prompt would be the wrong sentence half the time.
  if (sceneId === 'shapes') return `voice-shapes-prompt-${extra.count ?? roundOrFloor}`;
  return `voice-${sceneId}-${roundOrFloor}`;
}
