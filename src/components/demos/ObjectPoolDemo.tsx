import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Object Pool demo.
   A fountain of short-lived particles is spawned and despawned every
   frame. Toggle between:
     - "Allocate fresh"  -> a brand-new object every spawn (allocations
        climb forever; the simulated GC fires periodically and the
        frame-time graph spikes).
     - "Object pool"     -> objects are acquired from / released to a
        free list (allocations plateau at the pool size; GC stays calm).
   Canvas follows the VectorPlayground conventions: devicePixelRatio
   scaling, responsive resize, redraw via the animation loop, and a
   cancelled requestAnimationFrame on unmount.
   ------------------------------------------------------------------ */

const COLORS = {
  pool: '#10b981',   // emerald  - reused / calm
  fresh: '#4f46e5',  // indigo   - freshly allocated
  spark: '#0ea5e9',  // sky      - accent
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;   // remaining life in frames
  max: number;    // initial life
  fresh: boolean; // was this object newly allocated this spawn?
  active: boolean;
};

const POOL_SIZE = 60;
const SPAWN_PER_FRAME = 3;

export default function ObjectPoolDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [usePool, setUsePool] = useState(true);
  const [running, setRunning] = useState(true);

  // counters surfaced to the UI
  const [stats, setStats] = useState({
    allocations: 0,
    reuses: 0,
    live: 0,
    gcSpike: false,
    gcCount: 0,
  });

  // mutable simulation state (kept in refs so the rAF loop is stable)
  const sizeRef = useRef({ w: 480, h: 300, dpr: 1 });
  const usePoolRef = useRef(usePool);
  const runningRef = useRef(running);
  const liveRef = useRef<Particle[]>([]);
  const freeRef = useRef<Particle[]>([]);     // pool free list
  const allocRef = useRef(0);                  // total objects ever allocated
  const reuseRef = useRef(0);                  // total acquires served from pool
  const sinceGcRef = useRef(0);                // fresh allocs since last GC
  const gcFlashRef = useRef(0);                // frames remaining of GC flash
  const gcCountRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);  // recent frame durations (ms)
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => { usePoolRef.current = usePool; }, [usePool]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // ---- acquire / release: the heart of the demo ----
  const acquire = (): Particle => {
    if (usePoolRef.current) {
      const recycled = freeRef.current.pop();
      if (recycled) {
        reuseRef.current += 1;
        recycled.fresh = false;
        recycled.active = true;
        return recycled;
      }
      // pool empty -> we must allocate to grow it (only until POOL_SIZE filled)
      allocRef.current += 1;
      return makeParticle(true);
    }
    // allocate-fresh mode: a new object EVERY spawn
    allocRef.current += 1;
    sinceGcRef.current += 1;
    return makeParticle(true);
  };

  const release = (p: Particle) => {
    p.active = false;
    if (usePoolRef.current && freeRef.current.length < POOL_SIZE) {
      freeRef.current.push(p);      // back to the free list, ready to reuse
    }
    // in fresh mode we simply drop it -> becomes garbage for the GC
  };

  const reset = () => {
    liveRef.current = [];
    freeRef.current = [];
    allocRef.current = 0;
    reuseRef.current = 0;
    sinceGcRef.current = 0;
    gcFlashRef.current = 0;
    gcCountRef.current = 0;
    frameTimesRef.current = [];
    setStats({ allocations: 0, reuses: 0, live: 0, gcSpike: false, gcCount: 0 });
  };

  // ---- main loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let statTick = 0;

    const step = (now: number) => {
      const last = lastTimeRef.current || now;
      let dt = now - last;
      lastTimeRef.current = now;

      if (runningRef.current) {
        // spawn new particles from the fountain
        const { w, h } = sizeRef.current;
        const ox = w / 2;
        const oy = h - 18;
        for (let i = 0; i < SPAWN_PER_FRAME; i++) {
          const p = acquire();
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
          const speed = 3 + Math.random() * 3.2;
          p.x = ox + (Math.random() - 0.5) * 14;
          p.y = oy;
          p.vx = Math.cos(ang) * speed;
          p.vy = Math.sin(ang) * speed;
          p.max = 55 + Math.floor(Math.random() * 45);
          p.life = p.max;
          liveRef.current.push(p);
        }

        // advance live particles
        const survivors: Particle[] = [];
        for (const p of liveRef.current) {
          p.vy += 0.12;            // gravity
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1;
          if (p.life > 0 && p.y < h + 20) survivors.push(p);
          else release(p);
        }
        liveRef.current = survivors;

        // simulated garbage collector (fresh mode only):
        // when enough fresh garbage piles up, the GC "stops the world"
        if (!usePoolRef.current && sinceGcRef.current >= 90) {
          sinceGcRef.current = 0;
          gcFlashRef.current = 18;
          gcCountRef.current += 1;
          dt += 26;               // simulated stop-the-world stutter for the graph
        }
        if (gcFlashRef.current > 0) gcFlashRef.current -= 1;

        // record frame time for the stutter graph
        const ft = frameTimesRef.current;
        ft.push(dt);
        if (ft.length > 90) ft.shift();
      }

      draw(canvas);

      // throttle React state updates (~6/sec) to keep the readouts cheap
      statTick += 1;
      if (statTick % 10 === 0) {
        setStats({
          allocations: allocRef.current,
          reuses: reuseRef.current,
          live: liveRef.current.length,
          gcSpike: gcFlashRef.current > 0,
          gcCount: gcCountRef.current,
        });
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, dpr };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const draw = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 36) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = h % 36; gy < h; gy += 36) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // ground line + fountain nozzle
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, h - 16); ctx.lineTo(w, h - 16); ctx.stroke();

    // particles
    for (const p of liveRef.current) {
      const alpha = Math.max(0.15, p.life / p.max);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.fresh ? COLORS.fresh : COLORS.pool;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // frame-time stutter graph (top-left)
    const ft = frameTimesRef.current;
    const gW = Math.min(150, w - 24);
    const gH = 38;
    const gx0 = 12;
    const gy0 = 12;
    ctx.fillStyle = 'rgba(128,128,128,0.10)';
    ctx.fillRect(gx0, gy0, gW, gH);
    // 16ms (~60fps) reference line
    const maxMs = 50;
    const refY = gy0 + gH - (16 / maxMs) * gH;
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(gx0, refY); ctx.lineTo(gx0 + gW, refY); ctx.stroke();
    ctx.setLineDash([]);
    if (ft.length > 1) {
      ctx.strokeStyle = usePoolRef.current ? COLORS.pool : COLORS.fresh;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < ft.length; i++) {
        const x = gx0 + (i / (ft.length - 1)) * gW;
        const y = gy0 + gH - Math.min(1, ft[i] / maxMs) * gH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.spark;
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText('frame time (spikes = stutter)', gx0, gy0 + gH + 12);

    // GC flash overlay (fresh mode)
    if (gcFlashRef.current > 0) {
      const a = (gcFlashRef.current / 18) * 0.22;
      ctx.fillStyle = `rgba(79,70,229,${a})`;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.fresh;
      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillText('GC pause!', w - 92, 26);
    }
  };

  const heavyAlloc = !usePool && stats.allocations > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setUsePool(true); reset(); }}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            usePool ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Use object pool
        </button>
        <button
          onClick={() => { setUsePool(false); reset(); }}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            !usePool ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Allocate fresh every spawn
        </button>
        <div class="ml-auto flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          >
            {running ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={reset}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          >
            Reset
          </button>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            A fountain spawns short-lived particles every frame.{' '}
            {usePool
              ? 'In pool mode, dead particles return to a free list and get reused.'
              : 'In fresh mode, every spawn allocates a new object — soon the garbage collector must pause to clean up.'}
          </p>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="Total allocations" value={String(stats.allocations)} color={COLORS.fresh} />
            <Readout label="Pool reuses" value={String(stats.reuses)} color={COLORS.pool} />
            <Readout label="Live objects" value={String(stats.live)} color={COLORS.spark} />
            <Readout label="GC pauses" value={String(stats.gcCount)} />
          </div>

          <div
            class={`rounded-lg p-3 text-xs ${
              stats.gcSpike
                ? 'bg-brand-soft text-brand'
                : 'bg-surface-2 text-muted'
            }`}
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold">GC status</span>
              <strong>{stats.gcSpike ? '⚠ stop-the-world pause' : '✓ calm'}</strong>
            </div>
            <p class="mt-1">
              {usePool
                ? 'Allocations plateau at the pool size, so the collector has almost nothing to do — frame time stays flat.'
                : heavyAlloc
                  ? 'Garbage keeps piling up; each periodic GC pause spikes the frame-time graph (a visible hitch).'
                  : 'Allocations are climbing — watch the graph spike when the GC fires.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function makeParticle(fresh: boolean): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, fresh, active: true };
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold text-text">{value}</div>
    </div>
  );
}
