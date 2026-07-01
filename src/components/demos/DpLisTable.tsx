import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Longest Increasing Subsequence DP table (O(n^2)).
   - The learner edits the input array (comma-separated). "Load" rebuilds
     the precomputed step-frames.
   - We fill dp[i] = 1 + max(dp[j]) over all j < i with nums[j] < nums[i]
     (else dp[i] = 1). For every (i, j) comparison we emit one frame, plus
     a frame finalizing dp[i]. Frames are precomputed; the UI is idx-driven.
   - Value row highlights the current i (sky) and the scanned j (indigo);
     the dp row fills cell by cell (finalized cells emerald). Parent
     pointers let us light up one real LIS at the end.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', scan: '#4f46e5', done: '#10b981' };
const MAX_LEN = 12;

type Phase = 'start' | 'compare' | 'finalize' | 'done';
type Frame = {
  phase: Phase;
  i: number;          // current index being filled (-1 on start)
  j: number;          // index being compared (-1 when none)
  running: number;    // tentative dp[i] during the scan
  consider: boolean;  // did nums[j] < nums[i] on a compare frame
  dp: (number | null)[]; // finalized dp values (null = not yet filled)
  lis: number[];      // indices forming one reconstructed LIS (done frame)
  best: number;       // final LIS length (done frame)
  caption: string;
};

function parseList(s: string): number[] {
  return s
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x))
    .slice(0, MAX_LEN);
}

function buildFrames(nums: number[]): Frame[] {
  const n = nums.length;
  const frames: Frame[] = [];
  const snap = (dp: number[], filled: boolean[]) => dp.map((v, k) => (filled[k] ? v : null));

  if (n === 0) {
    frames.push({ phase: 'done', i: -1, j: -1, running: 0, consider: false, dp: [], lis: [], best: 0, caption: 'Empty array — the LIS length is 0.' });
    return frames;
  }

  const dp = new Array(n).fill(1);
  const parent = new Array(n).fill(-1);
  const filled = new Array(n).fill(false);

  frames.push({
    phase: 'start', i: -1, j: -1, running: 0, consider: false,
    dp: snap(dp, filled), lis: [], best: 0,
    caption: 'Each element alone is an increasing run of length 1. We fill dp[] left to right, where dp[i] is the longest run ending at index i.',
  });

  for (let i = 0; i < n; i++) {
    let running = 1;
    let bestJ = -1;
    for (let j = 0; j < i; j++) {
      const consider = nums[j] < nums[i];
      let caption: string;
      if (consider) {
        const cand = dp[j] + 1;
        if (cand > running) {
          running = cand;
          bestJ = j;
          caption = `i=${i} (${nums[i]}): compare j=${j} (${nums[j]}) < ${nums[i]} -> dp[${j}]+1 = ${cand}, a new best run of ${cand}.`;
        } else {
          caption = `i=${i} (${nums[i]}): compare j=${j} (${nums[j]}) < ${nums[i]} -> dp[${j}]+1 = ${cand}, not better than ${running}, keep it.`;
        }
      } else {
        caption = `i=${i} (${nums[i]}): compare j=${j} (${nums[j]}) >= ${nums[i]} -> can't extend, skip.`;
      }
      frames.push({
        phase: 'compare', i, j, running, consider,
        dp: snap(dp, filled), lis: [], best: 0, caption,
      });
    }
    dp[i] = running;
    parent[i] = bestJ;
    filled[i] = true;
    frames.push({
      phase: 'finalize', i, j: bestJ, running, consider: false,
      dp: snap(dp, filled), lis: [], best: 0,
      caption: `dp[${i}] = ${running} (longest increasing run ending at ${nums[i]}).`,
    });
  }

  // reconstruct one LIS from parent pointers
  let maxIdx = 0;
  for (let i = 1; i < n; i++) if (dp[i] > dp[maxIdx]) maxIdx = i;
  const lis: number[] = [];
  for (let k = maxIdx; k !== -1; k = parent[k]) lis.unshift(k);
  const lisVals = lis.map((k) => nums[k]);

  frames.push({
    phase: 'done', i: -1, j: -1, running: 0, consider: false,
    dp: snap(dp, filled), lis, best: dp[maxIdx],
    caption: `Scan complete. The largest dp value is ${dp[maxIdx]} — that's the LIS length. One longest increasing subsequence: ${lisVals.join(' -> ')}.`,
  });

  return frames;
}

export default function DpLisTable() {
  const [text, setText] = useState('10, 9, 2, 5, 3, 7, 101, 18');
  const [nums, setNums] = useState<number[]>(() => parseList('10, 9, 2, 5, 3, 7, 101, 18'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = useMemo(() => buildFrames(nums), [nums]);
  const last = frames.length - 1;
  const f = frames[Math.min(idx, last)];

  const commit = () => {
    const parsed = parseList(text);
    setNums(parsed);
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 780 / speed;
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
  }, [playing, speed, frames, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const done = f.phase === 'done';
  const lisSet = new Set(f.lis);

  const valueCellStyle = (k: number): string => {
    if (done && lisSet.has(k)) return `background:${COLORS.done}`;
    if (!done && k === f.i) return `background:${COLORS.cur}`;
    if (!done && k === f.j && f.phase === 'compare') return `background:${COLORS.scan}`;
    return '';
  };
  const valueCellClass = (k: number): string => {
    const active = (done && lisSet.has(k)) || (!done && (k === f.i || (k === f.j && f.phase === 'compare')));
    return active ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text';
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm"
          placeholder="comma-separated numbers"
        />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {nums.length === 0 ? (
        <p class="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">Enter some numbers and press Load.</p>
      ) : (
        <>
          {/* index labels + value row */}
          <div class="overflow-x-auto">
            <div class="flex items-end gap-3 font-mono text-sm">
              <span class="w-12 shrink-0 text-right text-xs text-muted">nums</span>
              <div class="flex gap-1.5">
                {nums.map((x, k) => (
                  <div key={k} class="flex flex-col items-center gap-1">
                    <span class="text-[10px] text-muted">{k}</span>
                    <span
                      class={`flex h-9 min-w-9 items-center justify-center rounded-md border px-1.5 transition ${valueCellClass(k)}`}
                      style={valueCellStyle(k)}
                    >
                      {x}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* dp row */}
            <div class="mt-2 flex items-end gap-3 font-mono text-sm">
              <span class="w-12 shrink-0 text-right text-xs font-bold" style={`color:${COLORS.done}`}>dp</span>
              <div class="flex gap-1.5">
                {nums.map((_, k) => {
                  const v = f.dp[k];
                  const tentative = !done && k === f.i && (f.phase === 'compare' || f.phase === 'finalize');
                  const justSet = f.phase === 'finalize' && k === f.i;
                  let cls = 'border-border bg-surface-2 text-muted';
                  let style = '';
                  if (v != null) { cls = 'border-transparent text-white'; style = `background:${COLORS.done}`; }
                  else if (tentative) { cls = 'border-brand bg-brand-soft text-text font-bold'; }
                  const shown = v != null ? v : tentative ? f.running : '·';
                  return (
                    <div
                      key={k}
                      class={`flex h-9 min-w-9 items-center justify-center rounded-md border px-1.5 transition ${cls} ${justSet ? 'scale-110' : ''}`}
                      style={style}
                    >
                      {shown}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
          {done && f.best > 0 && (
            <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
              LIS length = {f.best}. One longest increasing subsequence: {f.lis.map((k) => nums[k]).join(' → ')}.
            </p>
          )}

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
            <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
            <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
            <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
              <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
            </label>
          </div>
          <p class="mt-2 text-center text-xs text-muted">
            <span style={`color:${COLORS.cur}`}>sky</span> = current i &nbsp;·&nbsp;
            <span style={`color:${COLORS.scan}`}>indigo</span> = scanned j &nbsp;·&nbsp;
            <span style={`color:${COLORS.done}`}>emerald</span> = finalized dp / final LIS. Up to {MAX_LEN} numbers.
          </p>
        </>
      )}
    </div>
  );
}
