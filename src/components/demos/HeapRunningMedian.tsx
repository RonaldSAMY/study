import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated RUNNING MEDIAN with two heaps.
   - Learner edits their own stream of numbers. Each step feeds one
     number through the classic two-heap balance:
       * a MAX-heap holds the smaller half (its root = largest small value)
       * a MIN-heap holds the larger half (its root = smallest large value)
     The two roots straddle the median, so the median is O(1) to read.
   - Drawn as two binary trees side by side, each peek highlighted, with
     the backing arrays underneath and a live median caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const C = { lowerTop: '#10b981', upperTop: '#0ea5e9' };

type MFrame = { lower: number[]; upper: number[]; median: number | null; added: number | null; caption: string };

const parseList = (s: string): number[] =>
  s
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x))
    .slice(0, 15);

function heapInsert(arr: number[], val: number, isMin: boolean): void {
  arr.push(val);
  let i = arr.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    const up = isMin ? arr[i] < arr[p] : arr[i] > arr[p];
    if (!up) break;
    [arr[i], arr[p]] = [arr[p], arr[i]];
    i = p;
  }
}
function heapExtract(arr: number[], isMin: boolean): number {
  const top = arr[0];
  const last = arr.pop()!;
  if (arr.length) {
    arr[0] = last;
    let i = 0;
    const n = arr.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let best = i;
      if (l < n && (isMin ? arr[l] < arr[best] : arr[l] > arr[best])) best = l;
      if (r < n && (isMin ? arr[r] < arr[best] : arr[r] > arr[best])) best = r;
      if (best === i) break;
      [arr[i], arr[best]] = [arr[best], arr[i]];
      i = best;
    }
  }
  return top;
}

function genMedianFrames(values: number[]): MFrame[] {
  const lower: number[] = []; // max-heap, smaller half
  const upper: number[] = []; // min-heap, larger half
  const frames: MFrame[] = [];
  const median = (): number | null =>
    lower.length > upper.length ? lower[0] : lower.length ? (lower[0] + upper[0]) / 2 : null;

  frames.push({ lower: [], upper: [], median: null, added: null, caption: 'Empty stream. Press Play to feed one number at a time.' });
  for (const x of values) {
    heapInsert(lower, x, false);
    heapInsert(upper, heapExtract(lower, false), true);
    if (upper.length > lower.length) heapInsert(lower, heapExtract(upper, true), false);
    const m = median();
    const balance = lower.length === upper.length
      ? `even count — median averages the two roots: (${lower[0]} + ${upper[0]}) / 2 = ${m}.`
      : `odd count — the lower max-heap holds the middle value ${lower[0]}, so median = ${m}.`;
    frames.push({ lower: [...lower], upper: [...upper], median: m, added: x, caption: `Add ${x}. ${balance}` });
  }
  return frames;
}

export default function HeapRunningMedian() {
  const [text, setText] = useState('5, 2, 8, 1, 9, 3, 7');
  const [frames, setFrames] = useState<MFrame[]>(() => genMedianFrames(parseList('5, 2, 8, 1, 9, 3, 7')));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const framesRef = useRef(frames);
  idxRef.current = idx;
  framesRef.current = frames;

  const frame = frames[Math.min(idx, frames.length - 1)];

  const rebuild = (values: number[]) => { setFrames(genMedianFrames(values)); setIdx(0); setPlaying(false); lastRef.current = 0; };
  const commit = () => { const p = parseList(text); if (p.length) rebuild(p); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= framesRef.current.length) { setIdx(framesRef.current.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const drawHeap = (
    ctx: CanvasRenderingContext2D,
    arr: number[],
    x0: number,
    w: number,
    top: number,
    peekColor: string,
    textColor: string,
  ) => {
    const n = arr.length;
    if (!n) return;
    const r = 15;
    const levelH = 50;
    const depthOf = (i: number) => Math.floor(Math.log2(i + 1));
    const posOf = (i: number) => {
      const d = depthOf(i);
      const rowCount = 2 ** d;
      const posInRow = i - (2 ** d - 1);
      return { x: x0 + ((posInRow + 0.5) / rowCount) * w, y: top + d * levelH };
    };
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) {
      for (const c of [2 * i + 1, 2 * i + 2]) {
        if (c < n) { const p = posOf(i); const cc = posOf(c); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cc.x, cc.y); ctx.stroke(); }
      }
    }
    for (let i = 0; i < n; i++) {
      const { x, y } = posOf(i);
      const col = i === 0 ? peekColor : null;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = col || 'rgba(128,128,128,0.15)';
      ctx.fill();
      if (col) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      ctx.fillStyle = col ? '#fff' : textColor;
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x, y + 1);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);
    const textColor = getComputedStyle(canvas).color || '#334155';
    ctx.clearRect(0, 0, cssW, cssH);

    const f = framesRef.current[Math.min(idxRef.current, framesRef.current.length - 1)];
    const half = cssW / 2;
    const pad = 8;

    // header labels + median banner
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = C.lowerTop;
    ctx.fillText('lower • max-heap', half / 2, 14);
    ctx.fillStyle = C.upperTop;
    ctx.fillText('upper • min-heap', half + half / 2, 14);

    drawHeap(ctx, f.lower, pad, half - pad * 2, 40, C.lowerTop, textColor);
    drawHeap(ctx, f.upper, half + pad, half - pad * 2, 40, C.upperTop, textColor);

    // divider
    ctx.strokeStyle = 'rgba(128,128,128,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half, 24);
    ctx.lineTo(half, cssH - 56);
    ctx.stroke();

    // backing arrays
    const drawArr = (arr: number[], x0: number, w: number, peekColor: string) => {
      const n = arr.length;
      if (!n) return;
      const cellW = Math.min(28, (w - 4) / n);
      const ax = x0 + (w - cellW * n) / 2;
      const ay = cssH - 46;
      ctx.font = '600 11px ui-monospace, monospace';
      for (let i = 0; i < n; i++) {
        const x = ax + i * cellW;
        const col = i === 0 ? peekColor : null;
        ctx.fillStyle = col || 'rgba(128,128,128,0.12)';
        ctx.fillRect(x, ay, cellW - 2, 22);
        ctx.strokeStyle = 'rgba(128,128,128,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, ay, cellW - 2, 22);
        ctx.fillStyle = col ? '#fff' : textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(arr[i]), x + (cellW - 2) / 2, ay + 12);
      }
    };
    drawArr(f.lower, pad, half - pad * 2, C.lowerTop);
    drawArr(f.upper, half + pad, half - pad * 2, C.upperTop);

    // median readout
    ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(f.median == null ? 'median: —' : `median = ${f.median}`, half, cssH - 10);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 280;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  useEffect(draw, [idx, frames]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="stream of numbers (up to 15)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2 text-text" />

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
      <p class="mt-2 text-center text-xs text-muted">Keep the heaps balanced (sizes differ by at most one) and the median is always one or two peeks away — O(log n) per insert, O(1) per query.</p>
    </div>
  );
}
