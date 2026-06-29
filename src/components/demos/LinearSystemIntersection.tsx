import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Two-line system solver.
   - Each line carries two draggable control dots; drag them to change
     the line's slope and intercept.
   - The intersection (the simultaneous solution) is marked in emerald
     and reported live — or flagged as parallel (no solution).
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Handle = 'p1' | 'p2' | 'q1' | 'q2';

const COLORS = {
  line1: '#4f46e5',  // indigo
  line2: '#0ea5e9',  // sky
  sol: '#10b981',    // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function LinearSystemIntersection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [p1, setP1] = useState<Pt>({ x: -4, y: -2 });
  const [p2, setP2] = useState<Pt>({ x: 3, y: 3 });
  const [q1, setQ1] = useState<Pt>({ x: -4, y: 4 });
  const [q2, setQ2] = useState<Pt>({ x: 4, y: -3 });
  const dragRef = useRef<Handle | null>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 30, ox: 240, oy: 180 });

  const toPx = (p: Pt): Pt => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };
  const toMath = (px: number, py: number): Pt => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round(((px - ox) / scale) * 2) / 2, y: Math.round(((oy - py) / scale) * 2) / 2 };
  };

  // line params from two points
  const lineOf = (a: Pt, b: Pt) => {
    const m = (b.y - a.y) / (b.x - a.x || 1e-9);
    const c = a.y - m * a.x;
    return { m, c };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const L1 = lineOf(p1, p2);
    const L2 = lineOf(q1, q2);
    const xMin = (0 - ox) / scale;
    const xMax = (w - ox) / scale;

    drawLine(ctx, L1, xMin, xMax, toPx, COLORS.line1);
    drawLine(ctx, L2, xMin, xMax, toPx, COLORS.line2);

    // intersection
    const sol = intersect(L1, L2);
    if (sol) {
      const sp = toPx(sol);
      ctx.save();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(16,185,129,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x, oy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ox, sp.y); ctx.stroke();
      ctx.restore();
      dot(ctx, sp, COLORS.sol, 7);
      label(ctx, sp, 'solution', COLORS.sol);
    }

    // draggable handles
    handle(ctx, toPx(p1), COLORS.line1);
    handle(ctx, toPx(p2), COLORS.line1);
    handle(ctx, toPx(q1), COLORS.line2);
    handle(ctx, toPx(q2), COLORS.line2);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = ht * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ht}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(20, Math.min(40, w / 13));
      sizeRef.current = { w, h: ht, scale, ox: w / 2, oy: ht / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [p1, p2, q1, q2]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const cands: [Handle, Pt][] = [['p1', p1], ['p2', p2], ['q1', q1], ['q2', q2]];
    let best: Handle | null = null; let bestD = 24;
    for (const [name, pt] of cands) {
      const d = dist(toPx(pt), { x: px, y: py });
      if (d < bestD) { bestD = d; best = name; }
    }
    if (best) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    const set = { p1: setP1, p2: setP2, q1: setQ1, q2: setQ2 }[dragRef.current];
    set(m);
  };
  const onUp = () => { dragRef.current = null; };

  const L1 = lineOf(p1, p2);
  const L2 = lineOf(q1, q2);
  const sol = intersect(L1, L2);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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
          <p class="text-muted">Drag the dots to reshape each line. The solution is where they cross.</p>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.line1}`} class="font-semibold">line 1</span>
              <strong class="font-mono">y = {L1.m.toFixed(2)}x + {L1.c.toFixed(2)}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.line2}`} class="font-semibold">line 2</span>
              <strong class="font-mono">y = {L2.m.toFixed(2)}x + {L2.c.toFixed(2)}</strong>
            </div>
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.sol}`} class="font-semibold">solution</span>
              <strong class="font-mono">
                {sol ? `(${sol.x.toFixed(2)}, ${sol.y.toFixed(2)})` : 'none (parallel)'}
              </strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {sol
                ? 'This single point satisfies BOTH equations at once — that is what "solving the system" means.'
                : 'Equal slopes, different intercepts → the lines never meet, so there is no solution.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function intersect(L1: { m: number; c: number }, L2: { m: number; c: number }): Pt | null {
  if (Math.abs(L1.m - L2.m) < 1e-6) return null;
  const x = (L2.c - L1.c) / (L1.m - L2.m);
  const y = L1.m * x + L1.c;
  return { x, y };
}
function drawLine(ctx: CanvasRenderingContext2D, L: { m: number; c: number }, xMin: number, xMax: number, toPx: (p: Pt) => Pt, color: string) {
  const a = toPx({ x: xMin, y: L.m * xMin + L.c });
  const b = toPx({ x: xMax, y: L.m * xMax + L.c });
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function dot(ctx: CanvasRenderingContext2D, at: Pt, color: string, r = 5) {
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
}
function handle(ctx: CanvasRenderingContext2D, at: Pt, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Pt, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
function dist(p: Pt, q: Pt) { return Math.hypot(p.x - q.x, p.y - q.y); }
