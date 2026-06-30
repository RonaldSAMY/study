import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated recursion TREE for fib(n) = fib(n-1) + fib(n-2).
   - Nodes are revealed in call order (pre-order DFS), so you watch the
     tree EXPLODE branch by branch.
   - Toggle memoization: a value already computed is reused and its whole
     subtree is pruned (shown amber, no children) — the tree collapses
     from exponential to linear.
   - play / pause / step / reset / speed, requestAnimationFrame autoplay,
     always cancelled on pause + unmount.
   ------------------------------------------------------------------ */

type Node = {
  id: number;
  n: number;
  depth: number;
  x: number;
  value: number;
  kind: 'base' | 'memo' | 'internal';
  parent: number | null;
};
const C = {
  internal: '#4f46e5',
  base: '#10b981',
  memo: '#f59e0b',
  edge: 'rgba(128,128,128,0.45)',
  dim: 'rgba(128,128,128,0.18)',
};

function buildTree(n: number, useMemo_: boolean): Node[] {
  const nodes: Node[] = [];
  let id = 0;
  let leaf = 0;
  const memo = new Map<number, number>();
  function build(k: number, depth: number, parent: number | null): Node {
    const node: Node = { id: id++, n: k, depth, x: 0, value: 0, kind: 'internal', parent };
    nodes.push(node);
    if (k <= 1) {
      node.value = k;
      node.kind = 'base';
      node.x = leaf++;
      return node;
    }
    if (useMemo_ && memo.has(k)) {
      node.value = memo.get(k)!;
      node.kind = 'memo';
      node.x = leaf++;
      return node;
    }
    const l = build(k - 1, depth + 1, node.id);
    const r = build(k - 2, depth + 1, node.id);
    node.x = (l.x + r.x) / 2;
    node.value = l.value + r.value;
    if (useMemo_) memo.set(k, node.value);
    return node;
  }
  build(n, 0, null);
  return nodes;
}

function caption(node: Node, n: number): string {
  if (node.kind === 'base') return `fib(${node.n}) = ${node.value} — base case, return immediately.`;
  if (node.kind === 'memo') return `fib(${node.n}) was already computed → reuse ${node.value} and PRUNE its subtree.`;
  if (node.n === n) return `Call fib(${node.n}) — the root. It needs fib(${node.n - 1}) + fib(${node.n - 2}).`;
  return `Call fib(${node.n}) — it splits into fib(${node.n - 1}) + fib(${node.n - 2}).`;
}

export default function RecFibTree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 520, h: 360 });
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  const [n, setN] = useState(5);
  const [useMemo_, setUseMemo] = useState(false);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);

  const nodes = useMemo(() => buildTree(n, useMemo_), [n, useMemo_]);
  const naiveCount = useMemo(() => buildTree(n, false).length, [n]);
  const maxX = useMemo(() => Math.max(1, ...nodes.map((nd) => nd.x)), [nodes]);
  const maxDepth = useMemo(() => Math.max(1, ...nodes.map((nd) => nd.depth)), [nodes]);

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [nodes]);

  const revealed = Math.min(idx + 1, nodes.length);
  const active = nodes[Math.min(idx, nodes.length - 1)];

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastRef.current = performance.now();
    accRef.current = 0;
    const loop = (t: number) => {
      accRef.current += t - lastRef.current;
      lastRef.current = t;
      if (accRef.current >= 650 / speed) {
        accRef.current = 0;
        setIdx((i) => {
          if (i >= nodes.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.66);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, nodes]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padX = 26;
    const padY = 28;
    const r = Math.max(11, Math.min(20, (w - 2 * padX) / (maxX + 1) / 2.4));
    const px = (x: number) => padX + r + (maxX === 0 ? (w - 2 * padX) / 2 - r : (x / maxX) * (w - 2 * padX - 2 * r));
    const py = (d: number) => padY + r + (maxDepth === 0 ? 0 : (d / maxDepth) * (h - 2 * padY - 2 * r));

    // edges first (only between revealed nodes)
    ctx.lineWidth = 1.5;
    for (let i = 0; i < revealed; i++) {
      const nd = nodes[i];
      if (nd.parent == null) continue;
      const p = nodes[nd.parent];
      ctx.strokeStyle = C.edge;
      ctx.beginPath();
      ctx.moveTo(px(p.x), py(p.depth));
      ctx.lineTo(px(nd.x), py(nd.depth));
      ctx.stroke();
    }
    // nodes
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < revealed; i++) {
      const nd = nodes[i];
      const color = nd.kind === 'base' ? C.base : nd.kind === 'memo' ? C.memo : C.internal;
      const isActive = i === idx;
      ctx.beginPath();
      ctx.arc(px(nd.x), py(nd.depth), r, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? color : hexA(color, 0.16);
      ctx.fill();
      ctx.lineWidth = isActive ? 3 : 1.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.fillStyle = isActive ? '#fff' : '#0f172a';
      ctx.font = `700 ${Math.round(r * 0.78)}px Inter, system-ui, sans-serif`;
      ctx.fillText(`${nd.n}`, px(nd.x), py(nd.depth) - r * 0.18);
      ctx.font = `600 ${Math.round(r * 0.62)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = isActive ? '#fff' : color;
      ctx.fillText(`=${nd.value}`, px(nd.x), py(nd.depth) + r * 0.5);
    }
  }

  const atEnd = idx >= nodes.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <label class="flex flex-1 items-center gap-2">
          <span class="text-muted">fib(n), n = {n}</span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={n}
            onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))}
            class="flex-1 accent-[#4f46e5]"
          />
        </label>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useMemo_}
            onInput={(e) => setUseMemo((e.target as HTMLInputElement).checked)}
            class="h-4 w-4 accent-[#f59e0b]"
          />
          <span>memoize (prune repeats)</span>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm md:w-56">
          <div class="min-h-[4rem] rounded-lg bg-surface-2 p-3">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">
              Call {revealed} / {nodes.length}
            </span>
            <p class="mt-1 text-text">{active ? caption(active, n) : ''}</p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-xs text-muted">calls now</span>
              <div class="font-mono font-semibold">{nodes.length}</div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-xs text-muted">naive calls</span>
              <div class="font-mono font-semibold">{naiveCount}</div>
            </div>
          </div>
          <StepControls
            playing={playing}
            atEnd={atEnd}
            speed={speed}
            onPlay={() => {
              if (atEnd) setIdx(0);
              setPlaying((p) => !p);
            }}
            onStepBack={() => {
              setPlaying(false);
              setIdx((i) => Math.max(0, i - 1));
            }}
            onStepFwd={() => {
              setPlaying(false);
              setIdx((i) => Math.min(nodes.length - 1, i + 1));
            }}
            onReset={() => {
              setPlaying(false);
              setIdx(0);
            }}
            onSpeed={setSpeed}
          />
          <p class="text-xs text-muted">
            <span style="color:#10b981">●</span> base · <span style="color:#4f46e5">●</span> split ·
            <span style="color:#f59e0b"> ●</span> reused. Turn memoize on and watch the tree shrink.
          </p>
        </div>
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function StepControls({
  playing,
  atEnd,
  speed,
  onPlay,
  onStepBack,
  onStepFwd,
  onReset,
  onSpeed,
}: {
  playing: boolean;
  atEnd: boolean;
  speed: number;
  onPlay: () => void;
  onStepBack: () => void;
  onStepFwd: () => void;
  onReset: () => void;
  onSpeed: (v: number) => void;
}) {
  return (
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <button onClick={onStepBack} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text" title="Step back">⏮</button>
        <button onClick={onPlay} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">{playing ? '⏸ Pause' : atEnd ? '↺ Replay' : '▶ Play'}</button>
        <button onClick={onStepFwd} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text" title="Step forward">⏭</button>
        <button onClick={onReset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text" title="Reset">↺</button>
      </div>
      <label class="flex items-center gap-2 text-xs text-muted">
        <span>speed</span>
        <input type="range" min={0.25} max={4} step={0.25} value={speed} onInput={(e) => onSpeed(parseFloat((e.target as HTMLInputElement).value))} class="flex-1 accent-[#4f46e5]" />
        <span class="w-8 font-mono">{speed.toFixed(2)}×</span>
      </label>
    </div>
  );
}
