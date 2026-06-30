import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Three integrators racing on the SAME orbit.
   Central linear spring force  a = -k·r  (mass = 1) gives a perfect
   closed orbit in the exact solution, so total energy E should be
   constant. We integrate it three ways and watch what each does:
     - explicit (forward) Euler   -> gains energy, spirals OUTWARD
     - semi-implicit (symplectic) -> energy bounded, orbit stable
     - velocity Verlet            -> energy bounded, orbit stable
   A dt slider exaggerates the difference; bigger steps = more drift.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  euler: '#4f46e5',   // indigo  – explicit Euler (the unstable one)
  semi: '#0ea5e9',    // sky     – semi-implicit Euler
  verlet: '#10b981',  // emerald – velocity Verlet
  ref: 'rgba(128,128,128,0.45)',
  bg: 'rgba(128,128,128,0.16)',
};

const K = 1;            // spring constant
const R = 2.3;          // initial radius
const V0 = Math.sqrt(K) * R;   // speed for a circular orbit (v^2 = k R^2)
const E0 = 0.5 * V0 * V0 + 0.5 * K * R * R;   // initial total energy
const TRAIL_MAX = 900;

type Body = { p: Vec; v: Vec };

function freshBodies() {
  const mk = (): Body => ({ p: { x: R, y: 0 }, v: { x: 0, y: V0 } });
  return { euler: mk(), semi: mk(), verlet: mk() };
}

const accel = (p: Vec): Vec => ({ x: -K * p.x, y: -K * p.y });
const energy = (b: Body) =>
  0.5 * (b.v.x * b.v.x + b.v.y * b.v.y) + 0.5 * K * (b.p.x * b.p.x + b.p.y * b.p.y);

// one step of each integrator (in place)
function stepEuler(b: Body, dt: number) {
  const a = accel(b.p);
  // forward Euler: update position with OLD velocity, then velocity
  const px = b.p.x + b.v.x * dt;
  const py = b.p.y + b.v.y * dt;
  b.v.x += a.x * dt;
  b.v.y += a.y * dt;
  b.p.x = px;
  b.p.y = py;
}
function stepSemi(b: Body, dt: number) {
  // symplectic Euler: update velocity first, then position with NEW velocity
  const a = accel(b.p);
  b.v.x += a.x * dt;
  b.v.y += a.y * dt;
  b.p.x += b.v.x * dt;
  b.p.y += b.v.y * dt;
}
function stepVerlet(b: Body, dt: number) {
  const a = accel(b.p);
  b.p.x += b.v.x * dt + 0.5 * a.x * dt * dt;
  b.p.y += b.v.y * dt + 0.5 * a.y * dt * dt;
  const a2 = accel(b.p);
  b.v.x += 0.5 * (a.x + a2.x) * dt;
  b.v.y += 0.5 * (a.y + a2.y) * dt;
}

export default function IntegratorDriftLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [dt, setDt] = useState(0.08);
  const [ratios, setRatios] = useState({ euler: 1, semi: 1, verlet: 1 });

  const bodiesRef = useRef(freshBodies());
  const trailsRef = useRef<{ euler: Vec[]; semi: Vec[]; verlet: Vec[] }>({
    euler: [], semi: [], verlet: [],
  });
  const dtRef = useRef(dt);
  const playRef = useRef(playing);
  const rafRef = useRef<number>();
  const frameRef = useRef(0);
  const sizeRef = useRef({ w: 480, h: 360, scale: 40, ox: 240, oy: 180 });

  dtRef.current = dt;
  playRef.current = playing;

  const reset = () => {
    bodiesRef.current = freshBodies();
    trailsRef.current = { euler: [], semi: [], verlet: [] };
    frameRef.current = 0;
    setRatios({ euler: 1, semi: 1, verlet: 1 });
    draw();
  };

  const toPx = (v: Vec): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };

  const drawTrail = (ctx: CanvasRenderingContext2D, pts: Vec[], color: string) => {
    if (pts.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const q = toPx(pts[i]);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  };

  const dot = (ctx: CanvasRenderingContext2D, v: Vec, color: string) => {
    const q = toPx(v);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // faint background + ideal orbit (radius R) + central mass
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.ref;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(ox, oy, R * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ref; ctx.fill();

    const t = trailsRef.current;
    drawTrail(ctx, t.euler, COLORS.euler);
    drawTrail(ctx, t.semi, COLORS.semi);
    drawTrail(ctx, t.verlet, COLORS.verlet);

    const b = bodiesRef.current;
    dot(ctx, b.verlet.p, COLORS.verlet);
    dot(ctx, b.semi.p, COLORS.semi);
    dot(ctx, b.euler.p, COLORS.euler);
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.82);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.min(w, h) / (2 * R * 1.9);
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- animation loop (raf paired with cancelAnimationFrame) ----
  useEffect(() => {
    const loop = () => {
      if (playRef.current) {
        const step = dtRef.current;
        const b = bodiesRef.current;
        const tr = trailsRef.current;
        stepEuler(b.euler, step);
        stepSemi(b.semi, step);
        stepVerlet(b.verlet, step);
        tr.euler.push({ ...b.euler.p });
        tr.semi.push({ ...b.semi.p });
        tr.verlet.push({ ...b.verlet.p });
        if (tr.euler.length > TRAIL_MAX) tr.euler.shift();
        if (tr.semi.length > TRAIL_MAX) tr.semi.shift();
        if (tr.verlet.length > TRAIL_MAX) tr.verlet.shift();
        frameRef.current++;
        if (frameRef.current % 4 === 0) {
          setRatios({
            euler: energy(b.euler) / E0,
            semi: energy(b.semi) / E0,
            verlet: energy(b.verlet) / E0,
          });
        }
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Reset
        </button>
        <span class="ml-auto text-xs text-muted">energy should stay 100%</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Same start, same force — only the update rule differs. The dashed grey circle is the ideal orbit.
          </p>
          <div class="grid grid-cols-1 gap-2">
            <Readout label="Explicit Euler" color={COLORS.euler} value={pct(ratios.euler)} />
            <Readout label="Semi-implicit Euler" color={COLORS.semi} value={pct(ratios.semi)} />
            <Readout label="Velocity Verlet" color={COLORS.verlet} value={pct(ratios.verlet)} />
          </div>
          <label class="block">
            <span class="mb-1 block text-muted">timestep dt = {dt.toFixed(3)}</span>
            <input
              type="range" min={0.01} max={0.2} step={0.005} value={dt}
              onInput={(e) => { setDt(parseFloat((e.target as HTMLInputElement).value)); }}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <p class="text-xs text-muted">
            Crank dt up: indigo (explicit Euler) balloons past 100% and spirals out, while sky and emerald
            hug the ideal orbit. Hit Reset after changing dt for a clean race.
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="flex items-center gap-2">
        <span class="inline-block h-3 w-3 rounded-full" style={color ? `background:${color}` : ''} />
        <span class="text-muted">{label}</span>
      </span>
      <span class="font-mono font-semibold">{value}</span>
    </div>
  );
}
