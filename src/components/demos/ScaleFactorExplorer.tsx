import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Similarity & scale factor.
   - A base shape (a little "house" pentagon) is shown in indigo.
   - A slider scales a similar copy by factor k from a fixed corner.
   - Corresponding sides keep the SAME ratio k; perimeter scales by k,
     area scales by k².
   ------------------------------------------------------------------ */

const COLORS = {
  base: '#4f46e5',
  copy: '#10b981',
};

// base shape in math units (y-up), anchored so (0,0) is the scaling center
const SHAPE: [number, number][] = [
  [0, 0], [4, 0], [4, 3], [2, 4.5], [0, 3],
];

function perimeter(scale: number) {
  let p = 0;
  for (let i = 0; i < SHAPE.length; i++) {
    const [x1, y1] = SHAPE[i];
    const [x2, y2] = SHAPE[(i + 1) % SHAPE.length];
    p += Math.hypot(x2 - x1, y2 - y1) * scale;
  }
  return p;
}
// shoelace area of base
function baseArea() {
  let s = 0;
  for (let i = 0; i < SHAPE.length; i++) {
    const [x1, y1] = SHAPE[i];
    const [x2, y2] = SHAPE[(i + 1) % SHAPE.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export default function ScaleFactorExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [k, setK] = useState(1.6);
  const sizeRef = useRef({ w: 480, h: 360 });
  const tf = useRef({ s: 30, ox: 30, oy: 320 });

  const M = (mx: number, my: number) => {
    const { s, ox, oy } = tf.current;
    return { x: ox + mx * s, y: oy - my * s };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const pad = 30;
    const maxK = 2.5;
    const extentX = 4 * maxK;
    const extentY = 4.5 * maxK;
    const s = Math.min((w - 2 * pad) / extentX, (h - 2 * pad) / extentY);
    tf.current = { s, ox: pad, oy: h - pad };

    // scaled copy (under) then base (over)
    polygon(ctx, SHAPE.map(([x, y]) => M(x * k, y * k)), COLORS.copy, true);
    polygon(ctx, SHAPE.map(([x, y]) => M(x, y)), COLORS.base, false);

    // label one corresponding side (the right edge: vertex1->vertex2)
    labelSide(ctx, M(SHAPE[1][0], SHAPE[1][1]), M(SHAPE[2][0], SHAPE[2][1]), `${3}`, COLORS.base);
    labelSide(ctx, M(SHAPE[1][0] * k, SHAPE[1][1] * k), M(SHAPE[2][0] * k, SHAPE[2][1] * k), `${(3 * k).toFixed(1)}`, COLORS.copy);

    // scaling-center dot
    const c = M(0, 0);
    ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#64748b'; ctx.fill();
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
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [k]);

  const baseP = perimeter(1);
  const copyP = perimeter(k);
  const baseA = baseArea();
  const copyA = baseA * k * k;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">scale factor k = {k.toFixed(2)}</span>
            <input type="range" min={0.5} max={2.5} step={0.05} value={k}
              onInput={(e) => setK(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="side (base)" value="3.00" color={COLORS.base} />
            <Readout label="side (copy)" value={(3 * k).toFixed(2)} color={COLORS.copy} />
            <Readout label="ratio" value={`${k.toFixed(2)}×`} />
            <Readout label="every side" value={`${k.toFixed(2)}×`} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-[0.8rem] leading-relaxed">
            <div class="flex justify-between"><span class="text-muted">perimeter</span><span class="font-mono">{baseP.toFixed(1)} → {copyP.toFixed(1)} ( ×{k.toFixed(2)} )</span></div>
            <div class="flex justify-between"><span class="text-muted">area</span><span class="font-mono">{baseA.toFixed(1)} → {copyA.toFixed(1)} ( ×{(k * k).toFixed(2)} )</span></div>
            <p class="mt-1 text-xs text-muted">Lengths scale by k, but area scales by k².</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

function polygon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string, fill: boolean) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = 'rgba(16,185,129,0.16)';
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = fill ? 2 : 2.5;
  ctx.stroke();
}
function labelSide(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, q: { x: number; y: number }, text: string, color: string) {
  ctx.fillStyle = color;
  ctx.font = '700 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, (p.x + q.x) / 2 + 12, (p.y + q.y) / 2);
}
