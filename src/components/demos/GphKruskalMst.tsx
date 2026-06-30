import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Kruskal's minimum spanning tree, built edge by edge.
   - Edit the weighted edge list ("A-B:4, B-C:3, ..."). Undirected.
   - We sort the edges cheapest-first and walk them: each step ADDS the
     edge if it joins two different components (emerald) or SKIPS it if
     both endpoints are already connected (rose dashed = would make a cycle).
   - Nodes are coloured by their Union-Find component, so you watch the
     forest of singletons merge into one tree. Running total weight and the
     edge count toward V-1 are shown live.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = {
  cur: '#0ea5e9',     // sky — the edge under consideration
  add: '#10b981',     // emerald — an MST edge
  skip: '#f43f5e',    // rose — a skipped (cycle) edge
  edge: '#94a3b8',    // grey — not yet considered
};

// palette for Union-Find components (one colour per root)
const COMP = ['#4f46e5', '#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#ec4899'];

type WEdge = { u: string; v: string; w: number };
type Frame = {
  considered: number;            // index into sorted of the edge just looked at (-1 = start)
  decision: 'init' | 'add' | 'skip' | 'done';
  mst: Set<number>;              // sorted-indices kept in the tree
  skipped: Set<number>;          // sorted-indices rejected as cycles
  comp: Map<string, string>;     // node -> component root (after this step)
  total: number;                 // running total weight
  added: number;                 // edges in the tree so far
  caption: string;
};

function buildFrames(edges: WEdge[], nodes: string[]): { sorted: WEdge[]; frames: Frame[] } {
  const sorted = [...edges].sort((a, b) => a.w - b.w);
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  nodes.forEach((n) => { parent.set(n, n); rank.set(n, 0); });
  const find = (x: string): string => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
    return x;
  };
  const snapshot = () => new Map(nodes.map((n) => [n, find(n)]));

  const mst = new Set<number>();
  const skipped = new Set<number>();
  let total = 0;
  const frames: Frame[] = [{
    considered: -1, decision: 'init', mst: new Set(), skipped: new Set(),
    comp: snapshot(), total: 0, added: 0,
    caption: 'Edges sorted cheapest-first. Press Play to grow the tree one edge at a time.',
  }];

  const need = Math.max(0, nodes.length - 1);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const ru = find(e.u), rv = find(e.v);
    let decision: Frame['decision'];
    if (ru !== rv) {
      // union by rank
      if (rank.get(ru)! < rank.get(rv)!) parent.set(ru, rv);
      else if (rank.get(ru)! > rank.get(rv)!) parent.set(rv, ru);
      else { parent.set(rv, ru); rank.set(ru, rank.get(ru)! + 1); }
      mst.add(i); total += e.w; decision = 'add';
    } else {
      skipped.add(i); decision = 'skip';
    }
    const added = mst.size;
    const complete = added === need;
    frames.push({
      considered: i, decision: complete ? 'done' : decision,
      mst: new Set(mst), skipped: new Set(skipped), comp: snapshot(),
      total, added,
      caption: decision === 'add'
        ? (complete
            ? `Add ${e.u}-${e.v} (${e.w}) — that is V-1 edges, the spanning tree is complete. Total weight ${total}.`
            : `Add ${e.u}-${e.v} (${e.w}): it joins two different components.`)
        : `Skip ${e.u}-${e.v} (${e.w}): ${e.u} and ${e.v} are already connected → it would form a cycle.`,
    });
    if (complete) break;
  }
  return { sorted, frames };
}

export default function GphKruskalMst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const DEFAULT = 'A-B:4, A-C:2, B-C:3, B-D:5, C-D:8, C-E:10, D-E:7';
  const [text, setText] = useState(DEFAULT);
  const [edges, setEdges] = useState<WEdge[]>(() => parseEdges(DEFAULT));
  const [idx, setIdx] = useState(0); // current frame index
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // nodes in sorted order
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const { u, v } of edges) { if (!seen.includes(u)) seen.push(u); if (!seen.includes(v)) seen.push(v); }
    return seen.sort();
  })();

  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<string, { x: number; y: number }>();
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
    nodes.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, nodes.length);
      m.set(id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    });
    return m;
  })();

  const { sorted, frames } = buildFrames(edges, nodes);
  const last = frames.length - 1;
  const clampedIdx = Math.min(idx, last);
  const frame = frames[clampedIdx];
  const need = Math.max(0, nodes.length - 1);

  // colour each node by its component root
  const rootColor = new Map<string, string>();
  {
    let next = 0;
    for (const n of nodes) {
      const root = frame.comp.get(n)!;
      if (!rootColor.has(root)) rootColor.set(root, COMP[next++ % COMP.length]);
    }
  }

  const commit = () => { const p = parseEdges(text); if (p.length) { setEdges(p); setIdx(0); setPlaying(false); } };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // edges (drawn from the sorted list so colour reflects their MST state)
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const a = pos.get(e.u)!, b = pos.get(e.v)!;
      const isCur = i === frame.considered;
      let color = COLORS.edge, lw = 2; let dashed = false;
      if (isCur) {
        if (frame.decision === 'skip') { color = COLORS.skip; lw = 3.5; dashed = true; }
        else { color = COLORS.cur; lw = 4; }
      } else if (frame.mst.has(i)) { color = COLORS.add; lw = 3; }
      else if (frame.skipped.has(i)) { color = COLORS.skip; lw = 1.5; dashed = true; }

      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.setLineDash(dashed ? [6, 5] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();

      // weight label at the midpoint
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const label = String(e.w);
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = 0.85;
      roundRect(ctx, mx - tw / 2 - 4, my - 9, tw + 8, 18, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = isCur ? '#e0f2fe' : '#cbd5e1';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    }

    // nodes (filled by component colour)
    for (const n of nodes) {
      const p = pos.get(n)!;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = rootColor.get(frame.comp.get(n)!)!;
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);
    }
  };

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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
        if (next > last) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, edges, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (clampedIdx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const chipClass = (i: number) => {
    if (i === frame.considered) return 'bg-[#0ea5e9] text-white';
    if (frame.mst.has(i)) return 'bg-[#10b981] text-white';
    if (frame.skipped.has(i)) return 'bg-[#f43f5e]/15 text-[#f43f5e] line-through';
    return 'bg-surface-2 text-muted';
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B:4, B-C:3, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Sorted edges (cheapest first)</div>
            <div class="flex flex-wrap gap-1.5">
              {sorted.map((e, i) => (
                <span key={`${e.u}-${e.v}`} class={`rounded-md px-2 py-1 font-mono text-xs font-semibold ${chipClass(i)}`}>
                  {e.u}-{e.v} {e.w}
                </span>
              ))}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted text-xs">total weight</span>
              <div class="font-mono font-semibold text-[#10b981]">{frame.total}</div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted text-xs">edges in tree</span>
              <div class="font-mono font-semibold">{frame.added} / {need}</div>
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Node colour = its <strong class="text-text">Union-Find component</strong>. Watch the separate
            colours merge into one as edges join the tree.
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step {clampedIdx} / {last} · considering edges cheapest-first.</p>
    </div>
  );
}

function parseEdges(s: string): WEdge[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [pair, wStr] = p.split(':').map((x) => x.trim());
    const [u, v] = pair.split('-').map((x) => x.trim());
    const w = wStr != null && wStr !== '' && !Number.isNaN(parseFloat(wStr)) ? parseFloat(wStr) : 1;
    return { u, v, w } as WEdge;
  }).filter((e) => e.u && e.v);
}
