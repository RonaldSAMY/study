import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Convexity explorer.
   - Toggle between a CONVEX bowl and a NON-CONVEX, bumpy landscape.
   - Drag the start point (or click the curve) and run gradient descent.
   - On the convex curve the ball always finds the one global minimum.
   - On the bumpy curve it gets STUCK in whatever valley is nearest.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#4f46e5',
  ball: '#10b981',
  path: '#0ea5e9',
  global: '#f59e0b',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type Land = 'convex' | 'bumpy';

// Convex bowl
const convex = (x: number) => 0.12 * x * x + 0.6;
const dConvex = (x: number) => 0.24 * x;
// Non-convex: several valleys of different depth
const bumpy = (x: number) => 0.05 * x * x + 1.4 * Math.sin(1.15 * x) + 2.2;
const dBumpy = (x: number) => 0.1 * x + 1.4 * 1.15 * Math.cos(1.15 * x);

export default function ConvexityLandscapeExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [land, setLand] = useState<Land>('convex');
  const [start, setStart] = useState(-5);
  const [shown, setShown] = useState(40);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 340, sx: 30, sy: 36, ox: 240, oy: 300 });

  const f = land === 'convex' ? convex : bumpy;
  const df = land === 'convex' ? dConvex : dBumpy;
  const lr = 0.35;
  const N = 60;

  const path: number[] = [start];
  for (let i = 0; i < N; i++) {
    const xp = path[path.length - 1];
    let xn = xp - lr * df(xp);
    xn = Math.max(-8.5, Math.min(8.5, xn));
    path.push(xn);
  }

  const toPx = (x: number, y: number) => {
    const { sx, sy, ox, oy } = sizeRef.current;
    return { x: ox + x * sx, y: oy - y * sy };
  };
  const toMathX = (px: number) => (px - sizeRef.current.ox) / sizeRef.current.sx;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // axis
    const base = toPx(0, 0);
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, base.y); ctx.lineTo(w, base.y); ctx.stroke();

    // curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.beginPath();
    let first = true;
    for (let px = 0; px <= w; px += 2) {
      const x = toMathX(px);
      const p = toPx(x, f(x));
      if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // mark the GLOBAL minimum (sample finely)
    let gx = -8.5, gy = Infinity;
    for (let x = -8.5; x <= 8.5; x += 0.02) { const y = f(x); if (y < gy) { gy = y; gx = x; } }
    const gp = toPx(gx, gy);
    ctx.beginPath(); ctx.arc(gp.x, gp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.global; ctx.fill();
    ctx.fillStyle = COLORS.global; ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('global min', gp.x - 24, gp.y + 22);

    // descent path
    const reveal = Math.min(shown, path.length - 1);
    ctx.fillStyle = COLORS.path;
    for (let i = 0; i <= reveal; i++) {
      const p = toPx(path[i], f(path[i]));
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // ball
    const cp = toPx(path[reveal], f(path[reveal]));
    ctx.beginPath(); ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.68);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = w / 18;
      const sy = h / 7;
      sizeRef.current = { w, h, sx, sy, ox: w / 2, oy: h - 30 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [land, start, shown]);

  const run = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setShown(0);
    let i = 0; let last = performance.now();
    const tick = (t: number) => {
      if (t - last > 90) { i += 1; setShown(i); last = t; }
      if (i < N) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const x = Math.max(-8, Math.min(8, toMathX(pointer(e))));
    setStart(x); setShown(0);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const x = Math.max(-8, Math.min(8, toMathX(pointer(e))));
    setStart(x); setShown(0);
  };
  const onUp = () => { draggingRef.current = false; };

  const reveal = Math.min(shown, path.length - 1);
  const landed = path[reveal];
  let gx = -8.5, gy = Infinity;
  for (let x = -8.5; x <= 8.5; x += 0.02) { const y = f(x); if (y < gy) { gy = y; gx = x; } }
  const stuck = Math.abs(landed - gx) > 0.6 && shown >= N;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['convex', 'bumpy'] as Land[]).map((m) => (
          <button key={m} onClick={() => { setLand(m); setShown(N); }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              land === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}>
            {m === 'convex' ? 'Convex bowl' : 'Non-convex (bumpy)'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag anywhere on the plot to set the <strong>start</strong>, then run.</p>
          <button onClick={run}
            class="w-full rounded-lg bg-brand px-3 py-2 font-semibold text-white transition hover:opacity-90">
            ▶ Roll downhill
          </button>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">landed at x</span><strong>{landed.toFixed(2)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">global min at</span><strong>{gx.toFixed(2)}</strong></div>
            <p class="mt-1 text-xs text-muted">
              {land === 'convex'
                ? 'Convex: every start rolls to the same global minimum. ✅'
                : stuck
                  ? '⚠️ Stuck in a local minimum — gradient descent only sees the slope right under the ball.'
                  : 'Try several starts: some valleys are traps, not the global best.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
