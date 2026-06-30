import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Big-O growth plotter.
   - Slide the input size n (or click on the chart) and watch how many
     operations each complexity class needs.
   - Toggle curves on/off, and switch between linear and log scale so
     the slow-growing curves stay visible next to O(n^2).
   - A dashed "frame budget" line shows roughly how much work fits in
     one 60fps frame (16.7 ms) — cross it and the game drops frames.
   ------------------------------------------------------------------ */

type Key = 'o1' | 'on' | 'onlogn' | 'on2';

const COLORS = {
  o1: '#10b981',
  on: '#0ea5e9',
  onlogn: '#4f46e5',
  on2: '#ef4444',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  budget: 'rgba(128,128,128,0.65)',
};

const CURVES: { key: Key; label: string; f: (n: number) => number; color: string }[] = [
  { key: 'o1', label: 'O(1)', f: () => 1, color: COLORS.o1 },
  { key: 'on', label: 'O(n)', f: (n) => n, color: COLORS.on },
  { key: 'onlogn', label: 'O(n log n)', f: (n) => n * Math.log2(Math.max(2, n)), color: COLORS.onlogn },
  { key: 'on2', label: 'O(n²)', f: (n) => n * n, color: COLORS.on2 },
];

const N_MAX = 64;
// Rough "operations a simple per-frame task can afford" — purely illustrative.
const FRAME_BUDGET = 2000;

export default function BigOGrowthPlot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [n, setN] = useState(16);
  const [logScale, setLogScale] = useState(true);
  const [on, setOn] = useState<Record<Key, boolean>>({ o1: true, on: true, onlogn: true, on2: true });
  const sizeRef = useRef({ w: 480, h: 320, padL: 44, padB: 28, padT: 12, padR: 12 });

  const yMaxLinear = N_MAX * N_MAX; // dominated by O(n^2)

  const toX = (x: number) => {
    const { w, padL, padR } = sizeRef.current;
    return padL + ((x - 1) / (N_MAX - 1)) * (w - padL - padR);
  };
  const toY = (ops: number) => {
    const { h, padT, padB } = sizeRef.current;
    const plotH = h - padT - padB;
    const norm = logScale
      ? Math.log10(ops + 1) / Math.log10(yMaxLinear + 1)
      : ops / yMaxLinear;
    return padT + plotH * (1 - Math.min(1, norm));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padL, padB, padT, padR } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const gx = padL + (i / 8) * (w - padL - padR);
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, h - padB); ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const gy = padT + (i / 5) * (h - padT - padB);
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
    }

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('ops', padL - 30, padT + 8);
    ctx.fillText('input size n', w - padR - 78, h - padB + 18);

    // frame-budget line
    if (FRAME_BUDGET <= yMaxLinear) {
      const by = toY(FRAME_BUDGET);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = COLORS.budget;
      ctx.beginPath(); ctx.moveTo(padL, by); ctx.lineTo(w - padR, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.budget;
      ctx.fillText('frame budget', padL + 6, by - 4);
    }

    // curves
    for (const c of CURVES) {
      if (!on[c.key]) continue;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = 1; x <= N_MAX; x++) {
        const px = toX(x);
        const py = toY(c.f(x));
        if (x === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // dot at current n
      const dx = toX(n);
      const dy = toY(c.f(n));
      ctx.beginPath(); ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = c.color; ctx.fill();
    }

    // current-n marker
    const mx = toX(n);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(128,128,128,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, h - padB); ctx.stroke();
    ctx.setLineDash([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const hgt = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hgt * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hgt}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { ...sizeRef.current, w, h: hgt };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [n, logScale, on]);

  const onCanvasPointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const { w, padL, padR } = sizeRef.current;
    const frac = (px - padL) / (w - padL - padR);
    const nn = Math.round(1 + Math.max(0, Math.min(1, frac)) * (N_MAX - 1));
    setN(nn);
  };

  const fmt = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(v < 10 ? 1 : 0));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {CURVES.map((c) => (
          <button
            key={c.key}
            onClick={() => setOn((o) => ({ ...o, [c.key]: !o[c.key] }))}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              on[c.key] ? 'text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
            style={on[c.key] ? `background:${c.color}` : ''}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => setLogScale((s) => !s)}
          class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          {logScale ? 'log scale' : 'linear scale'}
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onCanvasPointer}
        />

        <div class="space-y-3 text-sm md:w-48">
          <label class="block">
            <span class="mb-1 block text-muted">input size n = {n}</span>
            <input
              type="range" min={1} max={N_MAX} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="grid grid-cols-1 gap-2">
            {CURVES.filter((c) => on[c.key]).map((c) => (
              <Readout key={c.key} label={c.label} color={c.color} value={`${fmt(c.f(n))} ops`} />
            ))}
          </div>
          <p class="text-xs text-muted">
            Tip: click the chart to jump n. Watch how O(n²) leaves the frame budget far behind.
          </p>
        </div>
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
