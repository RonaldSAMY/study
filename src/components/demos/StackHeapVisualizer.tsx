import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Stack vs Heap visualizer.
   - STACK column (left): call frames pushed bottom-up, popped LIFO.
   - HEAP column (right): scattered allocated blocks reached by pointers.
   - "Call function" pushes a frame; "Return" pops the top frame.
   - "Allocate on heap" gives the top frame a pointer to a new block.
   - "Free" returns that block; popping a frame whose pointer was the
     only way to reach a block LEAKS it (drawn in red).
   Canvas, devicePixelRatio scaling, responsive + touch, raf slide
   animation cleaned up on unmount.
   ------------------------------------------------------------------ */

type Frame = { id: number; name: string; locals: string[]; ptr: number | null };
type Block = { id: number; colorIdx: number; freed: boolean; leaked: boolean; size: number };
type Pt = { x: number; y: number };

const HEAP_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];
const STACK_COLOR = '#4f46e5';
const LEAK_COLOR = '#ef4444';
const FREED_COLOR = '#94a3b8';
const MAX_FRAMES = 7;

const CALL_SEQUENCE = ['main()', 'update()', 'render()', 'spawnEnemy()', 'stepPhysics()', 'checkHit()', 'playSound()'];
const LOCALS_POOL = [
  ['int argc'],
  ['float dt'],
  ['vec2 pos', 'int hp'],
  ['Enemy id'],
  ['float vy'],
  ['bool hit'],
  ['int snd'],
];
const BLOCK_SIZES = [32, 64, 128, 256];

const initialFrames = (): Frame[] => [{ id: 0, name: 'main()', locals: ['int argc'], ptr: null }];

export default function StackHeapVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<Frame[]>(initialFrames());
  const [heap, setHeap] = useState<Block[]>([]);
  const [msg, setMsg] = useState('Press "Call function" to push a stack frame on top of main().');

  const nextFrameId = useRef(1);
  const nextBlockId = useRef(0);

  const framesRef = useRef(frames);
  const heapRef = useRef(heap);
  const sizeRef = useRef({ w: 480, h: 380 });
  const animRef = useRef({ active: false, start: 0, dur: 260 });
  const rafRef = useRef<number | null>(null);

  // ---- drawing ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const fr = framesRef.current;
    const hp = heapRef.current;
    ctx.clearRect(0, 0, w, h);

    const pad = 12;
    const midX = Math.round(w * 0.52);
    const headerY = 22;

    // column headers
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.95)';
    ctx.fillText('STACK  (LIFO, automatic)', pad, headerY - 6);
    ctx.fillText('HEAP  (manual lifetime)', midX + pad, headerY - 6);

    // divider
    ctx.strokeStyle = 'rgba(128,128,128,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(midX, headerY); ctx.lineTo(midX, h - pad); ctx.stroke();

    // animation offset (applied to the newest/top frame only)
    let off = 0;
    if (animRef.current.active) {
      const p = Math.min(1, (performance.now() - animRef.current.start) / animRef.current.dur);
      const e = 1 - Math.pow(1 - p, 3);
      off = (1 - e) * -28;
      if (p >= 1) animRef.current.active = false;
    }

    // ---- stack frames (bottom-up; main() at the bottom) ----
    const colW = midX - pad * 2;
    const fH = Math.min(54, (h - headerY - pad) / MAX_FRAMES);
    const bottomY = h - pad;
    const frameNode: Record<number, Pt> = {};

    fr.forEach((f, i) => {
      let y = bottomY - (i + 1) * fH;
      if (i === fr.length - 1) y += off;
      const top = i === fr.length - 1;
      drawFrame(ctx, pad, y, colW, fH - 6, f, top);
      if (f.ptr !== null) frameNode[f.id] = { x: pad + colW - 8, y: y + (fH - 6) / 2 };
    });

    // ---- heap blocks (grid in the right column) ----
    const heapX = midX + pad;
    const heapW = w - pad - heapX;
    const bw = (heapW - 12) / 2;
    const bh = 44;
    const blockPos: Record<number, Pt> = {};

    hp.forEach((b, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = heapX + col * (bw + 12);
      const y = headerY + 8 + row * (bh + 14);
      blockPos[b.id] = { x: x + bw / 2, y: y + bh / 2 };
      drawBlock(ctx, x, y, bw, bh, b);
    });

    // ---- pointer arrows on top ----
    fr.forEach((f) => {
      if (f.ptr === null) return;
      const from = frameNode[f.id];
      const to = blockPos[f.ptr];
      if (from && to) {
        const b = hp.find((x) => x.id === f.ptr);
        arrow(ctx, from, { x: to.x - bw / 2 - 2, y: to.y }, b && b.leaked ? LEAK_COLOR : '#64748b');
      }
    });
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.8);
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // redraw on state change
  useEffect(() => {
    framesRef.current = frames;
    heapRef.current = heap;
    draw();
  }, [frames, heap, msg]);

  const startAnim = () => {
    animRef.current = { active: true, start: performance.now(), dur: 260 };
    const loop = () => {
      draw();
      if (animRef.current.active) rafRef.current = requestAnimationFrame(loop);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  };

  // ---- actions ----
  const call = () => {
    if (frames.length >= MAX_FRAMES) {
      setMsg('Stack overflow! Too many nested calls — the stack ran out of room. (Runaway recursion does exactly this.)');
      return;
    }
    const depth = frames.length;
    const name = CALL_SEQUENCE[Math.min(depth, CALL_SEQUENCE.length - 1)];
    const locals = LOCALS_POOL[depth % LOCALS_POOL.length];
    const nf: Frame = { id: nextFrameId.current++, name, locals: [...locals], ptr: null };
    setFrames([...frames, nf]);
    setMsg(`Called ${name}: a fresh frame is pushed with its locals + return address. Fast — just move the stack pointer.`);
    startAnim();
  };

  const ret = () => {
    if (frames.length <= 1) {
      setMsg('Only main() is left — there is nothing to return from.');
      return;
    }
    const top = frames[frames.length - 1];
    let extra = '';
    if (top.ptr !== null) {
      const blk = heap.find((b) => b.id === top.ptr);
      if (blk && !blk.freed) {
        const sharedElsewhere = frames.slice(0, -1).some((f) => f.ptr === blk.id);
        if (!sharedElsewhere) {
          setHeap(heap.map((b) => (b.id === blk.id ? { ...b, leaked: true } : b)));
          extra = ' Its pointer was the only way to reach a heap block — that block just LEAKED (still allocated, now unreachable).';
        }
      }
    }
    setFrames(frames.slice(0, -1));
    setMsg(`Returned from ${top.name}: its frame popped and every local vanished automatically.${extra}`);
    startAnim();
  };

  const allocate = () => {
    if (frames.length === 0) {
      setMsg('Call a function first — you need a local pointer to hold the heap address.');
      return;
    }
    const top = frames[frames.length - 1];
    if (top.ptr !== null) {
      setMsg(`${top.name} already holds a pointer here. Free it or return first.`);
      return;
    }
    const id = nextBlockId.current++;
    const blk: Block = { id, colorIdx: heap.length % HEAP_COLORS.length, freed: false, leaked: false, size: BLOCK_SIZES[id % BLOCK_SIZES.length] };
    setHeap([...heap, blk]);
    setFrames(frames.map((f, i) => (i === frames.length - 1 ? { ...f, ptr: id, locals: [...f.locals, 'void* p'] } : f)));
    setMsg(`${top.name} called malloc: a ${blk.size}-byte block now lives on the heap. The local pointer p holds its address.`);
  };

  const free = () => {
    const top = frames[frames.length - 1];
    if (!top || top.ptr === null) {
      setMsg('No live pointer in the top frame to free.');
      return;
    }
    const blk = heap.find((b) => b.id === top.ptr);
    if (!blk || blk.freed) {
      setMsg('That block is already freed.');
      return;
    }
    setHeap(heap.map((b) => (b.id === blk.id ? { ...b, freed: true, leaked: false } : b)));
    setFrames(frames.map((f, i) => (i === frames.length - 1 ? { ...f, ptr: null } : f)));
    setMsg(`free(p): the ${blk.size}-byte heap block was returned to the allocator. No leak — that is the rule.`);
  };

  const reset = () => {
    nextFrameId.current = 1;
    nextBlockId.current = 0;
    setFrames(initialFrames());
    setHeap([]);
    setMsg('Reset. Press "Call function" to push a stack frame on top of main().');
  };

  const liveBlocks = heap.filter((b) => !b.freed).length;
  const leaked = heap.filter((b) => b.leaked).length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button onClick={call} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">Call function</button>
        <button onClick={ret} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">Return</button>
        <button onClick={allocate} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">Allocate on heap</button>
        <button onClick={free} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">Free</button>
        <button onClick={reset} class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">Reset</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <Readout label="stack depth" value={`${frames.length} / ${MAX_FRAMES}`} color={STACK_COLOR} />
            <Readout label="live heap blocks" value={`${liveBlocks}`} color={HEAP_COLORS[2]} />
            <Readout label="leaked blocks" value={`${leaked}`} color={leaked ? LEAK_COLOR : undefined} />
            <Readout label="total allocations" value={`${nextBlockId.current}`} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">{msg}</div>
          <p class="text-xs text-muted">
            Stack frames pop automatically on <strong>Return</strong>. Heap blocks only leave when you
            <strong> Free</strong> them — pop a frame holding the last pointer and the block leaks.
          </p>
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

// ---- canvas primitives ----
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: Frame, top: boolean) {
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = top ? 'rgba(79,70,229,0.16)' : 'rgba(79,70,229,0.07)';
  ctx.fill();
  ctx.lineWidth = top ? 2 : 1.25;
  ctx.strokeStyle = STACK_COLOR;
  ctx.stroke();

  ctx.font = '700 12px Inter, sans-serif';
  ctx.fillStyle = STACK_COLOR;
  ctx.fillText(f.name, x + 8, y + 15);

  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(128,128,128,0.95)';
  const text = f.locals.join('  ');
  ctx.fillText(text.length > 26 ? text.slice(0, 25) + '…' : text, x + 8, y + h - 7);

  if (f.ptr !== null) {
    ctx.beginPath();
    ctx.arc(x + w - 8, y + h / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#64748b';
    ctx.fill();
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, b: Block) {
  const color = b.freed ? FREED_COLOR : HEAP_COLORS[b.colorIdx];
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = b.freed ? 'rgba(148,163,184,0.18)' : `${color}26`;
  ctx.fill();
  if (b.leaked) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = LEAK_COLOR;
    ctx.lineWidth = 2.5;
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '700 12px Inter, sans-serif';
  ctx.fillStyle = b.leaked ? LEAK_COLOR : color;
  ctx.fillText(`${b.size} B`, x + 8, y + 16);
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = b.leaked ? LEAK_COLOR : 'rgba(128,128,128,0.95)';
  ctx.fillText(b.leaked ? 'LEAKED' : b.freed ? 'freed' : 'in use', x + 8, y + h - 7);
}

function arrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, color: string) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 8;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.75;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.45), to.y - head * Math.sin(angle - 0.45));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.45), to.y - head * Math.sin(angle + 0.45));
  ctx.closePath(); ctx.fill();
}
