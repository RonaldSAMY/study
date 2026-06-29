import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Euler's method visualizer for  y' = f(x, y),  y(0) = y0.
   - A fine reference curve (the "true" solution) is drawn smoothly.
   - Euler's polyline marches with the chosen step size h; each vertex
     is a dot. Shrink h and the jagged guess hugs the true curve.
   ------------------------------------------------------------------ */

const COLORS = {
  truth: '#0ea5e9',   // sky — the real solution
  euler: '#4f46e5',   // indigo — Euler polyline
  dot: '#10b981',     // emerald — Euler steps
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

type Eq = { key: string; label: string; f: (x: number, y: number) => number; y0: number };

const EQUATIONS: Eq[] = [
  { key: 'grow', label: "y' = 0.6·y", f: (_x, y) => 0.6 * y, y0: 0.7 },
  { key: 'wave', label: "y' = cos(x)", f: (x) => Math.cos(x), y0: 0.5 },
  { key: 'log', label: "y' = y(1 − y/4)", f: (_x, y) => y * (1 - y / 4), y0: 0.4 },
];

const X_MIN = 0, X_MAX = 6, Y_MIN = -1.5, Y_MAX = 5.5;

export default function EulerStepExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [eqKey, setEqKey] = useState('grow');
  const [h, setH] = useState(1);
  const sizeRef = useRef({ w: 480, h: 320 });
  const eq = EQUATIONS.find((e) => e.key === eqKey)!;

  const toPx = (x: number, y: number) => {
    const { w, h: hh } = sizeRef.current;
    return {
      x: ((x - X_MIN) / (X_MAX - X_MIN)) * w,
      y: hh - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * hh,
    };
  };

  // fine RK4 reference
  const refSolution = (): { x: number; y: number }[] => {
    const pts = [{ x: X_MIN, y: eq.y0 }];
    const dt = 0.01; let x = X_MIN, y = eq.y0;
    while (x < X_MAX) {
      const k1 = eq.f(x, y);
      const k2 = eq.f(x + dt / 2, y + (dt / 2) * k1);
      const k3 = eq.f(x + dt / 2, y + (dt / 2) * k2);
      const k4 = eq.f(x + dt, y + dt * k3);
      y += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4); x += dt;
      pts.push({ x, y });
    }
    return pts;
  };

  // Euler polyline with step h
  const eulerSolution = (): { x: number; y: number }[] => {
    const pts = [{ x: X_MIN, y: eq.y0 }];
    let x = X_MIN, y = eq.y0;
    while (x < X_MAX - 1e-9) {
      const step = Math.min(h, X_MAX - x);
      y = y + step * eq.f(x, y);
      x = x + step;
      pts.push({ x, y });
    }
    return pts;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h: hh } = sizeRef.current;
    ctx.clearRect(0, 0, w, hh);

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = X_MIN; gx <= X_MAX; gx++) { const p = toPx(gx, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, hh); ctx.stroke(); }
    for (let gy = Math.ceil(Y_MIN); gy <= Y_MAX; gy++) { const p = toPx(0, gy); ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke(); }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.4;
    const o = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(0, o.y); ctx.lineTo(w, o.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, 0); ctx.lineTo(o.x, hh); ctx.stroke();

    // true solution
    const ref = refSolution();
    ctx.strokeStyle = COLORS.truth; ctx.lineWidth = 3;
    ctx.beginPath();
    ref.forEach((p, i) => { const q = toPx(p.x, p.y); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.stroke();

    // euler polyline
    const eul = eulerSolution();
    ctx.strokeStyle = COLORS.euler; ctx.lineWidth = 2.4;
    ctx.beginPath();
    eul.forEach((p, i) => { const q = toPx(p.x, p.y); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.stroke();
    // step dots
    eul.forEach((p) => {
      const q = toPx(p.x, p.y);
      ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.dot; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    });

    return { ref, eul };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const hh = Math.round(w * 0.64);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = hh * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${hh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hh };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [eqKey, h]);

  // final-point error
  const ref = refSolution();
  const eul = eulerSolution();
  const trueEnd = ref[ref.length - 1].y;
  const eulerEnd = eul[eul.length - 1].y;
  const err = Math.abs(trueEnd - eulerEnd);
  const steps = eul.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {EQUATIONS.map((e) => (
          <button
            key={e.key}
            onClick={() => setEqKey(e.key)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${eqKey === e.key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm md:w-48">
          <label class="block">
            <span class="mb-1 block text-muted">step size h = {h.toFixed(2)}</span>
            <input type="range" min={0.1} max={2} step={0.05} value={h}
              onInput={(e) => setH(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <div class="flex justify-between"><span class="text-muted">steps taken</span><strong class="font-mono">{steps}</strong></div>
            <div class="flex justify-between"><span class="text-muted">true y(6)</span><strong class="font-mono">{trueEnd.toFixed(3)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">Euler y(6)</span><strong class="font-mono">{eulerEnd.toFixed(3)}</strong></div>
            <div class="mt-1 flex justify-between border-t border-border pt-1"><span class="text-muted">final error</span><strong class="font-mono" style="color:#ef4444">{err.toFixed(3)}</strong></div>
          </div>
          <p class="text-xs text-muted">
            <span style="color:#0ea5e9">●</span> true curve &nbsp;
            <span style="color:#4f46e5">●</span> Euler. Halve h and the error roughly halves too.
          </p>
        </div>
      </div>
    </div>
  );
}
