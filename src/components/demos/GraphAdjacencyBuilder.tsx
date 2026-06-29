import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Build a small graph and watch its adjacency matrix update live.
   - "Add nodes" mode: click empty space to drop a node; drag to move.
   - "Add edges" mode: drag from one node to another to connect them
     (drag onto an already-connected node to remove the edge).
   - Toggle directed / undirected.
   Theme: a tiny social network (nodes = people, edges = follows).
   ------------------------------------------------------------------ */

type Node = { x: number; y: number };
type Mode = 'node' | 'edge';

const COLORS = {
  node: '#4f46e5',
  active: '#10b981',
  edge: 'rgba(14,165,233,0.85)',
  rubber: 'rgba(16,185,129,0.7)',
};
const NODE_R = 18;
const letter = (i: number) => String.fromCharCode(65 + i);

export default function GraphAdjacencyBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([
    { x: 90, y: 70 },
    { x: 230, y: 60 },
    { x: 300, y: 170 },
    { x: 150, y: 200 },
  ]);
  // edges stored as "i-j" keys
  const [edges, setEdges] = useState<Set<string>>(new Set(['0-1', '1-2', '0-3', '2-3']));
  const [mode, setMode] = useState<Mode>('edge');
  const [directed, setDirected] = useState(false);

  const dragRef = useRef<number | null>(null);
  const edgeFromRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const sizeRef = useRef({ w: 420, h: 280 });

  const key = (i: number, j: number) => (directed ? `${i}-${j}` : i < j ? `${i}-${j}` : `${j}-${i}`);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // edges
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.edge;
    ctx.fillStyle = COLORS.edge;
    edges.forEach((e) => {
      const [i, j] = e.split('-').map(Number);
      const a = nodes[i];
      const b = nodes[j];
      if (!a || !b) return;
      drawEdge(ctx, a, b, directed);
    });

    // rubber-band while creating an edge
    if (edgeFromRef.current != null && pointerRef.current) {
      const a = nodes[edgeFromRef.current];
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = COLORS.rubber;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointerRef.current.x, pointerRef.current.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // nodes
    nodes.forEach((n, i) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = edgeFromRef.current === i ? COLORS.active : COLORS.node;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter(i), n.x, n.y);
    });
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
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
  }, []);

  useEffect(draw, [nodes, edges, directed, mode]);

  const pos = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const hit = (x: number, y: number) =>
    nodes.findIndex((n) => Math.hypot(n.x - x, n.y - y) < NODE_R + 4);

  const onDown = (e: PointerEvent) => {
    const { x, y } = pos(e);
    const idx = hit(x, y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === 'edge') {
      if (idx >= 0) {
        edgeFromRef.current = idx;
        pointerRef.current = { x, y };
        draw();
      }
    } else {
      if (idx >= 0) dragRef.current = idx;
      else setNodes((ns) => [...ns, { x, y }]);
    }
  };
  const onMove = (e: PointerEvent) => {
    const { x, y } = pos(e);
    if (dragRef.current != null) {
      const i = dragRef.current;
      setNodes((ns) => ns.map((n, k) => (k === i ? { x, y } : n)));
    } else if (edgeFromRef.current != null) {
      pointerRef.current = { x, y };
      draw();
    }
  };
  const onUp = (e: PointerEvent) => {
    if (edgeFromRef.current != null) {
      const { x, y } = pos(e);
      const idx = hit(x, y);
      const from = edgeFromRef.current;
      if (idx >= 0 && idx !== from) {
        const k = key(from, idx);
        setEdges((s) => {
          const next = new Set(s);
          if (next.has(k)) next.delete(k);
          else next.add(k);
          return next;
        });
      }
    }
    edgeFromRef.current = null;
    pointerRef.current = null;
    dragRef.current = null;
    draw();
  };

  // adjacency matrix + degrees
  const n = nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  edges.forEach((e) => {
    const [i, j] = e.split('-').map(Number);
    if (i < n && j < n) {
      adj[i][j] = 1;
      if (!directed) adj[j][i] = 1;
    }
  });
  const degree = (i: number) => adj[i].reduce((s, v) => s + v, 0);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMode('node')}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            mode === 'node' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Add nodes
        </button>
        <button
          onClick={() => setMode('edge')}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            mode === 'edge' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Add edges
        </button>
        <label class="ml-1 flex cursor-pointer items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={directed} onChange={() => setDirected((d) => !d)} class="accent-[#4f46e5]" />
          directed
        </label>
        <button
          onClick={() => { setNodes([]); setEdges(new Set()); }}
          class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
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
            {mode === 'edge'
              ? 'Drag from one person to another to add a follow. Drag onto a linked person to remove it.'
              : 'Click empty space to add a person; drag a circle to move it.'}
          </p>

          {n > 0 ? (
            <div class="overflow-x-auto">
              <table class="text-center text-xs">
                <thead>
                  <tr class="text-muted">
                    <th class="px-1.5 py-1"></th>
                    {nodes.map((_, j) => <th key={j} class="px-1.5 py-1 font-semibold">{letter(j)}</th>)}
                  </tr>
                </thead>
                <tbody class="font-mono">
                  {adj.map((row, i) => (
                    <tr key={i}>
                      <td class="px-1.5 py-1 font-semibold text-muted">{letter(i)}</td>
                      {row.map((v, j) => (
                        <td key={j} class={`px-1.5 py-1 ${v ? 'font-bold text-brand' : 'text-muted opacity-50'}`}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p class="text-muted">No people yet — switch to “Add nodes”.</p>
          )}

          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <span class="text-muted">people: </span><strong>{n}</strong>
            <span class="ml-3 text-muted">{directed ? 'arcs' : 'edges'}: </span><strong>{edges.size}</strong>
            {n > 0 && (
              <p class="mt-1 text-muted">
                degrees: {nodes.map((_, i) => `${letter(i)}=${degree(i)}`).join('  ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function drawEdge(ctx: CanvasRenderingContext2D, a: Node, b: Node, directed: boolean) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  if (directed) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    // arrow tip sits on the rim of the target node
    const tx = b.x - Math.cos(ang) * NODE_R;
    const ty = b.y - Math.sin(ang) * NODE_R;
    const head = 10;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - head * Math.cos(ang - 0.45), ty - head * Math.sin(ang - 0.45));
    ctx.lineTo(tx - head * Math.cos(ang + 0.45), ty - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  }
}
