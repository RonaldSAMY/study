import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Discrete Distributions — Bernoulli / Binomial / Poisson.
   - Pick a family, then slide its parameters (n, p, or λ).
   - The bar chart of the pmf P(X = k) redraws live on a crisp canvas.
   - Mean and variance are reported so the shape and the numbers agree.
   ------------------------------------------------------------------ */

type Family = 'bernoulli' | 'binomial' | 'poisson';

const C = {
  bar: '#4f46e5',
  barTop: '#6366f1',
  axis: 'rgba(128,128,128,0.5)',
  text: '#64748b',
};

function logFact(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}
function binomPmf(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  const logC = logFact(n) - logFact(k) - logFact(n - k);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
function poissonPmf(k: number, lam: number): number {
  return Math.exp(-lam + k * Math.log(lam) - logFact(k));
}

export default function DiscreteDistributionShaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 300 });
  const [family, setFamily] = useState<Family>('binomial');
  const [n, setN] = useState(12);
  const [p, setP] = useState(0.4);
  const [lam, setLam] = useState(3);

  const build = (): { ks: number[]; ps: number[]; mean: number; varr: number } => {
    if (family === 'bernoulli') {
      return { ks: [0, 1], ps: [1 - p, p], mean: p, varr: p * (1 - p) };
    }
    if (family === 'binomial') {
      const ks = Array.from({ length: n + 1 }, (_, k) => k);
      const ps = ks.map((k) => binomPmf(k, n, p));
      return { ks, ps, mean: n * p, varr: n * p * (1 - p) };
    }
    const kmax = Math.max(10, Math.ceil(lam + 4 * Math.sqrt(lam)));
    const ks = Array.from({ length: kmax + 1 }, (_, k) => k);
    const ps = ks.map((k) => poissonPmf(k, lam));
    return { ks, ps, mean: lam, varr: lam };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const { ks, ps } = build();
    const padL = 38, padB = 26, padT = 14, padR = 10;
    const plotW = w - padL - padR;
    const plotH = h - padB - padT;
    const maxP = Math.max(...ps, 0.001);
    const slot = plotW / ks.length;
    const barW = Math.max(2, Math.min(slot * 0.8, 46));

    // y axis
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

    ctx.fillStyle = C.text; ctx.font = '11px Inter, sans-serif';
    // y gridlines
    for (let g = 0; g <= 4; g++) {
      const val = (maxP * g) / 4;
      const y = padT + plotH - (val / maxP) * plotH;
      ctx.strokeStyle = 'rgba(128,128,128,0.15)';
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.text; ctx.fillText(val.toFixed(2), padL - 5, y);
    }

    // bars
    const labelEvery = ks.length > 22 ? Math.ceil(ks.length / 16) : 1;
    ks.forEach((k, i) => {
      const x = padL + i * slot + (slot - barW) / 2;
      const bh = (ps[i] / maxP) * plotH;
      const y = padT + plotH - bh;
      const grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
      grad.addColorStop(0, C.barTop); grad.addColorStop(1, C.bar);
      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(4, barW / 2);
      roundRectTop(ctx, x, y, barW, bh, r);
      ctx.fill();
      if (i % labelEvery === 0) {
        ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(k), x + barW / 2, padT + plotH + 6);
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.6, 320));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [family, n, p, lam]);

  const { mean, varr } = build();

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['bernoulli', 'binomial', 'poisson'] as Family[]).map((f) => (
          <button
            key={f}
            onClick={() => setFamily(f)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              family === f ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="w-full rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end">
        <div class="space-y-2 text-sm">
          {family === 'binomial' && (
            <label class="block">
              <span class="mb-1 flex justify-between text-muted"><span>trials n</span><span class="font-mono text-text">{n}</span></span>
              <input type="range" min={1} max={40} step={1} value={n} onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))} class="w-full accent-[#4f46e5]" />
            </label>
          )}
          {(family === 'binomial' || family === 'bernoulli') && (
            <label class="block">
              <span class="mb-1 flex justify-between text-muted"><span>success prob p</span><span class="font-mono text-text">{p.toFixed(2)}</span></span>
              <input type="range" min={0} max={1} step={0.01} value={p} onInput={(e) => setP(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#4f46e5]" />
            </label>
          )}
          {family === 'poisson' && (
            <label class="block">
              <span class="mb-1 flex justify-between text-muted"><span>rate λ</span><span class="font-mono text-text">{lam.toFixed(1)}</span></span>
              <input type="range" min={0.2} max={20} step={0.2} value={lam} onInput={(e) => setLam(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#4f46e5]" />
            </label>
          )}
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <Readout label="E[X]" value={mean.toFixed(2)} />
          <Readout label="Var(X)" value={varr.toFixed(2)} />
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <div class="text-muted text-xs">{label}</div>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
