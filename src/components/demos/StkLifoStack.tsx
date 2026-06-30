import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated LIFO stack.
   - Edit a comma-separated list of operations: push N, pop, peek.
   - The demo replays them top-down: pushes land a new cell on TOP,
     pops remove the top cell, peek reads it without removing.
   - Each frame highlights the active (top) cell and shows a caption.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

type Op = { op: string; arg?: number };
type Frame = {
  stack: number[];
  caption: string;
  changed: number | null; // index in stack to highlight
  mode: 'idle' | 'push' | 'pop' | 'peek';
};

const COLORS = { push: '#10b981', pop: '#0ea5e9', peek: '#4f46e5' };

const parseOps = (s: string): Op[] =>
  s
    .split(',')
    .map((part) => {
      const t = part.trim().split(/\s+/);
      const op = (t[0] || '').toLowerCase();
      const arg = t[1] !== undefined ? parseInt(t[1], 10) : undefined;
      return { op, arg };
    })
    .filter((o) => o.op === 'push' || o.op === 'pop' || o.op === 'peek');

export default function StkLifoStack() {
  const [text, setText] = useState('push 5, push 3, pop, push 8, peek, push 1');
  const [ops, setOps] = useState<Op[]>(() => parseOps('push 5, push 3, pop, push 8, peek, push 1'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // Precompute one frame per operation (index 0 = empty start).
  const frames: Frame[] = (() => {
    const out: Frame[] = [
      { stack: [], caption: 'An empty stack. Press ▶ Play to apply each operation. New items always land on TOP.', changed: null, mode: 'idle' },
    ];
    const stack: number[] = [];
    for (const { op, arg } of ops) {
      if (op === 'push' && Number.isFinite(arg)) {
        stack.push(arg as number);
        out.push({ stack: [...stack], caption: `push(${arg}) — ${arg} goes on top. size = ${stack.length}.`, changed: stack.length - 1, mode: 'push' });
      } else if (op === 'pop') {
        if (stack.length === 0) {
          out.push({ stack: [], caption: 'pop() on an empty stack — underflow! There is nothing to remove.', changed: null, mode: 'pop' });
        } else {
          const v = stack.pop()!;
          out.push({ stack: [...stack], caption: `pop() removed ${v} — the most recent push. size = ${stack.length}.`, changed: stack.length - 1, mode: 'pop' });
        }
      } else if (op === 'peek') {
        const top = stack.length ? stack[stack.length - 1] : undefined;
        out.push({ stack: [...stack], caption: top === undefined ? 'peek() on an empty stack returns undefined.' : `peek() returns ${top} — read the top WITHOUT removing it.`, changed: stack.length - 1, mode: 'peek' });
      }
    }
    return out;
  })();

  const last = frames.length - 1;
  const commit = () => { const parsed = parseOps(text); setOps(parsed); setIdx(0); setPlaying(false); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > last) { setIdx(last); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, ops, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = frames[Math.min(idx, last)];
  const hi = frame.mode === 'push' ? COLORS.push : frame.mode === 'pop' ? COLORS.pop : COLORS.peek;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="e.g. push 5, push 3, pop, peek" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* the stack, drawn top-to-bottom */}
      <div class="flex flex-col items-center gap-3 rounded-xl bg-surface-2 px-4 py-5">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted">top ↓ push / pop here</span>
        <div class="flex min-h-[3rem] w-40 flex-col-reverse gap-1">
          {frame.stack.length === 0 && <div class="rounded-md border border-dashed border-border px-3 py-2 text-center font-mono text-sm text-muted">empty</div>}
          {frame.stack.map((v, i) => {
            const isTop = i === frame.stack.length - 1;
            const isHi = i === frame.changed;
            return (
              <div key={i} class={`flex items-center justify-between rounded-md border px-3 py-2 font-mono text-sm font-bold transition ${isHi ? 'scale-105 border-transparent text-white' : 'border-border bg-surface text-text'}`} style={isHi ? `background:${hi}` : ''}>
                <span>{v}</span>
                {isTop && <span class={`text-xs font-semibold ${isHi ? 'text-white/90' : 'text-muted'}`}>← top</span>}
              </div>
            );
          })}
        </div>
        <span class="text-xs text-muted">bottom (oldest item)</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.caption}</p>
      {idx >= last && ops.length > 0 && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Done. Notice the order: the LAST value pushed is always the FIRST one popped — that is LIFO.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: use only <span class="font-mono">push N</span>, <span class="font-mono">pop</span> and <span class="font-mono">peek</span>, comma-separated. Try ending with extra pops to see underflow.</p>
    </div>
  );
}
