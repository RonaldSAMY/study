import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   GNN message passing on a small graph (GCN-style smoothing).
   - Click a node to make it a "source" (feature = 1). Others start at 0.
   - Each round, every node updates to the degree-normalized average of
     itself + its neighbors:  h_i <- sum_j  h_j / sqrt(deg_i * deg_j).
   - Watch the signal diffuse outward over rounds; go far enough and every
     node blurs to the same value (over-smoothing).
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { edge: 'rgba(128,128,128,0.35)', active: '#4f46e5', hot: '#10b981' };
const ROUNDS = 8;

type Node = { x: number; y: number };
// fixed layout (unit square coords) + edges
const NODES: Node[] = [
  { x: 0.15, y: 0.25 }, { x: 0.15, y: 0.75 }, { x: 0.4, y: 0.5 },
  { x: 0.62, y: 0.2 }, { x: 0.62, y: 0.8 }, { x: 0.82, y: 0.5 }, { x: 0.95, y: 0.25 },
];
const EDGES: [number, number][] = [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5], [5, 6], [3, 4]];

function buildNorm() {
  const n = NODES.length;
  const adj: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) adj[i][i] = 1; // self-loops
  for (const [u, v] of EDGES) { adj[u][v] = 1; adj[v][u] = 1; }
  const deg = adj.map((r) => r.reduce((a, b) => a + b, 0));
  const norm: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (adj[i][j]) norm[i][j] = 1 / Math.sqrt(deg[i] * deg[j]);
  return norm;
}
const NORM = buildNorm();

function simulate(sources: Set<number>): number[][] {
  const n = NODES.length;
  let h = Array.from({ length: n }, (_, i) => (sources.has(i) ? 1 : 0));
  const history = [h.slice()];
  for (let r = 0; r < ROUNDS; r++) {
    const next = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) next[i] += NORM[i][j] * h[j];
    h = next;
    history.push(h.slice());
  }
  return history;
}

export default function MlAMessagePassing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 300 });
  const rafRef = useRef<number | null>(null);

  const [sources, setSources] = useState<Set<number>>(() => new Set([0]));
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastRef = useRef(0);
  const roundRef = useRef(0);
  roundRef.current = round;

  const history = simulate(sources);
  const historyRef = useRef(history);
  historyRef.current = history;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const px = (nx: number) => 24 + nx * (w - 48);
    const py = (ny: number) => 24 + ny * (h - 48);
    const vals = historyRef.current[Math.min(roundRef.current, ROUNDS)];
    const maxV = Math.max(1e-6, ...vals);

    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.edge;
    for (const [u, v] of EDGES) {
      ctx.beginPath();
      ctx.moveTo(px(NODES[u].x), py(NODES[u].y));
      ctx.lineTo(px(NODES[v].x), py(NODES[v].y));
      ctx.stroke();
    }
    NODES.forEach((nd, i) => {
      const t = vals[i] / maxV;
      const cx = px(nd.x), cy = py(nd.y);
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      // interpolate surface -> emerald by value
      const r = Math.round(148 + (16 - 148) * t);
      const g = Math.round(163 + (185 - 163) * t);
      const b = Math.round(184 + (129 - 184) * t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.lineWidth = sourcesRef.current.has(i) ? 3 : 1.5;
      ctx.strokeStyle = sourcesRef.current.has(i) ? COLORS.hot : '#fff';
      ctx.stroke();
      ctx.fillStyle = t > 0.5 ? '#fff' : '#334155';
      ctx.font = '600 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(vals[i].toFixed(2), cx, cy);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [round, sources]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 780 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = roundRef.current + 1;
        if (next > ROUNDS) { setRound(ROUNDS); setPlaying(false); return; }
        setRound(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const onClick = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const px = (nx: number) => 24 + nx * (w - 48);
    const py = (ny: number) => 24 + ny * (h - 48);
    for (let i = 0; i < NODES.length; i++) {
      if (Math.hypot(mx - px(NODES[i].x), my - py(NODES[i].y)) < 22) {
        setSources((prev) => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
        setRound(0); setPlaying(false);
        return;
      }
    }
  };

  const reset = () => { setPlaying(false); setRound(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setRound((v) => Math.min(ROUNDS, v + 1)); };
  const stepB = () => { setPlaying(false); setRound((v) => Math.max(0, v - 1)); };
  const play = () => { if (round >= ROUNDS) setRound(0); lastRef.current = 0; setPlaying((p) => !p); };

  const spread = Math.max(...history[Math.min(round, ROUNDS)]) - Math.min(...history[Math.min(round, ROUNDS)]);
  const caption = round === 0
    ? 'Round 0: only the source node(s) carry a signal. Click nodes to add or remove sources.'
    : spread < 0.03
      ? `Round ${round}: the values have blurred together — this is over-smoothing. Too many rounds and every node looks the same.`
      : `Round ${round}: each node became the normalized average of itself and its neighbors. The signal has spread ${round} hop(s) out.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="mx-auto touch-none rounded-xl bg-surface-2" onPointerDown={onClick} />
      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-1 rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-muted">round {round}/{ROUNDS}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Node labels show the current feature value. Green ring = a source node you clicked.</p>
    </div>
  );
}
