import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated AVL tree for "AVL Trees".
   - The learner types values; the demo inserts them one at a time.
     For each insert it shows TWO things: first the value dropped in as a
     plain BST leaf (which may break the balance), then — if a node's
     balance factor hits ±2 — the tree after the rotation that fixes it.
   - Every node is labelled with its balance factor; an out-of-range
     factor flashes red so the learner sees exactly where the rotation
     fires (LL / RR / LR / RL).
   - Transport: Play / Pause / Step / Step-back / Reset + speed. Canvas
     uses dpr scaling, resize handling, raf cancelled on unmount; all
     helpers live inside the island.
   ------------------------------------------------------------------ */

const COLORS = { active: '#0ea5e9', ok: '#10b981', root: '#4f46e5', bad: '#ef4444' };

type ANode = { value: number; left: ANode | null; right: ANode | null; height: number };
type PNode = { value: number; x: number; y: number; depth: number; bf: number; h: number };
type Frame = { nodes: PNode[]; edges: [number, number][]; cols: number; rows: number; highlight: number; caption: string; bad: boolean };

function parseList(s: string): number[] { return s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)); }
function h(n: ANode | null): number { return n ? n.height : 0; }
function upd(n: ANode): void { n.height = 1 + Math.max(h(n.left), h(n.right)); }
function bf(n: ANode | null): number { return n ? h(n.left) - h(n.right) : 0; }
function clone(n: ANode | null): ANode | null { return n ? { value: n.value, height: n.height, left: clone(n.left), right: clone(n.right) } : null; }
function recompute(n: ANode | null): void { if (!n) return; recompute(n.left); recompute(n.right); upd(n); }

function rotateRight(y: ANode): ANode { const x = y.left!; y.left = x.right; x.right = y; upd(y); upd(x); return x; }
function rotateLeft(x: ANode): ANode { const y = x.right!; x.right = y.left; y.left = x; upd(x); upd(y); return y; }

function insertAVL(node: ANode | null, v: number): ANode {
  if (!node) return { value: v, left: null, right: null, height: 1 };
  if (v < node.value) node.left = insertAVL(node.left, v);
  else if (v > node.value) node.right = insertAVL(node.right, v);
  else return node;
  upd(node);
  const b = bf(node);
  if (b > 1 && v < node.left!.value) return rotateRight(node);
  if (b > 1 && v > node.left!.value) { node.left = rotateLeft(node.left!); return rotateRight(node); }
  if (b < -1 && v > node.right!.value) return rotateLeft(node);
  if (b < -1 && v < node.right!.value) { node.right = rotateRight(node.right!); return rotateLeft(node); }
  return node;
}

// Plain BST insert (no rebalance); records the root-to-leaf path.
function plainInsert(root: ANode | null, v: number, path: ANode[]): ANode {
  if (!root) return { value: v, left: null, right: null, height: 1 };
  let cur = root;
  while (true) {
    path.push(cur);
    if (v < cur.value) { if (cur.left) { cur = cur.left; continue; } cur.left = { value: v, left: null, right: null, height: 1 }; break; }
    else if (v > cur.value) { if (cur.right) { cur = cur.right; continue; } cur.right = { value: v, left: null, right: null, height: 1 }; break; }
    else break;
  }
  return root;
}

function layout(root: ANode | null): { nodes: PNode[]; edges: [number, number][]; cols: number; rows: number } {
  const nodes: PNode[] = [];
  const edges: [number, number][] = [];
  let counter = 0, maxDepth = 0;
  const walk = (n: ANode | null, depth: number) => {
    if (!n) return;
    walk(n.left, depth + 1);
    nodes.push({ value: n.value, x: counter++, y: depth, depth, bf: bf(n), h: n.height });
    maxDepth = Math.max(maxDepth, depth);
    if (n.left) edges.push([n.value, n.left.value]);
    if (n.right) edges.push([n.value, n.right.value]);
    walk(n.right, depth + 1);
  };
  walk(root, 0);
  return { nodes, edges, cols: Math.max(1, counter), rows: maxDepth + 1 };
}

function snapshot(root: ANode | null, highlight: number, caption: string, bad: boolean): Frame {
  const { nodes, edges, cols, rows } = layout(root);
  return { nodes, edges, cols, rows, highlight, caption, bad };
}

function buildFrames(vals: number[]): Frame[] {
  const frames: Frame[] = [];
  let balanced: ANode | null = null;
  const seen = new Set<number>();
  for (const v of vals) {
    if (seen.has(v)) continue;
    seen.add(v);
    if (!balanced) {
      balanced = insertAVL(null, v);
      frames.push(snapshot(balanced, v, `Insert ${v}: it becomes the root.`, false));
      continue;
    }
    // 1) BST-style drop (no rebalance) on a clone, to expose any imbalance
    const before = clone(balanced)!;
    const path: ANode[] = [];
    plainInsert(before, v, path);
    recompute(before);
    let z: ANode | null = null;
    for (let i = path.length - 1; i >= 0; i--) { if (Math.abs(bf(path[i])) > 1) { z = path[i]; break; } }
    let kase = '';
    if (z) {
      const b = bf(z);
      if (b > 1) kase = v < z.left!.value ? 'Left-Left' : 'Left-Right';
      else kase = v > z.right!.value ? 'Right-Right' : 'Right-Left';
      frames.push(snapshot(before, v, `Insert ${v} as a leaf — now node ${z.value} has balance factor ${bf(z)} (out of range). ${kase} case.`, true));
    } else {
      frames.push(snapshot(before, v, `Insert ${v} as a leaf — every balance factor still within ±1, no rotation needed.`, false));
    }
    // 2) real AVL insert
    balanced = insertAVL(balanced, v);
    recompute(balanced);
    if (z) frames.push(snapshot(balanced, v, `${kase} → rotate around ${z.value}. The subtree is rebalanced and heights shrink.`, false));
  }
  return frames;
}

export default function TreeAvlRotations() {
  const [text, setText] = useState('1, 2, 3, 4, 5, 6, 7');
  const [vals, setVals] = useState<number[]>(() => parseList('1, 2, 3, 4, 5, 6, 7'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = buildFrames(vals);
  const frame = idx > 0 && idx <= frames.length ? frames[idx - 1] : null;
  const rows = frame ? frame.rows : 1;
  const cols = frame ? frame.cols : 1;
  const done = idx >= frames.length && frames.length > 0;

  const commit = () => { const p = parseList(text); if (p.length) { setVals(p); setIdx(0); setPlaying(false); } };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h: H } = sizeRef.current;
    ctx.clearRect(0, 0, w, H);
    if (!frame) return;
    const padX = 30, padTop = 26, padBot = 34;
    const colW = cols > 1 ? (w - 2 * padX) / (cols - 1) : 0;
    const rowH = rows > 1 ? (H - padTop - padBot) / (rows - 1) : 0;
    const px = (x: number) => (cols > 1 ? padX + x * colW : w / 2);
    const py = (y: number) => (rows > 1 ? padTop + y * rowH : padTop + 20);
    const R = Math.max(13, Math.min(21, colW ? colW * 0.30 : 19));
    const byVal = new Map(frame.nodes.map((n) => [n.value, n]));
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.5;
    for (const [a, b] of frame.edges) { const na = byVal.get(a)!, nb = byVal.get(b)!; ctx.beginPath(); ctx.moveTo(px(na.x), py(na.y)); ctx.lineTo(px(nb.x), py(nb.y)); ctx.stroke(); }
    for (const n of frame.nodes) {
      const cx = px(n.x), cy = py(n.y);
      const isActive = n.value === frame.highlight;
      const unbalanced = Math.abs(n.bf) > 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = unbalanced ? COLORS.bad : isActive ? COLORS.active : (n.depth === 0 ? 'rgba(79,70,229,0.12)' : 'rgba(128,128,128,0.10)');
      ctx.fill();
      ctx.lineWidth = isActive || unbalanced ? 3 : 2;
      ctx.strokeStyle = unbalanced ? '#fff' : isActive ? '#fff' : n.depth === 0 ? COLORS.root : 'rgba(128,128,128,0.55)';
      ctx.stroke();
      ctx.font = `${Math.round(R * 0.9)}px ui-sans-serif, system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = unbalanced || isActive ? '#ffffff' : '#9aa3b2';
      ctx.fillText(String(n.value), cx, cy + 1);
      // balance-factor label below
      ctx.font = `600 ${Math.max(9, Math.round(R * 0.52))}px ui-sans-serif, system-ui`;
      ctx.fillStyle = unbalanced ? COLORS.bad : '#9aa3b2';
      ctx.fillText(`bf ${n.bf > 0 ? '+' : ''}${n.bf}`, cx, cy + R + 9);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const H = Math.max(220, Math.min(400, 100 + rows * 70));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = H * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: H };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols]);

  useEffect(draw, [idx, vals]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
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

  const caption = idx === 0 ? 'Press Play to insert each value. Red nodes are temporarily unbalanced; the next step rotates them back into shape.' : frame!.caption;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="values to insert" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
      </div>

      <canvas ref={canvasRef} class="touch-none mx-auto block rounded-xl bg-surface-2 text-muted" />

      <p class={`mt-3 min-h-[2.5rem] rounded-lg px-3 py-2 text-sm ${frame && frame.bad ? 'bg-rose-500/10 font-semibold text-text' : 'bg-surface-2 text-text'}`}>{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">All inserted. Height stays around log₂(n) — a plain BST fed 1,2,3,… would be a straight line of height n−1.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Each node shows its balance factor (bf = height of left − height of right). Try <code>3,2,1</code> (one right rotation) or <code>1,3,2</code> (a left-right double).</p>
    </div>
  );
}
