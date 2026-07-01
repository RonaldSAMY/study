import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated BVH query / culling.

   - A 2D top-down scene of many small objects (boxes).
   - We build a Bounding Volume Hierarchy by recursive median split:
     sort by centroid on the longest axis, cut in the middle, recurse.
   - A draggable rectangular "view" (the camera's query region) descends
     the tree. At each node we test its AABB against the view:
        * overlap  -> descend (keep exploring)
        * no overlap -> PRUNE the whole subtree (skip every object below)
     Leaves keep the objects that actually fall inside the view.
   - Transport: Play / Pause / Step / Back / Reset + speed. Steps are
     precomputed as an ordered traversal; requestAnimationFrame advances
     the step index, and it is cancelled on pause / unmount.

   The point: a scene of N objects is culled by touching ~O(log N) nodes
   instead of testing all N — whole off-screen subtrees vanish at once.
   ------------------------------------------------------------------ */

const COLORS = {
  current: '#4f46e5', // indigo — the node being visited
  view: '#4f46e5',
  kept: '#10b981', // emerald — visible objects
  obj: '#0ea5e9', // sky — untested objects
  culled: '#94a3b8', // slate — pruned objects
};

const WORLD = 100;
const LEAF_SIZE = 2;

type Box = { minx: number; miny: number; maxx: number; maxy: number };
type Obj = { id: number; box: Box; cx: number; cy: number };
type Node = {
  id: number;
  box: Box;
  left: Node | null;
  right: Node | null;
  prims: Obj[] | null;
  depth: number;
};
type Step = {
  nodeId: number;
  culled: number[]; // cumulative culled object ids
  kept: number[]; // cumulative kept (visible) object ids
  prunedRoots: number[]; // cumulative roots of pruned subtrees
  caption: string;
};

// --- deterministic RNG so a given object count always looks the same ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeObjects(count: number): Obj[] {
  const rng = mulberry32(1234);
  // A few loose clusters make the hierarchy visually meaningful.
  const centers = [
    [28, 30],
    [70, 35],
    [45, 72],
    [78, 78],
  ];
  const out: Obj[] = [];
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    const cx = Math.max(6, Math.min(94, c[0] + (rng() - 0.5) * 42));
    const cy = Math.max(6, Math.min(94, c[1] + (rng() - 0.5) * 42));
    const r = 1.6;
    out.push({ id: i, cx, cy, box: { minx: cx - r, miny: cy - r, maxx: cx + r, maxy: cy + r } });
  }
  return out;
}

function boundsOf(objs: Obj[]): Box {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const o of objs) {
    if (o.box.minx < minx) minx = o.box.minx;
    if (o.box.miny < miny) miny = o.box.miny;
    if (o.box.maxx > maxx) maxx = o.box.maxx;
    if (o.box.maxy > maxy) maxy = o.box.maxy;
  }
  return { minx, miny, maxx, maxy };
}

function overlap(a: Box, b: Box): boolean {
  if (a.maxx < b.minx || a.minx > b.maxx) return false;
  if (a.maxy < b.miny || a.miny > b.maxy) return false;
  return true;
}

// Recursive median-split BVH build. Ids are assigned in pre-order.
function buildBVH(objs: Obj[], depth: number, counter: { n: number }): Node {
  const box = boundsOf(objs);
  const node: Node = { id: counter.n++, box, left: null, right: null, prims: null, depth };
  if (objs.length <= LEAF_SIZE) {
    node.prims = objs;
    return node;
  }
  const w = box.maxx - box.minx;
  const h = box.maxy - box.miny;
  const axis: 'x' | 'y' = w >= h ? 'x' : 'y';
  const sorted = objs.slice().sort((p, q) => (axis === 'x' ? p.cx - q.cx : p.cy - q.cy));
  const mid = sorted.length >> 1;
  const L = sorted.slice(0, mid);
  const R = sorted.slice(mid);
  if (L.length === 0 || R.length === 0) {
    node.prims = objs;
    return node;
  }
  node.left = buildBVH(L, depth + 1, counter);
  node.right = buildBVH(R, depth + 1, counter);
  return node;
}

function collectNodes(root: Node): { list: Node[]; descendants: Map<number, number[]> } {
  const list: Node[] = [];
  const descendants = new Map<number, number[]>();
  const walk = (n: Node): number[] => {
    list.push(n);
    let ids = [n.id];
    if (n.left) ids = ids.concat(walk(n.left));
    if (n.right) ids = ids.concat(walk(n.right));
    descendants.set(n.id, ids);
    return ids;
  };
  walk(root);
  return { list, descendants };
}

function subtreeObjs(n: Node): Obj[] {
  if (n.prims) return n.prims;
  let out: Obj[] = [];
  if (n.left) out = out.concat(subtreeObjs(n.left));
  if (n.right) out = out.concat(subtreeObjs(n.right));
  return out;
}

// Precompute the ordered list of traversal steps against a query box.
function buildSteps(root: Node, query: Box): Step[] {
  const steps: Step[] = [];
  const culled = new Set<number>();
  const kept = new Set<number>();
  const prunedRoots: number[] = [];

  const snap = (nodeId: number, caption: string) =>
    steps.push({
      nodeId,
      caption,
      culled: [...culled],
      kept: [...kept],
      prunedRoots: [...prunedRoots],
    });

  const visit = (node: Node) => {
    if (!overlap(node.box, query)) {
      const objs = subtreeObjs(node);
      objs.forEach((o) => culled.add(o.id));
      prunedRoots.push(node.id);
      snap(node.id, `visit node ${node.id} — AABB outside the view, prune ${objs.length} object${objs.length === 1 ? '' : 's'}`);
      return;
    }
    if (node.prims) {
      let k = 0, c = 0;
      for (const o of node.prims) {
        if (overlap(o.box, query)) { kept.add(o.id); k++; }
        else { culled.add(o.id); c++; }
      }
      snap(node.id, `leaf node ${node.id} — keep ${k} visible, cull ${c} just outside`);
      return;
    }
    snap(node.id, `visit node ${node.id} — AABB overlaps the view, descend into children`);
    if (node.left) visit(node.left);
    if (node.right) visit(node.right);
  };

  visit(root);
  return steps;
}

export default function G3dBvhCull() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(24);
  const [objects, setObjects] = useState<Obj[]>(() => makeObjects(24));
  const [query, setQuery] = useState<Box>({ minx: 16, miny: 12, maxx: 52, maxy: 58 });
  const [idx, setIdx] = useState(0); // 0..steps.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const sizeRef = useRef({ w: 480, pad: 26 });

  // Rebuild the tree + traversal every render (n is small, so this is cheap).
  const root = buildBVH(objects, 0, { n: 0 });
  const { list: nodeList, descendants } = collectNodes(root);
  const nodeById = new Map(nodeList.map((n) => [n.id, n]));
  const steps = buildSteps(root, query);
  const clamped = Math.min(idx, steps.length);
  const view = clamped === 0 ? null : steps[clamped - 1];

  // ---- world <-> pixel mapping ----
  const sx = (x: number) => { const { w, pad } = sizeRef.current; return pad + (x / WORLD) * (w - 2 * pad); };
  const sy = (y: number) => { const { w, pad } = sizeRef.current; return pad + (y / WORLD) * (w - 2 * pad); };
  const toWorld = (px: number, py: number) => {
    const { w, pad } = sizeRef.current;
    return { x: ((px - pad) / (w - 2 * pad)) * WORLD, y: ((py - pad) / (w - 2 * pad)) * WORLD };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w } = sizeRef.current;
    ctx.clearRect(0, 0, w, w);

    const graySet = new Set<number>();
    if (view) for (const r of view.prunedRoots) for (const d of descendants.get(r) || []) graySet.add(d);
    const keptSet = new Set(view ? view.kept : []);
    const culledSet = new Set(view ? view.culled : []);

    // BVH node boxes (deeper = fainter). Pruned subtrees drawn gray/dashed.
    for (const n of nodeList) {
      const x = sx(n.box.minx), y = sy(n.box.miny);
      const bw = sx(n.box.maxx) - x, bh = sy(n.box.maxy) - y;
      if (graySet.has(n.id)) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(148,163,184,0.55)';
        ctx.lineWidth = 1;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(100,116,139,${Math.max(0.08, 0.34 - n.depth * 0.05)})`;
        ctx.lineWidth = 1;
      }
      ctx.strokeRect(x, y, bw, bh);
    }
    ctx.setLineDash([]);

    // The currently-visited node, highlighted.
    if (view) {
      const n = nodeById.get(view.nodeId);
      if (n) {
        const x = sx(n.box.minx), y = sy(n.box.miny);
        ctx.strokeStyle = COLORS.current;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, sx(n.box.maxx) - x, sy(n.box.maxy) - y);
        ctx.fillStyle = 'rgba(79,70,229,0.07)';
        ctx.fillRect(x, y, sx(n.box.maxx) - x, sy(n.box.maxy) - y);
      }
    }

    // Objects.
    for (const o of objects) {
      const x = sx(o.box.minx), y = sy(o.box.miny);
      const ow = sx(o.box.maxx) - x, oh = sy(o.box.maxy) - y;
      let fill = COLORS.obj;
      if (keptSet.has(o.id)) fill = COLORS.kept;
      else if (culledSet.has(o.id)) fill = COLORS.culled;
      ctx.fillStyle = fill;
      ctx.globalAlpha = culledSet.has(o.id) ? 0.4 : 1;
      ctx.fillRect(x, y, Math.max(4, ow), Math.max(4, oh));
      ctx.globalAlpha = 1;
    }

    // The query view rectangle.
    const qx = sx(query.minx), qy = sy(query.miny);
    const qw = sx(query.maxx) - qx, qh = sy(query.maxy) - qy;
    ctx.fillStyle = 'rgba(79,70,229,0.10)';
    ctx.fillRect(qx, qy, qw, qh);
    ctx.strokeStyle = COLORS.view;
    ctx.lineWidth = 2;
    ctx.strokeRect(qx, qy, qw, qh);
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const size = Math.min(parent.clientWidth, 460);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: size, pad: 26 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on any state change
  useEffect(draw, [objects, query, idx, count]);

  // regenerate objects when the count slider moves
  useEffect(() => {
    setObjects(makeObjects(count));
    setIdx(0);
    setPlaying(false);
  }, [count]);

  // ---- animation loop ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 720 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= steps.length + 1) { setIdx(steps.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, steps.length]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(steps.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= steps.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  // ---- drag the query view ----
  const ptr = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onDown = (e: PointerEvent) => {
    const p = ptr(e);
    if (p.x >= query.minx && p.x <= query.maxx && p.y >= query.miny && p.y <= query.maxy) {
      const cx = (query.minx + query.maxx) / 2;
      const cy = (query.miny + query.maxy) / 2;
      dragRef.current = { dx: p.x - cx, dy: p.y - cy };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = ptr(e);
    const hw = (query.maxx - query.minx) / 2;
    const hh = (query.maxy - query.miny) / 2;
    let cx = p.x - dragRef.current.dx;
    let cy = p.y - dragRef.current.dy;
    cx = Math.max(hw, Math.min(WORLD - hw, cx));
    cy = Math.max(hh, Math.min(WORLD - hh, cy));
    setQuery({ minx: cx - hw, miny: cy - hh, maxx: cx + hw, maxy: cy + hh });
    setIdx(0);
    setPlaying(false);
  };
  const onUp = () => { dragRef.current = null; };

  const visited = clamped;
  const culledCount = view ? view.culled.length : 0;
  const keptCount = view ? view.kept.length : 0;
  const done = clamped >= steps.length && steps.length > 0;
  const caption = clamped === 0
    ? 'The view (indigo rectangle) is the camera query. Press Play to descend the BVH, pruning off-screen subtrees.'
    : view!.caption;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the <span style={`color:${COLORS.view}`} class="font-semibold">indigo view</span> across the scene. Emerald objects are kept (visible); faded gray ones were culled.</p>

          <div class="grid grid-cols-3 gap-2 font-mono">
            <Stat label="nodes hit" value={`${visited} / ${nodeList.length}`} />
            <Stat label="kept" value={`${keptCount}`} color={COLORS.kept} />
            <Stat label="culled" value={`${culledCount} / ${objects.length}`} color={COLORS.culled} />
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">objects = {count}</span>
            <input
              type="range" min={8} max={48} step={4} value={count}
              onInput={(e) => setCount(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{caption}</p>
          {done && (
            <p class="rounded-lg bg-brand-soft px-3 py-2 font-semibold text-text">
              Done: {visited} node tests culled {culledCount} of {objects.length} objects. Brute force would have tested all {objects.length} individually.
            </p>
          )}
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#10b981]" />
        </label>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <div class="text-[11px] text-muted">{label}</div>
      <div class="font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
