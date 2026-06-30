import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Loop operation counter.
   - Pick a loop shape and an input size n. The demo "runs" the loops
     and lights up a cell for every basic operation, keeping a live
     count. Watch a single loop tick n times, nested loops fill an
     n×n square, the triangular loop fill only half, and a halving
     loop touch just log n cells.
   - Frames = one operation each. Transport controls (Play / Pause /
     Step / Reset + speed) move an index through the precomputed steps.
   ------------------------------------------------------------------ */

type Pattern = {
  id: string;
  label: string;
  bigO: string;
  formula: (n: number) => string;
  rows: (n: number) => number;
};

const PATTERNS: Pattern[] = [
  { id: 'single', label: 'one loop', bigO: 'O(n)', formula: (n) => `n = ${n}`, rows: () => 1 },
  { id: 'two', label: 'two separate loops', bigO: 'O(n)', formula: (n) => `2n = ${2 * n}`, rows: () => 2 },
  { id: 'halving', label: 'halving loop', bigO: 'O(log n)', formula: (n) => `≈ log₂(${n})`, rows: () => 1 },
  { id: 'nested', label: 'nested loops', bigO: 'O(n²)', formula: (n) => `n² = ${n * n}`, rows: (n) => n },
  { id: 'triangular', label: 'triangular loop', bigO: 'O(n²)', formula: (n) => `n(n+1)/2 = ${(n * (n + 1)) / 2}`, rows: (n) => n },
];

type Frame = { r: number; c: number; ops: number; i: number; j: number; note: string };

function buildFrames(pattern: string, n: number): Frame[] {
  const f: Frame[] = [];
  let ops = 0;
  if (pattern === 'single') {
    for (let i = 0; i < n; i++) { ops++; f.push({ r: 0, c: i, ops, i, j: -1, note: `i = ${i}: visit element #${i + 1}` }); }
  } else if (pattern === 'two') {
    for (let i = 0; i < n; i++) { ops++; f.push({ r: 0, c: i, ops, i, j: -1, note: `loop A, i = ${i}` }); }
    for (let j = 0; j < n; j++) { ops++; f.push({ r: 1, c: j, ops, i: -1, j, note: `loop B, j = ${j}` }); }
  } else if (pattern === 'nested') {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ops++; f.push({ r: i, c: j, ops, i, j, note: `i = ${i}, j = ${j}` }); }
  } else if (pattern === 'triangular') {
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { ops++; f.push({ r: i, c: j, ops, i, j, note: `i = ${i}, j = ${j}  (j starts at i)` }); }
  } else if (pattern === 'halving') {
    let i = 1;
    while (i < n) { ops++; f.push({ r: 0, c: i - 1, ops, i, j: -1, note: `i = ${i}, double → ${i * 2}` }); i *= 2; }
    if (f.length === 0) { f.push({ r: 0, c: 0, ops: 1, i: 1, j: -1, note: `i = 1` }); }
  }
  return f;
}

export default function CxLoopCounter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 300 });

  const [pattern, setPattern] = useState('nested');
  const [n, setN] = useState(8);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames('nested', 8));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const framesRef = useRef(frames); framesRef.current = frames;
  const idxRef = useRef(idx); idxRef.current = idx;
  const nRef = useRef(n); nRef.current = n;
  const patRef = useRef(pattern); patRef.current = pattern;

  // rebuild frames when the inputs change
  useEffect(() => {
    setPlaying(false);
    const f = buildFrames(pattern, n);
    setFrames(f);
    setIdx(0);
  }, [pattern, n]);

  // autoplay
  useEffect(() => {
    if (!playing) return;
    const interval = 1000 / Math.max(1, speed);
    const loop = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        setIdx((i) => {
          if (i >= framesRef.current.length - 1) { setPlaying(false); return i; }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, speed]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const nn = nRef.current;
    const pat = PATTERNS.find((p) => p.id === patRef.current)!;
    const rows = pat.rows(nn);
    const cols = nn;
    const fr = framesRef.current;
    const cur = Math.min(idxRef.current, fr.length - 1);

    const pad = 8;
    const availW = w - pad * 2;
    const availH = h - pad * 2;
    const cw = Math.min(46, availW / cols);
    const ch = Math.min(46, availH / rows);
    const cell = Math.min(cw, ch);
    const gw = cell * cols;
    const gh = cell * rows;
    const ox = (w - gw) / 2;
    const oy = (h - gh) / 2;

    // which cells have been visited so far
    const visited = new Set<string>();
    for (let k = 0; k <= cur && k < fr.length; k++) visited.add(`${fr[k].r},${fr[k].c}`);
    const active = fr[cur];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const k = `${r},${c}`;
        const isActive = active && active.r === r && active.c === c;
        if (isActive) ctx.fillStyle = '#4f46e5';
        else if (visited.has(k)) ctx.fillStyle = 'rgba(14,165,233,0.30)';
        else ctx.fillStyle = 'rgba(128,128,128,0.07)';
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        if (isActive) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
        }
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.min(w * 0.66, 340));
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

  useEffect(draw, [idx, frames, n, pattern]);

  const step = (d: number) => {
    setPlaying(false);
    setIdx((i) => Math.max(0, Math.min(frames.length - 1, i + d)));
  };

  const pat = PATTERNS.find((p) => p.id === pattern)!;
  const cur = frames[Math.min(idx, frames.length - 1)];
  const done = idx >= frames.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-1.5">
        {PATTERNS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPattern(p.id)}
            class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              pattern === p.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

        <div class="space-y-2 text-sm md:w-44">
          <label class="block">
            <span class="mb-1 block text-muted">n = {n}</span>
            <input
              type="range" min={2} max={12} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <span class="text-xs text-muted">operations so far</span>
            <div class="font-mono text-2xl font-bold text-brand">{cur ? cur.ops : 0}</div>
          </div>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <span class="text-xs text-muted">total when done</span>
            <div class="font-mono font-semibold">{pat.formula(n)}</div>
            <div class="mt-1 text-xs font-bold" style="color:#10b981">→ {pat.bigO}</div>
          </div>
        </div>
      </div>

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => step(-1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step back">⏮</button>
        <button
          onClick={() => { if (done) setIdx(0); setPlaying((p) => !p); }}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => step(1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step forward">⏭</button>
        <button onClick={() => { setPlaying(false); setIdx(0); }} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Reset">↺</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input type="range" min={1} max={30} step={1} value={speed}
            onInput={(e) => setSpeed(parseInt((e.target as HTMLInputElement).value))}
            class="w-24 accent-[#10b981]" />
        </label>
      </div>

      {/* live caption */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        {done
          ? <span><strong>Done.</strong> Total operations: <strong>{cur ? cur.ops : 0}</strong> = <span class="font-mono">{pat.formula(n)}</span> → this loop shape is <strong style="color:#10b981">{pat.bigO}</strong>.</span>
          : <span><span class="font-mono">{cur ? cur.note : ''}</span> — operation #<strong>{cur ? cur.ops : 0}</strong>.</span>}
      </div>
    </div>
  );
}
