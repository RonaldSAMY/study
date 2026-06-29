import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Complex multiplication as rotate + scale.
   - Set z and w in polar form with sliders (modulus r, angle θ).
   - The product z·w has modulus r₁·r₂ and angle θ₁+θ₂.
   - Watch w get "carried" to the product: multiplying by z rotates
     w by arg(z) and scales it by |z|.
   ------------------------------------------------------------------ */

const COLORS = {
  z: '#4f46e5',
  w: '#0ea5e9',
  result: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};
const DEG = Math.PI / 180;

export default function ComplexRotationMultiplier() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [r1, setR1] = useState(1.4);
  const [t1, setT1] = useState(30);
  const [r2, setR2] = useState(1.2);
  const [t2, setT2] = useState(60);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const z = { re: r1 * Math.cos(t1 * DEG), im: r1 * Math.sin(t1 * DEG) };
  const w = { re: r2 * Math.cos(t2 * DEG), im: r2 * Math.sin(t2 * DEG) };
  const prod = { r: r1 * r2, t: t1 + t2 };
  const p = { re: prod.r * Math.cos(prod.t * DEG), im: prod.r * Math.sin(prod.t * DEG) };

  const toPx = (re: number, im: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + re * scale, y: oy - im * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: cw, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, cw, h);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < cw; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(cw, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.fillText('Re', cw - 24, oy - 8);
    ctx.fillText('Im', ox + 8, 14);

    // unit circle for reference
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(128,128,128,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ox, oy, scale, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    const origin = { x: ox, y: oy };
    // show the rotation: dashed arc from w to product
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(16,185,129,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, prod.r * scale, -t2 * DEG, -(t1 + t2) * DEG, true);
    ctx.stroke();
    ctx.setLineDash([]);

    arrow(ctx, origin, toPx(p.re, p.im), COLORS.result, 3);
    label(ctx, toPx(p.re, p.im), 'z·w', COLORS.result);
    arrow(ctx, origin, toPx(z.re, z.im), COLORS.z, 3.5);
    arrow(ctx, origin, toPx(w.re, w.im), COLORS.w, 3.5);
    label(ctx, toPx(z.re, z.im), 'z', COLORS.z);
    label(ctx, toPx(w.re, w.im), 'w', COLORS.w);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const wid = Math.min(parent.clientWidth, 560);
      const h = Math.round(wid * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wid * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${wid}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(26, Math.min(48, wid / 11));
      sizeRef.current = { w: wid, h, scale, ox: wid / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [r1, t1, r2, t2]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <Readout label="z" color={COLORS.z} value={`${r1.toFixed(1)} ∠ ${t1}°`} />
            <Readout label="w" color={COLORS.w} value={`${r2.toFixed(1)} ∠ ${t2}°`} />
          </div>

          <Slider label={`|z| = ${r1.toFixed(1)}`} value={r1} min={0.3} max={2} step={0.1} accent="#4f46e5" set={setR1} />
          <Slider label={`arg(z) = ${t1}°`} value={t1} min={0} max={180} step={5} accent="#4f46e5" set={setT1} />
          <Slider label={`|w| = ${r2.toFixed(1)}`} value={r2} min={0.3} max={2} step={0.1} accent="#0ea5e9" set={setR2} />
          <Slider label={`arg(w) = ${t2}°`} value={t2} min={0} max={180} step={5} accent="#0ea5e9" set={setT2} />

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">moduli multiply</span>
              <strong>{r1.toFixed(1)} × {r2.toFixed(1)} = {(r1 * r2).toFixed(2)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">angles add</span>
              <strong>{t1}° + {t2}° = {t1 + t2}°</strong>
            </div>
            <div class="mt-1 flex justify-between">
              <span class="text-muted">z · w</span>
              <strong style={`color:${COLORS.result}`}>{prod.r.toFixed(2)} ∠ {prod.t}°</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, accent, set,
}: { label: string; value: number; min: number; max: number; step: number; accent: string; set: (n: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style={`accent-color:${accent}`}
      />
    </label>
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

// ---- canvas primitives ----
function arrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
