import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Apply Translate / Rotate / Scale to a sprite with sliders and see
   the composed 3x3 homogeneous matrix (M = T · R · S) live.
   The sprite is a unit square with an "up" marker so rotation reads.
   Canvas conventions from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = { sprite: '#4f46e5', ghost: 'rgba(128,128,128,0.45)', accent: '#0ea5e9', grid: 'rgba(128,128,128,0.18)', axis: 'rgba(128,128,128,0.5)' };

type M3 = number[]; // row-major 3x3

function mul(a: M3, b: M3): M3 {
  const r: M3 = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
const T = (tx: number, ty: number): M3 => [1, 0, tx, 0, 1, ty, 0, 0, 1];
const R = (deg: number): M3 => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const S = (sx: number, sy: number): M3 => [sx, 0, 0, 0, sy, 0, 0, 0, 1];
function apply(m: M3, x: number, y: number) { return { x: m[0] * x + m[1] * y + m[2], y: m[3] * x + m[4] * y + m[5] }; }

export default function SpriteTransformMatrixLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tx, setTx] = useState(2);
  const [ty, setTy] = useState(1);
  const [rot, setRot] = useState(30);
  const [sx, setSx] = useState(1.5);
  const [sy, setSy] = useState(1);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const M = mul(mul(T(tx, ty), R(rot)), S(sx, sy));

  const toPx = (x: number, y: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + x * scale, y: oy - y * scale };
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

    // unit square corners (model space), with an up-triangle marker
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

    // ghost (original)
    polygon(ctx, corners.map(([x, y]) => toPx(x, y)), COLORS.ghost, 'rgba(128,128,128,0.08)', 1.5);

    // transformed sprite
    const tc = corners.map(([x, y]) => { const p = apply(M, x, y); return toPx(p.x, p.y); });
    polygon(ctx, tc, COLORS.sprite, 'rgba(79,70,229,0.18)', 2.5);

    // "up" marker: midpoint of top edge -> shows rotation
    const up = apply(M, 0, 1.4); const ctr = apply(M, 0, 0);
    const upPx = toPx(up.x, up.y), ctrPx = toPx(ctr.x, ctr.y);
    ctx.strokeStyle = COLORS.accent; ctx.fillStyle = COLORS.accent; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ctrPx.x, ctrPx.y); ctx.lineTo(upPx.x, upPx.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(upPx.x, upPx.y, 4, 0, Math.PI * 2); ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(22, Math.min(40, w / 14));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [tx, ty, rot, sx, sy]);

  const Slider = ({ label, value, min, max, step, set }: { label: string; value: number; min: number; max: number; step: number; set: (n: number) => void }) => (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted"><span>{label}</span><span class="font-mono text-text">{value.toFixed(step < 1 ? 1 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#4f46e5]" />
    </label>
  );

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-2 text-sm">
          <Slider label="translate x" value={tx} min={-4} max={4} step={0.5} set={setTx} />
          <Slider label="translate y" value={ty} min={-4} max={4} step={0.5} set={setTy} />
          <Slider label="rotate (deg)" value={rot} min={-180} max={180} step={5} set={setRot} />
          <Slider label="scale x" value={sx} min={0.25} max={3} step={0.25} set={setSx} />
          <Slider label="scale y" value={sy} min={0.25} max={3} step={0.25} set={setSy} />

          <div class="rounded-lg bg-surface-2 p-3">
            <span class="text-muted text-xs">M = T · R · S</span>
            <div class="mt-1 font-mono text-xs leading-relaxed">
              {[0, 1, 2].map((i) => (
                <div key={i}>[ {M.slice(i * 3, i * 3 + 3).map((v) => v.toFixed(2).padStart(6)).join('  ')} ]</div>
              ))}
            </div>
            <p class="mt-1 text-xs text-muted">Bottom row stays [0 0 1]; the top-right column is the translation, the top-left 2×2 block is rotation × scale.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function polygon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], stroke: string, fill: string, width: number) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
}
