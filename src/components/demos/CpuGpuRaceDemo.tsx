import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   CPU vs GPU "shading" race.
   - The SAME grid of pixels is colored by two machines.
   - CPU: a few cores color a handful of pixels per tick (serial).
   - GPU: dozens of cores light up a big swath per tick (parallel).
   - Press Run to race them; ticks = units of time, lower is faster.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  cpu: '#4f46e5', // indigo
  gpu: '#10b981', // emerald
  cursor: '#0ea5e9', // sky
  empty: 'rgba(128,128,128,0.18)',
  gridLine: 'rgba(128,128,128,0.28)',
};

const GPU_LANES = 64; // how many pixels the GPU shades per tick (its many cores)

type Race = {
  cpuDone: number;
  gpuDone: number;
  cpuTicks: number;
  gpuTicks: number;
  running: boolean;
};

export default function CpuGpuRaceDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gridSize, setGridSize] = useState(16); // cells per side
  const [cpuCores, setCpuCores] = useState(2);
  const [race, setRace] = useState<Race>({ cpuDone: 0, gpuDone: 0, cpuTicks: 0, gpuTicks: 0, running: false });

  const raceRef = useRef<Race>(race);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 520, h: 320, gap: 16, panelW: 244, cell: 15, top: 28 });
  const total = gridSize * gridSize;

  // keep the mutable ref in sync so the animation loop reads fresh values
  raceRef.current = race;

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const gap = 16;
      const panelW = (w - gap) / 2;
      const top = 28; // room for the panel labels
      const cell = panelW / gridSize;
      const h = top + panelW; // square panels
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, gap, panelW, cell, top };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize]);

  // redraw whenever the race state or grid changes
  useEffect(draw, [race, gridSize]);

  // cancel any animation when the component unmounts
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, gap, panelW, cell, top } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    drawPanel(ctx, 0, top, panelW, cell, gridSize, raceRef.current.cpuDone, COLORS.cpu);
    drawPanel(ctx, panelW + gap, top, panelW, cell, gridSize, raceRef.current.gpuDone, COLORS.gpu);

    // panel titles
    ctx.font = '700 13px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.cpu;
    ctx.fillText(`CPU · ${cpuCores} core${cpuCores > 1 ? 's' : ''}`, 2, 14);
    ctx.fillStyle = COLORS.gpu;
    ctx.fillText(`GPU · ${GPU_LANES} cores`, panelW + gap + 2, 14);
  }

  function startRace() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    raceRef.current = { cpuDone: 0, gpuDone: 0, cpuTicks: 0, gpuTicks: 0, running: true };
    setRace(raceRef.current);
    // animate faster on big grids so it always finishes in a few seconds
    const stepsPerFrame = Math.max(1, Math.round(total / 240));

    const frame = () => {
      const r = { ...raceRef.current };
      for (let s = 0; s < stepsPerFrame; s++) {
        if (r.cpuDone < total) {
          r.cpuDone = Math.min(total, r.cpuDone + cpuCores);
          r.cpuTicks += 1;
        }
        if (r.gpuDone < total) {
          r.gpuDone = Math.min(total, r.gpuDone + GPU_LANES);
          r.gpuTicks += 1;
        }
      }
      const done = r.cpuDone >= total && r.gpuDone >= total;
      r.running = !done;
      raceRef.current = r;
      setRace(r);
      if (!done) rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  const speedup = race.gpuTicks > 0 ? race.cpuTicks / race.gpuTicks : 0;
  const cpuPct = Math.round((race.cpuDone / total) * 100);
  const gpuPct = Math.round((race.gpuDone / total) * 100);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={startRace}
          disabled={race.running}
          class={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            race.running ? 'bg-surface-2 text-muted' : 'bg-brand text-white hover:opacity-90'
          }`}
        >
          {race.running ? 'Shading…' : '▶ Run the race'}
        </button>
        <span class="text-xs text-muted">{total.toLocaleString()} pixels to shade</span>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="space-y-2">
          <Bar label="CPU" pct={cpuPct} color={COLORS.cpu} />
          <Bar label="GPU" pct={gpuPct} color={COLORS.gpu} />
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <Readout label="CPU ticks" value={race.cpuTicks.toLocaleString()} color={COLORS.cpu} />
          <Readout label="GPU ticks" value={race.gpuTicks.toLocaleString()} color={COLORS.gpu} />
          <Readout label="px / tick" value={`${cpuCores}`} color={COLORS.cpu} />
          <Readout label="px / tick" value={`${GPU_LANES}`} color={COLORS.gpu} />
        </div>
      </div>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">grid size = {gridSize} × {gridSize}</span>
          <input
            type="range" min={8} max={40} step={4} value={gridSize}
            disabled={race.running}
            onInput={(e) => setGridSize(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">CPU cores = {cpuCores}</span>
          <input
            type="range" min={1} max={4} step={1} value={cpuCores}
            disabled={race.running}
            onInput={(e) => setCpuCores(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]"
          />
        </label>
      </div>

      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        {race.cpuTicks > 0 && !race.running ? (
          <p>
            The GPU finished in <strong style={`color:${COLORS.gpu}`}>{race.gpuTicks}</strong> ticks vs the CPU's{' '}
            <strong style={`color:${COLORS.cpu}`}>{race.cpuTicks}</strong> — a{' '}
            <strong>{speedup.toFixed(1)}×</strong> speedup. Each pixel is independent, so throughput wins.
          </p>
        ) : (
          <p class="text-muted">Press <strong>Run</strong>. The GPU shades {GPU_LANES} pixels every tick; the CPU only {cpuCores}. Same work, very different time.</p>
        )}
      </div>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div class="mb-1 flex justify-between text-xs text-muted">
        <span style={`color:${color}`}>{label}</span>
        <span>{pct}%</span>
      </div>
      <div class="h-3 w-full overflow-hidden rounded-full bg-surface-2">
        <div class="h-full rounded-full transition-all" style={`width:${pct}%;background:${color}`} />
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

// ---- canvas: draw one grid panel, first `done` cells filled (row-major) ----
function drawPanel(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, panelW: number, cell: number, n: number, done: number, color: string,
) {
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const px = x0 + c * cell;
    const py = y0 + r * cell;
    ctx.fillStyle = i < done ? color : COLORS.empty;
    ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
  }
  // the "next pixel" cursor shows where work is happening
  if (done > 0 && done < n * n) {
    const r = Math.floor(done / n);
    const c = done % n;
    ctx.strokeStyle = COLORS.cursor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + c * cell + 1, y0 + r * cell + 1, cell - 2, cell - 2);
  }
  // panel border
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, panelW, panelW);
}
