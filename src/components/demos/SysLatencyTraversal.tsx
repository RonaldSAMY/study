import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated latency traversal.
   A single request walks through storage / network tiers, and we watch
   the cumulative time explode as it moves from cache to memory to disk
   to the network. Numbers are the classic "latency numbers every
   programmer should know" (see /dsa/system-design/10-estimation/latency-numbers.ts).
   - Pick a scenario, then Step / Play through each tier.
   - The active tier is highlighted, with a live caption.
   - Toggle "human scale" to stretch 1 ns -> 1 s so the gaps become visceral.
   Transport: Play / Pause / Step / Back / Reset + speed. Index-driven,
   requestAnimationFrame autoplay, cancelled on pause/unmount.
   ------------------------------------------------------------------ */

type Stage = { label: string; ns: number };
type Scenario = { id: string; label: string; stages: Stage[] };

const SCENARIOS: Scenario[] = [
  {
    id: 'cache',
    label: 'In-memory cache hit',
    stages: [
      { label: 'L1 cache reference', ns: 0.5 },
      { label: 'L2 cache reference', ns: 7 },
      { label: 'Main memory reference', ns: 100 },
    ],
  },
  {
    id: 'ssd',
    label: 'Cache miss → read from SSD',
    stages: [
      { label: 'Main memory reference', ns: 100 },
      { label: 'Read 4KB randomly from SSD', ns: 150_000 },
    ],
  },
  {
    id: 'dc',
    label: 'Same-datacenter RPC',
    stages: [
      { label: 'Main memory reference', ns: 100 },
      { label: 'Send 1KB over 1 Gbps network', ns: 10_000 },
      { label: 'Round trip within same datacenter', ns: 500_000 },
    ],
  },
  {
    id: 'hdd',
    label: 'Read 1MB from spinning disk',
    stages: [
      { label: 'HDD seek', ns: 10_000_000 },
      { label: 'Read 1MB sequentially from HDD', ns: 20_000_000 },
    ],
  },
  {
    id: 'global',
    label: 'Cross-continent API call',
    stages: [
      { label: 'Round trip within same datacenter', ns: 500_000 },
      { label: 'Send packet CA → Netherlands → CA', ns: 150_000_000 },
    ],
  },
];

const COLORS = { active: '#0ea5e9', done: '#10b981', bar: '#4f46e5' };
const MAX_NS = 150_000_000;

function fmtNs(ns: number): string {
  if (ns < 1_000) return `${ns} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toLocaleString()} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toLocaleString()} ms`;
  return `${(ns / 1_000_000_000).toFixed(2)} s`;
}

// 1 ns stretched to 1 second — makes the tiers human-relatable.
function fmtHuman(ns: number): string {
  const s = ns; // 1 ns -> 1 s
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 86400 * 365) return `${(s / 86400).toFixed(1)} days`;
  return `${(s / (86400 * 365)).toFixed(2)} years`;
}

export default function SysLatencyTraversal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 260 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [scenarioId, setScenarioId] = useState('cache');
  const [idx, setIdx] = useState(0); // 0..stages.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [human, setHuman] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const stages = scenario.stages;
  idxRef.current = idx;

  // cumulative[k] = sum of first k stage latencies
  const cumulative: number[] = (() => {
    const c = [0];
    for (let i = 0; i < stages.length; i++) c.push(c[i] + stages[i].ns);
    return c;
  })();

  const humanRef = useRef(human);
  humanRef.current = human;

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= stages.length + 1) { setIdx(stages.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, scenarioId]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w } = sizeRef.current;
    const rowH = 46;
    const padX = 12;
    const labelW = Math.min(230, w * 0.42);
    const barX = padX + labelW + 8;
    const barMaxW = w - barX - padX;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stages.forEach((st, i) => {
      const y = 12 + i * rowH;
      const active = i === idx - 1;
      const done = i < idx - 1;
      // label
      ctx.fillStyle = active ? COLORS.active : done ? COLORS.done : 'rgba(128,128,128,0.85)';
      ctx.font = `${active ? 'bold ' : ''}13px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.label, padX, y + rowH / 2 - 8);
      // number
      ctx.fillStyle = 'rgba(128,128,128,0.75)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(humanRef.current ? fmtHuman(st.ns) : fmtNs(st.ns), padX, y + rowH / 2 + 10);
      // log-scale bar
      const frac = Math.log10(st.ns + 1) / Math.log10(MAX_NS + 1);
      const bw = Math.max(4, frac * barMaxW);
      ctx.fillStyle = 'rgba(128,128,128,0.14)';
      ctx.fillRect(barX, y + 8, barMaxW, rowH - 22);
      ctx.fillStyle = active ? COLORS.active : done ? COLORS.done : COLORS.bar;
      ctx.globalAlpha = active || done ? 1 : 0.5;
      ctx.fillRect(barX, y + 8, bw, rowH - 22);
      ctx.globalAlpha = 1;
      // request dot on active row
      if (active) {
        ctx.beginPath();
        ctx.arc(barX + bw + 8, y + rowH / 2 - 3, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = COLORS.active;
        ctx.stroke();
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = 24 + stages.length * 46;
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  useEffect(draw, [idx, scenarioId, human]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(stages.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= stages.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const total = cumulative[stages.length];
  const soFar = cumulative[idx];
  const done = idx >= stages.length;
  const caption = idx === 0
    ? 'The request is about to start. Press Play to walk it through each tier.'
    : `${stages[idx - 1].label}: +${human ? fmtHuman(stages[idx - 1].ns) : fmtNs(stages[idx - 1].ns)}  →  running total ${human ? fmtHuman(soFar) : fmtNs(soFar)}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={scenarioId}
          onChange={(e) => { setScenarioId((e.target as HTMLSelectElement).value); setIdx(0); setPlaying(false); }}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm"
        >
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label class="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={human} onInput={(e) => setHuman((e.target as HTMLInputElement).checked)} class="h-4 w-4 accent-[#4f46e5]" />
          human scale (1&nbsp;ns = 1&nbsp;s)
        </label>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Total: {human ? fmtHuman(total) : fmtNs(total)}. Notice the bars are log-scale — each tier down is roughly 100× slower than the one above it.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: switch scenarios to compare a cache hit (nanoseconds) against a cross-continent call (~150 ms) — a ~100-million× gap.</p>
    </div>
  );
}
