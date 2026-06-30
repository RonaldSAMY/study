import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Quaternion vs Euler orientation studio.
   - "Euler" mode: yaw / pitch / roll sliders. Push pitch toward 90°
     and two of the gimbal rings line up — that's gimbal lock.
   - "Quaternion" mode: a single t slider slerps smoothly from
     orientation A to orientation B, with no lock anywhere.
   A small 3D rig (colored axes + wire box) is drawn with a fixed
   iso camera so the rotation is easy to read.
   ------------------------------------------------------------------ */

type Mode = 'euler' | 'quat';
type Vec3 = { x: number; y: number; z: number };
type Mat3 = [number, number, number, number, number, number, number, number, number];
type Quat = { w: number; x: number; y: number; z: number };

const COLORS = {
  x: '#4f46e5', // indigo
  y: '#10b981', // emerald
  z: '#0ea5e9', // sky
  box: 'rgba(120,120,140,0.9)',
  ring: 'rgba(128,128,128,0.55)',
  lock: '#ef4444',
};

const DEG = Math.PI / 180;

export default function QuaternionSlerpStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('euler');
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(20);
  const [roll, setRoll] = useState(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sizeRef = useRef({ w: 480, h: 360, scale: 60, ox: 240, oy: 180 });
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  // endpoints for the slerp demo
  const qA = axisAngle({ x: 0, y: 1, z: 0 }, 0);
  const qB = axisAngle(norm3({ x: 0.35, y: 0.7, z: 0.6 }), 150 * DEG);

  // current orientation matrix + the quaternion it corresponds to
  const quat = mode === 'euler' ? eulerToQuat(yaw * DEG, pitch * DEG, roll * DEG) : slerp(qA, qB, t);
  const R = quatToMat(quat);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // fixed iso camera so we can see depth
    const view = mul3(rotX(-0.5), rotY(0.7));
    const project = (p: Vec3) => {
      const v = applyM(view, p);
      return { x: ox + v.x * scale, y: oy - v.y * scale, z: v.z };
    };

    // gimbal rings (Euler mode only) — they visually collapse at pitch ≈ ±90
    if (mode === 'euler') {
      const Ry = rotY(yaw * DEG);
      const Ryx = mul3(Ry, rotX(pitch * DEG));
      const Ryxz = mul3(Ryx, rotZ(roll * DEG));
      const locked = Math.abs(Math.abs(pitch) - 90) < 8;
      drawRing(ctx, project, Ry, 'xz', 1.55, COLORS.ring); // yaw gimbal
      drawRing(ctx, project, Ryx, 'yz', 1.3, COLORS.ring); // pitch gimbal
      drawRing(ctx, project, Ryxz, 'xy', 1.05, locked ? COLORS.lock : COLORS.ring); // roll gimbal
    }

    // wire box, transformed by the orientation R
    const box = boxEdges();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.box;
    for (const [a, b] of box) {
      const pa = project(applyM(R, a));
      const pb = project(applyM(R, b));
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // body axes (rotated with the object)
    const o = project({ x: 0, y: 0, z: 0 });
    drawAxis(ctx, o, project(applyM(R, { x: 1.7, y: 0, z: 0 })), COLORS.x, 'x');
    drawAxis(ctx, o, project(applyM(R, { x: 0, y: 1.7, z: 0 })), COLORS.y, 'y');
    drawAxis(ctx, o, project(applyM(R, { x: 0, y: 0, z: 1.7 })), COLORS.z, 'z');
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
      const scale = Math.max(46, Math.min(80, w / 7));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [yaw, pitch, roll, t, mode]);

  // ---- play animation (drives yaw in Euler, t in Quaternion) ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const el = (now - start) / 1000;
      if (modeRef.current === 'quat') {
        setT((Math.sin(el * 1.1 - Math.PI / 2) + 1) / 2); // 0 → 1 → 0 ping-pong
      } else {
        setPitch(Math.sin(el * 0.7) * 92); // sweep through the lock zone
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const lockNow = mode === 'euler' && Math.abs(Math.abs(pitch) - 90) < 8;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['euler', 'quat'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setPlaying(false);
            }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'euler' ? 'Euler angles' : 'Quaternion slerp'}
          </button>
        ))}
        <button
          onClick={() => setPlaying((p) => !p)}
          class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          {mode === 'euler' ? (
            <>
              <p class="text-muted">Three angles, applied in order yaw → pitch → roll.</p>
              <Slider label="yaw (Y)" value={yaw} min={-180} max={180} onInput={setYaw} color={COLORS.y} />
              <Slider label="pitch (X)" value={pitch} min={-180} max={180} onInput={setPitch} color={COLORS.x} />
              <Slider label="roll (Z)" value={roll} min={-180} max={180} onInput={setRoll} color={COLORS.z} />
              <div
                class={`rounded-lg p-3 text-xs ${lockNow ? 'bg-geometry/10 text-geometry' : 'bg-surface-2 text-muted'}`}
              >
                {lockNow
                  ? '⚠️ Gimbal lock! Pitch ≈ 90° — the roll and yaw rings line up, so you have lost a degree of freedom.'
                  : 'Slide pitch toward ±90° and watch the inner ring align with the outer one.'}
              </div>
            </>
          ) : (
            <>
              <p class="text-muted">One slider walks the shortest arc from orientation A to B.</p>
              <Slider label="t" value={t} min={0} max={1} step={0.01} onInput={setT} color={COLORS.box} fixed={2} />
              <div class="rounded-lg bg-surface-2 p-3 text-xs">
                <p class="mb-1 text-muted">interpolated unit quaternion</p>
                <div class="grid grid-cols-2 gap-1 font-mono">
                  <span>w = {quat.w.toFixed(3)}</span>
                  <span>x = {quat.x.toFixed(3)}</span>
                  <span>y = {quat.y.toFixed(3)}</span>
                  <span>z = {quat.z.toFixed(3)}</span>
                </div>
                <p class="mt-2 text-muted">
                  Length stays 1 the whole way — slerp never speeds up, slows down, or locks.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onInput,
  color,
  fixed = 0,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onInput: (v: number) => void;
  color: string;
  fixed?: number;
}) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted">
        <span style={`color:${color}`}>{label}</span>
        <span class="font-mono">{value.toFixed(fixed)}{fixed === 0 ? '°' : ''}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style={`accent-color:${color}`}
      />
    </label>
  );
}

// ---- 3D + quaternion math ----------------------------------------
function applyM(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}
function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as number[];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r as Mat3;
}
function rotX(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotY(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function norm3(v: Vec3): Vec3 {
  const L = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / L, y: v.y / L, z: v.z / L };
}
function axisAngle(axis: Vec3, angle: number): Quat {
  const h = angle / 2, s = Math.sin(h);
  return { w: Math.cos(h), x: axis.x * s, y: axis.y * s, z: axis.z * s };
}
function eulerToQuat(yaw: number, pitch: number, roll: number): Quat {
  // matches the yaw(Y)·pitch(X)·roll(Z) order used for the rings
  const qy = axisAngle({ x: 0, y: 1, z: 0 }, yaw);
  const qx = axisAngle({ x: 1, y: 0, z: 0 }, pitch);
  const qz = axisAngle({ x: 0, y: 0, z: 1 }, roll);
  return qmul(qmul(qy, qx), qz);
}
function qmul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}
function quatToMat(q: Quat): Mat3 {
  const { w, x, y, z } = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
function slerp(q0: Quat, q1: Quat, t: number): Quat {
  let dot = q0.w * q1.w + q0.x * q1.x + q0.y * q1.y + q0.z * q1.z;
  let b = q1;
  if (dot < 0) {
    b = { w: -q1.w, x: -q1.x, y: -q1.y, z: -q1.z };
    dot = -dot;
  }
  if (dot > 0.9995) {
    // nearly identical → linear blend, then renormalize
    const r = { w: q0.w + t * (b.w - q0.w), x: q0.x + t * (b.x - q0.x), y: q0.y + t * (b.y - q0.y), z: q0.z + t * (b.z - q0.z) };
    const L = Math.hypot(r.w, r.x, r.y, r.z) || 1;
    return { w: r.w / L, x: r.x / L, y: r.y / L, z: r.z / L };
  }
  const theta = Math.acos(dot);
  const s0 = Math.sin((1 - t) * theta) / Math.sin(theta);
  const s1 = Math.sin(t * theta) / Math.sin(theta);
  return { w: s0 * q0.w + s1 * b.w, x: s0 * q0.x + s1 * b.x, y: s0 * q0.y + s1 * b.y, z: s0 * q0.z + s1 * b.z };
}

// ---- geometry + drawing primitives -------------------------------
function boxEdges(): [Vec3, Vec3][] {
  const c: Vec3[] = [];
  for (const x of [-0.7, 0.7]) for (const y of [-0.7, 0.7]) for (const z of [-0.7, 0.7]) c.push({ x, y, z });
  const edges: [Vec3, Vec3][] = [];
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++) {
      const d = Math.abs(c[i].x - c[j].x) + Math.abs(c[i].y - c[j].y) + Math.abs(c[i].z - c[j].z);
      if (Math.abs(d - 1.4) < 1e-6) edges.push([c[i], c[j]]);
    }
  return edges;
}
function drawAxis(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  text: string,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 10;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText(text, to.x + 6, to.y - 6);
}
function drawRing(
  ctx: CanvasRenderingContext2D,
  project: (p: Vec3) => { x: number; y: number; z: number },
  m: Mat3,
  plane: 'xy' | 'xz' | 'yz',
  r: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = color === COLORS.lock ? 3 : 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    let p: Vec3;
    if (plane === 'xy') p = { x: ca, y: sa, z: 0 };
    else if (plane === 'xz') p = { x: ca, y: 0, z: sa };
    else p = { x: 0, y: ca, z: sa };
    const pr = project(applyM(m, p));
    if (i === 0) ctx.moveTo(pr.x, pr.y);
    else ctx.lineTo(pr.x, pr.y);
  }
  ctx.stroke();
}
