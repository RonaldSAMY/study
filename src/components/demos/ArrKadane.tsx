import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Kadane's Algorithm — maximum-sum contiguous subarray in one pass.
   - Edit the array (negatives welcome). Walking left to right we keep
     a running "current run" sum. At each element we decide: extend the
     run, or throw it away and start fresh here. The best sum ever seen
     is the answer.
   - Frames are precomputed; the transport walks through them. The
     current run is filled indigo (active cell sky); the best run so far
     is marked with an emerald bar. A caption narrates each decision.
   ------------------------------------------------------------------ */

type Frame = { i: number; cur: number; best: number; curRange: [number, number]; bestRange: [number, number]; note: string; newBest: boolean };
const COLORS = { cur: '#4f46e5', active: '#0ea5e9', best: '#10b981' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 12);

function buildFrames(arr: number[]): Frame[] {
  const frames: Frame[] = [];
  if (arr.length === 0) return frames;
  let cur = arr[0];
  let best = arr[0];
  let curStart = 0;
  let bestStart = 0;
  let bestEnd = 0;
  frames.push({ i: 0, cur, best, curRange: [0, 0], bestRange: [0, 0], newBest: false, note: `Start: current run = best = arr[0] = ${arr[0]}.` });
  for (let i = 1; i < arr.length; i++) {
    const extend = cur + arr[i];
    let note: string;
    if (arr[i] > extend) {
      cur = arr[i];
      curStart = i;
      note = `arr[${i}] = ${arr[i]} alone beats extending (${extend}) → drop the old run, start fresh here.`;
    } else {
      cur = extend;
      note = `Extend the run: previous + arr[${i}] = ${cur}.`;
    }
    let newBest = false;
    if (cur > best) { best = cur; bestStart = curStart; bestEnd = i; newBest = true; }
    frames.push({ i, cur, best, curRange: [curStart, i], bestRange: [bestStart, bestEnd], newBest, note: note + (newBest ? ` New best = ${best}!` : ` Best stays ${best}.`) });
  }
  return frames;
}

export default function ArrKadane() {
  const initial = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
  const [text, setText] = useState('-2, 1, -3, 4, -1, 2, 1, -5, 4');
  const [arr, setArr] = useState<number[]>(initial);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(initial));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => { const p = parseList(text); if (p.length) { setArr(p); setFrames(buildFrames(p)); setIdx(0); setPlaying(false); } };

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
  const done = idx >= frames.length - 1;
  const inCur = (i: number) => i >= f.curRange[0] && i <= f.curRange[1];
  const inBest = (i: number) => i >= f.bestRange[0] && i <= f.bestRange[1];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers (negatives allowed)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex flex-wrap gap-2 font-mono text-sm">
        {arr.map((x, i) => {
          const cur = inCur(i) && i <= f.i;
          const active = i === f.i;
          const color = active ? COLORS.active : COLORS.cur;
          return (
            <div key={i} class="flex flex-col items-center gap-1">
              <div class={`h-1.5 w-10 rounded-full ${inBest(i) ? '' : 'opacity-0'}`} style={`background:${COLORS.best}`} />
              <div class={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-bold transition ${cur ? 'scale-105 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={cur ? `background:${color}` : ''}>{x}</div>
              <span class="text-xs text-muted">{i}</span>
            </div>
          );
        })}
      </div>
      <div class="mt-1 flex gap-4 text-xs text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-2 w-3 rounded-sm" style={`background:${COLORS.cur}`} /> current run</span>
        <span class="flex items-center gap-1"><span class="inline-block h-2 w-3 rounded-sm" style={`background:${COLORS.best}`} /> best run so far</span>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm">
        <span class="rounded-lg bg-surface-2 px-3 py-1.5">current = <strong style={`color:${COLORS.cur}`}>{f.cur}</strong></span>
        <span class="rounded-lg bg-surface-2 px-3 py-1.5">best = <strong style={`color:${COLORS.best}`}>{f.best}</strong></span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.note}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Maximum subarray sum = {f.best}, from index {f.bestRange[0]} to {f.bestRange[1]}. One pass, O(1) memory.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">The rule never looks back: whenever the running sum would drag you below the current element, you abandon it and start fresh.</p>
    </div>
  );
}
