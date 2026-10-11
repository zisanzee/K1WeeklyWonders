import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// HeartCanvas — the living backdrop.
//
// A single 2D canvas behind the content that does the following jobs:
//   1. ambient hearts drifting upward forever (the "atmosphere"),
//   2. burst(x, y)       — a one-off explosion of hearts,
//   3. firework(x, y)    — a glowing peony of sparks that leave fading trails,
//      firework(x, y, 'heart') — the same, but the sparks fly out in the shape
//      of a heart,
//   4. rocket(x, y)      — a rocket that climbs from the bottom of the screen on
//      a sparkling trail and detonates as a firework at (x, y),
//   5. shockwave(x, y)   — an expanding ring of light,
//   6. a sparkle trail under the pointer and a ripple wherever it taps.
//
// Deliberately Canvas 2D and not three.js: this app ships ~1.4 MB of Phaser
// already. Cost is bounded: a hard particle cap and device-pixel-ratio clamped
// to 2.
//
// Under prefers-reduced-motion or the app's low-power mode the CONTINUOUS
// ambient drift is switched off (it is the part that keeps the compositor and
// the loop awake forever), but the loop still runs so one-shot callers — burst,
// firework, rocket — render. Those only draw what a deliberate interaction just
// asked for, and killing them would silently break behaviour (the ring-tap
// secret, the game win, the hug) on exactly the weak devices that need the
// page to still feel alive. The loop is suspended entirely whenever the tab is
// hidden, so a still page costs nothing.
//
// Sparks and rings are drawn with additive ('lighter') blending, so overlapping
// fireworks bloom toward white the way real ones do.

const MAX_PARTICLES = 460;
const AMBIENT_RATE = 1.6; // hearts per second at rest

// A normalized heart outline in roughly [-0.85..0.85] x [-0.25..0.95].
function tracePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, 0.3);
  ctx.bezierCurveTo(0, 0.1, -0.3, -0.2, -0.55, -0.05);
  ctx.bezierCurveTo(-0.85, 0.12, -0.5, 0.55, 0, 0.95);
  ctx.bezierCurveTo(0.5, 0.55, 0.85, 0.12, 0.55, -0.05);
  ctx.bezierCurveTo(0.3, -0.2, 0, 0.1, 0, 0.3);
  ctx.closePath();
}

function traceStar(ctx, spikes = 4) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? 1 : 0.36;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// The classic parametric heart; x in [-16, 16], y in [-17, 12] (up is negative
// once flipped for the screen).
const heartPoint = (t) => ({
  x: 16 * Math.sin(t) ** 3,
  y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
});

const HeartCanvas = forwardRef(function HeartCanvas(
  { className = 'lv-canvas', trail = true },
  ref
) {
  const canvasRef = useRef(null);
  // Particle store lives in a ref so the render loop never triggers a React
  // render. Each particle is a plain object mutated in place.
  const particlesRef = useRef([]);
  const burstRef = useRef(null);
  const fireRef = useRef(null);
  const rocketRef = useRef(null);
  const ringRef = useRef(null);

  useImperativeHandle(ref, () => ({
    burst(x, y, { count = 22, power = 1, spread = Math.PI * 2 } = {}) {
      burstRef.current?.(x, y, count, power, spread);
    },
    firework(x, y, kind) {
      fireRef.current?.(x, y, kind);
    },
    rocket(x, y, kind) {
      rocketRef.current?.(x, y, kind);
    },
    shockwave(x, y) {
      ringRef.current?.(x, y, 260, 3);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowPower = document.documentElement.dataset.lowpower === 'true';

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Match the backing store to the CSS box. Skipping the reassign when nothing
    // changed matters: setting canvas.width/height clears the bitmap, so a
    // ResizeObserver firing on every layout tick would flicker. It also guards
    // the pixelation bug — if the element size is ever read BEFORE layout
    // settles (or after the element grows), a smaller bitmap gets stretched over
    // a larger box and every heart renders big and blocky.
    const resize = () => {
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (w === width && h === height && nextDpr === dpr) return;
      dpr = nextDpr;
      width = w;
      height = h;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Restarts the rAF loop if it has gone to sleep (low-power idle). Assigned
    // below once `frame` exists; every one-shot effect calls it so a burst can
    // never be queued onto a stopped loop.
    let wake = () => {};

    const random = (min, max) => min + Math.random() * (max - min);
    const room = (reserve = 0) => MAX_PARTICLES - reserve - particlesRef.current.length;

    function drawParticle(c, p, dt) {
      c.save();
      c.globalAlpha = p.alpha;
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.scale(p.size, p.size);

      if (p.kind === 'ring') {
        c.globalCompositeOperation = 'lighter';
        c.lineWidth = (p.lw || 2) / p.size;
        c.strokeStyle = `hsl(${p.hue} 95% 78%)`;
        c.beginPath();
        c.arc(0, 0, 0.5, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        return;
      }

      if (p.kind === 'dot') c.globalCompositeOperation = 'lighter';
      c.fillStyle = `hsl(${p.hue} 85% ${p.kind === 'star' ? 88 : p.kind === 'dot' ? 68 : 74}%)`;
      if (p.kind === 'dot') {
        c.beginPath();
        c.arc(0, 0, 0.5, 0, Math.PI * 2);
      } else if (p.kind === 'star') traceStar(c);
      else tracePath(c);
      c.fill();
      // A soft core glow on the bigger pieces, drawn only when it can be seen.
      if (dt > 0 && p.size > 18) {
        c.globalAlpha = p.alpha * 0.4;
        c.scale(0.55, 0.55);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        if (p.kind === 'star') traceStar(c);
        else tracePath(c);
        c.fill();
      }
      c.restore();
    }

    // Reduced motion / low power: stop the CONTINUOUS ambient drift, but keep
    // the loop so deliberate one-shot effects (burst / firework / rocket) still
    // render — the drift is the part that runs forever; a burst is one-off.
    const ambientOnKey = !(reduceMotion || lowPower);

    const spawnAmbient = () => {
      // Smaller and fainter than a burst: this is wallpaper, so it should read as
      // a soft drift behind the story, never as prominent floating shapes.
      const size = random(6, 16);
      particlesRef.current.push({
        kind: Math.random() < 0.16 ? 'star' : 'heart',
        x: random(0, width),
        y: height + size,
        vx: random(-9, 9),
        vy: random(-38, -16),
        size,
        rot: random(-0.5, 0.5),
        vr: random(-0.5, 0.5),
        hue: random(322, 352),
        alpha: 0,
        peak: random(0.12, 0.3),
        life: 0,
        maxLife: random(7, 13),
        wobble: random(0, Math.PI * 2),
      });
    };

    burstRef.current = (x, y, count, power, spread) => {
      wake();
      const n = Math.min(count, room());
      for (let i = 0; i < n; i += 1) {
        const base =
          spread === Math.PI * 2
            ? random(0, Math.PI * 2)
            : random(-spread / 2, spread / 2) - Math.PI / 2;
        const speed = random(70, 260) * power;
        particlesRef.current.push({
          // Hearts only — the burst is a "heart explosion". (It used to mix in a
          // ~22% scattering of 'star' sparkles.)
          kind: 'heart',
          x,
          y,
          vx: Math.cos(base) * speed,
          vy: Math.sin(base) * speed - random(20, 90),
          size: random(10, 30),
          rot: random(-1, 1),
          vr: random(-4, 4),
          hue: random(318, 356),
          alpha: 0,
          peak: random(0.75, 1),
          life: 0,
          maxLife: random(1.1, 2.4),
          gravity: random(120, 260),
          drag: 0.985,
          wobble: random(0, Math.PI * 2),
        });
      }
    };

    // An expanding ring of light.
    ringRef.current = (x, y, grow = 240, lw = 2.5, hue = random(320, 350), life = 0.8) => {
      wake();
      if (room() < 1) return;
      particlesRef.current.push({
        kind: 'ring',
        x,
        y,
        vx: 0,
        vy: 0,
        size: 8,
        grow,
        lw,
        rot: 0,
        vr: 0,
        hue,
        alpha: 0,
        peak: 0.85,
        life: 0,
        maxLife: life,
        fadeOut: true,
        stiff: true,
      });
    };

    // A spark: a glowing dot that leaves its own fading trail while it flies.
    const spark = (x, y, vx, vy, hue, extra = {}) => ({
      kind: 'dot',
      x,
      y,
      vx,
      vy,
      size: random(5, 9),
      rot: 0,
      vr: 0,
      hue,
      alpha: 0,
      peak: 1,
      life: 0,
      maxLife: random(1.2, 1.9),
      gravity: 70,
      drag: 0.957,
      wobble: 0,
      stiff: true,
      trail: true,
      ...extra,
    });

    fireRef.current = (x, y, kind = 'peony') => {
      wake();
      const hue = random(305, 355);
      ringRef.current?.(x, y, 300, 3, hue, 0.7);

      if (kind === 'heart') {
        const n = Math.min(58, room());
        for (let i = 0; i < n; i += 1) {
          const t = (i / n) * Math.PI * 2;
          const { x: hx, y: hy } = heartPoint(t);
          const k = 11.5;
          // Slightly randomised so it reads as sparks, not a drawn outline.
          particlesRef.current.push(
            spark(x, y, hx * k + random(-4, 4), hy * k + random(-4, 4), hue + random(-12, 12), {
              gravity: 38,
              drag: 0.962,
              maxLife: random(1.5, 2.1),
            })
          );
        }
        return;
      }

      // Peony: an outer shell plus a slower, whiter inner core.
      const outer = Math.min(48, room());
      for (let i = 0; i < outer; i += 1) {
        const a = (i / outer) * Math.PI * 2 + random(-0.06, 0.06);
        const speed = random(150, 250);
        particlesRef.current.push(
          spark(x, y, Math.cos(a) * speed, Math.sin(a) * speed, hue + random(-16, 16))
        );
      }
      const inner = Math.min(20, room());
      for (let i = 0; i < inner; i += 1) {
        const a = random(0, Math.PI * 2);
        const speed = random(40, 120);
        particlesRef.current.push(
          spark(x, y, Math.cos(a) * speed, Math.sin(a) * speed, hue + 20, {
            size: random(3, 6),
            maxLife: random(0.9, 1.4),
          })
        );
      }
    };

    // A rocket: climbs from below the screen to (x, y) and detonates there.
    rocketRef.current = (x, y, kind) => {
      wake();
      if (room(30) < 4) return;
      const duration = random(0.7, 0.95);
      const startX = x + random(-120, 120);
      const startY = height + 14;
      particlesRef.current.push({
        kind: 'dot',
        x: startX,
        y: startY,
        vx: (x - startX) / duration,
        vy: (y - startY) / duration,
        size: 7,
        rot: 0,
        vr: 0,
        hue: random(30, 60),
        alpha: 1,
        peak: 1,
        life: 0,
        maxLife: duration,
        stiff: true,
        trail: true,
        noFade: true,
        onDie: (p) => fireRef.current?.(p.x, p.y, kind),
      });
    };

    // Pointer trail — throttled by time so a fast mouse can't carpet the screen.
    let lastTrail = 0;
    const onPointerMove = (event) => {
      // The hover trail is continuous decoration, so it is off wherever the
      // ambient drift is off (low-power / reduced-motion). Taps still ripple.
      if (!trail || !ambientOnKey) return;
      wake();
      const now = performance.now();
      if (now - lastTrail < 42) return;
      lastTrail = now;
      if (room(8) < 1) return;
      particlesRef.current.push({
        kind: 'star',
        x: event.clientX,
        y: event.clientY,
        vx: random(-16, 16),
        vy: random(-30, 4),
        size: random(5, 12),
        rot: random(-3, 3),
        vr: random(-2, 2),
        hue: random(320, 355),
        alpha: 0,
        peak: random(0.4, 0.75),
        life: 0,
        maxLife: random(0.6, 1.3),
        gravity: 40,
        drag: 0.94,
        wobble: random(0, Math.PI * 2),
      });
    };
    // A small ripple wherever the screen is tapped.
    const onPointerDown = (event) => {
      ringRef.current?.(event.clientX, event.clientY, 150, 2, random(320, 350), 0.55);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    let raf = 0;
    let last = performance.now();
    let spawnAccumulator = 0;

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    // The window can stay the same size while THIS element's box changes (first
    // layout, scrollbar changes, dynamic-vh updates). Only a window listener
    // misses all of those, leaving a stale backing store — the pixelation. Watch
    // the element itself too.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (ambientOnKey) {
        spawnAccumulator += dt * AMBIENT_RATE;
        while (spawnAccumulator >= 1 && particlesRef.current.length < MAX_PARTICLES - 60) {
          spawnAccumulator -= 1;
          spawnAmbient();
        }
      }

      ctx.clearRect(0, 0, width, height);

      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.onDie?.(p);
          list.splice(i, 1);
          continue;
        }
        const t = p.life / p.maxLife;
        let fade;
        if (p.noFade) fade = 1;
        else if (p.fadeOut) fade = (1 - t) ** 1.6;
        else fade = t < 0.18 ? t / 0.18 : t > 0.7 ? (1 - t) / 0.3 : 1;
        p.alpha = p.peak * Math.max(0, Math.min(1, fade));

        if (p.gravity) p.vy += p.gravity * dt;
        if (p.drag) {
          const d = Math.pow(p.drag, dt * 60);
          p.vx *= d;
          p.vy *= d;
        }
        if (p.grow) p.size += p.grow * dt;
        p.wobble += dt * 2;
        p.x += (p.vx + (p.stiff ? 0 : Math.sin(p.wobble) * 12)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // Sparks and rockets shed short-lived embers behind them.
        if (p.trail) {
          p.trailAcc = (p.trailAcc || 0) + dt;
          if (p.trailAcc > 0.032 && list.length < MAX_PARTICLES) {
            p.trailAcc = 0;
            list.push({
              kind: 'dot',
              x: p.x,
              y: p.y,
              vx: random(-8, 8),
              vy: random(-8, 14),
              size: Math.max(2, p.size * 0.6),
              rot: 0,
              vr: 0,
              hue: p.hue,
              alpha: 0,
              peak: Math.max(0.3, p.alpha * 0.55),
              life: 0,
              maxLife: random(0.28, 0.5),
              fadeOut: true,
              stiff: true,
            });
          }
        }

        drawParticle(ctx, p, dt);
      }

      raf = requestAnimationFrame(frame);
    }

    // The loop only ever stops in low-power / reduced-motion mode (ambientOnKey
    // is false there). Drop it when nothing is left to draw; a one-shot effect
    // calls wake() to bring it back.
    wake = () => {
      if (raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const idleWatch = setInterval(() => {
      if (
        !ambientOnKey &&
        particlesRef.current.length === 0 &&
        raf &&
        !document.hidden
      ) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }, 600);

    // A hidden tab has nothing to show, so the loop is torn down and re-armed on
    // return. In low-power idle it stays asleep until a one-shot effect wakes it.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(idleWatch);
      burstRef.current = null;
      fireRef.current = null;
      rocketRef.current = null;
      ringRef.current = null;
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [trail]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});

export default HeartCanvas;
