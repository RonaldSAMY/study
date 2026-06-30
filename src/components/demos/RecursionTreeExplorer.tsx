import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Recursion tree explorer for Fibonacci, fib(n) = fib(n-1) + fib(n-2).
   - Slide n to grow the call tree and watch the number of calls explode.
   - Green leaves are base cases (the recursion's stopping point).
   - Click any node to highlight every place the SAME subproblem is
     recomputed — the waste that memoization later removes.
   - Counters show total calls vs. the deepest the call stack ever gets.
   ------------------------------------------------------------------ */

type Node = { k: number; depth: number; parent: number; x: number };

const COLORS = {
  node: '#4f46e5',
  base: '#10b981',
  dup: '#0ea5e9',
  edge: 'rgba(128,128,128,0.4)',
};

function buildTree(n: number): { nodes: Node[]; leaves: number; maxDepth: number } {
  const nodes: Node[] = [];
  let leaf = 0;
  let maxDepth = 0;
  const build = (k: number, depth: number, parent: number): number => {
    const id = nodes.length;
    nodes.push({ k, depth, parent, x: 0 });
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (k < 2) { x = leaf + 0.5; leaf++; }
    else {
      const c1 = build(k - 1, depth + 1, id);
      const c2 = build(k - 2, depth + 1, id);
      x = (nodes[c1].x + nodes[c2].x) / 2;
    }
    nodes[id].x = x;
    return id;
  };
  build(n, 0, -1);
  return { nodes, leaves: Math.max(1, leaf), maxDepth };
}

export default function RecursionTreeExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [n, setN] = useState(5);
  const [highlightK, setHighlightK] = useState<number | null>(null);
  const treeRef = useRef(buildTree(5));
  const sizeRef = useRef({ w: 480, h: 300 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const { nodes, leaves, maxDepth } = treeRef.current;
    const padX = 18, padY = 24;
    const colW = (w - padX * 2) / leaves;
    const rowH = maxDepth > 0 ? (h - padY * 2) / maxDepth : 0;
    const r = Math.max(7, Math.min(16, colW * 0.42));

    const px = (node: Node) => padX + node.x * colW;
    const py = (node: Node) => padY + node.depth * rowH;

    // edges
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 1.5;
    for (const node of nodes) {
      if (node.parent >= 0) {
        const p = nodes[node.parent];
        ctx.beginPath();
        ctx.moveTo(px(p), py(p));
        ctx.lineTo(px(node), py(node));
        ctx.stroke();
      }
    }
    // nodes
    for (const node of nodes) {
      const x = px(node), y = py(node);
      let color = node.k < 2 ? COLORS.base : COLORS.node;
      if (highlightK !== null && node.k === highlightK) color = COLORS.dup;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      if (r >= 9) {
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${Math.round(r * 0.85)}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(node.k), x, y);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const hgt = Math.round(Math.min(360, w * 0.6));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hgt * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hgt}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hgt };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    treeRef.current = buildTree(n);
    setHighlightK(null);
    draw();
  }, [n]);

  useEffect(draw, [highlightK]);

  const onPointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { nodes, leaves, maxDepth } = treeRef.current;
    const { w, h } = sizeRef.current;
    const padX = 18, padY = 24;
    const colW = (w - padX * 2) / leaves;
    const rowH = maxDepth > 0 ? (h - padY * 2) / maxDepth : 0;
    let best: Node | null = null;
    let bestD = 1e9;
    for (const node of nodes) {
      const x = padX + node.x * colW;
      const y = padY + node.depth * rowH;
      const d = Math.hypot(x - mx, y - my);
      if (d < bestD) { bestD = d; best = node; }
    }
    if (best && bestD < 26) setHighlightK((cur) => (cur === best!.k ? null : best!.k));
  };

  const { nodes, maxDepth } = treeRef.current;
  const totalCalls = nodes.length;
  const unique = new Set(nodes.map((nd) => nd.k)).size;
  const dupCount = highlightK !== null ? nodes.filter((nd) => nd.k === highlightK).length : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas
        ref={canvasRef}
        class="touch-none rounded-xl bg-surface-2"
        onPointerDown={onPointer}
      />
      <div class="mt-3 space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">compute fib({n})</span>
          <input
            type="range" min={1} max={9} step={1} value={n}
            onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]"
          />
        </label>
        <div class="grid grid-cols-3 gap-2">
          <Readout label="total calls" value={String(totalCalls)} />
          <Readout label="max stack depth" value={String(maxDepth + 1)} />
          <Readout label="unique subproblems" value={String(unique)} />
        </div>
        <p class="text-xs text-muted">
          {highlightK !== null
            ? `fib(${highlightK}) is recomputed ${dupCount} time${dupCount === 1 ? '' : 's'} — pure wasted work.`
            : 'Click a node to see how often the same subproblem is recomputed.'}
        </p>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
