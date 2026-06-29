import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Transformations: translate, rotate, scale.
   - A base shape (faint) and its transformed copy (solid) on a grid.
   - Sliders control the translation vector (tx, ty), rotation angle,
     and scale factor.
   - The translation is drawn as an ARROW from the origin — a first
     glimpse of a vector, the next big idea.
   ------------------------------------------------------------------ */

const COLORS = {
  base: 'rgba(100,116,139,0.55)',
  shape: '#4f46e5',
  vec: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// a little flag / arrow shape (math units, y-up)
const SHAPE: [number, number][] = [
  [0, 0], [3, 0], [3, 1.5], [1.5, 1.5], [1.5, 3], [0, 3],
];

export default function ShapeTransformLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tx, setTx] = useState(2);
  const [ty, setTy] = useState(1);
  const [deg, setDeg] = useState(30);
  const [sc, setSc] = useState(1);
  const sizeRef = useRef({ w: 480, h: 360, scale: 28, ox: 240, oy: 180 });

  const toPx = (x: number, y: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + x * scale, y: oy - y * scale };
  };

  const transform = (x: number, y: number) => {
    const t = (deg * Math.PI) / 180;
    const sx = x * sc, sy = y * sc;
    const rx = sx * Math.cos(t) - sy * Math.sin(t);
    const ry = sx * Math.sin(t) + sy * Math.cos(t);
    return { x: rx + tx, y: ry + ty };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // base shape (faint)
    poly(ctx, SHAPE.map(([x, y]) => toPx(x, y)), COLORS.base, false);

    // transformed shape
    poly(ctx, SHAPE.map(([x, y]) => { const p = transform(x, y); return toPx(p.x, p.y); }), COLORS.shape, true);

    // translation vector arrow (origin -> (tx,ty))
    if (Math.hypot(tx, ty) > 0.01) {
      arrow(ctx, toPx(0, 0), toPx(tx, ty), COLORS.vec, 3);
      const mid = toPx(tx / 2, ty / 2);
      ctx.fillStyle = COLORS.vec; ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`[${tx}, ${ty}]`, mid.x + 6, mid.y - 4);
    }
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
      const scale = Math.max(18, Math.min(34, w / 15));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [tx, ty, deg, sc]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <Slider label="translate x" value={tx} min={-4} max={4} step={1} set={setTx} color="#10b981" />
          <Slider label="translate y" value={ty} min={-4} max={4} step={1} set={setTy} color="#10b981" />
          <Slider label="rotate °" value={deg} min={0} max={360} step={5} set={setDeg} color="#4f46e5" />
          <Slider label="scale ×" value={sc} min={0.3} max={2} step={0.1} set={setSc} color="#0ea5e9" />
          <div class="flex flex-wrap gap-2">
            <button onClick={() => { setTx(2); setTy(1); setDeg(30); setSc(1); }}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">reset</button>
            <button onClick={() => { setTx(0); setTy(0); setDeg(0); setSc(1); }}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">identity</button>
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The green arrow <strong>[{tx}, {ty}]</strong> is a <strong>vector</strong> — the exact object the next track is built on.
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, set, color }:
  { label: string; value: number; min: number; max: number; step: number; set: (n: number) => void; color: string }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label} = {Number.isInteger(value) ? value : value.toFixed(1)}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full" style={`accent-color:${color}`} />
    </label>
  );
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string, fill: boolean) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = 'rgba(79,70,229,0.16)'; ctx.fill(); }
  ctx.strokeStyle = color; ctx.lineWidth = fill ? 2.5 : 2; ctx.stroke();
}
function arrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
