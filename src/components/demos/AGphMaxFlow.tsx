import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Max-flow / min-cut via Edmonds-Karp (BFS Ford-Fulkerson), animated.
   - Repeatedly BFS for a shortest augmenting path in the RESIDUAL graph,
     find its bottleneck, and push that much flow (updating reverse edges so
     flow can later be re-routed). When no augmenting path remains, the
     source-reachable residual set defines the minimum cut.
   - Frames are precomputed by instrumenting Edmonds-Karp, then replayed.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
   ------------------------------------------------------------------ */

type Node = { id: number; x: number; y: number };
type DEdge = { from: number; to: number; cap: number };
type Frame = {
  flow: number[];
  pathPairs: [number, number][];
  caption: string;
  phase: 'init' | 'find' | 'push' | 'cut';
  cutEdges: number[];
  sourceSide: number[];
};

const ACTIVE = '#4f46e5';
const CUT = '#f59e0b';
const FLOWING = '#10b981';

const PRESETS: { name: string; nodes: Node[]; edges: DEdge[] }[] = [
  {
    name: 'Bottleneck in the middle',
    nodes: [
      { id: 0, x: 0.08, y: 0.5 },
      { id: 1, x: 0.45, y: 0.24 },
      { id: 2, x: 0.45, y: 0.78 },
      { id: 3, x: 0.92, y: 0.5 },
    ],
    edges: [
      { from: 0, to: 1, cap: 10 },
      { from: 0, to: 2, cap: 6 },
      { from: 1, to: 2, cap: 4 },
      { from: 1, to: 3, cap: 5 },
      { from: 2, to: 3, cap: 10 },
    ],
  },
  {
    name: 'Six-node network',
    nodes: [
      { id: 0, x: 0.07, y: 0.5 },
      { id: 1, x: 0.34, y: 0.22 },
      { id: 2, x: 0.34, y: 0.78 },
      { id: 3, x: 0.66, y: 0.22 },
      { id: 4, x: 0.66, y: 0.78 },
      { id: 5, x: 0.93, y: 0.5 },
    ],
    edges: [
      { from: 0, to: 1, cap: 7 },
      { from: 0, to: 2, cap: 6 },
      { from: 1, to: 3, cap: 6 },
      { from: 1, to: 2, cap: 3 },
      { from: 2, to: 4, cap: 8 },
      { from: 3, to: 5, cap: 6 },
      { from: 3, to: 4, cap: 2 },
      { from: 4, to: 5, cap: 9 },
    ],
  },
  {
    name: 'Cut at the source',
    nodes: [
      { id: 0, x: 0.08, y: 0.5 },
      { id: 1, x: 0.45, y: 0.26 },
      { id: 2, x: 0.45, y: 0.76 },
      { id: 3, x: 0.92, y: 0.5 },
    ],
    edges: [
      { from: 0, to: 1, cap: 3 },
      { from: 0, to: 2, cap: 2 },
      { from: 1, to: 2, cap: 1 },
      { from: 1, to: 3, cap: 2 },
      { from: 2, to: 3, cap: 3 },
    ],
  },
];

function buildFrames(nodes: Node[], dedges: DEdge[]): Frame[] {
  const n = nodes.length;
  type RE = { to: number; cap: number; flow: number; rev: number };
  const adj: RE[][] = Array.from({ length: n }, () => []);
  const disp: { u: number; idx: number }[] = [];
  for (const e of dedges) {
    const fi = adj[e.from].length, ri = adj[e.to].length;
    adj[e.from].push({ to: e.to, cap: e.cap, flow: 0, rev: ri });
    adj[e.to].push({ to: e.from, cap: 0, flow: 0, rev: fi });
    disp.push({ u: e.from, idx: fi });
  }
  const source = 0, sink = n - 1;
  const flowOf = () => disp.map((d) => adj[d.u][d.idx].flow);
  const frames: Frame[] = [];
  const snap = (
    pathPairs: [number, number][],
    caption: string,
    phase: Frame['phase'],
    cutEdges: number[] = [],
    sourceSide: number[] = []
  ) => frames.push({ flow: flowOf(), pathPairs: pathPairs.map((p) => [...p] as [number, number]), caption, phase, cutEdges: [...cutEdges], sourceSide: [...sourceSide] });

  snap([], `Source S = ${source}, sink T = ${sink}. Every edge starts at flow 0 of its capacity.`, 'init');

  let maxFlow = 0;
  let guard = 0;
  while (guard++ < 100) {
    const parent: ({ node: number; u: number; idx: number } | null)[] = Array(n).fill(null);
    const vis = Array(n).fill(false);
    vis[source] = true;
    const q = [source];
    while (q.length && !vis[sink]) {
      const u = q.shift()!;
      adj[u].forEach((e, i) => {
        if (!vis[e.to] && e.cap - e.flow > 0) {
          vis[e.to] = true;
          parent[e.to] = { node: u, u, idx: i };
          q.push(e.to);
        }
      });
    }
    if (!vis[sink]) break;

    let bottleneck = Infinity;
    let cur = sink;
    const pairs: [number, number][] = [];
    while (cur !== source) {
      const p = parent[cur]!;
      bottleneck = Math.min(bottleneck, adj[p.u][p.idx].cap - adj[p.u][p.idx].flow);
      pairs.push([p.node, cur]);
      cur = p.node;
    }
    pairs.reverse();
    const nodesPath = [source, ...pairs.map((p) => p[1])];
    snap(pairs, `BFS found a shortest augmenting path ${nodesPath.join(' → ')}; its bottleneck (smallest spare capacity) is ${bottleneck}.`, 'find');

    cur = sink;
    while (cur !== source) {
      const p = parent[cur]!;
      const e = adj[p.u][p.idx];
      e.flow += bottleneck;
      adj[e.to][e.rev].flow -= bottleneck;
      cur = p.node;
    }
    maxFlow += bottleneck;
    snap(pairs, `Push ${bottleneck} units along the path (reverse edges updated so flow can be re-routed). Total flow is now ${maxFlow}.`, 'push');
  }

  const vis = Array(n).fill(false);
  vis[source] = true;
  const q = [source];
  while (q.length) {
    const u = q.shift()!;
    adj[u].forEach((e) => { if (!vis[e.to] && e.cap - e.flow > 0) { vis[e.to] = true; q.push(e.to); } });
  }
  const sourceSide: number[] = [];
  for (let i = 0; i < n; i++) if (vis[i]) sourceSide.push(i);
  const cutEdges: number[] = [];
  dedges.forEach((d, i) => { if (vis[d.from] && !vis[d.to]) cutEdges.push(i); });
  const cutVal = cutEdges.reduce((s, i) => s + dedges[i].cap, 0);
  snap([], `No augmenting path is left. Max-flow = ${maxFlow}. The min-cut edges (orange) have total capacity ${cutVal} — equal, by the max-flow/min-cut theorem.`, 'cut', cutEdges, sourceSide);
  return frames;
}

export default function AGphMaxFlow() {
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
    const pad = 42;
    const px = (x: number) => pad + x * (w - 2 * pad);
    const py = (y: number) => pad + y * (h - 2 * pad);
    const R = 19;
    const sink = nodes.length - 1;

    const onPath = (u: number, v: number) =>
      frame.pathPairs.some((p) => (p[0] === u && p[1] === v) || (p[0] === v && p[1] === u));

    edges.forEach((e, i) => {
      const a = nodes[e.from], b = nodes[e.to];
      const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const sx = x1 + Math.cos(ang) * R, sy = y1 + Math.sin(ang) * R;
      const ex = x2 - Math.cos(ang) * R, ey = y2 - Math.sin(ang) * R;
      const isCut = frame.cutEdges.includes(i);
      const path = onPath(e.from, e.to);
      const flow = frame.flow[i];
      ctx.strokeStyle = isCut ? CUT : path ? ACTIVE : flow > 0 ? FLOWING : 'rgba(128,128,128,0.45)';
      ctx.lineWidth = isCut ? 5 : path ? 4 : flow > 0 ? 2.6 + Math.min(3, flow / 4) : 1.6;
      if (isCut) ctx.setLineDash([8, 5]); else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.4) * 11, ey - Math.sin(ang - 0.4) * 11);
      ctx.lineTo(ex - Math.cos(ang + 0.4) * 11, ey - Math.sin(ang + 0.4) * 11);
      ctx.closePath();
      ctx.fillStyle = isCut ? CUT : path ? ACTIVE : flow > 0 ? FLOWING : 'rgba(128,128,128,0.45)';
      ctx.fill();
      // flow/cap label
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const ox = -Math.sin(ang) * 13, oy = Math.cos(ang) * 13;
      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      ctx.fillRect(mx + ox - 17, my + oy - 9, 34, 17);
      ctx.fillStyle = flow > 0 ? '#86efac' : '#cbd5e1';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${flow}/${e.cap}`, mx + ox, my + oy);
    });

    for (const nd of nodes) {
      const x = px(nd.x), y = py(nd.y);
      const isS = nd.id === 0, isT = nd.id === sink;
      const onSrcSide = frame.phase === 'cut' && frame.sourceSide.includes(nd.id);
      let fill = '#475569';
      if (isS) fill = ACTIVE;
      else if (isT) fill = FLOWING;
      else if (onSrcSide) fill = 'rgba(245,158,11,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isS ? 'S' : isT ? 'T' : `${nd.id}`, x, y);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.64);
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
    const interval = 1100 / speed;
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

  const totalFlow = (() => {
    // flow leaving the source = current max flow so far
    let f = 0;
    edges.forEach((e, i) => { if (e.from === 0) f += frame.flow[i]; });
    return f;
  })();

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
        <span class="ml-auto text-xs text-muted">flow leaving S: {totalFlow}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[4.5rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{frame.caption}</p>
          <div class="flex flex-wrap gap-3 text-xs">
            <span class="flex items-center gap-1.5"><span class="inline-block h-1.5 w-5 rounded" style={`background:${ACTIVE}`} /> augmenting path</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-1.5 w-5 rounded" style={`background:${FLOWING}`} /> carries flow</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-1.5 w-5 rounded" style={`background:${CUT}`} /> min cut</span>
          </div>
          <p class="text-xs text-muted">Edge labels read <code>flow/capacity</code>. Thicker green edges carry more flow.</p>
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
