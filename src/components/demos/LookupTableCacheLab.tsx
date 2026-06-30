import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Space-time tradeoff lab: pay memory, save time.
   - Two classic games/CS scenarios:
       * "fib"      : naive recursion vs memoized Fibonacci.
       * "sintable" : recompute Math.sin per call vs a precomputed
                      lookup table (the trick old games used for waves,
                      rotations and particles).
   - Slide the workload. Two bars compare NAIVE (red) vs CACHED (green)
     time on a log scale, with a dashed 60fps frame-budget line.
   - Readouts show time saved and the memory you spent to buy it.
   ------------------------------------------------------------------ */

type Mode = 'fib' | 'sintable';

const COLORS = {
  naive: '#ef4444',
  cache: '#10b981',
  mem: '#0ea5e9',
  budget: 'rgba(128,128,128,0.7)',
  track: 'rgba(128,128,128,0.18)',
};

const FRAME_NS = 16_700_000; // 16.7 ms budget at 60fps
const NS_CALL = 6; // cost of one recursive call (illustrative)
const NS_SIN = 22; // cost of one real Math.sin (illustrative)
const NS_LOOKUP = 1.2; // cost of one array lookup (illustrative)

// Fibonacci helpers (closed counting, no real recursion needed)
function fib(k: number): number {
  let a = 0;
  let b = 1;
  for (let i = 0; i < k; i++) {
    const t = a + b;
    a = b;
    b = t;
  }
  return a;
}

function formatTime(ns: number): string {
  if (ns < 1_000) return `${ns.toFixed(0)} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  return `${(ns / 1_000_000_000).toFixed(2)} s`;
}

function formatMem(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LookupTableCacheLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('fib');
  const [level, setLevel] = useState(0.45); // 0..1 slider, mapped per mode
  const sizeRef = useRef({ w: 480, h: 200 });
  const sceneRef = useRef<{
    naiveNs: number;
    cacheNs: number;
  }>({ naiveNs: 1, cacheNs: 1 });

  // ---- map slider to a workload and compute costs ----
  let workLabel = '';
  let naiveOps = 0;
  let cacheOps = 0;
  let naiveNs = 0;
  let cacheNs = 0;
  let memBytes = 0;
  let memLabel = '';

  if (mode === 'fib') {
    const n = 5 + Math.round(level * 32); // n in 5..37
    naiveOps = 2 * fib(n + 1) - 1; // naive recursive calls
    cacheOps = Math.max(1, 2 * n - 1); // memoized: each subproblem once
    naiveNs = naiveOps * NS_CALL;
    cacheNs = cacheOps * NS_CALL;
    memBytes = (n + 1) * 8; // one cache cell (8 bytes) per subproblem
    workLabel = `fibonacci(${n})`;
    memLabel = `${n + 1} cached values`;
  } else {
    const calls = Math.round(2000 * Math.pow(10, level * 3)); // 2k .. 2M sin calls / frame
    const tableEntries = 4096; // precomputed sin table
    naiveOps = calls;
    cacheOps = calls;
    naiveNs = calls * NS_SIN;
    cacheNs = calls * NS_LOOKUP; // table build is amortized once at load
    memBytes = tableEntries * 4; // 4 bytes per float entry
    workLabel = `${calls.toLocaleString()} sin() per frame`;
    memLabel = `${tableEntries}-entry sin table`;
  }

  sceneRef.current = { naiveNs, cacheNs };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { naiveNs: nn, cacheNs: cn } = sceneRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 64;
    const padR = 18;
    const barW = w - padL - padR;
    const barH = 30;
    const gap = 30;
    const topY = 34;

    // log scale: map ns -> fraction of bar. floor at 1 ns.
    const maxNs = Math.max(nn, cn, FRAME_NS) * 1.15;
    const logMin = Math.log10(1);
    const logMax = Math.log10(maxNs);
    const frac = (ns: number) => {
      const v = (Math.log10(Math.max(1, ns)) - logMin) / (logMax - logMin);
      return Math.max(0.012, Math.min(1, v));
    };

    const rows: { label: string; ns: number; color: string }[] = [
      { label: 'naive', ns: nn, color: COLORS.naive },
      { label: 'cached', ns: cn, color: COLORS.cache },
    ];

    ctx.font = '600 13px Inter, sans-serif';
    ctx.textBaseline = 'middle';

    rows.forEach((row, i) => {
      const y = topY + i * (barH + gap);
      // label
      ctx.fillStyle = row.color;
      ctx.textAlign = 'right';
      ctx.fillText(row.label, padL - 12, y + barH / 2);
      // track
      ctx.fillStyle = COLORS.track;
      roundRect(ctx, padL, y, barW, barH, 7);
      ctx.fill();
      // value bar
      ctx.fillStyle = row.color;
      roundRect(ctx, padL, y, barW * frac(row.ns), barH, 7);
      ctx.fill();
      // time text
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(row.ns), padL + 8, y + barH / 2);
    });

    // frame-budget marker
    const bx = padL + barW * frac(FRAME_NS);
    ctx.strokeStyle = COLORS.budget;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, topY - 12);
    ctx.lineTo(bx, topY + 2 * barH + gap + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.budget;
    ctx.textAlign = 'center';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText('60fps budget', bx, topY - 18);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = 170;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [mode, level]);

  const saved = naiveNs - cacheNs;
  const speedup = cacheNs > 0 ? naiveNs / cacheNs : 0;
  const fitsNaive = naiveNs <= FRAME_NS;
  const fitsCache = cacheNs <= FRAME_NS;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['fib', 'sintable'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setLevel(0.45);
            }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'fib' ? 'memoized Fibonacci' : 'sin lookup table'}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">
            workload: <strong class="text-text">{workLabel}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={level}
            onInput={(e) => setLevel(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]"
          />
        </label>

        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Readout label="time saved" value={formatTime(Math.max(0, saved))} color={COLORS.cache} />
          <Readout label="speedup" value={`${speedup >= 100 ? speedup.toFixed(0) : speedup.toFixed(1)}×`} />
          <Readout label="memory spent" value={formatMem(memBytes)} color={COLORS.mem} />
          <Readout label="that buys" value={memLabel} />
        </div>

        <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          <p>
            Naive {fitsNaive ? 'fits' : <strong class="text-[#ef4444]">blows past</strong>} the 16.7 ms
            frame budget; cached {fitsCache ? 'fits comfortably' : 'still struggles'}. You traded{' '}
            <strong style={`color:${COLORS.mem}`}>{formatMem(memBytes)}</strong> of memory for a{' '}
            <strong style={`color:${COLORS.cache}`}>
              {speedup >= 100 ? speedup.toFixed(0) : speedup.toFixed(1)}×
            </strong>{' '}
            speedup — the whole bargain in one picture.
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
