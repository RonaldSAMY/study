import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Parametric & polar curve tracer.
   - Pick a curve: Circle, Lissajous (parametric) or Spiral, Rose (polar).
   - Play/Pause animates the parameter t (or angle θ); a slider scrubs it.
   - The full path is drawn faintly, a growing trail follows the point,
     and a bright dot marks the current (x, y). Live t / (x,y) / (r,θ) readout.
   - Animation uses requestAnimationFrame and is cleaned up on unmount.
   ------------------------------------------------------------------ */

type CurveId = 'circle' | 'lissajous' | 'spiral' | 'rose';
type Pt = { x: number; y: number };

const COLORS = {
  curve: '#10b981',       // emerald — faint full path & trail
  dot: '#4f46e5',         // indigo — moving point
  radial: '#0ea5e9',      // sky — radius line for polar curves
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// t runs 0..TMAX; each curve interprets it as time or angle.
const TMAX = Math.PI * 2;

type Curve = {
  label: string;
  polar: boolean;
  // returns the point in math coordinates for parameter value t
  pt: (t: number) => Pt;
  // for polar curves, the (r, θ) at t
  polarAt?: (t: number) => { r: number; theta: number };
};

const CURVES: Record<CurveId, Curve> = {
  circle: {
    label: 'Circle',
    polar: false,
    pt: (t) => ({ x: 2.6 * Math.cos(t), y: 2.6 * Math.sin(t) }),
  },
  lissajous: {
    label: 'Lissajous',
    polar: false,
    pt: (t) => ({ x: 3 * Math.sin(3 * t), y: 3 * Math.sin(2 * t) }),
  },
  spiral: {
    label: 'Spiral',
    polar: true,
    polarAt: (t) => ({ r: 0.45 * t, theta: t }),
    pt: (t) => {
      const r = 0.45 * t;
      return { x: r * Math.cos(t), y: r * Math.sin(t) };
    },
  },
  rose: {
    label: 'Rose',
    polar: true,
    polarAt: (t) => ({ r: 3 * Math.cos(3 * t), theta: t }),
    pt: (t) => {
      const r = 3 * Math.cos(3 * t);
      return { x: r * Math.cos(t), y: r * Math.sin(t) };
    },
  },
};

export default function ParametricTracer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [curveId, setCurveId] = useState<CurveId>('circle');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const sizeRef = useRef({ w: 480, h: 360, scale: 50, ox: 240, oy: 180 });

  const curve = CURVES[curveId];

  // keep a ref of t in sync so the rAF loop reads the latest value
  useEffect(() => { tRef.current = t; }, [t]);

  // ---- coordinate helper (math space -> pixels) ----
  const toPx = (p: Pt) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const c = CURVES[curveId];
    const tNow = tRef.current;

    // faint full path (the whole curve over 0..TMAX)
    ctx.strokeStyle = 'rgba(16,185,129,0.28)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const STEPS = 600;
    for (let i = 0; i <= STEPS; i++) {
      const tt = (i / STEPS) * TMAX;
      const p = toPx(c.pt(tt));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // bright growing trail (0..tNow)
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const trailSteps = Math.max(1, Math.round((tNow / TMAX) * STEPS));
    for (let i = 0; i <= trailSteps; i++) {
      const tt = (i / STEPS) * TMAX;
      const p = toPx(c.pt(tt));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    const cur = c.pt(tNow);
    const curPx = toPx(cur);

    // radius line for polar curves (origin -> point)
    if (c.polar) {
      ctx.strokeStyle = COLORS.radial;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(curPx.x, curPx.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // moving dot
    ctx.beginPath();
    ctx.arc(curPx.x, curPx.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.dot;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(28, Math.min(60, w / 9));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw whenever state changes
  useEffect(draw, [t, curveId]);

  // ---- animation loop (requestAnimationFrame, cleaned up on unmount) ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastRef.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastRef.current === null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      // advance ~0.9 rad/sec, wrap around at TMAX
      let next = tRef.current + dt * 0.9;
      if (next >= TMAX) next -= TMAX;
      tRef.current = next;
      setT(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [playing]);

  // cancel any pending frame on full unmount (belt & suspenders)
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---- live readout ----
  const cur = curve.pt(t);
  const polar = curve.polar && curve.polarAt ? curve.polarAt(t) : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(CURVES) as CurveId[]).map((id) => (
          <button
            key={id}
            onClick={() => { setCurveId(id); setT(0); tRef.current = 0; lastRef.current = null; }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              curveId === id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {CURVES[id].label}
            {CURVES[id].polar ? ' (polar)' : ''}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={() => { setT(0); tRef.current = 0; lastRef.current = null; }}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
            >
              ↺ Reset
            </button>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">
              parameter {curve.polar ? 'θ' : 't'} = {t.toFixed(2)}
            </span>
            <input
              type="range" min={0} max={TMAX} step={0.01} value={t}
              onInput={(e) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                setPlaying(false);
                setT(v);
                tRef.current = v;
                lastRef.current = null;
              }}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label={curve.polar ? 'θ' : 't'} value={t.toFixed(2)} />
            <Readout label="point (x, y)" value={`(${cur.x.toFixed(2)}, ${cur.y.toFixed(2)})`} />
            <Readout label="x" color={COLORS.curve} value={cur.x.toFixed(2)} />
            <Readout label="y" color={COLORS.curve} value={cur.y.toFixed(2)} />
          </div>

          {polar && (
            <div class="rounded-lg bg-surface-2 p-3">
              <div class="flex justify-between">
                <span class="text-muted">r (radius)</span>
                <strong style={`color:${COLORS.radial}`}>{polar.r.toFixed(2)}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">θ (angle)</span>
                <strong>{polar.theta.toFixed(2)} rad</strong>
              </div>
              <p class="mt-1 text-xs text-muted">
                Polar point: x = r·cos θ, y = r·sin θ.
              </p>
            </div>
          )}
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
