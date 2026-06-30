import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Easing-curve editor + a ball that animates with the chosen curve.
   - The curve is a cubic Bézier from (0,0) to (1,1); drag the two
     indigo/sky control points to reshape the timing.
   - Presets fill in classic easings (linear, ease-in/out, "back"
     overshoot). A ball ping-pongs using the curve as its timing.
   ------------------------------------------------------------------ */

type CP = { x1: number; y1: number; x2: number; y2: number };

const PRESETS: Record<string, CP> = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  back: { x1: 0.68, y1: -0.55, x2: 0.27, y2: 1.55 },
};

const COLORS = {
  curve: '#10b981',
  p1: '#4f46e5',
  p2: '#0ea5e9',
  ball: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  guide: 'rgba(128,128,128,0.4)',
};

export default function EasingCurveStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geomRef = useRef({ w: 460, h: 500, m: 26, S: 408, trackY: 470 });
  const cpRef = useRef<CP>({ ...PRESETS['ease-in-out'] });
  const dragRef = useRef<null | 1 | 2>(null);
  const rafRef = useRef<number | null>(null);
  const [cp, setCp] = useState<CP>({ ...PRESETS['ease-in-out'] });
  const [preset, setPreset] = useState('ease-in-out');
  cpRef.current = cp;

  // plot <-> pixel helpers (plot space: x,y in [0,1], y up)
  const toPx = (x: number, y: number) => {
    const { m, S } = geomRef.current;
    return { px: m + x * S, py: m + (1 - y) * S };
  };
  const toPlot = (px: number, py: number) => {
    const { m, S } = geomRef.current;
    return { x: (px - m) / S, y: 1 - (py - m) / S };
  };

  const draw = (u: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, m, S, trackY } = geomRef.current;
    const c = cpRef.current;
    ctx.clearRect(0, 0, w, h);

    // plot frame + grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gx = m + (i / 4) * S;
      const gy = m + (i / 4) * S;
      ctx.beginPath(); ctx.moveTo(gx, m); ctx.lineTo(gx, m + S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m, gy); ctx.lineTo(m + S, gy); ctx.stroke();
    }
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.fillText('time →', m + S - 44, m + S + 16);
    ctx.save();
    ctx.translate(m - 14, m + 34); ctx.rotate(-Math.PI / 2);
    ctx.fillText('value →', 0, 0); ctx.restore();

    // control handles
    const P0 = toPx(0, 0), P3 = toPx(1, 1);
    const P1 = toPx(c.x1, c.y1), P2 = toPx(c.x2, c.y2);
    ctx.strokeStyle = COLORS.guide;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(P0.px, P0.py); ctx.lineTo(P1.px, P1.py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(P3.px, P3.py); ctx.lineTo(P2.px, P2.py); ctx.stroke();

    // the easing curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const s = i / 80;
      const bx = bez(s, 0, c.x1, c.x2, 1);
      const by = bez(s, 0, c.y1, c.y2, 1);
      const p = toPx(bx, by);
      if (i === 0) ctx.moveTo(p.px, p.py); else ctx.lineTo(p.px, p.py);
    }
    ctx.stroke();

    // moving dot on the curve at current time u
    const s = solveS(u, c.x1, c.x2);
    const eased = bez(s, 0, c.y1, c.y2, 1);
    const dot = toPx(u, eased);
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath(); ctx.arc(dot.px, dot.py, 5, 0, Math.PI * 2); ctx.fill();

    handle(ctx, P1, COLORS.p1, '1');
    handle(ctx, P2, COLORS.p2, '2');

    // animation track + ball
    ctx.strokeStyle = COLORS.guide;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m, trackY); ctx.lineTo(m + S, trackY); ctx.stroke();
    const ballX = m + eased * S;
    ctx.beginPath(); ctx.arc(ballX, trackY, 13, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const m = 26;
      const S = w - 2 * m;
      const trackY = m + S + 44;
      const h = trackY + 30;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geomRef.current = { w, h, m, S, trackY };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- continuous ping-pong animation ----
  useEffect(() => {
    const period = 1.6;
    const start = performance.now();
    const tick = (now: number) => {
      const el = ((now - start) / 1000) % (2 * period);
      const u = el < period ? el / period : 2 - el / period; // 0→1→0
      draw(u);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---- drag control points ----
  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const c = cpRef.current;
    const P1 = toPx(c.x1, c.y1), P2 = toPx(c.x2, c.y2);
    const d1 = Math.hypot(P1.px - px, P1.py - py);
    const d2 = Math.hypot(P2.px - px, P2.py - py);
    if (d1 < 22 && d1 <= d2) dragRef.current = 1;
    else if (d2 < 22) dragRef.current = 2;
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = toPlot(e.clientX - rect.left, e.clientY - rect.top);
    const cx = Math.max(0, Math.min(1, x));
    const cy = Math.max(-0.6, Math.min(1.6, y));
    setPreset('custom');
    setCp((prev) => (dragRef.current === 1 ? { ...prev, x1: cx, y1: cy } : { ...prev, x2: cx, y2: cy }));
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => { setPreset(name); setCp({ ...PRESETS[name] }); }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              preset === name ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the two control points to reshape the timing curve.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-xs">
            cubic-bezier(
            <span style={`color:${COLORS.p1}`}>{cp.x1.toFixed(2)}, {cp.y1.toFixed(2)}</span>,{' '}
            <span style={`color:${COLORS.p2}`}>{cp.x2.toFixed(2)}, {cp.y2.toFixed(2)}</span>)
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The ball below uses the green curve as its clock: a straight line gives constant speed,
            while a curved one makes it <strong>accelerate</strong> and <strong>settle</strong>. The
            <strong> back</strong> preset dips below 0 and past 1 — that overshoot is what makes UI feel
            springy.
          </p>
        </div>
      </div>
    </div>
  );
}

function handle(ctx: CanvasRenderingContext2D, p: { px: number; py: number }, color: string, text: string) {
  ctx.beginPath(); ctx.arc(p.px, p.py, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText(text, p.px + 11, p.py - 9);
}

// one component of a cubic Bézier with P0..P3
function bez(s: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - s;
  return u * u * u * p0 + 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s * p3;
}
// find parameter s such that the Bézier x equals targetX (time)
function solveS(targetX: number, x1: number, x2: number) {
  let lo = 0, hi = 1, s = targetX;
  for (let i = 0; i < 24; i++) {
    s = (lo + hi) / 2;
    const x = bez(s, 0, x1, x2, 1);
    if (x < targetX) lo = s; else hi = s;
  }
  return s;
}
