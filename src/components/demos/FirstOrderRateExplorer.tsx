import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   First-order ODE solution-family explorer.
   - "Decay/Growth":   y' = k·y          -> y = y0·e^(k t)
   - "Saturating (RC)": y' = k·(C − y)    -> y = C + (y0 − C)·e^(−k t)
   Slide the rate constant k and watch the whole family of curves
   (several starting values) bend together.
   ------------------------------------------------------------------ */

type Mode = 'exp' | 'rc';

const COLORS = {
  curve: '#4f46e5',
  highlight: '#10b981',
  target: 'rgba(14,165,233,0.6)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

const T_MAX = 6;
const Y_MAX = 6;
const CAP = 4; // saturation ceiling C for RC mode

export default function FirstOrderRateExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('exp');
  const [k, setK] = useState(0.6);
  const sizeRef = useRef({ w: 480, h: 320 });

  const toPx = (t: number, y: number) => {
    const { w, h } = sizeRef.current;
    return { x: (t / T_MAX) * w, y: h - (y / Y_MAX) * h };
  };

  const solve = (t: number, y0: number) =>
    mode === 'exp' ? y0 * Math.exp(k * t) : CAP + (y0 - CAP) * Math.exp(-k * t);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let t = 1; t <= T_MAX; t++) { const p = toPx(t, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke(); }
    for (let y = 1; y <= Y_MAX; y++) { const p = toPx(0, y); ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke(); }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.4;
    const o = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(0, o.y); ctx.lineTo(w, o.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h); ctx.stroke();

    // saturation ceiling for RC
    if (mode === 'rc') {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = COLORS.target; ctx.lineWidth = 1.5;
      const c = toPx(0, CAP);
      ctx.beginPath(); ctx.moveTo(0, c.y); ctx.lineTo(w, c.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // family of curves for several starting values
    const starts = mode === 'exp' ? [0.4, 0.9, 1.5, 2.3] : [0.2, 1.2, 2.4, 5.4];
    starts.forEach((y0, idx) => {
      ctx.strokeStyle = idx === 1 ? COLORS.highlight : COLORS.curve;
      ctx.lineWidth = idx === 1 ? 3.2 : 1.8;
      ctx.globalAlpha = idx === 1 ? 1 : 0.65;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px <= w; px += 2) {
        const t = (px / w) * T_MAX;
        const y = solve(t, y0);
        const p = toPx(t, y);
        if (p.y < -20 || p.y > h + 20) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.round(w * 0.62);
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

  useEffect(draw, [mode, k]);

  const halfLife = Math.log(2) / Math.abs(k);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => { setMode('exp'); setK(0.6); }}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === 'exp' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          y′ = k·y (growth / decay)
        </button>
        <button
          onClick={() => { setMode('rc'); setK(0.8); }}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === 'rc' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          y′ = k·(C − y) (charging)
        </button>
      </div>
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm md:w-48">
          <label class="block">
            <span class="mb-1 block text-muted">
              rate k = {mode === 'exp' && k < 0 ? '' : ''}{k.toFixed(2)}
            </span>
            <input
              type="range"
              min={mode === 'exp' ? -0.8 : 0.1}
              max={mode === 'exp' ? 0.9 : 2}
              step={0.05}
              value={k}
              onInput={(e) => setK(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            {mode === 'exp' ? (
              <>
                <p class="font-mono text-sm">y = y₀·e^({k.toFixed(2)}·t)</p>
                <p class="mt-1 text-muted">{k > 0 ? 'k > 0 → explosive growth.' : k < 0 ? `k < 0 → decay, half-life ≈ ${halfLife.toFixed(2)}.` : 'k = 0 → stays flat.'}</p>
              </>
            ) : (
              <>
                <p class="font-mono text-sm">y = C + (y₀−C)·e^(−{k.toFixed(2)}·t)</p>
                <p class="mt-1 text-muted">Every curve homes in on the ceiling C = {CAP}. Bigger k → faster.</p>
              </>
            )}
          </div>
          <p class="text-xs text-muted">One rate constant, one shared shape — only the starting value differs between curves.</p>
        </div>
      </div>
    </div>
  );
}
