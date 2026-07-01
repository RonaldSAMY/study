import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated self-adjusting trees.
   - Splay mode: insert a list as a plain BST, then ACCESS a key and
     watch it splay to the root via zig / zig-zig / zig-zag rotations.
   - Treap mode: insert a list; each node carries a random priority and
     bubbles up by rotation until the heap-on-priority order holds.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const COL = { node: '#4f46e5', hl: '#0ea5e9', accent: '#10b981', edge: 'rgba(128,128,128,0.55)' };

type N = { key: number; prio: number; left: N | null; right: N | null; parent: N | null };
type FNode = { key: number; prio: number; ix: number; depth: number; hl: boolean };
type Frame = { nodes: FNode[]; edges: [number, number][]; caption: string; maxIx: number; maxDepth: number; showPrio: boolean };

function parseList(s: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of s.split(',')) {
    const v = parseInt(t.trim(), 10);
    if (Number.isFinite(v) && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

function makeRecorder(getRoot: () => N | null, frames: Frame[], showPrio: boolean) {
  return (hl: N | null, caption: string) => {
    const root = getRoot();
    const pos = new Map<number, FNode>();
    let i = 0;
    const inorder = (n: N | null) => {
      if (!n) return;
      inorder(n.left);
      pos.set(n.key, { key: n.key, prio: n.prio, ix: i++, depth: 0, hl: n === hl });
      inorder(n.right);
    };
    inorder(root);
    const setDepth = (n: N | null, d: number) => {
      if (!n) return;
      pos.get(n.key)!.depth = d;
      setDepth(n.left, d + 1);
      setDepth(n.right, d + 1);
    };
    setDepth(root, 0);
    const edges: [number, number][] = [];
    const walk = (n: N | null) => {
      if (!n) return;
      if (n.left) { edges.push([n.key, n.left.key]); walk(n.left); }
      if (n.right) { edges.push([n.key, n.right.key]); walk(n.right); }
    };
    walk(root);
    const nodes = Array.from(pos.values());
    frames.push({ nodes, edges, caption, maxIx: Math.max(1, ...nodes.map((n) => n.ix)), maxDepth: Math.max(1, ...nodes.map((n) => n.depth)), showPrio });
  };
}

function buildSplay(values: number[], target: number): Frame[] {
  const frames: Frame[] = [];
  let root: N | null = null;
  const rec = makeRecorder(() => root, frames, false);
  const rotateLeft = (x: N) => { const y = x.right!; x.right = y.left; if (y.left) y.left.parent = x; y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.left) x.parent.left = y; else x.parent.right = y; y.left = x; x.parent = y; };
  const rotateRight = (x: N) => { const y = x.left!; x.left = y.right; if (y.right) y.right.parent = x; y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.right) x.parent.right = y; else x.parent.left = y; y.right = x; x.parent = y; };

  for (const key of values) {
    let y: N | null = null, x = root;
    let dup = false;
    while (x) { y = x; if (key < x.key) x = x.left; else if (key > x.key) x = x.right; else { dup = true; break; } }
    if (dup) continue;
    const z: N = { key, prio: 0, left: null, right: null, parent: y };
    if (!y) root = z; else if (key < y.key) y.left = z; else y.right = z;
  }
  rec(null, `Plain BST built from the list. Now access ${target} and splay it to the root.`);

  let node: N | null = root;
  while (node && node.key !== target) node = target < node.key ? node.left : node.right;
  if (!node) { rec(null, `${target} is not in the tree — nothing to splay.`); return frames; }
  rec(node, `Found ${target}. Repeatedly rotate it upward until it becomes the root.`);

  while (node.parent) {
    const p = node.parent, g = p.parent;
    if (!g) {
      if (node === p.left) rotateRight(p); else rotateLeft(p);
      rec(node, `Zig: ${node.key}'s parent is the root, so a single rotation finishes the splay.`);
    } else if ((node === p.left) === (p === g.left)) {
      if (node === p.left) { rotateRight(g); rotateRight(p); } else { rotateLeft(g); rotateLeft(p); }
      rec(node, `Zig-zig: ${node.key} and its parent lean the same way — rotate grandparent then parent.`);
    } else {
      if (node === p.right) { rotateLeft(p); rotateRight(g); } else { rotateRight(p); rotateLeft(g); }
      rec(node, `Zig-zag: ${node.key} zig-zags — rotate parent then grandparent.`);
    }
  }
  rec(node, `${target} is now the root. Future accesses to it (and its neighbours) are cheap.`);
  return frames;
}

function buildTreap(values: number[]): Frame[] {
  const frames: Frame[] = [];
  let root: N | null = null;
  const rec = makeRecorder(() => root, frames, true);
  let seed = 9176;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 90) + 10; };
  const rotateLeft = (x: N) => { const y = x.right!; x.right = y.left; if (y.left) y.left.parent = x; y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.left) x.parent.left = y; else x.parent.right = y; y.left = x; x.parent = y; };
  const rotateRight = (x: N) => { const y = x.left!; x.left = y.right; if (y.right) y.right.parent = x; y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.right) x.parent.right = y; else x.parent.left = y; y.right = x; x.parent = y; };

  for (const key of values) {
    let y: N | null = null, x = root;
    let dup = false;
    while (x) { y = x; if (key < x.key) x = x.left; else if (key > x.key) x = x.right; else { dup = true; break; } }
    if (dup) continue;
    const z: N = { key, prio: rnd(), left: null, right: null, parent: y };
    if (!y) root = z; else if (key < y.key) y.left = z; else y.right = z;
    rec(z, `Insert key ${key} with random priority ${z.prio} as a BST leaf.`);
    while (z.parent && z.prio > z.parent.prio) {
      const p = z.parent;
      if (z === p.left) rotateRight(p); else rotateLeft(p);
      rec(z, `Priority ${z.prio} beats parent ${p.prio} — rotate ${key} up to keep the max-heap order.`);
    }
  }
  if (!frames.length) rec(null, 'Empty tree — add some numbers.');
  else rec(root, 'Done: keys form a BST left-to-right, priorities form a max-heap top-down.');
  return frames;
}

export default function AdvTreeSplayTreap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [mode, setMode] = useState<'splay' | 'treap'>('splay');
  const [text, setText] = useState('1, 2, 3, 4, 5, 6, 7');
  const [target, setTarget] = useState('1');
  const [frames, setFrames] = useState<Frame[]>(() => buildSplay(parseList('1, 2, 3, 4, 5, 6, 7'), 1));
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
    const padX = 34, padY = 32;
    const X = (ix: number) => f.maxIx === 0 ? w / 2 : padX + (ix / f.maxIx) * (w - 2 * padX);
    const Y = (d: number) => padY + (d / Math.max(1, f.maxDepth)) * (h - 2 * padY);
    const map = new Map(f.nodes.map((n) => [n.key, n]));
    ctx.lineWidth = 2; ctx.strokeStyle = COL.edge;
    for (const [p, c] of f.edges) { const a = map.get(p)!, b = map.get(c)!; ctx.beginPath(); ctx.moveTo(X(a.ix), Y(a.depth)); ctx.lineTo(X(b.ix), Y(b.depth)); ctx.stroke(); }
    const R = 16;
    for (const n of f.nodes) {
      const cx = X(n.ix), cy = Y(n.depth);
      if (n.hl) { ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2); ctx.strokeStyle = COL.hl; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = n.hl ? COL.accent : COL.node; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n.key), cx, cy + 0.5);
      if (f.showPrio) { ctx.fillStyle = '#64748b'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`p${n.prio}`, cx, cy - R - 8); }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.max(240, Math.min(360, w * 0.6));
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

  const commit = (m = mode) => {
    const vals = parseList(text);
    const f = m === 'splay' ? buildSplay(vals, parseInt(target, 10)) : buildTreap(vals);
    setFrames(f); setIdx(0); setPlaying(false); lastRef.current = 0;
  };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['splay', 'treap'] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); commit(m); }} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m === 'splay' ? 'Splay' : 'Treap'}</button>
        ))}
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="min-w-[10rem] flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated keys" />
        {mode === 'splay' && (
          <label class="flex items-center gap-1 text-xs text-muted">access
            <input value={target} onInput={(e) => setTarget((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
          </label>
        )}
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
      <p class="mt-2 text-center text-xs text-muted">Splay: insert <code>1..7</code> in order to get a worst-case chain, then access <code>1</code> to see it rocket to the root. Treap shows each node's priority <code>p</code>.</p>
    </div>
  );
}
