import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   GAN minimax in 1D.
   - Real data (indigo) is bimodal: a mixture of two Gaussians.
   - The generator (emerald) is a single Gaussian N(mu_g, sigma_g).
   - The discriminator's optimal output is D(x) = p_real / (p_real + p_gen).
   - "Train" lets the generator climb log D via reparameterized samples.
     Being a single bump, it can only chase ONE peak -> mode collapse.
   ------------------------------------------------------------------ */

const COLORS = {
  real: '#4f46e5',
  gen: '#10b981',
  disc: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
};

const REAL = [
  { mu: -2, s: 0.8, w: 0.5 },
  { mu: 2, s: 0.8, w: 0.5 },
];

function npdf(x: number, mu: number, s: number) {
  return Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
}
function realPdf(x: number) {
  return REAL.reduce((a, m) => a + m.w * npdf(x, m.mu, m.s), 0);
}

// fixed standard-normal samples -> reparameterized generator samples
const EPS = Array.from({ length: 80 }, () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
});

export default function GanMinimaxDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const muRef = useRef(0.4);
  const sigRef = useRef(1.3);
  const sizeRef = useRef({ w: 480, h: 280 });

  const [muG, setMuG] = useState(0.4);
  const [sigG, setSigG] = useState(1.3);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 26;
    const x0 = pad;
    const x1 = w - pad;
    const yb = h - pad;
    const xLo = -6;
    const xHi = 6;
    const toX = (x: number) => x0 + ((x - xLo) / (xHi - xLo)) * (x1 - x0);
    const pdfScale = (h - 2 * pad) / 0.45;

    // baseline
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.stroke();

    const mu = muRef.current;
    const sig = sigRef.current;
    const genPdf = (x: number) => npdf(x, mu, sig);

    // filled real
    fillCurve(ctx, toX, yb, xLo, xHi, realPdf, pdfScale, 'rgba(79,70,229,0.18)', COLORS.real);
    // filled gen
    fillCurve(ctx, toX, yb, xLo, xHi, genPdf, pdfScale, 'rgba(16,185,129,0.20)', COLORS.gen);

    // discriminator curve D(x) in [0,1] across the top band
    ctx.strokeStyle = COLORS.disc;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let x = xLo; x <= xHi; x += 0.05) {
      const pr = realPdf(x);
      const pg = genPdf(x);
      const D = pr / (pr + pg + 1e-9);
      const y = pad + (1 - D) * (h - 2 * pad);
      const xx = toX(x);
      if (x === xLo) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // legend
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.real; ctx.fillText('real', x0 + 4, pad + 4);
    ctx.fillStyle = COLORS.gen; ctx.fillText('generator', x0 + 44, pad + 4);
    ctx.fillStyle = COLORS.disc; ctx.fillText('D(x)', x1 - 36, pad + 4);
  };

  // one generator gradient-ascent step on E[log D], D held fixed
  const trainStep = () => {
    const mu = muRef.current;
    const sig = sigRef.current;
    const genPdfCur = (x: number) => npdf(x, mu, sig);
    const Dfixed = (x: number) => {
      const pr = realPdf(x);
      const pg = genPdfCur(x);
      return pr / (pr + pg + 1e-9);
    };
    const J = (m: number, s: number) => {
      let acc = 0;
      for (const e of EPS) acc += Math.log(Dfixed(m + s * e) + 1e-9);
      return acc / EPS.length;
    };
    const h = 1e-3;
    const gMu = (J(mu + h, sig) - J(mu - h, sig)) / (2 * h);
    const gSig = (J(mu, sig + h) - J(mu, sig - h)) / (2 * h);
    const lr = 0.08;
    muRef.current = mu + lr * gMu;
    sigRef.current = Math.max(0.18, sig + lr * gSig);
  };

  const loop = () => {
    if (!runningRef.current) return;
    for (let i = 0; i < 3; i++) trainStep();
    setMuG(muRef.current);
    setSigG(sigRef.current);
    setSteps((s) => s + 3);
    draw();
    rafRef.current = requestAnimationFrame(loop);
  };

  const toggle = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    if (next) rafRef.current = requestAnimationFrame(loop);
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    muRef.current = 0.4;
    sigRef.current = 1.3;
    setMuG(0.4);
    setSigG(1.3);
    setSteps(0);
    draw();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.max(280, Math.min(parent.clientWidth, 560));
      const hh = Math.round(w * 0.55);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hh * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hh };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={toggle}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {running ? 'Pause' : 'Train'}
        </button>
        <button
          onClick={() => { trainStep(); setMuG(muRef.current); setSigG(sigRef.current); setSteps((s) => s + 1); draw(); }}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Step ×1
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label="gen mean μ_g" value={muG.toFixed(2)} color={COLORS.gen} />
        <Stat label="gen std σ_g" value={sigG.toFixed(2)} color={COLORS.gen} />
        <Stat label="train steps" value={String(steps)} />
      </div>

      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Press <strong>Train</strong>: the generator slides toward whichever peak it started
        nearest and parks there, leaving the other peak uncovered. A single-bump generator
        chasing a two-bump target is the classic picture of <strong>mode collapse</strong>.
      </div>
    </div>
  );
}

function fillCurve(
  ctx: CanvasRenderingContext2D,
  toX: (x: number) => number,
  yb: number,
  xLo: number,
  xHi: number,
  pdf: (x: number) => number,
  scale: number,
  fill: string,
  stroke: string,
) {
  ctx.beginPath();
  let first = true;
  for (let x = xLo; x <= xHi; x += 0.04) {
    const y = yb - pdf(x) * scale;
    const xx = toX(x);
    if (first) { ctx.moveTo(xx, y); first = false; }
    else ctx.lineTo(xx, y);
  }
  ctx.lineTo(toX(xHi), yb);
  ctx.lineTo(toX(xLo), yb);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  // stroke top
  ctx.beginPath();
  first = true;
  for (let x = xLo; x <= xHi; x += 0.04) {
    const y = yb - pdf(x) * scale;
    const xx = toX(x);
    if (first) { ctx.moveTo(xx, y); first = false; }
    else ctx.lineTo(xx, y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
