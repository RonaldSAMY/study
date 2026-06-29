import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Beta–Binomial conjugacy updater.
   - Set a Beta(α₀, β₀) PRIOR with two sliders.
   - Add observed successes / failures; the POSTERIOR is Beta(α₀+s, β₀+f).
   - Prior (dashed, muted) and posterior (solid indigo, filled) share a
     y-scale so you can watch belief concentrate as data arrives.
   ------------------------------------------------------------------ */

const C = {
  prior: 'rgba(100,116,139,0.9)',
  post: '#4f46e5',
  fill: 'rgba(79,70,229,0.20)',
  axis: 'rgba(128,128,128,0.5)',
  text: '#64748b',
  ok: '#10b981',
};

// Lanczos log-gamma → lets us normalize the Beta density so prior and
// posterior areas are directly comparable on a shared axis.
function lgamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
const logBeta = (a: number, b: number) => lgamma(a) + lgamma(b) - lgamma(a + b);
function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return a < 1 || b < 1 ? 0 : 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b));
}

export default function BetaPosteriorUpdater() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 300, padL: 14, padR: 14, padB: 28, padT: 14 });

  const [a0, setA0] = useState(2);
  const [b0, setB0] = useState(2);
  const [s, setS] = useState(8);
  const [f, setF] = useState(4);

  const aPost = a0 + s;
  const bPost = b0 + f;
  const priorMean = a0 / (a0 + b0);
  const postMean = aPost / (aPost + bPost);
  const postMode = aPost > 1 && bPost > 1 ? (aPost - 1) / (aPost + bPost - 2) : NaN;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padL, padR, padB, padT } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const baseY = h - padB;
    const plotH = baseY - padT;
    const xToPx = (x: number) => padL + x * (w - padL - padR);

    // shared y-scale = max of both densities (sampled)
    let maxY = 0.001;
    for (let i = 1; i < 200; i++) {
      const x = i / 200;
      maxY = Math.max(maxY, betaPdf(x, a0, b0), betaPdf(x, aPost, bPost));
    }
    const yToPx = (y: number) => baseY - (y / maxY) * plotH * 0.92;

    // x-axis
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xToPx(0), baseY); ctx.lineTo(xToPx(1), baseY); ctx.stroke();
    ctx.fillStyle = C.text; ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let t = 0; t <= 1.0001; t += 0.25) ctx.fillText(t.toFixed(2), xToPx(t), baseY + 6);

    // posterior fill + curve
    ctx.fillStyle = C.fill;
    ctx.beginPath(); ctx.moveTo(xToPx(0), baseY);
    for (let i = 0; i <= 300; i++) {
      const x = i / 300;
      ctx.lineTo(xToPx(x), yToPx(betaPdf(x, aPost, bPost)));
    }
    ctx.lineTo(xToPx(1), baseY); ctx.closePath(); ctx.fill();

    // prior curve (dashed)
    ctx.strokeStyle = C.prior; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = i / 300; const y = yToPx(betaPdf(x, a0, b0));
      i === 0 ? ctx.moveTo(xToPx(x), y) : ctx.lineTo(xToPx(x), y);
    }
    ctx.stroke(); ctx.setLineDash([]);

    // posterior curve (solid)
    ctx.strokeStyle = C.post; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = i / 300; const y = yToPx(betaPdf(x, aPost, bPost));
      i === 0 ? ctx.moveTo(xToPx(x), y) : ctx.lineTo(xToPx(x), y);
    }
    ctx.stroke();

    // posterior mean marker
    if (!Number.isNaN(postMean)) {
      const px = xToPx(postMean);
      ctx.strokeStyle = C.ok; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(px, baseY); ctx.lineTo(px, padT); ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.55, 300));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { ...sizeRef.current, w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [a0, b0, s, f]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="w-full touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <div class="space-y-2 text-sm">
          <p class="font-semibold text-muted">Prior — Beta(α₀, β₀)</p>
          <Slider label="α₀ (prior successes+1)" value={a0} min={0.5} max={12} step={0.5} onChange={setA0} />
          <Slider label="β₀ (prior failures+1)" value={b0} min={0.5} max={12} step={0.5} onChange={setB0} />
        </div>

        <div class="space-y-2 text-sm">
          <p class="font-semibold text-muted">Observed data</p>
          <div class="flex items-center gap-2">
            <Stepper label="successes s" value={s} color={C.post} onAdd={() => setS((v) => v + 1)} onSub={() => setS((v) => Math.max(0, v - 1))} />
          </div>
          <div class="flex items-center gap-2">
            <Stepper label="failures f" value={f} color={C.prior} onAdd={() => setF((v) => v + 1)} onSub={() => setF((v) => Math.max(0, v - 1))} />
          </div>
          <button
            onClick={() => { setS(0); setF(0); }}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text"
          >
            Reset data
          </button>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="prior mean" value={priorMean.toFixed(3)} />
        <Readout label="posterior" value={`Beta(${aPost}, ${bPost})`} />
        <Readout label="post. mean" value={postMean.toFixed(3)} color={C.ok} />
      </div>
      <p class="mt-2 text-xs text-muted">
        Each success adds 1 to α, each failure adds 1 to β — the posterior is just
        <strong> Beta(α₀+s, β₀+f)</strong>. That clean rule is conjugacy at work.
      </p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted"><span>{label}</span><span class="font-mono text-text">{value.toFixed(1)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]" />
    </label>
  );
}

function Stepper({ label, value, color, onAdd, onSub }: {
  label: string; value: number; color: string; onAdd: () => void; onSub: () => void;
}) {
  return (
    <div class="flex w-full items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={`color:${color}`}>{label}</span>
      <span class="flex items-center gap-2">
        <button onClick={onSub} class="grid h-6 w-6 place-items-center rounded-md bg-surface font-bold text-muted hover:text-text">−</button>
        <strong class="w-6 text-center font-mono">{value}</strong>
        <button onClick={onAdd} class="grid h-6 w-6 place-items-center rounded-md bg-surface font-bold text-muted hover:text-text">+</button>
      </span>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
