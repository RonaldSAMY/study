import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Breadth-First Search, driven by a queue.
   - Edit the undirected edge list ("A-B, A-C, ...") and pick a start node.
   - Precompute FRAMES of a BFS run: each frame dequeues one node, marks it
     visited, and enqueues its unvisited neighbours (one level deeper).
   - The canvas draws nodes (indigo), edges (gray), highlights the current
     node (sky) and the visited set (emerald), and labels each node with the
     BFS level at which it was discovered. The queue shows as a row of chips.
   - Transport: Play / Pause / Step / Back / Reset + speed. Index-driven.
   ------------------------------------------------------------------ */

const COLORS = { node: '#4f46e5', edge: '#94a3b8', cur: '#0ea5e9', done: '#10b981' };

type E = [string, string];
type Frame = {
  current: string | null;
  queue: string[];
  visited: string[];
  level: Record<string, number>;
  caption: string;
};

export default function GphBfsQueue() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 320 });
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

  // helpers (kept inside the island) ---------------------------------
  function parseEdges(s: string): E[] {
    return s
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [u, v] = p.split('-').map((x) => x.trim());
        return [u, v] as E;
      })
      .filter(([u, v]) => u && v);
  }

  function buildAdj(es: E[], ns: string[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    ns.forEach((n) => adj.set(n, []));
    for (const [u, v] of es) {
      if (!adj.get(u)!.includes(v)) adj.get(u)!.push(v);
      if (!adj.get(v)!.includes(u)) adj.get(v)!.push(u);
    }
    for (const n of ns) adj.get(n)!.sort();
    return adj;
  }

  function computeFrames(adj: Map<string, string[]>, s: string): Frame[] {
    const frames: Frame[] = [];
    const visited = new Set<string>([s]);
    const level: Record<string, number> = { [s]: 0 };
    const queue: string[] = [s];
    frames.push({ current: null, queue: [...queue], visited: [...visited], level: { ...level }, caption: `Start: enqueue ${s} at level 0.` });
    while (queue.length) {
      const v = queue.shift()!;
      const enq: string[] = [];
      for (const n of adj.get(v) || []) {
        if (!visited.has(n)) {
          visited.add(n);
          level[n] = level[v] + 1;
          queue.push(n);
          enq.push(n);
        }
      }
      const caption = enq.length
        ? `Dequeue ${v} (level ${level[v]}); enqueue neighbour${enq.length > 1 ? 's' : ''} ${enq.join(', ')}.`
        : `Dequeue ${v} (level ${level[v]}); every neighbour already visited.`;
      frames.push({ current: v, queue: [...queue], visited: [...visited], level: { ...level }, caption });
    }
    frames.push({ current: null, queue: [], visited: [...visited], level: { ...level }, caption: `Queue empty: BFS complete. Visited ${visited.size} node${visited.size > 1 ? 's' : ''}.` });
    return frames;
  }

  // nodes in sorted order ------------------------------------------------
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const [u, v] of edges) {
      if (!seen.includes(u)) seen.push(u);
      if (!seen.includes(v)) seen.push(v);
    }
    return seen.sort();
  })();

  const startNode = nodes.includes(start) ? start : nodes[0] || start;

  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<string, { x: number; y: number }>();
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.36;
    nodes.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, nodes.length);
      m.set(id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    });
    return m;
  })();

  const adj = buildAdj(edges, nodes);
  const frames = nodes.length ? computeFrames(adj, startNode) : [];
  const maxIdx = Math.max(0, frames.length - 1);
  const safeIdx = Math.min(idx, maxIdx);
  const frame: Frame = frames[safeIdx] || { current: null, queue: [], visited: [], level: {}, caption: '' };

  const commit = () => {
    const p = parseEdges(text);
    if (p.length) {
      setEdges(p);
      setIdx(0);
      setPlaying(false);
      lastRef.current = 0;
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, frames.length - 1)] || frame;
    const visitedSet = new Set(f.visited);

    // edges
    for (const [u, v] of edges) {
      const a = pos.get(u);
      const b = pos.get(v);
      if (!a || !b) continue;
      ctx.strokeStyle = COLORS.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
      const p = pos.get(n)!;
      const isCur = n === f.current;
      const isVisited = visitedSet.has(n);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = isCur ? COLORS.cur : isVisited ? COLORS.done : COLORS.node;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);
      // level badge below the node once discovered
      if (n in f.level) {
        ctx.fillStyle = COLORS.done;
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.fillText(`L${f.level[n]}`, p.x, p.y + 27);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = 320;
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
  useEffect(draw, [idx, edges, start]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > maxIdx) {
          setPlaying(false);
          return;
        }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, edges, start, maxIdx]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (safeIdx >= maxIdx) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm"
          placeholder="A-B, A-C, ..."
        />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-2 text-sm">start
          <select
            value={startNode}
            onChange={(e) => { setStart((e.target as HTMLSelectElement).value); setIdx(0); setPlaying(false); lastRef.current = 0; }}
            class="rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm"
          >
            {nodes.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Queue (front → back)</div>
            <div class="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg bg-surface-2 p-2">
              {frame.queue.length === 0
                ? <span class="text-xs text-muted">empty</span>
                : frame.queue.map((n, i) => (
                    <span key={`${n}-${i}`} class={`rounded-md px-2 py-1 font-mono text-xs font-bold ${i === 0 ? 'bg-[#0ea5e9] text-white' : 'bg-brand-soft text-brand'}`}>{n}</span>
                  ))}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Visited (BFS order)</div>
            <div class="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg bg-surface-2 p-2">
              {frame.visited.length === 0
                ? <span class="text-xs text-muted">none yet</span>
                : frame.visited.map((n) => (
                    <span key={n} class="rounded-md bg-[#10b981] px-2 py-1 font-mono text-xs font-bold text-white">{n}<span class="ml-1 opacity-80">L{frame.level[n]}</span></span>
                  ))}
            </div>
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-muted">
            <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style="background:#4f46e5" />unvisited</span>
            <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style="background:#0ea5e9" />current</span>
            <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style="background:#10b981" />visited</span>
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
      <p class="mt-2 text-center text-xs text-muted">Step {safeIdx} / {maxIdx}</p>
    </div>
  );
}
