import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Build a graph's representations edge by edge.
   - Edit the edge list (comma-separated "A-B"). Toggle directed.
   - Step through the edges: each step draws the new edge and fills in
     the adjacency list AND the adjacency matrix, with a live caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { node: '#4f46e5', edge: '#94a3b8', cur: '#0ea5e9', done: '#10b981' };

type E = [string, string];

export default function GphRepresentationBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('A-B, A-C, B-D, C-D, D-E');
  const [directed, setDirected] = useState(false);
  const [edges, setEdges] = useState<E[]>(() => parseEdges('A-B, A-C, B-D, C-D, D-E'));
  const [idx, setIdx] = useState(0); // 0..edges.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  function parseEdgesLocal(s: string): E[] {
    return parseEdges(s);
  }

  // nodes in first-seen order
  const nodes: string[] = (() => {
    const seen: string[] = [];
    for (const [u, v] of edges) { if (!seen.includes(u)) seen.push(u); if (!seen.includes(v)) seen.push(v); }
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

  // adjacency list + matrix after first `idx` edges
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n, []));
  const matrix = nodes.map(() => nodes.map(() => 0));
  const ni = new Map(nodes.map((n, i) => [n, i]));
  for (let k = 0; k < idx; k++) {
    const [u, v] = edges[k];
    adj.get(u)!.push(v);
    matrix[ni.get(u)!][ni.get(v)!] = 1;
    if (!directed) { adj.get(v)!.push(u); matrix[ni.get(v)!][ni.get(u)!] = 1; }
  }

  const commit = () => { const p = parseEdgesLocal(text); if (p.length) { setEdges(p); setIdx(0); setPlaying(false); } };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cur = idx > 0 ? edges[idx - 1] : null;

    // edges drawn so far
    for (let k = 0; k < idx; k++) {
      const [u, v] = edges[k];
      const a = pos.get(u)!, b = pos.get(v)!;
      const isCur = cur && k === idx - 1;
      ctx.strokeStyle = isCur ? COLORS.cur : COLORS.edge;
      ctx.lineWidth = isCur ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (directed) drawArrow(ctx, a, b, isCur ? COLORS.cur : COLORS.edge);
    }

    // nodes
    for (const n of nodes) {
      const p = pos.get(n)!;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      const touched = cur && (n === cur[0] || n === cur[1]);
      ctx.fillStyle = touched ? COLORS.cur : COLORS.node;
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, p.x, p.y);
    }
  };

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

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = 300;
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
  useEffect(draw, [idx, edges, directed]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > edges.length) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, edges]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(edges.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= edges.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const caption = idx === 0
    ? 'Empty structures. Press Play to add edges one at a time.'
    : `Add edge ${edges[idx - 1][0]}${directed ? '→' : '—'}${edges[idx - 1][1]}: ${directed
        ? `append ${edges[idx - 1][1]} to ${edges[idx - 1][0]}'s list; set matrix[${edges[idx - 1][0]}][${edges[idx - 1][1]}]=1.`
        : `append both ways; set matrix symmetric.`}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A-B, B-C, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={directed} onInput={(e) => { setDirected((e.target as HTMLInputElement).checked); setIdx(0); setPlaying(false); }} class="h-4 w-4 accent-[#4f46e5]" />directed</label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Adjacency list — O(V+E) space</div>
            <div class="space-y-0.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {nodes.map((n) => (<div key={n}><span class="text-brand font-bold">{n}</span>: [{adj.get(n)!.join(', ')}]</div>))}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Adjacency matrix — O(V²) space</div>
            <div class="overflow-x-auto rounded-lg bg-surface-2 p-2 font-mono text-xs">
              <table>
                <thead><tr><td></td>{nodes.map((n) => (<td key={n} class="px-1 text-center text-brand font-bold">{n}</td>))}</tr></thead>
                <tbody>{nodes.map((r, i) => (<tr key={r}><td class="pr-1 text-brand font-bold">{r}</td>{nodes.map((c, j) => (<td key={c} class={`px-1 text-center ${matrix[i][j] ? 'text-text font-bold' : 'text-muted'}`}>{matrix[i][j]}</td>))}</tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step {idx} / {edges.length} edges added.</p>
    </div>
  );
}

function parseEdges(s: string): [string, string][] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [u, v] = p.split('-').map((x) => x.trim());
    return [u, v] as [string, string];
  }).filter(([u, v]) => u && v);
}
