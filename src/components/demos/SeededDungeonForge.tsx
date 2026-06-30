import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Seeded procedural generator.
   - One integer SEED drives a deterministic PRNG (mulberry32).
   - "Dungeon" mode scatters rooms and links them with corridors.
   - "Terrain" mode builds a height map from layered value noise.
   - Same seed -> same world, every time. Reseed to roll a new one.
   ------------------------------------------------------------------ */

const COLORS = {
  floor: '#4f46e5',
  corridor: 'rgba(79,70,229,0.45)',
  wall: 'rgba(128,128,128,0.10)',
};

type Mode = 'dungeon' | 'terrain';

// deterministic PRNG: same seed -> same stream
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID = 32; // cells per side

export default function SeededDungeonForge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360 });
  const [seed, setSeed] = useState(1337);
  const [mode, setMode] = useState<Mode>('dungeon');
  const [rooms, setRooms] = useState(0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w } = sizeRef.current;
    const cell = w / GRID;
    ctx.clearRect(0, 0, w, w);
    const rng = mulberry32(seed);

    if (mode === 'terrain') {
      // value-noise height map: smooth random grid, bilinearly sampled
      const N = 6;
      const lattice: number[][] = [];
      for (let y = 0; y <= N; y++) {
        lattice[y] = [];
        for (let x = 0; x <= N; x++) lattice[y][x] = rng();
      }
      const sample = (fx: number, fy: number) => {
        const gx = fx * N, gy = fy * N;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const tx = gx - x0, ty = gy - y0;
        const s = (t: number) => t * t * (3 - 2 * t); // smoothstep
        const a = lattice[y0][x0], b = lattice[y0][x0 + 1];
        const c = lattice[y0 + 1][x0], d = lattice[y0 + 1][x0 + 1];
        const top = a + (b - a) * s(tx);
        const bot = c + (d - c) * s(tx);
        return top + (bot - top) * s(ty);
      };
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const h = sample(x / GRID, y / GRID);
          // water -> sand -> grass -> rock -> snow
          let col: string;
          if (h < 0.35) col = '#0ea5e9';
          else if (h < 0.45) col = '#fcd34d';
          else if (h < 0.7) col = '#10b981';
          else if (h < 0.85) col = '#6b7280';
          else col = '#f1f5f9';
          ctx.fillStyle = col;
          ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
        }
      }
      setRooms(0);
      return;
    }

    // ---- dungeon: place non-overlapping rooms, connect in order ----
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, w, w);

    type Room = { x: number; y: number; rw: number; rh: number; cx: number; cy: number };
    const placed: Room[] = [];
    const attempts = 60;
    for (let i = 0; i < attempts && placed.length < 9; i++) {
      const rw = 3 + Math.floor(rng() * 5);
      const rh = 3 + Math.floor(rng() * 5);
      const x = 1 + Math.floor(rng() * (GRID - rw - 2));
      const y = 1 + Math.floor(rng() * (GRID - rh - 2));
      const overlaps = placed.some(
        (r) => x < r.x + r.rw + 1 && x + rw + 1 > r.x && y < r.y + r.rh + 1 && y + rh + 1 > r.y,
      );
      if (overlaps) continue;
      placed.push({ x, y, rw, rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
    }

    // corridors: L-shaped link between consecutive room centres
    ctx.fillStyle = COLORS.corridor;
    for (let i = 1; i < placed.length; i++) {
      const a = placed[i - 1], b = placed[i];
      const x0 = Math.min(a.cx, b.cx), x1 = Math.max(a.cx, b.cx);
      for (let x = x0; x <= x1; x++) ctx.fillRect(x * cell, a.cy * cell, cell, cell);
      const y0 = Math.min(a.cy, b.cy), y1 = Math.max(a.cy, b.cy);
      for (let y = y0; y <= y1; y++) ctx.fillRect(b.cx * cell, y * cell, cell, cell);
    }

    // rooms on top
    ctx.fillStyle = COLORS.floor;
    for (const r of placed) {
      ctx.fillRect(r.x * cell, r.y * cell, r.rw * cell, r.rh * cell);
    }
    setRooms(placed.length);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [seed, mode]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['dungeon', 'terrain'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m}
          </button>
        ))}
        <button
          onClick={() => setSeed(Math.floor(Math.random() * 100000))}
          class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reseed
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">seed = {seed}</span>
            <input
              type="range" min={0} max={2000} step={1} value={seed}
              onInput={(e) => setSeed(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="seed" value={String(seed)} />
            <Readout label={mode === 'dungeon' ? 'rooms' : 'mode'} value={mode === 'dungeon' ? String(rooms) : 'noise'} />
          </div>
          <p class="text-xs text-muted">
            Drag the seed or hit Reseed. Land on the same seed again and you rebuild the exact same
            world — that determinism is what lets a whole galaxy fit in a save file.
          </p>
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
