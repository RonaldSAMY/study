import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Centroid Decomposition.
   - We repeatedly pick a CENTROID: the node whose removal breaks the
     current component into pieces each of size <= half.
   - The centroid is removed and coloured by its level in the centroid
     tree; we then recurse into each leftover piece. Because every cut
     halves the size, the centroid tree has height O(log n).
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const LEVEL_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const COL = { gray: '#475569', comp: 'rgba(79,70,229,0.28)', edge: 'rgba(128,128,128,0.5)', ring: '#f59e0b' };

const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [3, 6], [4, 7], [4, 8]];
const NODES = 9;

type Frame = { comp: boolean[]; centroid: number | null; level: (number | null)[]; caption: string };

function layout() {
  const adj: number[][] = Array.from({ length: NODES }, () => []);
  for (const [a, b] of EDGES) { adj[a].push(b); adj[b].push(a); }
  for (const l of adj) l.sort((p, q) => p - q);
  const depth = Array(NODES).fill(0), xPos = Array(NODES).fill(0); let leaf = 0;
  const dfs = (v: number, p: number, d: number) => {
    depth[v] = d;
    const kids = adj[v].filter((u) => u !== p);
    if (kids.length === 0) { xPos[v] = leaf++; return; }
    for (const u of kids) dfs(u, v, d + 1);
    xPos[v] = kids.reduce((s, u) => s + xPos[u], 0) / kids.length;
  };
  dfs(0, -1, 0);
  return { depth, xPos, maxX: Math.max(1, ...xPos), maxD: Math.max(1, ...depth) };
}
const L = layout();

function buildFrames(): Frame[] {
  const adj: number[][] = Array.from({ length: NODES }, () => []);
  for (const [a, b] of EDGES) { adj[a].push(b); adj[b].push(a); }
  const removed = Array(NODES).fill(false);
  const level: (number | null)[] = Array(NODES).fill(null);
  const size = Array(NODES).fill(0);
  const frames: Frame[] = [];

  const component = (entry: number): boolean[] => {
    const seen = Array(NODES).fill(false);
    const q = [entry]; seen[entry] = true;
    while (q.length) { const v = q.shift()!; for (const u of adj[v]) if (!removed[u] && !seen[u]) { seen[u] = true; q.push(u); } }
    return seen;
  };
  const calcSize = (v: number, p: number): number => {
    size[v] = 1;
    for (const u of adj[v]) if (u !== p && !removed[u]) size[v] += calcSize(u, v);
    return size[v];
  };
  const findCentroid = (v: number, p: number, total: number): number => {
    for (const u of adj[v]) if (u !== p && !removed[u] && size[u] > total / 2) return findCentroid(u, v, total);
    return v;
  };
  const push = (comp: boolean[], centroid: number | null, caption: string) => {
    frames.push({ comp, centroid, level: [...level], caption });
  };

  const rec = (entry: number, cdepth: number) => {
    const comp = component(entry);
    const total = calcSize(entry, -1);
    push(comp, null, `A component of ${total} node(s). Its centroid is the node whose removal leaves every piece ≤ ${total}/2.`);
    const c = findCentroid(entry, -1, total);
    push(comp, c, `Node ${c} is the centroid of this piece.`);
    removed[c] = true; level[c] = cdepth % LEVEL_COLORS.length;
    push(comp.map((b, i) => b && !removed[i]), null, `Remove ${c} — it becomes a level-${cdepth} node of the centroid tree. Recurse into each leftover piece.`);
    for (const u of adj[c]) if (!removed[u]) rec(u, cdepth + 1);
  };
  rec(0, 0);
  push(Array(NODES).fill(false), null, 'Done. Each node was the centroid of a piece at most half the previous size, so the centroid tree is only O(log n) deep.');
  return frames;
}

export default function AdvTreeCentroid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [frames] = useState<Frame[]>(() => buildFrames());
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frame = frames[Math.min(idx, frames.length - 1)];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    const padX = 34, padY = 30;
    const X = (i: number) => padX + (L.xPos[i] / L.maxX) * (w - 2 * padX);
    const Y = (i: number) => padY + (L.depth[i] / L.maxD) * (h - 2 * padY);
    ctx.lineWidth = 2; ctx.strokeStyle = COL.edge;
    for (const [a, b] of EDGES) { ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); }
    const R = 16;
    for (let i = 0; i < NODES; i++) {
      const cx = X(i), cy = Y(i);
      const lvl = f ? f.level[i] : null;
      if (f && i === f.centroid) { ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.strokeStyle = COL.ring; ctx.lineWidth = 4; ctx.stroke(); }
      else if (f && f.comp[i] && lvl == null) { ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2); ctx.fillStyle = COL.comp; ctx.fill(); }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = lvl != null ? LEVEL_COLORS[lvl] : COL.gray; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i), cx, cy + 0.5);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.max(240, Math.min(330, w * 0.58));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, frames]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1050 / speed;
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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame?.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">frame {Math.min(idx + 1, frames.length)} / {frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">The orange ring marks the chosen centroid; node colours show their level in the centroid tree (indigo = level 0, deeper levels lighter).</p>
    </div>
  );
}
