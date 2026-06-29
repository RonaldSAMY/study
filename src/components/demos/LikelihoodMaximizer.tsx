import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Likelihood maximizer for a conversion-rate parameter.
   - Observed A/B-test data: k conversions out of n visitors.
   - Slide the parameter p and watch the likelihood of the data.
   - The curve peaks at the MLE (k/n). Toggle a prior to see the MAP.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#4f46e5',
  map: '#0ea5e9',
  marker: '#10b981',
  axis: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.18)',
};

const K = 7;   // conversions
const N = 20;  // visitors
// Beta(a,b) prior used for the MAP curve (a "skeptical" prior centred near 0.2)
const PRIOR_A = 3;
const PRIOR_B = 9;

// log-likelihood (up to a constant) of Binomial data at p
const logLik = (p: number) => (p <= 0 || p >= 1 ? -Infinity : K * Math.log(p) + (N - K) * Math.log(1 - p));
// log-prior (up to a constant) of Beta(a,b) at p
const logPrior = (p: number) =>
  p <= 0 || p >= 1 ? -Infinity : (PRIOR_A - 1) * Math.log(p) + (PRIOR_B - 1) * Math.log(1 - p);

const MLE = K / N;                                   // 0.35
const MAP = (K + PRIOR_A - 1) / (N + PRIOR_A + PRIOR_B - 2); // posterior mode

export default function LikelihoodMaximizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState(0.5);
  const [showPrior, setShowPrior] = useState(false);
  const sizeRef = useRef({ w: 480, h: 300, pad: 40 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const plotW = w - 2 * pad;
    const plotH = h - 2 * pad;

    const xToPx = (x: number) => pad + x * plotW;
    const yToPx = (y: number) => pad + (1 - y) * plotH; // y in [0,1] normalised

    // sample a curve and normalise to its own peak so it fills the plot
    const sample = (f: (p: number) => number) => {
      const pts: { x: number; v: number }[] = [];
      let max = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const x = i / 200;
        const v = Math.exp(f(x));
        pts.push({ x, v });
        if (v > max) max = v;
      }
      return pts.map((pt) => ({ x: pt.x, y: max > 0 ? pt.v / max : 0 }));
    };

    // grid + axes
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = xToPx(i / 10);
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + plotH); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad, pad + plotH); ctx.lineTo(pad + plotW, pad + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, pad + plotH); ctx.stroke();

    // x labels
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i += 2) {
      ctx.fillText((i / 10).toFixed(1), xToPx(i / 10), pad + plotH + 18);
    }
    ctx.fillText('parameter p  (true conversion rate)', xToPx(0.5), pad + plotH + 34);

    // likelihood curve
    const likePts = sample(logLik);
    drawCurve(ctx, likePts, xToPx, yToPx, COLORS.curve, 3);

    // posterior (likelihood × prior) curve
    if (showPrior) {
      const postPts = sample((pp) => logLik(pp) + logPrior(pp));
      drawCurve(ctx, postPts, xToPx, yToPx, COLORS.map, 2.5);
      // MAP marker
      vline(ctx, xToPx(MAP), pad, pad + plotH, COLORS.map, 'MAP');
    }

    // MLE marker
    vline(ctx, xToPx(MLE), pad, pad + plotH, 'rgba(79,70,229,0.55)', 'MLE');

    // current p marker + dot on the likelihood curve
    const yhere = likePts[Math.round(p * 200)].y;
    vline(ctx, xToPx(p), pad, pad + plotH, COLORS.marker, '');
    ctx.beginPath(); ctx.arc(xToPx(p), yToPx(yhere), 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.marker; ctx.stroke();
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.round(Math.min(w * 0.62, 320));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 46 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [p, showPrior]);

  const ll = logLik(p);
  const likRel = Math.exp(ll - logLik(MLE)); // relative to the peak

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted">
          Observed: {K} conversions / {N} visitors
        </span>
        <button
          onClick={() => setShowPrior((s) => !s)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            showPrior ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {showPrior ? 'prior on (MAP)' : 'add a prior (MAP)'}
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">your guess  p = {p.toFixed(2)}</span>
          <input
            type="range" min={0.01} max={0.99} step={0.01} value={p}
            onInput={(e) => setP(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]"
          />
        </label>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="your p" color={COLORS.marker} value={p.toFixed(2)} />
          <Readout label="likelihood (rel.)" value={`${(likRel * 100).toFixed(0)}%`} />
          <Readout label="MLE = k/n" color={COLORS.curve} value={MLE.toFixed(2)} />
          {showPrior && <Readout label="MAP (mode)" color={COLORS.map} value={MAP.toFixed(2)} />}
        </div>
        <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          {Math.abs(p - MLE) < 0.02
            ? 'You are at the peak — this p makes the observed data most likely. That is the MLE.'
            : p < MLE
            ? 'Slide right: a higher p raises the chance of seeing this many conversions.'
            : 'Slide left: a lower p raises the chance of seeing this few conversions.'}
        </p>
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

function drawCurve(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  xToPx: (x: number) => number,
  yToPx: (y: number) => number,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const X = xToPx(pt.x), Y = yToPx(pt.y);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  });
  ctx.stroke();
}

function vline(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bot: number,
  color: string,
  label: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    ctx.fillStyle = color;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, top - 4);
  }
}
