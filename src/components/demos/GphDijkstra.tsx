import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Dijkstra's algorithm, animated frame by frame.
   - Edit a WEIGHTED edge list ("A-B:4, A-C:2, ..."). Pick a source.
   - Each frame pops the smallest-distance unvisited vertex from a
     min-priority-queue (sky), finalises it (emerald), and relaxes its
     edges — updating neighbour distance labels and parent pointers.
   - The priority queue is shown as sorted (node:dist) chips; the
     shortest-path tree (parent edges) is drawn in emerald.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = {
  node: '#4f46e5',
  cur: '#0ea5e9',
  done: '#10b981',
  edge: '#94a3b8',
  tree: '#10b981',
};

type WEdge = { u: string; v: string; w: number };
type Frame = {
  dist: Record<string, number>;
  parent: Record<string, string | null>;
  visited: string[];
  pq: { node: string; d: number }[];
  current: string | null;
  improved: string[];
  caption: string;
};

const dStr = (d: number) => (d === Infinity ? '∞' : String(d));

export default function GphDijkstra() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2');
  const [edges, setEdges] = useState<WEdge[]>(() => parseWeighted('A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2'));
  const [source, setSource] = useState('A');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // nodes in sorted order
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const { u, v } of edges) { if (!seen.includes(u)) seen.push(u); if (!seen.includes(v)) seen.push(v); }
    return seen.sort();
  })();

  const src = nodes.includes(source) ? source : nodes[0];

  // node positions on a circle
  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<string, { x: number; y: number }>();
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
    nodes.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, nodes.length);
      m.set(id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    });
    return m;
  })();

  // adjacency (undirected)
  const adj = new Map<string, { v: string; w: number }[]>();
  nodes.forEach((n) => adj.set(n, []));
  for (const { u, v, w } of edges) { adj.get(u)!.push({ v, w }); adj.get(v)!.push({ v: u, w }); }

  // precompute all frames of Dijkstra
  const frames = buildFrames(nodes, adj, src);
  const clampedIdx = Math.min(idx, frames.length - 1);
  const frame = frames[clampedIdx];

  const commit = () => {
    const p = parseWeighted(text);
    if (p.length) { setEdges(p); setIdx(0); setPlaying(false); }
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    const visited = new Set(f.visited);

    // base edges with weight labels
    for (const { u, v, w: wt } of edges) {
      const a = pos.get(u)!, b = pos.get(v)!;
      const isTree = f.parent[v] === u || f.parent[u] === v;
      ctx.strokeStyle = isTree ? COLORS.tree : COLORS.edge;
      ctx.lineWidth = isTree ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // weight label at midpoint
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(wt), mx, my);
    }

    // nodes
    for (const n of nodes) {
      const p = pos.get(n)!;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = n === f.current ? COLORS.cur : visited.has(n) ? COLORS.done : COLORS.node;
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);
      // tentative distance label below the node
      const improved = f.improved.includes(n);
      ctx.font = improved ? 'bold 12px ui-monospace, monospace' : '11px ui-monospace, monospace';
      ctx.fillStyle = improved ? COLORS.cur : '#64748b';
      ctx.fillText(`d=${dStr(f.dist[n])}`, p.x, p.y + 29);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 440);
      const h = 320;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, edges, source]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > frames.length - 1) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames.length]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  // priority-queue chips: unvisited entries, min per node, sorted by distance
  const visitedNow = new Set(frame.visited);
  const pqByNode = new Map<string, number>();
  for (const { node, d } of frame.pq) {
    if (visitedNow.has(node)) continue;
    if (!pqByNode.has(node) || d < pqByNode.get(node)!) pqByNode.set(node, d);
  }
  const chips = [...pqByNode.entries()].sort((a, b) => a[1] - b[1]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B:4, A-C:2, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-2 text-sm">source
          <select value={src} onInput={(e) => { setSource((e.target as HTMLSelectElement).value); setIdx(0); setPlaying(false); }} class="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm">
            {nodes.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Priority queue (node:dist)</div>
            <div class="flex flex-wrap gap-1.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {chips.length === 0 ? (<span class="text-muted">empty</span>) : chips.map(([n, d]) => (
                <span key={n} class="rounded-md bg-brand-soft px-2 py-0.5 font-semibold text-brand">{n}:{dStr(d)}</span>
              ))}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Distances from {src}</div>
            <div class="flex flex-wrap gap-1.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {nodes.map((n) => (
                <span key={n} class={visitedNow.has(n) ? 'rounded-md px-2 py-0.5 font-semibold text-[#10b981]' : 'rounded-md px-2 py-0.5 text-muted'}>{n}={dStr(frame.dist[n])}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">{'⏮'} Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">{'⏭'} Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">{'↺'} Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step {clampedIdx} / {frames.length - 1}.</p>
    </div>
  );
}

function buildFrames(nodes: string[], adj: Map<string, { v: string; w: number }[]>, source: string): Frame[] {
  const dist: Record<string, number> = {};
  const parent: Record<string, string | null> = {};
  nodes.forEach((n) => { dist[n] = Infinity; parent[n] = null; });
  if (source) dist[source] = 0;

  const visited = new Set<string>();
  const pq: { node: string; d: number }[] = source ? [{ node: source, d: 0 }] : [];
  const frames: Frame[] = [];

  const snap = (current: string | null, improved: string[], caption: string): Frame => ({
    dist: { ...dist },
    parent: { ...parent },
    visited: [...visited],
    pq: pq.map((e) => ({ ...e })),
    current,
    improved,
    caption,
  });

  frames.push(snap(null, [], source
    ? `Initialise: dist[${source}]=0, every other vertex ∞. Push ${source}. Press Play.`
    : 'Add a weighted edge list to begin.'));

  while (pq.length) {
    // pop the smallest-distance entry
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i].d < pq[bi].d) bi = i;
    const { node: u, d } = pq.splice(bi, 1)[0];
    if (visited.has(u)) continue;       // stale heap entry
    visited.add(u);                     // u's distance is now final

    const improved: string[] = [];
    const msgs: string[] = [];
    for (const { v, w } of adj.get(u) || []) {
      if (visited.has(v)) continue;
      const nd = dist[u] + w;           // relax edge u -> v
      if (nd < dist[v]) {
        msgs.push(`relax ${v}: ${dist[u]}+${w} < ${dStr(dist[v])} → dist[${v}]=${nd}`);
        dist[v] = nd;
        parent[v] = u;
        pq.push({ node: v, d: nd });
        improved.push(v);
      }
    }
    const caption = `Pop ${u} (d=${d}), finalise it. ` + (msgs.length ? msgs.join('; ') + '.' : 'No edges improve.');
    frames.push(snap(u, improved, caption));
  }

  frames.push(snap(null, [], 'Done — every reachable vertex is finalised. The emerald edges form the shortest-path tree.'));
  return frames;
}

function parseWeighted(s: string): WEdge[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [pair, ws] = p.split(':');
    const [u, v] = (pair || '').split('-').map((x) => x.trim());
    const w = parseFloat((ws || '').trim());
    return { u, v, w };
  }).filter((e) => e.u && e.v && Number.isFinite(e.w));
}
