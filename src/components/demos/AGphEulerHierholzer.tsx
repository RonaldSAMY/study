import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Eulerian trail via Hierholzer's algorithm, animated.
   - Walk edges one at a time, deleting each as you cross it. When a vertex
     runs out of unused edges, drop it onto the finished trail and back up.
   - Works on a multigraph (parallel edges are bent apart so each is
     visible). Start vertex is an odd-degree vertex when there are two of
     them (an Eulerian PATH), otherwise any vertex (an Eulerian CIRCUIT).
   - Frames are precomputed by instrumenting Hierholzer, then replayed.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
   ------------------------------------------------------------------ */

type Node = { id: number; x: number; y: number };
type Edge = [number, number];
type Frame = {
  used: boolean[];
  stack: number[];
  path: number[];
  active: number;
  activeEdge: number;
  odd: number[];
  caption: string;
};

const ACTIVE = '#4f46e5';
const DONE = '#10b981';

const PRESETS: { name: string; nodes: Node[]; edges: Edge[] }[] = [
  {
    name: 'Figure-eight (circuit)',
    nodes: [
      { id: 0, x: 0.14, y: 0.22 },
      { id: 1, x: 0.14, y: 0.78 },
      { id: 2, x: 0.50, y: 0.50 },
      { id: 3, x: 0.86, y: 0.22 },
      { id: 4, x: 0.86, y: 0.78 },
    ],
    edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]],
  },
  {
    name: 'Tail (path, 2 odd)',
    nodes: [
      { id: 0, x: 0.22, y: 0.24 },
      { id: 1, x: 0.22, y: 0.76 },
      { id: 2, x: 0.55, y: 0.50 },
      { id: 3, x: 0.78, y: 0.30 },
      { id: 4, x: 0.93, y: 0.70 },
    ],
    edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4]],
  },
  {
    name: 'Königsberg (none)',
    nodes: [
      { id: 0, x: 0.50, y: 0.16 },
      { id: 1, x: 0.50, y: 0.84 },
      { id: 2, x: 0.85, y: 0.50 },
      { id: 3, x: 0.15, y: 0.50 },
    ],
    edges: [[0, 1], [0, 1], [0, 2], [0, 2], [0, 3], [1, 3], [2, 3]],
  },
];

function buildFrames(nodes: Node[], edges: Edge[]): Frame[] {
  const n = nodes.length;
  const inc: number[][] = Array.from({ length: n }, () => []);
  edges.forEach(([u, v], i) => { inc[u].push(i); inc[v].push(i); });
  const deg = Array(n).fill(0);
  edges.forEach(([u, v]) => { deg[u]++; deg[v]++; });
  const odd = deg.map((d, i) => (d % 2 === 1 ? i : -1)).filter((i) => i >= 0);
  let start = 0;
  if (odd.length === 2) start = odd[0];
  else for (let i = 0; i < n; i++) if (deg[i] > 0) { start = i; break; }

  const used = Array(edges.length).fill(false);
  const stack = [start];
  const path: number[] = [];
  const other = (i: number, v: number) => (edges[i][0] === v ? edges[i][1] : edges[i][0]);
  const frames: Frame[] = [];
  const snap = (active: number, activeEdge: number, caption: string, oddNodes: number[] = []) =>
    frames.push({ used: [...used], stack: [...stack], path: [...path], active, activeEdge, odd: oddNodes, caption });

  // Euler's theorem: a trail needs exactly 0 or 2 odd-degree vertices.
  const hasTrail = odd.length === 0 || odd.length === 2;
  if (!hasTrail) {
    snap(-1, -1, `Check the degrees first: ${odd.length} vertices have odd degree (${odd.join(', ')}).`, odd);
    snap(-1, -1, `Euler's theorem: a single trail can have at most 2 odd-degree vertices — they are its endpoints.`, odd);
    snap(-1, -1, `With ${odd.length} odd-degree vertices there is NO Eulerian trail. (Königsberg's famous "impossible" answer.)`, odd);
    return frames;
  }

  const oddText = odd.length === 0 ? 'every vertex has even degree' : `vertices ${odd.join(' and ')} have odd degree (the endpoints)`;
  snap(start, -1, `Degrees checked: ${oddText}. Start Hierholzer at vertex ${start}.`);

  let guard = 0;
  while (stack.length && guard++ < 2000) {
    const v = stack[stack.length - 1];
    let ei = -1;
    for (const i of inc[v]) if (!used[i]) { ei = i; break; }
    if (ei === -1) {
      path.push(v);
      stack.pop();
      snap(stack.length ? stack[stack.length - 1] : v, -1, `Vertex ${v} has no unused edges — append it to the trail and back up.`);
    } else {
      used[ei] = true;
      const w = other(ei, v);
      stack.push(w);
      snap(w, ei, `Cross edge ${v}–${w}: mark it used and advance to ${w}.`);
    }
  }
  path.reverse();
  const circuit = path[0] === path[path.length - 1];
  snap(-1, -1, `All ${edges.length} edges used. Trail: ${path.join(' → ')} — an Eulerian ${circuit ? 'CIRCUIT (returns to start)' : 'PATH'}.`);
  return frames;
}

export default function AGphEulerHierholzer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 540, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [preset, setPreset] = useState(0);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { nodes, edges } = PRESETS[preset];
  const frames = useMemo(() => buildFrames(nodes, edges), [preset]);
  const bend = useMemo(() => {
    const groups = new Map<string, number[]>();
    edges.forEach(([u, v], i) => {
      const k = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(i);
    });
    const out = Array(edges.length).fill(0);
    for (const list of groups.values()) {
      const c = list.length;
      list.forEach((ei, r) => { out[ei] = (r - (c - 1) / 2) * 30; });
    }
    return out;
  }, [preset]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [preset]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 40;
    const px = (x: number) => pad + x * (w - 2 * pad);
    const py = (y: number) => pad + y * (h - 2 * pad);
    const R = 19;

    edges.forEach(([u, v], i) => {
      const a = nodes[u], b = nodes[v];
      const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const off = bend[i];
      const cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
      const isUsed = frame.used[i];
      const hot = i === frame.activeEdge;
      ctx.strokeStyle = hot ? ACTIVE : isUsed ? DONE : 'rgba(128,128,128,0.40)';
      ctx.lineWidth = hot ? 4.5 : isUsed ? 3 : 1.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
    });

    for (const nd of nodes) {
      const x = px(nd.x), y = py(nd.y);
      const onTrail = frame.path.includes(nd.id);
      let fill = '#1f2937';
      if (nd.id === frame.active) fill = ACTIVE;
      else if (onTrail) fill = 'rgba(16,185,129,0.30)';
      const top = frame.stack[frame.stack.length - 1] === nd.id;
      const isOdd = frame.odd.includes(nd.id);
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = isOdd ? '#ef4444' : fill;
      ctx.fill();
      ctx.lineWidth = isOdd ? 4 : top ? 3.5 : 2;
      ctx.strokeStyle = isOdd ? '#fca5a5' : top ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${nd.id}`, x, y);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, preset]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
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

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const usedCount = frame.used.filter(Boolean).length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPreset(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${preset === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
          >
            {p.name}
          </button>
        ))}
        <span class="ml-auto text-xs text-muted">edges used {usedCount}/{edges.length}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{frame.caption}</p>
          <div class="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
            <div class="text-muted">trail so far (built in reverse)</div>
            <div class="mt-1 text-text">[{frame.path.join(', ')}]</div>
          </div>
          <p class="text-xs text-muted">Green edges are already crossed; the indigo node is the current position.</p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
    </div>
  );
}
