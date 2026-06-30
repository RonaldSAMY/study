import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   A* search on a NODE-LINK weighted graph (not a grid).
   - Nodes have fixed (x, y) coordinates, so a straight-line (Euclidean)
     distance to the goal is a meaningful, admissible heuristic h.
   - Pick a START and a GOAL. We precompute the FRAMES of A*: each frame
     pops the lowest-f node from the open set (sky), moves it to the
     closed set (emerald), and relaxes its neighbours, updating g, h, f
     and parent. The goal frame draws the final parent-chain path.
   - Transport: Back / Play / Step / Reset + speed. Index-driven, raf.
   ------------------------------------------------------------------ */

const COLORS = { node: '#4f46e5', head: '#0ea5e9', closed: '#10b981', edge: '#94a3b8', path: '#10b981' };

// Logical coordinates (x in 0..8, y in 0..3) drive both the layout and h.
const NODES: Record<string, { lx: number; ly: number }> = {
  A: { lx: 0, ly: 0 },
  B: { lx: 1, ly: 3 },
  C: { lx: 2, ly: 0 },
  D: { lx: 4, ly: 2 },
  E: { lx: 5, ly: 0 },
  F: { lx: 7, ly: 3 },
  G: { lx: 8, ly: 1 },
};
const IDS = Object.keys(NODES);
const EDGES: [string, string][] = [
  ['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'],
  ['D', 'F'], ['D', 'G'], ['E', 'G'], ['F', 'G'],
];

const round1 = (x: number) => Math.round(x * 10) / 10;
const fmt = (x: number) => x.toFixed(1);
const dist = (a: string, b: string) => Math.hypot(NODES[a].lx - NODES[b].lx, NODES[a].ly - NODES[b].ly);
const weight = (a: string, b: string) => round1(dist(a, b));

type Label = { g: number; h: number; f: number };
type Chip = { id: string; g: number; h: number; f: number };
type Frame = {
  popped: string | null;
  closed: string[];
  open: Chip[];
  labels: Record<string, Label>;
  path: string[] | null;
  cost: number | null;
  caption: string;
};

function buildAdj() {
  const adj: Record<string, { to: string; cost: number }[]> = {};
  for (const id of IDS) adj[id] = [];
  for (const [u, v] of EDGES) {
    const w = weight(u, v);
    adj[u].push({ to: v, cost: w });
    adj[v].push({ to: u, cost: w });
  }
  return adj;
}

function cloneLabels(b: Record<string, Label>): Record<string, Label> {
  const o: Record<string, Label> = {};
  for (const k in b) o[k] = { ...b[k] };
  return o;
}

function computeFrames(start: string, goal: string): Frame[] {
  const adj = buildAdj();
  const h = (n: string) => round1(dist(n, goal));
  const open: { state: string; g: number; h: number; f: number }[] = [];
  const closed = new Set<string>();
  const gScore: Record<string, number> = { [start]: 0 };
  const parent: Record<string, string | null> = { [start]: null };
  const best: Record<string, Label> = { [start]: { g: 0, h: h(start), f: h(start) } };
  open.push({ state: start, g: 0, h: h(start), f: h(start) });

  const snapOpen = (): Chip[] => {
    const m = new Map<string, Chip>();
    for (const o of open) {
      const e = m.get(o.state);
      if (!e || o.f < e.f) m.set(o.state, { id: o.state, g: o.g, h: o.h, f: o.f });
    }
    return [...m.values()].filter((o) => !closed.has(o.id)).sort((a, b) => a.f - b.f);
  };

  const frames: Frame[] = [];
  frames.push({
    popped: null,
    closed: [],
    open: snapOpen(),
    labels: cloneLabels(best),
    path: null,
    cost: null,
    caption: `Start at ${start}. The open set holds ${start} with f = g + h = 0 + ${fmt(h(start))} = ${fmt(h(start))}. Press Play to expand the lowest-f node each step.`,
  });

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const key = cur.state;
    if (closed.has(key)) continue;

    if (key === goal) {
      closed.add(key);
      const path: string[] = [];
      let n: string | null = key;
      while (n != null) { path.unshift(n); n = parent[n]; }
      frames.push({
        popped: key,
        closed: [...closed],
        open: snapOpen(),
        labels: cloneLabels(best),
        path,
        cost: round1(cur.g),
        caption: `Pop the goal ${goal} with f = ${fmt(cur.f)}. Follow parents back to build the path ${path.join(' → ')}. Total cost g = ${fmt(cur.g)}.`,
      });
      return frames;
    }

    closed.add(key);
    const relax: string[] = [];
    for (const { to, cost } of adj[key]) {
      if (closed.has(to)) continue;
      const tentativeG = round1(cur.g + cost);
      if (tentativeG < (gScore[to] ?? Infinity)) {
        const hn = h(to);
        gScore[to] = tentativeG;
        parent[to] = key;
        best[to] = { g: tentativeG, h: hn, f: round1(tentativeG + hn) };
        open.push({ state: to, g: tentativeG, h: hn, f: round1(tentativeG + hn) });
        relax.push(`${to} → g=${fmt(tentativeG)}, f=${fmt(round1(tentativeG + hn))}`);
      }
    }
    const tail = relax.length ? `; relax ${relax.join(', ')}` : '; no neighbour improved';
    frames.push({
      popped: key,
      closed: [...closed],
      open: snapOpen(),
      labels: cloneLabels(best),
      path: null,
      cost: null,
      caption: `Expand ${key}: g=${fmt(cur.g)}, h=${fmt(cur.h)}, f=${fmt(cur.f)}${tail}.`,
    });
  }
  return frames;
}

export default function GphAStarGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [start, setStart] = useState('A');
  const [goal, setGoal] = useState('G');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frames = useMemo(() => computeFrames(start, goal), [start, goal]);
  const last = frames.length - 1;
  const frame = frames[Math.min(idx, last)];

  const posOf = (id: string) => {
    const { w, h } = sizeRef.current;
    const padX = 46, padY = 46;
    const { lx, ly } = NODES[id];
    return { x: padX + (lx / 8) * (w - 2 * padX), y: h - padY - (ly / 3) * (h - 2 * padY) };
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, last)];
    const closedSet = new Set(f.closed);

    // edges + weight labels
    ctx.lineWidth = 2;
    for (const [u, v] of EDGES) {
      const a = posOf(u), b = posOf(v);
      ctx.strokeStyle = COLORS.edge;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(weight(u, v)), mx, my - 7);
    }

    // final path (parent chain) as a thick emerald line
    if (f.path) {
      ctx.strokeStyle = COLORS.path;
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      f.path.forEach((id, i) => { const p = posOf(id); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    }

    // nodes + g/h/f labels
    for (const id of IDS) {
      const p = posOf(id);
      const isHead = id === f.popped;
      const isClosed = closedSet.has(id);
      ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = isHead ? COLORS.head : isClosed ? COLORS.closed : COLORS.node;
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(id, p.x, p.y);
      const lab = f.labels[id];
      if (lab) {
        ctx.fillStyle = '#475569'; ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`g${fmt(lab.g)} h${fmt(lab.h)} f${fmt(lab.f)}`, p.x, p.y - 25);
      }
      if (id === start || id === goal) {
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 10px ui-sans-serif, system-ui';
        ctx.fillText(id === start ? 'START' : 'GOAL', p.x, p.y + 26);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
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
  useEffect(draw, [idx, frames]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > last) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const pickStart = (v: string) => { setStart(v); if (v === goal) setGoal(IDS.find((x) => x !== v)!); reset(); };
  const pickGoal = (v: string) => { setGoal(v); if (v === start) setStart(IDS.find((x) => x !== v)!); reset(); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label class="flex items-center gap-2">start
          <select value={start} onChange={(e) => pickStart((e.target as HTMLSelectElement).value)} class="rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono">
            {IDS.map((id) => (<option key={id} value={id}>{id}</option>))}
          </select>
        </label>
        <label class="flex items-center gap-2">goal
          <select value={goal} onChange={(e) => pickGoal((e.target as HTMLSelectElement).value)} class="rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono">
            {IDS.map((id) => (<option key={id} value={id}>{id}</option>))}
          </select>
        </label>
        <span class="ml-auto text-xs text-muted">h = straight-line distance to goal</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Open set — sorted by f = g + h</div>
            <div class="flex flex-wrap gap-1.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {frame.open.length === 0 ? (<span class="text-muted">empty</span>) : frame.open.map((c, i) => (
                <span key={c.id} class={`rounded px-1.5 py-0.5 ${i === 0 ? 'bg-[#0ea5e9] text-white' : 'bg-surface text-text'}`}>
                  {c.id} f={fmt(c.f)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Closed set — finalised</div>
            <div class="flex flex-wrap gap-1.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {frame.closed.length === 0 ? (<span class="text-muted">empty</span>) : frame.closed.map((id) => (
                <span key={id} class="rounded bg-[#10b981] px-1.5 py-0.5 text-white">{id}</span>
              ))}
            </div>
          </div>
          {frame.cost != null && (
            <div class="rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <span class="text-muted">path cost</span>
              <div class="font-mono font-semibold text-[#10b981]">{fmt(frame.cost)}</div>
            </div>
          )}
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
      <p class="mt-2 text-center text-xs text-muted">Step {Math.min(idx, last)} / {last} expansions.</p>
    </div>
  );
}
