import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Gradient-boosting visualizer on a 1D regression problem.
   - A smooth wavy target curve is sampled at N points.
   - Each "tree" is a shallow regression stump (a step function with
     one split) fit greedily to the CURRENT residual r = y - F(x).
   - The split is chosen to minimise squared error on the residuals;
     each leaf value is the mean residual in its region.
   - Prediction F(x) = sum of learning_rate * stump(x).
   Add trees and watch the step fit converge to the curve and the
   training MSE drop. Crisp, responsive canvas (devicePixelRatio).
   ------------------------------------------------------------------ */

const COLORS = {
  target: '#0ea5e9',   // sky  — the smooth truth
  fit: '#4f46e5',      // indigo — the ensemble's step prediction
  residual: '#10b981', // emerald — residual markers
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const N = 64;            // number of sample points
const X_MIN = 0;
const X_MAX = 1;

// The smooth target we are trying to learn.
function targetFn(x: number): number {
  return Math.sin(2 * Math.PI * x) + 0.5 * Math.sin(4 * Math.PI * x) + 0.15 * x;
}

type Stump = { split: number; left: number; right: number };

// Fit one stump greedily to the residuals: pick the split that most
// reduces squared error; each leaf value is the mean residual there.
function fitStump(xs: number[], residual: number[]): Stump {
  const n = xs.length;
  let best: Stump = { split: xs[Math.floor(n / 2)], left: 0, right: 0 };
  let bestSSE = Infinity;
  // Candidate splits = midpoints between consecutive sorted x's (xs is sorted).
  for (let i = 1; i < n; i++) {
    const split = (xs[i - 1] + xs[i]) / 2;
    let sumL = 0, cntL = 0, sumR = 0, cntR = 0;
    for (let j = 0; j < n; j++) {
      if (xs[j] < split) { sumL += residual[j]; cntL++; }
      else { sumR += residual[j]; cntR++; }
    }
    if (cntL === 0 || cntR === 0) continue;
    const meanL = sumL / cntL;
    const meanR = sumR / cntR;
    let sse = 0;
    for (let j = 0; j < n; j++) {
      const pred = xs[j] < split ? meanL : meanR;
      const d = residual[j] - pred;
      sse += d * d;
    }
    if (sse < bestSSE) {
      bestSSE = sse;
      best = { split, left: meanL, right: meanR };
    }
  }
  return best;
}

function predictStump(s: Stump, x: number): number {
  return x < s.split ? s.left : s.right;
}

export default function BoostingEnsembleLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 320, pad: 36 });
  const rafRef = useRef<number | null>(null);

  // Fixed sample points and their target values (computed once).
  const xsRef = useRef<number[]>([]);
  const ysRef = useRef<number[]>([]);
  if (xsRef.current.length === 0) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < N; i++) {
      const x = X_MIN + (X_MAX - X_MIN) * (i / (N - 1));
      xs.push(x);
      ys.push(targetFn(x));
    }
    xsRef.current = xs;
    ysRef.current = ys;
  }

  const [trees, setTrees] = useState<Stump[]>([]);
  const [eta, setEta] = useState(0.5);

  // Current ensemble prediction at every sample point.
  const predict = (stumps: Stump[], x: number) => {
    let f = 0;
    for (const s of stumps) f += eta * predictStump(s, x);
    return f;
  };

  const mse = (() => {
    const xs = xsRef.current, ys = ysRef.current;
    let s = 0;
    for (let i = 0; i < xs.length; i++) {
      const d = ys[i] - predict(trees, xs[i]);
      s += d * d;
    }
    return s / xs.length;
  })();

  // Add `count` trees, each fit to the residual left by the ones before it.
  const addTrees = (count: number) => {
    const xs = xsRef.current, ys = ysRef.current;
    setTrees((prev) => {
      const next = prev.slice();
      for (let t = 0; t < count; t++) {
        // residual under the CURRENT ensemble (prev + new ones so far)
        const residual = xs.map((x, i) => {
          let f = 0;
          for (const s of next) f += eta * predictStump(s, x);
          return ys[i] - f;
        });
        next.push(fitStump(xs, residual));
      }
      return next;
    });
  };

  const reset = () => setTrees([]);

  // ---- value range for the y-axis (target + a little headroom) ----
  const yRange = (() => {
    const ys = ysRef.current;
    let lo = Infinity, hi = -Infinity;
    for (const v of ys) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const pad = 0.25 * (hi - lo || 1);
    return { lo: lo - pad, hi: hi + pad };
  })();

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const xs = xsRef.current, ys = ysRef.current;
    const { lo, hi } = yRange;
    const plotW = w - 2 * pad;
    const plotH = h - 2 * pad;
    const toPx = (x: number, y: number) => ({
      x: pad + ((x - X_MIN) / (X_MAX - X_MIN)) * plotW,
      y: pad + (1 - (y - lo) / (hi - lo)) * plotH,
    });

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const gx = pad + (i / 8) * plotW;
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, pad + plotH); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const gy = pad + (i / 6) * plotH;
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(pad + plotW, gy); ctx.stroke();
    }
    // zero axis (y = 0) if in range
    if (lo < 0 && hi > 0) {
      const z = toPx(X_MIN, 0).y;
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad, z); ctx.lineTo(pad + plotW, z); ctx.stroke();
    }

    // residual markers: vertical sticks from fit to target
    ctx.strokeStyle = 'rgba(16,185,129,0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < xs.length; i++) {
      const p0 = toPx(xs[i], predict(trees, xs[i]));
      const p1 = toPx(xs[i], ys[i]);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }

    // smooth target curve
    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const p = toPx(xs[i], ys[i]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // ensemble step prediction (draw as a stepped line)
    ctx.strokeStyle = COLORS.fit;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const p = toPx(xs[i], predict(trees, xs[i]));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else {
        const prev = toPx(xs[i - 1], predict(trees, xs[i - 1]));
        ctx.lineTo(p.x, prev.y); // horizontal segment
        ctx.lineTo(p.x, p.y);    // vertical jump
      }
    }
    ctx.stroke();

    // axis labels
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('x', pad + plotW - 8, pad + plotH + 18);
    ctx.fillText('f(x)', 6, pad - 10);
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 40 };
      rafRef.current = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // redraw whenever the model state changes
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [trees, eta]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => addTrees(1)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Add tree
        </button>
        <button
          onClick={() => addTrees(5)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Add 5 trees
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2 md:grid-cols-1">
            <Readout label="trees (M)" value={`${trees.length}`} />
            <Readout label="training MSE" value={mse.toFixed(4)} />
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">learning rate η = {eta.toFixed(2)}</span>
            <input
              type="range" min={0.05} max={1} step={0.05} value={eta}
              onInput={(e) => { setEta(parseFloat((e.target as HTMLInputElement).value)); reset(); }}
              class="w-full accent-[#4f46e5]"
            />
            <span class="mt-1 block text-xs text-muted">
              Changing η resets the ensemble.
            </span>
          </label>

          <div class="space-y-1.5 rounded-lg bg-surface-2 p-3 text-xs">
            <LegendRow color={COLORS.target} text="target (the smooth truth)" />
            <LegendRow color={COLORS.fit} text="ensemble fit (sum of stumps)" />
            <LegendRow color={COLORS.residual} text="residuals (errors left to fix)" />
          </div>

          <p class="text-xs text-muted">
            Each new tree is a step function fit to the leftover residual. Keep
            adding and the staircase hugs the curve — and the MSE falls.
          </p>
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

function LegendRow({ color, text }: { color: string; text: string }) {
  return (
    <div class="flex items-center gap-2">
      <span class="inline-block h-2.5 w-5 rounded-full" style={`background:${color}`} />
      <span class="text-muted">{text}</span>
    </div>
  );
}
