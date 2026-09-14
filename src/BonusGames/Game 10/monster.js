// monster.js
// The shape monster, assembled from separate art parts (body / head / two eyes
// / three mouth states) rather than one baked sprite. Keeping the parts split
// means the mouth and eyes can act independently of the body, and the whole
// thing can be re-posed without touching GameScene.
//
// Everything about the monster's look and motion lives in MONSTER_POSE below —
// adjust the numbers there, not in GameScene.
//
// Reference (unscaled) texture sizes, used to reason about the pose numbers:
//   monster-body  250x150
//   monster-head  250x250
//   monster-eye   250x250  (the visible iris fills only the middle portion —
//                           the canvas has generous transparent padding, which
//                           is why its scale reads much smaller than the art)
//   monster-mouth 250x250  (same: the mouth occupies a shallow band mid-canvas)
//   monster-leg   250x250  (art nearly fills the canvas: a foot with the toes
//                           along the bottom edge, so it scales up fast)

// ---------------------------------------------------------------------------
// TUNING BLOCK — adjust these to move/resize/animate any part of the monster.
// ---------------------------------------------------------------------------
// Each part is positioned relative to the assembly origin (the monster's own
// x/y below) and scaled independently. `scale` is relative to the texture's
// natural size, so 1 = exactly as authored.
//
// TIP: the eye and mouth textures are mostly transparent padding, so their
// scales look small for how large they appear. If a part is the wrong size,
// change its `scale`; if it's in the wrong place, change its `x`/`y`.
export const MONSTER_POSE = {
  // Where the monster sits on the 720x1080 canvas. This is the assembly's
  // origin, which every part's x/y is measured from.
  x: 556,
  y: 950,

  body: { x: 0, y: -30, scale: 1.3 },

  // Head is its own group so a refusal can shake it without moving the body.
  head: { x: 0, y: -178, scale: 0.9 },

  eye: { y: -170, scale: 0.3 },

  mouth: { x: 0, y: -110, scale: 0.7 },

  // --- legs ----------------------------------------------------------------

  // The legs are two separate sprites of the same right-foot art (mirrored),
  // drawn BEHIND the body so their tops tuck under its lower edge. Because the
  // art nearly fills its canvas and the toes sit right on the bottom edge,
  // raising `scale` also grows them downward — if the feet sink through the
  // floor, nudge `leg.y` up rather than shrinking them.

  // Sideways offset of each leg from the monster's centre, in px. Wider legs
  // move outward, narrower legs tuck toward the middle.
  legGap: 62,

  // Right leg. `x` is the +side of legGap; it wears the art as authored.
  leg: { x: 0, y: +40, scale: 0.45 },

  // Left leg. `x` is the -side of legGap; the art is mirrored, exactly like
  // the right eye. Both legs share `y` and `scale` with the right one above —
  // there are no separate numbers for them, so the pair can never drift apart.
  legLeft: { x: 0 },

  // How far apart the eyes sit, in px. Applied as ±eyeGap from the head's
  // centre, and honoured by both the resting positions and the follow/drift
  // offsets, so changing this one number moves the pair symmetrically.
  eyeGap: 40,

  // --- overall size --------------------------------------------------------

  // THE size knob. Every offset and every part scale above is multiplied by
  // this, so the monster can be grown or shrunk as a whole without re-tuning
  // a dozen numbers — and without the parts sliding out of alignment with each
  // other, which is what would happen if each part's scale were edited alone.
  //
  // The distances that live OUTSIDE this file are derived from this, so it is
  // still the only number you need to change:
  //   - GameScene's walk limits, contact shadow and landing pad, via
  //     MONSTER_WORLD_SCALE
  //   - GameScene's FEET_Y, via MONSTER_FEET_Y
  // Those derived exports sit just below this block.
  //
  // Monsters: the CATCH ZONE deliberately does not scale with this. Shrinking
  // the monster is a change of look, not of difficulty — see the note on
  // MONSTER_FEED_RADIUS_X/Y.
  scale: 0.7,

  // --- motion --------------------------------------------------------------

  // Idle "breathing": how far the whole monster rises, and how long one
  // half-cycle takes. Moves body + head together.
  idleBob: 9,
  idleDuration: 1400,

  // Body-only squash/stretch on top of the idle bob, so the body has its own
  // life instead of moving as one rigid block with the head. Expressed as a
  // fraction of the body scale: 0.035 = 3.5% wider while 3.5% shorter.
  bodyBreathe: 0.035,
  bodyBreatheMs: 1150,

  // How far the head swings during a refusal shake.
  refuseShake: 12,

  // Reaction to being tapped: a small hop in px, layered on top of the idle
  // bob, plus an extra squash pulse on the body.
  pokeHop: 16,

  // How long each one-shot mouth expression stays up before returning to idle.
  // Eating is deliberately long — it's the reward beat, and it needs to still
  // be visible while the shape's shrink-into-mouth tween plays out.
  mouthHoldEating: 950,
  mouthHoldRefuse: 620,

  // --- catching -------------------------------------------------------------
  // The monster is walked left/right by the player, and leans into its own
  // movement so it reads as a body being steered rather than a sprite sliding
  // along the floor.

  // How far the head leads toward the direction of travel, in px. Only the
  // face shifts — the body stays put — which is what makes it a lean instead
  // of the whole monster sliding further than the player asked for.
  headLead: 26,

  // How fast the lean eases in and out, in ms. Long enough to be visible (it's
  // a cue), short enough to keep up with a fast swipe. Because the lean tracks
  // the direction of travel and this tween takes time to get there, flicking
  // back and forth produces a natural swing rather than a snap.
  headLeadMs: 160,

  // --- the eat pose ---------------------------------------------------------
  // One coordinated pose, driven by one approach: as a shape drops in, the
  // monster rears up, the mouth opens wide, and the head and eyes squeeze
  // behind it. Everything below shares `anticipateMs` and `anticipateHoldMs`
  // so the parts move as a single gesture — staggering them is what made the
  // old build read as several separate animations happening at once.

  // How long the ease into the pose takes, how long it holds, and how long the
  // settle back takes. The hold is refreshed by every re-approach, so a run of
  // incoming shapes holds the pose rather than pumping in and out of it.
  anticipateMs: 140,
  anticipateHoldMs: 140,
  settleMs: 180,

  // The rear-up: the whole assembly rises this many px and grows this much
  // taller. Applied to the assembly rather than the head alone, so the legs
  // stretch with it instead of detaching from the floor.
  anticipateRise: 16,
  anticipateStretch: 1.14,

  // The gape. Kept close to equal on both axes so the mouth grows outward in
  // every direction at once, rather than being pulled sideways.
  //
  // Y is slightly the larger of the two because the wide-mouth art's visible
  // shape is 124x115 — marginally wider than tall — so matching the proportions
  // needs a touch more height to come out square.
  mouthGapeX: 1.5,
  mouthGapeY: 1.6,

  // How far the mouth lifts while gaping, in px, as a correction.
  //
  // The wide-mouth art's visible shape sits slightly lower inside its canvas
  // than the idle mouth's does, so swapping the texture alone drops the mouth a
  // little even with the pivot centred. This nudges it back up — deliberately
  // small, roughly cancelling the offset rather than being a movement of its
  // own. Correct it here if the swap ever lands differently.
  mouthGapeRise: 11,

  // The squeeze. The head pinches in horizontally (a neck-craning gulp) while
  // the eyes squash down behind the gape. The head only narrows rather than
  // changing height, so it doesn't collide with the mouth stretching upward
  // past it.
  headSqueeze: 0.86,
  eyeSqueeze: 0.45,

  // Sulking after a miss: the head droops by this many px and the monster does
  // a small disappointed hop. `sulkMs` is one half-cycle.
  sulkDroop: 18,
  sulkMs: 200,

  // --- walking --------------------------------------------------------------
  // The legs are a mirrored pair of the same single foot sprite, so there is no
  // shin or ankle to bend and no second art frame. The walk has to come from
  // transforming those two simple feet until they read as a step.
  //
  // The monster faces the camera, so the feet STAY ON THE FLOOR and stretch
  // downward/outward, the way a front-facing character's legs do when it walks
  // across the screen:
  //
  //     reach out (leg stretches longer as it plants forward)
  //   ──────────────────────────────────────────  floor
  //        drag back (leg compresses as it's overtaken)
  //
  // Lifting a foot off the ground was the previous approach and it read wrong —
  // at this art scale the legs are short and stubby, so any visible lift looked
  // like the monster was hopping rather than walking.
  //
  // Everything below is expressed as a multiple of the leg's own size, so the
  // walk stays correct at any legGap or overall monster scale.

  // How far each leg travels toward the centre line, as a fraction of the
  // distance from its resting spot to the centre. Both stay well under 1, or
  // the two feet would meet in the middle and read as one leg.
  //
  // They differ deliberately: the reaching leg extends further than the trailing
  // one pulls back, so the pair never mirrors — a real step has a clear leader.
  walkLeadOut: 0.55,
  walkTrailIn: 0.32,

  // How much the leg EXTENDS downward as it reaches, and how much it compresses
  // as it's left behind. 1 is the authored length. The reach is the bigger of
  // the two: a leg stretching to plant is the readable half of a step.
  //
  // These are the walk's main effect now that the lift is gone — they're what
  // makes the leg look like it's pushing the ground away.
  reachStretch: 1.22,
  trailSquash: 0.9,

  // How much the leg narrows as it extends. A leg that stretches without
  // thinning reads as a leg being pulled, not one reaching — this is what sells
  // it as extension rather than scale. As a fraction: 0.88 = 12% thinner.
  reachThin: 0.88,

  // A small bob on the ASSEMBLY, not the legs, on the double frequency — one
  // dip per footfall rather than one per cycle. The legs stay planted; the body
  // sinks onto whichever foot just landed. This is what gives the walk its
  // weight now that the feet no longer leave the floor.
  //
  // Kept small: the idle breathing already owns a much larger vertical move on
  // a different group, and the two are deliberately layered rather than merged.
  walkBob: 5,

  // The foot tilts while it's reaching — toes out on the way forward, flat as it
  // plants. In degrees. `walkPitchTrail` is the trailing leg's opposite lean, so
  // the pair scissor rather than tilting together.
  walkPitch: 14,
  walkPitchTrail: 9,

  // Sideways sway while reaching, as a fraction of reach. The foot arcs rather
  // than travelling in a straight line, which is what a leg swinging from a hip
  // does.
  walkSway: 0.16,

  // The trailing foot stretches slightly along its travel while dragging back,
  // as if peeling off the floor.
  walkDragStretch: 1.12,

  // The step length in pixels per full cycle. One complete loop covers this much
  // ground, so the feet stay locked to the floor at any speed: walk twice as
  // fast and the legs cycle twice as fast, rather than skating.
  //
  // This replaced a bare magic number in updateWalk — it's the single place to
  // change how long a stride is.
  walkGroundPerCycle: 167,

  // Below this speed (px/s) the legs settle back to standing rather than
  // shuffling on the spot.
  walkMinSpeed: 26,

  // How quickly the walk winds up and down, so starting and stopping don't
  // snap. `walkEaseMs` is the ramp; `walkSettleMs` the return to standing.
  walkEaseMs: 140,
  walkSettleMs: 200,

  // --- eye motion ----------------------------------------------------------

  // How far the pupils can swing toward a held shape. Small numbers — the eyes
  // are big and round, so even a few pixels of travel reads clearly. Raise
  // these if the follow is too subtle, or lower them if the pupils slide off
  // the head.
  eyeFollow: { x: 16, y: 12 },

  // The much smaller idle wander, so the monster looks alive when nothing is
  // being dragged.
  eyeDrift: 4,
  eyeDriftEveryMs: [1500, 2800],

  // Random gap between blinks.
  blinkEveryMs: [2400, 5200],
};

// The catch zone is the head — its exact drawn extents, not a generous
// approximation of them. Food has to reach the FACE to be eaten; a shape that
// hits the body or the legs is just a miss.
//
// Derived from the head's own numbers so it can never drift out of step with
// it. The art's visible pixels span 248x233 of its 250x250 canvas.
//
// Two effects compose here, which is easy to get wrong: the head sits inside
// the assembly (scaled by `scale`), and the head sprite carries its own
// `head.scale` on top of that. Both apply.
const HEAD_ART_W = 248;
const HEAD_ART_H = 233;
const HEAD_WORLD_SCALE = MONSTER_POSE.head.scale * MONSTER_POSE.scale;

export const MONSTER_CATCH_RADIUS_X = (HEAD_ART_W / 2) * HEAD_WORLD_SCALE;
export const MONSTER_CATCH_RADIUS_Y = (HEAD_ART_H / 2) * HEAD_WORLD_SCALE;

// Where the head sits, relative to the monster's own origin. The catch test
// centres on this rather than on the mouth, because the mouth is only the lower
// part of the face — centring there would stop the monster catching anything
// that hits its forehead or eyes.
export const MONSTER_HEAD_DY = MONSTER_POSE.head.y * MONSTER_POSE.scale;

// Where the monster starts each run, horizontally. Centre of the canvas rather
// than MONSTER_POSE.x, so the walk range is visibly symmetrical — starting in
// the right-hand corner would make the first shape of a round feel like a
// scramble to the middle.
export const MONSTER_START_X = 360;

// The pose scale, exported so GameScene can size its own floor furniture (the
// contact shadow, the landing pad) in the same proportion.
export const MONSTER_WORLD_SCALE = MONSTER_POSE.scale;

// How far the leg art hangs below the leg sprite's own origin. The texture is
// 250px tall with visible art from y 23 to y 224, so the art's bottom edge sits
// 100.5px below the sprite's centre. This matters because `leg.y` positions
// that CENTRE, not the feet — treating leg.y as the foot line puts the contact
// shadow ~32px up in the air.
const LEG_ART_BELOW_ORIGIN = 100.5;

// Where the monster's feet actually meet the floor, in world y.
//
// The root y is an absolute canvas coordinate and is deliberately NOT scaled;
// only the offsets from it are, which is what lets the monster be shrunk
// without it drifting up or down the screen.
export const MONSTER_FEET_Y =
  MONSTER_POSE.y +
  (MONSTER_POSE.leg.y + LEG_ART_BELOW_ORIGIN * MONSTER_POSE.leg.scale) *
    MONSTER_POSE.scale;

// How far in from each canvas edge the monster's centre may be steered, i.e.
// the walk range is [MONSTER_TRAVEL_MARGIN, width - MONSTER_TRAVEL_MARGIN].
//
// Scaled with the monster so a shrunk monster isn't needlessly forbidden from
// reaching the edges. It also has to stay SMALL enough to reach every spawn
// lane: at 140 the range is x 140..580, and the catch radius covers the full
// 150..570 spawn band.
export const MONSTER_TRAVEL_MARGIN = Math.round(200 * MONSTER_POSE.scale);

// Draw order relative to the rest of the scene. Above the flying shapes (6) so
// they pass behind it, below the HUD (20+) and the red flash (85).
export const MONSTER_DEPTH = 12;

// ---------------------------------------------------------------------------
// Art — spread into IMAGES by assets.js so the monster's textures are declared
// next to the code that uses them.
// ---------------------------------------------------------------------------
export const MONSTER_IMAGE_URLS = {
  'monster-body': 'https://res.cloudinary.com/hijmipga/image/upload/v1789371314/monster-body_yj09kg.png',
  'monster-head': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311501/monster-head_c2jsjw.png',
  'monster-eye': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-lefteye_m2wksp.png',
  'monster-mouth-idle': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311499/monster-mouth-idle_lnlb87.png',
  'monster-mouth-eating': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-mouth-eating_ydap6n.png',
  'monster-mouth-refuse': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-mouth-refuse_v6nrpj.png',
  'monster-mouth-wide': 'https://res.cloudinary.com/hijmipga/image/upload/v1789376721/monster-mouth-wide_smqn8f.png',
  'monster-leg':'https://res.cloudinary.com/hijmipga/image/upload/v1789371325/monster-right-leg_bgz43g.png', //right leg. flip it for left.
};

const MOUTH_TEXTURES = {
  idle: 'monster-mouth-idle',
  eating: 'monster-mouth-eating',
  refuse: 'monster-mouth-refuse',
  // Held only for as long as the eat pose lasts. Swapped in by anticipate() and
  // taken back out by settleAnticipation() — it is never a resting expression.
  wide: 'monster-mouth-wide',
};

// Multiplies positional offsets and part scales in the pose by the overall
// `scale`, so the rest of this file can read plain numbers and stay unaware
// that scaling exists.
//
// Only LENGTHS are listed here. Two kinds of key must stay out:
//   - timings (in ms) — scaling those would make a smaller monster animate
//     faster, which is not what shrinking something means;
//   - ratios (mouthOpenStretch, headSqueeze, …) — already relative, so
//     scaling them would compound.
const LENGTH_KEYS = new Set([
  'x',
  'y',
  'scale',
  'legGap',
  'eyeGap',
  'idleBob',
  'headLead',
  'anticipateRise',
  'pokeHop',
  'sulkDroop',
  'refuseShake',
  'eyeDrift',
]);

// Walking is expressed as RATIOS of the leg's own size (see the walking block
// in MONSTER_POSE), so none of it needs scaling — and the one absolute number
// it derives from, the leg width, is scaled at the call site in updateWalk().

/**
 * @param {object} source
 * @param {number} factor
 * @param {boolean} isRoot Top-level pass, where x/y mean something different.
 */
function scalePose(source, factor, isRoot = true) {
  const out = {};
  Object.keys(source).forEach((key) => {
    const value = source[key];

    // The root x/y are where the monster STANDS on the canvas — absolute
    // coordinates, not offsets from anything. Scaling them would move a
    // shrunk monster toward the top-left corner instead of just making it
    // smaller, so they're passed through untouched. Every nested x/y is a real
    // offset from its parent and does scale.
    const isCoordinate = isRoot && (key === 'x' || key === 'y');

    if (!isCoordinate && LENGTH_KEYS.has(key) && typeof value === 'number') {
      out[key] = value * factor;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = scalePose(value, factor, false);
    } else {
      out[key] = value;
    }
  });
  return out;
}

// Distance at which a tracked point deflects the eyes fully. Anything nearer
// scales down proportionally, so the pupils ease off as the shape approaches.
// Kept fairly tight because the monster and the shapes share the same lane — a
// large range would leave the deflection barely off centre for most of a drop.
const EYE_FOLLOW_RANGE = 270;

// How long the eyes stay shut after a tap.
const MOUTH_HOLD_POKE_MS = 260;

function randBetween([min, max]) {
  return min + Math.random() * (max - min);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Builds the monster at (MONSTER_POSE.x, MONSTER_POSE.y) and returns a small
 * API for driving it. The idle bob, body breathing, eye drift and blinking all
 * start immediately.
 *
 * @returns {{
 *   container: Phaser.GameObjects.Container,
 *   getMouth: () => { x: number, y: number },
 *   setMouth: (name: 'idle'|'eating'|'refuse') => void,
 *   chomp: () => void,
 *   refuse: () => void,
 *   reactToPoke: () => void,
 *   lean: (dir: -1|0|1) => void,
 *   anticipate: () => void,
 *   sulk: () => void,
 *   lookAt: (worldX: number, worldY: number) => void,
 *   stopLooking: () => void,
 *   destroy: () => void,
 * }}
 */
export default function createMonster(scene) {
  // Every read of `pose` below is a plain unscaled number; the overall size
  // knob is applied here, once, so no call site has to remember to do it.
  const pose = scalePose(MONSTER_POSE, MONSTER_POSE.scale);

  // The container chain exists so every animated property has exactly ONE
  // owner. Phaser writes each active tween's value every frame, so two tweens
  // on the same property fight and the motion snaps — which is what made a
  // spammed tap look broken. Walking outward from the parts:
  //
  //   container       → x, y        the monster's position, set by GameScene
  //                                 as it steers left/right
  //   bobGroup        → y           idle breathing loop
  //   hopGroup        → y           tap reaction / sulk hop
  //   walkGroup       → y           the step bob, one dip per footfall
  //   stretchGroup    → y, scaleX/Y the rear-up as a shape arrives
  //   leanGroup       → x           lean into the direction of travel
  //     bodyGroup     → scaleX/Y    body breathing + squash pulses
  //     faceGroup     → x, y, scale head + mouth + eyes, incl. refusal shake
  //
  // The lean deliberately sits INSIDE the stretch so the two transforms
  // compose cleanly: leaning shifts the whole monster's inner assembly, while
  // stretching scales it about its own feet.
  const container = scene.add.container(pose.x, pose.y).setDepth(MONSTER_DEPTH);
  const bobGroup = scene.add.container(0, 0);
  const hopGroup = scene.add.container(0, 0);
  const walkGroup = scene.add.container(0, 0);
  const stretchGroup = scene.add.container(0, 0);
  const leanGroup = scene.add.container(0, 0);
  container.add(bobGroup);
  bobGroup.add(hopGroup);
  hopGroup.add(walkGroup);
  walkGroup.add(stretchGroup);
  stretchGroup.add(leanGroup);

  // Draw order back to front: legs, body, then the head group on top. The legs
  // are added first so the body covers where they meet — without that overlap
  // the two hard edges read as the feet being glued on rather than attached.
  const legLeft = scene.add
    .image(-pose.legGap + pose.legLeft.x, pose.leg.y, 'monster-leg')
    .setScale(pose.leg.scale)
    .setFlipX(true);
  const legRight = scene.add
    .image(pose.legGap + pose.leg.x, pose.leg.y, 'monster-leg')
    .setScale(pose.leg.scale);

  // The leg art's VISIBLE size, measured off the texture's opaque bounds rather
  // than its canvas. The canvas is 250x250 but the foot inside it spans roughly
  // x 20..230 and y 23..224, so using the canvas size would overstate both
  // dimensions by about 15%. The walk scales its lift and sway by these.
  const legBaseW = 210;
  const legBaseH = 201;

  // The body and the head are each wrapped in their own container, because the
  // two animate on the same property but must never share a tween target:
  // bodyGroup breathes and pulses, while faceGroup leans, droops and stretches
  // the head. Writing both onto the raw sprites would have them fight.
  const bodyGroup = scene.add.container(0, 0);
  const body = scene.add
    .image(pose.body.x, pose.body.y, 'monster-body')
    .setScale(pose.body.scale);
  bodyGroup.add(body);

  const faceGroup = scene.add.container(0, 0);
  const head = scene.add
    .image(pose.head.x, pose.head.y, 'monster-head')
    .setScale(pose.head.scale);

  const eyeLeft = scene.add
    .image(-pose.eyeGap, pose.eye.y, 'monster-eye')
    .setScale(pose.eye.scale);
  // The right eye is the same art flipped, so the pair is always symmetrical.
  const eyeRight = scene.add
    .image(pose.eyeGap, pose.eye.y, 'monster-eye')
    .setScale(pose.eye.scale)
    .setFlipX(true);

  // The mouth gets its own container because two unrelated things scale it: the
  // quick pop when a different expression swaps in (on the sprite), and the
  // deliberate gape when a shape arrives (on the container). Writing both to
  // the sprite would have them fight, exactly like the body/bob conflict.
  // The group sits AT the mouth's resting position and the sprite sits at the
  // group's origin, rather than the other way round.
  //
  // This matters because the gape scales mouthGroup: with the group at (0,0)
  // and the sprite offset by pose.mouth.y, that offset was scaled too, and the
  // mouth visibly drifted upward (or down) as it grew instead of opening in
  // place. Centring the pivot on the mouth also means it expands from its own
  // middle, which is what reads as a mouth opening.
  const mouthGroup = scene.add.container(pose.mouth.x, pose.mouth.y);
  const mouth = scene.add
    .image(0, 0, MOUTH_TEXTURES.idle)
    .setScale(pose.mouth.scale);
  mouthGroup.add(mouth);

  faceGroup.add([head, eyeLeft, eyeRight, mouthGroup]);
  // Legs first so the body covers where they meet — without that overlap the
  // two hard edges read as the feet being glued on rather than attached.
  leanGroup.add([legLeft, legRight, bodyGroup, faceGroup]);

  // --- mouth ---------------------------------------------------------------
  // Expressions are opaque art on transparent canvases, so there's nothing to
  // blend between — the change is what needs animating. A quick overshoot pop
  // on swap keeps it from reading as a hard jump-cut.

  let mouthPopTween = null;
  let mouthReset = null;
  let pokeLidTimer = null;
  let chompTween = null;
  let refuseTween = null;
  let pokeTween = null;
  let activeMouth = 'idle';

  function mouthHoldFor(name) {
    if (name === 'eating') return pose.mouthHoldEating;
    if (name === 'refuse') return pose.mouthHoldRefuse;
    return 0;
  }

  function setMouth(name) {
    const key = MOUTH_TEXTURES[name] || MOUTH_TEXTURES.idle;
    if (!scene.textures.exists(key) || activeMouth === name) return;
    activeMouth = name;
    mouth.setTexture(key);

    if (mouthPopTween) mouthPopTween.stop();
    mouth.setScale(pose.mouth.scale * 0.85);
    mouthPopTween = scene.tweens.add({
      targets: mouth,
      scaleX: pose.mouth.scale,
      scaleY: pose.mouth.scale,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        mouth.setScale(pose.mouth.scale);
        mouthPopTween = null;
      },
    });
  }

  // Shows a one-shot expression, then falls back to idle after its hold time.
  // `onRelease` fires as the expression ends, which is what reopens the eyes.
  function flashMouth(name, onRelease) {
    setMouth(name);
    if (mouthReset) mouthReset.remove(false);
    mouthReset = scene.time.delayedCall(mouthHoldFor(name), () => {
      mouthReset = null;
      setMouth('idle');
      if (onRelease) onRelease();
    });
  }

  // Takes the wide-open mouth back out when the eat pose ends.
  //
  // Only acts if the wide mouth is STILL the active expression. A chomp or a
  // refusal can fire during the pose — that's the normal case, since the shape
  // lands while the monster is gaping — and in that case the mouth is already
  // showing eating or refuse, with its own timer to return it to idle. Forcing
  // idle from here would cut that expression short mid-way.
  function mouthResetRestore() {
    if (activeMouth === 'wide') setMouth('idle');
  }

  // --- body ----------------------------------------------------------------
  // All of these drive bodyGroup rather than the raw sprite, so the breathing
  // and the squash pulses stay the only things writing this scale.

  let bodyBreatheTween = null;
  let bodyPulseTween = null;

  function startBodyBreathe() {
    if (bodyBreatheTween) bodyBreatheTween.stop();
    bodyGroup.setScale(1);
    bodyBreatheTween = scene.tweens.add({
      targets: bodyGroup,
      scaleX: 1 + pose.bodyBreathe,
      scaleY: 1 - pose.bodyBreathe,
      duration: pose.bodyBreatheMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // A quick squash-and-release. Suspends the breathing loop while it runs and
  // restarts it after, so the two aren't fighting over the body's scale.
  function pulseBody(scaleX, scaleY, duration) {
    if (bodyBreatheTween) {
      bodyBreatheTween.stop();
      bodyBreatheTween = null;
    }
    if (bodyPulseTween) bodyPulseTween.stop();
    bodyPulseTween = scene.tweens.add({
      targets: bodyGroup,
      scaleX,
      scaleY,
      duration,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        bodyGroup.setScale(1);
        bodyPulseTween = null;
        startBodyBreathe();
      },
    });
  }

  // --- eyes ----------------------------------------------------------------

  // Pupil travel, applied on top of each eye's resting position. Both eyes
  // share it so they always look the same way.
  const eyeOffset = { x: 0, y: 0 };
  let eyeTween = null;
  let eyeTracking = false;

  // Vertical squeeze, 1 = fully open. This single value is the eyes' ONLY
  // scaleY source, and every eye animation drives it rather than writing
  // scaleY directly:
  //
  //   blinking          tweens this 1 → 0.12 → 1
  //   closing the lids  tweens this 1 → closedScale
  //   the eat pose      tweens this 1 → eyeSqueeze
  //
  // This became necessary because `pose.eye.scale` (the overall size knob) is
  // also scaleY, so a tween writing an absolute scaleY would silently undo the
  // size setting. Driving a 0..1 multiplier on top of it keeps the size and the
  // expressions independent.
  //
  // Wrapped in an object because Phaser tweens mutate their target's properties
  // in place — a bare number can't be a tween target, since interpolating into
  // it would require assigning to a primitive.
  const eyeState = { squeeze: 1 };

  // Closes the eyes to this fraction of their height. The art is a circle, so
  // collapsing it vertically reads as a closed eye without a separate lid
  // graphic. Kept here rather than in MONSTER_POSE because it's a rendering
  // trick, not a look that needs tuning.
  const LID_CLOSED = 0.04;
  const BLINK_CLOSED = 0.12;

  function applyEyeOffset() {
    eyeLeft.setPosition(-pose.eyeGap + eyeOffset.x, pose.eye.y + eyeOffset.y);
    eyeRight.setPosition(pose.eyeGap + eyeOffset.x, pose.eye.y + eyeOffset.y);
  }

  // The one place the eyes' scale is written. Every animation calls this rather
  // than writing scaleY itself, so the overall size (pose.eye.scale) and the
  // current expression (eyeSqueeze) can never clobber each other.
  function applyEyes() {
    const sx = pose.eye.scale;
    const sy = pose.eye.scale * eyeState.squeeze;
    eyeLeft.setScale(sx, sy);
    eyeRight.setScale(sx, sy);
    applyEyeOffset();
  }

  // Eases the pupils toward (x, y). Re-tweening before the previous one has
  // finished *continues from the current offset* rather than restarting.
  //
  // This matters because GameScene calls lookAt() every frame while a shape is
  // held: creating a fresh tween each call and stopping the previous one means
  // the old tween never gets to advance before it's killed, so the offset would
  // sit at ~0 and the eyes would appear frozen. Re-tweens are throttled so the
  // travel actually has time to accumulate.
  let nextEyeMoveAt = 0;

  // Retargeting is throttled to ~30fps; the motion itself is carried by the
  // tween, so calling less often doesn't make it jerkier.
  const EYE_RETARGET_MS = 32;

  function moveEyesTo(x, y, duration, force = false) {
    const now = scene.time.now;
    if (!force && now < nextEyeMoveAt) return;
    nextEyeMoveAt = now + EYE_RETARGET_MS;

    // eyeOffset is the tween's own target, so it already holds the interpolated
    // position mid-flight. Stopping the tween leaves it there, and the new tween
    // starts from that value — i.e. the pupils continue from where they are
    // instead of snapping back to 0 and never appearing to move.
    if (eyeTween) eyeTween.stop();
    eyeTween = scene.tweens.add({
      targets: eyeOffset,
      x,
      y,
      duration,
      ease: 'Sine.easeOut',
      onUpdate: applyEyeOffset,
      onComplete: () => {
        eyeOffset.x = x;
        eyeOffset.y = y;
        applyEyeOffset();
        eyeTween = null;
      },
    });
  }

  // Idle wander: occasional small glances in a random direction.
  let driftEvent = null;
  function scheduleDrift() {
    driftEvent = scene.time.delayedCall(randBetween(pose.eyeDriftEveryMs), () => {
      // Skip while tracking a held shape — that would fight lookAt().
      if (!eyeTracking) {
        moveEyesTo(
          -pose.eyeDrift + Math.random() * pose.eyeDrift * 2,
          -pose.eyeDrift + Math.random() * pose.eyeDrift * 2,
          900
        );
      }
      scheduleDrift();
    });
  }
  scheduleDrift();

  // Eyes shut. Three things can want the eyes shut: chewing, refusing, and
  // being tapped. They're tracked independently so overlapping events can't
  // undo each other — a tap during a chomp must not reopen eyes that should
  // stay shut for the rest of the chew. The eyes reopen only once ALL of them
  // have released.
  let lidClosedForEat = false;
  let lidClosedForRefuse = false;
  let lidClosedForPoke = false;
  let eyeLidTween = null;

  function applyEyesClosed() {
    const closed = lidClosedForEat || lidClosedForRefuse || lidClosedForPoke;

    if (eyeLidTween) eyeLidTween.stop();
    // Drives eyeState.squeeze, not the eyes' scaleY — writing scaleY here would
    // both clobber the overall size setting and fight the eat pose's squeeze.
    const target = closed ? LID_CLOSED : 1;
    eyeLidTween = scene.tweens.add({
      targets: eyeState,
      squeeze: target,
      duration: closed ? 110 : 180,
      ease: closed ? 'Sine.easeIn' : 'Back.easeOut',
      onUpdate: applyEyes,
      onComplete: () => {
        eyeState.squeeze = target;
        applyEyes();
        eyeLidTween = null;
      },
    });
  }

  // Blink: a brief close-and-open. Skipped entirely while the eyes are already
  // being held shut (eating / refusing / tapped), or while the eat pose is
  // squeezing them — in all three cases the other tween owns eyeSqueeze and a
  // blink would fight it.
  let blinkEvent = null;
  function scheduleBlink() {
    blinkEvent = scene.time.delayedCall(randBetween(pose.blinkEveryMs), () => {
      const busy =
        lidClosedForEat || lidClosedForRefuse || lidClosedForPoke || stretched || eyeLidTween;

      if (!busy) {
        scene.tweens.add({
          targets: eyeState,
          squeeze: BLINK_CLOSED,
          duration: 80,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onUpdate: applyEyes,
          onComplete: () => {
            eyeState.squeeze = 1;
            applyEyes();
          },
        });
      }
      scheduleBlink();
    });
  }
  scheduleBlink();

  applyEyes();

  // --- steering + catch ----------------------------------------------------
  // The two things that make the monster feel piloted rather than slid around:
  // a lean into the direction of travel, and a rear-up as food arrives.

  // How far the head is currently leading. Kept in a variable because both the
  // lean and the refusal shake write faceGroup.x, so each has to know where the
  // other left it.
  let faceLead = 0;
  let leadTween = null;
  let leadDir = 0;

  // `dir` is -1 (moving left), 0 (still) or 1 (moving right). Only retargets
  // when the direction actually changes, so holding a swipe doesn't restart the
  // tween on every frame — which would freeze the lean at its resting position
  // instead of letting it ease out to the lead.
  function lean(dir) {
    if (dir === leadDir) return;
    leadDir = dir;

    faceLead = dir * pose.headLead;
    if (refuseTween) return; // a refusal shake owns faceGroup.x until it ends

    if (leadTween) leadTween.stop();
    leadTween = scene.tweens.add({
      targets: faceGroup,
      x: faceLead,
      duration: pose.headLeadMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        faceGroup.setX(faceLead);
        leadTween = null;
      },
    });
  }

  // --- walking -------------------------------------------------------------
  //
  // Driven per-frame from GameScene's speed rather than by a tween, because the
  // step has to stay locked to the actual distance travelled: at full speed the
  // legs cycle quickly, and as the monster eases to a stop the steps slow and
  // shorten instead of the legs carrying on at a fixed rate while the monster
  // crawls. That coupling is the whole reason this isn't a looping tween.
  //
  // The monster faces the camera, so there's no side-on stride to show. Instead
  // the legs CROSS in x — each swings toward the middle — and lift in y, out of
  // phase with each other. That's the standard way a front-facing cartoon
  // character is animated walking sideways.

  // Current step strength, 0 (standing) to 1 (full stride). Eased in and out in
  // updateWalk so starting and stopping don't snap the legs.
  let walkAmount = 0;
  // Advances by real distance, so the cycle rate is speed-independent in the
  // sense that matters: a step is always the same length of ground.
  let walkPhase = 0;

  // One leg's resting spot, and its distance from the monster's centre line.
  // That distance is the yardstick for the whole walk: every reach below is a
  // fraction of it, so a leg can never over-swing into the other one whatever
  // legGap or overall scale are set to.
  function legHome(which) {
    const restX =
      which === 'left' ? -pose.legGap + pose.legLeft.x : pose.legGap + pose.leg.x;
    return { restX, reach: Math.abs(restX), towards: restX > 0 ? -1 : 1 };
  }

  // `stride` runs 0..1 through one leg's cycle. 0 is the moment the foot has
  // planted at the front; 0.5 is when it has been left behind and starts
  // reaching again. The foot never leaves the floor — the leg extends and
  // compresses instead.
  function legPoseFor(stride) {
    // Reaching through the first half, dragging back through the second. A
    // raised cosine rather than a triangle, so the transition at each end is
    // smooth instead of snapping the direction of travel.
    const reachPhase = 0.5 - 0.5 * Math.cos(stride * Math.PI * 2);

    // Both the sideways travel and the downward extension are driven by the same
    // phase, so the leg reaches out and down together — which is what a leg
    // planting its foot ahead of the body actually does.
    const reach = (pose.walkLeadOut * reachPhase + pose.walkTrailIn * (1 - reachPhase)) * reachPhase;

    // Longest at the plant, shortest when trailing.
    const stretchY = pose.trailSquash + (pose.reachStretch - pose.trailSquash) * reachPhase;

    // Thins as it extends — a stretched leg is a thinner leg.
    const thin = pose.reachThin + (1 - pose.reachThin) * reachPhase;

    // Toes lead the reach and flatten on the plant; the trailing leg leans the
    // other way, so the pair scissor rather than tilting as one.
    //
    // Faded out at both extremes: the tilt is at full strength mid-reach and
    // mid-drag, and goes to zero at the plant so the foot lands flat. That
    // removes the need for a separate "how tilted should it be" multiplier —
    // the phase already says it.
    const pitch =
      (reachPhase >= 0.5 ? pose.walkPitch : -pose.walkPitchTrail) *
      (1 - Math.abs(reachPhase - 1));

    // Arcs sideways rather than travelling in a straight line, the way a leg
    // swinging from a hip does.
    const sway = Math.sin(stride * Math.PI * 2);

    // The off-ground half stretches along its travel, as if peeling off it.
    const dragStretch = 1 + (pose.walkDragStretch - 1) * (1 - reachPhase);

    return { reach, stretchY, thin, pitch, sway, dragStretch };
  }

  function updateWalk(delta, speed) {
    const dt = Math.min(delta, 50) / 1000;
    const moving = speed >= pose.walkMinSpeed;

    // Ease the stride in while moving and out when not. A linear ramp is enough
    // for a secondary motion, and a tween would be awkward here anyway — there's
    // no property to hang it on, and it would need tearing down on every stop.
    const ramp = dt / ((moving ? pose.walkEaseMs : pose.walkSettleMs) / 1000);
    walkAmount = clamp(walkAmount + (moving ? ramp : -ramp), 0, 1);

    // Phase advances by DISTANCE, not time, so a step is always the same length
    // of ground — the feet can't skate at low speed or scurry at high speed.
    if (moving) walkPhase += (speed * dt) / pose.walkGroundPerCycle;

    // The legs are half a cycle apart, which is the only thing keeping them out
    // of step with each other: while one plants, the other reaches.
    const strideL = walkPhase % 1;
    const strideR = (walkPhase + 0.5) % 1;

    const legW = legBaseW * pose.leg.scale;
    const legH = legBaseH * pose.leg.scale;

    const applyLeg = (which, stride) => {
      const sprite = which === 'left' ? legLeft : legRight;
      const { restX, reach, towards } = legHome(which);
      const p = legPoseFor(stride);

      // Each leg swings TOWARD the centre line, so the pair crosses — the
      // defining read of a front-facing sideways walk.
      const travel = p.reach * reach * towards;

      sprite.x = restX + (travel + p.sway * legW * 0.18) * walkAmount;
      // p.pitch is already faded down to zero at the plant, so there's no
      // separate strength term to multiply in here.
      sprite.angle = p.pitch * walkAmount;

      // Interpolated from exactly 1 (the authored scale), so a standing monster
      // keeps its proportions untouched — walkAmount of 0 is a true no-op.
      const scaleX = pose.leg.scale * (1 + (p.thin - 1) * walkAmount);
      const scaleY_base = pose.leg.scale * (1 + (p.stretchY - 1) * walkAmount);
      const scaleY = scaleY_base * (1 + (p.dragStretch - 1) * walkAmount * 0.5);

      sprite.setScale(scaleX, scaleY);

      // The leg ANCHOR stays put and the art stretches downward from it. The
      // sprite's y is its centre, so extending the art by (scaleY - authored)
      // moves that centre down by half as much — offsetting that keeps the anchor
      // (and therefore the foot's contact with the floor) fixed while the leg
      // visibly reaches further down.
      sprite.y = pose.leg.y + (scaleY - pose.leg.scale) * legH * 0.5;
    };

    applyLeg('left', strideL);
    applyLeg('right', strideR);

    // One dip per FOOTFALL, hence the doubled frequency: two steps happen per
    // cycle, so the body sinks twice. Applied to the whole monster rather than
    // to the legs, so the feet stay planted while the body settles onto them.
    //
    // Assigned (not accumulated) to walkGroup.y, which nothing else writes —
    // adding into another group's y would compound downward every frame, since
    // the anticipation tweens also own that property.
    walkGroup.y =
      -Math.abs(Math.sin(walkPhase * Math.PI)) * pose.walkBob * walkAmount;
  }

  // The eat pose: rear up, gape, and squeeze the head and eyes — one gesture
  // with one timeline.
  //
  // Every part below shares `anticipateMs` and is started in the same frame, so
  // the parts move together by construction. The earlier build staggered the
  // head behind the assembly, which read as two separate animations rather than
  // one flinch.
  //
  // `stretched` is the latch that makes this a pose rather than a per-frame
  // wobble: the tweens are only started on the transition into it, so an
  // approach that lingers (or a second shape arriving) refreshes the hold
  // instead of restarting the motion.
  let bodyAnticipateTween = null;
  let faceAnticipateTween = null;
  let mouthAnticipateTween = null;
  let eyeAnticipateTween = null;
  let anticipateReset = null;
  let stretched = false;

  function settleAnticipation() {
    if (!stretched) return;
    stretched = false;

    // The wide mouth is exclusive to the eat pose. Handing the mouth back to
    // whatever expression is currently active — idle normally, but possibly the
    // eating or refused face if the shape landed — rather than forcing idle,
    // which would cut a chomp short.
    mouthResetRestore();

    const ms = pose.settleMs;
    const ease = 'Sine.easeOut';

    // Collected so they can all be torn down together — four parallel tweens
    // started in one frame all finish in that same frame.
    const all = [
      bodyAnticipateTween,
      faceAnticipateTween,
      mouthAnticipateTween,
      eyeAnticipateTween,
    ].filter(Boolean);
    all.forEach((t) => t.stop());

    bodyAnticipateTween = scene.tweens.add({
      targets: stretchGroup,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: ms,
      ease,
      onComplete: () => {
        stretchGroup.setPosition(0, 0).setScale(1);
        bodyAnticipateTween = null;
      },
    });

    faceAnticipateTween = scene.tweens.add({
      targets: faceGroup,
      scaleX: 1,
      duration: ms,
      ease,
      onComplete: () => {
        faceGroup.setScale(1, faceGroup.scaleY);
        faceAnticipateTween = null;
      },
    });

    mouthAnticipateTween = scene.tweens.add({
      targets: mouthGroup,
      x: pose.mouth.x,
      y: pose.mouth.y,
      scaleX: 1,
      scaleY: 1,
      duration: ms,
      ease,
      onComplete: () => {
        // Position as well as scale: the gape lifts the mouth, and leaving the
        // group wherever the tween stopped would keep the mouth a few px high
        // for the rest of the run.
        mouthGroup.setPosition(pose.mouth.x, pose.mouth.y).setScale(1);
        mouthAnticipateTween = null;
      },
    });

    // Skipped while a lid is closed. `applyEyesClosed` also drives eyeSqueeze,
    // and if the food is caught while the pose is still held both would be
    // running on it — the settle would force the eyes back open mid-chew.
    // When a lid IS closed it reopens them itself on release, so there's
    // nothing for the settle to do.
    if (!lidClosedForEat && !lidClosedForRefuse && !lidClosedForPoke) {
      eyeAnticipateTween = scene.tweens.add({
        targets: eyeState,
        squeeze: 1,
        duration: ms,
        ease,
        onUpdate: applyEyes,
        onComplete: () => {
          eyeState.squeeze = 1;
          applyEyes();
          eyeAnticipateTween = null;
        },
      });
    }
  }

  function anticipate() {
    if (!stretched) {
      stretched = true;

      const ms = pose.anticipateMs;
      const ease = 'Back.easeOut';

      // Rears up and grows taller. Applied to the assembly, not the head, so
      // the legs stretch with it and don't detach from the floor.
      bodyAnticipateTween = scene.tweens.add({
        targets: stretchGroup,
        y: -pose.anticipateRise,
        scaleX: pose.anticipateStretch,
        scaleY: pose.anticipateStretch,
        duration: ms,
        ease,
      });

      // Head pinches in — a neck-craning gulp. Horizontal only, so it narrows
      // out of the way of the mouth opening upward past it.
      faceAnticipateTween = scene.tweens.add({
        targets: faceGroup,
        scaleX: pose.headSqueeze,
        duration: ms,
        ease,
      });

      // Swap to the wide-open mouth art, then stretch it. Two separate things:
      // swapping alone is a hard cut, and stretching the resting mouth alone is
      // what made the earlier version read as the mouth just sliding upward.
      //
      // Uses the same pop-and-overshoot as the other expressions so it doesn't
      // clip on as a flat cut, but driven on mouthGroup so it can't fight the
      // gape tween below — one writes the sprite, the other the container.
      setMouth('wide');
      if (mouthPopTween) mouthPopTween.stop();
      mouth.setScale(pose.mouth.scale * 0.86);
      mouthPopTween = scene.tweens.add({
        targets: mouth,
        scaleX: pose.mouth.scale,
        scaleY: pose.mouth.scale,
        duration: ms,
        ease,
        onComplete: () => {
          mouth.setScale(pose.mouth.scale);
          mouthPopTween = null;
        },
      });

      // Grows on both axes, plus a small lift. The lift is a correction for the
      // wide art sitting lower in its canvas, not a movement in its own right —
      // without it the swap reads as the mouth sinking as it opens.
      mouthAnticipateTween = scene.tweens.add({
        targets: mouthGroup,
        x: pose.mouth.x,
        y: pose.mouth.y - pose.mouthGapeRise,
        scaleX: pose.mouthGapeX,
        scaleY: pose.mouthGapeY,
        duration: ms,
        ease,
      });

      // Eyes squeeze down behind the mouth.
      eyeAnticipateTween = scene.tweens.add({
        targets: eyeState,
        squeeze: pose.eyeSqueeze,
        duration: ms,
        ease,
        onUpdate: applyEyes,
        // Pinned, not left interpolated: a tween killed mid-flight leaves its
        // target wherever it stopped, so without this a re-approach would ease
        // out from a part-squeezed value and the pose would drift shallower
        // with every shape.
        onComplete: () => {
          eyeState.squeeze = pose.eyeSqueeze;
          applyEyes();
          eyeAnticipateTween = null;
        },
      });
    }

    // Refreshed on every approach, so a run of incoming shapes holds the pose
    // instead of the monster pumping in and out of it between them.
    if (anticipateReset) anticipateReset.remove(false);
    anticipateReset = scene.time.delayedCall(pose.anticipateHoldMs, () => {
      anticipateReset = null;
      settleAnticipation();
    });
  }

  // Small vertical hop, shared by the tap reaction and the sulk so both read as
  // the same motion. Restarts from 0 every time, so spamming can't compound.
  function hop(strength) {
    if (pokeTween) pokeTween.stop();
    hopGroup.setY(0);
    pokeTween = scene.tweens.add({
      targets: hopGroup,
      y: -strength,
      duration: 150,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        hopGroup.setY(0);
        pokeTween = null;
      },
    });
  }

  // Disappointed droop after a miss: head sinks, plus a small downward hop.
  let sulkTween = null;

  function sulk() {
    if (sulkTween) sulkTween.stop();
    faceGroup.setY(0);
    sulkTween = scene.tweens.add({
      targets: faceGroup,
      y: pose.sulkDroop,
      duration: pose.sulkMs,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        faceGroup.setY(0);
        sulkTween = null;
      },
    });

    hop(-pose.pokeHop);
  }

  // --- behaviour API -------------------------------------------------------

  function chomp() {
    // Eyes squeeze shut for the whole eating face, then reopen as it ends.
    lidClosedForEat = true;

    flashMouth('eating', () => {
      lidClosedForEat = false;
      applyEyesClosed();
    });

    // Forced here rather than gated inside applyEyesClosed, so the very first
    // chomp closes the eyes immediately even though the state was already
    // "open" — applyEyesClosed only skips work when the result is unchanged.
    applyEyesClosed();

    pulseBody(1.08, 0.9, 130);

    if (mouthPopTween) {
      mouthPopTween.stop();
      mouthPopTween = null;
    }
    if (chompTween) chompTween.stop();
    mouth.setScale(pose.mouth.scale);
    chompTween = scene.tweens.add({
      targets: mouth,
      scaleX: pose.mouth.scale * 1.25,
      scaleY: pose.mouth.scale * 1.6,
      duration: 130,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        mouth.setScale(pose.mouth.scale);
        chompTween = null;
      },
    });
  }

  function refuse() {
    // Eyes screw shut for the "no" face, same as chewing — then reopen as the
    // refusal ends.
    lidClosedForRefuse = true;
    applyEyesClosed();

    flashMouth('refuse', () => {
      lidClosedForRefuse = false;
      applyEyesClosed();
    });

    pulseBody(0.94, 1.05, 120);

    // Shakes the FACE, not the outer container — the container's y is owned by
    // the idle bob, so animating it here would kill the breathing. Note this
    // does write faceGroup.x, the same property lean() drives; a refusal always
    // wins because it starts a fresh tween and the lean only retargets when the
    // player's direction actually changes.
    if (refuseTween) refuseTween.stop();
    faceGroup.setX(faceLead);
    refuseTween = scene.tweens.add({
      targets: faceGroup,
      x: faceLead + pose.refuseShake,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        faceGroup.setX(faceLead);
        refuseTween = null;
      },
    });
  }

  // Reaction to a direct tap: the monster notices and perks up. Deliberately
  // does NOT change the mouth — GameScene replays the round's instruction clip
  // on tap, and swapping the face to "eating" would contradict what's said.
  //
  // The hop animates hopGroup, which nothing else touches, and is restarted
  // from 0 on every tap. Spamming a tap therefore just restarts the hop from
  // the top — the motion can never be interrupted mid-way into a broken pose,
  // and the idle bob underneath keeps running untouched.
  function reactToPoke() {
    // A quick contented blink alongside the hop.
    lidClosedForPoke = true;
    applyEyesClosed();

    if (pokeLidTimer) pokeLidTimer.remove(false);
    pokeLidTimer = scene.time.delayedCall(MOUTH_HOLD_POKE_MS, () => {
      pokeLidTimer = null;
      lidClosedForPoke = false;
      applyEyesClosed();
    });

    hop(pose.pokeHop);

    // pulseBody already stops any in-flight pulse before starting a new one,
    // so rapid taps restart the squash cleanly instead of compounding.
    pulseBody(1.12, 0.86, 110);
  }

  // Points the pupils at a world position — used while a shape is held.
  function lookAt(worldX, worldY) {
    eyeTracking = true;

    const centreX = pose.x + pose.head.x;
    const centreY = pose.y + pose.head.y;
    const nx = clamp((worldX - centreX) / EYE_FOLLOW_RANGE, -1, 1);
    const ny = clamp((worldY - centreY) / EYE_FOLLOW_RANGE, -1, 1);

    // Short duration + frequent retargeting = the pupils glide along with the
    // shape. The offset-to-clamp ratio also corrects the resting positions,
    // which sit slightly outside the texture's visible iris.
    moveEyesTo(nx * pose.eyeFollow.x, ny * pose.eyeFollow.y, 140);
  }

  // Returns the eyes to centre and lets the idle wander resume. `force` so the
  // recentring isn't swallowed by the retarget throttle.
  function stopLooking() {
    if (!eyeTracking) return;
    eyeTracking = false;
    moveEyesTo(0, 0, 420, true);
  }

  // --- life ----------------------------------------------------------------

  // Idle "breathing" of the whole monster. The body has its own squash loop on
  // top of this, so the two read as layered rather than one rigid motion.
  const idleTween = scene.tweens.add({
    targets: bobGroup,
    y: -pose.idleBob,
    duration: pose.idleDuration,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  startBodyBreathe();

  // World position of the HEAD, which is what the catch test is centred on.
  // Read off the live container rather than precomputed, because the monster is
  // steered around by the player — a static point would leave the zone behind.
  //
  // Deliberately ignores the bob/lean/anticipate offsets: those move the head
  // by at most ~30px, while the catch zone is ~150px across, so folding them in
  // would add wobble to an otherwise steady target without changing the result.
  function getCatchCentre() {
    return {
      x: container.x + pose.head.x,
      y: container.y + pose.head.y,
    };
  }

  // World position of the mouth. Used to aim the swallow and the "+1" pop —
  // where the food should visibly land — NOT for the catch test, which uses the
  // whole head.
  function getMouth() {
    return {
      x: container.x + pose.mouth.x,
      y: container.y + pose.mouth.y,
    };
  }

  function destroy() {
    idleTween.stop();
    const tweens = [
      bodyBreatheTween,
      bodyPulseTween,
      chompTween,
      refuseTween,
      pokeTween,
      mouthPopTween,
      eyeTween,
      eyeLidTween,
      leadTween,
      bodyAnticipateTween,
      faceAnticipateTween,
      mouthAnticipateTween,
      eyeAnticipateTween,
      sulkTween,
    ];
    tweens.forEach((t) => {
      if (t) t.stop();
    });

    const events = [mouthReset, pokeLidTimer, anticipateReset, driftEvent, blinkEvent];
    events.forEach((e) => {
      if (e) e.remove(false);
    });

    container.destroy(true);
  }

  return {
    container,
    getCatchCentre,
    getMouth,
    setMouth,
    chomp,
    refuse,
    reactToPoke,
    lean,
    walk: updateWalk,
    anticipate,
    sulk,
    lookAt,
    stopLooking,
    destroy,
  };
}
