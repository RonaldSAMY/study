import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Binary Search Tree for "Binary Search Trees".
   - INSERT mode: the learner types values; the demo inserts them one by
     one, walking DOWN from the root and comparing (go left if smaller,
     right if larger) until it finds the empty spot.
   - SEARCH mode: type a target and watch the same left/right walk hunt
     for it — O(log n) on a balanced tree.
   - The active node is highlighted, the floating target rides alongside,
     and a live caption narrates every comparison.
   - Transport: Play / Pause / Step / Step-back / Reset + speed. Canvas
     uses dpr scaling, resize handling, raf cancelled on unmount.
   ------------------------------------------------------------------ */

const COLORS = { active: '#0ea5e9', placed: '#10b981', root: '#4f46e5' };
type Mode = 'insert' | 'search';

type BNode = { value: number; left: BNode | null; right: BNode | null };
type Placed = { value: number; x: number; y: number; depth: number };
type Frame = { target: number; at: number | null; dir: 'left' | 'right' | null; present: Set<number>; note: string };

function parseList(s: string): number[] {
  return s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
}
function insert(root: BNode | null, v: number): BNode {
  if (!root) return { value: v, left: null, right: null };
  if (v < root.value) root.left = insert(root.left, v);
  else if (v > root.value) root.right = insert(root.right, v);
  return root;
}
function buildBST(vals: number[]): BNode | null {
  let root: BNode | null = null;
  for (const v of vals) root = insert(root, v);
  return root;
}
function layout(root: BNode | null): { nodes: Placed[]; edges: [number, number][]; cols: number; rows: number } {
  const nodes: Placed[] = [];
  const edges: [number, number][] = [];
  let counter = 0, maxDepth = 0;
  const walk = (n: BNode | null, depth: number) => {
    if (!n) return;
    walk(n.left, depth + 1);
    nodes.push({ value: n.value, x: counter++, y: depth, depth });
    maxDepth = Math.max(maxDepth, depth);
    if (n.left) edges.push([n.value, n.left.value]);
    if (n.right) edges.push([n.value, n.right.value]);
    walk(n.right, depth + 1);
  };
  walk(root, 0);
  return { nodes, edges, cols: Math.max(1, counter), rows: maxDepth + 1 };
}

function insertFrames(vals: number[]): Frame[] {
  const frames: Frame[] = [];
  const present = new Set<number>();
  let root: BNode | null = null;
  for (const v of vals) {
    if (present.has(v)) continue;
    if (!root) { root = { value: v, left: null, right: null }; present.add(v); frames.push({ target: v, at: v, dir: null, present: new Set(present), note: `${v} becomes the root` }); continue; }
    let cur: BNode = root;
    while (true) {
      if (v < cur.value) {
        frames.push({ target: v, at: cur.value, dir: 'left', present: new Set(present), note: `${v} < ${cur.value} → go left` });
        if (cur.left) { cur = cur.left; continue; }
        cur.left = { value: v, left: null, right: null }; present.add(v);
        frames.push({ target: v, at: v, dir: null, present: new Set(present), note: `empty left spot → place ${v}` });
        break;
      } else if (v > cur.value) {
        frames.push({ target: v, at: cur.value, dir: 'right', present: new Set(present), note: `${v} > ${cur.value} → go right` });
        if (cur.right) { cur = cur.right; continue; }
        cur.right = { value: v, left: null, right: null }; present.add(v);
        frames.push({ target: v, at: v, dir: null, present: new Set(present), note: `empty right spot → place ${v}` });
        break;
      } else { break; }
    }
  }
  return frames;
}

function searchFrames(root: BNode | null, target: number, all: Set<number>): Frame[] {
  const frames: Frame[] = [];
  let cur = root;
  while (cur) {
    if (target === cur.value) { frames.push({ target, at: cur.value, dir: null, present: all, note: `${target} === ${cur.value} → found it!` }); return frames; }
    if (target < cur.value) { frames.push({ target, at: cur.value, dir: 'left', present: all, note: `${target} < ${cur.value} → go left` }); cur = cur.left; }
    else { frames.push({ target, at: cur.value, dir: 'right', present: all, note: `${target} > ${cur.value} → go right` }); cur = cur.right; }
  }
  frames.push({ target, at: null, dir: null, present: all, note: `ran off the tree → ${target} is not present` });
  return frames;
}

export default function TreeBstOperations() {
  const [text, setText] = useState('8, 3, 10, 1, 6, 14, 4, 7, 13');
  const [vals, setVals] = useState<number[]>(() => parseList('8, 3, 10, 1, 6, 14, 4, 7, 13'));
  const [mode, setMode] = useState<Mode>('insert');
  const [target, setTarget] = useState('7');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const finalRoot = buildBST(vals);
  const allValues = new Set(vals);
  const { nodes, edges, cols, rows } = layout(finalRoot);
  const frames = mode === 'insert'
    ? insertFrames(vals)
    : searchFrames(finalRoot, parseInt(target, 10), allValues);

  const cur = idx > 0 && idx <= frames.length ? frames[idx - 1] : null;
  const present = cur ? cur.present : (mode === 'insert' ? new Set<number>() : allValues);
  const activeValue = cur ? cur.at : null;
  const done = idx >= frames.length && frames.length > 0;
  const found = done && mode === 'search' && cur && cur.at !== null;

  const commit = () => { const p = parseList(text); if (p.length) { setVals(p); setIdx(0); setPlaying(false); } };
  const pickMode = (m: Mode) => { setMode(m); setIdx(0); setPlaying(false); };

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
    const byVal = new Map(nodes.map((n) => [n.value, n]));
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.5;
    for (const [a, b] of edges) {
      if (mode === 'insert' && (!present.has(a) || !present.has(b))) continue;
      const na = byVal.get(a)!, nb = byVal.get(b)!;
      ctx.beginPath(); ctx.moveTo(px(na.x), py(na.y)); ctx.lineTo(px(nb.x), py(nb.y)); ctx.stroke();
    }
    for (const n of nodes) {
      if (mode === 'insert' && !present.has(n.value)) continue;
      const cx = px(n.x), cy = py(n.y);
      const isActive = n.value === activeValue;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? (done && mode === 'insert' ? COLORS.placed : COLORS.active) : (n.depth === 0 ? 'rgba(79,70,229,0.12)' : 'rgba(128,128,128,0.10)');
      ctx.fill();
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.strokeStyle = isActive ? '#fff' : n.depth === 0 ? COLORS.root : 'rgba(128,128,128,0.55)';
      ctx.stroke();
      ctx.font = `${Math.round(R * 0.95)}px ui-sans-serif, system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive ? '#ffffff' : '#9aa3b2';
      ctx.fillText(String(n.value), cx, cy + 1);
    }
    // floating target badge near active node
    if (cur && cur.dir) {
      const an = byVal.get(activeValue!);
      if (an) {
        const cx = px(an.x) + R + 14, cy = py(an.y) - R - 6;
        ctx.fillStyle = COLORS.active;
        ctx.beginPath();
        const tw = 34;
        (ctx as any).roundRect ? (ctx.beginPath(), (ctx as any).roundRect(cx - tw / 2, cy - 12, tw, 24, 6)) : ctx.rect(cx - tw / 2, cy - 12, tw, 24);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(R * 0.8)}px ui-sans-serif, system-ui`;
        ctx.fillText(String(cur.target), cx, cy + 1);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.max(220, Math.min(380, 90 + rows * 66));
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
  }, [rows, cols]);

  useEffect(draw, [idx, mode, vals, target, nodes, edges]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 880 / speed;
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
    ? (mode === 'insert' ? 'Press Play to insert each value, walking down from the root comparing left vs right.' : `Press Play to search for ${target}. The walk turns left when the target is smaller, right when larger.`)
    : cur!.note + '.';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="values to insert" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['insert', 'search'] as Mode[]).map((m) => (
          <button key={m} onClick={() => pickMode(m)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m}</button>
        ))}
        {mode === 'search' && (
          <label class="flex items-center gap-2 text-sm text-muted">target
            <input value={target} onInput={(e) => { setTarget((e.target as HTMLInputElement).value); setIdx(0); setPlaying(false); }} class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
          </label>
        )}
      </div>

      <canvas ref={canvasRef} class="touch-none mx-auto block rounded-xl bg-surface-2 text-muted" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && mode === 'insert' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Tree built. An inorder walk now reads out the values in sorted order.</p>}
      {found && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Found {target}. Each comparison threw away half of what was left — that is the O(log n) win.</p>}
      {done && mode === 'search' && !found && <p class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-text">{target} is not in the tree — the walk fell off a null branch.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try inserting <code>1,2,3,4,5</code> in order to see the tree go lopsided — that is the worst case the next lesson fixes.</p>
    </div>
  );
}
