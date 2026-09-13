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
//   monster-body  350x250
//   monster-head  250x250
//   monster-eye   250x250  (the visible iris fills only the middle portion —
//                           the canvas has generous transparent padding, which
//                           is why its scale reads much smaller than the art)
//   monster-mouth 250x250  (same: the mouth occupies a shallow band mid-canvas)

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

  body: { x: 0, y: -30, scale: 0.8 },

  // Head is its own group so a refusal can shake it without moving the body.
  head: { x: 0, y: -178, scale: 0.9 },

  // `x` is the HALF-spread: the left eye sits at -x and the right at +x, and
  // the right eye is the left eye mirrored, so the pair always stays
  // symmetrical. Change x to widen/narrow the eyes together.
  eye: { x: 40, y: -170, scale: 0.3 },

  mouth: { x: 0, y: -110, scale: 0.7 },

  // How far apart the eyes sit, in px. Applied as ±eyeGap from the head's
  // centre, and honoured by both the resting positions and the follow/drift
  // offsets, so changing this one number moves the pair symmetrically.
  eyeGap: 40,

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

// Gameplay tuning that belongs with the monster because it describes its
// mouth: the drop-forgiveness zone used by GameScene. Deliberately generous,
// and taller than it is wide, since shapes are dropped onto the monster from
// above — a drop that lands on its head should still count.
export const MONSTER_FEED_RADIUS_X = 160;
export const MONSTER_FEED_RADIUS_Y = 230;

// Draw order relative to the rest of the scene. Above the flying shapes (6) so
// they pass behind it, below the HUD (20+) and the red flash (85).
export const MONSTER_DEPTH = 12;

// ---------------------------------------------------------------------------
// Art — spread into IMAGES by assets.js so the monster's textures are declared
// next to the code that uses them.
// ---------------------------------------------------------------------------
export const MONSTER_IMAGE_URLS = {
  'monster-body': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-body_yj09kg.png',
  'monster-head': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311501/monster-head_c2jsjw.png',
  'monster-eye': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-lefteye_m2wksp.png',
  'monster-mouth-idle': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311499/monster-mouth-idle_lnlb87.png',
  'monster-mouth-eating': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-mouth-eating_ydap6n.png',
  'monster-mouth-refuse': 'https://res.cloudinary.com/hijmipga/image/upload/v1789311498/monster-mouth-refuse_v6nrpj.png',
};

const MOUTH_TEXTURES = {
  idle: 'monster-mouth-idle',
  eating: 'monster-mouth-eating',
  refuse: 'monster-mouth-refuse',
};

// Distance at which a tracked point deflects the eyes fully. Anything nearer
// scales down proportionally, so the pupils ease off as the shape approaches.
// Kept fairly tight because the play area sits close to the monster (shapes
// spawn between x 90-450, the head is at x 556) — a large range would leave
// the deflection barely off centre for most of the drag.
const EYE_FOLLOW_RANGE = 300;

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
 *   headGroup: Phaser.GameObjects.Container,
 *   mouthPoint: { x: number, y: number },
 *   setMouth: (name: 'idle'|'eating'|'refuse') => void,
 *   chomp: () => void,
 *   refuse: () => void,
 *   lookAt: (worldX: number, worldY: number) => void,
 *   stopLooking: () => void,
 *   destroy: () => void,
 * }}
 */
export default function createMonster(scene) {
  const pose = MONSTER_POSE;

  // THREE containers nested inside one another, so each animated property has
  // exactly one owner. Overlapping tweens on the same property is what makes a
  // spammed tap look broken — Phaser writes every active tween's value each
  // frame, so two tweens on one property fight and the motion snaps. Splitting
  // them means:
  //   container  → x, y (fixed position; nothing tweens these)
  //   bobGroup   → y only (the idle breathing loop)
  //   hopGroup   → y only (the tap reaction)
  // A tap can then restart freely without ever disturbing the bob.
  const container = scene.add.container(pose.x, pose.y).setDepth(MONSTER_DEPTH);
  const bobGroup = scene.add.container(0, 0);
  const hopGroup = scene.add.container(0, 0);
  container.add(bobGroup);
  bobGroup.add(hopGroup);

  // Draw order back to front: body, then the head group on top of it.
  const body = scene.add
    .image(pose.body.x, pose.body.y, 'monster-body')
    .setScale(pose.body.scale);

  // Head + face live in their own container so a refusal can shake the head
  // without disturbing the body or the idle bob (which moves the outer one).
  const headGroup = scene.add.container(0, 0);
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

  const mouth = scene.add
    .image(pose.mouth.x, pose.mouth.y, MOUTH_TEXTURES.idle)
    .setScale(pose.mouth.scale);

  headGroup.add([head, eyeLeft, eyeRight, mouth]);
  hopGroup.add([body, headGroup]);

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

  // --- body ----------------------------------------------------------------

  let bodyBreatheTween = null;
  let bodyPulseTween = null;

  function startBodyBreathe() {
    if (bodyBreatheTween) bodyBreatheTween.stop();
    body.setScale(pose.body.scale);
    bodyBreatheTween = scene.tweens.add({
      targets: body,
      scaleX: pose.body.scale * (1 + pose.bodyBreathe),
      scaleY: pose.body.scale * (1 - pose.bodyBreathe),
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
      targets: body,
      scaleX: pose.body.scale * scaleX,
      scaleY: pose.body.scale * scaleY,
      duration,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        body.setScale(pose.body.scale);
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

  function applyEyeOffset() {
    eyeLeft.setPosition(-pose.eyeGap + eyeOffset.x, pose.eye.y + eyeOffset.y);
    eyeRight.setPosition(pose.eyeGap + eyeOffset.x, pose.eye.y + eyeOffset.y);
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

  applyEyeOffset();

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

  // Eyes shut. The closed state is "squash to zero scaleY" — the eye art is a
  // circle, so collapsing it vertically reads as a closed eye without needing a
  // separate lid graphic.
  //
  // Three things can want the eyes shut: chewing, refusing, and being tapped.
  // They're tracked independently so overlapping events can't undo each other —
  // a tap during a chomp must not reopen eyes that should stay shut for the
  // rest of the chew. The eyes reopen only once ALL of them have released.
  let lidClosedForEat = false;
  let lidClosedForRefuse = false;
  let lidClosedForPoke = false;
  let eyeLidTween = null;

  function applyEyesClosed() {
    const closed = lidClosedForEat || lidClosedForRefuse || lidClosedForPoke;

    if (eyeLidTween) eyeLidTween.stop();
    eyeLidTween = scene.tweens.add({
      targets: [eyeLeft, eyeRight],
      scaleY: closed ? 0.04 : pose.eye.scale,
      duration: closed ? 110 : 180,
      ease: closed ? 'Sine.easeIn' : 'Back.easeOut',
      onComplete: () => {
        eyeLidTween = null;
      },
    });
  }

  // Blink: a brief close-and-open. Skipped entirely while the eyes are already
  // being held shut (eating / being tapped) — otherwise the blink tween and the
  // lid tween would both be running on the eyes' scaleY and fight over it.
  let blinkEvent = null;
  function scheduleBlink() {
    blinkEvent = scene.time.delayedCall(randBetween(pose.blinkEveryMs), () => {
      // Skip while the eyes are already being held shut (eating / refusing /
      // tapped) — otherwise the blink tween and the lid tween would both be
      // driving the eyes' scaleY and fight over it.
      if (!lidClosedForEat && !lidClosedForRefuse && !lidClosedForPoke) {
        scene.tweens.add({
          targets: [eyeLeft, eyeRight],
          scaleY: pose.eye.scale * 0.12,
          duration: 80,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      }
      scheduleBlink();
    });
  }
  scheduleBlink();

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

    // Shakes the head group, not the outer container — the container's y is
    // owned by the idle bob, so animating it here would kill the breathing.
    if (refuseTween) refuseTween.stop();
    headGroup.setX(0);
    refuseTween = scene.tweens.add({
      targets: headGroup,
      x: pose.refuseShake,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        headGroup.setX(0);
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

    if (pokeTween) pokeTween.stop();
    hopGroup.setY(0);
    pokeTween = scene.tweens.add({
      targets: hopGroup,
      y: -pose.pokeHop,
      duration: 150,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        hopGroup.setY(0);
        pokeTween = null;
      },
    });

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

  // World position of the mouth, for the feed-zone drop test. Computed from
  // the pose rather than read off the sprite so it stays fixed while the
  // monster bobs — a moving target would make drops feel arbitrary.
  const mouthPoint = {
    x: pose.x + pose.mouth.x,
    y: pose.y + pose.mouth.y,
  };

  function destroy() {
    idleTween.stop();
    if (bodyBreatheTween) bodyBreatheTween.stop();
    if (bodyPulseTween) bodyPulseTween.stop();
    if (chompTween) chompTween.stop();
    if (refuseTween) refuseTween.stop();
    if (pokeTween) pokeTween.stop();
    if (mouthPopTween) mouthPopTween.stop();
    if (eyeTween) eyeTween.stop();
    if (eyeLidTween) eyeLidTween.stop();
    if (mouthReset) mouthReset.remove(false);
    if (pokeLidTimer) pokeLidTimer.remove(false);
    if (driftEvent) driftEvent.remove(false);
    if (blinkEvent) blinkEvent.remove(false);
    container.destroy(true);
  }

  return {
    container,
    headGroup,
    mouthPoint,
    setMouth,
    chomp,
    refuse,
    reactToPoke,
    lookAt,
    stopLooking,
    destroy,
  };
}
