import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Array Fundamentals — why access is O(1) but insert/delete at the
   front is O(n).
   - Edit the array. Pick an operation: random access, insert at the
     front, delete from the front, or push to the end.
   - Each operation is precomputed into step-frames. The transport
     (Play / Pause / Step / Back / Reset + speed) walks an index
     through them. We HIGHLIGHT the cell being touched and count how
     many element moves it costs, with a live caption.
   ------------------------------------------------------------------ */

type Op = 'access' | 'insertFront' | 'deleteFront' | 'push';
type Frame = { arr: (number | null)[]; active: number | null; note: string; ops: number };

const COLORS = { active: '#4f46e5', write: '#10b981', idx: '#0ea5e9' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 9);

function buildFrames(base: number[], op: Op, value: number, at: number): Frame[] {
  const n = base.length;
  const frames: Frame[] = [];

  if (op === 'access') {
    const k = Math.max(0, Math.min(n - 1, at));
    frames.push({ arr: [...base], active: null, note: `Goal: read index ${k}. An array lives in one contiguous block.`, ops: 0 });
    frames.push({ arr: [...base], active: k, note: `address = start + ${k} × elementSize → one multiply-add. No scanning: that is O(1).`, ops: 1 });
    return frames;
  }

  if (op === 'push') {
    const w: (number | null)[] = [...base, null];
    frames.push({ arr: [...w], active: null, note: `Goal: append ${value} at the end. There is room right after the last element.`, ops: 0 });
    w[n] = value;
    frames.push({ arr: [...w], active: n, note: `Write ${value} into the empty end slot — no element had to move. O(1) (amortized).`, ops: 1 });
    return frames;
  }

  if (op === 'insertFront') {
    const w: (number | null)[] = [...base, null];
    frames.push({ arr: [...w], active: null, note: `Goal: insert ${value} at index 0. Every element must first slide one slot right.`, ops: 0 });
    let ops = 0;
    for (let i = n - 1; i >= 0; i--) {
      w[i + 1] = w[i];
      w[i] = null;
      ops++;
      frames.push({ arr: [...w], active: i + 1, note: `Shift the value from index ${i} → ${i + 1}. (${ops} move${ops > 1 ? 's' : ''} so far.)`, ops });
    }
    w[0] = value;
    frames.push({ arr: [...w], active: 0, note: `Now write ${value} into the freed slot 0. Total: ${ops} shifts for ONE insert → O(n).`, ops });
    return frames;
  }

  // deleteFront
  const w: (number | null)[] = [...base];
  frames.push({ arr: [...w], active: 0, note: `Goal: delete index 0 (${base[0]}). The hole must be closed by sliding everyone left.`, ops: 0 });
  let ops = 0;
  for (let i = 1; i < n; i++) {
    w[i - 1] = w[i];
    w[i] = null;
    ops++;
    frames.push({ arr: [...w], active: i - 1, note: `Shift the value from index ${i} → ${i - 1}. (${ops} move${ops > 1 ? 's' : ''} so far.)`, ops });
  }
  frames.push({ arr: w.slice(0, n - 1), active: null, note: `Length shrinks by one. Total: ${ops} shifts to delete the front → O(n).`, ops });
  return frames;
}

export default function ArrArrayBasics() {
  const [text, setText] = useState('3, 1, 4, 1, 5');
  const [base, setBase] = useState<number[]>(() => parseList('3, 1, 4, 1, 5'));
  const [op, setOp] = useState<Op>('insertFront');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(parseList('3, 1, 4, 1, 5'), 'insertFront', 9, 2));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const rebuild = (b: number[], o: Op) => {
    setFrames(buildFrames(b, o, 9, 2));
    setIdx(0);
    setPlaying(false);
  };
  const commit = () => { const p = parseList(text); if (p.length) { setBase(p); rebuild(p, op); } };
  const pickOp = (o: Op) => { setOp(o); rebuild(base, o); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
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

  const frame = frames[idx];
  const done = idx >= frames.length - 1;

  const ops: { id: Op; label: string }[] = [
    { id: 'access', label: 'Access [2]' },
    { id: 'insertFront', label: 'Insert 9 @ front' },
    { id: 'deleteFront', label: 'Delete front' },
    { id: 'push', label: 'Push 9 @ end' },
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-3 flex flex-wrap gap-2">
        {ops.map((o) => (
          <button key={o.id} onClick={() => pickOp(o.id)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${op === o.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{o.label}</button>
        ))}
      </div>

      {/* array cells with index labels */}
      <div class="flex flex-wrap gap-2 font-mono text-sm">
        {frame.arr.map((x, i) => (
          <div key={i} class="flex flex-col items-center gap-1">
            <div class={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-bold transition ${i === frame.active ? 'scale-110 border-transparent text-white' : x === null ? 'border-dashed border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={i === frame.active ? `background:${op === 'insertFront' && done ? COLORS.write : op === 'push' && done ? COLORS.write : COLORS.active}` : ''}>{x === null ? '·' : x}</div>
            <span class="text-xs" style={`color:${COLORS.idx}`}>{i}</span>
          </div>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frame.note}</p>
      <div class="mt-2 flex items-center gap-3 text-xs text-muted">
        <span>element moves so far: <strong class="text-text">{frame.ops}</strong></span>
        <span>step {idx + 1} / {frames.length}</span>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Compare the operations: access and push touch one cell; insert/delete at the front touch every cell.</p>
    </div>
  );
}
