import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Heavy-Light Decomposition.
   - First we compute subtree sizes; the heavy child (largest subtree)
     of each node is joined by a THICK edge.
   - Then a DFS walks heavy-first, painting each heavy chain its own
     colour and laying the nodes into one contiguous array (shown at
     the bottom) so a segment tree can answer path queries.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const CHAIN_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
const COL = { gray: '#475569', edge: 'rgba(128,128,128,0.5)', heavy: '#0ea5e9', ring: '#f59e0b' };

const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [3, 6], [4, 7], [4, 8]];
const NODES = 9;
const ROOT = 0;

type Frame = { colorOf: (number | null)[]; hl: number | null; order: number[]; caption: string; showSizes: boolean };

function buildAll() {
  const adj: number[][] = Array.from({ length: NODES }, () => []);
  for (const [a, b] of EDGES) { adj[a].push(b); adj[b].push(a); }
  for (const l of adj) l.sort((p, q) => p - q);
  const parent = Array(NODES).fill(-1), depth = Array(NODES).fill(0), size = Array(NODES).fill(1), heavy = Array(NODES).fill(-1);
  const xPos = Array(NODES).fill(0); let leaf = 0;
  const dfs1 = (v: number, p: number, d: number) => {
    parent[v] = p; depth[v] = d; size[v] = 1;
    const kids = adj[v].filter((u) => u !== p);
    let best = 0;
    if (kids.length === 0) xPos[v] = leaf++;
    for (const u of kids) { dfs1(u, v, d + 1); size[v] += size[u]; if (size[u] > best) { best = size[u]; heavy[v] = u; } }
    if (kids.length) xPos[v] = kids.reduce((s, u) => s + xPos[u], 0) / kids.length;
  };
  dfs1(ROOT, -1, 0);
  const order: number[] = [];
  const chainHead = Array(NODES).fill(-1);
  const dfs2 = (v: number, h: number) => {
    chainHead[v] = h; order.push(v);
    if (heavy[v] !== -1) dfs2(heavy[v], h);
    for (const u of adj[v]) if (u !== parent[v] && u !== heavy[v]) dfs2(u, u);
  };
  dfs2(ROOT, ROOT);
  const heavyEdge = new Set<string>();
  for (let v = 0; v < NODES; v++) if (heavy[v] !== -1) heavyEdge.add(`${v}-${heavy[v]}`);
  return { depth, size, heavy, parent, xPos, order, chainHead, heavyEdge, maxX: Math.max(1, ...xPos), maxD: Math.max(1, ...depth) };
}

const T = buildAll();

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const headColor = new Map<number, number>();
  const colorOf: (number | null)[] = Array(NODES).fill(null);
  frames.push({ colorOf: [...colorOf], hl: null, order: [], caption: 'Step 1: subtree sizes (shown on each node). The thick edge to the largest-subtree child is the HEAVY edge.', showSizes: true });
  for (let k = 0; k < T.order.length; k++) {
    const v = T.order[k];
    const head = T.chainHead[v];
    if (!headColor.has(head)) headColor.set(head, headColor.size % CHAIN_COLORS.length);
    colorOf[v] = headColor.get(head)!;
    let caption: string;
    if (v === ROOT) caption = `Root ${v} opens the first heavy chain. Array position ${k}.`;
    else if (T.heavy[T.parent[v]] === v) caption = `Heavy edge: ${v} continues the chain headed by ${head}. Array position ${k} — contiguous with its parent.`;
    else caption = `Light edge into ${v}: it starts a NEW chain (head ${v}). Array position ${k}.`;
    frames.push({ colorOf: [...colorOf], hl: v, order: T.order.slice(0, k + 1), caption, showSizes: false });
  }
  frames.push({ colorOf: [...colorOf], hl: null, order: [...T.order], caption: 'Every node now belongs to exactly one chain. Any root-to-leaf path crosses at most O(log n) light edges.', showSizes: false });
  return frames;
}

export default function AdvTreeHeavyLight() {
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
    const treeH = h - 56;
    const padX = 32, padY = 28;
    const X = (i: number) => padX + (T.xPos[i] / T.maxX) * (w - 2 * padX);
    const Y = (i: number) => padY + (T.depth[i] / T.maxD) * (treeH - 2 * padY);
    for (const [a, b] of EDGES) {
      const heavy = T.heavyEdge.has(`${a}-${b}`) || T.heavyEdge.has(`${b}-${a}`);
      ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b));
      ctx.lineWidth = heavy ? 5 : 2; ctx.strokeStyle = heavy ? COL.heavy : COL.edge; ctx.stroke();
    }
    const R = 15;
    for (let i = 0; i < NODES; i++) {
      const cx = X(i), cy = Y(i);
      if (f && i === f.hl) { ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2); ctx.strokeStyle = COL.ring; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const ci = f ? f.colorOf[i] : null;
      ctx.fillStyle = ci == null ? COL.gray : CHAIN_COLORS[ci]; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i), cx, cy + 0.5);
      if (f && f.showSizes) { ctx.fillStyle = '#94a3b8'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`sz${T.size[i]}`, cx, cy - R - 8); }
    }
    // linearized array row
    const cell = Math.min(30, (w - 2 * padX) / NODES);
    const rowY = h - 30;
    ctx.font = '600 12px ui-sans-serif, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < NODES; k++) {
      const x = padX + k * cell;
      const v = f && k < f.order.length ? f.order[k] : null;
      ctx.fillStyle = v == null ? 'rgba(128,128,128,0.12)' : CHAIN_COLORS[f!.colorOf[v]!];
      ctx.fillRect(x, rowY - cell / 2, cell - 2, cell);
      if (v != null) { ctx.fillStyle = '#fff'; ctx.fillText(String(v), x + (cell - 2) / 2, rowY); }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.max(280, Math.min(360, w * 0.62));
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
    const interval = 1000 / speed;
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
      <p class="mt-2 text-center text-xs text-muted">Thick sky edges are heavy. The coloured row is the contiguous array each chain occupies — a path query becomes a handful of array ranges.</p>
    </div>
  );
}
