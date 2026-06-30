import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The Two-Pointer Technique — Two Sum on a SORTED array.
   - Edit the array (it gets sorted) and the target. A left pointer
     starts at the front, a right pointer at the back. Each step we
     look at the sum and move ONE pointer inward:
       sum < target → move left right  (need a bigger sum)
       sum > target → move right left  (need a smaller sum)
       sum = target → found the pair.
   - Frames are precomputed; the transport walks through them. The two
     pointer cells are highlighted and a caption narrates the decision.
   ------------------------------------------------------------------ */

type Frame = { left: number; right: number; note: string; found?: boolean };
const COLORS = { left: '#4f46e5', right: '#0ea5e9', found: '#10b981' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 10);

function buildFrames(arr: number[], target: number): Frame[] {
  const frames: Frame[] = [];
  let left = 0;
  let right = arr.length - 1;
  frames.push({ left, right, note: `Sorted. Put one pointer at each end. Looking for two values that sum to ${target}.` });
  while (left < right) {
    const sum = arr[left] + arr[right];
    if (sum === target) {
      frames.push({ left, right, found: true, note: `${arr[left]} + ${arr[right]} = ${target}. Found it — indices ${left} and ${right}.` });
      return frames;
    }
    if (sum < target) {
      frames.push({ left, right, note: `${arr[left]} + ${arr[right]} = ${sum} < ${target}. Too small → move LEFT pointer right for a bigger value.` });
      left++;
    } else {
      frames.push({ left, right, note: `${arr[left]} + ${arr[right]} = ${sum} > ${target}. Too big → move RIGHT pointer left for a smaller value.` });
      right--;
    }
  }
  frames.push({ left, right, note: `Pointers crossed without a match — no pair sums to ${target}.` });
  return frames;
}

export default function ArrTwoPointers() {
  const initial = [2, 7, 8, 11, 15];
  const [text, setText] = useState('2, 11, 7, 15, 8');
  const [target, setTarget] = useState(18);
  const [arr, setArr] = useState<number[]>(initial);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(initial, 18));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const rebuild = (a: number[], t: number) => { setFrames(buildFrames(a, t)); setIdx(0); setPlaying(false); };
  const commit = () => {
    const p = parseList(text).sort((a, b) => a - b);
    if (p.length >= 2) { setArr(p); rebuild(p, target); }
  };
  const setT = (t: number) => { setTarget(t); rebuild(arr, t); };

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
  const sum = arr[f.left] + arr[f.right];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <label class="flex items-center gap-1 text-xs text-muted">target
          <input type="number" value={target} onInput={(e) => setT(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load &amp; sort</button>
      </div>

      {/* array cells */}
      <div class="flex flex-wrap gap-2 font-mono text-sm">
        {arr.map((x, i) => {
          const isL = i === f.left;
          const isR = i === f.right;
          const active = isL || isR;
          const color = f.found ? COLORS.found : isL ? COLORS.left : COLORS.right;
          return (
            <div key={i} class="flex flex-col items-center gap-1">
              <div class="h-5 text-xs font-bold" style={`color:${color}`}>{isL && isR ? 'L R' : isL ? 'L' : isR ? 'R' : ''}</div>
              <div class={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-bold transition ${active ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${color}` : ''}>{x}</div>
              <span class="text-xs text-muted">{i}</span>
            </div>
          );
        })}
      </div>

      <div class="mt-3 flex items-center gap-3 font-mono text-sm">
        <span class="rounded-lg bg-surface-2 px-3 py-1.5">arr[{f.left}] + arr[{f.right}] = {arr[f.left]} + {arr[f.right]} = <strong style={`color:${f.found ? COLORS.found : COLORS.left}`}>{sum}</strong></span>
        <span class="text-muted">target = {target}</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.note}</p>
      {f.found && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">One linear sweep, no hash map, O(1) extra space — only possible because the array is sorted.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try target = 18 (found) and target = 100 (no pair). The pointers only ever move inward.</p>
    </div>
  );
}
