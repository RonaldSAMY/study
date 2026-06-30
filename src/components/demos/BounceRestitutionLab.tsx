import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Restitution + friction sandbox.
   - Several balls fall under gravity inside a closed box.
   - On contact with a wall/floor the NORMAL velocity flips and is
     scaled by the restitution e (bounciness, 0..1); the TANGENTIAL
     velocity is scaled down by friction.
   - With e < 1 each bounce keeps less energy, so the balls settle.
   Canvas conventions copied from VectorPlayground / DampedSpringLab.
   ------------------------------------------------------------------ */

type Ball = { x: number; y: number; vx: number; vy: number; r: number; color: string };

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981'];
const COLORS = {
  wall: 'rgba(128,128,128,0.55)',
  grid: 'rgba(128,128,128,0.14)',
  text: '#94a3b8',
};
const G = 1500; // gravity, px/s^2

export default function BounceRestitutionLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [restitution, setRestitution] = useState(0.75);
  const [friction, setFriction] = useState(0.04);
  const [playing, setPlaying] = useState(true);
  const [count, setCount] = useState(0);

  const ballsRef = useRef<Ball[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const sizeRef = useRef({ w: 480, h: 340 });

  // mirror latest control values for the animation loop
  const restRef = useRef(restitution);
  const fricRef = useRef(friction);
  const playRef = useRef(playing);
  restRef.current = restitution;
  fricRef.current = friction;
  playRef.current = playing;

  const dropBalls = (n = 6) => {
    const { w } = sizeRef.current;
    for (let i = 0; i < n; i++) {
      const r = 12 + Math.random() * 10;
      ballsRef.current.push({
        x: r + Math.random() * (w - 2 * r),
        y: r + Math.random() * 70,
        vx: (Math.random() - 0.5) * 320,
        vy: Math.random() * 120,
        r,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
    setCount(ballsRef.current.length);
  };

  const reset = () => {
    ballsRef.current = [];
    setCount(0);
  };

  // one physics step
  const step = (dt: number) => {
    const { w, h } = sizeRef.current;
    const e = restRef.current;
    const f = fricRef.current;
    const keep = 1 - f;
    for (const b of ballsRef.current) {
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // floor / ceiling: normal is vertical, tangential is horizontal
      if (b.y + b.r > h) {
        b.y = h - b.r;
        b.vy = -b.vy * e;
        b.vx *= keep;
        if (Math.abs(b.vy) < 28) b.vy = 0; // let it settle, no jitter
      } else if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy = -b.vy * e;
        b.vx *= keep;
      }

      // walls: normal is horizontal, tangential is vertical
      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx = -b.vx * e;
        b.vy *= keep;
      } else if (b.x + b.r > w) {
        b.x = w - b.r;
        b.vx = -b.vx * e;
        b.vy *= keep;
      }
    }
  };

  const totalEnergy = () => {
    const { h } = sizeRef.current;
    let E = 0;
    for (const b of ballsRef.current) {
      const m = b.r * b.r * 0.001;
      const v2 = b.vx * b.vx + b.vy * b.vy;
      E += m * (0.5 * v2 + G * (h - b.y));
    }
    return E;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 40; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // box border
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

    // balls
    for (const b of ballsRef.current) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }

    // energy readout (drawn, since it changes every frame)
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`total energy: ${totalEnergy().toFixed(1)}`, 12, h - 12);
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
      // keep balls inside the new bounds
      for (const b of ballsRef.current) {
        b.x = Math.max(b.r, Math.min(w - b.r, b.x));
        b.y = Math.max(b.r, Math.min(h - b.r, b.y));
      }
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // initial drop (after the first resize has set the size)
  useEffect(() => { dropBalls(); }, []);

  // animation loop
  useEffect(() => {
    const loop = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      let dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      dt = Math.min(0.033, dt);
      if (playRef.current) step(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${playing ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => dropBalls()}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Drop balls
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Set the <strong>restitution</strong> low and watch the bounces shrink as energy leaks away;
            raise <strong>friction</strong> to bleed off the sideways speed on each contact.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">restitution e = {restitution.toFixed(2)} (bounciness)</span>
            <input
              type="range" min={0} max={1} step={0.01} value={restitution}
              onInput={(ev) => setRestitution(parseFloat((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">friction = {friction.toFixed(2)}</span>
            <input
              type="range" min={0} max={0.4} step={0.01} value={friction}
              onInput={(ev) => setFriction(parseFloat((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-3 gap-2">
            <Readout label="restitution" color="#4f46e5" value={restitution.toFixed(2)} />
            <Readout label="friction" color="#10b981" value={friction.toFixed(2)} />
            <Readout label="balls" value={`${count}`} />
          </div>

          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            e = 1 is a perfect (lossless) bounce; e = 0 means the ball sticks with no rebound. Real
            materials live in between, so the total energy ticks downward every bounce.
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
