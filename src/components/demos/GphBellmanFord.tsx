import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Bellman-Ford, edge by edge.
   - Edit a DIRECTED, WEIGHTED graph as "A-B:4, B-C:-3, ..." (negative
     weights allowed) and pick a source.
   - We precompute FRAMES: the outer loop is the pass number (1..V-1),
     the inner loop walks the edges one at a time. Each frame highlights
     the current edge (sky) and shows whether it relaxes (flash the
     target node emerald) or does nothing. A final "check" pass that
     still relaxes flashes rose: a negative cycle.
   - Transport: Back / Play / Pause / Step / Reset + speed. Index-driven,
     raf + cancelAnimationFrame.
   ------------------------------------------------------------------ */

const COLORS = {
  node: '#4f46e5',
  edge: '#94a3b8',
  cur: '#0ea5e9',
  done: '#10b981',
  neg: '#f43f5e',
};

type Edge = { from: string; to: string; weight: number };
type Frame = {
  dist: number[];
  cur: number | null;
  flash: { node: number; color: 'done' | 'neg' } | null;
  pass: number;
  caption: string;
};

const DEFAULT = 'A-B:4, A-C:5, B-C:-3, B-D:6, C-D:2, C-E:4, D-E:1';

export default function GphBellmanFord() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState(DEFAULT);
  const [edges, setEdges] = useState<Edge[]>(() => parseEdges(DEFAULT));
  const [source, setSource] = useState('A');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // nodes in sorted order
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const e of edges) { if (!seen.includes(e.from)) seen.push(e.from); if (!seen.includes(e.to)) seen.push(e.to); }
    return seen.sort();
  })();
  const src = nodes.includes(source) ? source : nodes[0] ?? '';

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

  const frames = buildFrames(nodes, edges, src);
  const clamped = Math.min(idx, frames.length - 1);
  const frame = frames[clamped] ?? frames[0];

  const commit = () => {
    const p = parseEdges(text);
    if (p.length) { setEdges(p); setIdx(0); lastRef.current = 0; setPlaying(false); }
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frame;
    const ni = new Map(nodes.map((n, i) => [n, i]));

    // edges
    edges.forEach((e, k) => {
      const a = pos.get(e.from)!, b = pos.get(e.to)!;
      const isCur = f.cur === k;
      ctx.strokeStyle = isCur ? COLORS.cur : COLORS.edge;
      ctx.lineWidth = isCur ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      drawArrow(ctx, a, b, isCur ? COLORS.cur : COLORS.edge);
      // weight label, nudged perpendicular to the edge
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const off = 12;
      const lx = mx - off * Math.sin(ang), ly = my + off * Math.cos(ang);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = isCur ? COLORS.cur : '#64748b';
      ctx.fillText(`${e.weight}`, lx, ly);
    });

    // nodes + distance labels
    nodes.forEach((n, i) => {
      const p = pos.get(n)!;
      let fill = COLORS.node;
      if (f.flash && f.flash.node === i) fill = f.flash.color === 'neg' ? COLORS.neg : COLORS.done;
      else if (n === src) fill = COLORS.node;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);
      // distance badge below the node
      const d = f.dist[i];
      const label = d === Infinity ? '∞' : `${d}`;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(label, p.x, p.y + 26);
    });
    void ni;
  };

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
  useEffect(draw, [idx, edges, source]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > frames.length - 1) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, edges, source]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const passText = frame.pass === 0 ? '—' : frame.pass >= nodes.length ? 'check' : `${frame.pass}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B:4, B-C:-3, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-2 text-sm">source
          <select value={src} onInput={(e) => { setSource((e.target as HTMLSelectElement).value); setIdx(0); lastRef.current = 0; setPlaying(false); }} class="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm">
            {nodes.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Distance from {src} — pass {passText}</div>
            <div class="space-y-0.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {nodes.map((n, i) => (
                <div key={n} class="flex justify-between">
                  <span class="text-brand font-bold">{n}{n === src ? ' (src)' : ''}</span>
                  <span class={frame.dist[i] === Infinity ? 'text-muted' : 'text-text font-bold'}>{frame.dist[i] === Infinity ? '∞' : frame.dist[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The sky edge is the one being relaxed right now. A node flashing
            <span class="font-semibold" style="color:#10b981"> emerald</span> just got a shorter distance; a
            <span class="font-semibold" style="color:#f43f5e"> rose</span> flash on the check pass means a negative cycle.
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
      <p class="mt-2 text-center text-xs text-muted">Frame {clamped} / {frames.length - 1}.</p>
    </div>
  );
}

function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const tx = b.x - 16 * Math.cos(ang), ty = b.y - 16 * Math.sin(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 9 * Math.cos(ang - 0.4), ty - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 9 * Math.cos(ang + 0.4), ty - 9 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

// Precompute every step of Bellman-Ford as an array of frames.
function buildFrames(nodes: string[], edges: Edge[], source: string): Frame[] {
  const n = nodes.length;
  const frames: Frame[] = [];
  if (n === 0) return [{ dist: [], cur: null, flash: null, pass: 0, caption: 'Add some edges to begin.' }];
  const idx = new Map(nodes.map((x, i) => [x, i]));
  const dist = nodes.map((x) => (x === source ? 0 : Infinity));
  const fmt = (d: number) => (d === Infinity ? '∞' : `${d}`);

  frames.push({ dist: [...dist], cur: null, flash: null, pass: 0, caption: `Start: dist[${source}] = 0, every other node is ∞.` });

  let early = false;
  for (let pass = 1; pass <= n - 1 && !early; pass++) {
    let updated = false;
    for (let e = 0; e < edges.length; e++) {
      const { from, to, weight } = edges[e];
      const u = idx.get(from)!, v = idx.get(to)!;
      const du = dist[u];
      const relaxes = du !== Infinity && du + weight < dist[v];
      if (relaxes) {
        const before = dist[v];
        dist[v] = du + weight;
        updated = true;
        frames.push({
          dist: [...dist], cur: e, flash: { node: v, color: 'done' }, pass,
          caption: `Pass ${pass}, edge ${from}→${to} (${weight}): ${fmt(du)} + (${weight}) = ${du + weight} < ${fmt(before)} → dist[${to}] = ${du + weight}.`,
        });
      } else {
        frames.push({
          dist: [...dist], cur: e, flash: null, pass,
          caption: `Pass ${pass}, edge ${from}→${to} (${weight}): no improvement.`,
        });
      }
    }
    if (!updated) {
      early = true;
      frames.push({ dist: [...dist], cur: null, flash: null, pass, caption: `Pass ${pass} made no changes — done early.` });
    }
  }

  // Check pass: any edge that still relaxes proves a negative cycle.
  let neg = false;
  for (let e = 0; e < edges.length && !neg; e++) {
    const { from, to, weight } = edges[e];
    const u = idx.get(from)!, v = idx.get(to)!;
    const du = dist[u];
    if (du !== Infinity && du + weight < dist[v]) {
      neg = true;
      frames.push({
        dist: [...dist], cur: e, flash: { node: v, color: 'neg' }, pass: n,
        caption: `Check pass: edge ${from}→${to} still relaxes — Negative cycle detected!`,
      });
    }
  }
  if (!neg) {
    frames.push({ dist: [...dist], cur: null, flash: null, pass: n, caption: `Check pass: nothing relaxes — no negative cycle. These distances are final.` });
  }
  return frames;
}

function parseEdges(s: string): Edge[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [pair, wStr] = p.split(':');
    const [u, v] = (pair ?? '').split('-').map((x) => x.trim());
    const w = Number((wStr ?? '1').trim());
    return { from: u, to: v, weight: Number.isFinite(w) ? w : 1 };
  }).filter((e) => e.from && e.to);
}
