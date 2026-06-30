import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated tree explorer for "Tree Fundamentals".
   - The learner types a level-order array (use x or - for a missing
     child), and the demo builds the binary tree, then walks it level
     by level (BFS). Each step highlights one node, reports its DEPTH,
     and grows a visit list while live stats (nodes / leaves / height)
     tick up.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   - Canvas: devicePixelRatio scaling, redraw on state, resize-aware,
     raf autoplay cancelled on unmount/pause. Helpers live inside.
   ------------------------------------------------------------------ */

const COLORS = { active: '#0ea5e9', done: '#10b981', root: '#4f46e5' };

type TNode = { id: number; value: number; left: TNode | null; right: TNode | null };
type Placed = { id: number; value: number; x: number; y: number; depth: number; leaf: boolean };
type Frame = { id: number; depth: number; leaf: boolean; value: number };

function buildTree(tokens: string[]): TNode | null {
  let nid = 0;
  const vals = tokens.map((t) => (t === 'x' || t === '-' || t === '' ? null : parseInt(t, 10)));
  if (vals.length === 0 || vals[0] === null || !Number.isFinite(vals[0] as number)) return null;
  const root: TNode = { id: nid++, value: vals[0] as number, left: null, right: null };
  const queue: TNode[] = [root];
  let i = 1;
  while (queue.length && i < vals.length) {
    const node = queue.shift()!;
    if (i < vals.length && vals[i] !== null && Number.isFinite(vals[i] as number)) {
      node.left = { id: nid++, value: vals[i] as number, left: null, right: null };
      queue.push(node.left);
    }
    i++;
    if (i < vals.length && vals[i] !== null && Number.isFinite(vals[i] as number)) {
      node.right = { id: nid++, value: vals[i] as number, left: null, right: null };
      queue.push(node.right);
    }
    i++;
  }
  return root;
}

// Assign x by in-order index, y by depth -> no overlaps.
function layout(root: TNode | null): { nodes: Placed[]; edges: [number, number][]; cols: number; rows: number } {
  const nodes: Placed[] = [];
  const edges: [number, number][] = [];
  const pos = new Map<number, { x: number; y: number }>();
  let counter = 0;
  let maxDepth = 0;
  const walk = (n: TNode | null, depth: number) => {
    if (!n) return;
    walk(n.left, depth + 1);
    const x = counter++;
    pos.set(n.id, { x, y: depth });
    maxDepth = Math.max(maxDepth, depth);
    const leaf = !n.left && !n.right;
    nodes.push({ id: n.id, value: n.value, x, y: depth, depth, leaf });
    if (n.left) edges.push([n.id, n.left.id]);
    if (n.right) edges.push([n.id, n.right.id]);
    walk(n.right, depth + 1);
  };
  walk(root, 0);
  return { nodes, edges, cols: Math.max(1, counter), rows: maxDepth + 1 };
}

function bfsFrames(root: TNode | null): Frame[] {
  const out: Frame[] = [];
  if (!root) return out;
  const queue: { n: TNode; d: number }[] = [{ n: root, d: 0 }];
  while (queue.length) {
    const { n, d } = queue.shift()!;
    out.push({ id: n.id, depth: d, leaf: !n.left && !n.right, value: n.value });
    if (n.left) queue.push({ n: n.left, d: d + 1 });
    if (n.right) queue.push({ n: n.right, d: d + 1 });
  }
  return out;
}

export default function TreeBasicsExplorer() {
  const [text, setText] = useState('1, 2, 3, 4, 5, x, 6');
  const [root, setRoot] = useState<TNode | null>(() => buildTree('1,2,3,4,5,x,6'.split(',').map((s) => s.trim())));
  const [idx, setIdx] = useState(0); // 0..frames.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { nodes, edges, cols, rows } = layout(root);
  const frames = bfsFrames(root);
  const visited = frames.slice(0, idx); // frames already processed
  const activeId = idx > 0 && idx <= frames.length ? frames[idx - 1].id : -1;
  const visitedIds = new Set(visited.map((f) => f.id));

  const nodeCount = visited.length;
  const leafCount = visited.filter((f) => f.leaf).length;
  const seenDepth = visited.length ? Math.max(...visited.map((f) => f.depth)) : -1;
  const done = idx >= frames.length && frames.length > 0;

  const commit = () => {
    const r = buildTree(text.split(',').map((s) => s.trim()));
    if (r) { setRoot(r); setIdx(0); setPlaying(false); }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padX = 28, padTop = 26, padBot = 18;
    const colW = cols > 1 ? (w - 2 * padX) / (cols - 1) : 0;
    const rowH = rows > 1 ? (h - padTop - padBot) / (rows - 1) : 0;
    const px = (x: number) => (cols > 1 ? padX + x * colW : w / 2);
    const py = (y: number) => (rows > 1 ? padTop + y * rowH : padTop + 20);
    const R = Math.max(13, Math.min(22, colW ? colW * 0.32 : 20));
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // edges
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.5;
    for (const [a, b] of edges) {
      const na = byId.get(a)!, nb = byId.get(b)!;
      ctx.beginPath();
      ctx.moveTo(px(na.x), py(na.y));
      ctx.lineTo(px(nb.x), py(nb.y));
      ctx.stroke();
    }
    // nodes
    for (const n of nodes) {
      const cx = px(n.x), cy = py(n.y);
      const isActive = n.id === activeId;
      const isDone = visitedIds.has(n.id) && !isActive;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? COLORS.active : isDone ? COLORS.done : (n.depth === 0 ? 'rgba(79,70,229,0.12)' : 'rgba(128,128,128,0.10)');
      ctx.fill();
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.strokeStyle = isActive ? '#fff' : isDone ? COLORS.done : n.depth === 0 ? COLORS.root : 'rgba(128,128,128,0.55)';
      ctx.stroke();
      ctx.fillStyle = isActive || isDone ? '#fff' : 'currentColor';
      ctx.font = `${Math.round(R * 0.95)}px ui-sans-serif, system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive || isDone ? '#ffffff' : '#9aa3b2';
      ctx.fillText(String(n.value), cx, cy + 1);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.max(220, Math.min(360, 90 + rows * 70));
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
  }, [rows, cols]);

  useEffect(draw, [idx, root, nodes, edges]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length + 1) { setIdx(frames.length); setPlaying(false); return; }
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

  const caption = idx === 0
    ? 'Press Play to walk the tree level by level (breadth-first). The root sits at depth 0.'
    : `Visiting ${frames[idx - 1].value} at depth ${frames[idx - 1].depth}` +
      (frames[idx - 1].leaf ? ' — a leaf (no children).' : ' — an internal node.');

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="level-order, use x for a gap" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
      </div>

      <canvas ref={canvasRef} class="touch-none mx-auto block rounded-xl bg-surface-2 text-muted" />

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label="nodes seen" value={`${nodeCount}`} />
        <Stat label="leaves seen" value={`${leafCount}`} />
        <Stat label="depth reached" value={seenDepth < 0 ? '—' : `${seenDepth}`} />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          BFS order: {frames.map((f) => f.value).join(' → ')}. Height = {seenDepth} (longest root-to-leaf path in edges).
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: write the tree in level order. <code>1,2,3,4,5,x,6</code> means node 1 has children 2 and 3; the 6 hangs under 3 on the right.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-xs text-muted">{label}</span>
      <div class="font-mono font-semibold text-text">{value}</div>
    </div>
  );
}
