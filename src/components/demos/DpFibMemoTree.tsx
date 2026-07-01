import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Fibonacci recursion tree with memoization.
   - Learner sets n (2..10) and toggles "Use memoization".
   - We do ONE depth-first pass building the call tree, recording nodes
     in call order (pre-order DFS). With memoization on, a node whose
     argument is already cached is a CACHE HIT: it becomes a leaf and its
     subtree is pruned. With it off, the full exponential tree is built.
   - `revealed` (an index) drives how many nodes are shown. The animation
     is index-driven, NOT live recursion: we replay the recorded events.
   - Canvas: devicePixelRatio scaling, responsive on resize.
   - Transport: Back / Play-Pause / Step / Reset + speed, like the other
     demos in this course.
   Colors: active node indigo #4f46e5, freshly computed sky #0ea5e9,
   cache hit emerald #10b981.
   ------------------------------------------------------------------ */

const COLORS = {
  active: '#4f46e5',
  computed: '#0ea5e9',
  hit: '#10b981',
  edge: 'rgba(100,116,139,0.45)',
  edgeOff: 'rgba(100,116,139,0.16)',
};

type Status = 'computed' | 'hit' | 'base';
type TreeNode = {
  id: number;
  arg: number;
  depth: number;
  parent: number | null;
  children: number[];
  status: Status;
  x: number; // leaf slot (fractional for internal nodes)
};
type Tree = {
  nodes: TreeNode[]; // in pre-order = reveal order
  byId: Map<number, TreeNode>;
  leaves: number;
  maxDepth: number;
};

// Actual fib value, used for captions and labels.
function fibVal(k: number): number {
  if (k <= 1) return k;
  let a = 0, b = 1;
  for (let i = 2; i <= k; i++) { const c = a + b; a = b; b = c; }
  return b;
}

// Count of calls in the naive recursion tree (number of tree nodes).
function naiveCalls(n: number): number {
  if (n <= 1) return 1;
  return 1 + naiveCalls(n - 1) + naiveCalls(n - 2);
}

// Count of calls when memoizing (cache after a node's children finish).
function memoCalls(n: number): number {
  let count = 0;
  const cached = new Set<number>();
  const go = (k: number) => {
    count++;
    if (k <= 1) return;
    if (cached.has(k)) return;
    go(k - 1);
    go(k - 2);
    cached.add(k);
  };
  go(n);
  return count;
}

function buildTree(n: number, memo: boolean): Tree {
  const nodes: TreeNode[] = [];
  const byId = new Map<number, TreeNode>();
  const cached = new Set<number>();
  let nextId = 0;
  let maxDepth = 0;

  const build = (arg: number, depth: number, parent: number | null): TreeNode => {
    const id = nextId++;
    if (depth > maxDepth) maxDepth = depth;
    const node: TreeNode = { id, arg, depth, parent, children: [], status: 'computed', x: 0 };
    nodes.push(node); // pre-order: this is the call (reveal) order
    byId.set(id, node);

    if (arg <= 1) { node.status = 'base'; return node; }
    if (memo && cached.has(arg)) { node.status = 'hit'; return node; } // prune subtree

    node.status = 'computed';
    const left = build(arg - 1, depth + 1, id);
    const right = build(arg - 2, depth + 1, id);
    node.children = [left.id, right.id];
    if (memo) cached.add(arg); // cache once children are done
    return node;
  };

  const root = build(n, 0, null);

  // Assign x by leaf spread: leaves get sequential slots, internal nodes
  // sit at the average of their children.
  let leaf = 0;
  const assignX = (id: number) => {
    const nd = byId.get(id)!;
    if (nd.children.length === 0) { nd.x = leaf++; return; }
    nd.children.forEach(assignX);
    const xs = nd.children.map((c) => byId.get(c)!.x);
    nd.x = xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assignX(root.id);

  return { nodes, byId, leaves: Math.max(1, leaf), maxDepth };
}

export default function DpFibMemoTree() {
  const [n, setN] = useState(6);
  const [memo, setMemo] = useState(true);
  const [idx, setIdx] = useState(0); // 0..nodes.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const tree = useMemo(() => buildTree(n, memo), [n, memo]);
  const total = tree.nodes.length;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef<Map<number, { px: number; py: number; r: number }>>(new Map());
  const treeRef = useRef<Tree>(tree);
  const idxRef = useRef(idx);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  treeRef.current = tree;
  idxRef.current = idx;

  // Reset the animation whenever the tree changes.
  useEffect(() => { setIdx(0); setPlaying(false); lastRef.current = 0; }, [tree]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = treeRef.current;
    const pos = posRef.current;
    const shown = idxRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // edges first (under the circles)
    ctx.lineWidth = 1.5;
    for (let i = 0; i < t.nodes.length; i++) {
      const nd = t.nodes[i];
      if (nd.parent == null) continue;
      const p = pos.get(nd.parent);
      const c = pos.get(nd.id);
      if (!p || !c) continue;
      const visible = i < shown;
      ctx.strokeStyle = visible ? COLORS.edge : COLORS.edgeOff;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(c.px, c.py);
      ctx.stroke();
    }

    // nodes
    for (let i = 0; i < t.nodes.length; i++) {
      if (i >= shown) continue;
      const nd = t.nodes[i];
      const p = pos.get(nd.id);
      if (!p) continue;
      const isActive = i === shown - 1;
      const fill = isActive ? COLORS.active : nd.status === 'hit' ? COLORS.hit : COLORS.computed;
      ctx.beginPath();
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      // arg label inside
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(p.r * 0.95)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${nd.arg}`, p.px, p.py + 0.5);

      // a small "cached" tick under cache hits when there is room
      if (nd.status === 'hit' && p.r >= 11) {
        ctx.fillStyle = COLORS.hit;
        ctx.font = `${Math.round(p.r * 0.8)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillText('✓', p.px, p.py + p.r + p.r * 0.7);
      }
    }
  };

  // Layout + resize. Re-binds when the tree changes (canvas height depends
  // on tree depth).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const relayout = () => {
      const t = treeRef.current;
      const parent = canvas.parentElement!;
      const cssW = Math.min(parent.clientWidth, 720);
      const marginX = 26;
      const marginTop = 28;
      const levelH = Math.max(48, Math.min(74, 360 / (t.maxDepth + 1)));
      const cssH = marginTop * 2 + t.maxDepth * levelH;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const innerW = cssW - 2 * marginX;
      const slotW = t.leaves > 1 ? innerW / (t.leaves - 1) : innerW;
      const r = Math.max(7, Math.min(20, levelH * 0.34, (t.leaves > 1 ? slotW * 0.42 : 20)));
      const pos = new Map<number, { px: number; py: number; r: number }>();
      for (const nd of t.nodes) {
        const px = t.leaves > 1 ? marginX + (nd.x / (t.leaves - 1)) * innerW : cssW / 2;
        const py = marginTop + nd.depth * levelH;
        pos.set(nd.id, { px, py, r });
      }
      posRef.current = pos;
      draw();
    };
    relayout();
    window.addEventListener('resize', relayout);
    return () => {
      window.removeEventListener('resize', relayout);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  useEffect(draw, [idx, tree]);

  // Autoplay loop.
  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 700 / speed;
    const tick = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      if (ts - lastRef.current >= interval) {
        lastRef.current = ts;
        const next = idxRef.current + 1;
        if (next >= total) { setIdx(total); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total) { setIdx(0); } lastRef.current = 0; setPlaying((p) => !p); };

  // Caption for the current head node.
  const head = idx > 0 ? tree.nodes[idx - 1] : null;
  let caption: string;
  if (!head) {
    caption = `Press Play to expand fib(${n}) in call order. ${memo ? 'Cache hits will be pruned.' : 'No cache — watch every branch be recomputed.'}`;
  } else if (head.status === 'base') {
    caption = `fib(${head.arg}): base case — return ${head.arg} directly.`;
  } else if (head.status === 'hit') {
    caption = `fib(${head.arg}): cache hit — reuse ${fibVal(head.arg)}, skip its whole subtree.`;
  } else {
    caption = `fib(${head.arg}): not cached — compute fib(${head.arg - 1}) + fib(${head.arg - 2}).`;
  }

  const naive = naiveCalls(n);
  const memod = memoCalls(n);
  const done = idx >= total;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* controls */}
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-text">
          n =
          <input
            type="number"
            min={2}
            max={10}
            value={n}
            onInput={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value, 10);
              if (Number.isFinite(v)) setN(Math.max(2, Math.min(10, v)));
            }}
            class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm"
          />
        </label>
        <label class="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={memo}
            onInput={(e) => setMemo((e.target as HTMLInputElement).checked)}
            class="h-4 w-4 accent-[#4f46e5]"
          />
          Use memoization
        </label>
        <button onClick={reset} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">↻ Rebuild</button>
      </div>

      {/* legend */}
      <div class="mb-2 flex flex-wrap gap-3 text-xs text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style={`background:${COLORS.active}`} /> active call</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style={`background:${COLORS.computed}`} /> freshly computed</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style={`background:${COLORS.hit}`} /> cache hit (pruned)</span>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          fib({n}) = {fibVal(n)}. {memo
            ? `Memoization made ${memod} calls — the tree collapsed to (almost) a line.`
            : `The naive tree exploded to ${naive} calls. Turn on memoization to prune it.`}
        </p>
      )}

      {/* counts readout */}
      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="naive calls" value={`${naive}`} />
        <Readout label="memoized calls" value={`${memod}`} />
        <Readout label="revealed" value={`${idx} / ${total}`} />
      </div>

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>

      <p class="mt-2 text-center text-xs text-muted">Tip: toggle memoization off and rebuild to watch the same fib(n) explode into a full binary tree.</p>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted text-xs">{label}</span>
      <div class="font-mono font-semibold text-text">{value}</div>
    </div>
  );
}
