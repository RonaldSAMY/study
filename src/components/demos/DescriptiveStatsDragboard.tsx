import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Descriptive-statistics dragboard.
   - Drag the dots along the number line (annual salaries, $k).
   - Watch the MEAN (indigo) and MEDIAN (emerald) markers react.
   - Drag one point far to the right to feel the mean's outlier sensitivity.
   ------------------------------------------------------------------ */

const COLORS = {
  point: '#0ea5e9',
  mean: '#4f46e5',
  median: '#10b981',
  axis: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.18)',
};

const MIN = 0;
const MAX = 200; // $k

export default function DescriptiveStatsDragboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vals, setVals] = useState<number[]>([38, 44, 49, 53, 61]);
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 220, pad: 36, axisY: 150 });

  const toPx = (v: number) => {
    const { w, pad } = sizeRef.current;
    return pad + ((v - MIN) / (MAX - MIN)) * (w - 2 * pad);
  };
  const toVal = (px: number) => {
    const { w, pad } = sizeRef.current;
    const v = MIN + ((px - pad) / (w - 2 * pad)) * (MAX - MIN);
    return Math.round(Math.min(MAX, Math.max(MIN, v)));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, axisY } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // axis
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toPx(MIN), axisY); ctx.lineTo(toPx(MAX), axisY); ctx.stroke();

    // ticks + labels
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let t = MIN; t <= MAX; t += 50) {
      const x = toPx(t);
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(x, axisY - 5); ctx.lineTo(x, axisY + 5); ctx.stroke();
      ctx.fillText(`$${t}k`, x, axisY + 20);
    }

    const sorted = [...vals].sort((p, q) => p - q);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const n = sorted.length;
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

    // mean marker (above axis)
    drawMarker(ctx, toPx(mean), axisY, COLORS.mean, 'mean', -1);
    // median marker (below axis)
    drawMarker(ctx, toPx(median), axisY, COLORS.median, 'median', 1);

    // data points (stack vertically when close to avoid overlap)
    const order = vals.map((_, i) => i).sort((i, j) => vals[i] - vals[j]);
    const placed: { x: number; row: number }[] = [];
    const rows: number[] = new Array(vals.length).fill(0);
    order.forEach((i) => {
      const x = toPx(vals[i]);
      let row = 0;
      while (placed.some((p) => p.row === row && Math.abs(p.x - x) < 18)) row++;
      placed.push({ x, row });
      rows[i] = row;
    });
    vals.forEach((v, i) => {
      const x = toPx(v);
      const y = axisY - 26 - rows[i] * 20;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.point; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      // stem to axis
      ctx.strokeStyle = 'rgba(14,165,233,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x, axisY); ctx.stroke();
    });
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = 220;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 40, axisY: 150 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [vals]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px } = pointer(e);
    // pick the nearest point by x
    let best = -1, bestD = 24;
    vals.forEach((v, i) => {
      const d = Math.abs(toPx(v) - px);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    const { px } = pointer(e);
    const v = toVal(px);
    setVals((arr) => arr.map((x, i) => (i === dragRef.current ? v : x)));
  };
  const onUp = () => { dragRef.current = null; };

  // ---- numeric readout ----
  const sorted = [...vals].sort((p, q) => p - q);
  const n = sorted.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const range = sorted[n - 1] - sorted[0];
  const q = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const iqr = q(0.75) - q(0.25);

  const addPoint = () => setVals((a) => (a.length >= 9 ? a : [...a, Math.round(mean)]));
  const removePoint = () => setVals((a) => (a.length <= 2 ? a : a.slice(0, -1)));
  const reset = () => setVals([38, 44, 49, 53, 61]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button onClick={addPoint} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">+ point</button>
        <button onClick={removePoint} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">− point</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">reset</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div class="space-y-2 text-sm">
          <p class="text-muted">Drag the blue salaries. Push one far right to see the mean chase it while the median holds.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="mean" color={COLORS.mean} value={`$${mean.toFixed(1)}k`} />
            <Readout label="median" color={COLORS.median} value={`$${median.toFixed(1)}k`} />
            <Readout label="std dev" value={`${std.toFixed(1)}`} />
            <Readout label="range" value={`${range}`} />
            <Readout label="IQR" value={`${iqr.toFixed(1)}`} />
            <Readout label="n" value={`${n}`} />
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

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  axisY: number,
  color: string,
  text: string,
  dir: 1 | -1,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  const top = dir === -1 ? 24 : axisY + 30;
  const bot = dir === -1 ? axisY : axisY + 52;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, dir === -1 ? 16 : axisY + 66);
}
