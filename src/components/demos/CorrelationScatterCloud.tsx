import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Joint Distributions & Covariance / Correlation.
   - A cloud of points whose target correlation ρ is set by a slider.
   - The SAME underlying randomness is reused as ρ changes, so the
     cloud smoothly TILTS from a round blob (ρ=0) to a tight line (ρ=±1).
   - The fitted line, sample covariance and correlation update live.
   ------------------------------------------------------------------ */

const N = 220;
const C = {
  point: '#0ea5e9',
  line: '#10b981',
  axis: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.14)',
  text: '#64748b',
};

// Box–Muller standard normal.
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default function CorrelationScatterCloud() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 420, h: 360 });
  const baseRef = useRef<{ xs: number[]; zs: number[] }>({ xs: [], zs: [] });
  const [rho, setRho] = useState(0.6);
  const [seed, setSeed] = useState(0);

  // (re)generate the independent base randomness
  useEffect(() => {
    const xs: number[] = [], zs: number[] = [];
    for (let i = 0; i < N; i++) { xs.push(randn()); zs.push(randn()); }
    baseRef.current = { xs, zs };
    draw();
  }, [seed]);

  const points = (): { x: number; y: number }[] => {
    const { xs, zs } = baseRef.current;
    const c = Math.sqrt(Math.max(0, 1 - rho * rho));
    return xs.map((x, i) => ({ x, y: rho * x + c * zs[i] }));
  };

  const sampleStats = () => {
    const pts = points();
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let cov = 0, vx = 0, vy = 0;
    for (const p of pts) { cov += (p.x - mx) * (p.y - my); vx += (p.x - mx) ** 2; vy += (p.y - my) ** 2; }
    cov /= n; vx /= n; vy /= n;
    const corr = cov / (Math.sqrt(vx * vy) || 1);
    return { cov, corr };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 26;
    const ox = w / 2, oy = h / 2;
    const sc = (Math.min(w, h) - 2 * pad) / 7; // ±3.5 sd visible

    // grid + axes
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let g = -3; g <= 3; g++) {
      ctx.beginPath(); ctx.moveTo(ox + g * sc, pad); ctx.lineTo(ox + g * sc, h - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, oy + g * sc); ctx.lineTo(w - pad, oy + g * sc); ctx.stroke();
    }
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(pad, oy); ctx.lineTo(w - pad, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, pad); ctx.lineTo(ox, h - pad); ctx.stroke();

    // points
    const pts = points();
    ctx.fillStyle = C.point;
    for (const p of pts) {
      const px = ox + p.x * sc, py = oy - p.y * sc;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // regression-ish line: slope = rho (since both ~unit variance)
    ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox - 3.4 * sc, oy - rho * -3.4 * sc);
    ctx.lineTo(ox + 3.4 * sc, oy - rho * 3.4 * sc);
    ctx.stroke();

    // labels
    ctx.fillStyle = C.text; ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('X →', w - pad, oy + 6);
    ctx.save(); ctx.translate(ox - 6, pad); ctx.textAlign = 'left'; ctx.fillText('Y ↑', 0, 0); ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 440);
      const h = Math.round(w * 0.92);
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

  useEffect(draw, [rho]);

  const { cov, corr } = sampleStats();
  const verdict =
    Math.abs(rho) < 0.08 ? 'No linear link — a round blob.'
      : rho > 0 ? 'Positive — X and Y rise together.'
        : 'Negative — when X rises, Y tends to fall.';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 flex justify-between text-muted"><span>target correlation ρ</span><span class="font-mono text-text">{rho.toFixed(2)}</span></span>
            <input type="range" min={-1} max={1} step={0.01} value={rho}
              onInput={(e) => setRho(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="sample cov" value={cov.toFixed(2)} />
            <Readout label="sample corr" value={corr.toFixed(2)} color={C.line} />
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">{verdict}</p>
          <button onClick={() => setSeed((s) => s + 1)}
            class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
            New sample
          </button>
        </div>
      </div>
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
