import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sliding Window — minimum-length subarray with sum ≥ target.
   - Edit the array (positive numbers) and the target. A window [left,
     right] grows by adding on the right; the moment its sum reaches
     the target it SHRINKS from the left, recording the smallest valid
     width seen.
   - Frames are precomputed; the transport walks through them. Window
     cells are highlighted; a caption narrates expand vs. contract.
   ------------------------------------------------------------------ */

type Kind = 'intro' | 'expand' | 'record' | 'contract' | 'done';
type Frame = { left: number; right: number; sum: number; best: number; bestRange: [number, number] | null; note: string; kind: Kind };
const COLORS = { window: '#4f46e5', valid: '#0ea5e9', best: '#10b981' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x) && x > 0).slice(0, 12);

function buildFrames(arr: number[], target: number): Frame[] {
  const frames: Frame[] = [];
  let left = 0;
  let sum = 0;
  let best = Infinity;
  let bestRange: [number, number] | null = null;
  frames.push({ left: 0, right: -1, sum: 0, best, bestRange, kind: 'intro', note: `Empty window. Grow it on the right until the sum reaches ${target}.` });
  for (let right = 0; right < arr.length; right++) {
    sum += arr[right];
    frames.push({ left, right, sum, best, bestRange, kind: 'expand', note: `Expand: add arr[${right}] = ${arr[right]}. Window sum = ${sum}.` });
    while (sum >= target) {
      const len = right - left + 1;
      if (len < best) { best = len; bestRange = [left, right]; }
      frames.push({ left, right, sum, best, bestRange, kind: 'record', note: `Sum ${sum} ≥ ${target}: valid window of length ${len} (best so far = ${best}). Shrink from the left.` });
      sum -= arr[left];
      left++;
      frames.push({ left, right, sum, best, bestRange, kind: 'contract', note: `Contract: drop arr[${left - 1}]. Window sum = ${sum}.` });
    }
  }
  frames.push({ left, right: arr.length - 1, sum, best, bestRange, kind: 'done', note: best === Infinity ? `No window ever reached ${target}. Answer: 0.` : `Smallest window with sum ≥ ${target} has length ${best}.` });
  return frames;
}

export default function ArrSlidingWindow() {
  const initial = [2, 3, 1, 2, 4, 3];
  const [text, setText] = useState('2, 3, 1, 2, 4, 3');
  const [target, setTarget] = useState(7);
  const [arr, setArr] = useState<number[]>(initial);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(initial, 7));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const rebuild = (a: number[], t: number) => { setFrames(buildFrames(a, t)); setIdx(0); setPlaying(false); };
  const commit = () => { const p = parseList(text); if (p.length) { setArr(p); rebuild(p, target); } };
  const setT = (t: number) => { setTarget(t); rebuild(arr, t); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
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
  const inWindow = (i: number) => i >= f.left && i <= f.right;
  const inBest = (i: number) => f.bestRange != null && i >= f.bestRange[0] && i <= f.bestRange[1];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="positive numbers, comma-separated" />
        <label class="flex items-center gap-1 text-xs text-muted">target
          <input type="number" value={target} onInput={(e) => setT(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex flex-wrap gap-2 font-mono text-sm">
        {arr.map((x, i) => {
          const win = inWindow(i);
          const done = f.kind === 'done';
          const showBest = done && inBest(i);
          const color = showBest ? COLORS.best : f.kind === 'record' ? COLORS.valid : COLORS.window;
          const active = (win && !done) || showBest;
          return (
            <div key={i} class="flex flex-col items-center gap-1">
              <div class="h-4 text-[10px] font-bold" style={`color:${COLORS.window}`}>{i === f.left && i === f.right && win ? 'L R' : i === f.left && win ? 'L' : i === f.right && win ? 'R' : ''}</div>
              <div class={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-bold transition ${active ? 'scale-105 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${color}` : ''}>{x}</div>
              <span class="text-xs text-muted">{i}</span>
            </div>
          );
        })}
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm">
        <span class="rounded-lg bg-surface-2 px-3 py-1.5">window sum = <strong style={`color:${f.sum >= target ? COLORS.valid : COLORS.window}`}>{f.sum}</strong></span>
        <span class="text-muted">target = {target}</span>
        <span class="rounded-lg bg-surface-2 px-3 py-1.5">best length = <strong style={`color:${COLORS.best}`}>{f.best === Infinity ? '∞' : f.best}</strong></span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.note}</p>
      {f.kind === 'done' && f.best !== Infinity && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Each pointer only moves forward, so the whole scan is O(n) — far better than checking every subarray.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Watch the window breathe: it grows on the right, then squeezes from the left the instant the sum is big enough.</p>
    </div>
  );
}
