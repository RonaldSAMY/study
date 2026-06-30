import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated betweenness centrality (Brandes' algorithm).
   - A social graph: two tight communities joined by a single bridge.
   - Step through one source node at a time. For each source we count
     all shortest paths and credit every node that sits on them. Node
     size grows with accumulated betweenness.
   - The punchline: the BRIDGE nodes balloon even though their friend
     count (degree) is ordinary — they are the brokers all traffic
     must pass through.
   - Toggle the bridge link to watch betweenness collapse / reroute.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COMM: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 1, F: 1, G: 1, H: 1 };
const POS: Record<string, { x: number; y: number }> = {
  A: { x: 0.12, y: 0.25 }, B: { x: 0.12, y: 0.75 }, C: { x: 0.3, y: 0.5 }, D: { x: 0.42, y: 0.3 },
  E: { x: 0.58, y: 0.7 }, F: { x: 0.7, y: 0.5 }, G: { x: 0.88, y: 0.25 }, H: { x: 0.88, y: 0.75 },
};
const CORE: [string, string][] = [
  ['A', 'B'], ['A', 'C'], ['B', 'C'], ['C', 'D'],
  ['E', 'F'], ['F', 'G'], ['F', 'H'], ['G', 'H'], ['E', 'G'],
];
const BRIDGE: [string, string] = ['D', 'E'];
const COMM_COLOR = ['#4f46e5', '#0ea5e9'];

type Frame = { betw: Record<string, number>; source: string | null; caption: string };

function brandesContribution(adj: Record<string, string[]>, s: string): Record<string, number> {
  const sigma: Record<string, number> = {};
  const dist: Record<string, number> = {};
  const pred: Record<string, string[]> = {};
  const delta: Record<string, number> = {};
  for (const v of NODES) { sigma[v] = 0; dist[v] = -1; pred[v] = []; delta[v] = 0; }
  sigma[s] = 1; dist[s] = 0;
  const order: string[] = [];
  const q = [s];
  while (q.length) {
    const v = q.shift()!;
    order.push(v);
    for (const w of adj[v]) {
      if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
      if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
    }
  }
  const out: Record<string, number> = {};
  for (const v of NODES) out[v] = 0;
  for (let i = order.length - 1; i >= 0; i--) {
    const w = order[i];
    for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
    if (w !== s) out[w] += delta[w];
  }
  return out;
}

function build(bridgeOn: boolean) {
  const links: [string, string][] = bridgeOn ? [...CORE, BRIDGE] : [...CORE];
  const adj: Record<string, string[]> = {};
  for (const n of NODES) adj[n] = [];
  for (const [a, b] of links) { adj[a].push(b); adj[b].push(a); }

  const betw: Record<string, number> = {};
  for (const n of NODES) betw[n] = 0;
  const frames: Frame[] = [{ betw: { ...betw }, source: null, caption: 'Betweenness starts at zero for everyone. We add up, source by source, how often each node sits on a shortest path.' }];

  for (const s of NODES) {
    const contrib = brandesContribution(adj, s);
    for (const n of NODES) betw[n] += contrib[n] / 2; // undirected: each pair counted twice
    frames.push({
      betw: { ...betw },
      source: s,
      caption: `Shortest paths from ${s} counted. Brokers between the two groups gain the most — every cross-group path runs through them.`,
    });
  }
  // degree centrality
  const degree: Record<string, number> = {};
  for (const n of NODES) degree[n] = adj[n].length;
  let topB = NODES[0];
  for (const n of NODES) if (betw[n] > betw[topB]) topB = n;
  frames.push({
    betw: { ...betw },
    source: null,
    caption: bridgeOn
      ? `Done. ${topB} has the highest betweenness — it is a structural bridge. Notice its degree is unremarkable: importance is about position, not popularity.`
      : `Done. With the bridge cut, the network is two islands: cross-group betweenness vanishes and no single broker dominates.`,
  });
  return { frames, links, degree, maxBetw: Math.max(1, ...NODES.map((n) => betw[n])) };
}

export default function NetAlgCentralityExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [bridgeOn, setBridgeOn] = useState(true);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { frames, links, degree, maxBetw } = useMemo(() => build(bridgeOn), [bridgeOn]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [bridgeOn]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const X = (n: string) => 30 + POS[n].x * (w - 60);
    const Y = (n: string) => 30 + POS[n].y * (h - 60);

    for (const [a, b] of links) {
      ctx.beginPath();
      ctx.moveTo(X(a), Y(a));
      ctx.lineTo(X(b), Y(b));
      const isBridge = (a === BRIDGE[0] && b === BRIDGE[1]) || (a === BRIDGE[1] && b === BRIDGE[0]);
      ctx.strokeStyle = isBridge ? '#f59e0b' : 'rgba(100,116,139,0.45)';
      ctx.lineWidth = isBridge ? 3 : 1.5;
      ctx.stroke();
    }

    for (const n of NODES) {
      const x = X(n), y = Y(n);
      const b = frame.betw[n];
      const r = 11 + 16 * (b / maxBetw);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = COMM_COLOR[COMM[n]];
      ctx.fill();
      ctx.lineWidth = n === frame.source ? 4 : 1.5;
      ctx.strokeStyle = n === frame.source ? '#10b981' : 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n, x, y);
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
  useEffect(draw, [idx, frames, bridgeOn]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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

  const ranked = [...NODES].sort((a, b) => frame.betw[b] - frame.betw[a]).slice(0, 3);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setBridgeOn((v) => !v)}
          class={`rounded-lg px-3 py-1.5 font-semibold transition ${bridgeOn ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          {bridgeOn ? 'Bridge D–E: ON' : 'Bridge D–E: cut'}
        </button>
        <span class="ml-auto text-xs text-muted">node size ∝ betweenness</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none block rounded-xl bg-surface-2" />
        <div class="space-y-1.5 text-sm">
          <div class="text-xs font-semibold uppercase tracking-wide text-muted">top betweenness</div>
          {ranked.map((n) => (
            <div key={n} class="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-1.5">
              <span class="font-mono font-semibold text-text">{n}</span>
              <span class="text-xs text-muted">deg {degree[n]}</span>
              <span class="font-mono text-text">{frame.betw[n].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

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
      <p class="mt-2 text-center text-xs text-muted">Two colours = two communities. The amber link is the only bridge between them; the green ring marks the current source.</p>
    </div>
  );
}
