import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Girvan-Newman community detection by edge removal.
   - A default network of two dense groups joined by a bridge. Click one
     node then another to toggle an edge.
   - Edge betweenness = how many shortest paths cross an edge. Each STEP
     removes the highest-betweenness edge (drawn red, "about to cut"),
     recomputes, and the graph splits. Nodes are COLORED by connected
     component, so communities appear as the bridges are severed.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const POS = [
  { x: 0.18, y: 0.22 }, { x: 0.36, y: 0.18 }, { x: 0.18, y: 0.62 }, { x: 0.4, y: 0.6 },
  { x: 0.6, y: 0.4 }, { x: 0.82, y: 0.22 }, { x: 0.84, y: 0.66 }, { x: 0.62, y: 0.82 },
];
const DEFAULT_EDGES = ['0-1', '0-2', '1-2', '1-3', '2-3', '4-5', '4-6', '5-6', '5-7', '6-7', '3-4'];
const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

type Frame = { edgeList: string[]; remove: string | null; score: number; comps: number[] };

export default function NetGirvanNewman() {
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
    const ekey = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`);

    const buildAdj = (es: Set<string>) => {
      const adj: Set<number>[] = LABELS.map(() => new Set<number>());
      for (const e of es) { const [a, b] = e.split('-').map(Number); adj[a].add(b); adj[b].add(a); }
      return adj;
    };
    const components = (adj: Set<number>[]) => {
      const comp = new Array(N).fill(-1);
      let c = 0;
      for (let s = 0; s < N; s++) {
        if (comp[s] !== -1) continue;
        const q = [s];
        comp[s] = c;
        while (q.length) { const u = q.shift()!; for (const v of adj[u]) if (comp[v] === -1) { comp[v] = c; q.push(v); } }
        c++;
      }
      return comp;
    };
    const allShortest = (adj: Set<number>[], s: number, t: number) => {
      const dist = new Map<number, number>();
      const preds = new Map<number, number[]>();
      const q = [s];
      dist.set(s, 0);
      preds.set(s, []);
      while (q.length) {
        const u = q.shift()!;
        for (const v of adj[u]) {
          if (!dist.has(v)) { dist.set(v, dist.get(u)! + 1); preds.set(v, [u]); q.push(v); }
          else if (dist.get(v) === dist.get(u)! + 1) preds.get(v)!.push(u);
        }
      }
      if (!dist.has(t)) return [] as number[][];
      const paths: number[][] = [];
      const rec = (node: number, tail: number[]) => {
        if (node === s) { paths.push(tail); return; }
        for (const p of preds.get(node) || []) rec(p, [p, ...tail]);
      };
      rec(t, [t]);
      return paths;
    };
    const betweenness = (adj: Set<number>[]) => {
      const bw = new Map<string, number>();
      for (let s = 0; s < N; s++) {
        for (let t = s + 1; t < N; t++) {
          const paths = allShortest(adj, s, t);
          if (!paths.length) continue;
          for (const p of paths) for (let i = 0; i < p.length - 1; i++) {
            const k = ekey(p[i], p[i + 1]);
            bw.set(k, (bw.get(k) || 0) + 1 / paths.length);
          }
        }
      }
      return bw;
    };

    const cur = new Set(edges);
    const fr: Frame[] = [];
    let guard = 0;
    while (guard++ < 40) {
      const adj = buildAdj(cur);
      const comps = components(adj);
      const bw = betweenness(adj);
      let maxEdge: string | null = null;
      let maxScore = 0;
      for (const [k, v] of bw) if (v > maxScore + 1e-12) { maxScore = v; maxEdge = k; }
      fr.push({ edgeList: [...cur], remove: maxEdge, score: maxScore, comps });
      if (!maxEdge) break;
      cur.delete(maxEdge);
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

    for (const e of f.edgeList) {
      const [a, b] = e.split('-').map(Number);
      const cut = e === f.remove;
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.strokeStyle = cut ? '#ef4444' : 'rgba(128,128,128,0.45)';
      ctx.lineWidth = cut ? 4 : 1.8;
      if (cut) ctx.setLineDash([7, 5]); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (let i = 0; i < LABELS.length; i++) {
      ctx.beginPath();
      ctx.arc(px(i), py(i), 16, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[f.comps[i] % PALETTE.length];
      ctx.fill();
      if (i === sel) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
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
    const interval = 950 / speed;
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
  const nComp = new Set(f.comps).size;
  const rm = f.remove ? f.remove.split('-').map((n) => LABELS[+n]).join('–') : null;
  const caption = rm
    ? `step ${idx}: edge ${rm} has the highest betweenness (${f.score.toFixed(2)}) — it bridges groups, so it is cut next. Currently ${nComp} component${nComp > 1 ? 's' : ''}.`
    : `no edges left to remove. The network fell apart into ${nComp} components.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click one node then another to toggle an edge. The red dashed edge is the highest-betweenness
            link — the next to be cut. Node colour marks the connected component it belongs to.
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-surface-2 px-3 py-2">components<div class="font-mono font-semibold text-text">{nComp}</div></div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">next cut<div class="font-mono font-semibold text-text">{rm ?? '—'}</div></div>
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
