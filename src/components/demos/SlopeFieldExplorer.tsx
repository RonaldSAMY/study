import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Slope-field explorer for a first-order ODE  dy/dx = f(x, y).
   - Pick an equation; the field of tiny tangent segments redraws.
   - Drag the emerald dot (the initial condition) and the matching
     solution curve is traced forward and backward by RK4.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  field: 'rgba(79,70,229,0.55)', // indigo
  curve: '#10b981',              // emerald
  point: '#0ea5e9',             // sky
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

type Eq = { key: string; label: string; f: (x: number, y: number) => number };

const EQUATIONS: Eq[] = [
  { key: 'grow', label: "y' = 0.5·y", f: (_x, y) => 0.5 * y },
  { key: 'decay', label: "y' = −y", f: (_x, y) => -y },
  { key: 'mix', label: "y' = x − y", f: (x, y) => x - y },
  { key: 'logistic', label: "y' = y(1 − y/3)", f: (_x, y) => y * (1 - y / 3) },
];

const X_MIN = -6, X_MAX = 6, Y_MIN = -4, Y_MAX = 4;

export default function SlopeFieldExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [eqKey, setEqKey] = useState('mix');
  const [ic, setIc] = useState<Vec>({ x: -3, y: 2 });
  const dragRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 320 });

  const eq = EQUATIONS.find((e) => e.key === eqKey)!;

  const toPx = (p: Vec): Vec => {
    const { w, h } = sizeRef.current;
    return {
      x: ((p.x - X_MIN) / (X_MAX - X_MIN)) * w,
      y: h - ((p.y - Y_MIN) / (Y_MAX - Y_MIN)) * h,
    };
  };
  const toMath = (px: number, py: number): Vec => {
    const { w, h } = sizeRef.current;
    return {
      x: X_MIN + (px / w) * (X_MAX - X_MIN),
      y: Y_MIN + ((h - py) / h) * (Y_MAX - Y_MIN),
    };
  };

  // RK4-trace a solution through the initial condition, both directions,
  // returned as one connected polyline: [..backward(reversed), start, ..forward].
  const trace = (f: (x: number, y: number) => number, start: Vec): Vec[] => {
    const h = 0.04;
    const steps = 400;
    const branch = (dir: 1 | -1): Vec[] => {
      let x = start.x, y = start.y;
      const out: Vec[] = [];
      for (let i = 0; i < steps; i++) {
        const dx = dir * h;
        const k1 = f(x, y);
        const k2 = f(x + dx / 2, y + (dx / 2) * k1);
        const k3 = f(x + dx / 2, y + (dx / 2) * k2);
        const k4 = f(x + dx, y + dx * k3);
        y += (dx / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        x += dx;
        if (!isFinite(y) || y < Y_MIN - 4 || y > Y_MAX + 4 || x < X_MIN - 1 || x > X_MAX + 1) break;
        out.push({ x, y });
      }
      return out;
    };
    const back = branch(-1).reverse();
    const fwd = branch(1);
    return [...back, start, ...fwd];
  };

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
    for (let gx = Math.ceil(X_MIN); gx <= X_MAX; gx++) {
      const p = toPx({ x: gx, y: 0 });
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
    }
    for (let gy = Math.ceil(Y_MIN); gy <= Y_MAX; gy++) {
      const p = toPx({ x: 0, y: gy });
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.4;
    const o = toPx({ x: 0, y: 0 });
    ctx.beginPath(); ctx.moveTo(0, o.y); ctx.lineTo(w, o.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h); ctx.stroke();

    // slope field
    ctx.strokeStyle = COLORS.field;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    const seg = 9; // half-length in px
    for (let gx = X_MIN + 0.5; gx <= X_MAX; gx += 0.75) {
      for (let gy = Y_MIN + 0.5; gy <= Y_MAX; gy += 0.6) {
        const slope = eq.f(gx, gy);
        const ang = Math.atan(slope * ((Y_MAX - Y_MIN) / (X_MAX - X_MIN)) * (w / h));
        const c = toPx({ x: gx, y: gy });
        const dx = seg * Math.cos(ang), dy = seg * Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(c.x - dx, c.y + dy);
        ctx.lineTo(c.x + dx, c.y - dy);
        ctx.stroke();
      }
    }

    // solution curve
    const curve = trace(eq.f, ic);
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.beginPath();
    curve.forEach((p, i) => {
      const px = toPx(p);
      if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();

    // initial-condition handle
    const hp = toPx(ic);
    ctx.beginPath(); ctx.arc(hp.x, hp.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.point; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.round(w * 0.66);
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

  useEffect(draw, [eqKey, ic]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const hp = toPx(ic);
    if (Math.hypot(hp.x - px, hp.y - py) < 26) {
      dragRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    setIc({
      x: Math.max(X_MIN, Math.min(X_MAX, Math.round(m.x * 2) / 2)),
      y: Math.max(Y_MIN, Math.min(Y_MAX, Math.round(m.y * 2) / 2)),
    });
  };
  const onUp = () => { dragRef.current = false; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {EQUATIONS.map((e) => (
          <button
            key={e.key}
            onClick={() => setEqKey(e.key)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              eqKey === e.key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div class="space-y-3 text-sm md:w-44">
          <p class="text-muted">Drag the sky dot to set the starting point. The emerald curve follows the arrows.</p>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">start x₀</span><strong class="font-mono">{ic.x.toFixed(1)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">start y₀</span><strong class="font-mono">{ic.y.toFixed(1)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">slope here</span><strong class="font-mono">{eq.f(ic.x, ic.y).toFixed(2)}</strong></div>
          </div>
          <p class="text-xs text-muted">Each little segment shows the slope the solution must have if it passes through that point.</p>
        </div>
      </div>
    </div>
  );
}
