import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Snapshots vs delta compression demo.
   - A world of entities; each network tick only a few of them change.
   - FULL snapshot: re-send every entity every tick (steady, heavy).
   - DELTA update: send only the entities that changed (light).
   - Changed entities flash on the grid; bandwidth bars compare the two.
   - Tick-driven by a rAF accumulator, cancelled on unmount.
   ------------------------------------------------------------------ */

const COLORS = {
  idle: 'rgba(128,128,128,0.30)',
  changed: '#f59e0b',
  full: '#0ea5e9',
  delta: '#10b981',
};

const BYTES_PER_ENTITY = 12; // id + x + y + hp
const DELTA_HEADER = 4;      // tick id + count
const TICK_MS = 600;

export default function SnapshotDeltaDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const changedRef = useRef<Set<number>>(new Set());
  const sizeRef = useRef({ w: 480, h: 260 });

  const [count, setCount] = useState(48);
  const [churn, setChurn] = useState(20); // % changing per tick
  const [totals, setTotals] = useState({ ticks: 0, full: 0, delta: 0 });

  const paramRef = useRef({ count, churn });
  paramRef.current = { count, churn };

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { count: n, churn: ch } = paramRef.current;

    // ---- tick: choose which entities changed ----
    if (now - lastTickRef.current >= TICK_MS) {
      lastTickRef.current = now;
      const changed = new Set<number>();
      const k = Math.round((ch / 100) * n);
      while (changed.size < k) changed.add(Math.floor(Math.random() * n));
      changedRef.current = changed;
      const fullBytes = n * BYTES_PER_ENTITY;
      const deltaBytes = DELTA_HEADER + changed.size * BYTES_PER_ENTITY;
      setTotals((t) => ({ ticks: t.ticks + 1, full: t.full + fullBytes, delta: t.delta + deltaBytes }));
    }

    ctx.clearRect(0, 0, w, h);

    // ---- entity grid ----
    const cols = Math.ceil(Math.sqrt(n * (w / h)));
    const rows = Math.ceil(n / cols);
    const cellW = w / cols;
    const cellH = h / rows;
    const rad = Math.max(4, Math.min(cellW, cellH) * 0.28);
    for (let i = 0; i < n; i++) {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + cellH / 2;
      const on = changedRef.current.has(i);
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = on ? COLORS.changed : COLORS.idle;
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.5);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const reset = () => { setTotals({ ticks: 0, full: 0, delta: 0 }); };

  const fullPerTick = count * BYTES_PER_ENTITY;
  const changedNow = Math.round((churn / 100) * count);
  const deltaPerTick = DELTA_HEADER + changedNow * BYTES_PER_ENTITY;
  const savings = fullPerTick ? Math.round((1 - deltaPerTick / fullPerTick) * 100) : 0;
  const barMax = Math.max(fullPerTick, 1);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">entities = {count}</span>
            <input type="range" min={8} max={120} step={4} value={count}
              onInput={(e) => setCount(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">changing per tick = {churn}%</span>
            <input type="range" min={2} max={100} step={1} value={churn}
              onInput={(e) => setChurn(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#f59e0b]" />
          </label>

          <div class="space-y-1">
            <Bar label="full snapshot" bytes={fullPerTick} max={barMax} color={COLORS.full} />
            <Bar label="delta update" bytes={deltaPerTick} max={barMax} color={COLORS.delta} />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="bandwidth saved" value={`${savings}%`} color={COLORS.delta} />
            <Readout label="ticks sent" value={`${totals.ticks}`} />
            <Readout label="full total" value={fmt(totals.full)} color={COLORS.full} />
            <Readout label="delta total" value={fmt(totals.delta)} color={COLORS.delta} />
          </div>
          <button onClick={reset}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
            Reset totals
          </button>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, bytes, max, color }: { label: string; bytes: number; max: number; color: string }) {
  const pct = Math.max(2, Math.round((bytes / max) * 100));
  return (
    <div>
      <div class="mb-0.5 flex justify-between text-xs text-muted">
        <span>{label}</span><span class="font-mono">{bytes} B/tick</span>
      </div>
      <div class="h-3 w-full overflow-hidden rounded-full bg-surface-2">
        <div class="h-full rounded-full" style={`width:${pct}%;background:${color}`} />
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

function fmt(bytes: number) {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
