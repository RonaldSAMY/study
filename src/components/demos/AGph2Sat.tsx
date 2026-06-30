import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   2-SAT via implication graph + strongly connected components, animated.
   - Each clause (a ∨ b) becomes two implications ¬a → b and ¬b → a. Run
     Tarjan to find SCCs. If a variable's literal x and ¬x land in the SAME
     component, the formula is UNSATISFIABLE. Otherwise pick, for each
     variable, the literal whose component is later in topological order.
   - Frames are precomputed by instrumenting Tarjan + the SAT check.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
   ------------------------------------------------------------------ */

type Clause = [number, boolean, number, boolean]; // (x_i^ip ∨ x_j^jp)
type Frame = {
  disc: number[];
  low: number[];
  comp: number[];
  stack: number[];
  active: number;
  edge: [number, number] | null;
  chosen: number[];
  conflict: number[];
  caption: string;
};

const SCC_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
const ACTIVE = '#4f46e5';
const CONFLICT = '#ef4444';

const PRESETS: { name: string; n: number; clauses: Clause[] }[] = [
  { name: 'Satisfiable (3 vars)', n: 3, clauses: [[0, true, 1, true], [0, false, 2, true], [1, false, 2, false]] },
  { name: 'Unsatisfiable (2 vars)', n: 2, clauses: [[0, true, 1, true], [0, true, 1, false], [0, false, 1, true], [0, false, 1, false]] },
  { name: 'Contradiction (1 var)', n: 1, clauses: [[0, true, 0, true], [0, false, 0, false]] },
];

const toLit = (i: number, pos: boolean) => 2 * i + (pos ? 0 : 1);
const neg = (l: number) => l ^ 1;
const litLabel = (l: number) => (l % 2 === 0 ? `x${l / 2}` : `¬x${(l - 1) / 2}`);

function buildFrames(n: number, clauses: Clause[]): Frame[] {
  const size = 2 * n;
  const adj: number[][] = Array.from({ length: size }, () => []);
  for (const [i, ip, j, jp] of clauses) {
    const a = toLit(i, ip), b = toLit(j, jp);
    adj[neg(a)].push(b);
    adj[neg(b)].push(a);
  }
  const disc = Array(size).fill(-1);
  const low = Array(size).fill(-1);
  const comp = Array(size).fill(-1);
  const onStack = Array(size).fill(false);
  const stack: number[] = [];
  let time = 0, sccCount = 0;
  const frames: Frame[] = [];
  let chosen: number[] = [];
  let conflict: number[] = [];
  const snap = (active: number, edge: [number, number] | null, caption: string) =>
    frames.push({ disc: [...disc], low: [...low], comp: [...comp], stack: [...stack], active, edge, chosen: [...chosen], conflict: [...conflict], caption });

  snap(-1, null, 'Turn every clause (a ∨ b) into implications ¬a → b and ¬b → a, then find SCCs with Tarjan.');

  const dfs = (u: number) => {
    disc[u] = low[u] = time++;
    stack.push(u);
    onStack[u] = true;
    snap(u, null, `Visit literal ${litLabel(u)}: disc = low = ${disc[u]}.`);
    for (const v of adj[u]) {
      if (disc[v] === -1) {
        snap(u, [u, v], `Implication ${litLabel(u)} → ${litLabel(v)}: recurse into ${litLabel(v)}.`);
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (onStack[v]) {
        low[u] = Math.min(low[u], disc[v]);
        snap(u, [u, v], `Back edge to ${litLabel(v)} (on stack): low[${litLabel(u)}] = ${low[u]}.`);
      }
    }
    if (low[u] === disc[u]) {
      const members: number[] = [];
      let w: number;
      do { w = stack.pop()!; onStack[w] = false; comp[w] = sccCount; members.push(w); } while (w !== u);
      sccCount++;
      snap(u, null, `${litLabel(u)} roots an SCC: {${members.map(litLabel).join(', ')}}.`);
    }
  };
  for (let i = 0; i < size; i++) if (disc[i] === -1) dfs(i);

  let sat = true;
  for (let i = 0; i < n; i++) {
    const p = toLit(i, true), q = toLit(i, false);
    if (comp[p] === comp[q]) {
      sat = false;
      conflict = [p, q];
      snap(-1, null, `x${i} and ¬x${i} share one SCC → they imply each other. UNSATISFIABLE.`);
      break;
    }
    // smaller Tarjan id = later in topological order = the literal we set true
    const pick = comp[p] < comp[q] ? p : q;
    chosen = [...chosen, pick];
    snap(-1, null, `x${i}: literals are in different SCCs. Set ${litLabel(pick)} = true.`);
  }
  if (sat) snap(-1, null, `Every variable is split across SCCs → SATISFIABLE. Chosen literals are circled green.`);
  return frames;
}

function buildNodes(n: number) {
  const nodes: { id: number; x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    nodes.push({ id: toLit(i, true), x, y: 0.22 });
    nodes.push({ id: toLit(i, false), x, y: 0.78 });
  }
  return nodes;
}

export default function AGph2Sat() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 540, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [preset, setPreset] = useState(0);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { n, clauses } = PRESETS[preset];
  const frames = useMemo(() => buildFrames(n, clauses), [preset]);
  const nodes = useMemo(() => buildNodes(n), [preset]);
  const edges = useMemo(() => {
    const out: [number, number][] = [];
    for (const [i, ip, j, jp] of clauses) {
      const a = toLit(i, ip), b = toLit(j, jp);
      out.push([neg(a), b]);
      out.push([neg(b), a]);
    }
    return out;
  }, [preset]);
  const posOf = useMemo(() => {
    const m = new Map<number, { x: number; y: number }>();
    for (const nd of nodes) m.set(nd.id, { x: nd.x, y: nd.y });
    return m;
  }, [preset]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => { setIdx(0); setPlaying(false); }, [preset]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 44;
    const px = (x: number) => pad + x * (w - 2 * pad);
    const py = (y: number) => pad + y * (h - 2 * pad);
    const R = 20;

    edges.forEach(([u, v], k) => {
      const a = posOf.get(u)!, b = posOf.get(v)!;
      const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      // small perpendicular offset so opposite implications don't overlap
      const off = 6 * (k % 2 === 0 ? 1 : -1);
      const ox = -Math.sin(ang) * off, oy = Math.cos(ang) * off;
      const sx = x1 + Math.cos(ang) * R + ox, sy = y1 + Math.sin(ang) * R + oy;
      const ex = x2 - Math.cos(ang) * R + ox, ey = y2 - Math.sin(ang) * R + oy;
      const hot = frame.edge && frame.edge[0] === u && frame.edge[1] === v;
      ctx.strokeStyle = hot ? ACTIVE : 'rgba(128,128,128,0.40)';
      ctx.lineWidth = hot ? 3.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.4) * 10, ey - Math.sin(ang - 0.4) * 10);
      ctx.lineTo(ex - Math.cos(ang + 0.4) * 10, ey - Math.sin(ang + 0.4) * 10);
      ctx.closePath();
      ctx.fillStyle = hot ? ACTIVE : 'rgba(128,128,128,0.40)';
      ctx.fill();
    });

    for (const nd of nodes) {
      const x = px(nd.x), y = py(nd.y);
      const c = frame.comp[nd.id];
      let fill = '#1f2937';
      if (c >= 0) fill = SCC_COLORS[c % SCC_COLORS.length];
      else if (nd.id === frame.active) fill = ACTIVE;
      else if (frame.disc[nd.id] >= 0) fill = '#475569';
      const inConflict = frame.conflict.includes(nd.id);
      const isChosen = frame.chosen.includes(nd.id);
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = inConflict ? 4.5 : isChosen ? 4 : nd.id === frame.active ? 3.5 : 2;
      ctx.strokeStyle = inConflict ? CONFLICT : isChosen ? '#10b981' : nd.id === frame.active ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(litLabel(nd.id), x, y);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.6);
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

  useEffect(draw, [idx, preset]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
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
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPreset(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${preset === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
          >
            {p.name}
          </button>
        ))}
        <span class="ml-auto text-xs text-muted">step {idx + 1}/{frames.length}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[4rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{frame.caption}</p>
          <div class="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
            <div class="text-muted">clauses</div>
            <div class="mt-1 text-text">
              {clauses.map(([i, ip, j, jp], k) => (
                <span key={k} class="mr-1">({ip ? `x${i}` : `¬x${i}`} ∨ {jp ? `x${j}` : `¬x${j}`}){k < clauses.length - 1 ? ' ∧' : ''}</span>
              ))}
            </div>
          </div>
          <p class="text-xs text-muted">Top row is positive literals, bottom row their negations. Same colour = same SCC.</p>
        </div>
      </div>

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
