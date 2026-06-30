import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated in-place string reversal with two pointers.
   - Edit a string. Two pointers start at both ends and swap, then walk
     toward the middle. Each frame is a precomputed snapshot of the array
     plus the pointer positions, so stepping back/forward is exact.
   - The active left/right cells are highlighted and a caption narrates
     each swap. When the pointers cross, the reversal is done.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { left: '#4f46e5', right: '#0ea5e9', done: '#10b981' };

type Frame = { arr: string[]; l: number; r: number; kind: 'start' | 'swap' | 'done' };

function buildFrames(chars: string[]): Frame[] {
  const a = [...chars];
  const frames: Frame[] = [{ arr: [...a], l: 0, r: a.length - 1, kind: 'start' }];
  let l = 0;
  let r = a.length - 1;
  while (l < r) {
    [a[l], a[r]] = [a[r], a[l]];
    frames.push({ arr: [...a], l, r, kind: 'swap' });
    l++;
    r--;
  }
  frames.push({ arr: [...a], l, r, kind: 'done' });
  return frames;
}

export default function StrReversalTwoPointer() {
  const [text, setText] = useState('stressed');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames([...'stressed']));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => {
    const next = [...text].slice(0, 14);
    if (next.length) { setFrames(buildFrames(next)); setIdx(0); setPlaying(false); }
  };

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

  const f = frames[idx];
  const done = f.kind === 'done';
  const caption = f.kind === 'start'
    ? 'left starts at index 0, right at the last index. Press Play to swap them and march inward.'
    : done
      ? `Pointers crossed (left ${f.l} ≥ right ${f.r}) — every pair has been swapped. Reversal complete: "${f.arr.join('')}".`
      : `swap positions ${f.l} and ${f.r}: '${f.arr[f.r]}' ⇄ '${f.arr[f.l]}', then move left → and ← right inward.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="type a word (max 14 chars)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {f.arr.map((c, i) => {
          const isL = i === f.l && !done;
          const isR = i === f.r && !done;
          const between = !done && i > f.l && i < f.r;
          const settled = done || i < f.l || i > f.r;
          return (
            <div key={i} class="flex flex-col items-center">
              <span
                class={`flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${isL || isR ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`}
                style={`${isL ? `background:${COLORS.left};` : ''}${isR ? `background:${COLORS.right};` : ''}${settled && !isL && !isR ? `border-color:${COLORS.done};` : ''}${between ? 'opacity:.6;' : ''}`}
              >{c === ' ' ? '␣' : c}</span>
              <span class="mt-1 text-[10px] text-muted">{i === f.l && !done ? 'L' : i === f.r && !done ? 'R' : i}</span>
            </div>
          );
        })}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Only ⌊n/2⌋ swaps, no extra array — that is the O(1) extra-space reversal.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Indigo = left pointer, sky = right pointer. They swap, then step toward the centre.</p>
    </div>
  );
}
