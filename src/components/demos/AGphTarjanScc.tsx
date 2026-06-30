import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Tarjan's SCC, animated.
   - Single DFS that stamps each node with a discovery time (disc) and a
     "low-link" value (low = the earliest node reachable). Nodes wait on a
     stack; when low[v] === disc[v], v is a component root and everything
     above it on the stack pops off as one strongly connected component.
   - Step-frames are precomputed by instrumenting the DFS, then replayed.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
   ------------------------------------------------------------------ */

type Node = { id: number; x: number; y: number }; // x,y normalised 0..1
type Edge = [number, number];
type Frame = {
  disc: number[];
  low: number[];
  onStack: boolean[];
  stack: number[];
  comp: number[];
  active: number;
  edge: Edge | null;
  caption: string;
};

const SCC_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6'];
const ACTIVE = '#4f46e5';

const PRESETS: { name: string; nodes: Node[]; edges: Edge[] }[] = [
  {
    name: 'Two cycles',
    nodes: [
      { id: 0, x: 0.16, y: 0.30 },
      { id: 1, x: 0.40, y: 0.16 },
      { id: 2, x: 0.30, y: 0.62 },
      { id: 3, x: 0.66, y: 0.28 },
      { id: 4, x: 0.88, y: 0.20 },
      { id: 5, x: 0.80, y: 0.66 },
    ],
    edges: [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4], [4, 5], [5, 3]],
  },
  {
    name: 'One big cycle',
    nodes: [
      { id: 0, x: 0.25, y: 0.22 },
      { id: 1, x: 0.72, y: 0.22 },
      { id: 2, x: 0.78, y: 0.70 },
      { id: 3, x: 0.30, y: 0.72 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 3]],
  },
  {
    name: 'A DAG (no cycles)',
    nodes: [
      { id: 0, x: 0.18, y: 0.24 },
      { id: 1, x: 0.18, y: 0.72 },
      { id: 2, x: 0.50, y: 0.48 },
      { id: 3, x: 0.82, y: 0.26 },
      { id: 4, x: 0.82, y: 0.72 },
    ],
    edges: [[0, 2], [1, 2], [2, 3], [2, 4], [3, 4]],
  },
];

function buildFrames(nodes: Node[], edges: Edge[]): Frame[] {
  const n = nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) adj[u].push(v);
  const disc = Array(n).fill(-1);
  const low = Array(n).fill(-1);
  const onStack = Array(n).fill(false);
  const comp = Array(n).fill(-1);
  const stack: number[] = [];
  let time = 0;
  let sccCount = 0;
  const frames: Frame[] = [];
  const snap = (active: number, edge: Edge | null, caption: string) =>
    frames.push({
      disc: [...disc],
      low: [...low],
      onStack: [...onStack],
      stack: [...stack],
      comp: [...comp],
      active,
      edge,
      caption,
    });

  snap(-1, null, 'Tarjan does ONE depth-first walk. Each node gets a discovery time and a low-link.');

  const dfs = (u: number) => {
    disc[u] = low[u] = time++;
    stack.push(u);
    onStack[u] = true;
    snap(u, null, `Visit ${u}: disc[${u}] = low[${u}] = ${disc[u]}, and push ${u} on the stack.`);
    for (const v of adj[u]) {
      if (disc[v] === -1) {
        snap(u, [u, v], `Edge ${u}→${v}: ${v} is new — recurse into it (a tree edge).`);
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
        snap(u, [u, v], `Returned to ${u}: low[${u}] = min(low[${u}], low[${v}]) = ${low[u]}.`);
      } else if (onStack[v]) {
        low[u] = Math.min(low[u], disc[v]);
        snap(u, [u, v], `Back edge ${u}→${v}: ${v} is still on the stack, so low[${u}] = min(·, disc[${v}]) = ${low[u]}.`);
      } else {
        snap(u, [u, v], `Edge ${u}→${v}: ${v} is in a finished SCC already — ignore it.`);
      }
    }
    if (low[u] === disc[u]) {
      const members: number[] = [];
      let w: number;
      do {
        w = stack.pop()!;
        onStack[w] = false;
        comp[w] = sccCount;
        members.push(w);
      } while (w !== u);
      sccCount++;
      snap(u, null, `low[${u}] === disc[${u}] → ${u} is a component ROOT. Pop {${members.join(', ')}} as one SCC.`);
    }
  };

  for (let i = 0; i < n; i++) if (disc[i] === -1) dfs(i);
  snap(-1, null, `Finished. The graph splits into ${sccCount} strongly connected component${sccCount === 1 ? '' : 's'}.`);
  return frames;
}

export default function AGphTarjanScc() {
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

    // edges (directed, with arrowheads)
    for (const [u, v] of edges) {
      const a = nodes[u], b = nodes[v];
      const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const sx = x1 + Math.cos(ang) * R, sy = y1 + Math.sin(ang) * R;
      const ex = x2 - Math.cos(ang) * R, ey = y2 - Math.sin(ang) * R;
      const hot = frame.edge && frame.edge[0] === u && frame.edge[1] === v;
      ctx.strokeStyle = hot ? ACTIVE : 'rgba(128,128,128,0.45)';
      ctx.lineWidth = hot ? 3.5 : 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.4) * 11, ey - Math.sin(ang - 0.4) * 11);
      ctx.lineTo(ex - Math.cos(ang + 0.4) * 11, ey - Math.sin(ang + 0.4) * 11);
      ctx.closePath();
      ctx.fillStyle = hot ? ACTIVE : 'rgba(128,128,128,0.45)';
      ctx.fill();
    }

    // nodes
    for (const nd of nodes) {
      const x = px(nd.x), y = py(nd.y);
      const onStk = frame.onStack[nd.id];
      const c = frame.comp[nd.id];
      let fill = '#1f2937';
      if (c >= 0) fill = SCC_COLORS[c % SCC_COLORS.length];
      else if (nd.id === frame.active) fill = ACTIVE;
      else if (onStk) fill = 'rgba(79,70,229,0.35)';
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
      // disc/low badge
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
          <div class="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
            <div class="text-muted">stack (waiting nodes)</div>
            <div class="mt-1 text-text">[{frame.stack.join(', ')}]</div>
          </div>
          <p class="text-xs text-muted">
            Each badge under a node is <code>disc/low</code>. A node turns into a coloured SCC the moment it pops.
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
