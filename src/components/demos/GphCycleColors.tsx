import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Three-colour DFS cycle detection on a DIRECTED graph.
   - Edit the directed edge list (comma-separated "A-B" meaning A→B).
   - Precompute FRAMES of the DFS: each frame paints a node WHITE/GRAY/
     BLACK and highlights the edge being followed. A back edge to a GRAY
     node flashes RED and stops with "Cycle found!". A clean run ends in
     emerald with "No cycle — this is a DAG".
   - Transport: Back / Play-Pause / Step / Reset + speed. Index-driven,
     raf + cancelAnimationFrame.
   ------------------------------------------------------------------ */

const WHITE = 0, GRAY = 1, BLACK = 2;

const COLORS = {
  white: '#94a3b8', // unseen (grey)
  gray: '#0ea5e9',  // on current DFS path (sky)
  black: '#4f46e5', // finished (indigo)
  edge: '#cbd5e1',
  cur: '#0ea5e9',
  back: '#e11d48',  // back edge / cycle (rose)
  dag: '#10b981',   // emerald
};

type E = [string, string];
type Frame = {
  color: Record<string, number>;
  edge: E | null;     // edge currently being followed
  back: boolean;      // is this edge a back edge (cycle)?
  caption: string;
};

export default function GphCycleColors() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('A-B, B-C, C-A, A-D');
  const [edges, setEdges] = useState<E[]>(() => parseEdges('A-B, B-C, C-A, A-D'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // nodes in sorted order
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const [u, v] of edges) { if (!seen.includes(u)) seen.push(u); if (!seen.includes(v)) seen.push(v); }
    return seen.sort();
  })();

  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<string, { x: number; y: number }>();
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
    nodes.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, nodes.length);
      m.set(id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    });
    return m;
  })();

  // Precompute the frames of the three-colour DFS.
  const frames: Frame[] = (() => {
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n, []));
    for (const [u, v] of edges) adj.get(u)!.push(v);

    const color: Record<string, number> = {};
    nodes.forEach((n) => (color[n] = WHITE));
    const out: Frame[] = [];
    out.push({ color: { ...color }, edge: null, back: false, caption: 'All nodes WHITE (unseen). Press Play to run the DFS.' });
    let cycle = false;

    function dfs(v: string): boolean {
      color[v] = GRAY;
      out.push({ color: { ...color }, edge: null, back: false, caption: `Visit ${v} → paint it GRAY (on the current path).` });
      for (const n of adj.get(v)!) {
        if (color[n] === GRAY) {
          out.push({ color: { ...color }, edge: [v, n], back: true, caption: `Edge ${v}→${n} points to a GRAY node → back edge → cycle!` });
          return true;
        }
        if (color[n] === WHITE) {
          out.push({ color: { ...color }, edge: [v, n], back: false, caption: `Follow edge ${v}→${n} to a WHITE node — descend into ${n}.` });
          if (dfs(n)) return true;
        } else {
          out.push({ color: { ...color }, edge: [v, n], back: false, caption: `Edge ${v}→${n} reaches a BLACK node (already finished) — safe, skip it.` });
        }
      }
      color[v] = BLACK;
      out.push({ color: { ...color }, edge: null, back: false, caption: `${v} has no more edges → paint it BLACK (done).` });
      return false;
    }

    for (const v of nodes) {
      if (color[v] === WHITE && dfs(v)) { cycle = true; break; }
    }
    if (cycle) out.push({ color: { ...color }, edge: out[out.length - 1].edge, back: true, caption: 'Cycle found! A GRAY neighbour means we looped back onto the current path.' });
    else out.push({ color: { ...color }, edge: null, back: false, caption: 'No cycle — this is a DAG. Every edge led to WHITE or BLACK nodes only.' });
    return out;
  })();

  const lastIdx = frames.length - 1;
  const frame = frames[Math.min(idx, lastIdx)];

  const commit = () => { const p = parseEdges(text); if (p.length) { setEdges(p); setIdx(0); setPlaying(false); } };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frame;

    // edges
    for (const [u, v] of edges) {
      const a = pos.get(u)!, b = pos.get(v)!;
      const isCur = f.edge && f.edge[0] === u && f.edge[1] === v;
      const col = isCur ? (f.back ? COLORS.back : COLORS.cur) : COLORS.edge;
      ctx.strokeStyle = col;
      ctx.lineWidth = isCur ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      drawArrow(ctx, a, b, col);
    }

    // nodes
    for (const n of nodes) {
      const p = pos.get(n)!;
      const c = f.color[n];
      const fill = c === GRAY ? COLORS.gray : c === BLACK ? COLORS.black : COLORS.white;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);
    }
  };

  function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const tx = b.x - 17 * Math.cos(ang), ty = b.y - 17 * Math.sin(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - 10 * Math.cos(ang - 0.4), ty - 10 * Math.sin(ang - 0.4));
    ctx.lineTo(tx - 10 * Math.cos(ang + 0.4), ty - 10 * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = 320;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, edges]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > lastIdx) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, edges, lastIdx]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(lastIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= lastIdx) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const finished = idx >= lastIdx;
  const isCycle = frames[lastIdx].back;
  const captionColor = finished ? (isCycle ? COLORS.back : COLORS.dag) : COLORS.cur;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B, B-C, ... (directed A→B)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Colour legend</div>
            <div class="space-y-1.5 rounded-lg bg-surface-2 p-2 text-xs">
              <div class="flex items-center gap-2"><span class="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.white }} /><strong>WHITE</strong> — not visited yet</div>
              <div class="flex items-center gap-2"><span class="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.gray }} /><strong>GRAY</strong> — on the current DFS path</div>
              <div class="flex items-center gap-2"><span class="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.black }} /><strong>BLACK</strong> — fully explored, done</div>
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            An edge from a GRAY node back to another <strong>GRAY</strong> node is a <strong>back edge</strong> — it
            closes a loop on the path you are still walking. That is exactly a cycle.
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg px-3 py-2 text-sm font-medium" style={{ color: captionColor, background: 'var(--surface-2, #f1f5f9)' }}>{frame.caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step {Math.min(idx, lastIdx)} / {lastIdx}.</p>
    </div>
  );
}

function parseEdges(s: string): [string, string][] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [u, v] = p.split('-').map((x) => x.trim());
    return [u, v] as [string, string];
  }).filter(([u, v]) => u && v);
}
