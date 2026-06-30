import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Force accumulator (Newton's second law, F = m·a).
   - A body of mass m lives in a vertical box. Each frame we SUM every
     force acting on it (gravity, drag, optional held thrust), turn the
     net force into acceleration a = F/m, then integrate velocity and
     position. The body bounces lightly off the floor and ceiling.
   - Held "Thrust" applies a steady upward force; "Kick" applies an
     instantaneous upward impulse. Readouts show net force, a and v.
   ------------------------------------------------------------------ */

const COLORS = {
  body: '#0ea5e9',
  thrust: '#10b981',
  weight: '#4f46e5',
  net: '#f59e0b',
  wall: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.16)',
};

const WORLD_H = 10;     // metres, floor (0) to ceiling
const THRUST = 80;      // newtons, upward, while held
const IMPULSE = 14;     // newton·seconds, upward kick
const RESTITUTION = 0.45;

export default function ForceAccumulatorLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gravity, setGravity] = useState(9.8);
  const [drag, setDrag] = useState(0.6);
  const [mass, setMass] = useState(1.5);
  const [thrustOn, setThrustOn] = useState(false);

  const yRef = useRef(0);        // height above floor, metres
  const vRef = useRef(0);        // vertical velocity, m/s (up positive)
  const thrustRef = useRef(false);
  const rafRef = useRef<number>();
  const lastRef = useRef(0);
  const sizeRef = useRef({ w: 360, h: 360, scale: 30 });
  const [readout, setReadout] = useState({ fNet: 0, a: 0, v: 0, y: 0, fThrust: 0 });

  const toY = (wy: number) => {
    const { h, scale } = sizeRef.current;
    return h - 20 - wy * scale; // 20px floor margin
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let m = 0; m <= WORLD_H; m += 2) {
      const yy = toY(m);
      ctx.beginPath(); ctx.moveTo(24, yy); ctx.lineTo(w - 12, yy); ctx.stroke();
    }

    // floor + ceiling
    ctx.strokeStyle = COLORS.wall; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(24, toY(0)); ctx.lineTo(w - 12, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, toY(WORLD_H)); ctx.lineTo(w - 12, toY(WORLD_H)); ctx.stroke();

    const by = toY(yRef.current);

    // force arrows from the body centre
    const g = gravity;
    const m = mass;
    const fThrust = thrustRef.current ? THRUST : 0;
    const drawForce = (mag: number, up: boolean, color: string) => {
      if (Math.abs(mag) < 0.5) return;
      const len = Math.min(60, Math.abs(mag) * 0.7);
      const dir = up ? -1 : 1;
      const tip = by + dir * len;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, tip); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, tip);
      ctx.lineTo(cx - 5, tip + dir * -7);
      ctx.lineTo(cx + 5, tip + dir * -7);
      ctx.closePath(); ctx.fill();
    };
    // weight (down) and thrust (up) drawn offset so both are visible
    ctx.save();
    ctx.translate(-16, 0); drawForce(m * g, false, COLORS.weight); ctx.restore();
    if (fThrust) { ctx.save(); ctx.translate(16, 0); drawForce(fThrust, true, COLORS.thrust); ctx.restore(); }

    // body
    ctx.fillStyle = COLORS.body; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, by, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('m', cx, by + 4);
    ctx.textAlign = 'left';
  };

  // ---- continuous force-accumulation loop ----
  useEffect(() => {
    const step = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.04, (ts - lastRef.current) / 1000);
      lastRef.current = ts;

      const g = gravity;
      const m = Math.max(0.1, mass);
      const v = vRef.current;
      // ---- accumulate forces (up positive) ----
      const fThrust = thrustRef.current ? THRUST : 0;
      const fWeight = -m * g;
      const fDrag = -drag * v;             // linear drag opposes motion
      const fNet = fWeight + fThrust + fDrag;
      const a = fNet / m;                  // Newton's second law

      // integrate velocity, then position
      let nv = v + a * dt;
      let ny = yRef.current + nv * dt;
      // bounce off floor / ceiling
      if (ny <= 0) { ny = 0; nv = Math.abs(nv) * RESTITUTION * (Math.abs(nv) > 0.3 ? 1 : 0); }
      if (ny >= WORLD_H) { ny = WORLD_H; nv = -Math.abs(nv) * RESTITUTION; }
      vRef.current = nv;
      yRef.current = ny;

      setReadout({ fNet, a, v: nv, y: ny, fThrust });
      draw();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = 0; };
  }, [gravity, drag, mass]);

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = Math.round(w * 0.95);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = (h - 40) / WORLD_H;
      sizeRef.current = { w, h, scale };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const setThrust = (on: boolean) => { thrustRef.current = on; setThrustOn(on); };
  const kick = () => { vRef.current += IMPULSE / Math.max(0.1, mass); };
  const reset = () => { yRef.current = 0; vRef.current = 0; setThrust(false); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="flex flex-wrap gap-2">
            <button
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setThrust(true); }}
              onPointerUp={() => setThrust(false)}
              onPointerLeave={() => setThrust(false)}
              onPointerCancel={() => setThrust(false)}
              class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                thrustOn ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
              }`}
            >
              ⬆ Hold thrust
            </button>
            <button onClick={kick} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
              💥 Kick (impulse)
            </button>
            <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
              Reset
            </button>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">gravity g = {gravity.toFixed(1)} m/s²</span>
            <input type="range" min={0} max={15} step={0.2} value={gravity}
              onInput={(e) => setGravity(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">drag coefficient = {drag.toFixed(1)}</span>
            <input type="range" min={0} max={4} step={0.1} value={drag}
              onInput={(e) => setDrag(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">mass m = {mass.toFixed(1)} kg</span>
            <input type="range" min={0.5} max={4} step={0.1} value={mass}
              onInput={(e) => setMass(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="net force F" value={`${readout.fNet.toFixed(1)} N`} color={COLORS.net} />
            <Readout label="accel a = F/m" value={`${readout.a.toFixed(1)} m/s²`} />
            <Readout label="velocity v" value={`${readout.v.toFixed(1)} m/s`} color={COLORS.body} />
            <Readout label="height y" value={`${readout.y.toFixed(1)} m`} />
          </div>
          <p class="text-xs text-muted">
            Indigo arrow is weight (m·g, down); green is thrust (up). Net force ÷ mass is the acceleration that bends velocity each frame.
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
