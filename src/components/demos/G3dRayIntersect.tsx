import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated ray-sphere intersection.
   - A ray P(t) = O + t*D marches out from an origin O along a unit
     direction D. We solve the quadratic (D.D)t^2 + 2(m.D)t + (m.m-r^2)=0
     with m = O - C, and animate t growing until it reaches the nearest
     positive root (the entry hit) — or runs off the screen on a miss.
   - Drag the ray ORIGIN (indigo), the direction ENDPOINT (indigo ring),
     or the sphere CENTER (sky). Slide the radius.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   All the math (dot, sub, raySphere) lives in this file.
   ------------------------------------------------------------------ */

type Vec = [number, number];

const COLORS = {
  ray: '#4f46e5', // indigo
  sphere: '#0ea5e9', // sky
  hit: '#10b981', // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// ---- 2D vector helpers (same shape as the 3D ones in the course file) ----
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1];
const len = (a: Vec): number => Math.hypot(a[0], a[1]);
const normalize = (a: Vec): Vec => {
  const l = len(a);
  return l === 0 ? [1, 0] : [a[0] / l, a[1] / l];
};

type Solve = {
  disc: number;
  a: number;
  b: number;
  c: number;
  t: number | null; // nearest non-negative root
};

// Solve (D.D)t^2 + 2(m.D)t + (m.m - r^2) = 0, m = O - C. Nearest t>=0 or null.
function raySphere(o: Vec, d: Vec, c: Vec, r: number): Solve {
  const m = sub(o, c); // O - C
  const a = dot(d, d); // = 1 for a unit direction
  const b = 2 * dot(m, d);
  const cc = dot(m, m) - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return { disc, a, b, c: cc, t: null };
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  const t1 = (-b + sq) / (2 * a);
  let t = t0;
  if (t < 0) t = t1; // origin inside/past the near face -> use exit
  return { disc, a, b, c: cc, t: t < 0 ? null : t };
}

const T_MAX = 22; // how far the ray marches before we call it a miss

export default function G3dRayIntersect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [origin, setOrigin] = useState<Vec>([-6, -2]);
  const [dirEnd, setDirEnd] = useState<Vec>([-3, 0]);
  const [center, setCenter] = useState<Vec>([3, 1]);
  const [radius, setRadius] = useState(2.4);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const dragRef = useRef<null | 'origin' | 'dir' | 'center'>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const tRef = useRef(0);
  tRef.current = t;
  const sizeRef = useRef({ w: 520, h: 360, scale: 26, ox: 260, oy: 180 });

  // Direction (unit) and the solved intersection.
  const dir = normalize(sub(dirEnd, origin));
  const solve = raySphere(origin, dir, center, radius);
  const stopT = solve.t ?? T_MAX; // where the animation halts

  // ---- coordinate helpers (math space <-> pixels) ----
  const toPx = (v: Vec): Vec => {
    const { scale: s, ox, oy } = sizeRef.current;
    return [ox + v[0] * s, oy - v[1] * s];
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale: s, ox, oy } = sizeRef.current;
    return [Math.round(((px - ox) / s) * 2) / 2, Math.round(((oy - py) / s) * 2) / 2];
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale: s, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid + axes
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % s; gx < w; gx += s) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % s; gy < h; gy += s) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // sphere (drawn as a circle)
    const cPx = toPx(center);
    ctx.beginPath();
    ctx.arc(cPx[0], cPx[1], radius * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14,165,233,0.15)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.sphere;
    ctx.stroke();
    handle(ctx, cPx, COLORS.sphere);

    // faint full ray direction (dashed), so you can see where it is aimed
    const far = add(origin, scale(dir, T_MAX));
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(79,70,229,0.35)';
    ctx.lineWidth = 1.5;
    seg(ctx, toPx(origin), toPx(far));
    ctx.setLineDash([]);

    // the GROWING ray segment O -> P(t)
    const P = add(origin, scale(dir, Math.min(t, stopT)));
    arrow(ctx, toPx(origin), toPx(P), COLORS.ray, 3.5);

    // origin + direction handles
    handle(ctx, toPx(origin), COLORS.ray);
    ring(ctx, toPx(dirEnd), COLORS.ray);
    label(ctx, toPx(origin), 'O', COLORS.ray);
    label(ctx, toPx(dirEnd), 'D', COLORS.ray);

    // hit marker once t has reached the solved entry point
    if (solve.t !== null && t >= solve.t - 1e-6) {
      const hitP = toPx(add(origin, scale(dir, solve.t)));
      ctx.beginPath();
      ctx.arc(hitP[0], hitP[1], 7, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.hit;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      label(ctx, hitP, 'P = O + tD', COLORS.hit);
    }
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sc = Math.max(18, Math.min(30, w / 20));
      sizeRef.current = { w, h, scale: sc, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on any state change
  useEffect(draw, [origin, dirEnd, center, radius, t]);

  // ---- animation loop ----
  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now;
      const dtSec = (now - lastRef.current) / 1000;
      lastRef.current = now;
      const next = tRef.current + dtSec * 4 * speed; // 4 world units / sec at 1x
      if (next >= stopT) { setT(stopT); setPlaying(false); return; }
      setT(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, stopT]);

  const play = () => { if (t >= stopT) setT(0); lastRef.current = 0; setPlaying((p) => !p); };
  const stepF = () => { setPlaying(false); setT((v) => Math.min(stopT, v + 0.5)); };
  const stepB = () => { setPlaying(false); setT((v) => Math.max(0, v - 0.5)); };
  const reset = () => { setPlaying(false); lastRef.current = 0; setT(0); };

  // ---- pointer dragging ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const near = (v: Vec) => Math.hypot(toPx(v)[0] - px, toPx(v)[1] - py);
    const dO = near(origin), dD = near(dirEnd), dC = near(center);
    const min = Math.min(dO, dD, dC);
    if (min > 24) return;
    dragRef.current = min === dO ? 'origin' : min === dD ? 'dir' : 'center';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'origin') setOrigin(m);
    else if (dragRef.current === 'dir') setDirEnd(m);
    else setCenter(m);
    setT(0);
    setPlaying(false);
  };
  const onUp = () => { dragRef.current = null; };

  // ---- live caption ----
  const reached = solve.t !== null && t >= solve.t - 1e-6;
  const hitPt = solve.t !== null ? add(origin, scale(dir, solve.t)) : null;
  const caption =
    solve.t === null
      ? `no hit — discriminant = ${solve.disc.toFixed(2)} < 0, the ray misses the sphere`
      : reached
        ? `t = ${solve.t.toFixed(2)} — discriminant = ${solve.disc.toFixed(2)} > 0, entering the sphere at P = (${hitPt![0].toFixed(2)}, ${hitPt![1].toFixed(2)})`
        : `t = ${t.toFixed(2)} — marching along P(t) = O + tD… (solves at t = ${solve.t.toFixed(2)})`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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
            Drag <span style={`color:${COLORS.ray}`}>O</span> and{' '}
            <span style={`color:${COLORS.ray}`}>D</span> to aim the ray, or the{' '}
            <span style={`color:${COLORS.sphere}`}>sphere</span> center. Press Play to march{' '}
            <code>t</code> until it hits.
          </p>

          <div class="grid grid-cols-2 gap-2 font-mono text-xs">
            <Readout label="O" value={`(${origin[0]}, ${origin[1]})`} color={COLORS.ray} />
            <Readout label="D" value={`(${dir[0].toFixed(2)}, ${dir[1].toFixed(2)})`} color={COLORS.ray} />
            <Readout label="C" value={`(${center[0]}, ${center[1]})`} color={COLORS.sphere} />
            <Readout label="r" value={radius.toFixed(2)} color={COLORS.sphere} />
            <Readout label="a=D·D" value={solve.a.toFixed(2)} />
            <Readout label="b=2m·D" value={solve.b.toFixed(2)} />
            <Readout label="c=|m|²−r²" value={solve.c.toFixed(2)} />
            <Readout label="Δ=b²−4ac" value={solve.disc.toFixed(2)} color={solve.disc < 0 ? '#f43f5e' : COLORS.hit} />
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">sphere radius r = {radius.toFixed(2)}</span>
            <input
              type="range" min={0.5} max={5} step={0.1} value={radius}
              onInput={(e) => { setRadius(parseFloat((e.target as HTMLInputElement).value)); setT(0); setPlaying(false); }}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: drag the sphere off the dashed line to watch Δ go negative — a clean miss.</p>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-2.5 py-1.5">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

// ---- canvas primitives ----
function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const dLen = Math.hypot(to[0] - from[0], to[1] - from[1]);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
  if (dLen < 6) return; // too short to draw a head
  const head = 11;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - head * Math.cos(angle - 0.4), to[1] - head * Math.sin(angle - 0.4));
  ctx.lineTo(to[0] - head * Math.cos(angle + 0.4), to[1] - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function seg(ctx: CanvasRenderingContext2D, from: Vec, to: Vec) {
  ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
}
function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at[0], at[1], 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function ring(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at[0], at[1], 6, 0, Math.PI * 2);
  ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at[0] + 10, at[1] - 8);
}
