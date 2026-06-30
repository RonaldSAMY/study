import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The reparameterization trick: z = mu + sigma * eps, eps ~ N(0,1).
   - "Reparameterized" mode keeps the SAME noise eps fixed, so dragging
     mu / sigma slides the whole sample cloud smoothly -> a path you can
     differentiate (dz/dmu = 1, dz/dsigma = eps).
   - "Direct sampling" mode redraws fresh noise on every change, so the
     cloud jitters and there is no stable path to backprop through.
   ------------------------------------------------------------------ */

const COLORS = {
  eps: '#0ea5e9',
  z: '#10b981',
  curve: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
};

const N = 160;

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default function ReparamTrickDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const epsRef = useRef<number[]>([]);
  const sizeRef = useRef({ w: 480, h: 300 });

  const [mu, setMu] = useState(0);
  const [sigma, setSigma] = useState(1);
  const [reparam, setReparam] = useState(true);
  const [tick, setTick] = useState(0); // forces redraw in direct mode

  // fixed bank of noise for reparam mode
  if (epsRef.current.length === 0) {
    epsRef.current = Array.from({ length: N }, () => randn());
  }

  const highlight = 0; // track the first sample to show the gradient path

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const pad = 30;
    const x0 = pad;
    const x1 = w - pad;
    const xRange = 8; // show z in [-4, 4]
    const toX = (val: number) => x0 + ((val + xRange / 2) / xRange) * (x1 - x0);

    const yEps = h * 0.78; // noise row (bottom)
    const yZ = h * 0.34; // transformed row (top)

    // axis lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, yEps); ctx.lineTo(x1, yEps); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, yZ); ctx.lineTo(x1, yZ); ctx.stroke();

    // target density curve N(mu, sigma) over the z row
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let pxv = x0; pxv <= x1; pxv += 2) {
      const val = (pxv - x0) / (x1 - x0) * xRange - xRange / 2;
      const d = Math.exp(-((val - mu) * (val - mu)) / (2 * sigma * sigma));
      const y = yZ - d * 60;
      if (pxv === x0) ctx.moveTo(pxv, y);
      else ctx.lineTo(pxv, y);
    }
    ctx.stroke();

    const eps = epsRef.current;
    for (let i = 0; i < N; i++) {
      const e = reparam ? eps[i] : randn();
      const z = mu + sigma * e;
      const ex = toX(e);
      const zx = toX(z);
      const isH = i === highlight && reparam;

      // eps tick
      ctx.fillStyle = isH ? '#f59e0b' : COLORS.eps;
      ctx.beginPath(); ctx.arc(ex, yEps, isH ? 4 : 2.4, 0, Math.PI * 2); ctx.fill();
      // z tick
      ctx.fillStyle = isH ? '#f59e0b' : COLORS.z;
      ctx.beginPath(); ctx.arc(zx, yZ, isH ? 4 : 2.4, 0, Math.PI * 2); ctx.fill();

      if (isH) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ex, yEps); ctx.lineTo(zx, yZ); ctx.stroke();
      }
    }

    // row labels
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.z;
    ctx.fillText('z = μ + σ·ε   (output)', x0, yZ - 70);
    ctx.fillStyle = COLORS.eps;
    ctx.fillText('ε ~ N(0,1)   (fixed noise)', x0, yEps + 24);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.max(280, Math.min(parent.clientWidth, 560));
      const h = Math.round(w * 0.6);
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

  useEffect(draw, [mu, sigma, reparam, tick]);

  const e0 = epsRef.current[highlight] ?? 0;
  const z0 = mu + sigma * e0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setReparam(true)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            reparam ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Reparameterized
        </button>
        <button
          onClick={() => setReparam(false)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            !reparam ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Direct sampling
        </button>
        {!reparam && (
          <button
            onClick={() => setTick((t) => t + 1)}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          >
            Re-sample noise
          </button>
        )}
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-muted">mean μ = {mu.toFixed(2)}</span>
          <input
            type="range" min={-3} max={3} step={0.05} value={mu}
            onInput={(e) => setMu(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-muted">std dev σ = {sigma.toFixed(2)}</span>
          <input
            type="range" min={0.2} max={2.5} step={0.05} value={sigma}
            onInput={(e) => setSigma(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]"
          />
        </label>
      </div>

      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        {reparam ? (
          <>
            The noise ε is held fixed, so the gold sample moves along a smooth path as you
            drag μ and σ. For it: <strong>ε = {e0.toFixed(2)}</strong>,{' '}
            <strong>z = {z0.toFixed(2)}</strong>, with <strong>∂z/∂μ = 1</strong> and{' '}
            <strong>∂z/∂σ = ε = {e0.toFixed(2)}</strong>. Gradients flow straight through.
          </>
        ) : (
          <>
            Fresh noise is drawn on every change, so the cloud jitters with no stable path —
            there is nothing for a gradient to follow back to μ and σ. Press{' '}
            <strong>Re-sample noise</strong> to see the randomness jump.
          </>
        )}
      </div>
    </div>
  );
}
