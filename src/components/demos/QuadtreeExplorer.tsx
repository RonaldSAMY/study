import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive quadtree explorer.
   - Edit mode: click empty space to add an object, drag a dot to move it.
   - Query mode: drag a rectangle; the quadtree returns candidate objects.
   - The tree subdivides any cell that holds more than `capacity` objects,
     and we draw every cell boundary so you can watch the structure grow.
   - The readout compares points the quadtree had to check against a
     brute-force scan of every object.
   All geometry lives in normalized [0,1] space so resizing is lossless;
   we convert to pixels only when drawing.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number }; // x,y = top-left

const COLORS = {
  obj: '#4f46e5', // indigo
  query: '#0ea5e9', // sky
  hit: '#10b981', // emerald
  cell: 'rgba(128,128,128,0.28)',
  cellHot: 'rgba(14,165,233,0.10)',
};

const MAX_DEPTH = 6;

// ---- rectangle / point geometry (normalized space) ----
const contains = (r: Rect, p: Pt) =>
  p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

const intersects = (a: Rect, b: Rect) =>
  !(b.x > a.x + a.w || b.x + b.w < a.x || b.y > a.y + a.h || b.y + b.h < a.y);

// ---- quadtree node ----
class QuadNode {
  boundary: Rect;
  capacity: number;
  depth: number;
  points: Pt[] = [];
  divided = false;
  children: QuadNode[] = [];

  constructor(boundary: Rect, capacity: number, depth = 0) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.depth = depth;
  }

  subdivide() {
    const { x, y, w, h } = this.boundary;
    const hw = w / 2;
    const hh = h / 2;
    const d = this.depth + 1;
    this.children = [
      new QuadNode({ x, y, w: hw, h: hh }, this.capacity, d),
      new QuadNode({ x: x + hw, y, w: hw, h: hh }, this.capacity, d),
      new QuadNode({ x, y: y + hh, w: hw, h: hh }, this.capacity, d),
      new QuadNode({ x: x + hw, y: y + hh, w: hw, h: hh }, this.capacity, d),
    ];
    this.divided = true;
  }

  insertChild(p: Pt): boolean {
    for (const c of this.children) if (c.insert(p)) return true;
    return false;
  }

  insert(p: Pt): boolean {
    if (!contains(this.boundary, p)) return false;
    if (this.divided) return this.insertChild(p);
    if (this.points.length < this.capacity || this.depth >= MAX_DEPTH) {
      this.points.push(p);
      return true;
    }
    // over capacity: split and push existing points down into the new cells
    this.subdivide();
    const moved = this.points;
    this.points = [];
    for (const q of moved) this.insertChild(q);
    return this.insertChild(p);
  }
}

function buildTree(points: Pt[], capacity: number): QuadNode {
  const root = new QuadNode({ x: 0, y: 0, w: 1, h: 1 }, capacity);
  for (const p of points) root.insert(p);
  return root;
}

type Counter = { nodes: number; points: number };

function query(node: QuadNode, range: Rect, found: Pt[], c: Counter) {
  c.nodes++;
  if (!intersects(node.boundary, range)) return; // prune this whole subtree
  for (const p of node.points) {
    c.points++;
    if (contains(range, p)) found.push(p);
  }
  if (node.divided) for (const ch of node.children) query(ch, range, found, c);
}

// normalize a possibly-inverted drag rect
const normRect = (r: Rect): Rect => ({
  x: Math.min(r.x, r.x + r.w),
  y: Math.min(r.y, r.y + r.h),
  w: Math.abs(r.w),
  h: Math.abs(r.h),
});

function randomPoints(n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: 0.08 + Math.random() * 0.84, y: 0.08 + Math.random() * 0.84 });
  }
  return pts;
}

export default function QuadtreeExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Pt[]>(() => randomPoints(14));
  const [capacity, setCapacity] = useState(2);
  const [mode, setMode] = useState<'edit' | 'query'>('query');
  const [queryRect, setQueryRect] = useState<Rect>({ x: 0.3, y: 0.3, w: 0.4, h: 0.4 });
  const sizeRef = useRef({ w: 480, h: 480 });
  const dragRef = useRef<null | { kind: 'point'; idx: number } | { kind: 'query'; ox: number; oy: number }>(null);

  // ---- coordinate helpers (normalized <-> pixels) ----
  const toPx = (p: Pt) => ({ x: p.x * sizeRef.current.w, y: p.y * sizeRef.current.h });
  const toNorm = (px: number, py: number): Pt => ({
    x: Math.min(1, Math.max(0, px / sizeRef.current.w)),
    y: Math.min(1, Math.max(0, py / sizeRef.current.h)),
  });

  // ---- live stats (independent of pixels) ----
  const stats = useMemo(() => {
    const tree = buildTree(points, capacity);
    const range = normRect(queryRect);
    const found: Pt[] = [];
    const counter: Counter = { nodes: 0, points: 0 };
    query(tree, range, found, counter);
    const foundSet = new Set(found);
    return {
      found: foundSet,
      hits: found.length,
      checked: counter.points,
      nodes: counter.nodes,
      brute: points.length,
    };
  }, [points, capacity, queryRect]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const tree = buildTree(points, capacity);
    const range = normRect(queryRect);

    // 1) cell boundaries (and faint highlight for cells the query touches)
    const drawNode = (node: QuadNode) => {
      const b = node.boundary;
      const x = b.x * w;
      const y = b.y * h;
      const bw = b.w * w;
      const bh = b.h * h;
      if (intersects(b, range)) {
        ctx.fillStyle = COLORS.cellHot;
        ctx.fillRect(x, y, bw, bh);
      }
      ctx.strokeStyle = COLORS.cell;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, bw, bh);
      if (node.divided) node.children.forEach(drawNode);
    };
    drawNode(tree);

    // 2) query rectangle
    ctx.strokeStyle = COLORS.query;
    ctx.fillStyle = 'rgba(14,165,233,0.10)';
    ctx.lineWidth = 2;
    const qx = range.x * w;
    const qy = range.y * h;
    const qw = range.w * w;
    const qh = range.h * h;
    ctx.fillRect(qx, qy, qw, qh);
    ctx.strokeRect(qx, qy, qw, qh);

    // 3) objects (emerald if returned by the query, indigo otherwise)
    for (const p of points) {
      const px = toPx(p);
      const hit = stats.found.has(p);
      ctx.beginPath();
      ctx.arc(px.x, px.y, hit ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = hit ? COLORS.hit : COLORS.obj;
      ctx.fill();
      if (hit) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = w; // square playfield
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
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [points, capacity, mode, queryRect, stats]);

  // ---- pointer interaction ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();

    if (mode === 'edit') {
      // grab the nearest object within ~14px, else create a new one
      let best = -1;
      let bestD = 14;
      points.forEach((p, i) => {
        const q = toPx(p);
        const d = Math.hypot(q.x - px, q.y - py);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        dragRef.current = { kind: 'point', idx: best };
      } else {
        const np = toNorm(px, py);
        setPoints((ps) => {
          dragRef.current = { kind: 'point', idx: ps.length };
          return [...ps, np];
        });
      }
    } else {
      // start a fresh query rectangle from this corner
      const n = toNorm(px, py);
      dragRef.current = { kind: 'query', ox: n.x, oy: n.y };
      setQueryRect({ x: n.x, y: n.y, w: 0, h: 0 });
    }
  };

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { px, py } = pointer(e);
    const n = toNorm(px, py);
    if (d.kind === 'point') {
      setPoints((ps) => ps.map((p, i) => (i === d.idx ? n : p)));
    } else {
      setQueryRect({ x: d.ox, y: d.oy, w: n.x - d.ox, h: n.y - d.oy });
    }
  };

  const onUp = () => {
    dragRef.current = null;
  };

  const speedup = stats.checked > 0 ? stats.brute / stats.checked : 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['query', 'edit'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'query' ? 'Drag a query' : 'Add / move objects'}
          </button>
        ))}
        <button
          onClick={() => setPoints(randomPoints(14))}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Scatter
        </button>
        <button
          onClick={() => setPoints([])}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Clear
        </button>
      </div>

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
          <p class="text-muted">
            {mode === 'query'
              ? 'Drag on the canvas to sweep out a query box. Emerald objects are what the quadtree returns.'
              : 'Click empty space to drop an object, or drag a dot to move it. Watch cells split as they fill up.'}
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">cell capacity = {capacity}</span>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={capacity}
              onInput={(e) => setCapacity(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="objects" value={String(stats.brute)} />
            <Readout label="returned" value={String(stats.hits)} color={COLORS.hit} />
            <Readout label="quadtree checks" value={String(stats.checked)} color={COLORS.query} />
            <Readout label="brute-force checks" value={String(stats.brute)} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">point tests saved</span>
              <strong>{Math.max(0, stats.brute - stats.checked)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              The quadtree tested <strong>{stats.checked}</strong> of <strong>{stats.brute}</strong>{' '}
              objects ({stats.nodes} cells visited) — about{' '}
              <strong>{speedup.toFixed(1)}×</strong> fewer point tests than scanning everything.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
