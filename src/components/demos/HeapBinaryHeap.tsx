import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated binary heap built by INSERT + SIFT-UP.
   - Learner edits their own comma-separated numbers and inserts them
     one at a time. Each new value lands in the next array slot, then
     bubbles up while it beats its parent (min-heap: smaller wins).
   - Drawn as BOTH a binary tree AND the backing array, side by side,
     so the index math i -> parent=(i-1)/2, children=2i+1,2i+2 is visible.
   - Highlights the active node and the compared/swapped pair, with a
     live caption. Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const C = { indigo: '#4f46e5', sky: '#0ea5e9', emerald: '#10b981' };

type Frame = {
  arr: number[];
  active: number;
  pair: [number, number] | null;
  swapped: boolean;
  done: boolean;
  caption: string;
};

const parseList = (s: string): number[] =>
  s
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x))
    .slice(0, 12);

function genInsertFrames(values: number[], isMin: boolean): Frame[] {
  const heap: number[] = [];
  const frames: Frame[] = [];
  const better = (a: number, b: number) => (isMin ? a < b : a > b); // a belongs above b
  const word = isMin ? 'smaller' : 'larger';
  const rel = isMin ? '≤' : '≥';
  const base = (extra: Partial<Frame>): Frame => ({ arr: [...heap], active: -1, pair: null, swapped: false, done: false, caption: '', ...extra });

  frames.push(base({ caption: 'Empty heap. Press Play to insert each number into the next open slot.' }));

  for (const v of values) {
    heap.push(v);
    let i = heap.length - 1;
    frames.push(base({ active: i, caption: `Insert ${v} at index ${i} — the next free slot, keeping the tree complete.` }));
    while (i > 0) {
      const p = (i - 1) >> 1;
      frames.push(base({ active: i, pair: [i, p], caption: `Compare ${heap[i]} (i=${i}) with parent ${heap[p]} (i=${p}).` }));
      if (better(heap[i], heap[p])) {
        const child = heap[i];
        const par = heap[p];
        [heap[i], heap[p]] = [heap[p], heap[i]];
        frames.push(base({ active: p, pair: [i, p], swapped: true, caption: `${child} is ${word} than ${par} — sift up: swap them.` }));
        i = p;
      } else {
        frames.push(base({ active: i, pair: [i, p], caption: `Heap order holds: parent ${heap[p]} ${rel} ${heap[i]}. Stop here.` }));
        break;
      }
    }
    if (i === 0) frames.push(base({ active: 0, caption: `${heap[0]} climbed to the root.` }));
  }

  frames.push(base({ done: true, caption: heap.length ? `Done. The root ${heap[0]} is the ${isMin ? 'minimum' : 'maximum'} — peek is O(1).` : 'Nothing to insert.' }));
  return frames;
}

export default function HeapBinaryHeap() {
  const [text, setText] = useState('5, 3, 8, 1, 9, 2');
  const [isMin, setIsMin] = useState(true);
  const [frames, setFrames] = useState<Frame[]>(() => genInsertFrames(parseList('5, 3, 8, 1, 9, 2'), true));
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

  const rebuild = (values: number[], min: boolean) => {
    setFrames(genInsertFrames(values, min));
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };
  const commit = () => { const p = parseList(text); if (p.length) rebuild(p, isMin); };
  const toggleMode = () => { const m = !isMin; setIsMin(m); rebuild(parseList(text), m); };

  // ---- autoplay ----
  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 760 / speed;
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

  // ---- drawing ----
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
    const arr = f.arr;
    const n = arr.length;

    const fill = (i: number) => {
      if (f.done && i === 0) return C.emerald;
      if (f.pair && (i === f.pair[0] || i === f.pair[1])) return f.swapped ? C.emerald : C.sky;
      if (i === f.active) return C.indigo;
      return null;
    };

    // ----- tree region -----
    const depthOf = (i: number) => Math.floor(Math.log2(i + 1));
    const maxDepth = n > 0 ? depthOf(n - 1) : 0;
    const treeTop = 22;
    const levelH = 56;
    const r = 17;
    const treeH = treeTop + maxDepth * levelH + r + 8;

    // edges first
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.5;
    const posOf = (i: number) => {
      const d = depthOf(i);
      const rowCount = 2 ** d;
      const posInRow = i - (2 ** d - 1);
      const x = ((posInRow + 0.5) / rowCount) * cssW;
      const y = treeTop + d * levelH;
      return { x, y };
    };
    for (let i = 0; i < n; i++) {
      const c1 = 2 * i + 1;
      const c2 = 2 * i + 2;
      const p = posOf(i);
      if (c1 < n) { const cc = posOf(c1); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cc.x, cc.y); ctx.stroke(); }
      if (c2 < n) { const cc = posOf(c2); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cc.x, cc.y); ctx.stroke(); }
    }
    // nodes
    for (let i = 0; i < n; i++) {
      const { x, y } = posOf(i);
      const col = fill(i);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = col || 'rgba(128,128,128,0.15)';
      ctx.fill();
      if (col) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      ctx.fillStyle = col ? '#fff' : textColor;
      ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x, y + 1);
    }

    // ----- array region -----
    const cellW = Math.min(40, (cssW - 8) / Math.max(n, 1));
    const cellH = 30;
    const ax = (cssW - cellW * n) / 2;
    const ay = treeH + 16;
    ctx.font = '600 12px ui-monospace, monospace';
    for (let i = 0; i < n; i++) {
      const x = ax + i * cellW;
      const col = fill(i);
      ctx.fillStyle = col || 'rgba(128,128,128,0.12)';
      ctx.fillRect(x, ay, cellW - 2, cellH);
      ctx.strokeStyle = 'rgba(128,128,128,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, ay, cellW - 2, cellH);
      ctx.fillStyle = col ? '#fff' : textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x + (cellW - 2) / 2, ay + cellH / 2 + 1);
      // index label
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(String(i), x + (cellW - 2) / 2, ay + cellH + 9);
      ctx.font = '600 12px ui-monospace, monospace';
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 260;
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
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers (up to 12)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <button onClick={toggleMode} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">{isMin ? 'Min-heap' : 'Max-heap'}</button>
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
      <p class="mt-2 text-center text-xs text-muted">Index math: parent of i = ⌊(i-1)/2⌋, children = 2i+1 and 2i+2. Watch the array and tree stay in lock-step.</p>
    </div>
  );
}
