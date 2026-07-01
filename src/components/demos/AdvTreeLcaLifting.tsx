import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Lowest Common Ancestor via binary lifting.
   - Pick two nodes u and v. We first lift the deeper one using jump
     pointers (powers of two), then lift both together until their
     parents coincide. That parent is the LCA.
   - The u-pointer is sky, the v-pointer is emerald; the LCA gets an
     indigo ring. A caption names each 2^j jump.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const COL = { node: '#334155', uP: '#0ea5e9', vP: '#10b981', lca: '#4f46e5', edge: 'rgba(128,128,128,0.55)' };

const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [3, 6], [4, 7], [4, 8]];
const NODES = 9;
const ROOT = 0;

type Frame = { uPtr: number; vPtr: number; lca: number | null; caption: string };

function buildTree() {
  const adj: number[][] = Array.from({ length: NODES }, () => []);
  for (const [a, b] of EDGES) { adj[a].push(b); adj[b].push(a); }
  for (const list of adj) list.sort((p, q) => p - q);
  const depth = Array(NODES).fill(0);
  const LOG = Math.ceil(Math.log2(NODES)) + 1;
  const up: number[][] = Array.from({ length: NODES }, () => Array(LOG).fill(-1));
  const xPos = Array(NODES).fill(0);
  let leaf = 0;
  const dfs = (v: number, p: number, d: number) => {
    depth[v] = d; up[v][0] = p;
    const kids = adj[v].filter((u) => u !== p);
    if (kids.length === 0) { xPos[v] = leaf++; return; }
    for (const u of kids) dfs(u, v, d + 1);
    xPos[v] = kids.reduce((s, u) => s + xPos[u], 0) / kids.length;
  };
  dfs(ROOT, -1, 0);
  for (let j = 1; j < LOG; j++) for (let i = 0; i < NODES; i++) if (up[i][j - 1] !== -1) up[i][j] = up[up[i][j - 1]][j - 1];
  const maxX = Math.max(1, ...xPos);
  const maxD = Math.max(1, ...depth);
  return { depth, up, xPos, LOG, maxX, maxD };
}

const TREE = buildTree();

function buildFrames(u0: number, v0: number): Frame[] {
  const { depth, up, LOG } = TREE;
  const frames: Frame[] = [];
  if (u0 < 0 || v0 < 0 || u0 >= NODES || v0 >= NODES) { frames.push({ uPtr: 0, vPtr: 0, lca: null, caption: 'Pick nodes between 0 and 8.' }); return frames; }
  let u = u0, v = v0;
  let swapped = false;
  if (depth[u] < depth[v]) { [u, v] = [v, u]; swapped = true; }
  frames.push({ uPtr: u, vPtr: v, lca: null, caption: `LCA(${u0}, ${v0}): the deeper node is ${u} (depth ${depth[u]}). Lift it to depth ${depth[v]} first.` });

  let diff = depth[u] - depth[v];
  for (let j = LOG - 1; j >= 0; j--) {
    if ((diff >> j) & 1) {
      u = up[u][j];
      frames.push({ uPtr: u, vPtr: v, lca: null, caption: `Jump up by 2^${j} = ${1 << j} levels using the precomputed pointer.` });
    }
  }
  if (u === v) { frames.push({ uPtr: u, vPtr: v, lca: u, caption: `They met: ${u} was an ancestor of the other, so LCA = ${u}.` }); return frames; }
  frames.push({ uPtr: u, vPtr: v, lca: null, caption: `Same depth now. Lift BOTH together by the largest jumps that keep them apart.` });
  for (let j = LOG - 1; j >= 0; j--) {
    if (up[u][j] !== up[v][j]) {
      u = up[u][j]; v = up[v][j];
      frames.push({ uPtr: u, vPtr: v, lca: null, caption: `up[${j}] differs — jump both by 2^${j} = ${1 << j}. Still below the LCA.` });
    }
  }
  const lca = up[u][0];
  frames.push({ uPtr: u, vPtr: v, lca, caption: `Their parents coincide: LCA(${u0}, ${v0}) = ${lca}.` });
  return frames;
}

export default function AdvTreeLcaLifting() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [uStr, setUStr] = useState('7');
  const [vStr, setVStr] = useState('6');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(7, 6));
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
    const { xPos, depth, maxX, maxD } = TREE;
    const padX = 34, padY = 30;
    const X = (i: number) => padX + (xPos[i] / maxX) * (w - 2 * padX);
    const Y = (i: number) => padY + (depth[i] / maxD) * (h - 2 * padY);
    ctx.lineWidth = 2; ctx.strokeStyle = COL.edge;
    for (const [a, b] of EDGES) { ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); }
    const R = 16;
    for (let i = 0; i < NODES; i++) {
      const cx = X(i), cy = Y(i);
      if (f && i === f.lca) { ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.strokeStyle = COL.lca; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      let fill = COL.node;
      if (f && i === f.uPtr && i === f.vPtr) fill = COL.lca;
      else if (f && i === f.uPtr) fill = COL.uP;
      else if (f && i === f.vPtr) fill = COL.vP;
      ctx.fillStyle = fill; ctx.fill();
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

  const commit = () => { const f = buildFrames(parseInt(uStr, 10), parseInt(vStr, 10)); setFrames(f); setIdx(0); setPlaying(false); lastRef.current = 0; };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1 text-xs text-muted">u
          <input value={uStr} onInput={(e) => setUStr((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-1 text-xs text-muted">v
          <input value={vStr} onInput={(e) => setVStr((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Query LCA</button>
        <span class="text-xs text-muted">nodes 0–8, rooted at 0</span>
      </div>

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
      <p class="mt-2 text-center text-xs text-muted">Try <code>u=7, v=8</code> (LCA 4), <code>u=7, v=6</code> (LCA 0), or <code>u=7, v=4</code> where one is an ancestor of the other.</p>
    </div>
  );
}
