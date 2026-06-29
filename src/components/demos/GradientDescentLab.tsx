import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Gradient Descent lab.
   - A 1-D cost curve C(x) = a·x²  (a smooth "energy bowl").
   - Pick a learning rate and number of steps, then Run.
   - Watch the ball roll downhill toward the minimum — or bounce out
     and DIVERGE when the learning rate is too big.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#4f46e5',
  ball: '#10b981',
  path: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// Cost function: a gentle bowl.  C(x) = a x²  ⇒  C'(x) = 2a x
const A = 0.18;
const cost = (x: number) => A * x * x;
const grad = (x: number) => 2 * A * x;

export default function GradientDescentLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lr, setLr] = useState(0.4);
  const [steps, setSteps] = useState(12);
  const [start, setStart] = useState(-5.5);
  const [shown, setShown] = useState(0); // how many steps to reveal
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 340, sx: 36, sy: 18, ox: 240, oy: 300 });

  // Build the full trajectory from the current settings.
  const path: number[] = [start];
  for (let i = 0; i < steps; i++) {
    const xPrev = path[path.length - 1];
    const xNext = xPrev - lr * grad(xPrev);
    path.push(xNext);
  }
  const diverged = path.some((x) => !isFinite(x) || Math.abs(x) > 200);

  const toPx = (x: number, y: number) => {
    const { sx, sy, ox, oy } = sizeRef.current;
    return { x: ox + x * sx, y: oy - y * sy };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, sx, ox } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % sx; gx < w; gx += sx) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    // axis (x)
    const base = toPx(0, 0);
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, base.y); ctx.lineTo(w, base.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(base.x, 0); ctx.lineTo(base.x, h); ctx.stroke();

    // cost curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const xMax = (w - ox) / sx;
    let first = true;
    for (let px = 0; px <= w; px += 2) {
      const x = (px - ox) / sx;
      const p = toPx(x, cost(x));
      if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // minimum marker
    const minP = toPx(0, 0);
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('minimum', minP.x + 8, minP.y - 6);

    // descent path up to `shown`
    const reveal = Math.min(shown, path.length - 1);
    ctx.strokeStyle = COLORS.path;
    ctx.fillStyle = COLORS.path;
    ctx.lineWidth = 2;
    for (let i = 0; i <= reveal; i++) {
      const x = path[i];
      if (!isFinite(x) || Math.abs(x) > xMax * 1.5) continue;
      const p = toPx(x, cost(x));
      // drop line to curve
      if (i > 0) {
        const xp = path[i - 1];
        if (isFinite(xp) && Math.abs(xp) < xMax * 1.5) {
          const pp = toPx(xp, cost(xp));
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // the ball (current position)
    const cx = path[reveal];
    if (isFinite(cx) && Math.abs(cx) < xMax * 1.5) {
      const bp = toPx(cx, cost(cx));
      ctx.beginPath(); ctx.arc(bp.x, bp.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ball; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.68);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = w / 14; // x range ~ ±7
      const sy = h / 9;  // y range 0..~9
      sizeRef.current = { w, h, sx, sy, ox: w / 2, oy: h - 28 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [shown, lr, steps, start]);

  // animate reveal
  const run = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setShown(0);
    let i = 0;
    let last = performance.now();
    const tick = (t: number) => {
      if (t - last > 180) { i += 1; setShown(i); last = t; }
      if (i < steps) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const reveal = Math.min(shown, path.length - 1);
  const curX = path[reveal];
  const curCost = isFinite(curX) ? cost(curX) : Infinity;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">learning rate η = {lr.toFixed(2)}</span>
            <input type="range" min={0.05} max={3} step={0.05} value={lr}
              onInput={(e) => { setLr(parseFloat((e.target as HTMLInputElement).value)); setShown(steps); }}
              class="w-full accent-[#10b981]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">steps = {steps}</span>
            <input type="range" min={1} max={30} step={1} value={steps}
              onInput={(e) => { setSteps(parseInt((e.target as HTMLInputElement).value)); setShown(parseInt((e.target as HTMLInputElement).value)); }}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">start x₀ = {start.toFixed(1)}</span>
            <input type="range" min={-6.5} max={6.5} step={0.5} value={start}
              onInput={(e) => { setStart(parseFloat((e.target as HTMLInputElement).value)); setShown(steps); }}
              class="w-full accent-[#4f46e5]" />
          </label>

          <button onClick={run}
            class="w-full rounded-lg bg-brand px-3 py-2 font-semibold text-white transition hover:opacity-90">
            ▶ Run descent
          </button>

          <div class="rounded-lg bg-surface-2 p-3">
            {diverged ? (
              <p class="font-semibold text-geometry">⚠️ Diverged! η is too big — each step overshoots and the cost explodes.</p>
            ) : (
              <>
                <div class="flex justify-between"><span class="text-muted">current x</span><strong>{isFinite(curX) ? curX.toFixed(3) : '∞'}</strong></div>
                <div class="flex justify-between"><span class="text-muted">cost C(x)</span><strong>{isFinite(curCost) ? curCost.toFixed(3) : '∞'}</strong></div>
                <p class="mt-1 text-xs text-muted">Update rule: x ← x − η · C′(x)</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
