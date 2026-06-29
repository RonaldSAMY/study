import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Overfitting & model selection lab.
   - A fixed noisy dataset is split into TRAIN (filled) and TEST (hollow).
   - Slide the polynomial DEGREE; we fit by least squares on TRAIN only.
   - Left canvas: data + fitted curve.
   - Right canvas: train error falling vs. test error U-shaping.
   ------------------------------------------------------------------ */

const COLORS = {
  fit: '#4f46e5',     // indigo: the model
  train: '#0ea5e9',   // sky: training points
  test: '#10b981',    // emerald: test points
  trainErr: '#0ea5e9',
  testErr: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  truth: 'rgba(128,128,128,0.55)',
};

const MAX_DEGREE = 9;

type Pt = { x: number; y: number };

// --- deterministic RNG so every learner sees the same picture ---
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng: () => number) {
  // Box–Muller
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// the unknown "true" pattern the data was sampled from
const truth = (x: number) => Math.sin(2 * Math.PI * x);

function makeData(seed: number): { train: Pt[]; test: Pt[] } {
  const rng = mulberry32(seed);
  const noise = 0.22;
  const train: Pt[] = [];
  const test: Pt[] = [];
  for (let i = 0; i < 11; i++) {
    const x = i / 10;
    train.push({ x, y: truth(x) + gauss(rng) * noise });
  }
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) / 9;
    test.push({ x, y: truth(x) + gauss(rng) * noise });
  }
  return { train, test };
}

// --- least-squares polynomial fit on u = 2x-1 (kept in [-1,1] for stability) ---
function fitPoly(pts: Pt[], degree: number): number[] {
  const n = degree + 1;
  // design matrix columns are u^0..u^degree
  const ATA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const ATy: number[] = new Array(n).fill(0);
  for (const p of pts) {
    const u = 2 * p.x - 1;
    const powers = new Array(n);
    powers[0] = 1;
    for (let j = 1; j < n; j++) powers[j] = powers[j - 1] * u;
    for (let r = 0; r < n; r++) {
      ATy[r] += powers[r] * p.y;
      for (let c = 0; c < n; c++) ATA[r][c] += powers[r] * powers[c];
    }
  }
  // tiny ridge keeps high degrees from exploding numerically
  for (let i = 0; i < n; i++) ATA[i][i] += 1e-7;
  return solve(ATA, ATy);
}
// Gaussian elimination with partial pivoting
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1e-12));
}
const evalPoly = (coef: number[], x: number) => {
  const u = 2 * x - 1;
  let p = 1, s = 0;
  for (const c of coef) { s += c * p; p *= u; }
  return s;
};
const mse = (coef: number[], pts: Pt[]) =>
  pts.reduce((acc, p) => acc + (evalPoly(coef, p.x) - p.y) ** 2, 0) / pts.length;

export default function OverfittingPolynomialLab() {
  const [seed, setSeed] = useState(7);
  const [degree, setDegree] = useState(1);
  const [showTruth, setShowTruth] = useState(false);
  const fitCanvas = useRef<HTMLCanvasElement>(null);
  const errCanvas = useRef<HTMLCanvasElement>(null);
  const fitSize = useRef({ w: 480, h: 320 });
  const errSize = useRef({ w: 480, h: 320 });

  const { train, test } = useMemo(() => makeData(seed), [seed]);

  // fit for current degree + the whole error curve across degrees
  const coef = useMemo(() => fitPoly(train, degree), [train, degree]);
  const curve = useMemo(() => {
    const arr: { d: number; tr: number; te: number }[] = [];
    for (let d = 0; d <= MAX_DEGREE; d++) {
      const c = fitPoly(train, d);
      arr.push({ d, tr: mse(c, train), te: mse(c, test) });
    }
    return arr;
  }, [train, test]);

  const trErr = mse(coef, train);
  const teErr = mse(coef, test);

  const X_MIN = -0.05, X_MAX = 1.05, Y_MIN = -1.7, Y_MAX = 1.7;

  const drawFit = () => {
    const cv = fitCanvas.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const { w, h } = fitSize.current;
    const px = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * w;
    const py = (y: number) => h - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * h;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= 1.0001; gx += 0.25) { ctx.beginPath(); ctx.moveTo(px(gx), 0); ctx.lineTo(px(gx), h); ctx.stroke(); }
    for (let gy = -1.5; gy <= 1.5001; gy += 0.5) { ctx.beginPath(); ctx.moveTo(0, py(gy)); ctx.lineTo(w, py(gy)); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();

    // true function
    if (showTruth) {
      ctx.strokeStyle = COLORS.truth; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const x = i / 200; const X = px(x), Y = py(truth(x)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // fitted curve (clamped vertically so wild high-degree wiggles stay on screen)
    ctx.strokeStyle = COLORS.fit; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 400; i++) {
      const x = X_MIN + (i / 400) * (X_MAX - X_MIN);
      const y = Math.max(Y_MIN - 0.5, Math.min(Y_MAX + 0.5, evalPoly(coef, x)));
      const X = px(x), Y = py(y);
      started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
    }
    ctx.stroke();

    // test points (hollow)
    for (const p of test) {
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.test; ctx.stroke();
    }
    // train points (filled)
    for (const p of train) {
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.train; ctx.fill();
    }
  };

  const drawErr = () => {
    const cv = errCanvas.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const { w, h } = errSize.current;
    const pad = 30;
    const yMaxRaw = Math.max(...curve.map((c) => Math.max(c.tr, Math.min(c.te, 1.6))));
    const yMax = Math.max(0.25, Math.min(1.6, yMaxRaw)) * 1.1;
    const px = (d: number) => pad + (d / MAX_DEGREE) * (w - pad - 8);
    const py = (e: number) => (h - pad) - (Math.min(e, yMax) / yMax) * (h - pad - 8);
    ctx.clearRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad, 8); ctx.lineTo(pad, h - pad); ctx.lineTo(w - 4, h - pad); ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.85)'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText('error', 4, 14);
    ctx.fillText('degree', w - 48, h - 10);

    const series = (key: 'tr' | 'te', color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      curve.forEach((c, i) => { const X = px(c.d), Y = py(c[key]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
      ctx.fillStyle = color;
      curve.forEach((c) => { ctx.beginPath(); ctx.arc(px(c.d), py(c[key]), 3, 0, Math.PI * 2); ctx.fill(); });
    };
    series('te', COLORS.testErr);
    series('tr', COLORS.trainErr);

    // marker for current degree
    ctx.strokeStyle = 'rgba(128,128,128,0.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px(degree), 8); ctx.lineTo(px(degree), h - pad); ctx.stroke(); ctx.setLineDash([]);
  };

  useEffect(() => {
    const setup = (cv: HTMLCanvasElement | null, sizeRef: typeof fitSize, ratio: number, redraw: () => void) => {
      if (!cv) return () => {};
      const resize = () => {
        const parent = cv.parentElement!;
        const w = Math.min(parent.clientWidth, 520);
        const h = Math.round(w * ratio);
        const dpr = window.devicePixelRatio || 1;
        cv.width = w * dpr; cv.height = h * dpr;
        cv.style.width = `${w}px`; cv.style.height = `${h}px`;
        const ctx = cv.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sizeRef.current = { w, h };
        redraw();
      };
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    };
    const c1 = setup(fitCanvas.current, fitSize, 0.66, drawFit);
    const c2 = setup(errCanvas.current, errSize, 0.66, drawErr);
    return () => { c1(); c2(); };
  }, []);

  useEffect(drawFit, [coef, train, test, showTruth, degree]);
  useEffect(drawErr, [curve, degree]);

  const verdict =
    degree <= 1 ? 'Too rigid — the straight line misses the curve. This is underfitting (high bias).'
    : degree >= 7 ? 'Too flexible — the curve chases every noisy point. This is overfitting (high variance).'
    : 'A good balance — it captures the trend without chasing the noise.';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-4 md:grid-cols-2">
        <div><canvas ref={fitCanvas} class="touch-none w-full rounded-xl bg-surface-2" /></div>
        <div><canvas ref={errCanvas} class="touch-none w-full rounded-xl bg-surface-2" /></div>
      </div>

      <label class="block">
        <span class="mb-1 flex items-center justify-between text-sm">
          <span class="text-muted">polynomial degree</span>
          <strong class="font-mono">{degree}</strong>
        </span>
        <input
          type="range" min={0} max={MAX_DEGREE} step={1} value={degree}
          onInput={(e) => setDegree(parseInt((e.target as HTMLInputElement).value))}
          class="w-full accent-[#4f46e5]"
        />
      </label>

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Readout label="train error" value={trErr.toFixed(3)} color={COLORS.trainErr} />
        <Readout label="test error" value={teErr.toFixed(3)} color={COLORS.testErr} />
        <Readout label="degree" value={String(degree)} />
        <Readout label="train / test pts" value={`${train.length} / ${test.length}`} />
      </div>

      <p class="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-muted">{verdict}</p>

      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style={`background:${COLORS.train}`} /> train</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full border-2 bg-white" style={`border-color:${COLORS.test}`} /> test</span>
        <button onClick={() => setShowTruth((v) => !v)} class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">
          {showTruth ? 'hide' : 'show'} true pattern
        </button>
        <button onClick={() => setSeed((s) => s + 1)} class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">
          new data sample
        </button>
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
