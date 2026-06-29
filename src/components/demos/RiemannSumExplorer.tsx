import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Riemann-sum explorer for Integrals & the FTC.
   - A rate curve (water flowing into a tank) sits over an interval.
   - Slide the number of rectangles n upward and watch the staircase
     estimate close in on the true area (the integral).
   - Toggle left / right / midpoint sampling. The readout shows the
     estimate, the exact area, and the shrinking error.
   ------------------------------------------------------------------ */

type Sample = 'left' | 'right' | 'mid';

const COLORS = {
  curve: '#4f46e5',
  rect: 'rgba(14,165,233,0.28)',
  rectEdge: '#0ea5e9',
  exact: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// Water inflow rate r(t) = 2 + sin(t) (litres/min) over [0, 8].
// Exact volume = ∫ (2 + sin t) dt = 2t - cos t  ->  [16 - cos8] - [0 - 1]
const A = 0, B = 8;
const f = (t: number) => 2 + Math.sin(t);
const exact = (2 * B - Math.cos(B)) - (2 * A - Math.cos(A));

export default function RiemannSumExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [n, setN] = useState(4);
  const [sample, setSample] = useState<Sample>('left');
  const sizeRef = useRef({ w: 480, h: 360 });

  const dx = (B - A) / n;
  const sampleX = (i: number) =>
    sample === 'left' ? A + i * dx : sample === 'right' ? A + (i + 1) * dx : A + (i + 0.5) * dx;
  let est = 0;
  for (let i = 0; i < n; i++) est += f(sampleX(i)) * dx;
  const err = Math.abs(est - exact);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 30;
    const ymax = 3.4, ymin = 0;

    const toPx = (t: number, y: number) => ({
      x: pad + ((t - A) / (B - A)) * (w - 2 * pad),
      y: h - pad - ((y - ymin) / (ymax - ymin)) * (h - 2 * pad),
    });

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const gx = pad + (i / 8) * (w - 2 * pad);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, h - pad); ctx.stroke();
      const gy = pad + (i / 8) * (h - 2 * pad);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
    }

    // rectangles
    for (let i = 0; i < n; i++) {
      const xL = A + i * dx;
      const height = f(sampleX(i));
      const p0 = toPx(xL, 0);
      const p1 = toPx(xL + dx, height);
      ctx.fillStyle = COLORS.rect;
      ctx.fillRect(p0.x, p1.y, p1.x - p0.x, p0.y - p1.y);
      ctx.strokeStyle = COLORS.rectEdge; ctx.lineWidth = 1;
      ctx.strokeRect(p0.x, p1.y, p1.x - p0.x, p0.y - p1.y);
    }

    // x-axis
    const z = toPx(A, 0).y;
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad, z); ctx.lineTo(w - pad, z); ctx.stroke();

    // curve
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const t = A + (i / 240) * (B - A);
      const p = toPx(t, f(t));
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const ww = Math.min(parent.clientWidth, 560);
      const hh = Math.round(ww * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = ww * dpr;
      canvas.height = hh * dpr;
      canvas.style.width = `${ww}px`;
      canvas.style.height = `${hh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: ww, h: hh };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [n, sample]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['left', 'mid', 'right'] as Sample[]).map((sm) => (
          <button
            key={sm}
            onClick={() => setSample(sm)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              sample === sm ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {sm === 'mid' ? 'midpoint' : sm} sum
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Water flows in at r(t) = 2 + sin t litres/min over 0–8 min.</p>
          <label class="block">
            <span class="mb-1 block text-muted">rectangles n = {n}</span>
            <input
              type="range" min={1} max={80} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span style={`color:${COLORS.rectEdge}`}>estimate</span>
              <div class="font-mono font-semibold">{est.toFixed(3)} L</div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span style={`color:${COLORS.exact}`}>true area</span>
              <div class="font-mono font-semibold">{exact.toFixed(3)} L</div>
            </div>
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">error</span>
              <strong class="font-mono">{err.toFixed(4)} L</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              Push n higher and the staircase melts into the curve — the sum converges to the
              exact integral, the total litres delivered.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
