import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Regularization lab — overfitting vs. smoothing.
   A degree-9 polynomial is fit to a handful of noisy points by
   ridge (L2) regression. Turning up the L2 penalty (or dropout,
   which for a linear model acts like extra L2) pulls the wild,
   overfit wiggle toward a smooth curve that generalizes.
   ------------------------------------------------------------------ */

const COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
  warn: '#ef4444',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const DEG = 9;
const trueFn = (x: number) => Math.sin(2.3 * x) * 0.8;

// fixed noisy training set (seeded so the demo is stable)
const TRAIN: { x: number; y: number }[] = (() => {
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const x = -1 + (2 * i) / 10;
    pts.push({ x, y: trueFn(x) + (rnd() - 0.5) * 0.45 });
  }
  return pts;
})();

// powers of x up to DEG
const feats = (x: number) => Array.from({ length: DEG + 1 }, (_, k) => Math.pow(x, k));

// solve symmetric (XᵀX + λI) w = Xᵀy via Gaussian elimination
function ridgeFit(lambda: number): number[] {
  const m = DEG + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const bvec = new Array(m).fill(0);
  for (const { x, y } of TRAIN) {
    const f = feats(x);
    for (let i = 0; i < m; i++) {
      bvec[i] += f[i] * y;
      for (let j = 0; j < m; j++) A[i][j] += f[i] * f[j];
    }
  }
  for (let i = 0; i < m; i++) A[i][i] += lambda + 1e-9;
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [bvec[c], bvec[piv]] = [bvec[piv], bvec[c]];
    const d = A[c][c] || 1e-12;
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / d;
      for (let k = c; k < m; k++) A[r][k] -= f * A[c][k];
      bvec[r] -= f * bvec[c];
    }
  }
  return A.map((row, i) => bvec[i] / (row[i] || 1e-12));
}

const evalPoly = (w: number[], x: number) => feats(x).reduce((s, f, k) => s + f * w[k], 0);

export default function RegularizationFitLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [l2, setL2] = useState(0);
  const [dropout, setDropout] = useState(0);
  const sizeRef = useRef({ w: 480, h: 320 });

  // dropout in a linear model behaves like additional L2 shrinkage
  const lambda = l2 + dropout * 0.4;
  const w = ridgeFit(lambda);

  // train error and a held-out "test" error vs the true function
  const trainMSE = TRAIN.reduce((s, p) => s + (evalPoly(w, p.x) - p.y) ** 2, 0) / TRAIN.length;
  let testMSE = 0; const NT = 100;
  for (let i = 0; i < NT; i++) { const x = -1 + (2 * i) / (NT - 1); testMSE += (evalPoly(w, x) - trueFn(x)) ** 2; }
  testMSE /= NT;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: W, h: H } = sizeRef.current;
    ctx.clearRect(0, 0, W, H);
    const padX = 16, padY = 16;
    const X0 = -1.15, X1 = 1.15, Y0 = -1.7, Y1 = 1.7;
    const px = (x: number) => padX + ((x - X0) / (X1 - X0)) * (W - 2 * padX);
    const py = (y: number) => padY + (1 - (y - Y0) / (Y1 - Y0)) * (H - 2 * padY);

    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(X0), py(0)); ctx.lineTo(px(X1), py(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(0), py(Y0)); ctx.lineTo(px(0), py(Y1)); ctx.stroke();

    // true function (faint dashed)
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(128,128,128,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = X0 + (X1 - X0) * i / 200; const X = px(x), Y = py(trueFn(x)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.setLineDash([]);

    // fitted polynomial
    ctx.strokeStyle = lambda < 0.02 ? COLORS.warn : COLORS.brand; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const x = X0 + (X1 - X0) * i / 300; const Y = Math.max(py(Y1) - 40, Math.min(py(Y0) + 40, py(evalPoly(w, x)))); const X = px(x); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();

    // training points
    for (const p of TRAIN) {
      ctx.fillStyle = COLORS.emerald;
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const wv = Math.min(parent.clientWidth, 560);
      const hv = Math.round(wv * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wv * dpr; canvas.height = hv * dpr;
      canvas.style.width = `${wv}px`; canvas.style.height = `${hv}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: wv, h: hv };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [l2, dropout]);

  const regime = lambda < 0.02 ? 'Overfitting: low train error, high test error.'
    : lambda > 0.5 ? 'Underfitting: too smooth, missing the signal.'
    : 'Good fit: smooth and generalizing.';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-52">
          <label class="block">
            <span class="mb-1 block text-muted">L2 penalty λ = {l2.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={l2}
              onInput={(e) => setL2(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">dropout rate = {dropout.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={dropout}
              onInput={(e) => setDropout(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="train err" value={trainMSE.toFixed(3)} />
            <Readout label="test err" value={testMSE.toFixed(3)} />
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">{regime}</p>
          <p class="text-xs text-muted">Dashed grey = true signal · green = noisy data.</p>
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
