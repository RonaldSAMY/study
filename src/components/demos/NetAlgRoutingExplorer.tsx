import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated link-state routing (Dijkstra) on a router network.
   - A default mesh of routers with latency-weighted links.
   - Step through Dijkstra settling one router at a time (lowest
     tentative distance first), relaxing its neighbors, until every
     router has a shortest distance from the source.
   - Then a packet hops along the shortest path to the destination.
   - Tweak: pick the source, pick the destination, shuffle link costs.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = {
  base: '#0ea5e9',
  settled: '#10b981',
  current: '#4f46e5',
  packet: '#4f46e5',
  idle: 'rgba(100,116,139,0.55)',
  relax: '#0ea5e9',
  path: '#4f46e5',
};

type Pos = { x: number; y: number };
type Frame = {
  dist: Record<string, number>;
  settled: string[];
  current: string | null;
  relax: [string, string][];
  packetAt: number | null;
  path: string[];
  caption: string;
};

const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const POS: Record<string, Pos> = {
  A: { x: 0.08, y: 0.5 },
  B: { x: 0.32, y: 0.18 },
  C: { x: 0.32, y: 0.82 },
  D: { x: 0.56, y: 0.5 },
  E: { x: 0.72, y: 0.16 },
  F: { x: 0.72, y: 0.84 },
  G: { x: 0.94, y: 0.5 },
};
// undirected links (endpoints only; weights live in state)
const LINKS: [string, string][] = [
  ['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'D'],
  ['D', 'E'], ['D', 'F'], ['E', 'F'], ['E', 'G'], ['F', 'G'],
];
const BASE_W: Record<string, number> = {
  'A-B': 4, 'A-C': 3, 'B-C': 2, 'B-D': 5, 'C-D': 6,
  'D-E': 3, 'D-F': 7, 'E-F': 2, 'E-G': 4, 'F-G': 3,
};
const lk = (a: string, b: string) => [a, b].sort().join('-');

function buildFrames(
  weights: Record<string, number>,
  source: string,
  dest: string,
): Frame[] {
  const adj: Record<string, { to: string; w: number }[]> = {};
  for (const n of NODES) adj[n] = [];
  for (const [a, b] of LINKS) {
    const w = weights[lk(a, b)];
    adj[a].push({ to: b, w });
    adj[b].push({ to: a, w });
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of NODES) { dist[n] = Infinity; prev[n] = null; }
  dist[source] = 0;
  const settled = new Set<string>();
  const frames: Frame[] = [];

  const snap = (current: string | null, relax: [string, string][], caption: string) =>
    frames.push({
      dist: { ...dist },
      settled: [...settled],
      current,
      relax,
      packetAt: null,
      path: [],
      caption,
    });

  snap(null, [], `Initialise: ${source} is 0 hops of latency from itself; every other router is "unknown" (∞).`);

  while (settled.size < NODES.length) {
    let u: string | null = null;
    let best = Infinity;
    for (const n of NODES) if (!settled.has(n) && dist[n] < best) { best = dist[n]; u = n; }
    if (u === null) break;
    settled.add(u);
    const relax: [string, string][] = [];
    for (const { to, w } of adj[u]) {
      if (settled.has(to)) continue;
      const nd = dist[u] + w;
      if (nd < dist[to]) { dist[to] = nd; prev[to] = u; relax.push([u, to]); }
    }
    snap(
      u,
      relax,
      `Settle ${u} at cost ${best} — it is the closest unsettled router. ` +
      (relax.length ? `Relax its links: ${relax.map(([, t]) => `${t}→${dist[t]}`).join(', ')}.` : `No neighbour improved.`),
    );
  }

  // reconstruct shortest path source → dest
  const path: string[] = [];
  let c: string | null = dest;
  while (c !== null) { path.unshift(c); c = prev[c]; }
  const total = dist[dest];

  for (let i = 0; i < path.length; i++) {
    frames.push({
      dist: { ...dist },
      settled: [...settled],
      current: null,
      relax: [],
      packetAt: i,
      path,
      caption: i === 0
        ? `Routing table is built. A packet leaves source ${source}.`
        : i === path.length - 1
          ? `Packet arrives at ${dest}. Total latency ${total} along ${path.join('→')}.`
          : `Packet hops to ${path[i]} (running latency ${dist[path[i]]}).`,
    });
  }
  return frames;
}

export default function NetAlgRoutingExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [weights, setWeights] = useState<Record<string, number>>({ ...BASE_W });
  const [source, setSource] = useState('A');
  const [dest, setDest] = useState('G');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const frames = useMemo(() => buildFrames(weights, source, dest), [weights, source, dest]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  // keep idx in range when inputs change
  useEffect(() => { setIdx(0); setPlaying(false); }, [weights, source, dest]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const px = (n: string) => 24 + POS[n].x * (w - 48);
    const py = (n: string) => 24 + POS[n].y * (h - 48);

    const relaxSet = new Set(frame.relax.map(([a, b]) => lk(a, b)));
    const pathSet = new Set<string>();
    for (let i = 1; i < frame.path.length; i++) pathSet.add(lk(frame.path[i - 1], frame.path[i]));
    const settledSet = new Set(frame.settled);

    // links
    for (const [a, b] of LINKS) {
      const key = lk(a, b);
      const onPath = pathSet.has(key) && frame.packetAt !== null;
      const relaxing = relaxSet.has(key);
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.strokeStyle = onPath ? COLORS.path : relaxing ? COLORS.relax : COLORS.idle;
      ctx.lineWidth = onPath ? 5 : relaxing ? 3.5 : 1.5;
      ctx.stroke();
      // weight label
      const mx = (px(a) + px(b)) / 2;
      const my = (py(a) + py(b)) / 2;
      ctx.fillStyle = 'rgba(120,120,120,0.95)';
      ctx.font = '600 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(15,23,42,0.04)';
      ctx.fillRect(mx - 9, my - 8, 18, 16);
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${weights[key]}`, mx, my);
    }

    // packet
    if (frame.packetAt !== null && frame.path.length) {
      const n = frame.path[frame.packetAt];
      ctx.beginPath();
      ctx.arc(px(n), py(n), 7, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.packet;
      ctx.fill();
    }

    // nodes
    for (const n of NODES) {
      const x = px(n), y = py(n);
      const isSrc = n === source, isDst = n === dest;
      let fill = COLORS.idle;
      if (n === frame.current) fill = COLORS.current;
      else if (settledSet.has(n)) fill = COLORS.settled;
      else if (frame.dist[n] < Infinity) fill = COLORS.base;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = isSrc || isDst ? 3 : 1.5;
      ctx.strokeStyle = isSrc ? '#fff' : isDst ? '#fbbf24' : 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n, x, y);
      // distance under node
      const d = frame.dist[n];
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillText(d === Infinity ? '∞' : `${d}`, x, y + 25);
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
  useEffect(draw, [idx, frames, weights, source, dest]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 780 / speed;
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

  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const shuffle = () => {
    const w: Record<string, number> = {};
    for (const k of Object.keys(BASE_W)) w[k] = 1 + Math.floor(Math.random() * 9);
    setWeights(w);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label class="flex items-center gap-1 text-muted">source
          <select value={source} onInput={(e) => setSource((e.target as HTMLSelectElement).value)}
            class="rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-text">
            {NODES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label class="flex items-center gap-1 text-muted">dest
          <select value={dest} onInput={(e) => setDest((e.target as HTMLSelectElement).value)}
            class="rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-text">
            {NODES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={shuffle} class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">Shuffle costs</button>
      </div>

      <canvas ref={canvasRef} class="touch-none mx-auto block rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>

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
      <p class="mt-2 text-center text-xs text-muted">Green = settled (final cost known), indigo = currently settling, blue = discovered. The number under each router is its best-known latency from the source.</p>
    </div>
  );
}
