import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Capstone: train a linear regression by gradient descent.
   - Drag the data points (delivery time vs. distance, say).
   - Press Train: the line y = w·x + b is fit by descending the
     mean-squared-error loss. Watch the line snap to the cloud and the
     loss fall step by step.
   - Ties together: vectors (the points), gradients (the update),
     probability (MSE = negative log-likelihood under Gaussian noise),
     and regression (the model itself).
   ------------------------------------------------------------------ */

const COLORS = {
  point: '#4f46e5',
  line: '#10b981',
  resid: 'rgba(245,158,11,0.7)',
  loss: '#0ea5e9',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

type P = { x: number; y: number };

const INIT: P[] = [
  { x: 1, y: 2.2 }, { x: 2, y: 2.6 }, { x: 3, y: 4.1 }, { x: 4, y: 4.0 },
  { x: 5, y: 5.6 }, { x: 6, y: 6.1 }, { x: 7, y: 6.4 }, { x: 8, y: 8.2 },
];

const RANGE = 10;

export default function RegressionTrainerCapstone() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<P[]>(INIT);
  const [w, setW] = useState(0);
  const [b, setB] = useState(8);
  const [history, setHistory] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const dragRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const wbRef = useRef({ w: 0, b: 8 });
  const sizeRef = useRef({ w: 420, h: 360, s: 34, ox: 34, oy: 326 });

  const lr = 0.012;

  const mse = (W: number, Bb: number) => {
    let s = 0;
    for (const p of pts) { const e = W * p.x + Bb - p.y; s += e * e; }
    return s / pts.length;
  };

  const toPx = (x: number, y: number) => {
    const { s, ox, oy } = sizeRef.current;
    return { x: ox + x * s, y: oy - y * s };
  };
  const toMath = (cx: number, cy: number) => {
    const { s, ox, oy } = sizeRef.current;
    return { x: (cx - ox) / s, y: (oy - cy) / s };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: cw, h } = sizeRef.current;
    ctx.clearRect(0, 0, cw, h);

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= RANGE; i++) {
      const v = toPx(i, 0);
      ctx.beginPath(); ctx.moveTo(v.x, toPx(0, 0).y); ctx.lineTo(v.x, toPx(0, RANGE).y); ctx.stroke();
      const hp = toPx(0, i);
      ctx.beginPath(); ctx.moveTo(toPx(0, 0).x, hp.y); ctx.lineTo(toPx(RANGE, 0).x, hp.y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    const o = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(toPx(RANGE, 0).x, o.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, toPx(0, RANGE).y); ctx.stroke();

    // residuals
    ctx.strokeStyle = COLORS.resid; ctx.lineWidth = 1.5;
    for (const p of pts) {
      const yhat = w * p.x + b;
      const a = toPx(p.x, p.y); const c = toPx(p.x, yhat);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }

    // regression line
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 3;
    const l0 = toPx(0, b), l1 = toPx(RANGE, w * RANGE + b);
    ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();

    // points
    for (const p of pts) {
      const a = toPx(p.x, p.y);
      ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.point; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cw = Math.min(parent.clientWidth, 440);
      const h = Math.round(cw * 0.86);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cw * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 32;
      const s = (cw - pad - 12) / RANGE;
      sizeRef.current = { w: cw, h, s, ox: pad, oy: h - pad };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [pts, w, b]);

  const train = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    wbRef.current = { w, b };
    setHistory([mse(w, b)]);
    setRunning(true);
    let steps = 0;
    const tick = () => {
      // a few gradient steps per frame for smooth, fast convergence
      for (let k = 0; k < 3; k++) {
        let gw = 0, gb = 0;
        const { w: W, b: Bb } = wbRef.current;
        for (const p of pts) { const e = W * p.x + Bb - p.y; gw += e * p.x; gb += e; }
        gw = (2 / pts.length) * gw; gb = (2 / pts.length) * gb;
        wbRef.current = { w: W - lr * gw, b: Bb - lr * gb };
        steps++;
      }
      setW(wbRef.current.w); setB(wbRef.current.b);
      setHistory((h) => [...h.slice(-119), mse(wbRef.current.w, wbRef.current.b)]);
      if (steps < 300) rafRef.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setW(0); setB(8); setHistory([]);
    wbRef.current = { w: 0, b: 8 };
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // dragging points
  const onDown = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    let hit: number | null = null, bestd = 16;
    pts.forEach((p, i) => {
      const a = toPx(p.x, p.y);
      const d = Math.hypot(a.x - cx, a.y - cy);
      if (d < bestd) { bestd = d; hit = i; }
    });
    if (hit !== null) {
      dragRef.current = hit;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const m = toMath(e.clientX - rect.left, e.clientY - rect.top);
    const i = dragRef.current;
    setPts((arr) => arr.map((p, j) => (j === i
      ? { x: Math.max(0, Math.min(RANGE, m.x)), y: Math.max(0, Math.min(RANGE, m.y)) }
      : p)));
  };
  const onUp = () => { dragRef.current = null; };

  const curLoss = mse(w, b);
  const loss0 = history.length ? history[0] : curLoss;
  const maxL = Math.max(...history, curLoss, 0.001);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag any blue point to change the data, then train the line to fit it.</p>
          <div class="flex gap-2">
            <button onClick={train} disabled={running}
              class="flex-1 rounded-lg bg-brand px-3 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {running ? 'Training…' : '▶ Train'}
            </button>
            <button onClick={reset}
              class="rounded-lg bg-surface-2 px-3 py-2 font-semibold text-muted transition hover:text-text">
              Reset
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="slope w" value={w.toFixed(3)} />
            <Readout label="intercept b" value={b.toFixed(3)} />
            <Readout label="loss (MSE)" value={curLoss.toFixed(3)} />
            <Readout label="start loss" value={loss0.toFixed(3)} />
          </div>

          {/* loss curve sparkline */}
          <div class="rounded-lg bg-surface-2 p-3">
            <p class="mb-1 text-xs text-muted">Loss falling over steps</p>
            <svg viewBox="0 0 120 40" class="h-12 w-full" preserveAspectRatio="none">
              {history.length > 1 && (
                <polyline
                  fill="none" stroke={COLORS.loss} stroke-width="2"
                  points={history.map((L, i) => `${(i / (history.length - 1)) * 120},${40 - (L / maxL) * 38}`).join(' ')}
                />
              )}
            </svg>
          </div>

          <p class="text-xs text-muted">
            Update: <span class="font-mono">w ← w − η·∂L/∂w</span>, same for b. Minimizing MSE is the same as
            maximizing the Gaussian likelihood of the data.
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
