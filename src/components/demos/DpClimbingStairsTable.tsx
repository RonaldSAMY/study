import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated 1-D DP table for "count ways to climb n stairs" (1 or 2
   steps at a time).
   - The learner picks n (2..18) and presses Load to rebuild the frames.
   - Recurrence: dp[i] = dp[i-1] + dp[i-2], with base cases dp[0]=1,
     dp[1]=1. The table is filled left to right, one cell per step.
   - Frames are PRECOMPUTED (index-driven by `idx`), not live recursion:
       idx 0          -> base cases dp[0], dp[1] are shown.
       idx k (1..n-1) -> cell dp[k+1] has just been filled.
   - Each step highlights the current cell (sky) and the two cells it
     reads, dp[i-1] and dp[i-2] (softer), plus a live caption.
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', read: '#4f46e5', done: '#10b981' };

const clampN = (v: number): number => Math.max(2, Math.min(18, Math.floor(v)));

// dp[0..n] for the climbing-stairs recurrence.
const buildDp = (n: number): number[] => {
  const dp = new Array(n + 1).fill(0);
  dp[0] = 1;
  dp[1] = 1;
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp;
};

export default function DpClimbingStairsTable() {
  const [draft, setDraft] = useState('8');
  const [n, setN] = useState(8);
  const [idx, setIdx] = useState(0); // 0..n-1
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const dp = buildDp(n);
  const maxIdx = n - 1; // idx that fills dp[n]

  const load = () => {
    const next = clampN(parseInt(draft, 10) || 2);
    setDraft(String(next));
    setN(next);
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > maxIdx) {
          setIdx(maxIdx);
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
  }, [playing, speed, n, maxIdx]);

  const reset = () => {
    setPlaying(false);
    setIdx(0);
    lastRef.current = 0;
  };
  const stepF = () => {
    setPlaying(false);
    setIdx((v) => Math.min(maxIdx, v + 1));
  };
  const stepB = () => {
    setPlaying(false);
    setIdx((v) => Math.max(0, v - 1));
  };
  const play = () => {
    if (idx >= maxIdx) setIdx(0);
    lastRef.current = 0;
    setPlaying((p) => !p);
  };

  // Which cells are visible/filled, and which is the current target.
  const filledUpTo = idx === 0 ? 1 : idx + 1; // highest index with a value
  const current = idx === 0 ? -1 : idx + 1; // the cell just filled (i)
  const readA = current - 1;
  const readB = current - 2;
  const done = idx >= maxIdx;

  const caption =
    idx === 0
      ? 'Base cases: dp[0] = 1 (one way to "stay") and dp[1] = 1 (one single step). Press Play to fill the rest.'
      : `dp[${current}] = dp[${readA}] + dp[${readB}] = ${dp[readA]} + ${dp[readB]} = ${dp[current]}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* input */}
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-sm text-muted">
          stairs n
          <input
            type="number"
            min={2}
            max={18}
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            class="w-20 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm"
          />
        </label>
        <button
          onClick={load}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Load
        </button>
        <span class="text-xs text-muted">(2–18)</span>
      </div>

      {/* dp table: a responsive row of cells, index label above each */}
      <div class="overflow-x-auto">
        <div class="flex min-w-max gap-1.5 py-1">
          {dp.map((val, i) => {
            const visible = i <= filledUpTo;
            const isCur = i === current;
            const isRead = i === readA || i === readB;
            let style = '';
            let cls =
              'border-border bg-surface-2 text-muted'; // empty / not yet filled
            if (visible) {
              if (done && i === n) {
                cls = 'border-transparent text-white';
                style = `background:${COLORS.done}`;
              } else if (isCur) {
                cls = 'border-transparent text-white';
                style = `background:${COLORS.cur}`;
              } else if (isRead) {
                cls = 'border-transparent text-white';
                style = `background:${COLORS.read}`;
              } else {
                cls = 'border-border bg-surface text-text';
              }
            }
            return (
              <div key={i} class="flex flex-col items-center gap-1">
                <span class="font-mono text-[11px] text-muted">dp[{i}]</span>
                <div
                  class={`flex h-11 w-11 items-center justify-center rounded-md border text-sm font-bold transition ${cls} ${isCur ? 'scale-110' : ''}`}
                  style={style}
                >
                  {visible ? val : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm text-text">
        {caption}
      </p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Done — there are <span style={`color:${COLORS.done}`}>{dp[n]}</span> ways to climb {n} stairs.
          Each cell was computed exactly once: that is the whole point of DP.
        </p>
      )}

      {/* transport */}
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
        Sky = the cell being filled, indigo = the two cells it reads (dp[i-1] and dp[i-2]), green = the final answer.
      </p>
    </div>
  );
}
