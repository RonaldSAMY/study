import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Heap allocator visualizer.
   - The heap is one linear array of cells (free = gray).
   - Pick a size, choose first-fit or best-fit, click "Allocate":
     the allocator scans the free list for a run that fits and marks it.
   - Click any used block to "Free" it back to gray.
   - Live readout: total free, largest contiguous run, fragmentation %.
   - When a request fails despite enough total free, that's external
     fragmentation — the demo says so.
   Canvas, devicePixelRatio scaling, responsive + touch.
   ------------------------------------------------------------------ */

type Strategy = 'first' | 'best';
type Meta = { colorIdx: number; size: number };

const TOTAL = 48;
const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const FREE_FILL = 'rgba(148,163,184,0.20)';
const FREE_STROKE = 'rgba(148,163,184,0.55)';
const COLS = 12;

function findFit(cells: number[], size: number, strategy: Strategy): number {
  let best = -1;
  let bestLen = Infinity;
  let i = 0;
  while (i < cells.length) {
    if (cells[i] === 0) {
      let j = i;
      while (j < cells.length && cells[j] === 0) j++;
      const len = j - i;
      if (len >= size) {
        if (strategy === 'first') return i;
        if (len < bestLen) { bestLen = len; best = i; }
      }
      i = j;
    } else {
      i++;
    }
  }
  return best;
}

function largestFreeRun(cells: number[]): { start: number; len: number } {
  let best = { start: -1, len: 0 };
  let i = 0;
  while (i < cells.length) {
    if (cells[i] === 0) {
      let j = i;
      while (j < cells.length && cells[j] === 0) j++;
      if (j - i > best.len) best = { start: i, len: j - i };
      i = j;
    } else {
      i++;
    }
  }
  return best;
}

export default function AllocatorVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cells, setCells] = useState<number[]>(() => new Array(TOTAL).fill(0));
  const [meta, setMeta] = useState<Record<number, Meta>>({});
  const [size, setSize] = useState(5);
  const [strategy, setStrategy] = useState<Strategy>('first');
  const [msg, setMsg] = useState('Pick a size and press Allocate. Click a colored block to free it.');
  const [failed, setFailed] = useState(false);
  const nextId = useRef(1);

  const cellsRef = useRef(cells);
  const metaRef = useRef(meta);
  const sizeBoxRef = useRef({ w: 480, h: 240, cell: 36, top: 46, pad: 12 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cell, top, pad } = sizeBoxRef.current;
    const cs = cellsRef.current;
    const mt = metaRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.95)';
    ctx.fillText('HEAP  (one linear pool of cells)', pad, 18);

    const big = largestFreeRun(cs);
    const gap = 3;
    for (let i = 0; i < TOTAL; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = pad + col * cell;
      const y = top + row * cell;
      const id = cs[i];
      const cw = cell - gap;
      const inBig = id === 0 && big.len > 0 && i >= big.start && i < big.start + big.len;

      ctx.beginPath();
      ctx.rect(x, y, cw, cw);
      if (id === 0) {
        ctx.fillStyle = FREE_FILL;
        ctx.fill();
        ctx.lineWidth = inBig ? 2 : 1;
        ctx.strokeStyle = inBig ? COLORS[2] : FREE_STROKE;
        ctx.stroke();
      } else {
        const color = COLORS[mt[id] ? mt[id].colorIdx : 0];
        ctx.fillStyle = `${color}33`;
        ctx.fill();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = color;
        ctx.stroke();
        // label the first cell of each block with its id
        if (i === 0 || cs[i - 1] !== id) {
          ctx.font = '700 11px Inter, sans-serif';
          ctx.fillStyle = color;
          ctx.fillText(`#${id}`, x + 3, y + 13);
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
      const pad = 12;
      const top = 30;
      const cell = Math.floor((w - pad * 2) / COLS);
      const rows = Math.ceil(TOTAL / COLS);
      const h = top + rows * cell + pad;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeBoxRef.current = { w, h, cell, top, pad };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    cellsRef.current = cells;
    metaRef.current = meta;
    draw();
  }, [cells, meta]);

  const totalFree = cells.filter((c) => c === 0).length;
  const big = largestFreeRun(cells);
  const fragPct = totalFree > 0 ? Math.round((1 - big.len / totalFree) * 100) : 0;

  const allocate = () => {
    const start = findFit(cells, size, strategy);
    if (start < 0) {
      setFailed(true);
      if (totalFree >= size) {
        setMsg(`Allocation FAILED: ${totalFree} cells are free, but the largest gap is only ${big.len}. The space is shattered — external fragmentation.`);
      } else {
        setMsg(`Out of memory: only ${totalFree} cells free, but ${size} requested.`);
      }
      return;
    }
    const id = nextId.current++;
    const next = cells.slice();
    for (let i = start; i < start + size; i++) next[i] = id;
    setMeta({ ...meta, [id]: { colorIdx: (id - 1) % COLORS.length, size } });
    setCells(next);
    setFailed(false);
    setMsg(`${strategy === 'first' ? 'First' : 'Best'}-fit placed block #${id} (${size} cells) starting at index ${start}.`);
  };

  const freeAt = (idx: number) => {
    const id = cells[idx];
    if (!id) {
      setMsg('That cell is already free.');
      return;
    }
    const sz = meta[id] ? meta[id].size : 0;
    setCells(cells.map((c) => (c === id ? 0 : c)));
    const nm = { ...meta };
    delete nm[id];
    setMeta(nm);
    setFailed(false);
    setMsg(`Freed block #${id} (${sz} cells); its space rejoins the free pool.`);
  };

  const demoFragment = () => {
    // fill with size-4 blocks, then free every other one to shatter the pool
    const next = new Array(TOTAL).fill(0);
    const nm: Record<number, Meta> = {};
    let id = 1;
    for (let i = 0; i + 4 <= TOTAL; i += 4) {
      for (let k = 0; k < 4; k++) next[i + k] = id;
      nm[id] = { colorIdx: (id - 1) % COLORS.length, size: 4 };
      id++;
    }
    // free the odd-numbered blocks (1, 3, 5, ...) leaving size-4 gaps
    for (let b = 1; b < id; b += 2) {
      for (let i = 0; i < TOTAL; i++) if (next[i] === b) next[i] = 0;
      delete nm[b];
    }
    nextId.current = id;
    setCells(next);
    setMeta(nm);
    setFailed(false);
    setMsg('Now there is lots of free space — but only in 4-cell gaps. Try allocating 5: it fails. That is fragmentation.');
  };

  const reset = () => {
    nextId.current = 1;
    setCells(new Array(TOTAL).fill(0));
    setMeta({});
    setFailed(false);
    setMsg('Reset. Pick a size and press Allocate.');
  };

  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cell, top, pad } = sizeBoxRef.current;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const col = Math.floor((px - pad) / cell);
    const row = Math.floor((py - top) / cell);
    if (col < 0 || col >= COLS || row < 0) return;
    const idx = row * COLS + col;
    if (idx >= 0 && idx < TOTAL) freeAt(idx);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['first', 'best'] as Strategy[]).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              strategy === s ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {s}-fit
          </button>
        ))}
        <button onClick={allocate} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">Allocate {size}</button>
        <button onClick={demoFragment} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">Fragment it</button>
        <button onClick={reset} class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">Reset</button>
      </div>

      <label class="mb-3 block text-sm">
        <span class="mb-1 block text-muted">request size = {size} cells</span>
        <input
          type="range" min={1} max={12} step={1} value={size}
          onInput={(e) => setSize(parseInt((e.target as HTMLInputElement).value, 10))}
          class="w-full accent-[#4f46e5]"
        />
      </label>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Click any colored block to free it. The emerald outline marks the largest contiguous free run.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="total free" value={`${totalFree}`} color={COLORS[2]} />
            <Readout label="largest run" value={`${big.len}`} color={COLORS[1]} />
            <Readout label="fragmentation" value={`${fragPct}%`} color={fragPct > 50 ? '#ef4444' : undefined} />
            <Readout label="used" value={`${TOTAL - totalFree}`} color={COLORS[0]} />
          </div>
          <div class={`rounded-lg p-3 text-xs ${failed ? 'bg-red-500/10 text-red-500' : 'bg-surface-2 text-muted'}`}>{msg}</div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
