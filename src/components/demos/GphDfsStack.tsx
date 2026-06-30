import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Watch an iterative depth-first search run with an explicit stack.
   - Edit the edge list (comma-separated "A-B"), pick a start vertex.
   - Step through the search: each frame POPS a node, marks it visited,
     and PUSHES its unvisited neighbours back onto the stack.
   - Nodes are numbered by DFS visit order as they are discovered.
     The current node glows sky, visited nodes go emerald, and the DFS
     tree edges (parent links) light up in emerald as they form.
   - The live stack is shown as a chip row with its top marked.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { node: '#4f46e5', edge: '#94a3b8', cur: '#0ea5e9', done: '#10b981', tree: '#10b981' };

type E = [string, string];

type Frame = {
  current: string | null;
  stack: string[];
  visited: string[];
  order: Record<string, number>;
  tree: E[];
  caption: string;
};

export default function GphDfsStack() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('A-B, A-C, B-D, B-E, C-F, E-F');
  const [edges, setEdges] = useState<E[]>(() => parseEdges('A-B, A-C, B-D, B-E, C-F, E-F'));
  const [start, setStart] = useState('A');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // nodes in sorted order
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const [u, v] of edges) { if (!seen.includes(u)) seen.push(u); if (!seen.includes(v)) seen.push(v); }
    return seen.sort();
  })();

  // undirected adjacency list
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n, []));
  for (const [u, v] of edges) { adj.get(u)!.push(v); adj.get(v)!.push(u); }

  const effectiveStart = nodes.includes(start) ? start : (nodes[0] ?? 'A');

  const frames = buildFrames(nodes, adj, effectiveStart);
  const safeIdx = Math.min(idx, frames.length - 1);
  const frame = frames[safeIdx];

  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<string, { x: number; y: number }>();
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
    nodes.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, nodes.length);
      m.set(id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    });
    return m;
  })();

  function buildFrames(ns: string[], a: Map<string, string[]>, s: string): Frame[] {
    const out: Frame[] = [];
    if (!ns.length) return [{ current: null, stack: [], visited: [], order: {}, tree: [], caption: 'Add some edges to begin.' }];
    const visited = new Set<string>();
    const order = new Map<string, number>();
    const tree: E[] = [];
    const pushedBy = new Map<string, string>();
    const stack: string[] = [s];
    const snap = (current: string | null, caption: string) => out.push({
      current,
      stack: [...stack],
      visited: [...visited],
      order: Object.fromEntries(order),
      tree: tree.map((e) => [e[0], e[1]] as E),
      caption,
    });
    snap(null, `Start: push ${s} onto the stack.`);
    let guard = 0;
    while (stack.length && guard++ < 2000) {
      const vertex = stack.pop()!;
      if (visited.has(vertex)) { snap(vertex, `Pop ${vertex} — already visited, skip it.`); continue; }
      visited.add(vertex);
      order.set(vertex, order.size + 1);
      if (pushedBy.has(vertex)) tree.push([pushedBy.get(vertex)!, vertex]);
      const nbrs = (a.get(vertex) || []).slice().sort();
      const pushed: string[] = [];
      for (let i = nbrs.length - 1; i >= 0; i--) {
        const nb = nbrs[i];
        if (!visited.has(nb)) { stack.push(nb); pushedBy.set(nb, vertex); pushed.unshift(nb); }
      }
      const cap = pushed.length
        ? `Pop ${vertex}, mark visited; push neighbour${pushed.length > 1 ? 's' : ''} ${pushed.join(', ')} onto the stack.`
        : `Pop ${vertex}, mark visited; no unvisited neighbours to push.`;
      snap(vertex, cap);
    }
    return out;
  }

  const commit = () => {
    const p = parseEdges(text);
    if (p.length) { setEdges(p); setIdx(0); setPlaying(false); }
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // all graph edges (gray)
    for (const [u, v] of edges) {
      const a = pos.get(u), b = pos.get(v); if (!a || !b) continue;
      ctx.strokeStyle = COLORS.edge; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // DFS tree edges (emerald, on top)
    for (const [u, v] of frame.tree) {
      const a = pos.get(u), b = pos.get(v); if (!a || !b) continue;
      ctx.strokeStyle = COLORS.tree; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const visitedSet = new Set(frame.visited);

    // nodes
    for (const n of nodes) {
      const p = pos.get(n)!;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = n === frame.current ? COLORS.cur : visitedSet.has(n) ? COLORS.done : COLORS.node;
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);

      // visit-order badge
      const ord = frame.order[n];
      if (ord) {
        const bx = p.x + 14, by = p.y - 14;
        ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.tree; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px ui-sans-serif, system-ui';
        ctx.fillText(String(ord), bx, by + 0.5);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = 300;
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
  useEffect(draw, [idx, edges, start]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, edges, start]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (safeIdx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const visitOrder = nodes
    .filter((n) => frame.order[n])
    .sort((a, b) => frame.order[a] - frame.order[b]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B, B-C, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-2 text-sm">start
          <select value={effectiveStart} onInput={(e) => { setStart((e.target as HTMLSelectElement).value); setIdx(0); setPlaying(false); }} class="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm">
            {nodes.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Stack (top pops next)</div>
            <div class="flex flex-wrap gap-1.5 rounded-lg bg-surface-2 p-2">
              {frame.stack.length === 0 && <span class="text-xs text-muted">empty</span>}
              {frame.stack.map((n, i) => (
                <span key={`${n}-${i}`} class={`rounded-md px-2 py-1 font-mono text-xs ${i === frame.stack.length - 1 ? 'bg-brand text-white font-bold' : 'bg-surface text-text border border-border'}`}>
                  {n}{i === frame.stack.length - 1 ? ' ◂ top' : ''}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">DFS visit order</div>
            <div class="rounded-lg bg-surface-2 p-2 font-mono text-xs text-text">
              {visitOrder.length ? visitOrder.map((n) => `${n}(${frame.order[n]})`).join(' → ') : '—'}
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Indigo = unvisited, <span class="text-[#0ea5e9] font-semibold">sky</span> = current,
            <span class="text-[#10b981] font-semibold"> emerald</span> = visited. The emerald links are the
            DFS tree; the small badge is each node's visit number.
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step {safeIdx} / {frames.length - 1}.</p>
    </div>
  );
}

function parseEdges(s: string): [string, string][] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [u, v] = p.split('-').map((x) => x.trim());
    return [u, v] as [string, string];
  }).filter(([u, v]) => u && v);
}
