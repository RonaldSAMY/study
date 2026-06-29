import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Distance & midpoint on the coordinate plane.
   - Drag the two points P and Q.
   - The horizontal and vertical gaps form the legs of a right triangle;
     the straight line PQ is the hypotenuse = the distance.
   - The midpoint (average of coordinates) is marked too.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const COLORS = {
  p: '#4f46e5',
  q: '#0ea5e9',
  line: '#10b981',
  leg: 'rgba(245,158,11,0.9)',
  mid: '#f59e0b',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function DistanceMidpointGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState<Pt>({ x: -3, y: -2 });
  const [q, setQ] = useState<Pt>({ x: 3, y: 2 });
  const dragRef = useRef<null | 'p' | 'q'>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 30, ox: 240, oy: 180 });

  const toPx = (v: Pt) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Pt => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round((px - ox) / scale), y: Math.round((oy - py) / scale) };
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
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const P = toPx(p), Q = toPx(q);
    const corner = toPx({ x: q.x, y: p.y }); // right-angle corner

    // legs (Δx, Δy)
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = COLORS.leg; ctx.lineWidth = 2.5;
    seg(ctx, P, corner);
    seg(ctx, corner, Q);
    ctx.setLineDash([]);
    // leg labels
    ctx.fillStyle = '#d97706'; ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Δx = ${Math.abs(q.x - p.x)}`, (P.x + corner.x) / 2, corner.y + 14);
    ctx.fillText(`Δy = ${Math.abs(q.y - p.y)}`, corner.x + 26, (corner.y + Q.y) / 2);

    // hypotenuse = distance
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 3;
    seg(ctx, P, Q);

    // midpoint
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const Mp = toPx(mid);
    ctx.beginPath(); ctx.arc(Mp.x, Mp.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.mid; ctx.fill();

    // points + handles
    handle(ctx, P.x, P.y, COLORS.p);
    handle(ctx, Q.x, Q.y, COLORS.q);
    ctx.fillStyle = COLORS.p; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`P(${p.x}, ${p.y})`, P.x + 10, P.y - 8);
    ctx.fillStyle = COLORS.q;
    ctx.fillText(`Q(${q.x}, ${q.y})`, Q.x + 10, Q.y - 8);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(22, Math.min(40, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [p, q]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const P = toPx(p), Q = toPx(q);
    const dP = Math.hypot(px - P.x, py - P.y);
    const dQ = Math.hypot(px - Q.x, py - Q.y);
    if (dP < 22 && dP <= dQ) dragRef.current = 'p';
    else if (dQ < 22) dragRef.current = 'q';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'p') setP(m); else setQ(m);
  };
  const onUp = () => { dragRef.current = null; };

  const dx = q.x - p.x, dy = q.y - p.y;
  const dist = Math.hypot(dx, dy);
  const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };

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
          <p class="text-muted">Drag P and Q. The orange legs are Δx and Δy; the green hypotenuse is the distance.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-[0.8rem] leading-relaxed">
            <div>d = √(Δx² + Δy²)</div>
            <div class="mt-1">= √({Math.abs(dx)}² + {Math.abs(dy)}²) = <strong style={`color:${COLORS.line}`}>{dist.toFixed(3)}</strong></div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-[0.8rem]">
            midpoint = ({mid.x}, {mid.y})
          </div>
        </div>
      </div>
    </div>
  );
}

function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function handle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
