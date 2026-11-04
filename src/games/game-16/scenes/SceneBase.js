// scenes/SceneBase.js
// The shared scaffold every one of game-16's five mini-games builds on.
//
// A "scene" here is NOT a Phaser.Scene. Game 16 is one Phaser scene (the hub,
// ../GameScene.js) that mounts five scene MODULES one at a time — see
// plans/game-16-five-scenes.md. This class is what those modules extend.
//
// WHAT IT GIVES A MECHANIC FOR FREE
// ---------------------------------------------------------------------------
//   • a private layer container, emptied on every round change, so a scene never
//     has to track or destroy its own display objects (the commonest leak in a
//     multi-round game)
//   • fraction-based placement, so nothing is hard-coded to 720x1080
//   • its own resolved tuning block, re-read on every relayout
//   • a dev placeholder frame, so five art-less scenes are distinguishable
//   • a no-op-safe api surface, so a half-written scene cannot crash the hub
//
// A real mechanic overrides createRound/update/destroy and fills the layer. The
// five placeholders do exactly that with coloured boxes and labels.
//
// COORDINATES: `ctx.fracX(f)` / `ctx.fracY(f)` convert a 0..1 fraction to the
// current canvas size. Prefer those over literal pixels so a layout survives a
// different base resolution or a rotated device.

export default class SceneBase {
  /**
   * @param {object} config
   * @param {string} config.id      must match the registry id in scenes.js
   * @param {number} config.accent  dev frame / placeholder colour (0xRRGGBB)
   */
  constructor({ id, accent = 0xffffff }) {
    if (!id) throw new Error('SceneBase needs an id');
    this.id = id;
    this.accent = accent;

    // Set by the hub on every mount.
    this.ctx = null;
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE — the hub calls these. Subclasses override the three hooks.
  // ---------------------------------------------------------------------------

  /**
   * Mount this scene for one round. The hub has already cleared the layer.
   * @param {object} ctx    hub handles (see GameScene.js)
   * @param {number} round  0-based round index within THIS scene
   */
  mount(ctx, round) {
    this.ctx = ctx;
    this.round = round;
    // A scene may be remounted many times per run; anything per-round must reset
    // here rather than in the constructor.
    this.beginRound(ctx, round);
    this.createRound(ctx, round);
    this.applyTuning(ctx);
  }

  /** Subclass hook: reset per-round state. Called before createRound(). */
  // eslint-disable-next-line no-unused-vars
  beginRound(ctx, round) {}

  /** Subclass hook: build the round's objects into ctx.layer. */
  // eslint-disable-next-line no-unused-vars
  createRound(ctx, round) {}

  /** Subclass hook: per-frame work. Only called while this scene is active. */
  // eslint-disable-next-line no-unused-vars
  update(ctx, time, delta) {}

  /** Subclass hook: tear down anything outside ctx.layer (timers, listeners). */
  destroy() {
    this.ctx = null;
  }

  // ---------------------------------------------------------------------------
  // TUNING
  // ---------------------------------------------------------------------------

  /** Subclass hook: push the current tuning values onto live objects. */
  // eslint-disable-next-line no-unused-vars
  applyTuning(ctx) {}

  // ---------------------------------------------------------------------------
  // HELPERS — available to every scene
  // ---------------------------------------------------------------------------

  // Canvas size in internal pixels.
  //
  // READ THIS, NEVER `scene.width` / `scene.height`: a Phaser.Scene does NOT
  // expose those — the size lives on `scene.scale`. Reading the missing property
  // yields `undefined`, which turns every derived coordinate into NaN: objects ARE
  // created, they are just placed at NaN and never appear. That failure is
  // completely silent (no error, no warning), so these accessors are the guard.
  get width() {
    return this.ctx?.scene?.scale?.width ?? 720;
  }

  get height() {
    return this.ctx?.scene?.scale?.height ?? 1080;
  }

  /**
   * Canvas width for code that has a raw scene rather than `this`.
   *
   * Every place that computes a position from a scene handle goes through this,
   * so there is exactly one implementation of "how big is the canvas" and it
   * cannot drift back to the broken `scene.width` form.
   */
  static widthOf(scene) {
    return scene?.scale?.width ?? 720;
  }

  static heightOf(scene) {
    return scene?.scale?.height ?? 1080;
  }

  /** Fraction (0..1) of canvas width → internal px. */
  fracX(f) {
    return this.width * f;
  }

  /** Fraction (0..1) of canvas height → internal px. */
  fracY(f) {
    return this.height * f;
  }

  /**
   * The vertical play band for this scene, in internal px, from its tuning
   * block. Falls back to sane values so a missing override cannot produce NaN
   * and leave a scene blank with no error.
   */
  playBand() {
    const t = this.ctx?.tuning ?? {};
    const top = Number.isFinite(t.playTopFrac) ? t.playTopFrac : 0.26;
    const bottom = Number.isFinite(t.playBottomFrac) ? t.playBottomFrac : 0.82;
    // Guard against a slider dragged past its neighbour: an inverted band would
    // put objects off-screen with no visible symptom in the panel.
    return {
      top: this.fracY(Math.min(top, bottom)),
      bottom: this.fracY(Math.max(top, bottom)),
    };
  }

  /** The horizontal span inside this scene's side inset, in internal px. */
  playSpanX() {
    const t = this.ctx?.tuning ?? {};
    const inset = Number.isFinite(t.sideInsetFrac) ? t.sideInsetFrac : 0.1;
    return { left: this.fracX(inset), right: this.fracX(1 - inset) };
  }

  /** How tall the scene's main objects should be drawn, in internal px. */
  objectHeight() {
    const band = this.playBand();
    const frac = Number.isFinite(this.ctx?.tuning?.objectHeightFrac)
      ? this.ctx.tuning.objectHeightFrac
      : 0.22;
    return (band.bottom - band.top) * frac;
  }

  /**
   * Evenly spaced X positions for `count` slots across the play span.
   * The one piece of layout every placeholder needs, and every real mechanic
   * will want too — a pick-one-of-three row, a shelf, a row of floors.
   */
  slotPositions(count = 3) {
    const { left, right } = this.playSpanX();
    if (count <= 0) return [];
    if (count === 1) return [(left + right) / 2];
    const step = (right - left) / (count - 1);
    return Array.from({ length: count }, (_, i) => left + step * i);
  }

  // ---------------------------------------------------------------------------
  // SHARED ART HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Draws an image full-bleed, COVER-style: scaled by the LARGER of the two
   * ratios so it always fills the canvas, cropping the overflow instead of
   * stretching. Returns null when the texture is missing, so a scene can fall
   * back to its placeholder rather than throwing on a failed asset.
   *
   * `offsetXFrac` / `offsetYFrac` nudge the ART within the frame (not the frame
   * itself), which is how you re-centre the focal point after a crop.
   */
  addCoverImage(ctx, key, { offsetXFrac = 0, offsetYFrac = 0, alpha = 1, depth = 0 } = {}) {
    if (!key || !ctx.scene.textures.exists(key)) return null;

    const { width, height } = ctx.scene.scale;
    const src = ctx.scene.textures.get(key).getSourceImage();
    if (!src?.width || !src?.height) return null;

    // COVER: the larger ratio wins, so the image covers both dimensions.
    const scale = Math.max(width / src.width, height / src.height);

    const img = ctx.scene.add
      .image(width / 2 + width * offsetXFrac, height / 2 + height * offsetYFrac, key)
      .setScale(scale)
      .setAlpha(alpha)
      .setDepth(depth);

    ctx.layer.add(img);
    return img;
  }

  /**
   * Draws a horizontally LOOPING strip (a conveyor, a road, a scrolling shelf).
   *
   * A tileSprite is the whole trick: the texture is only one segment wide, and
   * `tilePositionX` is advanced each frame, so it repeats forever with no seam
   * and no long texture. Scaling by HEIGHT keeps the art's proportions; the
   * tile then stretches to the canvas width.
   *
   * Returns a handle with the sprite, its scroll offset and the scale, or null
   * when the texture is missing.
   */
  addLoopingStrip(
    ctx,
    key,
    {
      yFrac = 0.5,
      heightFrac = 0.16,
      alpha = 1,
      depth = 0,
      // OVERLAP: how much wider each tile is drawn than its true width, so
      // neighbouring copies overlap by that fraction instead of meeting exactly.
      //
      // A tileSprite repeats at an exact pixel interval, and any fractional scale
      // (stripH / src.height is almost never an integer) means the seam lands
      // between pixels — which shows as a hairline gap that drifts as the belt
      // scrolls. Overlapping by a fraction of a percent hides it completely,
      // because the art covers its own boundary. 0 turns it off.
      overlap = 0.012,
    } = {}
  ) {
    if (!key || !ctx.scene.textures.exists(key)) return null;

    const { width, height } = ctx.scene.scale;
    const src = ctx.scene.textures.get(key).getSourceImage();
    if (!src?.width || !src?.height) return null;

    const stripH = height * heightFrac;
    const scale = stripH / src.height;
    // The X scale carries the overlap; Y stays at the true scale so the strip's
    // height is unchanged and the art is not stretched vertically.
    const tileScaleX = scale * (1 + overlap);

    // The TILE must be scaled too, or the art renders at native size inside the
    // strip and the repeat looks wrong. tileScale does that; the sprite itself
    // stays at 1 so its height matches the strip band exactly.
    const sprite = ctx.scene.add
      .tileSprite(width / 2, height * yFrac, width, stripH, key)
      .setTileScale(tileScaleX, scale)
      .setAlpha(alpha)
      .setDepth(depth);

    ctx.layer.add(sprite);
    // tileWidth is the ON-SCREEN advance per repeat, which is what the scroll
    // must wrap against — using the un-overlapped width here would desync the
    // loop from the visual repeat.
    return {
      sprite,
      scroll: 0,
      scale,
      tileScaleX,
      tileWidth: src.width * tileScaleX,
      // SOURCE width, needed to convert a screen-pixel distance into the
      // texture-pixel units that tilePositionX actually uses.
      sourceWidth: src.width,
    };
  }

  /**
   * Scrolls a looping strip by a distance measured in SCREEN pixels.
   *
   * WHY THIS EXISTS — three traps, all of which produced visible bugs:
   *
   *  1. UNITS. `tilePositionX` is measured in the TEXTURE's own pixels, not the
   *     screen's. The belt is drawn at a scale well below 1, so passing a screen
   *     distance makes the belt crawl at a fraction of the intended speed — it
   *     drifts out of step with anything else moving at screen speed.
   *
   *  2. DIRECTION. A POSITIVE `tilePositionX` shows a LATER part of the texture
   *     further left, which reads as the pattern sliding LEFT. To make a shape
   *     travelling RIGHT appear carried by the belt, the offset must DECREASE —
   *     so the sign is inverted here, once, rather than at every call site.
   *
   *  3. WRAP. JavaScript's `%` keeps the sign of the dividend, so
   *     `-50 % 130` is `-50`, not `80`. A negative position is outside the valid
   *     texture range and Phaser renders it as a jump. The modulo is re-based
   *     into `[0, tileWidth)` below.
   *
   * Callers pass a SCREEN-space distance and never think about any of the three.
   */
  scrollStripByScreenPx(strip, screenPx) {
    if (!strip?.sprite || !strip.sourceWidth) return;

    // Convert screen px → texture px, and invert the sign so the pattern moves
    // WITH the caller's direction rather than against it.
    const texturePx = -(screenPx / strip.tileScaleX);

    // Positive, wrapped offset in [0, sourceWidth).
    const wrapped =
      ((texturePx % strip.sourceWidth) + strip.sourceWidth) % strip.sourceWidth;

    strip.scroll = wrapped;
    strip.sprite.tilePositionX = wrapped;
  }

  /**
   * Advances a looping strip by `speedPxPerSec` for this frame and WRAPS the
   * offset against one tile width.
   *
   * The wrap matters: without it the float grows for the length of a whole run,
   * and large values eventually lose sub-pixel precision, which shows up as the
   * belt stuttering. A modulo keeps the number small forever.
   */
  scrollStrip(strip, speedPxPerSec, deltaMs) {
    if (!strip || !strip.tileWidth) return;
    strip.scroll = (strip.scroll + (speedPxPerSec * deltaMs) / 1000) % strip.tileWidth;
    strip.sprite.tilePositionX = strip.scroll;
  }

  /**
   * A full-canvas colour flush: green for a win, red for a miss.
   *
   * ONE implementation for every scene that needs it. Scene 1 grew its own
   * copy first, tied to ITS tuning keys; this one takes the numbers as an
   * argument so a second scene is not forced to inherit the first one's
   * palette or timing. The effect destroys itself, so nothing has to track it
   * and a round change cannot leave a coloured rectangle behind.
   *
   * Depth defaults to the top of the scene layer but below the HUD, so the
   * prompt stays legible through the flash.
   */
  flashScreen(ctx, { colour, alpha, fadeMs = 120, holdMs = 200, depth = 45 } = {}) {
    if (!ctx?.scene || alpha <= 0) return null;

    const { width, height } = ctx.scene.scale;
    const flash = ctx.scene.add
      .rectangle(width / 2, height / 2, width, height, colour, alpha)
      .setDepth(depth)
      .setAlpha(0);
    ctx.layer.add(flash);

    ctx.scene.tweens.add({
      targets: flash,
      alpha: 1,
      duration: Math.max(1, fadeMs),
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: Math.max(0, holdMs),
      onComplete: () => flash.destroy(),
    });

    return flash;
  }

  // ---------------------------------------------------------------------------
  // DEV PLACEHOLDER CHROME
  // ---------------------------------------------------------------------------
  /**
   * Draws the scene's dev frame and labels into its own layer.
   *
   * Deliberately a method rather than inline markup in each placeholder: when
   * the real art lands, deleting ONE call removes all of it. Gated on
   * import.meta.env.DEV as well as ENGINE.devChrome so it cannot reach a player
   * even if the tuning value ships wrong.
   */
  drawDevChrome(ctx) {
    if (!import.meta.env.DEV) return;
    if (!ctx.engine?.devChrome) return;

    const { scene } = ctx;
    const band = this.playBand();
    const { left, right } = this.playSpanX();

    const g = scene.add.graphics();
    // Frame around the play band, in the scene's accent so the five are
    // distinguishable at a glance while there is no art.
    g.lineStyle(2, this.accent, 0.55);
    g.strokeRect(left, band.top, right - left, band.bottom - band.top);
    // A corner tag with the scene + round, the thing you actually need to know.
    g.fillStyle(this.accent, 0.85);
    g.fillRoundedRect(left, band.top - 30, 190, 24, 6);
    ctx.layer.add(g);

    const label = scene.add
      .text(left + 8, band.top - 18, `${this.id} · round ${this.round + 1}`, {
        fontSize: '14px',
        fontFamily: 'Fredoka, sans-serif',
        color: '#0b1220',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    ctx.layer.add(label);
  }

  /**
   * Draws `count` placeholder answer boxes across the play span. This is what
   * fills the five scaffold scenes so they are visibly different and clickable
   * before any mechanic exists.
   */
  drawPlaceholderSlots(ctx, count) {
    const band = this.playBand();
    const xs = this.slotPositions(count);
    const size = this.objectHeight();
    const midY = (band.top + band.bottom) / 2;

    xs.forEach((x, i) => {
      const box = ctx.scene.add
        .rectangle(x, midY, size, size, this.accent, 0.28)
        .setStrokeStyle(3, this.accent, 0.9)
        // Rounded corners are not available on a rectangle; the stroke + fill is
        // enough to read as a slot without pulling in a Graphics per box.
        .setOrigin(0.5);
      ctx.layer.add(box);

      const num = ctx.scene.add
        .text(x, midY, String(i + 1), {
          fontSize: `${Math.round(size * 0.42)}px`,
          fontFamily: 'Fredoka, sans-serif',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      ctx.layer.add(num);
    });
  }
}
