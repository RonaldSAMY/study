import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   DP on Trees — two-pass "sum of distances" with rerooting.
   - Edit the edge list (e.g. "0-1,0-2,1-3"). Node 0 is the root.
   - Phase A (post-order, leaves -> root): each node u learns
       size[u]   = nodes in its subtree
       down[u]   = sum of distances from u to its subtree
     by reading its children:  down[u] += down[c] + size[c].
   - Phase B (pre-order, root -> leaves): reroot to every node:
       ans[v] = ans[parent] + (n - 2*size[v]).
   - The active node is filled; the state it READS (children in A,
     parent in B) is outlined in sky. A live caption narrates.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { active: '#4f46e5', read: '#0ea5e9', done: '#10b981' };

type Frame = {
  phase: 'A' | 'rootA' | 'B';
  node: number;
  reads: number[];
  caption: string;
};

function parseEdges(s: string): [number, number][] {
  const out: [number, number][] = [];
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) continue;
    out.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
  }
  return out;
}

export default function DpOptTreeReroot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('0-1,0-2,0-3,1-4,1-5,3-6');
  const [edges, setEdges] = useState<[number, number][]>(() => parseEdges('0-1,0-2,0-3,1-4,1-5,3-6'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // ---- build tree, layout, dp values, and animation frames ----
  const built = (() => {
    const nodes = new Set<number>();
    for (const [a, b] of edges) { nodes.add(a); nodes.add(b); }
    const n = nodes.size ? Math.max(...nodes) + 1 : 1;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) { if (a < n && b < n) { adj[a].push(b); adj[b].push(a); } }

    const parent = Array(n).fill(-1);
    const depth = Array(n).fill(0);
    const order: number[] = []; // pre-order
    const seen = new Set<number>();
    (function dfs(u: number, p: number, d: number) {
      seen.add(u); parent[u] = p; depth[u] = d; order.push(u);
      for (const v of adj[u]) if (v !== p && !seen.has(v)) dfs(v, u, d + 1);
    })(0, -1, 0);

    const post = [...order].reverse();
    const size = Array(n).fill(1);
    const down = Array(n).fill(0);
    for (const u of post) for (const v of adj[u]) if (parent[v] === u) { size[u] += size[v]; down[u] += down[v] + size[v]; }
    const ans = Array(n).fill(0);
    ans[0] = down[0];
    for (const v of order) if (v !== 0) ans[v] = ans[parent[v]] + (seen.size - 2 * size[v]);

    // simple layout: x by subtree leaf-span, y by depth
    const x = Array(n).fill(0);
    let leafCursor = 0;
    (function place(u: number, p: number) {
      const kids = adj[u].filter((v) => v !== p);
      if (kids.length === 0) { x[u] = leafCursor++; return; }
      for (const v of kids) place(v, u);
      x[u] = (x[kids[0]] + x[kids[kids.length - 1]]) / 2;
    })(0, -1);
    const maxX = Math.max(1, leafCursor - 1);
    const maxD = Math.max(1, ...depth);

    // frames
    const frames: Frame[] = [];
    for (const u of post) {
      const kids = adj[u].filter((v) => parent[v] === u);
      frames.push({
        phase: 'A', node: u, reads: kids,
        caption: kids.length === 0
          ? `Leaf ${u}: size=1, down=0 (no children to read).`
          : `Node ${u}: size=${size[u]}, down=${down[u]} = sum over children of (down[c]+size[c]).`,
      });
    }
    frames.push({ phase: 'rootA', node: 0, reads: [], caption: `Root done: ans[0] = down[0] = ${ans[0]} (distance sum from the root).` });
    for (const v of order) if (v !== 0)
      frames.push({
        phase: 'B', node: v, reads: [parent[v]],
        caption: `Reroot to ${v}: ans[${v}] = ans[${parent[v]}] + (n - 2*size[${v}]) = ${ans[parent[v]]} + (${seen.size} - ${2 * size[v]}) = ${ans[v]}.`,
      });

    return { n: seen.size, adj, parent, depth, size, down, ans, x, maxX, maxD, post, order, frames };
  })();

  const { frames } = built;
  const total = frames.length;

  const commit = () => {
    const parsed = parseEdges(text);
    if (parsed.length) { setEdges(parsed); setIdx(0); setPlaying(false); }
  };

  // progress helpers
  const nA = built.post.length;
  const downKnown = (u: number) => built.post.indexOf(u) <= Math.min(idx, nA - 1) && idx >= 0;
  const ansProgress = idx - (nA + 1); // -1 means not started; index into order-excluding-root
  const ansKnown = (u: number) => {
    if (idx < nA) return false;
    if (u === 0) return true;
    const orderB = built.order.filter((v) => v !== 0);
    return orderB.indexOf(u) <= ansProgress;
  };
  const cur = idx < total ? frames[idx] : null;

  // ---- draw ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padX = 38, padY = 34;
    const px = (u: number) => padX + (built.x[u] / built.maxX) * (w - 2 * padX);
    const py = (u: number) => padY + (built.depth[u] / built.maxD) * (h - 2 * padY);

    // edges
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.5;
    for (let u = 0; u < built.n; u++) for (const v of built.adj[u]) if (built.parent[v] === u) {
      ctx.beginPath(); ctx.moveTo(px(u), py(u)); ctx.lineTo(px(v), py(v)); ctx.stroke();
    }

    const reads = new Set(cur ? cur.reads : []);
    const inB = idx >= nA;
    for (let u = 0; u < built.n; u++) {
      const cx = px(u), cy = py(u), r = 17;
      const isActive = cur && cur.node === u && cur.phase !== 'rootA';
      const isRead = reads.has(u);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? COLORS.active : (ansKnown(u) && inB) ? 'rgba(16,185,129,0.18)' : 'rgba(128,128,128,0.08)';
      ctx.fill();
      ctx.lineWidth = isRead ? 3.5 : 2;
      ctx.strokeStyle = isRead ? COLORS.read : isActive ? COLORS.active : 'rgba(128,128,128,0.5)';
      ctx.stroke();
      ctx.fillStyle = isActive ? '#fff' : '#888';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(u), cx, cy);

      // labels: phase A shows down/size, phase B shows ans
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      if (inB && ansKnown(u)) {
        ctx.fillStyle = COLORS.done;
        ctx.fillText(`ans=${built.ans[u]}`, cx, cy + r + 11);
      } else if (downKnown(u)) {
        ctx.fillStyle = COLORS.read;
        ctx.fillText(`s=${built.size[u]} d=${built.down[u]}`, cx, cy + r + 11);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.max(260, Math.round(w * 0.56));
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

  useEffect(draw, [idx, edges]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total) { setIdx(total - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, edges, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const phaseLabel = idx < nA ? 'Phase A — bubble up (post-order)' : 'Phase B — reroot (pre-order)';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="edges, e.g. 0-1,0-2,1-3" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load tree</button>
      </div>

      <div class="mb-2 text-xs font-semibold uppercase tracking-wide" style={`color:${idx < nA ? COLORS.read : COLORS.done}`}>{phaseLabel}</div>
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{cur ? cur.caption : 'Press Play to fold subtree values up, then reroot to every node.'}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-auto font-mono text-xs text-muted">{Math.min(idx + 1, total)}/{total}</span>
        <label class="flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Node 0 is the root. <span style={`color:${COLORS.active}`}>■</span> active &nbsp; <span style={`color:${COLORS.read}`}>■</span> state it reads &nbsp; <span style={`color:${COLORS.done}`}>■</span> final ans[v].</p>
    </div>
  );
}
