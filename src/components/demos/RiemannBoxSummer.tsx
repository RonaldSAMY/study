import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Multiple integrals — a 2-D Riemann sum.
   Top-down view of a watershed; height f(x,y) is rainfall intensity.
   We chop the region into an n×n grid and sum (height × cell area) to
   approximate the total volume of water. Raise the resolution and the
   blocky estimate converges to the true double integral.
   ------------------------------------------------------------------ */

const L = 3; // region is [0, L] × [0, L]

// rainfall intensity (mm/hr-ish), always ≥ 0
function rain(x: number, y: number): number {
  return (
    1.3 * Math.exp(-((x - 1) ** 2 + (y - 1.2) ** 2) / 0.8) +
    0.9 * Math.exp(-((x - 2.3) ** 2 + (y - 2.1) ** 2) / 0.6) +
    0.3
  );
}

const ZMAX = 1.7;

function blue(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  // pale → deep blue (more rain = deeper)
  return `rgb(${Math.round(235 - c * 200)},${Math.round(245 - c * 150)},${Math.round(255 - c * 40)})`;
}

// reference "true" integral via a fine grid
function trueVolume(): number {
  const M = 300; const d = L / M; let s = 0;
  for (let i = 0; i < M; i++)
    for (let j = 0; j < M; j++) s += rain((i + 0.5) * d, (j + 0.5) * d);
  return s * d * d;
}

export default function RiemannBoxSummer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 380, h: 380 });
  const [n, setN] = useState(5);
  const trueVolRef = useRef(0);

  if (trueVolRef.current === 0) trueVolRef.current = trueVolume();

  const approx = () => {
    const d = L / n; let s = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) s += rain((i + 0.5) * d, (j + 0.5) * d);
    return s * d * d;
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const d = L / n;
    const cw = w / n, ch = h / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = (i + 0.5) * d;
        const cy = (j + 0.5) * d;
        const z = rain(cx, cy);
        ctx.fillStyle = blue(z / ZMAX);
        // canvas y is flipped (row 0 at top = high y)
        const px = i * cw;
        const py = (n - 1 - j) * ch;
        ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
      }
    }
    // grid lines
    ctx.strokeStyle = 'rgba(40,60,90,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(w, i * ch); ctx.stroke();
    }
    // sample dots at cell centers
    ctx.fillStyle = 'rgba(79,70,229,0.8)';
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const px = (i + 0.5) * cw;
        const py = (n - 1 - j + 0.5) * ch;
        ctx.beginPath(); ctx.arc(px, py, Math.min(2.5, cw / 6), 0, Math.PI * 2); ctx.fill();
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 380);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = w * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: w };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [n]);

  const est = approx();
  const truth = trueVolRef.current;
  const errPct = (Math.abs(est - truth) / truth) * 100;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Each tile samples the rainfall at its center and assumes that height across the whole tile — a tiny rectangular box.</p>
          <label class="block">
            <span class="mb-1 block text-muted">resolution n = {n} × {n} = {n * n} tiles</span>
            <input type="range" min={1} max={30} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="Riemann sum" value={est.toFixed(3)} />
            <Readout label="true ∬ f dA" value={truth.toFixed(3)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">error</span><strong class="font-mono">{errPct.toFixed(1)}%</strong></div>
            <p class="mt-1 text-xs text-muted">
              {errPct < 1
                ? 'Almost exact — finer tiles make the staircase hug the true surface.'
                : 'Coarse tiles over/under-shoot the curved surface. Slide right to refine.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
