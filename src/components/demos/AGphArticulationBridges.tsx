import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Articulation points & bridges, animated.
   - One undirected DFS stamps disc[v] (discovery time) and low[v] (the
     earliest node reachable without using the edge to the parent).
   - A child u with low[u] >= disc[v] reveals v as an articulation point;
     low[u] > disc[v] makes (v,u) a bridge. The root is special: it is an
     articulation point only if it has two DFS-tree children.
   - Frames are precomputed by instrumenting the DFS, then replayed.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
   ------------------------------------------------------------------ */

type Node = { id: number; x: number; y: number };
type Edge = [number, number];
type Frame = {
  disc: number[];
  low: number[];
  ap: boolean[];
  bridges: string[];
  active: number;
  edge: Edge | null;
  caption: string;
};

const ACTIVE = '#4f46e5';
const AP_COLOR = '#ec4899';
const BRIDGE = '#f59e0b';

const ek = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`);

const PRESETS: { name: string; nodes: Node[]; edges: Edge[] }[] = [
  {
    name: 'Two blobs + a bridge',
    nodes: [
      { id: 0, x: 0.16, y: 0.30 },
      { id: 1, x: 0.16, y: 0.70 },
      { id: 2, x: 0.40, y: 0.50 },
      { id: 3, x: 0.62, y: 0.50 },
      { id: 4, x: 0.86, y: 0.28 },
      { id: 5, x: 0.86, y: 0.72 },
    ],
    edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5]],
  },
  {
    name: 'A chain',
    nodes: [
      { id: 0, x: 0.12, y: 0.5 },
      { id: 1, x: 0.34, y: 0.5 },
      { id: 2, x: 0.56, y: 0.5 },
      { id: 3, x: 0.78, y: 0.5 },
      { id: 4, x: 0.95, y: 0.5 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: 'A solid ring',
    nodes: [
      { id: 0, x: 0.5, y: 0.14 },
      { id: 1, x: 0.85, y: 0.40 },
      { id: 2, x: 0.72, y: 0.82 },
      { id: 3, x: 0.28, y: 0.82 },
      { id: 4, x: 0.15, y: 0.40 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]],
  },
];

function buildFrames(nodes: Node[], edges: Edge[]): Frame[] {
  const n = nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) { adj[u].push(v); adj[v].push(u); }
  const disc = Array(n).fill(-1);
  const low = Array(n).fill(-1);
  const parent = Array(n).fill(-1);
  const ap = Array(n).fill(false);
  const bridges: string[] = [];
  let time = 0;
  const frames: Frame[] = [];
  const snap = (active: number, edge: Edge | null, caption: string) =>
    frames.push({
      disc: [...disc], low: [...low], ap: [...ap], bridges: [...bridges], active, edge, caption,
    });

  snap(-1, null, 'Walk the graph depth-first, stamping disc and low. low[v] is the earliest node v can reach.');

  const dfs = (u: number) => {
    disc[u] = low[u] = time++;
    let children = 0;
    snap(u, null, `Visit ${u}: disc[${u}] = low[${u}] = ${disc[u]}.`);
    for (const v of adj[u]) {
      if (disc[v] === -1) {
        children++;
        parent[v] = u;
        snap(u, [u, v], `Tree edge ${u}–${v}: ${v} is unvisited, go deeper.`);
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
        snap(u, [u, v], `Back at ${u}: low[${u}] = min(low[${u}], low[${v}]) = ${low[u]}.`);
        if (parent[u] !== -1 && low[v] >= disc[u]) {
          ap[u] = true;
          snap(u, [u, v], `low[${v}] (${low[v]}) ≥ disc[${u}] (${disc[u]}) → ${u} is an ARTICULATION POINT.`);
        }
        if (parent[u] === -1 && children === 2) {
          ap[u] = true;
          snap(u, null, `Root ${u} has 2 DFS-tree children → it is an ARTICULATION POINT.`);
        }
        if (low[v] > disc[u]) {
          bridges.push(ek(u, v));
          snap(u, [u, v], `low[${v}] (${low[v]}) > disc[${u}] (${disc[u]}) → edge ${u}–${v} is a BRIDGE.`);
        }
      } else if (v !== parent[u]) {
        low[u] = Math.min(low[u], disc[v]);
        snap(u, [u, v], `Back edge ${u}–${v}: low[${u}] = min(·, disc[${v}]) = ${low[u]}.`);
      }
    }
  };

  for (let i = 0; i < n; i++) if (disc[i] === -1) dfs(i);
  const apList = ap.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  snap(-1, null, `Done. Articulation points: {${apList.join(', ') || 'none'}}. Bridges: ${bridges.length}.`);
  return frames;
}

export default function AGphArticulationBridges() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 540, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [preset, setPreset] = useState(0);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { nodes, edges } = PRESETS[preset];
  const frames = useMemo(() => buildFrames(nodes, edges), [preset]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [preset]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 38;
    const px = (x: number) => pad + x * (w - 2 * pad);
    const py = (y: number) => pad + y * (h - 2 * pad);
    const R = 19;

    for (const [u, v] of edges) {
      const a = nodes[u], b = nodes[v];
      const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
      const isBridge = frame.bridges.includes(ek(u, v));
      const hot = frame.edge && ek(frame.edge[0], frame.edge[1]) === ek(u, v);
      ctx.strokeStyle = isBridge ? BRIDGE : hot ? ACTIVE : 'rgba(128,128,128,0.45)';
      ctx.lineWidth = isBridge ? 4.5 : hot ? 3.5 : 1.8;
      if (isBridge) ctx.setLineDash([7, 5]); else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const nd of nodes) {
      const x = px(nd.x), y = py(nd.y);
      let fill = '#1f2937';
      if (frame.ap[nd.id]) fill = AP_COLOR;
      else if (nd.id === frame.active) fill = ACTIVE;
      else if (frame.disc[nd.id] >= 0) fill = '#475569';
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = nd.id === frame.active ? 3.5 : 2;
      ctx.strokeStyle = nd.id === frame.active ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${nd.id}`, x, y);
      if (frame.disc[nd.id] >= 0) {
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        ctx.fillRect(x - 20, y + R + 3, 40, 16);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(`${frame.disc[nd.id]}/${frame.low[nd.id]}`, x, y + R + 11);
      }
    }
  };

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
  }, []);

  useEffect(draw, [idx, preset]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPreset(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${preset === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
          >
            {p.name}
          </button>
        ))}
        <span class="ml-auto text-xs text-muted">step {idx + 1}/{frames.length}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{frame.caption}</p>
          <div class="flex flex-wrap gap-3 text-xs">
            <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full" style={`background:${AP_COLOR}`} /> articulation point</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-5 rounded" style={`background:${BRIDGE}`} /> bridge</span>
          </div>
          <p class="text-xs text-muted">
            Badges show <code>disc/low</code>. An edge to a child that cannot reach above its parent is a single point of failure.
          </p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
    </div>
  );
}
