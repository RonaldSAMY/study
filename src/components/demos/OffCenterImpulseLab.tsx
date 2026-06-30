import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Off-center impulse lab.
   - A rigid box sits at the centre of the arena.
   - Drag the white contact dot to choose WHERE the hit lands.
   - Drag the orange arrow tip to choose the impulse direction & strength.
   - "Launch" applies the impulse: the box gains linear velocity (J/m)
     AND angular velocity (torque / moment of inertia). Watch it spin.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
type Phase = 'setup' | 'running';

const COLORS = {
  box: '#4f46e5',
  impulse: '#f59e0b',
  r: '#0ea5e9',
  result: '#10b981',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.45)',
};

// box half-dimensions (pixels)
const HW = 60;
const HH = 38;

export default function OffCenterImpulseLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contact, setContact] = useState<Vec>({ x: 60, y: 0 });
  const [impulse, setImpulse] = useState<Vec>({ x: 0, y: 110 });
  const [mass, setMass] = useState(2);
  const [phase, setPhase] = useState<Phase>('setup');
  const [, setTick] = useState(0);

  const sizeRef = useRef({ w: 480, h: 360, ox: 240, oy: 180 });
  const dragRef = useRef<null | 'contact' | 'impulse'>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const simRef = useRef({ x: 0, y: 0, angle: 0, vx: 0, vy: 0, omega: 0 });

  // moment of inertia of a rectangle about its centre: I = m(w² + h²)/12
  const inertia = (mass * ((2 * HW) ** 2 + (2 * HH) ** 2)) / 12;
  // 2D "cross product" gives the scalar torque: τ = rₓ·Jᵧ − rᵧ·Jₓ
  const torque = contact.x * impulse.y - contact.y * impulse.x;
  const rMag = Math.hypot(contact.x, contact.y);
  const jMag = Math.hypot(impulse.x, impulse.y);

  // ---- coordinate helpers (math space, y-up <-> pixels) ----
  const toPx = (v: Vec): Vec => {
    const { ox, oy } = sizeRef.current;
    return { x: ox + v.x, y: oy - v.y };
  };
  const toMath = (px: number, py: number): Vec => {
    const { ox, oy } = sizeRef.current;
    return { x: px - ox, y: oy - py };
  };

  const drawBox = (ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-angle); // canvas y is down, so negate for y-up math
    ctx.fillStyle = 'rgba(79,70,229,0.14)';
    ctx.strokeStyle = COLORS.box;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(-HW, -HH, 2 * HW, 2 * HH);
    ctx.fill();
    ctx.stroke();
    // a stripe so rotation is obvious
    ctx.strokeStyle = 'rgba(79,70,229,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -HH);
    ctx.lineTo(0, HH);
    ctx.stroke();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const step = 40;
    for (let gx = ox % step; gx < w; gx += step) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % step; gy < h; gy += step) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    if (phase === 'setup') {
      // box at centre, un-rotated
      const c = toPx({ x: 0, y: 0 });
      drawBox(ctx, c.x, c.y, 0);

      // centre of mass dot
      handle(ctx, c, COLORS.result, 5);

      // r vector: centre -> contact point
      const cp = toPx(contact);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = COLORS.r;
      ctx.lineWidth = 2;
      drawSeg(ctx, c, cp);
      ctx.setLineDash([]);
      label(ctx, midpoint(c, cp), 'r', COLORS.r);

      // impulse arrow: contact -> contact + impulse
      const tip = toPx({ x: contact.x + impulse.x, y: contact.y + impulse.y });
      arrow(ctx, cp, tip, COLORS.impulse, 3.5);
      label(ctx, tip, 'J', COLORS.impulse);

      // contact handle on top
      handle(ctx, cp, COLORS.box, 7);
    } else {
      const s = simRef.current;
      const c = toPx({ x: s.x, y: s.y });
      drawBox(ctx, c.x, c.y, s.angle);
      handle(ctx, c, COLORS.result, 5);
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on setup-state changes
  useEffect(draw, [contact, impulse, mass, phase]);

  // ---- simulation loop ----
  const stop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(() => {
    if (phase !== 'running') return;
    lastRef.current = performance.now();
    const tickLoop = (now: number) => {
      const { w, h } = sizeRef.current;
      const dt = Math.min(0.032, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const s = simRef.current;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.angle += s.omega * dt;
      // bounce off the arena walls (keep the box on screen)
      const bx = w / 2 - HW;
      const by = h / 2 - HH;
      if (s.x > bx) { s.x = bx; s.vx = -Math.abs(s.vx) * 0.85; }
      if (s.x < -bx) { s.x = -bx; s.vx = Math.abs(s.vx) * 0.85; }
      if (s.y > by) { s.y = by; s.vy = -Math.abs(s.vy) * 0.85; }
      if (s.y < -by) { s.y = -by; s.vy = Math.abs(s.vy) * 0.85; }
      draw();
      setTick((t) => (t + 1) % 1000000); // refresh live readouts
      rafRef.current = requestAnimationFrame(tickLoop);
    };
    rafRef.current = requestAnimationFrame(tickLoop);
    return stop;
  }, [phase]);

  // clean up on unmount
  useEffect(() => stop, []);

  const launch = () => {
    simRef.current = {
      x: 0,
      y: 0,
      angle: 0,
      vx: impulse.x / mass,
      vy: impulse.y / mass,
      omega: torque / inertia,
    };
    setPhase('running');
  };
  const reset = () => {
    stop();
    setPhase('setup');
  };

  // ---- pointer dragging (setup only) ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    if (phase !== 'setup') return;
    const { px, py } = pointer(e);
    const cp = toPx(contact);
    const tip = toPx({ x: contact.x + impulse.x, y: contact.y + impulse.y });
    const dc = dist(cp, { x: px, y: py });
    const dt = dist(tip, { x: px, y: py });
    if (dt < 24 && dt <= dc) dragRef.current = 'impulse';
    else if (dc < 26) dragRef.current = 'contact';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'contact') {
      // clamp the contact point to the box surface region
      setContact({
        x: Math.max(-HW, Math.min(HW, Math.round(m.x))),
        y: Math.max(-HH, Math.min(HH, Math.round(m.y))),
      });
    } else {
      setImpulse({ x: Math.round(m.x - contact.x), y: Math.round(m.y - contact.y) });
    }
  };
  const onUp = () => { dragRef.current = null; };

  const live = simRef.current;
  const speed = Math.hypot(live.vx, live.vy);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {phase === 'setup' ? (
          <button
            onClick={launch}
            class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            ▶ Launch impulse
          </button>
        ) : (
          <button
            onClick={reset}
            class="rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          >
            ↺ Reset
          </button>
        )}
        <span class="text-xs text-muted">
          {phase === 'setup' ? 'Drag the dot and the orange arrow.' : 'The box keeps its spin — momentum is conserved.'}
        </span>
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
          <div class="grid grid-cols-2 gap-2">
            <Readout label="r (offset)" color={COLORS.r} value={`(${contact.x}, ${contact.y})`} />
            <Readout label="J (impulse)" color={COLORS.impulse} value={`(${impulse.x}, ${impulse.y})`} />
            <Readout label="‖r‖" value={rMag.toFixed(0)} />
            <Readout label="‖J‖" value={jMag.toFixed(0)} />
            <Readout label="torque τ" color={COLORS.result} value={torque.toFixed(0)} />
            <Readout label="inertia I" value={inertia.toFixed(0)} />
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">mass m = {mass.toFixed(1)}</span>
            <input
              type="range" min={0.5} max={6} step={0.1} value={mass}
              disabled={phase === 'running'}
              onInput={(e) => setMass(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981] disabled:opacity-40"
            />
          </label>

          {phase === 'running' ? (
            <div class="rounded-lg bg-surface-2 p-3">
              <div class="flex justify-between"><span class="text-muted">angular vel. ω</span><strong>{live.omega.toFixed(2)} rad/s</strong></div>
              <div class="flex justify-between"><span class="text-muted">linear speed</span><strong>{speed.toFixed(0)} px/s</strong></div>
              <p class="mt-1 text-xs text-muted">
                {Math.abs(live.omega) < 0.05
                  ? 'No spin — the impulse pointed straight through the centre of mass.'
                  : live.omega > 0 ? 'Spinning counter-clockwise (positive torque).' : 'Spinning clockwise (negative torque).'}
              </p>
            </div>
          ) : (
            <div class="rounded-lg bg-surface-2 p-3">
              <div class="flex justify-between"><span class="text-muted">predicted ω</span><strong>{(torque / inertia).toFixed(2)} rad/s</strong></div>
              <p class="mt-1 text-xs text-muted">
                {Math.abs(torque) < 1
                  ? 'Aim the arrow through the centre dot → zero torque → pure slide, no spin.'
                  : 'Off-centre hit → torque → the box will both drift and rotate.'}
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

// ---- canvas drawing primitives ----
function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function drawSeg(ctx: CanvasRenderingContext2D, from: Vec, to: Vec) {
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
}
function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string, r: number) {
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
function midpoint(p: Vec, q: Vec): Vec { return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }
function dist(p: Vec, q: Vec) { return Math.hypot(p.x - q.x, p.y - q.y); }
