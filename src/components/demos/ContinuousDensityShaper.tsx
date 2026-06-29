import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Continuous Distributions — Uniform / Exponential / Gaussian.
   - Pick a family and slide its parameters to reshape the density curve.
   - Drag the two handles (a, b) along the x-axis to shade an interval;
     the shaded AREA is P(a < X < b), reported live.
   ------------------------------------------------------------------ */

type Family = 'uniform' | 'exponential' | 'gaussian';

const C = {
  curve: '#4f46e5',
  fill: 'rgba(79,70,229,0.22)',
  handle: '#10b981',
  axis: 'rgba(128,128,128,0.5)',
  text: '#64748b',
};

// Abramowitz–Stegun erf approximation.
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normCdf = (x: number, mu: number, sig: number) => 0.5 * (1 + erf((x - mu) / (sig * Math.SQRT2)));
const normPdf = (x: number, mu: number, sig: number) =>
  Math.exp(-0.5 * ((x - mu) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));

export default function ContinuousDensityShaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320, padL: 14, padR: 14, padB: 28, padT: 14 });
  const dragRef = useRef<null | 'a' | 'b'>(null);

  const [family, setFamily] = useState<Family>('gaussian');
  const [mu, setMu] = useState(5);
  const [sig, setSig] = useState(1.5);
  const [rate, setRate] = useState(0.5); // exponential λ
  const [u0, setU0] = useState(2);       // uniform lower
  const [u1, setU1] = useState(8);       // uniform upper
  const [a, setA] = useState(3.5);
  const [b, setB] = useState(6.5);

  const XMIN = 0, XMAX = 12;

  const pdf = (x: number): number => {
    if (family === 'gaussian') return normPdf(x, mu, sig);
    if (family === 'exponential') return x >= 0 ? rate * Math.exp(-rate * x) : 0;
    return x >= u0 && x <= u1 ? 1 / (u1 - u0) : 0; // uniform
  };
  const cdf = (x: number): number => {
    if (family === 'gaussian') return normCdf(x, mu, sig);
    if (family === 'exponential') return x <= 0 ? 0 : 1 - Math.exp(-rate * x);
    if (x <= u0) return 0;
    if (x >= u1) return 1;
    return (x - u0) / (u1 - u0);
  };

  const prob = Math.max(0, cdf(Math.max(a, b)) - cdf(Math.min(a, b)));

  const xToPx = (x: number) => {
    const { w, padL, padR } = sizeRef.current;
    return padL + ((x - XMIN) / (XMAX - XMIN)) * (w - padL - padR);
  };
  const pxToX = (px: number) => {
    const { w, padL, padR } = sizeRef.current;
    return XMIN + ((px - padL) / (w - padL - padR)) * (XMAX - XMIN);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padB, padT } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const baseY = h - padB;
    const plotH = baseY - padT;

    // peak for scaling y
    let maxY = 0.001;
    for (let i = 0; i <= 240; i++) maxY = Math.max(maxY, pdf(XMIN + (i / 240) * (XMAX - XMIN)));
    const yToPx = (y: number) => baseY - (y / maxY) * plotH * 0.92;

    // x axis
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xToPx(XMIN), baseY); ctx.lineTo(xToPx(XMAX), baseY); ctx.stroke();
    ctx.fillStyle = C.text; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let x = XMIN; x <= XMAX; x += 2) ctx.fillText(String(x), xToPx(x), baseY + 6);

    // shaded interval a..b
    const lo = Math.min(a, b), hi = Math.max(a, b);
    ctx.fillStyle = C.fill;
    ctx.beginPath();
    ctx.moveTo(xToPx(lo), baseY);
    for (let px = xToPx(lo); px <= xToPx(hi); px += 2) {
      ctx.lineTo(px, yToPx(pdf(pxToX(px))));
    }
    ctx.lineTo(xToPx(hi), baseY);
    ctx.closePath();
    ctx.fill();

    // density curve
    ctx.strokeStyle = C.curve; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = xToPx(XMIN); px <= xToPx(XMAX); px += 1.5) {
      const y = yToPx(pdf(pxToX(px)));
      if (!started) { ctx.moveTo(px, y); started = true; } else ctx.lineTo(px, y);
    }
    ctx.stroke();

    // handles a, b
    ([['a', a], ['b', b]] as const).forEach(([name, xVal]) => {
      const px = xToPx(xVal);
      ctx.strokeStyle = C.handle; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, baseY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(px, baseY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.handle; ctx.stroke();
      ctx.fillStyle = C.handle; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(name, px, padT + 12);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.58, 320));
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

  useEffect(draw, [family, mu, sig, rate, u0, u1, a, b]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onDown = (e: PointerEvent) => {
    const px = pointer(e);
    dragRef.current = Math.abs(px - xToPx(a)) <= Math.abs(px - xToPx(b)) ? 'a' : 'b';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    const x = clamp(pxToX(px), XMIN, XMAX);
    dragRef.current === 'a' ? setA(round1(x)) : setB(round1(x));
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const x = clamp(pxToX(pointer(e)), XMIN, XMAX);
    dragRef.current === 'a' ? setA(round1(x)) : setB(round1(x));
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['uniform', 'exponential', 'gaussian'] as Family[]).map((f) => (
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

      <canvas
        ref={canvasRef}
        class="w-full touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div class="mt-3 grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end">
        <div class="space-y-2 text-sm">
          {family === 'gaussian' && (
            <>
              <Slider label="mean μ" value={mu} min={1} max={11} step={0.1} onChange={setMu} />
              <Slider label="std dev σ" value={sig} min={0.4} max={3} step={0.1} onChange={setSig} />
            </>
          )}
          {family === 'exponential' && (
            <Slider label="rate λ" value={rate} min={0.1} max={2} step={0.05} onChange={setRate} />
          )}
          {family === 'uniform' && (
            <>
              <Slider label="lower" value={u0} min={0} max={6} step={0.5} onChange={(v) => setU0(Math.min(v, u1 - 0.5))} />
              <Slider label="upper" value={u1} min={2} max={12} step={0.5} onChange={(v) => setU1(Math.max(v, u0 + 0.5))} />
            </>
          )}
        </div>
        <div class="rounded-lg bg-surface-2 p-3 text-sm sm:w-44">
          <div class="flex justify-between"><span class="text-muted">interval</span><strong class="font-mono">[{Math.min(a, b).toFixed(1)}, {Math.max(a, b).toFixed(1)}]</strong></div>
          <div class="mt-1 flex items-baseline justify-between">
            <span class="text-muted">P(a&lt;X&lt;b)</span>
            <strong class="font-mono text-lg" style={`color:${C.curve}`}>{prob.toFixed(3)}</strong>
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-muted">Drag the green <strong>a</strong> / <strong>b</strong> handles — the shaded area is the probability.</p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted"><span>{label}</span><span class="font-mono text-text">{value.toFixed(2)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]" />
    </label>
  );
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
