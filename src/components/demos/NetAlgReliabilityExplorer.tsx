import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated reliability analysis: bridges & articulation points.
   - A default network. Step through Tarjan's DFS, which timestamps
     each node (disc) and tracks the earliest node reachable by a
     back-edge (low). A tree-edge u-v is a BRIDGE when low[v] > disc[u]
     — nothing under v loops back above u, so cutting it splits the net.
   - Cut vertices (articulation points) get a yellow ring.
   - Tweak: toggle links on/off. Add a redundant link and watch a
     bridge stop being critical; remove a link and watch the network
     split into pieces.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const NODES = ['A', 'B', 'C', 'D', 'E', 'F'];
const POS: Record<string, { x: number; y: number }> = {
  A: { x: 0.12, y: 0.22 }, B: { x: 0.12, y: 0.78 }, C: { x: 0.34, y: 0.5 },
  D: { x: 0.56, y: 0.5 }, E: { x: 0.76, y: 0.28 }, F: { x: 0.94, y: 0.62 },
};
const ALL_LINKS: { key: string; a: string; b: string; def: boolean }[] = [
  { key: 'A-B', a: 'A', b: 'B', def: true },
  { key: 'B-C', a: 'B', b: 'C', def: true },
  { key: 'A-C', a: 'A', b: 'C', def: true },
  { key: 'C-D', a: 'C', b: 'D', def: true },
  { key: 'D-E', a: 'D', b: 'E', def: true },
  { key: 'D-F', a: 'D', b: 'F', def: true },
  { key: 'E-F', a: 'E', b: 'F', def: false }, // redundant: removes a bridge when on
  { key: 'A-D', a: 'A', b: 'D', def: false }, // redundant: removes C-D bridge when on
];

const COLORS = {
  idle: 'rgba(100,116,139,0.5)',
  active: '#0ea5e9',
  bridge: '#ef4444',
  tree: '#10b981',
  cur: '#4f46e5',
  done: '#10b981',
  comp: '#0ea5e9',
};

type Frame = {
  disc: Record<string, number>;
  low: Record<string, number>;
  visited: string[];
  cur: string | null;
  edge: [string, string] | null;
  edgeKind: 'tree' | 'back' | null;
  bridges: string[];
  aps: string[];
  caption: string;
};

function buildFrames(enabled: Set<string>): { frames: Frame[]; connected: boolean; comps: number } {
  const adj: Record<string, string[]> = {};
  for (const n of NODES) adj[n] = [];
  for (const l of ALL_LINKS) if (enabled.has(l.key)) { adj[l.a].push(l.b); adj[l.b].push(l.a); }

  const disc: Record<string, number> = {};
  const low: Record<string, number> = {};
  const parent: Record<string, string | null> = {};
  const visited = new Set<string>();
  const bridges = new Set<string>();
  const aps = new Set<string>();
  for (const n of NODES) { disc[n] = -1; low[n] = -1; parent[n] = null; }
  let timer = 0;
  const frames: Frame[] = [];
  const lk = (a: string, b: string) => [a, b].sort().join('-');

  const snap = (cur: string | null, edge: [string, string] | null, edgeKind: 'tree' | 'back' | null, caption: string) =>
    frames.push({
      disc: { ...disc }, low: { ...low }, visited: [...visited],
      cur, edge, edgeKind, bridges: [...bridges], aps: [...aps], caption,
    });

  const dfs = (u: string) => {
    visited.add(u);
    disc[u] = low[u] = timer++;
    snap(u, null, null, `Visit ${u}: stamp disc=low=${disc[u]}.`);
    let children = 0;
    for (const v of adj[u]) {
      if (!visited.has(v)) {
        children++;
        parent[v] = u;
        snap(u, [u, v], 'tree', `Tree-edge ${u}→${v}: descend into ${v}.`);
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
        let msg = `Return to ${u} from ${v}: low[${u}]=min → ${low[u]}.`;
        if (low[v] > disc[u]) { bridges.add(lk(u, v)); msg += ` Since low[${v}]=${low[v]} > disc[${u}]=${disc[u]}, link ${lk(u, v)} is a BRIDGE.`; }
        if (parent[u] !== null && low[v] >= disc[u]) { aps.add(u); msg += ` ${u} is a cut vertex.`; }
        if (parent[u] === null && children > 1) { aps.add(u); msg += ` Root ${u} has 2+ subtrees → cut vertex.`; }
        snap(u, [u, v], 'tree', msg);
      } else if (v !== parent[u]) {
        low[u] = Math.min(low[u], disc[v]);
        snap(u, [u, v], 'back', `Back-edge ${u}→${v}: low[${u}]=min(low[${u}], disc[${v}])=${low[u]}. This loop protects edges above.`);
      }
    }
  };

  let comps = 0;
  for (const n of NODES) if (!visited.has(n) && adj[n].length >= 0) {
    // only start DFS on nodes that have at least one enabled link OR are isolated
    if (!visited.has(n)) { comps++; dfs(n); }
  }
  const connected = comps === 1;
  frames.push({
    disc: { ...disc }, low: { ...low }, visited: [...visited],
    cur: null, edge: null, edgeKind: null, bridges: [...bridges], aps: [...aps],
    caption: connected
      ? `Done. ${bridges.size} bridge(s) and ${aps.size} cut vertex(es). Each red link is a single point of failure — add a parallel path to protect it.`
      : `Done. This network is in ${comps} disconnected pieces — some nodes can no longer reach the others.`,
  });
  return { frames, connected, comps };
}

export default function NetAlgReliabilityExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(ALL_LINKS.filter((l) => l.def).map((l) => l.key)));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { frames, connected } = useMemo(() => buildFrames(enabled), [enabled]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [enabled]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const X = (n: string) => 26 + POS[n].x * (w - 52);
    const Y = (n: string) => 26 + POS[n].y * (h - 52);
    const lk = (a: string, b: string) => [a, b].sort().join('-');

    const bridgeSet = new Set(frame.bridges);
    const apSet = new Set(frame.aps);
    const activeKey = frame.edge ? lk(frame.edge[0], frame.edge[1]) : null;
    const visitedSet = new Set(frame.visited);

    for (const l of ALL_LINKS) {
      if (!enabled.has(l.key)) continue;
      const x1 = X(l.a), y1 = Y(l.a), x2 = X(l.b), y2 = Y(l.b);
      const isBridge = bridgeSet.has(l.key);
      const isActive = activeKey === l.key;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isActive ? (frame.edgeKind === 'back' ? COLORS.active : COLORS.cur) : isBridge ? COLORS.bridge : COLORS.idle;
      ctx.lineWidth = isActive ? 4.5 : isBridge ? 4 : 1.6;
      if (isActive && frame.edgeKind === 'back') ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const n of NODES) {
      const x = X(n), y = Y(n);
      let fill = COLORS.idle;
      if (n === frame.cur) fill = COLORS.cur;
      else if (visitedSet.has(n)) fill = COLORS.done;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (apSet.has(n)) {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#fbbf24';
      } else {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      }
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n, x, y);
      const d = frame.disc[n];
      if (d >= 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 10px ui-monospace, monospace';
        ctx.fillText(`d${d}/l${frame.low[n]}`, x, y + 26);
      }
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
  useEffect(draw, [idx, frames, enabled]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
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
  const toggle = (key: string) => setEnabled((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-1.5">
        <span class="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">links</span>
        {ALL_LINKS.map((l) => (
          <button key={l.key} onClick={() => toggle(l.key)}
            class={`rounded-md px-2 py-1 font-mono text-xs font-semibold transition ${enabled.has(l.key) ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text line-through'}`}>
            {l.key}
          </button>
        ))}
        <span class={`ml-auto rounded-md px-2 py-1 text-xs font-semibold ${connected ? 'bg-brand-soft text-text' : 'bg-rose-500/15 text-rose-500'}`}>
          {connected ? 'connected' : 'SPLIT'}
        </span>
      </div>

      <canvas ref={canvasRef} class="touch-none mx-auto block rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>

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
      <p class="mt-2 text-center text-xs text-muted">Each node shows d (discovery time) / l (low-link). Red links are bridges; yellow-ringed nodes are cut vertices. Toggle E-F or A-D on to add redundancy.</p>
    </div>
  );
}
