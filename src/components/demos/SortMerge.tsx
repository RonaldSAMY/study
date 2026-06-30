import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Merge Sort (top-down).
   - The array is split recursively; the interesting work is the MERGE.
   - When two sorted runs combine, we repeatedly take the smaller front
     value and write it back (amber = the slot just placed). Emerald =
     the part of the current run already merged into sorted order.
   ------------------------------------------------------------------ */

type Frame = { arr: number[]; compare: number[]; pivot: number[]; sorted: number[]; caption: string };

const COLORS = { bar: '#4f46e5', compare: '#0ea5e9', pivot: '#f59e0b', sorted: '#10b981' };
const range = (s: number, e: number) => { const o: number[] = []; for (let i = s; i < e; i++) o.push(i); return o; };
const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x) && x >= 1 && x <= 99).slice(0, 16);

function buildFrames(a0: number[]): Frame[] {
  const a = [...a0];
  const n = a.length;
  const frames: Frame[] = [];
  if (n === 0) return [{ arr: [], compare: [], pivot: [], sorted: [], caption: 'Add a few numbers (1–99), then press Load.' }];
  const snap = (compare: number[], pivot: number[], sorted: number[], caption: string) =>
    frames.push({ arr: [...a], compare, pivot, sorted, caption });

  frames.push({ arr: [...a], compare: [], pivot: [], sorted: [], caption: 'Split in half, sort each half, then merge two sorted runs into one.' });

  const ms = (start: number, end: number) => {
    if (end - start <= 1) return;
    const mid = (start + end) >> 1;
    ms(start, mid);
    ms(mid, end);
    const left = a.slice(start, mid);
    const right = a.slice(mid, end);
    snap(range(start, end), [], [], `Merge sorted runs [${left.join(', ')}] and [${right.join(', ')}].`);
    let i = 0, j = 0, k = start;
    const placed: number[] = [];
    while (i < left.length && j < right.length) {
      let take: number, cap: string;
      if (left[i] <= right[j]) { cap = `Left front ${left[i]} ≤ right front ${right[j]} → take ${left[i]}.`; take = left[i++]; }
      else { cap = `Right front ${right[j]} < left front ${left[i]} → take ${right[j]}.`; take = right[j++]; }
      a[k] = take;
      placed.push(k);
      snap([], [k], placed.slice(), cap);
      k++;
    }
    while (i < left.length) { a[k] = left[i++]; placed.push(k); snap([], [k], placed.slice(), `Right run is empty → copy remaining ${a[k]}.`); k++; }
    while (j < right.length) { a[k] = right[j++]; placed.push(k); snap([], [k], placed.slice(), `Left run is empty → copy remaining ${a[k]}.`); k++; }
    snap([], [], range(start, end), `Run [${start}..${end - 1}] is now sorted: [${a.slice(start, end).join(', ')}].`);
  };
  ms(0, n);
  frames.push({ arr: [...a], compare: [], pivot: [], sorted: range(0, n), caption: 'Sorted! Every merge was O(n), and there are log n levels → O(n log n), always.' });
  return frames;
}

export default function SortMerge() {
  const [text, setText] = useState('8, 3, 5, 1, 9, 2, 7, 4');
  const [nums, setNums] = useState<number[]>(() => parseList('8, 3, 5, 1, 9, 2, 7, 4'));
  const frames = useMemo(() => buildFrames(nums), [nums]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

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

  useEffect(() => { setIdx(0); setPlaying(false); lastRef.current = 0; }, [nums]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 650 / speed;
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
    const pad = 4;
    const bw = (w - pad * (n + 1)) / n;
    const maxV = maxRef.current;
    for (let i = 0; i < n; i++) {
      const val = frame.arr[i];
      const bh = Math.max(6, (val / maxV) * (h - 26));
      const x = pad + i * (bw + pad);
      const y = h - bh;
      ctx.fillStyle = frame.sorted.includes(i) ? COLORS.sorted : frame.pivot.includes(i) ? COLORS.pivot : frame.compare.includes(i) ? COLORS.compare : COLORS.bar;
      ctx.fillRect(x, y, bw, bh);
      if (bw > 13) {
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
      const h = 240;
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

  const commit = () => { const p = parseList(text); if (p.length) setNums(p); };
  const shuffle = () => { const p = Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 98)); setText(p.join(', ')); setNums(p); };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = frames[Math.min(idx, frames.length - 1)];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers 1–99" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <button onClick={shuffle} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Shuffle</button>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

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
      <p class="mt-2 text-center text-xs text-muted">Sky = the run being merged · Amber = the value just written into place · Emerald = merged-and-sorted.</p>
    </div>
  );
}
