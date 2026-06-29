import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Change of Variables viewer.
   - Pick a scenario: a source density f_X and a monotonic transform y=g(x).
   - Top panel: source density + a sample histogram.
   - Bottom panel: the TRANSFORMED density. The smooth curve is the exact
     change-of-variables result f_Y(y) = f_X(g⁻¹(y)) / |g'(g⁻¹(y))|, and the
     histogram of g(samples) lands right on it — the Jacobian made visible.
   ------------------------------------------------------------------ */

const C = {
  src: '#0ea5e9',
  out: '#4f46e5',
  fill: 'rgba(79,70,229,0.18)',
  bar: 'rgba(14,165,233,0.30)',
  axis: 'rgba(128,128,128,0.5)',
  text: '#64748b',
};

const normPdf = (x: number, mu = 0, sig = 1) =>
  Math.exp(-0.5 * ((x - mu) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));

function gauss(): number {
  // Box–Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type Scenario = {
  key: string;
  label: string;
  blurb: string;
  sample: () => number;     // draw one source value x
  srcPdf: (x: number) => number;
  g: (x: number) => number; // forward transform
  outPdf: (y: number) => number; // exact transformed density
  xr: [number, number];
  yr: [number, number];
};

const SCENARIOS: Scenario[] = [
  {
    key: 'expo',
    label: 'Uniform RNG → Exponential',
    blurb: 'y = −ln(1−x). A flat Uniform(0,1) becomes a decaying Exponential — the trick every simulator uses to make random wait-times.',
    sample: () => Math.random(),
    srcPdf: (x) => (x >= 0 && x <= 1 ? 1 : 0),
    g: (x) => -Math.log(1 - x),
    outPdf: (y) => (y >= 0 ? Math.exp(-y) : 0),
    xr: [0, 1],
    yr: [0, 6],
  },
  {
    key: 'lognorm',
    label: 'Normal → Lognormal (log-returns)',
    blurb: 'y = eˣ. Symmetric Gaussian log-returns become a skewed, all-positive price multiplier — why asset prices are modelled as lognormal.',
    sample: () => 0.5 * gauss(),
    srcPdf: (x) => normPdf(x, 0, 0.5),
    g: (x) => Math.exp(x),
    outPdf: (y) => (y > 0 ? normPdf(Math.log(y), 0, 0.5) / y : 0),
    xr: [-2, 2],
    yr: [0, 4],
  },
  {
    key: 'square',
    label: 'Uniform → Square (y = x²)',
    blurb: 'Squaring a uniform sample piles probability up near 0: equal-width x-slices map to wider y-slices there, so the density spikes.',
    sample: () => Math.random(),
    srcPdf: (x) => (x >= 0 && x <= 1 ? 1 : 0),
    g: (x) => x * x,
    outPdf: (y) => (y > 0 && y < 1 ? 1 / (2 * Math.sqrt(y)) : 0),
    xr: [0, 1],
    yr: [0, 1],
  },
  {
    key: 'affine',
    label: 'Normal → Affine (y = 2x + 3)',
    blurb: 'A linear rescale (like converting units, or a decibel-style shift) just stretches and slides the bell — the Jacobian is the constant 1/2.',
    sample: () => gauss(),
    srcPdf: (x) => normPdf(x, 0, 1),
    g: (x) => 2 * x + 3,
    outPdf: (y) => normPdf((y - 3) / 2, 0, 1) / 2,
    xr: [-3, 3],
    yr: [-3, 9],
  },
];

const NBINS = 36;
const NSAMP = 6000;

export default function DensityTransformViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 420 });
  const [idx, setIdx] = useState(0);
  const [seed, setSeed] = useState(0); // bump to resample
  const samplesRef = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const sc = SCENARIOS[idx];

  // (re)generate samples when scenario or seed changes
  useEffect(() => {
    const x: number[] = [], y: number[] = [];
    for (let i = 0; i < NSAMP; i++) {
      const xi = sc.sample();
      x.push(xi); y.push(sc.g(xi));
    }
    samplesRef.current = { x, y };
    draw();
  }, [idx, seed]);

  const histogram = (vals: number[], lo: number, hi: number) => {
    const bins = new Array(NBINS).fill(0);
    const wbin = (hi - lo) / NBINS;
    for (const v of vals) {
      if (v < lo || v >= hi) continue;
      bins[Math.min(NBINS - 1, Math.floor((v - lo) / wbin))]++;
    }
    // normalize to a density (area = 1 over [lo,hi] portion)
    return bins.map((c) => c / (vals.length * wbin));
  };

  const drawPanel = (
    ctx: CanvasRenderingContext2D,
    top: number, panelH: number,
    range: [number, number],
    pdf: (v: number) => number,
    hist: number[],
    curveColor: string, fillColor: string,
    title: string,
  ) => {
    const { w } = sizeRef.current;
    const padL = 14, padR = 14, padB = 24, padT = 22;
    const baseY = top + panelH - padB;
    const plotH = panelH - padB - padT;
    const [lo, hi] = range;
    const vToPx = (v: number) => padL + ((v - lo) / (hi - lo)) * (w - padL - padR);

    let maxY = 0.001;
    for (let i = 0; i <= 200; i++) maxY = Math.max(maxY, pdf(lo + (i / 200) * (hi - lo)));
    for (const c of hist) maxY = Math.max(maxY, c);
    const yToPx = (y: number) => baseY - (y / maxY) * plotH;

    // title
    ctx.fillStyle = C.text; ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(title, padL, top + 2);

    // histogram bars
    const wbin = (hi - lo) / NBINS;
    ctx.fillStyle = C.bar;
    for (let i = 0; i < NBINS; i++) {
      const x0 = vToPx(lo + i * wbin), x1 = vToPx(lo + (i + 1) * wbin);
      const y = yToPx(hist[i]);
      ctx.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), baseY - y);
    }

    // x axis
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(vToPx(lo), baseY); ctx.lineTo(vToPx(hi), baseY); ctx.stroke();
    ctx.fillStyle = C.text; ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const step = (hi - lo) / 4;
    for (let k = 0; k <= 4; k++) {
      const v = lo + k * step;
      ctx.fillText(v.toFixed(v % 1 === 0 ? 0 : 1), vToPx(v), baseY + 5);
    }

    // exact density curve + fill
    ctx.fillStyle = fillColor;
    ctx.beginPath(); ctx.moveTo(vToPx(lo), baseY);
    for (let i = 0; i <= 240; i++) {
      const v = lo + (i / 240) * (hi - lo);
      ctx.lineTo(vToPx(v), yToPx(pdf(v)));
    }
    ctx.lineTo(vToPx(hi), baseY); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = curveColor; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 240; i++) {
      const v = lo + (i / 240) * (hi - lo);
      const y = yToPx(pdf(v));
      if (!started) { ctx.moveTo(vToPx(v), y); started = true; } else ctx.lineTo(vToPx(v), y);
    }
    ctx.stroke();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const half = h / 2;
    const { x, y } = samplesRef.current;
    drawPanel(ctx, 0, half, sc.xr, sc.srcPdf, histogram(x, sc.xr[0], sc.xr[1]),
      C.src, 'rgba(14,165,233,0.16)', 'Source  fₓ(x)');
    drawPanel(ctx, half, half, sc.yr, sc.outPdf, histogram(y, sc.yr[0], sc.yr[1]),
      C.out, C.fill, 'Transformed  f_Y(y) = fₓ(g⁻¹(y)) / |g′|');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.95, 460));
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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setIdx(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              idx === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="w-full rounded-xl bg-surface-2" />

      <div class="mt-3 flex items-start justify-between gap-3">
        <p class="text-xs text-muted">{sc.blurb}</p>
        <button
          onClick={() => setSeed((v) => v + 1)}
          class="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        >
          Resample
        </button>
      </div>
    </div>
  );
}
