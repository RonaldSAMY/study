import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated SIFT-DOWN: the two jobs it powers.
   - "Build-heap" mode: take the learner's raw array and heapify it in
     place, starting from the last parent (index floor(n/2)-1) up to the
     root. This is the O(n) construction.
   - "Extract-root" mode: serve the root, drop the last leaf into its
     place, then sift it down to restore order.
   - Drawn as BOTH a binary tree AND the backing array. Highlights the
     active node and the compared/swapped pair, with a live caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
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

function buildHeapArray(values: number[], isMin: boolean): number[] {
  const heap = [...values];
  const n = heap.length;
  const better = (a: number, b: number) => (isMin ? a < b : a > b);
  for (let i = (n >> 1) - 1; i >= 0; i--) {
    let k = i;
    while (true) {
      const l = 2 * k + 1;
      const r = 2 * k + 2;
      let best = k;
      if (l < n && better(heap[l], heap[best])) best = l;
      if (r < n && better(heap[r], heap[best])) best = r;
      if (best === k) break;
      [heap[k], heap[best]] = [heap[best], heap[k]];
      k = best;
    }
  }
  return heap;
}

function genFrames(values: number[], isMin: boolean, mode: 'build' | 'extract'): Frame[] {
  const frames: Frame[] = [];
  const better = (a: number, b: number) => (isMin ? a < b : a > b);
  const wordPick = isMin ? 'smallest' : 'largest';
  const extreme = isMin ? 'minimum' : 'maximum';

  if (mode === 'build') {
    const heap = [...values];
    const n = heap.length;
    const base = (extra: Partial<Frame>): Frame => ({ arr: [...heap], active: -1, pair: null, swapped: false, done: false, caption: '', ...extra });
    frames.push(base({ caption: 'Raw array — not yet a heap. Heapify from the last parent up to the root.' }));
    for (let i = (n >> 1) - 1; i >= 0; i--) {
      frames.push(base({ active: i, caption: `Sift-down from index ${i} (value ${heap[i]}). Leaves below are already trivially valid.` }));
      let k = i;
      while (true) {
        const l = 2 * k + 1;
        const r = 2 * k + 2;
        let best = k;
        if (l < n && better(heap[l], heap[best])) best = l;
        if (r < n && better(heap[r], heap[best])) best = r;
        if (best === k) {
          frames.push(base({ active: k, caption: `Index ${k} already holds the ${wordPick} of its family. Stop.` }));
          break;
        }
        const par = heap[k];
        const ch = heap[best];
        frames.push(base({ active: k, pair: [k, best], caption: `Child ${ch} (i=${best}) beats parent ${par} (i=${k}).` }));
        [heap[k], heap[best]] = [heap[best], heap[k]];
        frames.push(base({ active: best, pair: [k, best], swapped: true, caption: `Swap ${par} down and ${ch} up.` }));
        k = best;
      }
    }
    frames.push(base({ done: true, caption: n ? `Heapified. Root ${heap[0]} is the ${extreme} — built in O(n).` : 'Nothing to build.' }));
    return frames;
  }

  // ----- extract -----
  const heap = buildHeapArray(values, isMin);
  const n0 = heap.length;
  const base = (extra: Partial<Frame>): Frame => ({ arr: [...heap], active: -1, pair: null, swapped: false, done: false, caption: '', ...extra });
  if (n0 === 0) { frames.push(base({ done: true, caption: 'Empty heap — nothing to extract.' })); return frames; }
  frames.push(base({ active: 0, caption: `A valid ${isMin ? 'min' : 'max'}-heap. The ${extreme} sits at the root: ${heap[0]}.` }));
  if (n0 === 1) {
    const only = heap[0];
    heap.pop();
    frames.push(base({ done: true, caption: `Pop the only node. Served ${only}; the heap is now empty.` }));
    return frames;
  }
  const root = heap[0];
  const last = heap[heap.length - 1];
  heap[0] = last;
  heap.pop();
  frames.push(base({ active: 0, caption: `Serve ${root}. Move the last leaf ${last} into the root, then sift it down.` }));
  const n = heap.length;
  let k = 0;
  while (true) {
    const l = 2 * k + 1;
    const r = 2 * k + 2;
    let best = k;
    if (l < n && better(heap[l], heap[best])) best = l;
    if (r < n && better(heap[r], heap[best])) best = r;
    if (best === k) {
      frames.push(base({ active: k, caption: `${heap[k]} is now ${isMin ? '≤' : '≥'} both children. Order restored.` }));
      break;
    }
    const par = heap[k];
    const ch = heap[best];
    frames.push(base({ active: k, pair: [k, best], caption: `Child ${ch} (i=${best}) is ${wordPick} — it should rise.` }));
    [heap[k], heap[best]] = [heap[best], heap[k]];
    frames.push(base({ active: best, pair: [k, best], swapped: true, caption: `Swap ${par} down and ${ch} up.` }));
    k = best;
  }
  frames.push(base({ done: true, caption: `Extracted ${root}. New root ${heap[0]} is the next ${extreme}.` }));
  return frames;
}

export default function HeapBuildHeapify() {
  const [text, setText] = useState('9, 4, 7, 1, 8, 2, 6, 3');
  const [isMin, setIsMin] = useState(true);
  const [mode, setMode] = useState<'build' | 'extract'>('build');
  const [frames, setFrames] = useState<Frame[]>(() => genFrames(parseList('9, 4, 7, 1, 8, 2, 6, 3'), true, 'build'));
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

  const rebuild = (values: number[], min: boolean, m: 'build' | 'extract') => {
    setFrames(genFrames(values, min, m));
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };
  const commit = () => { const p = parseList(text); if (p.length) rebuild(p, isMin, mode); };
  const toggleMode = () => { const v = !isMin; setIsMin(v); rebuild(parseList(text), v, mode); };
  const pick = (m: 'build' | 'extract') => { setMode(m); rebuild(parseList(text), isMin, m); };

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

    const depthOf = (i: number) => Math.floor(Math.log2(i + 1));
    const maxDepth = n > 0 ? depthOf(n - 1) : 0;
    const treeTop = 22;
    const levelH = 56;
    const r = 17;
    const treeH = treeTop + maxDepth * levelH + r + 8;

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

      <div class="mb-3 flex flex-wrap gap-2">
        {(['build', 'extract'] as const).map((m) => (
          <button key={m} onClick={() => pick(m)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {m === 'build' ? 'Build-heap' : 'Extract-root'}
          </button>
        ))}
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
      <p class="mt-2 text-center text-xs text-muted">Build-heap sifts down from index ⌊n/2⌋-1 to 0. Most nodes sit near the bottom with short sifts — which is why it is O(n), not O(n log n).</p>
    </div>
  );
}
