import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated priority queue backed by a binary MIN-heap.
   - The learner lists items as name:priority pairs (lower number = more
     urgent), e.g. "A:5, B:3, C:8, D:1". They arrive in THAT order...
   - Phase 1 (inserts): each item is pushed and bubbled up the heap tree.
   - Phase 2 (serves): extractMin repeatedly removes the smallest-priority
     item — so they leave in PRIORITY order, not arrival order.
   - The heap is drawn as a tree (the array laid out level by level), the
     root is the next to serve, and served items collect below.
   - Frames are precomputed; transport controls move a cursor. Autoplay
     uses requestAnimationFrame, cancelled on pause / unmount.
   ------------------------------------------------------------------ */

const COLORS = { root: '#0ea5e9', moved: '#10b981', node: '#4f46e5', edge: 'rgba(128,128,128,0.4)' };

type Item = { name: string; priority: number };
type Frame = {
  heap: Item[];
  served: Item[];
  highlight: number | null;
  caption: string;
};

function parseItems(text: string): Item[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [name, p] = t.split(':').map((s) => s.trim());
      const priority = parseInt(p, 10);
      return { name: name || '?', priority: Number.isFinite(priority) ? priority : 0 };
    })
    .slice(0, 10);
}

function buildFrames(text: string): Frame[] {
  const items = parseItems(text);
  const heap: Item[] = [];
  const served: Item[] = [];
  const frames: Frame[] = [
    { heap: [], served: [], highlight: null, caption: 'An empty heap. Items arrive in list order; the heap keeps the smallest priority on top.' },
  ];
  const swap = (i: number, j: number) => { [heap[i], heap[j]] = [heap[j], heap[i]]; };

  // INSERT phase
  for (const it of items) {
    heap.push({ ...it });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[i].priority >= heap[parent].priority) break;
      swap(i, parent);
      i = parent;
    }
    frames.push({
      heap: heap.map((x) => ({ ...x })),
      served: served.map((x) => ({ ...x })),
      highlight: i,
      caption: `insert ${it.name}(${it.priority}) — it bubbles up to index ${i}. Top of the heap is now ${heap[0].name}(${heap[0].priority}).`,
    });
  }

  // SERVE phase: extractMin until empty
  while (heap.length > 0) {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < heap.length && heap[l].priority < heap[smallest].priority) smallest = l;
        if (r < heap.length && heap[r].priority < heap[smallest].priority) smallest = r;
        if (smallest === i) break;
        swap(i, smallest);
        i = smallest;
      }
    }
    served.push(top);
    frames.push({
      heap: heap.map((x) => ({ ...x })),
      served: served.map((x) => ({ ...x })),
      highlight: heap.length > 0 ? 0 : null,
      caption: `serve ${top.name}(${top.priority}) — the lowest priority number always leaves first.${heap.length ? ` Next up: ${heap[0].name}(${heap[0].priority}).` : ' The heap is now empty.'}`,
    });
  }
  return frames;
}

export default function QuePriorityServe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('A:5, B:3, C:8, D:1, E:9, F:2');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames('A:5, B:3, C:8, D:1, E:9, F:2'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frameRef = useRef<Frame>(frames[0]);
  frameRef.current = frames[idx];

  const commit = () => { setFrames(buildFrames(text)); setIdx(0); setPlaying(false); };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frameRef.current;
    const n = f.heap.length;
    if (n === 0) {
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = '14px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('heap empty', w / 2, h / 2);
      return;
    }
    const levels = Math.floor(Math.log2(n)) + 1;
    const top = 30;
    const levelGap = Math.min(72, (h - top - 20) / Math.max(1, levels - 1 || 1));
    const radius = Math.min(22, levelGap * 0.38);

    const nodePos = (i: number) => {
      const L = Math.floor(Math.log2(i + 1));
      const countInLevel = 2 ** L;
      const posInLevel = i - (2 ** L - 1);
      const x = (w * (posInLevel + 0.5)) / countInLevel;
      const y = top + L * (levels > 1 ? levelGap : 0) + (levels === 1 ? (h - top) / 2 - top / 2 : 0);
      return { x, y };
    };

    // edges first
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 2;
    for (let i = 1; i < n; i++) {
      const p = nodePos(Math.floor((i - 1) / 2));
      const c = nodePos(i);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    // nodes
    for (let i = 0; i < n; i++) {
      const { x, y } = nodePos(i);
      const isRoot = i === 0;
      const isMoved = i === f.highlight;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isRoot ? COLORS.root : COLORS.node;
      ctx.fill();
      ctx.lineWidth = isMoved ? 4 : 2;
      ctx.strokeStyle = isMoved ? COLORS.moved : 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(radius * 0.9)}px ui-monospace, monospace`;
      ctx.fillText(String(f.heap[i].priority), x, y + 1);
      ctx.font = `${Math.round(radius * 0.6)}px ui-sans-serif, system-ui`;
      ctx.fillText(f.heap[i].name, x, y - radius - 8);
    }
    // root label
    const r0 = nodePos(0);
    ctx.fillStyle = COLORS.root;
    ctx.font = 'bold 11px ui-sans-serif, system-ui';
    ctx.fillText('next to serve ↑', r0.x, Math.max(12, r0.y - radius - 22));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const h = 300;
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

  useEffect(draw, [frames, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
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

  const f = frames[idx];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="A:5, B:3, C:8, D:1  (name:priority, lower = served first)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      {/* served items, in the order they left */}
      <div class="mt-3 flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-semibold text-muted">served:</span>
        {f.served.length === 0 && <span class="text-xs text-muted">nothing yet</span>}
        {f.served.map((s, i) => (
          <span key={i} class="rounded-md px-2 py-1 font-mono text-xs font-bold text-white" style={`background:${COLORS.moved}`}>{s.name}:{s.priority}</span>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-1 font-mono text-xs text-muted">step {idx}/{frames.length - 1}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Notice the served row comes out sorted by priority even though the items arrived shuffled — the heap did the sorting, one O(log n) step at a time.</p>
    </div>
  );
}
