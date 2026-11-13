import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// WinterSnow — two-layer canvas snowfall with real depth.
//
//   FAR  layer (z-1, BEHIND the page content): many tiny, faint, slow flakes —
//        the distant blizzard.
//   NEAR layer (z-30, IN FRONT of content, never intercepts input): a handful
//        of large, soft, out-of-focus flakes and a few crystalline ones that
//        fall faster and drift wider — the flakes close to the camera.
//
// Depth cues: size, speed, opacity, sway width and — when the page scrolls — a
// per-flake parallax shift, so near flakes slide past faster than far ones.
//
// Performance choices (this runs on classroom tablets and old phones):
//   * Every flake is a PRE-RENDERED sprite blitted with drawImage. No gradients,
//     filters, shadows or path building happen per frame.
//   * Flake counts scale with screen area and are halved on low-power devices.
//   * Backing-store resolution is capped (far layer 1x, near layer <= 1.5x).
//   * One rAF loop for both canvases, capped at 60fps (30fps on low power),
//     with dt clamped so a stalled tab never teleports flakes.
//   * The loop stops entirely while the tab is hidden.
//   * prefers-reduced-motion: one static frame of far snow, no loop, no near layer.
//   * Resize handling is debounced and only rebuilds flakes when the WIDTH
//     changes — mobile URL-bar show/hide changes only the height and must not
//     reshuffle the snow mid-scroll.
// ---------------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function makeSprite(size, paint) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  paint(c.getContext("2d"), size);
  return c;
}

// Small, crisp-centred flake for the distant layer.
function paintDot(ctx, s) {
  const r = s / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

// Large defocused flake (camera-bokeh look) — a soft disc, slightly denser in
// the middle. Pre-blurred here so no runtime blur filter is ever needed.
function paintBokeh(ctx, s) {
  const r = s / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(255,255,255,0.8)");
  g.addColorStop(0.55, "rgba(235,246,255,0.7)");
  g.addColorStop(0.85, "rgba(220,238,255,0.25)");
  g.addColorStop(1, "rgba(220,238,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

// Six-armed ice crystal with side branches and a faint icy glow.
function paintCrystal(ctx, s) {
  const c = s / 2;
  const R = s * 0.4;
  ctx.translate(c, c);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.shadowColor = "rgba(186,230,253,0.95)";
  ctx.shadowBlur = s * 0.07;
  ctx.lineWidth = s * 0.05;
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -R);
    ctx.moveTo(0, -R * 0.58);
    ctx.lineTo(-R * 0.27, -R * 0.84);
    ctx.moveTo(0, -R * 0.58);
    ctx.lineTo(R * 0.27, -R * 0.84);
    ctx.moveTo(0, -R * 0.32);
    ctx.lineTo(-R * 0.17, -R * 0.5);
    ctx.moveTo(0, -R * 0.32);
    ctx.lineTo(R * 0.17, -R * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}

function buildFar(count, W, H, sprite) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const z = Math.random();
    list.push({
      spr: sprite,
      x: Math.random() * W,
      y: Math.random() * H,
      z,
      d: (0.7 + z * 1.9) * 3,
      a: 0.28 + z * 0.45,
      vy: 14 + z * 30,
      amp: 6 + z * 10,
      fr: 0.5 + Math.random() * 0.9,
      ph: Math.random() * Math.PI * 2,
      par: 0.03 + z * 0.1,
      rot: 0,
      spin: 0,
      crystal: false,
    });
  }
  return list;
}

function buildNear(count, W, H, bokeh, crystal) {
  const list = [];
  const scale = W < 640 ? 0.72 : 1;
  for (let i = 0; i < count; i += 1) {
    const z = Math.random();
    const isCrystal = Math.random() < 0.3;
    list.push({
      spr: isCrystal ? crystal : bokeh,
      x: Math.random() * W,
      y: Math.random() * H,
      z,
      d: (isCrystal ? 15 + z * 15 : 11 + z * 16) * scale,
      a: isCrystal ? 0.55 + z * 0.25 : 0.32 + z * 0.3,
      vy: 55 + z * 75,
      amp: 14 + z * 20,
      fr: 0.4 + Math.random() * 0.7,
      ph: Math.random() * Math.PI * 2,
      par: 0.3 + z * 0.35,
      rot: Math.random() * Math.PI * 2,
      spin: isCrystal ? (Math.random() - 0.5) * 1.2 : 0,
      crystal: isCrystal,
    });
  }
  return list;
}

function step(list, dt, t, ds, W, H) {
  // Slow, shared wind gusts; nearer flakes feel them more.
  const gust = Math.sin(t * 0.23) * 10 + Math.sin(t * 0.61 + 1.3) * 5;
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    p.y += p.vy * dt - ds * p.par;
    p.x += (gust * (0.4 + p.z) + Math.sin(p.ph + t * p.fr) * p.amp) * dt;
    p.rot += p.spin * dt;
    const m = p.d;
    if (p.y > H + m) {
      p.y = -m;
      p.x = Math.random() * W;
    } else if (p.y < -m) {
      p.y = H + m;
      p.x = Math.random() * W;
    }
    if (p.x > W + m) p.x = -m;
    else if (p.x < -m) p.x = W + m;
  }
}

function render(ctx, list, W, H) {
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    ctx.globalAlpha = p.a;
    const h = p.d / 2;
    if (p.crystal) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(p.spr, -h, -h, p.d, p.d);
      ctx.restore();
    } else {
      ctx.drawImage(p.spr, p.x - h, p.y - h, p.d, p.d);
    }
  }
  ctx.globalAlpha = 1;
}

export default function WinterSnow({ reduceMotion = false, lowPower = false }) {
  const farRef = useRef(null);
  const nearRef = useRef(null);

  useEffect(() => {
    const farC = farRef.current;
    // The near canvas is conditionally rendered, so it can legitimately be
    // absent. Bailing out on a null nearRef would kill the far snow too, so
    // every near-canvas use below is guarded instead.
    const nearC = nearRef.current;
    if (!farC) return undefined;
    const farX = farC.getContext("2d");
    if (!farX) return undefined;
    const nearX = nearC ? nearC.getContext("2d") : null;

    const dot = makeSprite(32, paintDot);
    const bokeh = makeSprite(64, paintBokeh);
    const crystal = makeSprite(80, paintCrystal);

    // A 1.5x backing store on a 3x phone is a very large animated surface to
    // clear and blit every frame. 1.25 still looks crisp for soft bokeh, which
    // is all this layer contains.
    const dprNear = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
    const minInterval = lowPower ? 31 : 14;

    let W = 0;
    let H = 0;
    let far = [];
    let near = [];
    let raf = 0;
    let last = 0;
    let lastScroll = window.scrollY;
    let resizeTimer = 0;

    // Why low-power drops the NEAR layer entirely rather than just halving it:
    // the near layer sits at z-30, ABOVE every frosted panel. It changes every
    // frame, so while it exists the page above the fold is always dirty. The
    // far layer is the one that actually matters for the look (it is the
    // blizzard), so we keep it, just sparser and slower.
    const build = () => {
      const area = W * H;
      const k = lowPower ? 0.4 : 1;
      const farCount = Math.round(clamp(area / 9000, 36, 120) * k);
      const nearCount =
        reduceMotion || lowPower
          ? 0
          : Math.max(4, Math.round(clamp(area / 60000, 6, 22) * k));
      far = buildFar(farCount, W, H, dot);
      near = buildNear(nearCount, W, H, bokeh, crystal);
    };

    const sizeCanvases = () => {
      // Far layer is tiny soft dots — 1x is visually identical and 2-4x cheaper.
      farC.width = Math.round(W);
      farC.height = Math.round(H);
      farX.setTransform(1, 0, 0, 1, 0, 0);
      if (!nearC || !nearX) return;
      nearC.width = Math.round(W * dprNear);
      nearC.height = Math.round(H * dprNear);
      nearX.setTransform(dprNear, 0, 0, dprNear, 0, 0);
    };

    const paintStatic = () => {
      render(farX, far, W, H);
      if (nearX) nearX.clearRect(0, 0, W, H);
    };

    const resize = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      const widthChanged = nw !== W;
      W = nw;
      H = nh;
      sizeCanvases();
      if (widthChanged || far.length === 0) build();
      if (reduceMotion) paintStatic();
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const elapsed = now - last;
      if (elapsed < minInterval) return;
      last = now;
      const dt = Math.min(elapsed, 50) / 1000;
      const t = now / 1000;
      const sy = window.scrollY;
      const ds = clamp(sy - lastScroll, -160, 160);
      lastScroll = sy;
      step(far, dt, t, ds, W, H);
      render(farX, far, W, H);
      // Near layer is absent on low-power devices (and empty under
      // reduced-motion), so skip both its integration and its blit entirely
      // rather than clearing a canvas that was never created.
      if (nearX && near.length > 0) {
        step(near, dt, t, ds, W, H);
        render(nearX, near, W, H);
      }
    };

    const start = () => {
      if (raf || reduceMotion) return;
      last = performance.now();
      lastScroll = window.scrollY;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };

    resize();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, [reduceMotion, lowPower]);

  return (
    <>
      {/* Distant snow — behind all page content (content is z-10). */}
      <canvas
        ref={farRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
      />
      {/* Foreground snow — over the content but under the teacher bar (z-50)
          and the loading overlays (z-[999]). Never captures taps.
          Not rendered at all on low-power devices: it is the layer that keeps
          the whole viewport dirty every frame, because it sits ABOVE the
          frosted panels. The far layer alone carries the effect. */}
      {!lowPower && (
        <canvas
          ref={nearRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[30] h-full w-full"
        />
      )}
    </>
  );
}
