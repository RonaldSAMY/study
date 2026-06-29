import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Confidence-interval sampler (election polling).
   - The TRUE support is fixed but "unknown" to each poll.
   - Each poll surveys n voters and draws a 95% interval.
   - About 95% of the intervals capture the true value (emerald);
     the rest miss (red). The running coverage converges on 95%.
   ------------------------------------------------------------------ */

const COLORS = {
  truth: '#4f46e5',
  hit: '#10b981',
  miss: '#ef4444',
  axis: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.18)',
};

const TRUE_P = 0.54;  // true candidate support (45%..65% window shown)
const N = 200;        // voters per poll
const Z = 1.96;       // 95% critical value
const LO = 0.4;
const HI = 0.7;
const MAX_ROWS = 22;

type Interval = { lo: number; hi: number; center: number; hit: boolean };

// standard normal sample (Box-Muller)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function poll(): Interval {
  // sample proportion via normal approximation to the binomial
  const se = Math.sqrt((TRUE_P * (1 - TRUE_P)) / N);
  const phat = Math.min(0.99, Math.max(0.01, TRUE_P + randn() * se));
  const seHat = Math.sqrt((phat * (1 - phat)) / N);
  const lo = phat - Z * seHat;
  const hi = phat + Z * seHat;
  return { lo, hi, center: phat, hit: lo <= TRUE_P && TRUE_P <= hi };
}

export default function ConfidenceIntervalSampler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rows, setRows] = useState<Interval[]>([]);
  const [total, setTotal] = useState(0);
  const [hits, setHits] = useState(0);
  const sizeRef = useRef({ w: 480, h: 360, pad: 40 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const plotW = w - 2 * pad;
    const topPad = 24;
    const xToPx = (x: number) => pad + ((x - LO) / (HI - LO)) * plotW;

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let t = LO; t <= HI + 1e-9; t += 0.05) {
      const x = xToPx(t);
      ctx.beginPath(); ctx.moveTo(x, topPad); ctx.lineTo(x, h - 22); ctx.stroke();
      ctx.fillText(`${Math.round(t * 100)}%`, x, h - 6);
    }

    // true value line
    ctx.strokeStyle = COLORS.truth; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(xToPx(TRUE_P), topPad - 6); ctx.lineTo(xToPx(TRUE_P), h - 22); ctx.stroke();
    ctx.fillStyle = COLORS.truth; ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText(`true ${Math.round(TRUE_P * 100)}%`, xToPx(TRUE_P), topPad - 10);

    // intervals (most recent at top)
    const shown = rows.slice(-MAX_ROWS).reverse();
    const rowH = (h - 22 - topPad - 8) / MAX_ROWS;
    shown.forEach((iv, i) => {
      const y = topPad + 8 + i * rowH + rowH / 2;
      const color = iv.hit ? COLORS.hit : COLORS.miss;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(xToPx(iv.lo), y); ctx.lineTo(xToPx(iv.hi), y); ctx.stroke();
      // caps
      ctx.beginPath(); ctx.moveTo(xToPx(iv.lo), y - 4); ctx.lineTo(xToPx(iv.lo), y + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xToPx(iv.hi), y - 4); ctx.lineTo(xToPx(iv.hi), y + 4); ctx.stroke();
      // center dot
      ctx.beginPath(); ctx.arc(xToPx(iv.center), y, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = 360;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 30 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [rows]);

  const drawN = (count: number) => {
    const next: Interval[] = [];
    let h = 0;
    for (let i = 0; i < count; i++) {
      const iv = poll();
      next.push(iv);
      if (iv.hit) h++;
    }
    setRows((r) => [...r, ...next].slice(-400));
    setTotal((t) => t + count);
    setHits((x) => x + h);
  };
  const reset = () => { setRows([]); setTotal(0); setHits(0); };

  const coverage = total ? (hits / total) * 100 : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => drawN(1)} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">poll once</button>
        <button onClick={() => drawN(20)} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">+20 polls</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">reset</button>
        <span class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold">
          n = {N} voters / poll
        </span>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="polls run" value={`${total}`} />
        <Readout label="captured truth" color={COLORS.hit} value={`${hits}`} />
        <Readout label="coverage" color={total && Math.abs(coverage - 95) < 5 ? COLORS.hit : undefined} value={total ? `${coverage.toFixed(1)}%` : '—'} />
      </div>
      <p class="mt-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Each bar is one poll's 95% interval. Run many: the green share settles near 95%. The interval is
        random, the true value is fixed — so "95% confident" describes the <em>method</em>, not any single bar.
      </p>
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
