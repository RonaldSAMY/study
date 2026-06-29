import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Matrix transform demo.
   - Edit the four entries of a 2x2 matrix M = [[a,b],[c,d]].
   - A reference "F" shape + grid is transformed live by M.
   - The transformed basis vectors (columns of M) are drawn in color.
   - Preset buttons: rotate, scale, shear, flip.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  i: '#4f46e5',  // first column (image of î)
  j: '#0ea5e9',  // second column (image of ĵ)
  shape: '#10b981',
  ghost: 'rgba(128,128,128,0.45)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

// reference "F" as a polyline in unit-ish coordinates
const SHAPE: Vec[] = [
  { x: 0, y: 0 }, { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2.3 },
  { x: 0.8, y: 2.3 }, { x: 0.8, y: 1.7 }, { x: 1.7, y: 1.7 },
  { x: 1.7, y: 1.0 }, { x: 0.8, y: 1.0 }, { x: 0.8, y: 0 }, { x: 0, y: 0 },
];

const PRESETS: Record<string, number[]> = {
  identity: [1, 0, 0, 1],
  rotate: [0, -1, 1, 0],
  scale: [1.5, 0, 0, 0.6],
  shear: [1, 1, 0, 1],
  flip: [-1, 0, 0, 1],
};

export default function MatrixTransformDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mat, setMat] = useState<number[]>([1, 1, 0, 1]); // a,b,c,d
  const sizeRef = useRef({ w: 480, h: 360, scale: 40, ox: 160, oy: 240 });

  const [a, b, c, d] = mat;
  const apply = (p: Vec): Vec => ({ x: a * p.x + b * p.y, y: c * p.x + d * p.y });

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

    // ghost (original) shape
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    poly(ctx, SHAPE.map(toPx));
    ctx.setLineDash([]);

    // transformed shape
    ctx.strokeStyle = COLORS.shape;
    ctx.fillStyle = 'rgba(16,185,129,0.12)';
    ctx.lineWidth = 2.5;
    polyFill(ctx, SHAPE.map((p) => toPx(apply(p))));

    // transformed basis vectors = columns of M
    const origin = { x: ox, y: oy };
    arrow(ctx, origin, toPx({ x: a, y: c }), COLORS.i, 3);   // image of î = first column
    arrow(ctx, origin, toPx({ x: b, y: d }), COLORS.j, 3);   // image of ĵ = second column
    label(ctx, toPx({ x: a, y: c }), 'col 1', COLORS.i);
    label(ctx, toPx({ x: b, y: d }), 'col 2', COLORS.j);
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
      const scale = Math.max(26, Math.min(46, w / 11));
      sizeRef.current = { w, h, scale, ox: w * 0.42, oy: h * 0.62 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [mat]);

  const setEntry = (i: number, v: string) => {
    const n = parseFloat(v);
    setMat((prev) => prev.map((x, idx) => (idx === i ? (isNaN(n) ? 0 : n) : x)));
  };

  // sample point to illustrate row · column dot products
  const sample: Vec = { x: 2, y: 1 };
  const out = apply(sample);
  const det = a * d - b * c;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((name) => (
          <button key={name} onClick={() => setMat(PRESETS[name])}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold capitalize text-muted transition hover:text-text">
            {name}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">M = the 2×2 matrix. Its columns are where î and ĵ land.</p>
          <div class="inline-grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <input key={i} type="number" step={0.1} value={mat[i]}
                onInput={(e) => setEntry(i, (e.target as HTMLInputElement).value)}
                class={`w-16 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-center font-mono ${i === 0 || i === 2 ? 'text-[#4f46e5]' : 'text-[#0ea5e9]'}`} />
            ))}
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <p class="mb-1 font-semibold">Applying M to the point (2, 1):</p>
            <p class="font-mono">x' = ({a})(2) + ({b})(1) = {out.x.toFixed(1)}</p>
            <p class="font-mono">y' = ({c})(2) + ({d})(1) = {out.y.toFixed(1)}</p>
            <p class="mt-1 text-muted">Each output coordinate is a <strong>row · point</strong> dot product.</p>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <span class="text-muted">det M (area scale) = </span><strong>{det.toFixed(2)}</strong>
            {Math.abs(det) < 1e-9 && <span class="text-geometry"> — collapses to a line!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function poly(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
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
