import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Optimization explorer.
   - Drag the slider for the choice variable (lemonade price, or the
     width of a fenced pen) and watch the objective curve.
   - The tangent line at your current choice is drawn live: where it
     goes FLAT (slope f'(x) = 0) is the maximum.
   - Readouts show the value, the slope, and flag the optimum.
   ------------------------------------------------------------------ */

type Kind = 'profit' | 'fence';

const COLORS = {
  curve: '#4f46e5',
  tangent: '#0ea5e9',
  opt: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const SCEN: Record<
  Kind,
  {
    label: string;
    blurb: string;
    xlabel: string;
    ylabel: string;
    f: (x: number) => number;
    df: (x: number) => number;
    domain: [number, number];
    optX: number;
    start: number;
  }
> = {
  // Lemonade stand: sell (12 - 2p) cups at price p, cost $1/cup.
  // profit = (p - 1)(12 - 2p) = -2p^2 + 14p - 12, max at p = 3.5
  profit: {
    label: 'Lemonade pricing',
    blurb: 'Cups sold = 12 − 2p, each costs $1 to make.',
    xlabel: 'price p ($)',
    ylabel: 'profit ($)',
    f: (p) => -2 * p * p + 14 * p - 12,
    df: (p) => -4 * p + 14,
    domain: [1, 6],
    optX: 3.5,
    start: 1.5,
  },
  // Fence: 40 m of fencing, area = w(20 - w), max at w = 10
  fence: {
    label: 'Fencing a pen',
    blurb: '40 m of fence around a rectangle, area = w(20 − w).',
    xlabel: 'width w (m)',
    ylabel: 'area (m²)',
    f: (w) => w * (20 - w),
    df: (w) => 20 - 2 * w,
    domain: [0, 20],
    optX: 10,
    start: 4,
  },
};

export default function OptimizationExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState<Kind>('profit');
  const [x, setX] = useState(SCEN.profit.start);
  const sizeRef = useRef({ w: 480, h: 360 });
  const s = SCEN[kind];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 32;
    const [xmin, xmax] = s.domain;

    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const xv = xmin + (i / 100) * (xmax - xmin);
      const y = s.f(xv);
      ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    }
    ymin = Math.min(ymin, 0);
    const padY = (ymax - ymin) * 0.12 || 1;
    ymax += padY;

    const toPx = (xv: number, yv: number) => ({
      x: pad + ((xv - xmin) / (xmax - xmin)) * (w - 2 * pad),
      y: h - pad - ((yv - ymin) / (ymax - ymin)) * (h - 2 * pad),
    });

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const gx = pad + (i / 8) * (w - 2 * pad);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, h - pad); ctx.stroke();
      const gy = pad + (i / 8) * (h - 2 * pad);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
    }
    if (ymin < 0 && ymax > 0) {
      const z = toPx(xmin, 0).y;
      ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad, z); ctx.lineTo(w - pad, z); ctx.stroke();
    }

    // optimum vertical guide
    const op = toPx(s.optX, s.f(s.optX));
    ctx.strokeStyle = 'rgba(16,185,129,0.4)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(op.x, pad); ctx.lineTo(op.x, h - pad); ctx.stroke();
    ctx.setLineDash([]);

    // curve
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const xv = xmin + (i / 240) * (xmax - xmin);
      const p = toPx(xv, s.f(xv));
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // tangent line at current x
    const y0 = s.f(x), m = s.df(x);
    const tx0 = xmin, tx1 = xmax;
    const ta = toPx(tx0, y0 + m * (tx0 - x));
    const tb = toPx(tx1, y0 + m * (tx1 - x));
    ctx.strokeStyle = COLORS.tangent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ta.x, ta.y); ctx.lineTo(tb.x, tb.y); ctx.stroke();

    // current point
    const cp = toPx(x, y0);
    ctx.beginPath(); ctx.arc(cp.x, cp.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.tangent; ctx.stroke();

    // optimum marker
    ctx.beginPath(); ctx.arc(op.x, op.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.opt; ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const ww = Math.min(parent.clientWidth, 560);
      const hh = Math.round(ww * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = ww * dpr;
      canvas.height = hh * dpr;
      canvas.style.width = `${ww}px`;
      canvas.style.height = `${hh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: ww, h: hh };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [kind, x]);

  const slope = s.df(x);
  const atOpt = Math.abs(slope) < 0.15;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['profit', 'fence'] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => { setKind(k); setX(SCEN[k].start); }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              kind === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {SCEN[k].label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">{s.blurb}</p>
          <label class="block">
            <span class="mb-1 block text-muted">{s.xlabel} = {x.toFixed(2)}</span>
            <input
              type="range"
              min={s.domain[0]} max={s.domain[1]} step={0.05} value={x}
              onInput={(e) => setX(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted">{s.ylabel}</span>
              <div class="font-mono font-semibold">{s.f(x).toFixed(2)}</div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted">slope f′(x)</span>
              <div class="font-mono font-semibold" style={`color:${atOpt ? COLORS.opt : COLORS.tangent}`}>
                {slope.toFixed(2)}
              </div>
            </div>
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            {atOpt ? (
              <p>
                <strong style={`color:${COLORS.opt}`}>Maximum!</strong> The tangent is flat
                (f′(x) ≈ 0). The best choice is {s.xlabel.split(' ')[0]} = <strong>{s.optX}</strong>.
              </p>
            ) : slope > 0 ? (
              <p>Slope is <strong>positive</strong> — pushing higher still increases the result. Keep going.</p>
            ) : (
              <p>Slope is <strong>negative</strong> — you have overshot. Back off toward the green line.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
