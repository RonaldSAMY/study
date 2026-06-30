import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated maximum flow (Edmonds-Karp) on a capacitated network.
   - Source S, sink T, directed edges with capacities.
   - Each step finds a shortest augmenting path (BFS) in the residual
     graph, pushes its bottleneck flow, and the running max flow grows.
   - When no augmenting path remains, the min-cut is highlighted:
     max flow == capacity of the cut that separates S from T.
   - Tweak: drag the two source-edge capacities and watch the answer.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const N = 6; // S=0 A=1 B=2 C=3 D=4 T=5
const LABEL = ['S', 'A', 'B', 'C', 'D', 'T'];
const POS = [
  { x: 0.06, y: 0.5 }, { x: 0.34, y: 0.2 }, { x: 0.34, y: 0.8 },
  { x: 0.66, y: 0.2 }, { x: 0.66, y: 0.8 }, { x: 0.94, y: 0.5 },
];
// forward edges [from, to, defaultCapacity]
const EDGES: [number, number, number][] = [
  [0, 1, 16], [0, 2, 13], [1, 2, 10], [1, 3, 12], [2, 1, 4],
  [2, 4, 14], [3, 2, 9], [3, 5, 20], [4, 3, 7], [4, 5, 4],
];

const COLORS = {
  node: 'rgba(100,116,139,0.6)',
  src: '#4f46e5',
  sink: '#10b981',
  reach: '#0ea5e9',
  idle: 'rgba(100,116,139,0.45)',
  used: '#10b981',
  aug: '#4f46e5',
  cut: '#ef4444',
};

type Frame = {
  flow: number[][];
  pathEdges: [number, number][];
  total: number;
  bottleneck: number | null;
  cut: [number, number][] | null;
  reach: number[];
  caption: string;
};

function buildFlowFrames(caps: number[][]): Frame[] {
  const C = caps.map((r) => r.slice());
  const F = Array.from({ length: N }, () => Array(N).fill(0));
  const frames: Frame[] = [];
  const s = 0, t = 5;
  let total = 0;

  const snap = (pathEdges: [number, number][], bottleneck: number | null, cut: [number, number][] | null, reach: number[], caption: string) =>
    frames.push({ flow: F.map((r) => r.slice()), pathEdges, total, bottleneck, cut, reach, caption });

  snap([], null, null, [], 'No flow yet. We repeatedly find a path from S to T that still has spare capacity.');

  while (true) {
    // BFS for shortest augmenting path in residual graph
    const parent = Array(N).fill(-1);
    parent[s] = s;
    const q = [s];
    while (q.length) {
      const u = q.shift()!;
      for (let v = 0; v < N; v++) {
        if (parent[v] === -1 && C[u][v] - F[u][v] > 0) {
          parent[v] = u;
          q.push(v);
        }
      }
    }
    if (parent[t] === -1) break;

    // bottleneck
    let bottleneck = Infinity;
    const pathEdges: [number, number][] = [];
    for (let v = t; v !== s; v = parent[v]) {
      const u = parent[v];
      bottleneck = Math.min(bottleneck, C[u][v] - F[u][v]);
      pathEdges.unshift([u, v]);
    }
    for (let v = t; v !== s; v = parent[v]) {
      const u = parent[v];
      F[u][v] += bottleneck;
      F[v][u] -= bottleneck;
    }
    total += bottleneck;
    const names = [s, ...pathEdges.map(([, v]) => v)].map((i) => LABEL[i]).join('→');
    snap(pathEdges, bottleneck, null, [], `Augmenting path ${names}: its tightest link allows ${bottleneck} more units. Max flow is now ${total}.`);
  }

  // min cut: residual-reachable set from S
  const reach: number[] = [];
  const seen = Array(N).fill(false);
  seen[s] = true;
  const q = [s];
  while (q.length) {
    const u = q.shift()!;
    reach.push(u);
    for (let v = 0; v < N; v++) if (!seen[v] && C[u][v] - F[u][v] > 0) { seen[v] = true; q.push(v); }
  }
  const cut: [number, number][] = [];
  for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) {
    if (seen[u] && !seen[v] && C[u][v] > 0) cut.push([u, v]);
  }
  snap([], null, cut, reach,
    `No augmenting path remains, so the flow is maximum: ${total}. The red links form the min-cut — saturated bottlenecks whose capacities sum to exactly ${total}.`);
  return frames;
}

export default function NetAlgFlowExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [capSA, setCapSA] = useState(16);
  const [capSB, setCapSB] = useState(13);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const caps = useMemo(() => {
    const C = Array.from({ length: N }, () => Array(N).fill(0));
    for (const [u, v, c] of EDGES) C[u][v] = c;
    C[0][1] = capSA;
    C[0][2] = capSB;
    return C;
  }, [capSA, capSB]);

  const frames = useMemo(() => buildFlowFrames(caps), [caps]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [caps]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const X = (i: number) => 26 + POS[i].x * (w - 52);
    const Y = (i: number) => 26 + POS[i].y * (h - 52);

    const augSet = new Set(frame.pathEdges.map(([a, b]) => `${a}-${b}`));
    const cutSet = new Set((frame.cut ?? []).map(([a, b]) => `${a}-${b}`));
    const reachSet = new Set(frame.reach);

    for (const [u, v] of EDGES) {
      const x1 = X(u), y1 = Y(u), x2 = X(v), y2 = Y(v);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // perpendicular offset so antiparallel edges don't overlap
      const ox = -uy * 7, oy = ux * 7;
      const r = 16;
      const ax = x1 + ux * r + ox, ay = y1 + uy * r + oy;
      const bx = x2 - ux * r + ox, by = y2 - uy * r + oy;
      const key = `${u}-${v}`;
      const f = frame.flow[u][v];
      const cap = caps[u][v];
      const aug = augSet.has(key);
      const cut = cutSet.has(key);
      ctx.strokeStyle = cut ? COLORS.cut : aug ? COLORS.aug : f > 0 ? COLORS.used : COLORS.idle;
      ctx.lineWidth = cut ? 4 : aug ? 4 : f > 0 ? 2.5 : 1.3;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // arrowhead
      const ah = 7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - ux * ah - uy * ah * 0.6, by - uy * ah + ux * ah * 0.6);
      ctx.lineTo(bx - ux * ah + uy * ah * 0.6, by - uy * ah - ux * ah * 0.6);
      ctx.closePath();
      ctx.fillStyle = cut ? COLORS.cut : aug ? COLORS.aug : f > 0 ? COLORS.used : COLORS.idle;
      ctx.fill();
      // flow/cap label
      const mx = (ax + bx) / 2 + ox, my = (ay + by) / 2 + oy;
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(15,23,42,0.05)';
      ctx.fillRect(mx - 15, my - 8, 30, 15);
      ctx.fillStyle = f > 0 ? '#0f766e' : '#64748b';
      ctx.fillText(`${f}/${cap}`, mx, my);
    }

    for (let i = 0; i < N; i++) {
      const x = X(i), y = Y(i);
      let fill = COLORS.node;
      if (i === 0) fill = COLORS.src;
      else if (i === 5) fill = COLORS.sink;
      else if (frame.cut && reachSet.has(i)) fill = COLORS.reach;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LABEL[i], x, y);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 580);
      const h = Math.round(w * 0.56);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, frames, caps]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (tm: number) => {
      if (!lastRef.current) lastRef.current = tm;
      if (tm - lastRef.current >= interval) {
        lastRef.current = tm;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <label class="flex items-center gap-2 text-muted">S→A cap <span class="font-mono text-text">{capSA}</span>
          <input type="range" min={2} max={20} value={capSA} onInput={(e) => setCapSA(parseInt((e.target as HTMLInputElement).value, 10))} class="flex-1 accent-[#4f46e5]" />
        </label>
        <label class="flex items-center gap-2 text-muted">S→B cap <span class="font-mono text-text">{capSB}</span>
          <input type="range" min={2} max={20} value={capSB} onInput={(e) => setCapSB(parseInt((e.target as HTMLInputElement).value, 10))} class="flex-1 accent-[#4f46e5]" />
        </label>
      </div>

      <canvas ref={canvasRef} class="touch-none mx-auto block rounded-xl bg-surface-2" />

      <div class="mt-2 flex items-center justify-center gap-4 text-sm">
        <span class="text-muted">max flow so far</span>
        <span class="rounded-lg bg-brand-soft px-3 py-1 font-mono text-lg font-bold text-text">{frame.total}</span>
      </div>

      <p class="mt-2 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">step {idx}/{frames.length - 1}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Each edge shows flow/capacity. Indigo = current augmenting path, green = carrying flow, red = the min-cut at the end.</p>
    </div>
  );
}
