import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_AGAIN,
  GAME_AGAIN_EMOJI,
  GAME_EYEBROW,
  GAME_GOAL,
  GAME_HUD_EMOJI,
  GAME_INTRO,
  GAME_ITEMS,
  GAME_LEGEND,
  GAME_MOVE_HINT,
  GAME_PENALTY_TEXT,
  GAME_SLOWMO_TEXT,
  GAME_START,
  GAME_START_EMOJI,
  GAME_TITLE,
  GAME_TUNING,
  GAME_WIN_BODY,
  GAME_WIN_TITLE,
  gamePointsText,
} from './config';
import { useInView } from './hooks';
import { sfx } from './sfx';

// HeartCatch — a small, forgiving catch game that sits between the reasons and
// the counter. Slide the basket (pointer, finger or arrow keys); catch hearts.
//
//   💗  +1, and each catch in a row builds a combo (a multiplier up to x4)
//   💛  +5, rare
//   💍  slow motion for four seconds
//   💔  −2 and breaks the combo — the only way to "lose" ground
//
// There is no game-over: it is a love letter in disguise, so it only ever ends
// one way. Reaching GAME_GOAL fires a salvo of rockets and shows the win card.
//
// ARCHITECTURE: the loop and all game state live in refs and one <canvas>; React
// state holds only what the DOM shows (phase, score, multiplier), and is set
// only when those change. The loop runs only while playing AND on screen.

const KINDS = GAME_ITEMS;

const pickKind = (score) => {
  const t = GAME_TUNING;
  const r = Math.random();
  if (r < t.goldChance) return 'gold';
  if (r < t.ringChance) return 'ring';
  // Broken hearts get a touch more common as the score climbs.
  const broken = t.brokenBaseChance + Math.min(t.brokenScoreCreepMax, score * t.brokenScoreCreep);
  if (r < broken) return 'broken';
  return 'heart';
};

// x1..x4 as the combo climbs (see GAME_TUNING.comboStep / maxMultiplier).
const comboMult = (combo) =>
  1 + Math.min(GAME_TUNING.maxMultiplier - 1, Math.floor(combo / GAME_TUNING.comboStep));

const makeGame = () => ({
  w: 360,
  h: 440,
  dpr: 1,
  px: 180,
  tx: 180,
  items: [],
  floats: [],
  sparks: [],
  score: 0,
  combo: 0,
  spawn: 0.4,
  last: 0,
  slowUntil: 0,
  slowOn: false,
  shake: 0,
  keys: { left: false, right: false },
});

function drawBasket(c, x, y, w, lean) {
  c.save();
  c.translate(x, y);
  c.rotate(lean);
  const body = c.createLinearGradient(0, -14, 0, 24);
  body.addColorStop(0, '#ffd6e6');
  body.addColorStop(1, '#e07cae');
  c.fillStyle = body;
  c.shadowColor = 'rgba(255,120,190,0.55)';
  c.shadowBlur = 18;
  c.beginPath();
  c.moveTo(-w / 2, -10);
  c.quadraticCurveTo(-w / 2, 26, -w * 0.28, 26);
  c.lineTo(w * 0.28, 26);
  c.quadraticCurveTo(w / 2, 26, w / 2, -10);
  c.closePath();
  c.fill();
  c.shadowBlur = 0;
  // The rim, seen from slightly above.
  c.fillStyle = '#fff1f5';
  c.beginPath();
  c.ellipse(0, -10, w / 2, 6.5, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(140,32,88,0.35)';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#c2185b';
  c.font = '700 15px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('♥', 0, 9);
  c.restore();
}

export default function HeartCatch({ burstAt, fireworkAt, rocketAt }) {
  const [sectionRef, inView] = useInView({ threshold: 0.35, once: false });
  const fieldRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(makeGame());
  const rafRef = useRef(0);
  const timersRef = useRef([]);
  const [phase, setPhase] = useState('idle'); // idle | playing | won
  const [score, setScore] = useState(0);
  const [mult, setMult] = useState(1);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 360;
    const h = canvas.clientHeight || 440;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    g.w = w;
    g.h = h;
    g.dpr = dpr;
    g.px = Math.min(Math.max(g.px, 0), w);
    g.tx = Math.min(Math.max(g.tx, 0), w);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const win = useCallback(() => {
    setPhase('won');
    sfx.win();
    const w = window.innerWidth;
    const h = window.innerHeight;
    [0, 240, 480, 720, 960].forEach((delay, i) => {
      timersRef.current.push(
        setTimeout(
          () => rocketAt?.(w * (0.14 + 0.18 * i), h * (0.18 + (i % 2) * 0.14), i % 2 ? 'heart' : 'peony'),
          delay
        )
      );
    });
    burstAt?.(w / 2, h * 0.5, { count: 80, power: 1.6 });
    fireworkAt?.(w / 2, h * 0.3, 'heart');
  }, [burstAt, fireworkAt, rocketAt]);

  // The game loop. Runs only while playing and visible.
  useEffect(() => {
    if (phase !== 'playing' || !inView) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    const g = gameRef.current;
    measure();
    g.last = performance.now();
    let cancelled = false;

    const addSpark = (x, y, hue, n = 8) => {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 150;
        g.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: 0.5 + Math.random() * 0.4, hue });
      }
    };
    const addFloat = (x, y, text, color) => g.floats.push({ x, y, text, color, life: 0 });

    const step = (now) => {
      if (cancelled) return;
      const dt = Math.min((now - g.last) / 1000, 0.04);
      g.last = now;
      const slow = now < g.slowUntil ? 0.5 : 1;
      const k = g.h / 460; // speeds scale with the field's height

      const isSlow = slow !== 1;
      if (isSlow !== g.slowOn) {
        g.slowOn = isSlow;
        fieldRef.current?.classList.toggle('is-slow', isSlow);
      }

      // Keyboard + smoothed pointer follow.
      if (g.keys.left) g.tx -= GAME_TUNING.basketSpeed * dt;
      if (g.keys.right) g.tx += GAME_TUNING.basketSpeed * dt;
      g.tx = Math.min(Math.max(g.tx, 0), g.w);
      const prev = g.px;
      g.px += (g.tx - g.px) * Math.min(1, dt * GAME_TUNING.basketFollow);
      const lean = Math.max(-0.35, Math.min(0.35, (g.px - prev) * 0.05));

      // Spawn faster as the score climbs.
      g.spawn -= dt * slow;
      if (g.spawn <= 0) {
        const kind = pickKind(g.score);
        g.items.push({
          kind,
          x: 24 + Math.random() * (g.w - 48),
          y: -24,
          vy:
            (GAME_TUNING.fallBase +
              g.score * GAME_TUNING.fallScoreFactor +
              Math.random() * GAME_TUNING.fallJitter) *
            k,
          rot: (Math.random() - 0.5) * 0.6,
          vr: (Math.random() - 0.5) * 2,
          phase: Math.random() * 6,
        });
        g.spawn = Math.max(
          GAME_TUNING.spawnMin,
          GAME_TUNING.spawnStart - g.score * GAME_TUNING.spawnScoreFactor
        );
      }

      const pw = Math.min(100, Math.max(66, g.w * 0.21));
      const catchY = g.h - 50;
      let scoreChanged = false;

      for (let i = g.items.length - 1; i >= 0; i -= 1) {
        const it = g.items[i];
        it.y += it.vy * dt * slow;
        it.x += Math.sin(now / 520 + it.phase) * 22 * dt * slow;
        it.rot += it.vr * dt * slow;

        const caught =
          it.y > catchY - GAME_TUNING.catchWindow[0] &&
          it.y < catchY + GAME_TUNING.catchWindow[1] &&
          Math.abs(it.x - g.px) < pw / 2 + 8;
        if (caught) {
          g.items.splice(i, 1);
          if (it.kind === 'broken') {
            g.score = Math.max(0, g.score - GAME_TUNING.brokenPenalty);
            g.combo = 0;
            g.shake = 0.35;
            addSpark(it.x, it.y, 270, 10);
            addFloat(it.x, it.y - 10, GAME_PENALTY_TEXT, '#c4b5fd');
            sfx.miss();
          } else if (it.kind === 'ring') {
            g.slowUntil = now + GAME_TUNING.slowMoMs;
            addSpark(it.x, it.y, 200, 14);
            addFloat(it.x, it.y - 10, GAME_SLOWMO_TEXT, '#a5f3fc');
            sfx.slow();
          } else {
            const multiplier = comboMult(g.combo);
            const pts = it.kind === 'gold' ? GAME_TUNING.goldPoints : multiplier;
            g.score += pts;
            g.combo += 1;
            addSpark(it.x, it.y, it.kind === 'gold' ? 48 : 335, it.kind === 'gold' ? 16 : 8);
            addFloat(it.x, it.y - 10, gamePointsText(pts), it.kind === 'gold' ? '#fde68a' : '#ffd6e6');
            if (it.kind === 'gold') sfx.gold();
            else sfx.catch(g.combo);
          }
          scoreChanged = true;
        } else if (it.y > g.h + 30) {
          g.items.splice(i, 1);
          if (it.kind !== 'broken') g.combo = 0; // a missed heart breaks the streak
        }
      }

      if (scoreChanged) {
        setScore(g.score);
        setMult(comboMult(g.combo));
        if (g.score >= GAME_GOAL) {
          cancelled = true;
          win();
          return;
        }
      }

      // ---- draw ----
      const { dpr } = g;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      g.shake = Math.max(0, g.shake - dt);
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * g.shake * 3, 0);

      // The floor glow under the basket.
      const glow = ctx.createRadialGradient(g.px, g.h, 0, g.px, g.h, 120);
      glow.addColorStop(0, 'rgba(255,140,200,0.35)');
      glow.addColorStop(1, 'rgba(255,140,200,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, g.h - 130, g.w, 130);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const it of g.items) {
        const meta = KINDS[it.kind];
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        if (it.kind === 'gold') {
          ctx.shadowColor = 'rgba(253,224,71,0.95)';
          ctx.shadowBlur = 22;
        } else if (it.kind === 'broken') {
          ctx.shadowColor = 'rgba(167,139,250,0.7)';
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowColor = 'rgba(255,100,170,0.55)';
          ctx.shadowBlur = 12;
        }
        ctx.font = `${meta.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.fillText(meta.emoji, 0, 0);
        ctx.restore();
      }

      drawBasket(ctx, g.px, g.h - 36, pw, lean);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = g.sparks.length - 1; i >= 0; i -= 1) {
        const s = g.sparks[i];
        s.life += dt;
        if (s.life >= s.max) {
          g.sparks.splice(i, 1);
          continue;
        }
        s.vy += 260 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        ctx.globalAlpha = 1 - s.life / s.max;
        ctx.fillStyle = `hsl(${s.hue} 90% 70%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.font = '800 17px system-ui, sans-serif';
      for (let i = g.floats.length - 1; i >= 0; i -= 1) {
        const f = g.floats[i];
        f.life += dt;
        if (f.life > 0.9) {
          g.floats.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 1 - f.life / 0.9;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - f.life * 46);
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, inView, measure, win]);

  const start = () => {
    const g = gameRef.current;
    Object.assign(g, makeGame(), { w: g.w, h: g.h, dpr: g.dpr });
    g.px = g.w / 2;
    g.tx = g.w / 2;
    fieldRef.current?.classList.remove('is-slow');
    setScore(0);
    setMult(1);
    setPhase('playing');
    sfx.chime(4, 0.14);
    canvasRef.current?.focus({ preventScroll: true });
  };

  const onPointer = (event) => {
    if (phase !== 'playing') return;
    const rect = canvasRef.current.getBoundingClientRect();
    gameRef.current.tx = event.clientX - rect.left;
  };
  const setKey = (event, down) => {
    const g = gameRef.current;
    if (event.key === 'ArrowLeft' || event.key === 'a') g.keys.left = down;
    else if (event.key === 'ArrowRight' || event.key === 'd') g.keys.right = down;
    else return;
    event.preventDefault();
  };

  const pct = Math.min(100, (score / GAME_GOAL) * 100);

  return (
    <section className="lv-act lv-game" ref={sectionRef}>
      <p className="lv-eyebrow">{GAME_EYEBROW}</p>
      <h2 className="lv-act__title lv-grad">{GAME_TITLE}</h2>

      <div className="lv-game__hud" aria-live="polite">
        <span className="lv-game__score">
          {GAME_HUD_EMOJI} {score} / {GAME_GOAL}
        </span>
        <span className="lv-game__bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className={`lv-game__mult${mult > 1 ? ' is-on' : ''}`}>x{mult}</span>
      </div>

      <div className="lv-game__field" ref={fieldRef}>
        <canvas
          ref={canvasRef}
          className="lv-game__canvas"
          style={{ touchAction: phase === 'playing' ? 'none' : 'auto' }}
          tabIndex={0}
          role="application"
          aria-label={GAME_MOVE_HINT}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onKeyDown={(e) => setKey(e, true)}
          onKeyUp={(e) => setKey(e, false)}
        />

        {phase !== 'playing' && (
          <div className="lv-game__overlay">
            {phase === 'won' ? (
              <>
                <p className="lv-game__win lv-grad">{GAME_WIN_TITLE}</p>
                <p className="lv-note">{GAME_WIN_BODY}</p>
              </>
            ) : (
              <>
                <p className="lv-note">{GAME_INTRO}</p>
                <ul className="lv-game__legend">
                  {GAME_LEGEND.map(([emoji, label]) => (
                    <li key={emoji}>
                      <span aria-hidden="true">{emoji}</span> {label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="lv-btn" onClick={start}>
              <span aria-hidden="true">{phase === 'won' ? GAME_AGAIN_EMOJI : GAME_START_EMOJI}</span>
              {phase === 'won' ? GAME_AGAIN : GAME_START}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
