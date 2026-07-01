import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Segment Tree.
   - Builds a recursive segment tree over an editable array and draws it.
   - "Range query (sum)": animate the recursion. Each node is classified
     as SKIP (no overlap), CANONICAL (fully inside -> take its sum), or
     SPLIT (partial overlap -> recurse). The query lights up only the
     O(log n) canonical nodes that tile the range.
   - "Range add (lazy)": animate a range update with lazy propagation —
     fully-covered nodes get a lazy tag instead of touching their leaves;
     partial nodes push the pending delta DOWN before recursing.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

type Mode = 'query' | 'update';
type Status = 'skip' | 'canonical' | 'split' | 'lazy' | 'pushdown';
type Node = { id: number; start: number; end: number; depth: number; left: number; right: number; x: number; sum: number };

const COLORS: Record<Status, string> = {
  skip: 'rgba(148,163,184,0.25)',
  canonical: '#10b981',
  split: '#0ea5e9',
  lazy: '#10b981',
  pushdown: '#4f46e5',
};
const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 8);

function buildNodes(a: number[]): Node[] {
  const nodes: Node[] = [];
  const build = (start: number, end: number, depth: number): number => {
    const id = nodes.length;
    const node: Node = { id, start, end, depth, left: -1, right: -1, x: (start + end + 1) / 2, sum: 0 };
    nodes.push(node);
    if (start === end) { node.sum = a[start]; return id; }
    const mid = (start + end) >> 1;
    node.left = build(start, mid, depth + 1);
    node.right = build(mid + 1, end, depth + 1);
    node.sum = nodes[node.left].sum + nodes[node.right].sum;
    return id;
  };
  if (a.length) build(0, a.length - 1, 0);
  return nodes;
}

type Frame = { id: number; status: Status; note: string };

function queryFrames(nodes: Node[], l: number, r: number): Frame[] {
  const frames: Frame[] = [];
  const go = (id: number) => {
    const nd = nodes[id];
    if (r < nd.start || l > nd.end) { frames.push({ id, status: 'skip', note: `[${nd.start}..${nd.end}] is outside [${l}..${r}] — skip.` }); return; }
    if (l <= nd.start && nd.end <= r) { frames.push({ id, status: 'canonical', note: `[${nd.start}..${nd.end}] is fully inside -> take its stored sum ${nd.sum}.` }); return; }
    frames.push({ id, status: 'split', note: `[${nd.start}..${nd.end}] partly overlaps -> split and recurse into both children.` });
    go(nd.left); go(nd.right);
  };
  if (nodes.length) go(0);
  return frames;
}

function updateFrames(nodes: Node[], l: number, r: number): Frame[] {
  const frames: Frame[] = [];
  const go = (id: number) => {
    const nd = nodes[id];
    if (r < nd.start || l > nd.end) { frames.push({ id, status: 'skip', note: `[${nd.start}..${nd.end}] is outside the update range — skip.` }); return; }
    if (l <= nd.start && nd.end <= r) { frames.push({ id, status: 'lazy', note: `[${nd.start}..${nd.end}] is fully covered -> tag it LAZY. Stop here; do not descend.` }); return; }
    frames.push({ id, status: 'pushdown', note: `[${nd.start}..${nd.end}] partly covered -> push any pending lazy down, then recurse.` });
    go(nd.left); go(nd.right);
  };
  if (nodes.length) go(0);
  return frames;
}

export default function AdvSegmentTree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ ox: 8, cell: 56, rowH: 64, top: 18 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('2, 1, 5, 3, 4, 6, 2, 7');
  const [nums, setNums] = useState<number[]>(() => parseList('2, 1, 5, 3, 4, 6, 2, 7'));
  const [mode, setMode] = useState<Mode>('query');
  const [lo, setLo] = useState(1);
  const [hi, setHi] = useState(4);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const n = nums.length;
  const l = Math.min(lo, hi, n - 1);
  const r = Math.min(Math.max(lo, hi), n - 1);
  const nodes = buildNodes(nums);
  const maxDepth = nodes.reduce((m, nd) => Math.max(m, nd.depth), 0);
  const frames = mode === 'query' ? queryFrames(nodes, l, r) : updateFrames(nodes, l, r);

  const commit = () => { const p = parseList(text); if (p.length) { setNums(p); setIdx(0); setPlaying(false); setLo((v) => Math.min(v, p.length - 1)); setHi((v) => Math.min(v, p.length - 1)); } };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { ox, cell, rowH, top } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const shown = frames.slice(0, idxRef.current);
    const statusOf = new Map<number, Status>();
    for (const f of shown) statusOf.set(f.id, f.status);
    const cur = idxRef.current > 0 ? frames[idxRef.current - 1].id : -1;

    const px = (xUnits: number) => ox + xUnits * cell;
    const py = (depth: number) => top + depth * rowH + 16;

    // edges
    ctx.strokeStyle = 'rgba(128,128,128,0.35)';
    ctx.lineWidth = 1.5;
    for (const nd of nodes) {
      for (const c of [nd.left, nd.right]) {
        if (c < 0) continue;
        ctx.beginPath();
        ctx.moveTo(px(nd.x), py(nd.depth) + 14);
        ctx.lineTo(px(nodes[c].x), py(nodes[c].depth) - 14);
        ctx.stroke();
      }
    }
    // nodes
    for (const nd of nodes) {
      const st = statusOf.get(nd.id);
      const isCur = nd.id === cur;
      const x = px(nd.x);
      const y = py(nd.depth);
      const w = nd.start === nd.end ? 30 : 52;
      ctx.fillStyle = st ? COLORS[st] : 'rgba(128,128,128,0.12)';
      ctx.strokeStyle = isCur ? '#fff' : st ? '#ffffffaa' : 'rgba(128,128,128,0.4)';
      ctx.lineWidth = isCur ? 3 : 1.2;
      roundRect(ctx, x - w / 2, y - 14, w, 28, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = st && st !== 'skip' ? '#fff' : '#94a3b8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(nd.start === nd.end ? `${nd.start}` : `${nd.start}..${nd.end}`, x, y - 4);
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(`${nd.sum}`, x, y + 7);
    }
  };

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const cell = Math.max(28, Math.floor((w - 16) / n));
      const rowH = 60;
      const gw = cell * n + 16;
      const gh = (maxDepth + 1) * rowH + 36;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { ox: 8, cell, rowH, top: 18 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, maxDepth]);

  useEffect(draw, [nums, mode, l, r, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > frames.length) { setIdx(frames.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames.length]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const canonicalSoFar = frames.slice(0, idx).filter((f) => f.status === 'canonical');
  const runSum = canonicalSoFar.reduce((s, f) => s + nodes[f.id].sum, 0);
  const lazyCount = frames.slice(0, idx).filter((f) => f.status === 'lazy').length;

  const caption = idx === 0
    ? (mode === 'query'
      ? `query sum over [${l}..${r}]. We start at the root and recurse, keeping only the nodes that sit fully inside the range. Press Play.`
      : `range add over [${l}..${r}]. Fully-covered nodes get a LAZY tag (no descent); partial nodes push down first. Press Play.`)
    : frames[idx - 1].note + (mode === 'query' && canonicalSoFar.length ? `  (running sum ${runSum})` : '');
  const done = idx >= frames.length && frames.length > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers (max 8)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-3">
        <div class="flex gap-1">
          {(['query', 'update'] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setIdx(0); setPlaying(false); }} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
              {m === 'query' ? 'Range query' : 'Range add (lazy)'}
            </button>
          ))}
        </div>
        <label class="flex items-center gap-2 text-xs text-muted">l {l}
          <input type="range" min={0} max={n - 1} step={1} value={lo} onInput={(e) => { setLo(parseInt((e.target as HTMLInputElement).value, 10)); setIdx(0); setPlaying(false); }} class="w-24 accent-[#4f46e5]" />
        </label>
        <label class="flex items-center gap-2 text-xs text-muted">r {r}
          <input type="range" min={0} max={n - 1} step={1} value={hi} onInput={(e) => { setHi(parseInt((e.target as HTMLInputElement).value, 10)); setIdx(0); setPlaying(false); }} class="w-24 accent-[#0ea5e9]" />
        </label>
      </div>

      <div class="overflow-x-auto">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <div class="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style="background:#10b981" /> fully inside / lazy</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style="background:#0ea5e9" /> split</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style="background:#4f46e5" /> push down</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style="background:rgba(148,163,184,0.5)" /> skip</span>
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && mode === 'query' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">sum[{l}..{r}] = {runSum}, assembled from {canonicalSoFar.length} canonical node{canonicalSoFar.length === 1 ? '' : 's'}. At most 2 per level — that is the O(log n) guarantee.</p>}
      {done && mode === 'update' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">{lazyCount} node{lazyCount === 1 ? '' : 's'} tagged lazy instead of rewriting every leaf. The work paused at those nodes is "pushed down" only when a later query needs it.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Each node shows its <span class="font-mono">range</span> and stored <span class="font-mono">sum</span>. A clean power-of-two length (4, 8) draws the prettiest tree.</p>
    </div>
  );
}
