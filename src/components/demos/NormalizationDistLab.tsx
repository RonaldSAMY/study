import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Normalization lab — activation distribution before vs after.
   A batch of activations (samples × features) drifts off-center as
   training proceeds. Batch norm standardizes each feature across the
   batch; layer norm standardizes each sample across its features.
   Watch the histogram snap back to mean 0 / std 1, then get rescaled
   by the learnable γ (scale) and β (shift).
   ------------------------------------------------------------------ */

type Mode = 'none' | 'batch' | 'layer';

const COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
};

const ROWS = 10; // samples in the batch
const COLS = 6;  // features (neurons) in the layer

// seeded base grid ~ N(0,1)
const BASE: number[][] = (() => {
  let s = 19;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const g = () => { // Box–Muller
    const u = Math.max(rnd(), 1e-6), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => g()));
})();

export default function NormalizationDistLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('batch');
  const [shift, setShift] = useState(2.5);
  const [scale, setScale] = useState(2.0);
  const [gamma, setGamma] = useState(1.0);
  const [beta, setBeta] = useState(0.0);
  const sizeRef = useRef({ w: 480, h: 300 });

  // incoming activations after "covariate shift"
  const raw = BASE.map((row) => row.map((v) => v * scale + shift));

  const eps = 1e-5;
  const norm = raw.map((r) => r.slice());
  if (mode === 'batch') {
    for (let c = 0; c < COLS; c++) {
      let m = 0; for (let r = 0; r < ROWS; r++) m += raw[r][c]; m /= ROWS;
      let v = 0; for (let r = 0; r < ROWS; r++) v += (raw[r][c] - m) ** 2; v /= ROWS;
      for (let r = 0; r < ROWS; r++) norm[r][c] = (raw[r][c] - m) / Math.sqrt(v + eps) * gamma + beta;
    }
  } else if (mode === 'layer') {
    for (let r = 0; r < ROWS; r++) {
      let m = 0; for (let c = 0; c < COLS; c++) m += raw[r][c]; m /= COLS;
      let v = 0; for (let c = 0; c < COLS; c++) v += (raw[r][c] - m) ** 2; v /= COLS;
      for (let c = 0; c < COLS; c++) norm[r][c] = (raw[r][c] - m) / Math.sqrt(v + eps) * gamma + beta;
    }
  }

  const flat = (g: number[][]) => g.flat();
  const stats = (a: number[]) => {
    const m = a.reduce((s, x) => s + x, 0) / a.length;
    const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
    return { m, sd };
  };
  const sRaw = stats(flat(raw));
  const sOut = stats(flat(norm));

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const X0 = -8, X1 = 8, BINS = 32;
    const histW = w; const half = h / 2;
    const drawHist = (vals: number[], y0: number, hh: number, col: string, title: string) => {
      const bins = new Array(BINS).fill(0);
      for (const v of vals) { const b = Math.floor(((v - X0) / (X1 - X0)) * BINS); if (b >= 0 && b < BINS) bins[b]++; }
      const mx = Math.max(...bins, 1);
      const bw = histW / BINS;
      for (let i = 0; i < BINS; i++) {
        const bh = (bins[i] / mx) * (hh - 24);
        ctx.fillStyle = col;
        ctx.fillRect(i * bw + 1, y0 + hh - bh - 4, bw - 2, bh);
      }
      // zero line
      const zx = ((0 - X0) / (X1 - X0)) * histW;
      ctx.strokeStyle = 'rgba(128,128,128,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(zx, y0 + 2); ctx.lineTo(zx, y0 + hh - 2); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.95)'; ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(title, 6, y0 + 16);
    };

    drawHist(flat(raw), 0, half, COLORS.sky, 'Before (incoming activations)');
    drawHist(flat(norm), half, half, COLORS.emerald, mode === 'none' ? 'After (no normalization)' : 'After normalization');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const wv = Math.min(parent.clientWidth, 560);
      const hv = Math.round(wv * 0.62);
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

  useEffect(draw, [mode, shift, scale, gamma, beta]);

  const axisNote = mode === 'batch'
    ? 'Each feature is standardized down its column (across the batch).'
    : mode === 'layer'
    ? 'Each sample is standardized across its row (across features).'
    : 'Raw activations pass straight through — note the drift.';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {([['none', 'None'], ['batch', 'Batch norm'], ['layer', 'Layer norm']] as [Mode, string][]).map(([m, lbl]) => (
          <button key={m} onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}>{lbl}</button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-2 text-sm md:w-52">
          <label class="block">
            <span class="mb-1 block text-muted">incoming mean shift = {shift.toFixed(1)}</span>
            <input type="range" min={-4} max={4} step={0.1} value={shift}
              onInput={(e) => setShift(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">incoming spread = {scale.toFixed(1)}×</span>
            <input type="range" min={0.3} max={3} step={0.1} value={scale}
              onInput={(e) => setScale(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">learnable γ = {gamma.toFixed(1)}</span>
            <input type="range" min={0.2} max={3} step={0.1} value={gamma} disabled={mode === 'none'}
              onInput={(e) => setGamma(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">learnable β = {beta.toFixed(1)}</span>
            <input type="range" min={-3} max={3} step={0.1} value={beta} disabled={mode === 'none'}
              onInput={(e) => setBeta(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="before μ/σ" value={`${sRaw.m.toFixed(1)}/${sRaw.sd.toFixed(1)}`} />
            <Readout label="after μ/σ" value={`${sOut.m.toFixed(1)}/${sOut.sd.toFixed(1)}`} />
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">{axisNote}</p>
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
