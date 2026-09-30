import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// HeartCanvas — the living backdrop.
//
// A single 2D canvas behind the content that does three jobs:
//   1. ambient hearts drifting upward forever (the "atmosphere"),
//   2. burst(x, y) — a one-off explosion of hearts, fired on every interaction
//      via the forwarded ref (envelope open, card flip, counter tick, …),
//   3. a faint sparkle trail under the pointer.
//
// Deliberately Canvas 2D and not three.js: this app ships ~1.4 MB of Phaser
// already and three would add ~600 KB more for a page nobody is meant to find.
// The whole effect here is a few hundred particles and compiles to nothing.
//
// Cost is bounded: a hard particle cap, device-pixel-ratio clamped to 2 (a 3x
// phone would otherwise shade 2.25x the pixels for no visible gain), the loop
// pauses when the tab is hidden, and the entire thing is skipped under
// prefers-reduced-motion or the app's own low-power mode — in which case it
// draws one static frame of hearts instead of animating.

const MAX_PARTICLES = 240;
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

const HeartCanvas = forwardRef(function HeartCanvas(
  { className = 'lv-canvas', trail = true },
  ref
) {
  const canvasRef = useRef(null);
  // Particle store lives in a ref so the render loop never triggers a React
  // render. Each particle is a plain object mutated in place.
  const particlesRef = useRef([]);
  // Set by the ref handle, called by the animation loop.
  const burstRef = useRef(null);

  useImperativeHandle(ref, () => ({
    // Fire an explosion of hearts at viewport coordinates.
    burst(x, y, { count = 22, power = 1, spread = Math.PI * 2 } = {}) {
      burstRef.current?.(x, y, count, power, spread);
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

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const random = (min, max) => min + Math.random() * (max - min);

    const spawnAmbient = () => {
      const size = random(9, 26);
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
        peak: random(0.24, 0.55),
        life: 0,
        maxLife: random(7, 13),
        wobble: random(0, Math.PI * 2),
      });
    };

    // The imperatively-called burst. Also used internally.
    burstRef.current = (x, y, count, power, spread) => {
      const n = Math.min(count, MAX_PARTICLES - particlesRef.current.length);
      for (let i = 0; i < n; i += 1) {
        const base = spread === Math.PI * 2 ? random(0, Math.PI * 2) : random(-spread / 2, spread / 2) - Math.PI / 2;
        const speed = random(70, 260) * power;
        const size = random(10, 30);
        particlesRef.current.push({
          kind: Math.random() < 0.22 ? 'star' : 'heart',
          x,
          y,
          vx: Math.cos(base) * speed,
          vy: Math.sin(base) * speed - random(20, 90),
          size,
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

    // Pointer trail — throttled by time so a fast mouse can't carpet the screen.
    let lastTrail = 0;
    const onPointerMove = (event) => {
      if (!trail) return;
      const now = performance.now();
      if (now - lastTrail < 42) return;
      lastTrail = now;
      if (particlesRef.current.length >= MAX_PARTICLES - 8) return;
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
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // Reduced motion / low power: paint a single static scattering and stop.
    // Returning early (after listening for resize) keeps the page beautiful for
    // anyone whose device or settings ask for stillness.
    if (reduceMotion || lowPower) {
      const staticHearts = 22;
      for (let i = 0; i < staticHearts; i += 1) {
        const size = random(10, 30);
        particlesRef.current.push({
          kind: Math.random() < 0.2 ? 'star' : 'heart',
          x: random(0, width),
          y: random(0, height),
          vx: 0,
          vy: 0,
          size,
          rot: random(-0.6, 0.6),
          vr: 0,
          hue: random(322, 352),
          alpha: random(0.14, 0.4),
          peak: 0.4,
          life: 0,
          maxLife: Infinity,
          wobble: 0,
        });
      }
      const drawStatic = () => {
        ctx.clearRect(0, 0, width, height);
        for (const p of particlesRef.current) {
          drawParticle(ctx, p, 0);
        }
      };
      const onResize = () => {
        resize();
        drawStatic();
      };
      window.addEventListener('resize', onResize);
      drawStatic();
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointerMove);
      };
    }

    let raf = 0;
    let last = performance.now();
    let spawnAccumulator = 0;
    let running = true;

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      spawnAccumulator += dt * AMBIENT_RATE;
      while (spawnAccumulator >= 1 && particlesRef.current.length < MAX_PARTICLES - 40) {
        spawnAccumulator -= 1;
        spawnAmbient();
      }

      ctx.clearRect(0, 0, width, height);

      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          list.splice(i, 1);
          continue;
        }
        // Ease in, hold, ease out.
        const t = p.life / p.maxLife;
        const fade = t < 0.18 ? t / 0.18 : t > 0.7 ? (1 - t) / 0.3 : 1;
        p.alpha = p.peak * Math.max(0, Math.min(1, fade));

        if (p.gravity) p.vy += p.gravity * dt;
        if (p.drag) {
          const d = Math.pow(p.drag, dt * 60);
          p.vx *= d;
          p.vy *= d;
        }
        p.wobble += dt * 2;
        p.x += (p.vx + Math.sin(p.wobble) * 12) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        drawParticle(ctx, p, dt);
      }

      raf = requestAnimationFrame(frame);
    }

    function drawParticle(c, p, dt) {
      c.save();
      c.globalAlpha = p.alpha;
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.scale(p.size, p.size);
      c.fillStyle = `hsl(${p.hue} 85% ${p.kind === 'star' ? 88 : 74}%)`;
      if (p.kind === 'star') traceStar(c);
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

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [trail]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});

export default HeartCanvas;
