import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated B-tree insertion (order m -> at most m-1 keys per node).
   - Edit the list of numbers; we insert them one by one and record a
     frame each time we descend, split a full node, or push a median up.
   - Nodes are drawn as multi-key boxes; the active node is highlighted
     and a caption narrates each split propagating toward the root.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const COL = { box: '#4f46e5', hl: '#0ea5e9', edge: 'rgba(128,128,128,0.55)', boxFill: 'rgba(79,70,229,0.12)' };

type BN = { keys: number[]; children: BN[]; leaf: boolean };
type FNode = { keys: number[]; x: number; depth: number; hl: boolean };
type Frame = { nodes: FNode[]; edges: [number, number][]; caption: string; maxX: number; maxDepth: number };

function parseList(s: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of s.split(',')) {
    const v = parseInt(t.trim(), 10);
    if (Number.isFinite(v) && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

function buildFrames(values: number[], order: number): { frames: Frame[] } {
  const maxKeys = order - 1;
  const frames: Frame[] = [];
  let root: BN = { keys: [], children: [], leaf: true };

  const record = (hl: BN | null, caption: string) => {
    const nodes: FNode[] = [];
    const edges: [number, number][] = [];
    let leafX = 0;
    const place = (n: BN, depth: number): { idx: number; x: number } => {
      if (n.leaf || n.children.length === 0) {
        const x = leafX++;
        const idx = nodes.length;
        nodes.push({ keys: [...n.keys], x, depth, hl: n === hl });
        return { idx, x };
      }
      const childRes = n.children.map((c) => place(c, depth + 1));
      const x = childRes.reduce((s, c) => s + c.x, 0) / childRes.length;
      const idx = nodes.length;
      nodes.push({ keys: [...n.keys], x, depth, hl: n === hl });
      for (const cr of childRes) edges.push([idx, cr.idx]);
      return { idx, x };
    };
    place(root, 0);
    const maxX = Math.max(1, ...nodes.map((n) => n.x));
    const maxDepth = Math.max(1, ...nodes.map((n) => n.depth));
    frames.push({ nodes, edges, caption, maxX, maxDepth });
  };

  const splitChild = (parent: BN, i: number) => {
    const child = parent.children[i];
    const mid = Math.floor(maxKeys / 2);
    const sibling: BN = { keys: child.keys.splice(mid + 1), children: [], leaf: child.leaf };
    if (!child.leaf) sibling.children = child.children.splice(mid + 1);
    const midKey = child.keys.pop()!;
    parent.keys.splice(i, 0, midKey);
    parent.children.splice(i + 1, 0, sibling);
    record(parent, `Node is full — split it and push the median ${midKey} up into the parent.`);
  };

  const insertNonFull = (node: BN, key: number) => {
    let i = node.keys.length - 1;
    if (node.leaf) {
      while (i >= 0 && key < node.keys[i]) i--;
      if (i >= 0 && key === node.keys[i]) return;
      node.keys.splice(i + 1, 0, key);
      record(node, `Place ${key} into this leaf in sorted order.`);
    } else {
      while (i >= 0 && key < node.keys[i]) i--;
      i++;
      if (node.children[i].keys.length === maxKeys) {
        splitChild(node, i);
        if (key > node.keys[i]) i++;
      }
      insertNonFull(node.children[i], key);
    }
  };

  for (const key of values) {
    record(root, `Inserting ${key}...`);
    if (root.keys.length === maxKeys) {
      const newRoot: BN = { keys: [], children: [root], leaf: false };
      root = newRoot;
      splitChild(newRoot, 0);
    }
    insertNonFull(root, key);
  }
  if (!frames.length) record(root, 'Empty tree — add some numbers.');
  return { frames };
}

export default function AdvTreeBTreeInsert() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('10, 20, 5, 6, 12, 30, 7, 17');
  const [order, setOrder] = useState(3);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(parseList('10, 20, 5, 6, 12, 30, 7, 17'), 3).frames);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frame = frames[Math.min(idx, frames.length - 1)];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    if (!f) return;
    const padX = 44, padY = 26;
    const X = (x: number) => f.maxX === 0 ? w / 2 : padX + (x / f.maxX) * (w - 2 * padX);
    const Y = (d: number) => padY + (d / Math.max(1, f.maxDepth)) * (h - 2 * padY);
    const cellW = 24, cellH = 26;
    const boxW = (n: FNode) => Math.max(1, n.keys.length) * cellW;
    ctx.lineWidth = 2; ctx.strokeStyle = COL.edge;
    for (const [p, c] of f.edges) {
      const a = f.nodes[p], b = f.nodes[c];
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.depth) + cellH / 2); ctx.lineTo(X(b.x), Y(b.depth) - cellH / 2); ctx.stroke();
    }
    for (const n of f.nodes) {
      const cx = X(n.x), cy = Y(n.depth);
      const bw = boxW(n);
      const left = cx - bw / 2;
      ctx.fillStyle = COL.boxFill;
      ctx.fillRect(left, cy - cellH / 2, bw, cellH);
      ctx.lineWidth = n.hl ? 3 : 1.8;
      ctx.strokeStyle = n.hl ? COL.hl : COL.box;
      ctx.strokeRect(left, cy - cellH / 2, bw, cellH);
      ctx.font = '600 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e2e8f0';
      const keys = n.keys.length ? n.keys : [''];
      keys.forEach((k, i) => {
        const kx = left + (i + 0.5) * cellW;
        if (i > 0) { ctx.strokeStyle = COL.box; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left + i * cellW, cy - cellH / 2); ctx.lineTo(left + i * cellW, cy + cellH / 2); ctx.stroke(); }
        ctx.fillStyle = n.hl ? COL.hl : '#cbd5e1';
        ctx.fillText(String(k), kx, cy + 0.5);
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 640);
      const h = Math.max(220, Math.min(340, w * 0.52));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, frames]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const commit = (ord = order) => { const f = buildFrames(parseList(text), ord).frames; setFrames(f); setIdx(0); setPlaying(false); lastRef.current = 0; };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated keys" />
        <label class="flex items-center gap-1 text-xs text-muted">order
          <select value={order} onChange={(e) => { const o = parseInt((e.target as HTMLSelectElement).value, 10); setOrder(o); commit(o); }} class="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm">
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </label>
        <button onClick={() => commit()} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame?.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">frame {Math.min(idx + 1, frames.length)} / {frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Order {order}: each node holds at most {order - 1} keys. A full node splits and shoves its median into the parent — that is how B-trees grow upward.</p>
    </div>
  );
}
