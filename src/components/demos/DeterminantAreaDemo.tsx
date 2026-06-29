import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Determinant-as-area demo.
   - Edit a 2x2 matrix with sliders.
   - The unit square is transformed into a parallelogram; its (signed)
     area equals det M. Flips orientation when det < 0, collapses to a
     line (non-invertible) when det = 0.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  i: '#4f46e5',
  j: '#0ea5e9',
  fillPos: 'rgba(16,185,129,0.20)',
  fillNeg: 'rgba(244,114,33,0.20)',
  edge: '#10b981',
  edgeNeg: '#f97316',
  unit: 'rgba(128,128,128,0.45)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function DeterminantAreaDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mat, setMat] = useState<number[]>([1.5, 0.5, 0.5, 1.3]); // a,b,c,d
  const sizeRef = useRef({ w: 480, h: 360, scale: 44, ox: 150, oy: 240 });

  const [a, b, c, d] = mat;
  const det = a * d - b * c;
  const toPx = (p: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // original unit square (dashed)
    ctx.strokeStyle = COLORS.unit;
    ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    polyStroke(ctx, [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}].map(toPx));
    ctx.setLineDash([]);

    // transformed parallelogram: 0, col1, col1+col2, col2
    const col1 = { x: a, y: c };
    const col2 = { x: b, y: d };
    const quad = [{x:0,y:0}, col1, {x: a+b, y: c+d}, col2].map(toPx);
    ctx.fillStyle = det < 0 ? COLORS.fillNeg : COLORS.fillPos;
    ctx.strokeStyle = det < 0 ? COLORS.edgeNeg : COLORS.edge;
    ctx.lineWidth = 2.5;
    polyFill(ctx, quad);

    const origin = { x: ox, y: oy };
    arrow(ctx, origin, toPx(col1), COLORS.i, 3);
    arrow(ctx, origin, toPx(col2), COLORS.j, 3);
    label(ctx, toPx(col1), 'col 1', COLORS.i);
    label(ctx, toPx(col2), 'col 2', COLORS.j);
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
      const scale = Math.max(30, Math.min(50, w / 9));
      sizeRef.current = { w, h, scale, ox: w * 0.4, oy: h * 0.62 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [mat]);

  const setEntry = (i: number, v: number) =>
    setMat((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  const near0 = Math.abs(det) < 0.02;
  const labels = ['a', 'b', 'c', 'd'];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">The gray dashed square has area 1. The matrix stretches it into the colored parallelogram.</p>
          <div class="grid grid-cols-2 gap-3">
            {[0,1,2,3].map((i) => (
              <label key={i} class="block">
                <span class="mb-1 block text-muted">{labels[i]} = {mat[i].toFixed(2)}</span>
                <input type="range" min={-2} max={2} step={0.05} value={mat[i]}
                  onInput={(e) => setEntry(i, parseFloat((e.target as HTMLInputElement).value))}
                  class="w-full accent-[#4f46e5]" />
              </label>
            ))}
          </div>
          <div class={`rounded-lg p-3 ${near0 ? 'bg-geometry/10' : 'bg-surface-2'}`}>
            <div class="flex justify-between">
              <span class="text-muted">det M = ad − bc</span>
              <strong class={near0 ? 'text-geometry' : ''}>{det.toFixed(3)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">area of parallelogram</span>
              <strong>{Math.abs(det).toFixed(3)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {near0 ? '⚠️ det ≈ 0 → the square is flattened onto a line. The matrix is NOT invertible.'
                : det < 0 ? 'det < 0 → area is preserved but orientation is flipped (mirror image).'
                : 'det > 0 → the matrix scales area by this factor and keeps orientation.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function polyStroke(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath(); ctx.stroke();
}
function polyFill(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 10;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 8, at.y - 6);
}
