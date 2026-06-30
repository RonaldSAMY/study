import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Fixed vs Variable timestep comparator.
   - Two lanes show the SAME bouncing ball simulated two ways.
   - Left lane  (indigo): a fixed-timestep accumulator loop.
   - Right lane (sky):    raw variable delta-time integration.
   - A faint emerald "truth" ghost (simulated at a fine fixed step in
     real time) is drawn in both lanes as the ground-truth path.
   - Slide the frame rate down or inject a frame-time spike: the
     variable ball drifts away from the truth while the fixed one
     stays consistent.
   - rAF drives the animation; it is cancelled on unmount. Canvas uses
     devicePixelRatio scaling and resizes on window.resize.
   ------------------------------------------------------------------ */

type Ball = { x: number; y: number; vx: number; vy: number; bounces: number };

type Sim = {
  ref: Ball;        // ground truth (fine fixed step, real time)
  refAccum: number;
  fixed: Ball;      // fixed-timestep accumulator result
  fixedPrev: Ball;  // previous fixed state (for interpolation)
  accumulator: number;
  alpha: number;
  fixedSteps: number;
  variable: Ball;   // raw variable-dt result
  frameClock: number;
  spike: number;    // pending one-shot frame spike (seconds)
  readoutClock: number;
};

const COLORS = {
  fixed: '#4f46e5',     // indigo
  variable: '#0ea5e9',  // sky
  truth: '#10b981',     // emerald
  grid: 'rgba(128,128,128,0.18)',
  panel: 'rgba(128,128,128,0.06)',
  floor: 'rgba(128,128,128,0.55)',
};

// ---- world (meters) & physics constants ----
const WORLD_W = 5;
const WORLD_H = 7;
const R = 0.32;
const G = 18;          // gravity (m/s^2)
const REST = 0.86;     // restitution
const FIXED_DT = 1 / 120; // the fixed physics step
const REF_DT = 1 / 480;   // truth step (very fine)
const MAX_STEPS = 600;

function makeBall(): Ball {
  return { x: WORLD_W / 2, y: WORLD_H - R, vx: 2.2, vy: 0, bounces: 0 };
}

function makeSim(): Sim {
  return {
    ref: makeBall(),
    refAccum: 0,
    fixed: makeBall(),
    fixedPrev: makeBall(),
    accumulator: 0,
    alpha: 0,
    fixedSteps: 0,
    variable: makeBall(),
    frameClock: 0,
    spike: 0,
    readoutClock: 0,
  };
}

// semi-implicit Euler step with floor / ceiling / wall bounces
function step(b: Ball, dt: number) {
  b.vy -= G * dt;
  b.y += b.vy * dt;
  b.x += b.vx * dt;
  if (b.y < R) { b.y = R; b.vy = -b.vy * REST; b.bounces++; }
  if (b.y > WORLD_H - R) { b.y = WORLD_H - R; b.vy = -b.vy * REST; }
  if (b.x < R) { b.x = R; b.vx = -b.vx; }
  if (b.x > WORLD_W - R) { b.x = WORLD_W - R; b.vx = -b.vx; }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export default function TimestepComparator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>(makeSim());
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const sizeRef = useRef({ w: 520, h: 320, scale: 40, laneW: 240, gap: 16, padX: 12, topPad: 30 });

  const [running, setRunning] = useState(true);
  const [fps, setFps] = useState(60);
  const [stats, setStats] = useState({ fixedSteps: 0, alpha: 0, driftFixed: 0, driftVar: 0 });

  // ---- map world coords -> pixels for a given lane (0 = left, 1 = right) ----
  const wpx = (lane: number, wx: number, wy: number) => {
    const { scale, laneW, gap, padX, topPad, h } = sizeRef.current;
    const contentW = WORLD_W * scale;
    const contentH = WORLD_H * scale;
    const laneX0 = padX + lane * (laneW + gap);
    const offX = laneX0 + (laneW - contentW) / 2;
    const offY = topPad + (h - topPad - 8 - contentH) / 2;
    const floorY = offY + contentH;
    return { x: offX + wx * scale, y: floorY - wy * scale, floorY, offX, contentW };
  };

  const drawBall = (
    ctx: CanvasRenderingContext2D,
    lane: number,
    bx: number,
    by: number,
    color: string,
    filled: boolean,
  ) => {
    const p = wpx(lane, bx, by);
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * sizeRef.current.scale, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const s = simRef.current;
    ctx.clearRect(0, 0, w, h);

    const lanes = [
      { label: 'Fixed timestep', color: COLORS.fixed },
      { label: 'Variable timestep', color: COLORS.variable },
    ];

    lanes.forEach((lane, i) => {
      const p = wpx(i, 0, 0);
      // panel background
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(p.offX, sizeRef.current.topPad - 4, p.contentW, p.floorY - sizeRef.current.topPad + 12);
      // floor line
      ctx.strokeStyle = COLORS.floor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.offX, p.floorY);
      ctx.lineTo(p.offX + p.contentW, p.floorY);
      ctx.stroke();
      // label
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = lane.color;
      ctx.fillText(lane.label, p.offX + 2, sizeRef.current.topPad - 12);

      // truth ghost (same world position in both lanes)
      drawBall(ctx, i, s.ref.x, s.ref.y, COLORS.truth, false);
    });

    // fixed lane: interpolated render between physics steps
    const fx = lerp(s.fixedPrev.x, s.fixed.x, s.alpha);
    const fy = lerp(s.fixedPrev.y, s.fixed.y, s.alpha);
    drawBall(ctx, 0, fx, fy, COLORS.fixed, true);

    // variable lane: raw state
    drawBall(ctx, 1, s.variable.x, s.variable.y, COLORS.variable, true);
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.max(260, Math.min(360, w * 0.6)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const padX = 12;
      const gap = 16;
      const topPad = 30;
      const laneW = (w - padX * 2 - gap) / 2;
      const contentH = h - topPad - 8;
      const scale = Math.min(laneW / WORLD_W, contentH / WORLD_H);
      sizeRef.current = { w, h, scale, laneW, gap, padX, topPad };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- animation loop (cleaned up on unmount / pause) ----
  useEffect(() => {
    if (!running) return;
    lastRef.current = performance.now();
    const frame = (now: number) => {
      const s = simRef.current;
      let real = (now - lastRef.current) / 1000;
      lastRef.current = now;
      real = Math.min(Math.max(real, 0), 0.25); // clamp huge gaps (e.g. tab switch)

      // ground truth advances in real time at a very fine fixed step
      s.refAccum += real;
      let guard = 0;
      while (s.refAccum >= REF_DT && guard < MAX_STEPS) { step(s.ref, REF_DT); s.refAccum -= REF_DT; guard++; }

      // simulated frames paced at the chosen frame rate
      const frameTime = 1 / fpsRef.current;
      s.frameClock += real;
      while (s.frameClock >= frameTime) {
        s.frameClock -= frameTime;
        let dt = frameTime;
        if (s.spike > 0) { dt += s.spike; s.spike = 0; }

        // FIXED: accumulate, then consume in equal fixed steps
        s.accumulator += dt;
        s.fixedPrev = { ...s.fixed };
        let steps = 0;
        while (s.accumulator >= FIXED_DT && steps < MAX_STEPS) {
          step(s.fixed, FIXED_DT);
          s.accumulator -= FIXED_DT;
          steps++;
        }
        s.fixedSteps = steps;
        s.alpha = s.accumulator / FIXED_DT;

        // VARIABLE: one Euler step of the whole frame time
        step(s.variable, dt);
      }

      draw();

      // throttle readout updates (~12/s) to avoid churn
      s.readoutClock += real;
      if (s.readoutClock >= 0.08) {
        s.readoutClock = 0;
        const fx = lerp(s.fixedPrev.x, s.fixed.x, s.alpha);
        const fy = lerp(s.fixedPrev.y, s.fixed.y, s.alpha);
        setStats({
          fixedSteps: s.fixedSteps,
          alpha: s.alpha,
          driftFixed: dist(fx, fy, s.ref.x, s.ref.y),
          driftVar: dist(s.variable.x, s.variable.y, s.ref.x, s.ref.y),
        });
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  const onFps = (e: Event) => {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    setFps(v);
    fpsRef.current = v;
  };

  const reset = () => {
    simRef.current = makeSim();
    setStats({ fixedSteps: 0, alpha: 0, driftFixed: 0, driftVar: 0 });
    draw();
  };

  const spike = () => {
    simRef.current.spike += 0.6; // inject a 600 ms frame hitch
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
        <button
          onClick={spike}
          class="rounded-lg bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand transition hover:opacity-90"
        >
          Inject frame spike
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-56">
          <label class="block">
            <span class="mb-1 block text-muted">frame rate = {fps} fps</span>
            <input
              type="range" min={4} max={60} step={1} value={fps}
              onInput={onFps}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="fixed dt" value={`${(FIXED_DT * 1000).toFixed(1)} ms`} />
            <Readout label="fixed steps / frame" value={`${stats.fixedSteps}`} />
            <Readout label="interp α" value={stats.alpha.toFixed(2)} />
            <Readout label="frame dt" value={`${(1000 / fps).toFixed(0)} ms`} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3 space-y-1">
            <div class="flex justify-between">
              <span style={`color:${COLORS.fixed}`}>fixed drift</span>
              <strong class="font-mono">{stats.driftFixed.toFixed(2)} m</strong>
            </div>
            <div class="flex justify-between">
              <span style={`color:${COLORS.variable}`}>variable drift</span>
              <strong class="font-mono">{stats.driftVar.toFixed(2)} m</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              Drift = distance from the <span style={`color:${COLORS.truth}`}>emerald truth</span> ghost.
              Lower the frame rate or inject a spike and watch the variable ball drift while the fixed one
              tracks the truth.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
