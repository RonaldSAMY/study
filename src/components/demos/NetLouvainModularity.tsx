import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Louvain community detection.
   - A default undirected network with two dense groups + a bridge.
     Click one node then another to toggle an edge and reshape it.
   - Every node starts in its own community (its own COLOR). Each STEP
     is one accepted local move: a node joins the neighbouring community
     that raises modularity Q the most. The moving node is highlighted
     and recolours; Q climbs in the readout.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const POS = [
  { x: 0.18, y: 0.24 }, { x: 0.36, y: 0.18 }, { x: 0.18, y: 0.64 }, { x: 0.4, y: 0.58 },
  { x: 0.6, y: 0.44 }, { x: 0.8, y: 0.24 }, { x: 0.84, y: 0.66 }, { x: 0.62, y: 0.8 },
];
const DEFAULT_EDGES = ['0-1', '0-2', '1-3', '2-3', '1-2', '4-5', '5-6', '6-7', '4-7', '5-7', '3-4'];
const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

type Frame = { comm: number[]; moved: number; Q: number };

export default function NetLouvainModularity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [edges, setEdges] = useState<Set<string>>(() => new Set(DEFAULT_EDGES));
  const [sel, setSel] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frames: Frame[] = useMemo(() => {
    const N = LABELS.length;
    const adj: Set<number>[] = LABELS.map(() => new Set<number>());
    for (const e of edges) {
      const [a, b] = e.split('-').map(Number);
      adj[a].add(b);
      adj[b].add(a);
    }
    const m = edges.size || 1;
    const deg = adj.map((s) => s.size);
    const modularity = (comm: number[]) => {
      let q = 0;
      const groups = new Map<number, number[]>();
      comm.forEach((c, i) => { (groups.get(c) ?? groups.set(c, []).get(c)!).push(i); });
      for (const members of groups.values()) {
        let ein = 0;
        let dsum = 0;
        for (const i of members) {
          dsum += deg[i];
          for (const j of adj[i]) if (comm[j] === comm[i]) ein++;
        }
        ein /= 2;
        q += ein / m - (dsum / (2 * m)) ** 2;
      }
      return q;
    };

    const comm = LABELS.map((_, i) => i);
    const fr: Frame[] = [{ comm: comm.slice(), moved: -1, Q: modularity(comm) }];
    let improved = true;
    let guard = 0;
    while (improved && guard < 30) {
      improved = false;
      guard++;
      for (let node = 0; node < N; node++) {
        const cur = comm[node];
        const cand = new Set<number>();
        for (const nb of adj[node]) cand.add(comm[nb]);
        let best = cur;
        let bestQ = modularity(comm);
        for (const c of cand) {
          if (c === cur) continue;
          comm[node] = c;
          const q = modularity(comm);
          if (q > bestQ + 1e-9) { bestQ = q; best = c; }
          comm[node] = cur;
        }
        if (best !== cur) {
          comm[node] = best;
          improved = true;
          fr.push({ comm: comm.slice(), moved: node, Q: bestQ });
        }
      }
    }
    return fr;
  }, [edges]);

  const maxIdx = frames.length - 1;
  if (idx > maxIdx) setIdx(maxIdx);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    const px = (i: number) => POS[i].x * w;
    const py = (i: number) => POS[i].y * h;

    for (const e of edges) {
      const [a, b] = e.split('-').map(Number);
      const same = f.comm[a] === f.comm[b];
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.strokeStyle = same ? PALETTE[f.comm[a] % PALETTE.length] : 'rgba(128,128,128,0.35)';
      ctx.lineWidth = same ? 2.5 : 1.2;
      ctx.stroke();
    }

    for (let i = 0; i < LABELS.length; i++) {
      const r = i === f.moved ? 20 : 16;
      ctx.beginPath();
      ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[f.comm[i] % PALETTE.length];
      ctx.fill();
      if (i === f.moved) { ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      if (i === sel) { ctx.lineWidth = 3; ctx.strokeStyle = '#111827'; ctx.stroke(); }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LABELS[i], px(i), py(i));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const h = Math.round(w * 0.72);
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
  useEffect(draw, [idx, frames, sel, edges]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > maxIdx) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, maxIdx]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const onClick = (e: MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit = -1;
    for (let i = 0; i < LABELS.length; i++) {
      const dx = mx - POS[i].x * w;
      const dy = my - POS[i].y * h;
      if (dx * dx + dy * dy < 22 * 22) { hit = i; break; }
    }
    if (hit < 0) { setSel(null); return; }
    if (sel === null) { setSel(hit); return; }
    if (sel === hit) { setSel(null); return; }
    const k = sel < hit ? `${sel}-${hit}` : `${hit}-${sel}`;
    setEdges((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    setSel(null);
    setIdx(0);
    setPlaying(false);
  };

  const f = frames[Math.min(idx, maxIdx)];
  const nComm = new Set(f.comm).size;
  const caption = idx === 0
    ? 'Each node starts alone in its own community. Press Play to let Louvain merge them greedily.'
    : `step ${idx}: node ${LABELS[f.moved]} joins the neighbouring community that raised modularity most. Q = ${f.Q.toFixed(3)}, ${nComm} communities so far.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click one node then another to toggle an edge. Same-colour nodes are in one community; edges
            inside a community are drawn bold. Watch modularity Q climb toward a stable partition.
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-surface-2 px-3 py-2">modularity Q<div class="font-mono font-semibold text-text">{f.Q.toFixed(3)}</div></div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">communities<div class="font-mono font-semibold text-text">{nComm}</div></div>
          </div>
          <button onClick={() => { setEdges(new Set(DEFAULT_EDGES)); setSel(null); reset(); }}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">
            Restore default network
          </button>
        </div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

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
