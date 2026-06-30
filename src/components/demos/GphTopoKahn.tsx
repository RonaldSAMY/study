import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Kahn's algorithm (topological sort by BFS on in-degrees).
   - Edit the directed edge list (comma-separated "A-B" = A→B).
   - We precompute the FRAMES of Kahn's algorithm. Each frame pops one
     zero in-degree node, appends it to the output order, and decrements
     each neighbour's in-degree badge (enqueuing any that hit 0).
   - The graph is drawn with arrowheads; every node shows its CURRENT
     in-degree as a small badge. A live queue (chips) and growing output
     row track the algorithm's state, with a caption explaining each step.
   - Transport: Back / Play-Pause / Step / Reset + speed. Index-driven,
     animated with requestAnimationFrame (cleaned up on unmount).
   ------------------------------------------------------------------ */

const COLORS = {
  node: '#4f46e5',   // indigo — unprocessed
  edge: '#94a3b8',   // slate — directed edge
  pop: '#0ea5e9',    // sky — the node popped this frame
  done: '#10b981',   // emerald — already in the output
  flash: '#f59e0b',  // amber — neighbour whose in-degree just dropped
};

const R = 16; // node radius

type E = [string, string];

type Frame = {
  inDeg: Map<string, number>;
  queue: string[];
  output: string[];
  popped: string | null;
  flashed: string[];
  caption: string;
};

export default function GphTopoKahn() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('A-B, A-C, B-D, C-D, D-E');
  const [edges, setEdges] = useState<E[]>(() => parseEdges('A-B, A-C, B-D, C-D, D-E'));
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

  // directed adjacency list
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n, []));
  for (const [u, v] of edges) adj.get(u)!.push(v);

  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<string, { x: number; y: number }>();
    const cx = w / 2, cy = h / 2, RR = Math.min(w, h) * 0.38;
    nodes.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, nodes.length);
      m.set(id, { x: cx + RR * Math.cos(a), y: cy + RR * Math.sin(a) });
    });
    return m;
  })();

  const { frames, cyclic } = buildFrames(nodes, adj);
  const safeIdx = Math.min(idx, frames.length - 1);
  const frame = frames[safeIdx];

  const commit = () => {
    const p = parseEdges(text);
    if (p.length) { setEdges(p); setIdx(0); setPlaying(false); lastRef.current = 0; }
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // directed edges with arrowheads
    for (const [u, v] of edges) {
      const a = pos.get(u)!, b = pos.get(v)!;
      drawArrow(ctx, a, b, COLORS.edge);
    }

    // nodes
    const outputSet = new Set(frame.output);
    const flashedSet = new Set(frame.flashed);
    for (const n of nodes) {
      const p = pos.get(n)!;
      let fill = COLORS.node;
      if (n === frame.popped) fill = COLORS.pop;
      else if (flashedSet.has(n)) fill = COLORS.flash;
      else if (outputSet.has(n)) fill = COLORS.done;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);

      // in-degree badge (top-right)
      const bx = p.x + R * 0.95, by = p.y - R * 0.95;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.fillText(`${frame.inDeg.get(n) ?? 0}`, bx, by + 0.5);
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
  useEffect(draw, [idx, edges]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
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

  const lastFrame = frames.length - 1;
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(lastFrame, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= lastFrame) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B, A-C, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <span class="text-xs text-muted">each "A-B" is a directed edge A→B</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Queue — zero in-degree</div>
            <div class="flex min-h-[2rem] flex-wrap gap-1.5 rounded-lg bg-surface-2 p-2">
              {frame.queue.length === 0
                ? <span class="text-xs text-muted">(empty)</span>
                : frame.queue.map((n, i) => (
                    <span key={n} class={`rounded-md px-2 py-0.5 font-mono text-xs font-bold text-white ${i === 0 ? 'bg-[#0ea5e9]' : 'bg-[#4f46e5]'}`}>{n}</span>
                  ))}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Output order</div>
            <div class="flex min-h-[2rem] flex-wrap items-center gap-1.5 rounded-lg bg-surface-2 p-2">
              {frame.output.length === 0
                ? <span class="text-xs text-muted">(nothing yet)</span>
                : frame.output.map((n, i) => (
                    <span key={n} class="flex items-center gap-1.5">
                      {i > 0 && <span class="text-muted">→</span>}
                      <span class="rounded-md bg-[#10b981] px-2 py-0.5 font-mono text-xs font-bold text-white">{n}</span>
                    </span>
                  ))}
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-2 text-xs text-muted">
            Each badge on a node is its <strong>current in-degree</strong>. A node is ready (joins the queue) the moment its badge hits 0.
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
      <p class="mt-2 text-center text-xs text-muted">
        Step {safeIdx} / {lastFrame}{cyclic ? ' · cycle detected — not all nodes can be ordered' : ''}
      </p>
    </div>
  );
}

function buildFrames(nodes: string[], adj: Map<string, string[]>): { frames: Frame[]; cyclic: boolean } {
  const inDeg = new Map<string, number>();
  nodes.forEach((n) => inDeg.set(n, 0));
  for (const n of nodes) for (const m of adj.get(n) || []) inDeg.set(m, (inDeg.get(m) || 0) + 1);

  const queue = nodes.filter((n) => inDeg.get(n) === 0);
  const output: string[] = [];
  const frames: Frame[] = [];

  frames.push({
    inDeg: new Map(inDeg),
    queue: [...queue],
    output: [],
    popped: null,
    flashed: [],
    caption: `Compute every node's in-degree. Enqueue the zero in-degree nodes: ${queue.join(', ') || '(none — the graph has a cycle)'}.`,
  });

  while (queue.length > 0) {
    const v = queue.shift()!;
    output.push(v);
    const flashed: string[] = [];
    const enq: string[] = [];
    for (const n of adj.get(v) || []) {
      const d = (inDeg.get(n) || 0) - 1;
      inDeg.set(n, d);
      flashed.push(n);
      if (d === 0) { queue.push(n); enq.push(n); }
    }
    let caption = `Output ${v}.`;
    if (enq.length) caption += ` ${joinAnd(enq)} drop to in-degree 0 → enqueue.`;
    const others = flashed.filter((n) => !enq.includes(n));
    if (others.length) caption += ` ${joinAnd(others)} decremented.`;
    if (flashed.length === 0) caption += ` It has no outgoing edges.`;
    frames.push({ inDeg: new Map(inDeg), queue: [...queue], output: [...output], popped: v, flashed, caption });
  }

  const cyclic = output.length !== nodes.length;
  if (cyclic) {
    const stuck = nodes.filter((n) => !output.includes(n));
    frames.push({
      inDeg: new Map(inDeg),
      queue: [],
      output: [...output],
      popped: null,
      flashed: [],
      caption: `Queue empty, but only ${output.length} of ${nodes.length} nodes were output. ${joinAnd(stuck)} still have positive in-degree — a cycle blocks them. No valid order exists.`,
    });
  } else {
    frames.push({
      inDeg: new Map(inDeg),
      queue: [],
      output: [...output],
      popped: null,
      flashed: [],
      caption: `Done. All ${nodes.length} nodes output: ${output.join(' → ')}. Every edge points left-to-right — a valid topological order.`,
    });
  }

  return { frames, cyclic };
}

function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const sx = a.x + R * Math.cos(ang), sy = a.y + R * Math.sin(ang);
  const tx = b.x - R * Math.cos(ang), ty = b.y - R * Math.sin(ang);
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 9 * Math.cos(ang - 0.4), ty - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 9 * Math.cos(ang + 0.4), ty - 9 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

function parseEdges(s: string): E[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [u, v] = p.split('-').map((x) => x.trim());
    return [u, v] as E;
  }).filter(([u, v]) => u && v);
}
