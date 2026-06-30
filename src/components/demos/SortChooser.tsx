import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   "Choosing a sort" playground.
   - Pick an input PATTERN (random / nearly-sorted / reversed / few-unique)
     and an ALGORITHM, then watch it run and read the live comparison and
     move counters. The point: the *same* algorithm costs wildly different
     amounts on different data — which is how you choose one.
   ------------------------------------------------------------------ */

type Frame = { arr: number[]; compare: number[]; pivot: number[]; sorted: number[]; caption: string; cmp: number; mov: number };
type Algo = 'insertion' | 'selection' | 'quick';
type Pattern = 'random' | 'nearly' | 'reversed' | 'fewunique';

const COLORS = { bar: '#4f46e5', compare: '#0ea5e9', pivot: '#f59e0b', sorted: '#10b981' };
const range = (s: number, e: number) => { const o: number[] = []; for (let i = s; i < e; i++) o.push(i); return o; };

function makeInput(pattern: Pattern): number[] {
  const n = 9;
  if (pattern === 'reversed') return Array.from({ length: n }, (_, i) => n - i);
  if (pattern === 'nearly') { const a = Array.from({ length: n }, (_, i) => i + 1); [a[3], a[4]] = [a[4], a[3]]; [a[6], a[7]] = [a[7], a[6]]; return a; }
  if (pattern === 'fewunique') return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 3));
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 9));
}

function buildFrames(a0: number[], algo: Algo): Frame[] {
  const a = [...a0];
  const n = a.length;
  const frames: Frame[] = [];
  let cmp = 0, mov = 0;
  const push = (compare: number[], pivot: number[], sorted: number[], caption: string) =>
    frames.push({ arr: [...a], compare, pivot, sorted, caption, cmp, mov });

  push([], [], [], 'Press Play. Watch the comparison and move counters at the bottom.');

  if (algo === 'insertion') {
    for (let i = 1; i < n; i++) {
      const key = a[i];
      push([], [i], range(0, i), `Insert ${key} into the sorted left part.`);
      let j = i - 1;
      while (j >= 0 && (cmp++, a[j] > key)) { a[j + 1] = a[j]; mov++; push([j], [j + 1], range(0, i), `${a[j]} > ${key} → shift right.`); j--; }
      a[j + 1] = key; mov++;
      push([], [j + 1], range(0, i + 1), `Drop ${key} at position ${j + 1}.`);
    }
  } else if (algo === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) { cmp++; push([j], [min], range(0, i), `Compare ${a[j]} with smallest-so-far ${a[min]}.`); if (a[j] < a[min]) min = j; }
      if (min !== i) { [a[i], a[min]] = [a[min], a[i]]; mov++; }
      push([], [i], range(0, i + 1), `Place ${a[i]} at position ${i}.`);
    }
  } else {
    const settled = new Set<number>();
    const qs = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) { settled.add(lo); return; }
      const pivot = a[hi]; let i = lo;
      push([], [hi], [...settled], `Partition [${lo}..${hi}] around pivot ${pivot}.`);
      for (let j = lo; j < hi; j++) { cmp++; push([j], [hi], [...settled], `Is ${a[j]} < ${pivot}?`); if (a[j] < pivot) { if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; mov++; } i++; } }
      [a[i], a[hi]] = [a[hi], a[i]]; mov++; settled.add(i);
      push([], [i], [...settled], `Pivot ${a[i]} lands in its final slot.`);
      qs(lo, i - 1); qs(i + 1, hi);
    };
    qs(0, n - 1);
  }

  push([], [], range(0, n), `Done. ${cmp} comparisons and ${mov} moves for this input.`);
  return frames;
}

const ALGOS: { id: Algo; label: string }[] = [
  { id: 'insertion', label: 'Insertion' },
  { id: 'selection', label: 'Selection' },
  { id: 'quick', label: 'Quicksort' },
];
const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'random', label: 'Random' },
  { id: 'nearly', label: 'Nearly sorted' },
  { id: 'reversed', label: 'Reversed' },
  { id: 'fewunique', label: 'Few unique' },
];

export default function SortChooser() {
  const [algo, setAlgo] = useState<Algo>('insertion');
  const [pattern, setPattern] = useState<Pattern>('nearly');
  const [nums, setNums] = useState<number[]>(() => makeInput('nearly'));
  const frames = useMemo(() => buildFrames(nums, algo), [nums, algo]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const frameRef = useRef<Frame | null>(null);
  frameRef.current = frames[Math.min(idx, frames.length - 1)] ?? null;
  const maxRef = useRef(1);
  maxRef.current = Math.max(1, ...nums);

  useEffect(() => { setIdx(0); setPlaying(false); lastRef.current = 0; }, [nums, algo]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 550 / speed;
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

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const frame = frameRef.current;
    ctx.clearRect(0, 0, w, h);
    if (!frame || frame.arr.length === 0) return;
    const n = frame.arr.length;
    const pad = 5;
    const bw = (w - pad * (n + 1)) / n;
    const maxV = maxRef.current;
    for (let i = 0; i < n; i++) {
      const val = frame.arr[i];
      const bh = Math.max(6, (val / maxV) * (h - 26));
      const x = pad + i * (bw + pad);
      const y = h - bh;
      ctx.fillStyle = frame.sorted.includes(i) ? COLORS.sorted : frame.pivot.includes(i) ? COLORS.pivot : frame.compare.includes(i) ? COLORS.compare : COLORS.bar;
      ctx.fillRect(x, y, bw, bh);
      if (bw > 16) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${val}`, x + bw / 2, y - 5);
      }
    }
  };

  useEffect(draw, [idx, frames]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 640);
      const h = 220;
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
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regen = (p: Pattern) => { setPattern(p); setNums(makeInput(p)); };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = frames[Math.min(idx, frames.length - 1)];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-2 flex flex-wrap items-center gap-1.5">
        <span class="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Algorithm</span>
        {ALGOS.map((m) => (
          <button key={m.id} onClick={() => setAlgo(m.id)} class={`rounded-lg px-2.5 py-1 text-sm font-semibold transition ${algo === m.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m.label}</button>
        ))}
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-1.5">
        <span class="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Input</span>
        {PATTERNS.map((m) => (
          <button key={m.id} onClick={() => regen(m.id)} class={`rounded-lg px-2.5 py-1 text-sm font-semibold transition ${pattern === m.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m.label}</button>
        ))}
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <div class="mt-3 grid grid-cols-2 gap-2">
        <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">comparisons</span><div class="font-mono font-semibold text-text">{frame?.cmp ?? 0}</div></div>
        <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">moves / swaps</span><div class="font-mono font-semibold text-text">{frame?.mov ?? 0}</div></div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame?.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-1 text-xs text-muted">step {Math.min(idx + 1, frames.length)}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Run insertion on “Nearly sorted”, then selection on the same — compare the final counts.</p>
    </div>
  );
}
