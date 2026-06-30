import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Call-stack & recursion-tree visualizer.
   - Pick factorial (a straight chain) or fibonacci (a branching tree).
   - Slide n to grow the tree of calls and watch the count explode.
   - Green nodes are base cases — the recursion's stopping point.
   - Click any node to highlight every place the SAME subproblem is
     recomputed (sky blue) — the wasted work memoization later removes.
   - Counters: total calls vs. the deepest the call stack ever gets.
   ------------------------------------------------------------------ */

type Mode = 'factorial' | 'fibonacci';
type TNode = {
  id: number;
  label: string;
  value: number;
  depth: number;
  isBase: boolean;
  x: number;
  children: number[];
};

const COLORS = {
  node: '#4f46e5',
  base: '#10b981',
  dup: '#0ea5e9',
  edge: 'rgba(128,128,128,0.45)',
  text: '#ffffff',
};

function buildTree(mode: Mode, n: number) {
  const nodes: TNode[] = [];
  let leafX = 0;
  let maxDepth = 0;
  const rec = (arg: number, depth: number): number => {
    const id = nodes.length;
    if (depth > maxDepth) maxDepth = depth;
    const node: TNode = {
      id,
      label: `${mode === 'factorial' ? 'f' : 'F'}(${arg})`,
      value: 0,
      depth,
      isBase: false,
      x: 0,
      children: [],
    };
    nodes.push(node);
    if (mode === 'factorial') {
      if (arg <= 1) {
        node.isBase = true;
        node.value = 1;
        node.x = leafX; // chain sits on one vertical line
        return id;
      }
      const c = rec(arg - 1, depth + 1);
      node.children.push(c);
      node.x = nodes[c].x;
      node.value = arg * nodes[c].value;
      return id;
    }
    // fibonacci
    if (arg <= 1) {
      node.isBase = true;
      node.value = arg;
      node.x = leafX++;
      return id;
    }
    const l = rec(arg - 1, depth + 1);
    const r = rec(arg - 2, depth + 1);
    node.children.push(l, r);
    node.x = (nodes[l].x + nodes[r].x) / 2;
    node.value = nodes[l].value + nodes[r].value;
    return id;
  };
  rec(n, 0);
  const leaves = mode === 'factorial' ? 1 : leafX;
  return { nodes, maxDepth, leaves };
}

export default function CallStackTreeLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('fibonacci');
  const [n, setN] = useState(5);
  const [selected, setSelected] = useState<string | null>(null);
  const sizeRef = useRef({ w: 480, h: 340 });
  const sceneRef = useRef<{ nodes: TNode[]; leaves: number; maxDepth: number; selected: string | null }>({
    nodes: [],
    leaves: 1,
    maxDepth: 0,
    selected: null,
  });

  const maxN = mode === 'factorial' ? 11 : 8;
  const tree = buildTree(mode, n);
  sceneRef.current = { ...tree, selected };

  const layout = () => {
    const { w, h } = sizeRef.current;
    const { leaves, maxDepth } = sceneRef.current;
    const mx = 26;
    const top = 26;
    const bottom = 22;
    const spanX = leaves > 1 ? (w - 2 * mx) / (leaves - 1) : 0;
    const spanY = maxDepth > 0 ? (h - top - bottom) / maxDepth : 0;
    const r = Math.max(8, Math.min(17, leaves > 1 ? spanX * 0.42 : 18));
    const px = (node: TNode) => (leaves > 1 ? mx + node.x * spanX : w / 2);
    const py = (node: TNode) => top + node.depth * spanY;
    return { px, py, r };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { nodes, selected: sel } = sceneRef.current;
    ctx.clearRect(0, 0, w, h);
    const { px, py, r } = layout();

    // edges first
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 1.5;
    for (const node of nodes) {
      for (const c of node.children) {
        ctx.beginPath();
        ctx.moveTo(px(node), py(node));
        ctx.lineTo(px(nodes[c]), py(nodes[c]));
        ctx.stroke();
      }
    }

    // nodes
    ctx.font = `600 ${Math.max(9, Math.min(13, r * 0.95))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const node of nodes) {
      const x = px(node);
      const y = py(node);
      const isDup = sel !== null && node.label === sel;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isDup ? COLORS.dup : node.isBase ? COLORS.base : COLORS.node;
      ctx.fill();
      if (isDup) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      if (r >= 9) {
        ctx.fillStyle = COLORS.text;
        ctx.fillText(node.label, x, y);
      }
    }
  };

  // responsive canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.62);
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

  useEffect(draw, [mode, n, selected]);

  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { nodes } = sceneRef.current;
    const { px, py, r } = layout();
    let hit: TNode | null = null;
    for (const node of nodes) {
      const dx = mx - px(node);
      const dy = my - py(node);
      if (dx * dx + dy * dy <= (r + 4) * (r + 4)) hit = node;
    }
    if (hit) setSelected((s) => (s === hit!.label ? null : hit!.label));
  };

  // derived stats
  const totalCalls = tree.nodes.length;
  const stackDepth = tree.maxDepth + 1;
  const result = tree.nodes[0]?.value ?? 0;
  const dupCount = selected ? tree.nodes.filter((nd) => nd.label === selected).length : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['factorial', 'fibonacci'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setSelected(null);
              setN((cur) => Math.min(cur, m === 'factorial' ? 11 : 8));
            }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'factorial' ? 'factorial(n)' : 'fibonacci(n)'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
        />

        <div class="space-y-3 text-sm md:w-52">
          <label class="block">
            <span class="mb-1 block text-muted">n = {n}</span>
            <input
              type="range"
              min={1}
              max={maxN}
              step={1}
              value={n}
              onInput={(e) => {
                setN(parseInt((e.target as HTMLInputElement).value, 10));
                setSelected(null);
              }}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="total calls" value={`${totalCalls}`} />
            <Readout label="max stack depth" value={`${stackDepth}`} color={COLORS.node} />
            <Readout label="result" value={`${result}`} color={COLORS.base} />
            <Readout label="leaves (base)" value={`${tree.nodes.filter((nd) => nd.isBase).length}`} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            {mode === 'factorial' ? (
              <p>
                Factorial recurses in a straight <strong>chain</strong>: each call makes exactly one more.
                The chain length is the call-stack depth.
              </p>
            ) : selected ? (
              <p>
                <strong style={`color:${COLORS.dup}`}>{selected}</strong> is computed{' '}
                <strong>{dupCount}</strong> time{dupCount === 1 ? '' : 's'}. That repetition is what
                memoization erases.
              </p>
            ) : (
              <p>
                Tap a node to highlight every place the <strong>same</strong> subproblem is recomputed —
                the waste that explodes with n.
              </p>
            )}
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
