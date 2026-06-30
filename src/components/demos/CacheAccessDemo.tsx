import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Cache & locality playground.
   - 64 cells laid out as 8 rows; each ROW is one cache LINE (8 cells).
   - Toggle Sequential vs Random access. Step or Run an access pointer.
   - The cache holds only 2 lines (LRU). Touching a cell whose line is
     not loaded is a MISS (red, slow) and loads the whole line (tint).
     Touching a cell in a loaded line is a HIT (green, fast).
   - Sequential gives a high hit rate; random thrashes the cache.
   ------------------------------------------------------------------ */

const LINE = 8; // cells per cache line
const LINES = 8; // total lines in "RAM"
const TOTAL = LINE * LINES; // 64 cells
const CAPACITY = 2; // lines the cache can hold (LRU)
const HIT_COST = 4; // ~L1 latency, cycles (illustrative)
const MISS_COST = 200; // ~RAM latency, cycles (illustrative)
const STEP_MS = 260;
const RUN_CAP = 96; // auto-pause after this many accesses

const COLORS = {
  loaded: 'rgba(14,165,233,0.18)', // sky tint = line currently in cache
  empty: 'rgba(128,128,128,0.10)',
  border: 'rgba(128,128,128,0.28)',
  hit: '#10b981',
  miss: '#ef4444',
  text: 'rgba(128,128,128,0.85)',
};

type Mode = 'sequential' | 'random';
type Result = 'hit' | 'miss' | null;
type Sim = {
  ptr: number; // next sequential index
  cache: number[]; // loaded line indices, oldest first (LRU)
  lastIndex: number; // last cell touched (-1 = none)
  lastResult: Result;
  accesses: number;
  hits: number;
  misses: number;
  cycles: number;
};

const initSim = (): Sim => ({
  ptr: 0,
  cache: [],
  lastIndex: -1,
  lastResult: null,
  accesses: 0,
  hits: 0,
  misses: 0,
  cycles: 0,
});

function computeNext(prev: Sim, mode: Mode): Sim {
  const idx = mode === 'sequential' ? prev.ptr : Math.floor(Math.random() * TOTAL);
  const line = Math.floor(idx / LINE);
  const hit = prev.cache.includes(line);

  let cache: number[];
  if (hit) {
    // move the line to "most recently used"
    cache = prev.cache.filter((l) => l !== line);
    cache.push(line);
  } else {
    cache = [...prev.cache, line];
    if (cache.length > CAPACITY) cache.shift(); // evict oldest
  }

  return {
    ptr: mode === 'sequential' ? (idx + 1) % TOTAL : prev.ptr,
    cache,
    lastIndex: idx,
    lastResult: hit ? 'hit' : 'miss',
    accesses: prev.accesses + 1,
    hits: prev.hits + (hit ? 1 : 0),
    misses: prev.misses + (hit ? 0 : 1),
    cycles: prev.cycles + (hit ? HIT_COST : MISS_COST),
  };
}

export default function CacheAccessDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, cell: 40 });
  const [mode, setMode] = useState<Mode>('sequential');
  const [sim, setSim] = useState<Sim>(initSim);
  const [running, setRunning] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const stepOnce = () => setSim((prev) => computeNext(prev, modeRef.current));

  const reset = () => {
    setRunning(false);
    setSim(initSim());
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  // ---- draw ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell } = sizeRef.current;
    const gridW = cell * LINE;
    const gridH = cell * LINES;
    ctx.clearRect(0, 0, gridW, gridH);

    for (let i = 0; i < TOTAL; i++) {
      const line = Math.floor(i / LINE);
      const col = i % LINE;
      const x = col * cell;
      const y = line * cell;
      const loaded = sim.cache.includes(line);
      const current = i === sim.lastIndex;

      // cell fill
      if (current && sim.lastResult) {
        ctx.fillStyle = sim.lastResult === 'hit' ? COLORS.hit : COLORS.miss;
      } else {
        ctx.fillStyle = loaded ? COLORS.loaded : COLORS.empty;
      }
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

      // border (thick + colored for the current cell)
      if (current && sim.lastResult) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = sim.lastResult === 'hit' ? COLORS.hit : COLORS.miss;
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLORS.border;
      }
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);

      // index label
      ctx.fillStyle = current ? '#ffffff' : COLORS.text;
      ctx.font = `${Math.max(9, cell * 0.26)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), x + cell / 2, y + cell / 2);
    }
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 440);
      const cell = Math.max(20, Math.min(46, Math.floor(w / LINE)));
      const gridW = cell * LINE;
      const gridH = cell * LINES;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gridW * dpr;
      canvas.height = gridH * dpr;
      canvas.style.width = `${gridW}px`;
      canvas.style.height = `${gridH}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, cell };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on state change
  useEffect(draw, [sim]);

  // ---- run loop ----
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      if (t - last >= STEP_MS) {
        last = t;
        setSim((prev) => {
          if (prev.accesses >= RUN_CAP) {
            setRunning(false);
            return prev;
          }
          return computeNext(prev, modeRef.current);
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const hitRate = sim.accesses ? (100 * sim.hits) / sim.accesses : 0;
  const avg = sim.accesses ? sim.cycles / sim.accesses : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['sequential', 'random'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m}
          </button>
        ))}
        <div class="mx-1 h-5 w-px bg-border" />
        <button
          onClick={stepOnce}
          disabled={running}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-50"
        >
          Step
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft"
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Each <strong>row is one cache line</strong> (8 cells). The cache holds only {CAPACITY}{' '}
            lines at once — sky-tinted rows are loaded.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="accesses" value={String(sim.accesses)} />
            <Readout
              label="last"
              value={sim.lastResult ? sim.lastResult.toUpperCase() : '—'}
              color={sim.lastResult === 'hit' ? COLORS.hit : sim.lastResult === 'miss' ? COLORS.miss : undefined}
            />
            <Readout label="hits" value={String(sim.hits)} color={COLORS.hit} />
            <Readout label="misses" value={String(sim.misses)} color={COLORS.miss} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">hit rate</span>
              <strong>{hitRate.toFixed(0)}%</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">est. cycles</span>
              <strong>{sim.cycles.toLocaleString()}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">avg / access</span>
              <strong>{avg.toFixed(0)} cyc</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {mode === 'sequential'
                ? 'One miss loads a whole line, then 7 cheap hits follow.'
                : 'Random jumps keep landing in lines that were just evicted.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>
        {value}
      </div>
    </div>
  );
}
