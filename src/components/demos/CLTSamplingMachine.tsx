import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The Central Limit Theorem — a sampling machine.
   - Pick a (deliberately non-normal) source distribution and a sample
     size n. Each "draw" averages n values; that sample mean is binned.
   - As you pile up means, the histogram morphs into a bell curve whose
     spread shrinks like σ/√n — the predicted normal is overlaid.
   ------------------------------------------------------------------ */

type Source = 'uniform' | 'exponential' | 'coin' | 'bimodal';

const BINS = 44;
const C = {
  bar: '#0ea5e9',
  barTop: '#38bdf8',
  curve: '#10b981',
  axis: 'rgba(128,128,128,0.5)',
  text: '#64748b',
};

const SOURCES: Record<Source, { label: string; lo: number; hi: number; mu: number; sd: number; draw: () => number }> = {
  uniform: { label: 'Uniform', lo: 0, hi: 1, mu: 0.5, sd: Math.sqrt(1 / 12), draw: () => Math.random() },
  exponential: { label: 'Exponential', lo: 0, hi: 4, mu: 1, sd: 1, draw: () => -Math.log(1 - Math.random()) },
  coin: { label: 'Coin (0/1)', lo: 0, hi: 1, mu: 0.5, sd: 0.5, draw: () => (Math.random() < 0.5 ? 0 : 1) },
  bimodal: { label: 'Two spikes', lo: 0, hi: 1, mu: 0.5, sd: 0.5, draw: () => (Math.random() < 0.5 ? 0.1 : 0.9) },
};

export default function CLTSamplingMachine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const histRef = useRef<number[]>(new Array(BINS).fill(0));
  const accRef = useRef({ count: 0, sum: 0, sumsq: 0 });
  const rafRef = useRef<number | null>(null);

  const [source, setSource] = useState<Source>('exponential');
  const [n, setN] = useState(5);
  const [, force] = useState(0);

  const reset = () => {
    histRef.current = new Array(BINS).fill(0);
    accRef.current = { count: 0, sum: 0, sumsq: 0 };
    draw();
    force((x) => x + 1);
  };

  useEffect(() => { reset(); }, [source, n]);

  const drawOneMean = (): number => {
    const s = SOURCES[source];
    let sum = 0;
    for (let i = 0; i < n; i++) sum += s.draw();
    return sum / n;
  };

  const addSamples = (k: number) => {
    const s = SOURCES[source];
    const hist = histRef.current;
    const acc = accRef.current;
    for (let i = 0; i < k; i++) {
      const m = drawOneMean();
      const t = (m - s.lo) / (s.hi - s.lo);
      let bin = Math.floor(t * BINS);
      bin = Math.max(0, Math.min(BINS - 1, bin));
      hist[bin]++;
      acc.count++; acc.sum += m; acc.sumsq += m * m;
    }
    draw();
    force((x) => x + 1);
  };

  const runMany = () => {
    let added = 0;
    const step = () => {
      addSamples(25);
      added += 25;
      if (added < 1000) rafRef.current = requestAnimationFrame(step);
    };
    step();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const s = SOURCES[source];
    const padL = 14, padR = 14, padB = 26, padT = 14;
    const plotW = w - padL - padR;
    const baseY = h - padB;
    const plotH = baseY - padT;
    const hist = histRef.current;
    const count = accRef.current.count || 1;

    const maxFrac = Math.max(0.001, ...hist.map((c) => c / count));
    const binW = plotW / BINS;

    // x axis
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, baseY); ctx.lineTo(w - padR, baseY); ctx.stroke();
    ctx.fillStyle = C.text; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let g = 0; g <= 4; g++) {
      const v = s.lo + (g / 4) * (s.hi - s.lo);
      ctx.fillText(v.toFixed(1), padL + (g / 4) * plotW, baseY + 6);
    }

    // histogram bars
    hist.forEach((c, i) => {
      const frac = c / count;
      const bh = (frac / maxFrac) * plotH;
      const x = padL + i * binW;
      const y = baseY - bh;
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, C.barTop); grad.addColorStop(1, C.bar);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 0.5, y, binW - 1, bh);
    });

    // predicted normal: mean μ, sd σ/√n
    const sd = s.sd / Math.sqrt(n);
    const binWidthData = (s.hi - s.lo) / BINS;
    const pdf = (x: number) => Math.exp(-0.5 * ((x - s.mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
    // peak fraction (per bin) for scaling against maxFrac
    const peakFrac = pdf(s.mu) * binWidthData;
    const scale = peakFrac > 0 ? Math.min(1, maxFrac / peakFrac) : 1;
    ctx.strokeStyle = C.curve; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = padL; px <= w - padR; px += 2) {
      const xData = s.lo + ((px - padL) / plotW) * (s.hi - s.lo);
      const frac = pdf(xData) * binWidthData * scale;
      const y = baseY - (frac / maxFrac) * plotH;
      if (!started) { ctx.moveTo(px, y); started = true; } else ctx.lineTo(px, y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.56, 320));
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const acc = accRef.current;
  const empMean = acc.count ? acc.sum / acc.count : 0;
  const empSd = acc.count ? Math.sqrt(Math.max(0, acc.sumsq / acc.count - empMean ** 2)) : 0;
  const predSd = SOURCES[source].sd / Math.sqrt(n);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(SOURCES) as Source[]).map((sKey) => (
          <button
            key={sKey}
            onClick={() => setSource(sKey)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              source === sKey ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {SOURCES[sKey].label}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="w-full rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end">
        <label class="block text-sm">
          <span class="mb-1 flex justify-between text-muted"><span>sample size n</span><span class="font-mono text-text">{n}</span></span>
          <input type="range" min={1} max={50} step={1} value={n}
            onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
        <div class="flex flex-wrap gap-2">
          <button onClick={() => addSamples(1)} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Draw 1</button>
          <button onClick={() => addSamples(50)} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Draw 50</button>
          <button onClick={runMany} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">Run 1000×</button>
          <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Reset</button>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-4 gap-2 text-sm">
        <Readout label="means drawn" value={String(acc.count)} />
        <Readout label="emp. mean" value={empMean.toFixed(3)} />
        <Readout label="emp. sd" value={empSd.toFixed(3)} />
        <Readout label="σ/√n" value={predSd.toFixed(3)} color={C.curve} />
      </div>
      <p class="mt-2 text-xs text-muted">Crank up <strong>n</strong> and watch the green bell tighten — its width is σ/√n, no matter how lopsided the source is.</p>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <div class="text-muted text-xs">{label}</div>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
