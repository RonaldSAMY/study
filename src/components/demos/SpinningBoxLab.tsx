import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Off-center impulse -> translation AND rotation.
   - A rectangle floats in space. Drag from any point to fling an
     impulse J at that point. The lever arm r = (point - center)
     gives a torque  tau = r x J  (the 2D cross product r.x*J.y -
     r.y*J.x), so the box gains both linear velocity (J / m) and
     angular velocity (tau / I).
   - Box width/height set the moment of inertia I = m(w^2 + h^2)/12:
     a bigger, more spread-out box is harder to spin.
   Canvas conventions copied from VectorPlayground / DampedSpringLab.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  box: '#4f46e5',
  boxFill: 'rgba(79,70,229,0.18)',
  impulse: '#0ea5e9',
  marker: '#10b981',
  grid: 'rgba(128,128,128,0.14)',
  text: '#94a3b8',
};

const MASS = 1;
const STRENGTH = 2.2;          // drag pixels -> impulse magnitude
const LIN_DAMP = 0.6;          // gentle drag so it stays usable
const ANG_DAMP = 0.5;

export default function SpinningBoxLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bw, setBw] = useState(140);
  const [bh, setBh] = useState(90);
  const [lever, setLever] = useState(1);
  const [stats, setStats] = useState({ omega: 0, speed: 0 });

  // dynamic body state (mutated every frame -> kept in a ref)
  const body = useRef({ cx: 240, cy: 170, theta: 0, omega: 0, vx: 0, vy: 0 });
  const dimRef = useRef({ bw, bh });
  dimRef.current = { bw, bh };

  const dragRef = useRef<{ start: Vec; cur: Vec } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const sizeRef = useRef({ w: 480, h: 340 });

  const inertia = () => (MASS * (bw * bw + bh * bh)) / 12;

  // apply impulse J at world point p
  const applyImpulse = (p: Vec, J: Vec) => {
    const b = body.current;
    const I = (MASS * (dimRef.current.bw ** 2 + dimRef.current.bh ** 2)) / 12;
    const rx = p.x - b.cx;
    const ry = p.y - b.cy;
    b.vx += J.x / MASS;
    b.vy += J.y / MASS;
    b.omega += (rx * J.y - ry * J.x) / I; // tau = r x J, then /I
  };

  // button: fixed impulse at a corner, lever slider scales the arm
  const cornerImpulse = () => {
    const b = body.current;
    const { bw: w, bh: h } = dimRef.current;
    const ux = Math.cos(b.theta), uy = Math.sin(b.theta);      // local +x in world
    const px = -Math.sin(b.theta), py = Math.cos(b.theta);     // local +y in world
    const arm = lever * (w / 2);
    const point = { x: b.cx + ux * arm, y: b.cy + uy * arm };
    const mag = 260;
    applyImpulse(point, { x: px * mag, y: py * mag });
  };

  const reset = () => {
    const { w, h } = sizeRef.current;
    body.current = { cx: w / 2, cy: h / 2, theta: 0, omega: 0, vx: 0, vy: 0 };
    dragRef.current = null;
    setStats({ omega: 0, speed: 0 });
  };

  const step = (dt: number) => {
    const b = body.current;
    const { w, h } = sizeRef.current;
    b.cx += b.vx * dt;
    b.cy += b.vy * dt;
    b.theta += b.omega * dt;
    // mild damping
    const ld = Math.exp(-LIN_DAMP * dt);
    const ad = Math.exp(-ANG_DAMP * dt);
    b.vx *= ld; b.vy *= ld; b.omega *= ad;
    // wrap around the play field so it stays on screen
    if (b.cx < 0) b.cx += w; else if (b.cx > w) b.cx -= w;
    if (b.cy < 0) b.cy += h; else if (b.cy > h) b.cy -= h;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const b = body.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 40; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // the rotating box
    ctx.save();
    ctx.translate(b.cx, b.cy);
    ctx.rotate(b.theta);
    ctx.fillStyle = COLORS.boxFill;
    ctx.strokeStyle = COLORS.box;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(-bw / 2, -bh / 2, bw, bh);
    ctx.fill();
    ctx.stroke();
    // a corner marker so the spin is obvious
    ctx.fillStyle = COLORS.marker;
    ctx.beginPath();
    ctx.arc(bw / 2 - 10, -bh / 2 + 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // center of mass dot
    ctx.fillStyle = COLORS.box;
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // live drag arrow preview
    const d = dragRef.current;
    if (d) {
      arrow(ctx, d.start, d.cur, COLORS.impulse, 3);
      ctx.fillStyle = COLORS.impulse;
      ctx.beginPath();
      ctx.arc(d.start.x, d.start.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // hint text
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('drag from a point on the box to fling it', 12, h - 12);
  };

  // sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // recenter if uninitialized
      if (body.current.cx === 240 && body.current.cy === 170) {
        body.current.cx = w / 2; body.current.cy = h / 2;
      }
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // animation loop
  useEffect(() => {
    const loop = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      let dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      dt = Math.min(0.033, dt);
      if (!dragRef.current) step(dt); // freeze integration while aiming
      draw();
      const b = body.current;
      setStats({ omega: b.omega, speed: Math.hypot(b.vx, b.vy) });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, []);

  // pointer aiming
  const pointer = (e: PointerEvent): Vec => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const p = pointer(e);
    dragRef.current = { start: p, cur: p };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = { start: dragRef.current.start, cur: pointer(e) };
  };
  const onUp = () => {
    const d = dragRef.current;
    if (d) {
      const J = { x: (d.cur.x - d.start.x) * STRENGTH, y: (d.cur.y - d.start.y) * STRENGTH };
      if (Math.hypot(J.x, J.y) > 4) applyImpulse(d.start, J);
    }
    dragRef.current = null;
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={cornerImpulse}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          Hit a corner
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Drag from the <strong>edge</strong> of the box: the same flick through the center just
            slides it, but off to one side it both slides <em>and</em> spins. That extra spin is the
            torque from the lever arm.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">box width = {bw}</span>
            <input
              type="range" min={60} max={220} step={2} value={bw}
              onInput={(ev) => setBw(parseInt((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">box height = {bh}</span>
            <input
              type="range" min={40} max={180} step={2} value={bh}
              onInput={(ev) => setBh(parseInt((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">corner lever arm = {lever.toFixed(2)}</span>
            <input
              type="range" min={0} max={1} step={0.02} value={lever}
              onInput={(ev) => setLever(parseFloat((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-3 gap-2">
            <Readout label="ang. vel. w" color="#10b981" value={`${stats.omega.toFixed(2)}`} />
            <Readout label="lin. speed" color="#0ea5e9" value={`${stats.speed.toFixed(0)}`} />
            <Readout label="inertia I" color="#4f46e5" value={`${inertia().toFixed(0)}`} />
          </div>

          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Push the lever arm to 0 and hit a corner: pure slide, no spin. Make the box bigger and the
            moment of inertia I shoots up, so the same impulse barely turns it.
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

function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
