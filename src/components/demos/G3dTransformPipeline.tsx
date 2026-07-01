import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated MODEL → VIEW → PROJECTION → SCREEN pipeline for a cube.
   - We build the model matrix from two rotation sliders (X and Y),
     a fixed view (camera pushed back), and a perspective matrix from
     the FOV slider. Every vertex is carried through the chain and the
     perspective divide (÷w) by hand, then drawn on a 2D canvas.
   - Play spins the cube by advancing the Y angle each frame; Step/Back
     nudge it; Reset returns to the start. All math lives in this file.
   ------------------------------------------------------------------ */

const COLORS = {
  edge: '#4f46e5', // indigo
  front: '#0ea5e9', // sky
  accent: '#10b981', // emerald
  faint: 'rgba(128,128,128,0.35)',
};

type M16 = number[]; // column-major 4×4, 16 numbers
type V3 = [number, number, number];

// ---- matrix helpers (column-major, elements[col*4 + row]) ----------
function identity(): M16 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// a · b  (both column-major)
function multiply(a: M16, b: M16): M16 {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function makeTranslation(x: number, y: number, z: number): M16 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

function makeRotationX(t: number): M16 {
  const c = Math.cos(t),
    s = Math.sin(t);
  // column-major of [[1,0,0],[0,c,-s],[0,s,c]]
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function makeRotationY(t: number): M16 {
  const c = Math.cos(t),
    s = Math.sin(t);
  // column-major of [[c,0,s],[0,1,0],[-s,0,c]]
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

// Perspective projection (fovy radians, aspect, near, far). Matches makePerspective.
function makePerspective(fovy: number, aspect: number, near: number, far: number): M16 {
  const t = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  // column-major: rows set as in coordinate-spaces.ts
  const m = new Array(16).fill(0);
  m[0] = t / aspect;
  m[5] = t;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  m[15] = 0;
  return m;
}

// Apply a column-major 4×4 to (x,y,z,1); return clip coords WITH w (no divide).
function applyClip(m: M16, v: V3): [number, number, number, number] {
  const [x, y, z] = v;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

// unit cube: 8 corners at (±1,±1,±1)
const CUBE: V3[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];
// 12 edges as index pairs
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // back face (z=-1)
  [4, 5], [5, 6], [6, 7], [7, 4], // front face (z=+1)
  [0, 4], [1, 5], [2, 6], [3, 7], // connectors
];
// the +z (front) face for highlighting
const FRONT_FACE = [4, 5, 6, 7];

const STEP = Math.PI / 18; // 10° nudge

export default function G3dTransformPipeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angleX, setAngleX] = useState(0.5);
  const [angleY, setAngleY] = useState(0.7);
  const [fovDeg, setFovDeg] = useState(60);
  const [dist, setDist] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const sizeRef = useRef({ w: 520, h: 380, dpr: 1 });

  // ---- play loop: advance angleY continuously ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      setAngleY((a) => (a + dt * speed * 0.9) % (Math.PI * 2));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const aspect = w / h;
    const fovy = (fovDeg * Math.PI) / 180;

    // MODEL = Ry · Rx  (rotate the cube in its own space)
    const model = multiply(makeRotationY(angleY), makeRotationX(angleX));
    // VIEW = push the world back so the camera at origin (looking −Z) can see it
    const view = makeTranslation(0, 0, -dist);
    // PROJECTION
    const proj = makePerspective(fovy, aspect, 0.1, 100);
    // MVP = P · V · M
    const mvp = multiply(proj, multiply(view, model));

    // project all 8 vertices: clip → ÷w → NDC → screen pixels
    const pts = CUBE.map((v) => {
      const [cx, cy, cz, cw] = applyClip(mvp, v);
      const invW = cw === 0 ? 1 : 1 / cw;
      const ndcX = cx * invW;
      const ndcY = cy * invW;
      const screenX = (ndcX * 0.5 + 0.5) * w;
      const screenY = (1 - (ndcY * 0.5 + 0.5)) * h; // flip Y
      return { x: screenX, y: screenY, w: cw, ndcZ: cz * invW };
    });

    // fill the front (+z) face faintly to show foreshortening
    ctx.beginPath();
    FRONT_FACE.forEach((i, k) => {
      const p = pts[i];
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(14,165,233,0.12)';
    ctx.fill();

    // edges
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const [a, b] of EDGES) {
      const pa = pts[a];
      const pb = pts[b];
      const isFront =
        FRONT_FACE.includes(a) && FRONT_FACE.includes(b);
      ctx.strokeStyle = isFront ? COLORS.front : COLORS.edge;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // vertices as dots; size shrinks with depth (÷w foreshortening cue)
    for (const p of pts) {
      const r = Math.max(2.5, 6 / Math.max(0.4, p.w / dist));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.accent;
      ctx.stroke();
    }

    // pipeline caption on the canvas
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.fillText('object → world (rotate) → view → projection → screen', 10, h - 12);
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
      sizeRef.current = { w, h, dpr };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever inputs change
  useEffect(draw, [angleX, angleY, fovDeg, dist]);

  const reset = () => {
    setPlaying(false);
    setAngleX(0.5);
    setAngleY(0.7);
    setFovDeg(60);
    setDist(5);
    lastRef.current = 0;
  };
  const stepF = () => {
    setPlaying(false);
    setAngleY((a) => (a + STEP) % (Math.PI * 2));
  };
  const stepB = () => {
    setPlaying(false);
    setAngleY((a) => (a - STEP + Math.PI * 2) % (Math.PI * 2));
  };
  const play = () => {
    lastRef.current = 0;
    setPlaying((p) => !p);
  };

  const deg = (r: number) => ((r * 180) / Math.PI).toFixed(0);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">
              rotate X = {deg(angleX)}°
            </span>
            <input
              type="range"
              min={0}
              max={Math.PI * 2}
              step={0.01}
              value={angleX}
              onInput={(e) => setAngleX(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">
              rotate Y = {deg(angleY)}°
            </span>
            <input
              type="range"
              min={0}
              max={Math.PI * 2}
              step={0.01}
              value={angleY}
              onInput={(e) => setAngleY(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">field of view = {fovDeg}°</span>
            <input
              type="range"
              min={20}
              max={120}
              step={1}
              value={fovDeg}
              onInput={(e) => setFovDeg(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">camera distance = {dist.toFixed(1)}</span>
            <input
              type="range"
              min={2.5}
              max={9}
              step={0.1}
              value={dist}
              onInput={(e) => setDist(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        angles X={deg(angleX)}° Y={deg(angleY)}° · FOV {fovDeg}° · the sky face is
        the front (+z) face. Every corner is divided by w — that perspective
        foreshortening is why the near face looks bigger than the far one.
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={stepB}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          ⏮ Back
        </button>
        <button
          onClick={play}
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={stepF}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          ⏭ Step
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          ↺ Reset
        </button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.5}
            value={speed}
            onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
            class="w-24 accent-[#10b981]"
          />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">
        Tip: drop the FOV toward 20° to flatten perspective (telephoto), or raise
        it toward 120° for a wide, fish-eye feel.
      </p>
    </div>
  );
}
