import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated bottom-up DP table for MINIMUM COINS.
   - The learner edits their own coins (comma-separated) and a target
     amount. "Load" precomputes a list of step-frames.
   - We fill dp[] left to right: dp[0] = 0, every other cell starts at
     Infinity (shown as ∞). For each amount a we try every coin c <= a
     and keep the running min: dp[a] = min(dp[a], dp[a - c] + 1).
   - Each frame is a snapshot of the whole dp array plus which cell is
     active (a) and which sub-cell (a - c) is being read. The view is
     idx-driven, NOT recomputed live.
   - Transport: Back / Play / Pause / Step / Reset + speed, exactly like
     XorSingleNumber: requestAnimationFrame autoplay with
     cancelAnimationFrame cleanup, idx mirrored in a ref.
   ------------------------------------------------------------------ */

const INF = Infinity;
const COLORS = { active: '#0ea5e9', read: '#4f46e5', done: '#10b981' };
const MAX_AMOUNT = 24;

type Frame = {
  dp: number[];
  a: number;            // amount cell being computed (0 for the init frame)
  readIdx: number | null; // sub-cell dp[a - c] being read this step
  coin: number | null;  // coin tried (or the winning coin on a final frame)
  kind: 'init' | 'try' | 'final';
  caption: string;
};

const fmt = (v: number): string => (v === INF ? '∞' : String(v));

const parseCoins = (s: string): number[] => {
  const seen = new Set<number>();
  for (const part of s.split(',')) {
    const n = parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0 && n <= 50) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
};

function buildFrames(coins: number[], target: number): Frame[] {
  const dp = new Array(target + 1).fill(INF);
  dp[0] = 0;
  const frames: Frame[] = [];

  frames.push({
    dp: dp.slice(),
    a: 0,
    readIdx: null,
    coin: null,
    kind: 'init',
    caption: 'dp[0] = 0 — zero coins make amount 0. Every other cell starts at ∞ (not yet reachable).',
  });

  for (let a = 1; a <= target; a++) {
    let best = dp[a]; // Infinity
    let bestCoin: number | null = null;
    const usable = coins.filter((c) => c <= a);

    if (usable.length === 0) {
      frames.push({
        dp: dp.slice(),
        a,
        readIdx: null,
        coin: null,
        kind: 'final',
        caption: `No coin is ≤ ${a}, so dp[${a}] stays ∞ (unreachable).`,
      });
      continue;
    }

    for (const c of usable) {
      const readIdx = a - c;
      const sub = dp[readIdx];
      const cand = sub === INF ? INF : sub + 1;
      const prevBest = best;
      if (cand < best) {
        best = cand;
        bestCoin = c;
      }
      dp[a] = best;
      const improved = cand !== INF && cand === best && prevBest !== best;
      frames.push({
        dp: dp.slice(),
        a,
        readIdx,
        coin: c,
        kind: 'try',
        caption:
          `dp[${a}] = min(dp[${a}], dp[${a}-${c}]+1) = min(${fmt(prevBest)}, ${fmt(cand)}) = ${fmt(best)}` +
          (improved ? `  — coin ${c} improves it` : cand === INF ? `  — dp[${readIdx}] is ∞, skip` : ''),
      });
    }

    frames.push({
      dp: dp.slice(),
      a,
      readIdx: null,
      coin: bestCoin,
      kind: 'final',
      caption:
        best === INF
          ? `dp[${a}] = ∞ — amount ${a} cannot be made with these coins.`
          : `dp[${a}] = ${best} — fewest coins to make ${a}${bestCoin != null ? `, last coin ${bestCoin}` : ''}.`,
    });
  }

  return frames;
}

export default function DpCoinChangeTable() {
  const [coinsText, setCoinsText] = useState('1, 2, 5');
  const [amountText, setAmountText] = useState('11');
  const [coins, setCoins] = useState<number[]>(() => parseCoins('1, 2, 5'));
  const [target, setTarget] = useState(11);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(parseCoins('1, 2, 5'), 11));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const last = frames.length - 1;

  const load = () => {
    const c = parseCoins(coinsText);
    let a = parseInt(amountText.trim(), 10);
    if (!Number.isFinite(a)) a = 1;
    a = Math.max(1, Math.min(MAX_AMOUNT, a));
    const safeCoins = c.length ? c : [1];
    setCoins(safeCoins);
    setTarget(a);
    setFrames(buildFrames(safeCoins, a));
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 720 / speed;
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

  const reset = () => {
    setPlaying(false);
    setIdx(0);
    lastRef.current = 0;
  };
  const stepF = () => {
    setPlaying(false);
    setIdx((v) => Math.min(last, v + 1));
  };
  const stepB = () => {
    setPlaying(false);
    setIdx((v) => Math.max(0, v - 1));
  };
  const play = () => {
    if (idx >= last) setIdx(0);
    lastRef.current = 0;
    setPlaying((p) => !p);
  };

  const frame = frames[Math.min(idx, last)];
  const done = idx >= last;
  const answer = frames.length ? frames[last].dp[target] : INF;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* inputs */}
      <div class="mb-3 flex flex-wrap items-end gap-3">
        <label class="flex flex-1 flex-col gap-1 text-xs text-muted">
          coins (comma-separated)
          <input
            value={coinsText}
            onInput={(e) => setCoinsText((e.target as HTMLInputElement).value)}
            class="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text"
            placeholder="1, 2, 5"
          />
        </label>
        <label class="flex w-28 flex-col gap-1 text-xs text-muted">
          amount (1–{MAX_AMOUNT})
          <input
            type="number"
            min={1}
            max={MAX_AMOUNT}
            value={amountText}
            onInput={(e) => setAmountText((e.target as HTMLInputElement).value)}
            class="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text"
          />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">
          Load
        </button>
      </div>

      <p class="mb-3 text-xs text-muted">
        Filling dp[a] = min over coins c ≤ a of dp[a−c] + 1. Coins: {coins.join(', ')}.
      </p>

      {/* dp table */}
      <div class="overflow-x-auto pb-1">
        <div class="flex gap-1.5">
          {frame.dp.map((v, i) => {
            const isActive = frame.kind !== 'init' && i === frame.a;
            const isRead = i === frame.readIdx;
            const isAnswer = done && i === target;
            const settled = i < frame.a || (i === frame.a && frame.kind === 'final');
            let style = '';
            let cls = 'border-border bg-surface-2 text-text';
            if (isAnswer) {
              cls = 'border-transparent text-white';
              style = `background:${COLORS.done}`;
            } else if (isActive) {
              cls = 'border-transparent text-white';
              style = `background:${COLORS.active}`;
            } else if (isRead) {
              cls = 'text-white border-transparent';
              style = `background:${COLORS.read}`;
            } else if (settled && v !== INF) {
              cls = 'border-border bg-brand-soft text-text';
            }
            return (
              <div key={i} class="flex shrink-0 flex-col items-center gap-1">
                <span class="text-[10px] font-semibold text-muted">{i}</span>
                <div
                  class={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-bold transition ${cls}`}
                  style={style}
                >
                  {fmt(v)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* legend */}
      <div class="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
        <span class="flex items-center gap-1">
          <span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.active}`} /> current cell a
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.read}`} /> sub-cell dp[a−c]
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.done}`} /> final answer
        </span>
      </div>

      {/* caption */}
      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm text-text">{frame.caption}</p>

      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          {answer === INF
            ? `Amount ${target} is unreachable with coins {${coins.join(', ')}} — dp[${target}] = ∞.`
            : `Done: the fewest coins to make ${target} is ${answer}.`}
        </p>
      )}

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
          ⏮ Back
        </button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
          ⏭ Step
        </button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
          ↺ Reset
        </button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.5}
            value={speed}
            onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
            class="w-24 accent-[#4f46e5]"
          />
        </label>
      </div>

      <p class="mt-2 text-center text-xs text-muted">
        Step {Math.min(idx, last) + 1} / {frames.length}. Try coins [1, 3, 4] with amount 6 to see why greedy is wrong.
      </p>
    </div>
  );
}
