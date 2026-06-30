import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Monte Carlo estimator: estimate pi by throwing random darts into a
   unit square and counting how many land inside the quarter circle.
   - Press Run to stream samples; the estimate and error update live.
   - The error shrinks roughly like 1/sqrt(N) (law of large numbers).
   ------------------------------------------------------------------ */

const COLORS = {
  inside: '#10b981',
  outside: '#0ea5e9',
  circle: '#4f46e5',
  grid: 'rgba(128,128,128,0.25)',
};

type Pt = { x: number; y: number; inside: boolean };

export default function MonteCarloPiEstimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ptsRef = useRef<Pt[]>([]);
  const drawnRef = useRef(0); // how many points already painted
  const insideRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const sizeRef = useRef({ side: 340, pad: 16 });

  const [running, setRunning] = useState(false);
  const [inside, setInside] = useState(0);
  const [total, setTotal] = useState(0);

  const MAX = 30000;
  const BATCH = 220;

  const estimate = total ? (4 * inside) / total : 0;
  const error = total ? Math.abs(estimate - Math.PI) : 0;

  // ---- map math [0,1] -> pixels ----
  const px = (x: number) => sizeRef.current.pad + x * sizeRef.current.side;
  const py = (y: number) => sizeRef.current.pad + (1 - y) * sizeRef.current.side;

  const drawBase = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { side, pad } = sizeRef.current;
    ctx.clearRect(0, 0, pad * 2 + side, pad * 2 + side);

    // bounding square
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, side, side);

    // quarter circle (radius 1 centred at bottom-left corner)
    ctx.strokeStyle = COLORS.circle;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px(0), py(0), side, -Math.PI / 2, 0);
    ctx.stroke();
  };

  const paintPoint = (ctx: CanvasRenderingContext2D, p: Pt) => {
    ctx.fillStyle = p.inside ? COLORS.inside : COLORS.outside;
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.y), 1.6, 0, Math.PI * 2);
    ctx.fill();
  };

  const repaintAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawBase();
    for (const p of ptsRef.current) paintPoint(ctx, p);
    drawnRef.current = ptsRef.current.length;
  };

  const step = () => {
    if (!runningRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      let added = 0;
      for (let i = 0; i < BATCH && ptsRef.current.length < MAX; i++) {
        const x = Math.random();
        const y = Math.random();
        const isIn = x * x + y * y <= 1;
        const p: Pt = { x, y, inside: isIn };
        ptsRef.current.push(p);
        if (isIn) insideRef.current++;
        paintPoint(ctx, p);
        added++;
      }
      drawnRef.current = ptsRef.current.length;
      if (added > 0) {
        setInside(insideRef.current);
        setTotal(ptsRef.current.length);
      }
    }
    if (ptsRef.current.length >= MAX) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    rafRef.current = requestAnimationFrame(step);
  };

  const toggleRun = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    if (next) rafRef.current = requestAnimationFrame(step);
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    ptsRef.current = [];
    insideRef.current = 0;
    drawnRef.current = 0;
    setInside(0);
    setTotal(0);
    repaintAll();
  };

  const addOnce = (n: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    for (let i = 0; i < n && ptsRef.current.length < MAX; i++) {
      const x = Math.random();
      const y = Math.random();
      const isIn = x * x + y * y <= 1;
      const p: Pt = { x, y, inside: isIn };
      ptsRef.current.push(p);
      if (isIn) insideRef.current++;
      paintPoint(ctx, p);
    }
    setInside(insideRef.current);
    setTotal(ptsRef.current.length);
  };

  // ---- responsive canvas ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const pad = 16;
      const side = Math.max(220, Math.min(parent.clientWidth - pad * 2, 380));
      const full = side + pad * 2;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = full * dpr;
      canvas.height = full * dpr;
      canvas.style.width = `${full}px`;
      canvas.style.height = `${full}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { side, pad };
      repaintAll();
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
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={toggleRun}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            running ? 'bg-brand text-white' : 'bg-brand text-white hover:opacity-90'
          }`}
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={() => addOnce(100)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          +100
        </button>
        <button
          onClick={() => addOnce(2000)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          +2000
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Each dot is a random point in the square. Green dots fell inside the quarter
            circle; the fraction that did, times 4, estimates <strong>π</strong>.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <Stat label="samples N" value={total.toLocaleString()} />
            <Stat label="inside" value={inside.toLocaleString()} />
            <Stat label="estimate of π" value={total ? estimate.toFixed(4) : '—'} color={COLORS.inside} />
            <Stat label="absolute error" value={total ? error.toFixed(4) : '—'} color={COLORS.outside} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            True value: π = 3.14159… Watch the error drift down as N grows — but slowly. To
            halve the error you need roughly <strong>four times</strong> as many samples.
          </div>
        </div>
      </div>
    </div>
  );
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
