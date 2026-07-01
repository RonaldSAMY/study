import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Red-Black tree insertion.
   - Edit the list of numbers; we insert them one by one, recording a
     frame after every BST insert, recolor, and rotation fix-up.
   - Nodes are drawn as red/black circles; the active node gets a ring
     and a live caption explains each recolor / rotation.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const RED = 0;
const BLACK = 1;
const COL = { red: '#ef4444', black: '#1f2937', ring: '#0ea5e9', edge: 'rgba(128,128,128,0.55)' };

type N = { key: number; color: number; left: N | null; right: N | null; parent: N | null };
type FNode = { key: number; color: number; ix: number; depth: number };
type Frame = { nodes: FNode[]; edges: [number, number][]; hl: number | null; caption: string; maxIx: number; maxDepth: number };

function parseList(s: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of s.split(',')) {
    const v = parseInt(t.trim(), 10);
    if (Number.isFinite(v) && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

function buildFrames(values: number[]): Frame[] {
  const frames: Frame[] = [];
  let root: N | null = null;

  const layout = (hl: number | null, caption: string) => {
    const pos = new Map<number, FNode>();
    let i = 0;
    const inorder = (n: N | null) => {
      if (!n) return;
      inorder(n.left);
      pos.set(n.key, { key: n.key, color: n.color, ix: i++, depth: 0 });
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
    const maxIx = Math.max(1, ...nodes.map((n) => n.ix));
    const maxDepth = Math.max(1, ...nodes.map((n) => n.depth));
    frames.push({ nodes, edges, hl, caption, maxIx, maxDepth });
  };

  const rotateLeft = (x: N) => {
    const y = x.right!;
    x.right = y.left;
    if (y.left) y.left.parent = x;
    y.parent = x.parent;
    if (!x.parent) root = y;
    else if (x === x.parent.left) x.parent.left = y;
    else x.parent.right = y;
    y.left = x;
    x.parent = y;
  };
  const rotateRight = (x: N) => {
    const y = x.left!;
    x.left = y.right;
    if (y.right) y.right.parent = x;
    y.parent = x.parent;
    if (!x.parent) root = y;
    else if (x === x.parent.right) x.parent.right = y;
    else x.parent.left = y;
    y.right = x;
    x.parent = y;
  };

  for (const key of values) {
    let y: N | null = null;
    let x = root;
    let dup = false;
    while (x) { y = x; if (key < x.key) x = x.left; else if (key > x.key) x = x.right; else { dup = true; break; } }
    if (dup) continue;
    const z: N = { key, color: RED, left: null, right: null, parent: y };
    if (!y) root = z;
    else if (key < y.key) y.left = z;
    else y.right = z;
    layout(key, `Insert ${key} as a RED leaf via ordinary BST descent.`);

    let zz = z;
    while (zz.parent && zz.parent.color === RED) {
      const gp = zz.parent.parent!;
      if (zz.parent === gp.left) {
        const u = gp.right;
        if (u && u.color === RED) {
          zz.parent.color = BLACK; u.color = BLACK; gp.color = RED;
          layout(gp.key, `Uncle ${u.key} is RED — recolor parent & uncle BLACK, grandparent ${gp.key} RED, recurse up.`);
          zz = gp;
        } else {
          if (zz === zz.parent.right) { zz = zz.parent; rotateLeft(zz); layout(zz.key, `Zig-zag: left-rotate so ${zz.key} lines up under its grandparent.`); }
          zz.parent!.color = BLACK; zz.parent!.parent!.color = RED;
          rotateRight(zz.parent!.parent!);
          layout(zz.parent!.key, `Recolor and right-rotate grandparent — black-height is restored.`);
        }
      } else {
        const u = gp.left;
        if (u && u.color === RED) {
          zz.parent.color = BLACK; u.color = BLACK; gp.color = RED;
          layout(gp.key, `Uncle ${u.key} is RED — recolor parent & uncle BLACK, grandparent ${gp.key} RED, recurse up.`);
          zz = gp;
        } else {
          if (zz === zz.parent.left) { zz = zz.parent; rotateRight(zz); layout(zz.key, `Zig-zag: right-rotate so ${zz.key} lines up under its grandparent.`); }
          zz.parent!.color = BLACK; zz.parent!.parent!.color = RED;
          rotateLeft(zz.parent!.parent!);
          layout(zz.parent!.key, `Recolor and left-rotate grandparent — black-height is restored.`);
        }
      }
    }
    if (root) root.color = BLACK;
    layout(root ? root.key : null, `Force the root BLACK. Every red-black property now holds for ${key}.`);
  }
  if (!frames.length) layout(null, 'Empty tree — add some numbers.');
  return frames;
}

export default function AdvTreeRedBlackInsert() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('10, 20, 30, 15, 25, 5, 1');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(parseList('10, 20, 30, 15, 25, 5, 1')));
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
    const padX = 34, padY = 30;
    const X = (ix: number) => f.maxIx === 0 ? w / 2 : padX + (ix / f.maxIx) * (w - 2 * padX);
    const Y = (d: number) => padY + (d / Math.max(1, f.maxDepth)) * (h - 2 * padY);
    const map = new Map(f.nodes.map((n) => [n.key, n]));
    ctx.lineWidth = 2;
    ctx.strokeStyle = COL.edge;
    for (const [p, c] of f.edges) {
      const a = map.get(p)!, b = map.get(c)!;
      ctx.beginPath(); ctx.moveTo(X(a.ix), Y(a.depth)); ctx.lineTo(X(b.ix), Y(b.depth)); ctx.stroke();
    }
    const R = 16;
    for (const n of f.nodes) {
      const cx = X(n.ix), cy = Y(n.depth);
      if (n.key === f.hl) {
        ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = COL.ring; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = n.color === RED ? COL.red : COL.black; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n.key), cx, cy + 0.5);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.max(240, Math.min(360, w * 0.58));
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
    const interval = 900 / speed;
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

  const commit = () => { const vals = parseList(text); const f = buildFrames(vals); setFrames(f); setIdx(0); setPlaying(false); lastRef.current = 0; };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated keys to insert" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
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
      <p class="mt-2 text-center text-xs text-muted">Red nodes are circles filled red; black nodes filled dark. The sky-blue ring marks the node being fixed.</p>
    </div>
  );
}
