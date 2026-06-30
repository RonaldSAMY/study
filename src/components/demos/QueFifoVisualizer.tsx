import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated FIFO queue.
   - The learner writes their OWN script of operations, e.g.
       +5, +3, +8, -, +1, -
     where "+x" enqueues x at the REAR and "-" dequeues from the FRONT.
   - We precompute one frame per operation (index-driven), so the
     transport controls (Play / Pause / Step / Back / Reset) just move a
     cursor over the frames. Autoplay uses requestAnimationFrame and is
     cancelled on pause / unmount.
   - The FRONT cell (next to leave) and the REAR cell (just arrived) are
     highlighted, and a live caption narrates every step.
   ------------------------------------------------------------------ */

const COLORS = { front: '#0ea5e9', rear: '#10b981', leaving: '#4f46e5' };

type Cell = { val: string; id: number };
type Frame = {
  items: Cell[];
  enqueuedId: number | null;
  removed: string | null;
  caption: string;
};

// Parse a script like "+5, +3, -, +1" into typed operations.
function parseOps(text: string): { kind: 'enq' | 'deq'; val?: string }[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => {
      if (t === '-' || t.toLowerCase() === 'd') return { kind: 'deq' as const };
      const val = t.startsWith('+') ? t.slice(1).trim() : t;
      return { kind: 'enq' as const, val };
    });
}

// Simulate the whole script up front and capture a frame after each step.
function buildFrames(text: string): Frame[] {
  const ops = parseOps(text);
  const frames: Frame[] = [
    { items: [], enqueuedId: null, removed: null, caption: 'The queue is empty. Press Play to run your operations left to right.' },
  ];
  let items: Cell[] = [];
  let nextId = 0;
  for (const op of ops) {
    if (op.kind === 'enq') {
      const id = nextId++;
      items = [...items, { val: op.val ?? '?', id }];
      frames.push({
        items,
        enqueuedId: id,
        removed: null,
        caption: `enqueue(${op.val}) — the new value joins at the REAR. Front is still ${items[0].val}.`,
      });
    } else {
      if (items.length === 0) {
        frames.push({ items, enqueuedId: null, removed: null, caption: 'dequeue() on an empty queue returns undefined — nothing to remove.' });
      } else {
        const removed = items[0];
        items = items.slice(1);
        frames.push({
          items,
          enqueuedId: null,
          removed: removed.val,
          caption: `dequeue() returns ${removed.val} — the FRONT leaves first. ${items.length ? `Front is now ${items[0].val}.` : 'The queue is empty again.'}`,
        });
      }
    }
  }
  return frames;
}

export default function QueFifoVisualizer() {
  const [text, setText] = useState('+5, +3, +8, -, +1, -');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames('+5, +3, +8, -, +1, -'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => {
    const f = buildFrames(text);
    setFrames(f);
    setIdx(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) {
          setIdx(frames.length - 1);
          setPlaying(false);
          return;
        }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = frames[idx];
  const last = frame.items.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm"
          placeholder="+5, +3, -, +1   (+x enqueues, - dequeues)"
        />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* the queue: a row of cells with front (left) and rear (right) */}
      <div class="rounded-xl bg-surface-2 px-3 py-5">
        <div class="flex items-end justify-center gap-1.5">
          {/* a cell that just left the queue, shown fading on the left */}
          {frame.removed != null && (
            <div class="flex flex-col items-center opacity-60">
              <span class="mb-1 text-[10px] font-semibold" style={`color:${COLORS.leaving}`}>left ⟵</span>
              <div class="flex h-12 w-12 items-center justify-center rounded-md border-2 border-dashed font-mono text-base font-bold text-muted line-through" style={`border-color:${COLORS.leaving}`}>{frame.removed}</div>
            </div>
          )}
          {frame.items.length === 0 && frame.removed == null && (
            <span class="py-4 text-sm text-muted">empty queue</span>
          )}
          {frame.items.map((c, i) => {
            const isFront = i === 0;
            const isRear = i === last;
            const justIn = c.id === frame.enqueuedId;
            const color = justIn ? COLORS.rear : isFront ? COLORS.front : null;
            return (
              <div key={c.id} class="flex flex-col items-center">
                <span class="mb-1 h-3 text-[10px] font-semibold" style={isFront ? `color:${COLORS.front}` : isRear ? `color:${COLORS.rear}` : ''}>
                  {isFront ? 'front' : isRear ? 'rear' : ''}
                </span>
                <div
                  class={`flex h-12 w-12 items-center justify-center rounded-md border-2 font-mono text-base font-bold transition ${color ? 'text-white' : 'border-border bg-surface text-text'}`}
                  style={color ? `background:${color};border-color:${color}` : ''}
                >
                  {c.val}
                </div>
                <span class="mt-1 h-3 text-[10px] text-muted">{isFront ? '↑ dequeue' : isRear ? 'enqueue ↑' : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>

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
      <p class="mt-2 text-center text-xs text-muted">Tip: values join at the rear and leave from the front — the first one in is always the first one out.</p>
    </div>
  );
}
