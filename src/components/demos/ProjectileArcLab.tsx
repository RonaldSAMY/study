import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Projectile motion under gravity.
   - Launch a projectile with an adjustable initial speed, launch angle
     and gravity. Each animation frame we integrate velocity (gravity
     pulls vy down) then position (p += v·dt), exactly like a game loop.
   - The traced arc, ground line and a faint predicted path are drawn on
     a crisp, responsive canvas. Live readouts show position/velocity/time.
   ------------------------------------------------------------------ */

const COLORS = {
  body: '#0ea5e9',
  arc: '#10b981',
  predict: 'rgba(79,70,229,0.45)',
  ground: 'rgba(128,128,128,0.6)',
  grid: 'rgba(128,128,128,0.16)',
};

const SIM_SPEED = 1.5; // speeds up the clock so flights feel snappy
const MARGIN = { l: 16, r: 16, t: 16, b: 22 };

type Pt = { x: number; y: number };

export default function ProjectileArcLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(18);
  const [angle, setAngle] = useState(55); // degrees
  const [gravity, setGravity] = useState(9.8);
  const [flying, setFlying] = useState(false);

  const posRef = useRef<Pt>({ x: 0, y: 0 });
  const velRef = useRef<Pt>({ x: 0, y: 0 });
  const tRef = useRef(0);
  const trailRef = useRef<Pt[]>([]);
  const rafRef = useRef<number>();
  const lastRef = useRef(0);
  // view: meters -> pixels
  const viewRef = useRef({ w: 480, h: 320, scale: 8 });
  const [readout, setReadout] = useState({ t: 0, x: 0, y: 0, vx: 0, vy: 0 });

  // ---- predicted trajectory (analytic) used to auto-fit the view ----
  const predict = () => {
    const rad = (angle * Math.PI) / 180;
    const vx0 = speed * Math.cos(rad);
    const vy0 = speed * Math.sin(rad);
    const g = Math.max(gravity, 0.5);
    const tFlight = (2 * vy0) / g;
    const range = vx0 * tFlight;
    const maxH = (vy0 * vy0) / (2 * g);
    return { vx0, vy0, g, tFlight, range, maxH };
  };

  const computeView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { range, maxH } = predict();
    const w = viewRef.current.w;
    const h = viewRef.current.h;
    const worldW = Math.max(range * 1.12, 4);
    const worldH = Math.max(maxH * 1.3, 4);
    const usableW = w - MARGIN.l - MARGIN.r;
    const usableH = h - MARGIN.t - MARGIN.b;
    const scale = Math.min(usableW / worldW, usableH / worldH);
    viewRef.current.scale = scale;
  };

  const toPx = (wx: number, wy: number): Pt => {
    const { h, scale } = viewRef.current;
    return { x: MARGIN.l + wx * scale, y: h - MARGIN.b - wy * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = viewRef.current;
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = MARGIN.l; gx < w; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, MARGIN.t); ctx.lineTo(gx, h - MARGIN.b); ctx.stroke();
    }
    for (let gy = h - MARGIN.b; gy > MARGIN.t; gy -= 40) {
      ctx.beginPath(); ctx.moveTo(MARGIN.l, gy); ctx.lineTo(w - MARGIN.r, gy); ctx.stroke();
    }

    // ground line
    const ground = toPx(0, 0).y;
    ctx.strokeStyle = COLORS.ground;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();

    // predicted path (dashed) — handy before launch
    const { vx0, vy0, g, tFlight } = predict();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.predict;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * tFlight;
      const x = vx0 * t;
      const y = vy0 * t - 0.5 * g * t * t;
      const p = toPx(x, Math.max(y, 0));
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // traced arc so far
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.strokeStyle = COLORS.arc;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      trail.forEach((p, i) => {
        const px = toPx(p.x, p.y);
        if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
    }

    // projectile body
    const cur = flying || trail.length ? posRef.current : { x: 0, y: 0 };
    const bp = toPx(cur.x, cur.y);
    ctx.fillStyle = COLORS.body;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bp.x, bp.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // velocity arrow on the body while flying
    if (flying) {
      const v = velRef.current;
      const len = Math.hypot(v.x, v.y) || 1;
      const ux = (v.x / len) * 34;
      const uy = (v.y / len) * 34;
      const tip = { x: bp.x + ux, y: bp.y - uy };
      ctx.strokeStyle = COLORS.body;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    }
  };

  // ---- launch / reset ----
  const launch = () => {
    const rad = (angle * Math.PI) / 180;
    posRef.current = { x: 0, y: 0 };
    velRef.current = { x: speed * Math.cos(rad), y: speed * Math.sin(rad) };
    tRef.current = 0;
    trailRef.current = [{ x: 0, y: 0 }];
    lastRef.current = 0;
    setReadout({ t: 0, x: 0, y: 0, vx: velRef.current.x, vy: velRef.current.y });
    setFlying(true);
  };

  const reset = () => {
    setFlying(false);
    posRef.current = { x: 0, y: 0 };
    velRef.current = { x: 0, y: 0 };
    tRef.current = 0;
    trailRef.current = [];
    setReadout({ t: 0, x: 0, y: 0, vx: 0, vy: 0 });
    computeView();
    draw();
  };

  // ---- animation loop ----
  useEffect(() => {
    if (!flying) return;
    const step = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.04, (ts - lastRef.current) / 1000) * SIM_SPEED;
      lastRef.current = ts;

      const g = Math.max(gravity, 0.5);
      const v = velRef.current;
      const p = posRef.current;
      // integrate velocity, then position (semi-implicit Euler)
      v.y -= g * dt;
      p.x += v.x * dt;
      p.y += v.y * dt;
      tRef.current += dt;

      if (p.y <= 0 && v.y < 0) {
        p.y = 0;
        trailRef.current.push({ x: p.x, y: 0 });
        setReadout({ t: tRef.current, x: p.x, y: 0, vx: v.x, vy: v.y });
        draw();
        setFlying(false);
        return;
      }
      trailRef.current.push({ x: p.x, y: p.y });
      setReadout({ t: tRef.current, x: p.x, y: p.y, vx: v.x, vy: v.y });
      draw();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = 0; };
  }, [flying, gravity]);

  // recompute the view whenever the parameters change (while idle)
  useEffect(() => {
    if (!flying) { computeView(); draw(); }
  }, [speed, angle, gravity]);

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewRef.current.w = w;
      viewRef.current.h = h;
      computeView();
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const speedNow = Math.hypot(readout.vx, readout.vy);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={launch}
          disabled={flying}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          🚀 Launch
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Reset
        </button>
        <span class="ml-auto text-xs text-muted">{flying ? 'in flight…' : 'ready'}</span>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">speed v₀ = {speed.toFixed(0)} m/s</span>
          <input type="range" min={6} max={26} step={1} value={speed}
            onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">angle θ = {angle.toFixed(0)}°</span>
          <input type="range" min={10} max={80} step={1} value={angle}
            onInput={(e) => setAngle(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">gravity g = {gravity.toFixed(1)} m/s²</span>
          <input type="range" min={2} max={20} step={0.2} value={gravity}
            onInput={(e) => setGravity(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]" />
        </label>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="time t" value={`${readout.t.toFixed(2)} s`} />
        <Readout label="position" value={`(${readout.x.toFixed(1)}, ${readout.y.toFixed(1)})`} color={COLORS.arc} />
        <Readout label="velocity" value={`(${readout.vx.toFixed(1)}, ${readout.vy.toFixed(1)})`} color={COLORS.body} />
        <Readout label="speed" value={`${speedNow.toFixed(1)} m/s`} />
      </div>
      <p class="mt-3 text-xs text-muted">
        The dashed indigo curve is the predicted path; the green trail is what the per-frame integrator actually traced.
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
