import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated topology explorer: star / ring / line / mesh / tree.
   - Pick a shape and a node count. The demo lays the nodes out, then
     runs a BFS wave from one end of the network's longest shortest
     path, revealing distance rings one layer at a time.
   - The final frame lights up the DIAMETER — the longest shortest path
     — the worst-case hop count any two nodes must endure.
   - A live panel reports nodes, links, diameter, average path length
     and density so you can compare shapes' trade-offs.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

type Topo = 'star' | 'ring' | 'line' | 'mesh' | 'tree';

const COLORS = {
  idle: 'rgba(100,116,139,0.5)',
  link: 'rgba(100,116,139,0.45)',
  wave: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'],
  path: '#4f46e5',
};

function positions(topo: Topo, n: number): { x: number; y: number }[] {
  const p: { x: number; y: number }[] = [];
  if (topo === 'star') {
    p.push({ x: 0.5, y: 0.5 });
    for (let i = 1; i < n; i++) {
      const a = (2 * Math.PI * (i - 1)) / (n - 1) - Math.PI / 2;
      p.push({ x: 0.5 + 0.4 * Math.cos(a), y: 0.5 + 0.42 * Math.sin(a) });
    }
  } else if (topo === 'ring' || topo === 'mesh') {
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      p.push({ x: 0.5 + 0.4 * Math.cos(a), y: 0.5 + 0.42 * Math.sin(a) });
    }
  } else if (topo === 'line') {
    for (let i = 0; i < n; i++) p.push({ x: 0.08 + (0.84 * i) / (n - 1), y: 0.5 });
  } else {
    // tree (binary), level layout
    for (let i = 0; i < n; i++) {
      const level = Math.floor(Math.log2(i + 1));
      const levelStart = (1 << level) - 1;
      const idxInLevel = i - levelStart;
      const count = 1 << level;
      const maxLevel = Math.floor(Math.log2(n));
      p.push({
        x: 0.1 + 0.8 * ((idxInLevel + 0.5) / count),
        y: 0.15 + (maxLevel ? (0.7 * level) / maxLevel : 0.35),
      });
    }
  }
  return p;
}

function edgesOf(topo: Topo, n: number): [number, number][] {
  const e: [number, number][] = [];
  if (topo === 'star') for (let i = 1; i < n; i++) e.push([0, i]);
  else if (topo === 'ring') for (let i = 0; i < n; i++) e.push([i, (i + 1) % n]);
  else if (topo === 'line') for (let i = 0; i < n - 1; i++) e.push([i, i + 1]);
  else if (topo === 'mesh') for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e.push([i, j]);
  else for (let i = 1; i < n; i++) e.push([Math.floor((i - 1) / 2), i]);
  return e;
}

function bfs(adj: number[][], s: number, n: number): { dist: number[]; parent: number[] } {
  const dist = Array(n).fill(Infinity);
  const parent = Array(n).fill(-1);
  dist[s] = 0;
  const q = [s];
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj[u]) if (dist[v] === Infinity) { dist[v] = dist[u] + 1; parent[v] = u; q.push(v); }
  }
  return { dist, parent };
}

type Frame = { dist: number[]; layer: number; pathEdges: [number, number][] | null; caption: string };

function build(topo: Topo, n: number) {
  const edges = edgesOf(topo, n);
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }

  // all-pairs (BFS each) for metrics + diameter endpoints
  let diameter = 0, su = 0, sv = 0, sum = 0, pairs = 0;
  for (let s = 0; s < n; s++) {
    const { dist } = bfs(adj, s, n);
    for (let v = 0; v < n; v++) if (v !== s && dist[v] !== Infinity) {
      sum += dist[v]; pairs++;
      if (dist[v] > diameter) { diameter = dist[v]; su = s; sv = v; }
    }
  }
  const avg = pairs ? sum / (pairs) : 0;
  const maxEdges = (n * (n - 1)) / 2;
  const density = maxEdges ? edges.length / maxEdges : 0;

  const { dist, parent } = bfs(adj, su, n);
  const frames: Frame[] = [];
  for (let layer = 0; layer <= diameter; layer++) {
    frames.push({
      dist, layer, pathEdges: null,
      caption: layer === 0
        ? `BFS starts at node ${su} (one end of the longest shortest path). Distance 0.`
        : `Wave reaches every node ${layer} hop${layer > 1 ? 's' : ''} from node ${su}.`,
    });
  }
  // diameter path
  const pathEdges: [number, number][] = [];
  let c = sv;
  while (parent[c] !== -1) { pathEdges.push([parent[c], c]); c = parent[c]; }
  frames.push({
    dist, layer: diameter, pathEdges,
    caption: `Diameter = ${diameter}: the farthest node ${sv} is ${diameter} hops from ${su}. That is the worst-case latency this shape imposes.`,
  });

  return { frames, edges, diameter, avg, density, edgeCount: edges.length };
}

export default function NetAlgTopologyExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [topo, setTopo] = useState<Topo>('ring');
  const [n, setN] = useState(7);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { frames, edges, diameter, avg, density, edgeCount } = useMemo(() => build(topo, n), [topo, n]);
  const pos = useMemo(() => positions(topo, n), [topo, n]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [topo, n]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const X = (i: number) => 26 + pos[i].x * (w - 52);
    const Y = (i: number) => 26 + pos[i].y * (h - 52);
    const pathSet = new Set((frame.pathEdges ?? []).map(([a, b]) => [a, b].sort().join('-')));

    for (const [a, b] of edges) {
      const onPath = pathSet.has([a, b].sort().join('-'));
      ctx.beginPath();
      ctx.moveTo(X(a), Y(a));
      ctx.lineTo(X(b), Y(b));
      ctx.strokeStyle = onPath ? COLORS.path : COLORS.link;
      ctx.lineWidth = onPath ? 5 : 1.5;
      ctx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const x = X(i), y = Y(i);
      const d = frame.dist[i];
      const revealed = d <= frame.layer;
      let fill = COLORS.idle;
      if (revealed && d !== Infinity) fill = COLORS.wave[Math.min(d, COLORS.wave.length - 1)];
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.globalAlpha = revealed ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i}`, x, y);
      if (revealed && d !== Infinity) {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.fillText(`${d}`, x, y + 25);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, frames, pos]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (tm: number) => {
      if (!lastRef.current) lastRef.current = tm;
      if (tm - lastRef.current >= interval) {
        lastRef.current = tm;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };

  const topos: Topo[] = ['star', 'ring', 'line', 'mesh', 'tree'];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {topos.map((tp) => (
          <button key={tp} onClick={() => setTopo(tp)}
            class={`rounded-lg px-3 py-1.5 font-semibold capitalize transition ${topo === tp ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {tp}
          </button>
        ))}
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">nodes {n}
          <input type="range" min={5} max={8} value={n} onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))} class="w-20 accent-[#4f46e5]" />
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none block rounded-xl bg-surface-2" />
        <div class="grid grid-cols-2 gap-2 text-sm md:grid-cols-1">
          <Stat label="links" value={`${edgeCount}`} />
          <Stat label="diameter" value={`${diameter}`} />
          <Stat label="avg path" value={avg.toFixed(2)} />
          <Stat label="density" value={density.toFixed(2)} />
        </div>
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">step {idx}/{frames.length - 1}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Colour = hops from the start node. Compare shapes: a mesh has diameter 1 but many links; a line is cheap but slow.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-xs text-muted">{label}</span>
      <div class="font-mono text-lg font-semibold text-text">{value}</div>
    </div>
  );
}
