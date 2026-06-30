import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Quaternions vs Euler angles in 3D.
   - Euler mode: yaw / pitch / roll sliders (applied Y then X then Z).
     At pitch = ±90° two axes line up -> GIMBAL LOCK warning.
   - Quaternion mode: slerp t from orientation A to B — smooth, no lock.
   A colored axis-triad + wire cube is drawn with a light perspective
   projection. Canvas conventions from VectorPlayground.
   ------------------------------------------------------------------ */

type Mode = 'euler' | 'quat';
type V3 = [number, number, number];
type Quat = [number, number, number, number]; // w, x, y, z

const COLORS = { x: '#ef4444', y: '#10b981', z: '#0ea5e9', cube: '#4f46e5', grid: 'rgba(128,128,128,0.18)' };

// ---- rotation maths ----
const deg = (d: number) => (d * Math.PI) / 180;
function eulerMatrix(yaw: number, pitch: number, roll: number): number[] {
  // R = Rz(roll) * Rx(pitch) * Ry(yaw)
  const cy = Math.cos(deg(yaw)), sy = Math.sin(deg(yaw));
  const cx = Math.cos(deg(pitch)), sx = Math.sin(deg(pitch));
  const cz = Math.cos(deg(roll)), sz = Math.sin(deg(roll));
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return m3(Rz, m3(Rx, Ry));
}
function m3(a: number[], b: number[]): number[] {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
function quatFromAxisAngle(axis: V3, angleDeg: number): Quat {
  const a = deg(angleDeg) / 2, s = Math.sin(a);
  const n = Math.hypot(...axis) || 1;
  return [Math.cos(a), (axis[0] / n) * s, (axis[1] / n) * s, (axis[2] / n) * s];
}
function slerp(q0: Quat, q1: Quat, t: number): Quat {
  let dot = q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3];
  let q1b = q1.slice() as Quat;
  if (dot < 0) { q1b = q1b.map((v) => -v) as Quat; dot = -dot; }
  if (dot > 0.9995) { const r = q0.map((v, i) => v + t * (q1b[i] - v)) as Quat; const n = Math.hypot(...r) || 1; return r.map((v) => v / n) as Quat; }
  const th0 = Math.acos(dot), th = th0 * t;
  const s0 = Math.cos(th) - (dot * Math.sin(th)) / Math.sin(th0);
  const s1 = Math.sin(th) / Math.sin(th0);
  return q0.map((v, i) => s0 * v + s1 * q1b[i]) as Quat;
}
function quatMatrix(q: Quat): number[] {
  const [w, x, y, z] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
function applyM(m: number[], v: V3): V3 { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }

const CUBE: V3[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

export default function QuaternionGimbalLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('euler');
  const [yaw, setYaw] = useState(20);
  const [pitch, setPitch] = useState(90);
  const [roll, setRoll] = useState(0);
  const [tq, setTq] = useState(0.35);
  const sizeRef = useRef({ w: 480, h: 360, scale: 50, ox: 240, oy: 180 });

  const qA = quatFromAxisAngle([1, 0, 0], 0);
  const qB = quatFromAxisAngle([0.3, 1, 0.4], 200);

  const rot = mode === 'euler' ? eulerMatrix(yaw, pitch, roll) : quatMatrix(slerp(qA, qB, tq));
  const gimbalLocked = mode === 'euler' && Math.abs(Math.abs(pitch) - 90) < 6;

  const project = (v: V3) => {
    const { scale, ox, oy } = sizeRef.current;
    const camZ = 5;
    const f = camZ / (camZ - v[2] * 0.6);
    return { x: ox + v[0] * scale * f, y: oy - v[1] * scale * f };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // wire cube
    const pts = CUBE.map((v) => project(applyM(rot, v)));
    ctx.strokeStyle = COLORS.cube; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
    for (const [a, b] of EDGES) { ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // axis triad
    const O = project([0, 0, 0]);
    const axes: [V3, string, string][] = [[[1.6, 0, 0], COLORS.x, 'X'], [[0, 1.6, 0], COLORS.y, 'Y'], [[0, 0, 1.6], COLORS.z, 'Z']];
    for (const [ax, col, name] of axes) {
      const p = project(applyM(rot, ax));
      arrow(ctx, O, p, col, 3); label(ctx, p, name, col);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(40, Math.min(70, w / 7));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [mode, yaw, pitch, roll, tq]);

  const Slider = ({ label, value, min, max, step, set, accent }: any) => (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted"><span>{label}</span><span class="font-mono text-text">{value.toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e: any) => set(parseFloat(e.target.value))} class="w-full" style={`accent-color:${accent}`} />
    </label>
  );

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['euler', 'quat'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m === 'euler' ? 'Euler angles' : 'Quaternion slerp'}</button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-2 text-sm">
          {mode === 'euler' ? (
            <>
              <Slider label="yaw (Y)" value={yaw} min={-180} max={180} step={1} set={setYaw} accent={COLORS.y} />
              <Slider label="pitch (X)" value={pitch} min={-180} max={180} step={1} set={setPitch} accent={COLORS.x} />
              <Slider label="roll (Z)" value={roll} min={-180} max={180} step={1} set={setRoll} accent={COLORS.z} />
              {gimbalLocked ? (
                <div class="rounded-lg border border-geometry/50 bg-geometry/10 p-3 text-xs text-geometry">
                  ⚠️ <strong>Gimbal lock!</strong> At pitch ≈ ±90° the yaw and roll axes collapse onto each other — dragging either now produces the <em>same</em> spin. You've lost a degree of freedom.
                </div>
              ) : (
                <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">Slide pitch toward 90° and watch the yaw and roll axes line up. Then try yaw vs roll — they do the same thing.</p>
              )}
            </>
          ) : (
            <>
              <Slider label="slerp t (A → B)" value={tq} min={0} max={1} step={0.01} set={setTq} accent={COLORS.cube} />
              <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">One quaternion stores the whole orientation. <strong>Slerp</strong> walks the shortest arc from A to B at constant angular speed — smooth, and gimbal lock can never happen.</p>
              <Readout label="quaternion (w, x, y, z)" value={slerp(qA, qB, tq).map((v) => v.toFixed(2)).join(', ')} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (<div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-muted">{label}</span><div class="font-mono font-semibold text-xs">{value}</div></div>);
}
function arrow(ctx: CanvasRenderingContext2D, from: any, to: any, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x); const head = 10;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, at: any, text: string, color: string) {
  ctx.font = '700 13px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 6, at.y - 6);
}
