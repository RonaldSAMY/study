import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Bipartite matching via Kuhn's augmenting-path algorithm, animated.
   - Left vertices try to claim a right vertex in turn. If a right vertex is
     taken, we recurse to re-home its current partner along an alternating
     path. Finding a free right vertex means the whole path flips, growing
     the matching by one.
   - Frames are precomputed by instrumenting Kuhn's DFS, then replayed.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
   ------------------------------------------------------------------ */

type Edge = [number, number]; // [left, right]
type Frame = {
  match: number[]; // match[right] = left, or -1
  activeLeft: number;
  tryEdge: Edge | null;
  pathEdges: Edge[];
  caption: string;
};

const ACTIVE = '#4f46e5';
const MATCHED = '#10b981';
const PATH = '#0ea5e9';

const PRESETS: { name: string; left: number; right: number; edges: Edge[] }[] = [
  { name: 'Workers & jobs', left: 3, right: 3, edges: [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [2, 2]] },
  { name: 'Needs re-routing', left: 3, right: 2, edges: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: 'Bottleneck', left: 3, right: 3, edges: [[0, 0], [1, 0], [2, 0], [2, 2]] },
];

function buildFrames(left: number, right: number, edges: Edge[]): Frame[] {
  const adj: number[][] = Array.from({ length: left }, () => []);
  for (const [l, r] of edges) adj[l].push(r);
  const match = Array(right).fill(-1);
  let visited = Array(right).fill(false);
  const frames: Frame[] = [];
  const snap = (activeLeft: number, tryEdge: Edge | null, pathEdges: Edge[], caption: string) =>
    frames.push({ match: [...match], activeLeft, tryEdge, pathEdges: pathEdges.map((e) => [...e] as Edge), caption });

  snap(-1, null, [], 'Process left vertices one by one, each searching for an augmenting path.');

  const augment = (l: number, chain: Edge[]): boolean => {
    for (const r of adj[l]) {
      if (visited[r]) {
        snap(l, [l, r], chain, `Right ${r} was already explored in this search — skip it.`);
        continue;
      }
      visited[r] = true;
      const newChain = chain.concat([[l, r]]);
      if (match[r] === -1) {
        snap(l, [l, r], newChain, `Right ${r} is FREE → take edge L${l}–R${r}. The path flips and the matching grows.`);
        match[r] = l;
        return true;
      }
      const cur = match[r];
      snap(l, [l, r], newChain, `Right ${r} is held by L${cur}. Recurse to find L${cur} another partner.`);
      if (augment(cur, newChain)) {
        match[r] = l;
        return true;
      }
    }
    return false;
  };

  for (let l = 0; l < left; l++) {
    visited = Array(right).fill(false);
    snap(l, null, [], `Left ${l}: start a fresh search for an augmenting path.`);
    const ok = augment(l, []);
    const size = match.filter((m) => m !== -1).length;
    snap(l, null, [], ok ? `Left ${l} matched. Matching size is now ${size}.` : `No augmenting path for left ${l} — it stays unmatched (size ${size}).`);
  }
  const size = match.filter((m) => m !== -1).length;
  snap(-1, null, [], `Maximum matching has ${size} edge${size === 1 ? '' : 's'}.`);
  return frames;
}

export default function AGphBipartiteMatching() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 540, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [preset, setPreset] = useState(0);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const { left, right, edges } = PRESETS[preset];
  const frames = useMemo(() => buildFrames(left, right, edges), [preset]);
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
    const R = 20;
    const lx = pad + R;
    const rx = w - pad - R;
    const ly = (i: number) => pad + ((h - 2 * pad) * (i + 0.5)) / left;
    const ry = (i: number) => pad + ((h - 2 * pad) * (i + 0.5)) / right;

    const inPath = (l: number, r: number) => frame.pathEdges.some((e) => e[0] === l && e[1] === r);
    const isMatched = (l: number, r: number) => frame.match[r] === l;

    for (const [l, r] of edges) {
      const x1 = lx, y1 = ly(l), x2 = rx, y2 = ry(r);
      const matched = isMatched(l, r);
      const path = inPath(l, r);
      const hot = frame.tryEdge && frame.tryEdge[0] === l && frame.tryEdge[1] === r;
      ctx.strokeStyle = hot ? ACTIVE : matched ? MATCHED : path ? PATH : 'rgba(128,128,128,0.35)';
      ctx.lineWidth = matched ? 4 : hot ? 3.5 : path ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const dot = (x: number, y: number, label: string, fill: string, ring: boolean) => {
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = ring ? 3.5 : 2;
      ctx.strokeStyle = ring ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
    };

    for (let l = 0; l < left; l++) {
      const matched = frame.match.some((m) => m === l);
      dot(lx, ly(l), `L${l}`, l === frame.activeLeft ? ACTIVE : matched ? 'rgba(16,185,129,0.55)' : '#475569', l === frame.activeLeft);
    }
    for (let r = 0; r < right; r++) {
      const matched = frame.match[r] !== -1;
      dot(rx, ry(r), `R${r}`, matched ? 'rgba(16,185,129,0.55)' : '#475569', false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
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

  const size = frame.match.filter((m) => m !== -1).length;

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
        <span class="ml-auto text-xs text-muted">matching size {size}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{frame.caption}</p>
          <div class="flex flex-wrap gap-3 text-xs">
            <span class="flex items-center gap-1.5"><span class="inline-block h-1.5 w-5 rounded" style={`background:${MATCHED}`} /> matched</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-1.5 w-5 rounded" style={`background:${PATH}`} /> on the path</span>
            <span class="flex items-center gap-1.5"><span class="inline-block h-1.5 w-5 rounded" style={`background:${ACTIVE}`} /> trying now</span>
          </div>
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
