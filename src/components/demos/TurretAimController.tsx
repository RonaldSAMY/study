import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Turret aiming demo for angles & rotation.
   - Move the cursor (or finger) over the canvas; the turret computes
     the target heading with atan2 and turns toward it at a capped
     angular velocity, taking the SHORTEST way around.
   - Slow the turn rate down to see it lag behind a fast-moving target.
   ------------------------------------------------------------------ */

const COLORS = {
  base: '#4f46e5',
  barrel: '#0ea5e9',
  target: '#10b981',
  arc: 'rgba(16,185,129,0.5)',
  grid: 'rgba(128,128,128,0.16)',
};

export default function TurretAimController() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 360 });
  const angleRef = useRef(0); // current heading (radians), lives across frames
  const targetPxRef = useRef({ x: 360, y: 120 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(performance.now());
  const rateRef = useRef(180); // deg/s
  const [rate, setRate] = useState(180);
  const [readout, setReadout] = useState({ heading: 0, target: 0, error: 0 });
  rateRef.current = rate;

  const center = () => ({ x: sizeRef.current.w / 2, y: sizeRef.current.h / 2 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const c = center();
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = (w / 2) % 40; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = (h / 2) % 40; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    const tgt = targetPxRef.current;
    const targetAngle = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    const heading = angleRef.current;

    // arc from current heading to target heading
    const err = wrap(targetAngle - heading);
    ctx.strokeStyle = COLORS.arc;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 46, heading, heading + err, err < 0);
    ctx.stroke();

    // line to the target + crosshair
    ctx.strokeStyle = 'rgba(16,185,129,0.45)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
    ctx.setLineDash([]);
    crosshair(ctx, tgt, COLORS.target);

    // turret barrel along the current heading
    const len = 70;
    const bx = c.x + Math.cos(heading) * len;
    const by = c.y + Math.sin(heading) * len;
    ctx.strokeStyle = COLORS.barrel;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(bx, by); ctx.stroke();

    // base
    ctx.beginPath(); ctx.arc(c.x, c.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.base; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.7);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- animation loop: turn toward target at a capped rate ----
  useEffect(() => {
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const c = center();
      const tgt = targetPxRef.current;
      const targetAngle = Math.atan2(tgt.y - c.y, tgt.x - c.x);
      const err = wrap(targetAngle - angleRef.current);
      const maxStep = rateRef.current * (Math.PI / 180) * dt;
      const step = Math.max(-maxStep, Math.min(maxStep, err));
      angleRef.current = wrap(angleRef.current + step);
      setReadout({
        heading: (angleRef.current * 180) / Math.PI,
        target: (targetAngle * 180) / Math.PI,
        error: (err * 180) / Math.PI,
      });
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    targetPxRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerMove={pointer}
          onPointerDown={pointer}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Move the cursor over the grid — the turret aims at it.</p>
          <div class="grid grid-cols-3 gap-2">
            <Readout label="heading" value={`${fmt(readout.heading)}°`} color={COLORS.barrel} />
            <Readout label="target" value={`${fmt(readout.target)}°`} color={COLORS.target} />
            <Readout label="error" value={`${fmt(readout.error)}°`} />
          </div>
          <label class="block">
            <span class="mb-1 block text-muted">max turn rate = {rate}°/s</span>
            <input
              type="range" min={20} max={720} step={10} value={rate}
              onInput={(e) => setRate(parseInt((e.target as HTMLInputElement).value))}
              class="w-full" style="accent-color:#0ea5e9"
            />
          </label>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The barrel always rotates the <strong>short</strong> way: the error is wrapped into
            ±180°, so it never spins the long way around to reach the target.
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

function crosshair(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x - 14, p.y); ctx.lineTo(p.x + 14, p.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x, p.y + 14); ctx.stroke();
}
// wrap an angle into (−π, π]
function wrap(a: number) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}
function fmt(n: number) { return (n >= 0 ? ' ' : '') + n.toFixed(0); }
