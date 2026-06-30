import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated deque (double-ended queue).
   - The learner writes a script of operations that push/pop at BOTH ends:
       F+x  add x at the FRONT          R+x  add x at the REAR
       F-   remove from the FRONT       R-   remove from the REAR
   - One precomputed frame per operation; transport controls move a cursor.
     Autoplay uses requestAnimationFrame, cancelled on pause / unmount.
   - The end that just changed is highlighted, and a leaving cell fades out
     on whichever side it left from.
   ------------------------------------------------------------------ */

const COLORS = { front: '#0ea5e9', rear: '#10b981', leaving: '#4f46e5' };

type Cell = { val: string; id: number };
type Frame = {
  items: Cell[];
  changedId: number | null;      // a cell that was just added
  changedSide: 'front' | 'rear' | null;
  removed: string | null;
  removedSide: 'front' | 'rear' | null;
  caption: string;
};

function parseOps(text: string): { op: 'F+' | 'R+' | 'F-' | 'R-'; val?: string }[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const up = t.toUpperCase();
      if (up === 'F-') return { op: 'F-' as const };
      if (up === 'R-') return { op: 'R-' as const };
      if (up.startsWith('F+')) return { op: 'F+' as const, val: t.slice(2).trim() };
      if (up.startsWith('R+')) return { op: 'R+' as const, val: t.slice(2).trim() };
      // bare value defaults to rear push
      return { op: 'R+' as const, val: t };
    });
}

function buildFrames(text: string): Frame[] {
  const ops = parseOps(text);
  let items: Cell[] = [];
  let nextId = 0;
  const frames: Frame[] = [
    { items: [], changedId: null, changedSide: null, removed: null, removedSide: null, caption: 'An empty deque. You can grow or shrink it from either end. Press Play.' },
  ];
  for (const o of ops) {
    if (o.op === 'F+') {
      const id = nextId++;
      items = [{ val: o.val ?? '?', id }, ...items];
      frames.push({ items, changedId: id, changedSide: 'front', removed: null, removedSide: null, caption: `addFront(${o.val}) — a new value pushes in at the FRONT (left).` });
    } else if (o.op === 'R+') {
      const id = nextId++;
      items = [...items, { val: o.val ?? '?', id }];
      frames.push({ items, changedId: id, changedSide: 'rear', removed: null, removedSide: null, caption: `addRear(${o.val}) — a new value pushes in at the REAR (right).` });
    } else if (o.op === 'F-') {
      if (!items.length) { frames.push({ items, changedId: null, changedSide: null, removed: null, removedSide: null, caption: 'removeFront() on an empty deque returns undefined.' }); }
      else { const r = items[0]; items = items.slice(1); frames.push({ items, changedId: null, changedSide: null, removed: r.val, removedSide: 'front', caption: `removeFront() returns ${r.val} — taken from the FRONT.` }); }
    } else {
      if (!items.length) { frames.push({ items, changedId: null, changedSide: null, removed: null, removedSide: null, caption: 'removeRear() on an empty deque returns undefined.' }); }
      else { const r = items[items.length - 1]; items = items.slice(0, -1); frames.push({ items, changedId: null, changedSide: null, removed: r.val, removedSide: 'rear', caption: `removeRear() returns ${r.val} — taken from the REAR.` }); }
    }
  }
  return frames;
}

export default function QueDequePlayground() {
  const [text, setText] = useState('R+1, R+2, F+0, R+3, F-, R-');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames('R+1, R+2, F+0, R+3, F-, R-'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => { setFrames(buildFrames(text)); setIdx(0); setPlaying(false); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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
  const last = f.items.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="F+0, R+1, F-, R-" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>
      <p class="mb-3 text-center text-xs text-muted"><span class="font-mono">F+x</span> add front · <span class="font-mono">R+x</span> add rear · <span class="font-mono">F-</span> remove front · <span class="font-mono">R-</span> remove rear</p>

      <div class="rounded-xl bg-surface-2 px-3 py-5">
        <div class="flex items-end justify-center gap-1.5">
          {f.removed != null && f.removedSide === 'front' && (
            <div class="flex flex-col items-center opacity-60">
              <span class="mb-1 text-[10px] font-semibold" style={`color:${COLORS.leaving}`}>⟵ left</span>
              <div class="flex h-12 w-12 items-center justify-center rounded-md border-2 border-dashed font-mono text-base font-bold text-muted line-through" style={`border-color:${COLORS.leaving}`}>{f.removed}</div>
            </div>
          )}
          {f.items.length === 0 && f.removed == null && <span class="py-4 text-sm text-muted">empty deque</span>}
          {f.items.map((c, i) => {
            const isFront = i === 0;
            const isRear = i === last;
            const just = c.id === f.changedId;
            const color = just ? (f.changedSide === 'front' ? COLORS.front : COLORS.rear) : isFront ? COLORS.front : isRear ? COLORS.rear : null;
            return (
              <div key={c.id} class="flex flex-col items-center">
                <span class="mb-1 h-3 text-[10px] font-semibold" style={isFront ? `color:${COLORS.front}` : isRear ? `color:${COLORS.rear}` : ''}>{isFront ? 'front' : isRear ? 'rear' : ''}</span>
                <div class={`flex h-12 w-12 items-center justify-center rounded-md border-2 font-mono text-base font-bold transition ${color ? 'text-white' : 'border-border bg-surface text-text'}`} style={color ? `background:${color};border-color:${color}` : ''}>{c.val}</div>
              </div>
            );
          })}
          {f.removed != null && f.removedSide === 'rear' && (
            <div class="flex flex-col items-center opacity-60">
              <span class="mb-1 text-[10px] font-semibold" style={`color:${COLORS.leaving}`}>left ⟶</span>
              <div class="flex h-12 w-12 items-center justify-center rounded-md border-2 border-dashed font-mono text-base font-bold text-muted line-through" style={`border-color:${COLORS.leaving}`}>{f.removed}</div>
            </div>
          )}
        </div>
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
      <p class="mt-2 text-center text-xs text-muted">Tip: use only <span class="font-mono">R+x</span> and <span class="font-mono">F-</span> and the deque behaves exactly like a plain queue. Use only one end and it is a stack.</p>
    </div>
  );
}
